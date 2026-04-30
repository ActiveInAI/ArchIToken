//! InsomeOS Gateway — the unified L5 API entrypoint.
//!
//! This binary starts:
//! - axum 0.8.9 HTTP server (REST + SSE)
//! - OpenTelemetry / Prometheus exporter
//! - InferenceRouter with 6 adapters
//! - RAG engine
//!
//! Wire it into Kubernetes via `05-infra/k8s/deployment.yaml`.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use serde::Serialize;
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;

use insomeos_harness_core::{
    config::AppConfig,
    error::{HarnessError, Result},
    inference::{ChatRequest, InferenceRouter},
    module_audit::{AuditEvent, AuditEventQuery, ModuleAuditService},
    module_files::{
        CopyFileRequest, CreateModuleFileRequest, FileContentResponse, FileListQuery,
        ModuleFileMetadata, ModuleFileNode, ModuleFileService, MoveFileRequest, ShareFileRequest,
        ShareFileResponse, UpdateFileContentRequest, UpdateModuleFileRequest,
    },
    module_generation::{
        GenerationActionRequest, GenerationArtifactsResponse, GenerationInput, GenerationJob,
        GenerationJobListResponse, GenerationJobQuery, GenerationReviewRequest,
        ModuleGenerationService,
    },
    module_lifecycle::{
        ApprovalDecisionRequest, CreateModuleTransactionRequest, ModuleLifecycleService,
        ModuleTransaction, ModuleTransitionRequest, TransactionListQuery,
    },
    module_pagination::PageInfo,
    module_registry::{ModuleSpec, get_module, list_modules},
    observability,
    rollback_guard::RollbackGuard,
};

#[derive(Clone)]
struct AppState {
    router: Arc<InferenceRouter>,
    cfg: Arc<AppConfig>,
    files: ModuleFileService,
    generation: ModuleGenerationService,
    lifecycle: ModuleLifecycleService,
    audit: Arc<ModuleAuditService>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModuleListResponse {
    modules: Vec<ModuleSpec>,
    total: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModuleFileListResponse {
    files: Vec<ModuleFileNode>,
    total: usize,
    page_info: PageInfo,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModuleTransactionListResponse {
    transactions: Vec<ModuleTransaction>,
    total: usize,
    page_info: PageInfo,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuditEventListResponse {
    events: Vec<AuditEvent>,
    total: usize,
    page_info: PageInfo,
    query: AuditEventQuery,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cfg = AppConfig::load()?;
    cfg.validate()?;

    let _obs = observability::init(&cfg.observability)?;
    insomeos_harness_core::invariants::verify_licenses()?;

    info!(
        version = insomeos_harness_core::VERSION,
        "InsomeOS Gateway starting"
    );

    let guard = Arc::new(RollbackGuard::new());
    let router = Arc::new(InferenceRouter::new(cfg.inference.default_engine, guard));

    // Register engine adapters here (placeholder — real adapters live in
    // their own crates, each implementing `ChatCompletion`).
    // router.register(Arc::new(VllmAdapter::new(...)));
    // router.register(Arc::new(SgLangAdapter::new(...)));
    // ...

    let audit = Arc::new(ModuleAuditService::new());
    let files = ModuleFileService::new(Arc::clone(&audit));
    let generation = ModuleGenerationService::new(Arc::clone(&audit));
    let lifecycle = ModuleLifecycleService::new(Arc::clone(&audit));

    let state = AppState {
        router,
        cfg: Arc::new(cfg.clone()),
        files,
        generation,
        lifecycle,
        audit,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .route("/v1/harness/invoke", post(invoke))
        .route("/v1/modules", get(list_modules_handler))
        .route("/v1/modules/{module_id}", get(get_module_handler))
        .route(
            "/v1/modules/{module_id}/files",
            get(list_module_files_handler).post(create_module_file_handler),
        )
        .route(
            "/v1/files/{file_id}",
            get(get_file_handler).patch(update_file_handler),
        )
        .route(
            "/v1/files/{file_id}/metadata",
            get(get_file_metadata_handler),
        )
        .route(
            "/v1/files/{file_id}/content",
            get(get_file_content_handler).put(update_file_content_handler),
        )
        .route("/v1/files/{file_id}/move", post(move_file_handler))
        .route("/v1/files/{file_id}/copy", post(copy_file_handler))
        .route("/v1/files/{file_id}/share", post(share_file_handler))
        .route("/v1/files/{file_id}/trash", post(trash_file_handler))
        .route(
            "/v1/transactions",
            get(list_transactions_handler).post(create_transaction_handler),
        )
        .route(
            "/v1/transactions/{transaction_id}",
            get(get_transaction_handler),
        )
        .route(
            "/v1/transactions/{transaction_id}/transition",
            post(transition_transaction_handler),
        )
        .route(
            "/v1/transactions/{transaction_id}/approve",
            post(approve_transaction_handler),
        )
        .route(
            "/v1/transactions/{transaction_id}/reject",
            post(reject_transaction_handler),
        )
        .route("/v1/audit-events", get(list_audit_events_handler))
        .route(
            "/v1/generation/jobs",
            get(list_generation_jobs_handler).post(create_generation_job_handler),
        )
        .route(
            "/v1/generation/jobs/{job_id}",
            get(get_generation_job_handler),
        )
        .route(
            "/v1/generation/jobs/{job_id}/plan",
            post(plan_generation_job_handler),
        )
        .route(
            "/v1/generation/jobs/{job_id}/run",
            post(run_generation_job_handler),
        )
        .route(
            "/v1/generation/jobs/{job_id}/review",
            post(review_generation_job_handler),
        )
        .route(
            "/v1/generation/jobs/{job_id}/approve",
            post(approve_generation_job_handler),
        )
        .route(
            "/v1/generation/jobs/{job_id}/reject",
            post(reject_generation_job_handler),
        )
        .route(
            "/v1/generation/jobs/{job_id}/artifacts",
            get(list_generation_artifacts_handler),
        )
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr = format!("{}:{}", cfg.server.host, cfg.server.port);
    let listener = TcpListener::bind(&addr).await?;
    info!(%addr, "Gateway listening");

    axum::serve(listener, app).await?;
    Ok(())
}

async fn healthz() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

async fn readyz(State(state): State<AppState>) -> impl IntoResponse {
    // Could probe DB / cache / engines here.
    let _router_ref_count = Arc::strong_count(&state.router);
    (StatusCode::OK, "ready")
}

async fn list_modules_handler() -> Json<ModuleListResponse> {
    let modules = list_modules();
    Json(ModuleListResponse {
        total: modules.len(),
        modules,
    })
}

async fn get_module_handler(Path(module_id): Path<String>) -> Result<Json<ModuleSpec>> {
    get_module(&module_id)
        .map(Json)
        .ok_or_else(|| HarnessError::NotFound(format!("module_id={module_id}")))
}

async fn list_module_files_handler(
    State(state): State<AppState>,
    Path(module_id): Path<String>,
    Query(query): Query<FileListQuery>,
) -> Result<Json<ModuleFileListResponse>> {
    let page = state.files.list_module_files(&module_id, &query)?;
    Ok(Json(ModuleFileListResponse {
        total: page.items.len(),
        files: page.items,
        page_info: page.page_info,
    }))
}

async fn create_module_file_handler(
    State(state): State<AppState>,
    Path(module_id): Path<String>,
    Json(req): Json<CreateModuleFileRequest>,
) -> Result<(StatusCode, Json<ModuleFileNode>)> {
    let file = state.files.create_file(&module_id, req)?;
    Ok((StatusCode::CREATED, Json(file)))
}

async fn get_file_handler(
    State(state): State<AppState>,
    Path(file_id): Path<String>,
) -> Result<Json<ModuleFileNode>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    state.files.get_file(file_id).map(Json)
}

async fn update_file_handler(
    State(state): State<AppState>,
    Path(file_id): Path<String>,
    Json(req): Json<UpdateModuleFileRequest>,
) -> Result<Json<ModuleFileNode>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    state.files.update_file(file_id, req).map(Json)
}

async fn get_file_metadata_handler(
    State(state): State<AppState>,
    Path(file_id): Path<String>,
) -> Result<Json<ModuleFileMetadata>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    state.files.metadata(file_id).map(Json)
}

async fn get_file_content_handler(
    State(state): State<AppState>,
    Path(file_id): Path<String>,
) -> Result<Json<FileContentResponse>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    state.files.content(file_id).map(Json)
}

async fn update_file_content_handler(
    State(state): State<AppState>,
    Path(file_id): Path<String>,
    Json(req): Json<UpdateFileContentRequest>,
) -> Result<Json<FileContentResponse>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    state.files.update_content(file_id, req).map(Json)
}

async fn move_file_handler(
    State(state): State<AppState>,
    Path(file_id): Path<String>,
    Json(req): Json<MoveFileRequest>,
) -> Result<Json<ModuleFileNode>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    state.files.move_file(file_id, req).map(Json)
}

async fn copy_file_handler(
    State(state): State<AppState>,
    Path(file_id): Path<String>,
    Json(req): Json<CopyFileRequest>,
) -> Result<(StatusCode, Json<ModuleFileNode>)> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    let file = state.files.copy_file(file_id, req)?;
    Ok((StatusCode::CREATED, Json(file)))
}

async fn share_file_handler(
    State(state): State<AppState>,
    Path(file_id): Path<String>,
    Json(req): Json<ShareFileRequest>,
) -> Result<Json<ShareFileResponse>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    state.files.share_file(file_id, req).map(Json)
}

async fn trash_file_handler(
    State(state): State<AppState>,
    Path(file_id): Path<String>,
) -> Result<Json<ModuleFileNode>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    state.files.trash_file(file_id).map(Json)
}

async fn list_transactions_handler(
    State(state): State<AppState>,
    Query(query): Query<TransactionListQuery>,
) -> Result<Json<ModuleTransactionListResponse>> {
    let page = state.lifecycle.list_transactions(&query)?;
    Ok(Json(ModuleTransactionListResponse {
        total: page.items.len(),
        transactions: page.items,
        page_info: page.page_info,
    }))
}

async fn create_transaction_handler(
    State(state): State<AppState>,
    Json(req): Json<CreateModuleTransactionRequest>,
) -> Result<(StatusCode, Json<ModuleTransaction>)> {
    let transaction = state.lifecycle.create_transaction(req)?;
    Ok((StatusCode::CREATED, Json(transaction)))
}

async fn get_transaction_handler(
    State(state): State<AppState>,
    Path(transaction_id): Path<String>,
) -> Result<Json<ModuleTransaction>> {
    let transaction_id = parse_uuid(&transaction_id, "transaction_id")?;
    state.lifecycle.get_transaction(transaction_id).map(Json)
}

async fn transition_transaction_handler(
    State(state): State<AppState>,
    Path(transaction_id): Path<String>,
    Json(req): Json<ModuleTransitionRequest>,
) -> Result<Json<ModuleTransaction>> {
    let transaction_id = parse_uuid(&transaction_id, "transaction_id")?;
    state.lifecycle.transition(transaction_id, req).map(Json)
}

async fn approve_transaction_handler(
    State(state): State<AppState>,
    Path(transaction_id): Path<String>,
    Json(req): Json<ApprovalDecisionRequest>,
) -> Result<Json<ModuleTransaction>> {
    let transaction_id = parse_uuid(&transaction_id, "transaction_id")?;
    state.lifecycle.approve(transaction_id, req).map(Json)
}

async fn reject_transaction_handler(
    State(state): State<AppState>,
    Path(transaction_id): Path<String>,
    Json(req): Json<ApprovalDecisionRequest>,
) -> Result<Json<ModuleTransaction>> {
    let transaction_id = parse_uuid(&transaction_id, "transaction_id")?;
    state.lifecycle.reject(transaction_id, req).map(Json)
}

async fn list_audit_events_handler(
    State(state): State<AppState>,
    Query(query): Query<AuditEventQuery>,
) -> Result<Json<AuditEventListResponse>> {
    let page = state.audit.list(&query)?;
    Ok(Json(AuditEventListResponse {
        total: page.items.len(),
        events: page.items,
        page_info: page.page_info,
        query,
    }))
}

async fn list_generation_jobs_handler(
    State(state): State<AppState>,
    Query(query): Query<GenerationJobQuery>,
) -> Result<Json<GenerationJobListResponse>> {
    let page = state.generation.list_jobs(&query)?;
    Ok(Json(GenerationJobListResponse {
        total: page.items.len(),
        jobs: page.items,
        page_info: page.page_info,
    }))
}

async fn create_generation_job_handler(
    State(state): State<AppState>,
    Json(req): Json<GenerationInput>,
) -> Result<(StatusCode, Json<GenerationJob>)> {
    let job = state.generation.create_job(req)?;
    Ok((StatusCode::CREATED, Json(job)))
}

async fn get_generation_job_handler(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<GenerationJob>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    state.generation.get_job(job_id).map(Json)
}

async fn plan_generation_job_handler(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
    Json(req): Json<GenerationActionRequest>,
) -> Result<Json<GenerationJob>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    state.generation.plan_job(job_id, req).map(Json)
}

async fn run_generation_job_handler(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
    Json(req): Json<GenerationActionRequest>,
) -> Result<Json<GenerationJob>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    state.generation.run_job(job_id, req).map(Json)
}

async fn review_generation_job_handler(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
    Json(req): Json<GenerationReviewRequest>,
) -> Result<Json<GenerationJob>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    state.generation.review_job(job_id, req).map(Json)
}

async fn approve_generation_job_handler(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
    Json(req): Json<GenerationActionRequest>,
) -> Result<Json<GenerationJob>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    state.generation.approve_job(job_id, req).map(Json)
}

async fn reject_generation_job_handler(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
    Json(req): Json<GenerationActionRequest>,
) -> Result<Json<GenerationJob>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    state.generation.reject_job(job_id, req).map(Json)
}

async fn list_generation_artifacts_handler(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<GenerationArtifactsResponse>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    state.generation.list_artifacts(job_id).map(Json)
}

fn parse_uuid(value: &str, field: &str) -> Result<uuid::Uuid> {
    value
        .parse()
        .map_err(|_| HarnessError::InvalidInput(format!("invalid {field}: {value}")))
}

async fn invoke(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> Result<Json<serde_json::Value>> {
    // Enforce whitelist (Constitution §10).
    if !state
        .cfg
        .inference
        .whitelisted_models
        .iter()
        .any(|m| m == &req.model.0)
    {
        return Err(
            insomeos_harness_core::error::HarnessError::ModelNotWhitelisted(req.model.0.clone()),
        );
    }

    let resp = state.router.complete(req).await?;
    Ok(Json(serde_json::to_value(resp)?))
}

#[cfg(test)]
mod tests {
    use axum::{Json, extract::Path};
    use insomeos_harness_core::error::HarnessError;

    use super::get_module_handler;

    #[tokio::test]
    async fn module_route_resolves_legacy_aliases() {
        let Json(module) = get_module_handler(Path("fabrication".to_owned()))
            .await
            .expect("legacy alias should resolve");
        assert_eq!(module.id.as_str(), "production_manufacturing");
        assert_eq!(module.legacy_aliases.len(), 2);
    }

    #[tokio::test]
    async fn module_route_rejects_unknown_module() {
        let result = get_module_handler(Path("unknown_module".to_owned())).await;
        assert!(matches!(result, Err(HarnessError::NotFound(_))));
    }
}
