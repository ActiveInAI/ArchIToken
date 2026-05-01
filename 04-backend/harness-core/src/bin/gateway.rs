//! InsomeOS Gateway — the unified L5 API entrypoint.
//!
//! This binary starts:
//! - axum 0.8.9 HTTP server (REST + SSE)
//! - OpenTelemetry / Prometheus exporter
//! - InferenceRouter with 6 adapters
//! - RAG engine
//!
//! Wire it into Kubernetes via `05-infra/k8s/deployment.yaml`.

use std::{sync::Arc, time::Instant};

use axum::{
    Json, Router,
    body::Body,
    extract::DefaultBodyLimit,
    extract::{Path, Query, RawQuery, State},
    http::{HeaderMap, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::Serialize;
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;

use insomeos_harness_core::{
    asset_registry::{
        AssetFileDownloadResponse, AssetListQuery, AssetListResponse, AssetRecord,
        AssetRegistryService, AssetVersionRecord, CompleteUploadRequest, CompleteUploadResponse,
        ConversionJobActionRequest, ConversionJobListResponse, ConversionJobQuery,
        ConversionJobRecord, CreateAssetRequest, CreateAssetVersionRequest,
        CreateConversionJobRequest, PresignUploadRequest, PresignUploadResponse,
    },
    config::AppConfig,
    db::RuntimeDatabaseConfig,
    error::{HarnessError, Result},
    inference::{ChatRequest, InferenceRouter},
    knowledge_registry::{
        CreateKnowledgeSourceRequest, KnowledgeIngestionJob, KnowledgeSource,
        KnowledgeSourceListQuery, KnowledgeSourceListResponse, KnowledgeSourceRegistryService,
        UpdateKnowledgeSourceRequest,
    },
    mcp_tool_registry::{
        CreateMcpToolRequest, McpToolListQuery, McpToolListResponse, McpToolRegistryService,
        McpToolSpec, UpdateMcpToolRequest,
    },
    module_audit::{AuditEvent, AuditEventQuery, ModuleAuditService},
    module_files::{
        CopyFileRequest, CreateModuleFileRequest, FileContentResponse, FileListQuery,
        ModuleFileMetadata, ModuleFileNode, ModuleFileService, MoveFileRequest, ShareFileRequest,
        ShareFileResponse, UpdateFileContentRequest, UpdateModuleFileRequest,
    },
    module_generation::{
        Artifact, ArtifactListQuery, ArtifactListResponse, GenerationActionRequest,
        GenerationArtifactsResponse, GenerationInput, GenerationJob, GenerationJobListResponse,
        GenerationJobQuery, GenerationReviewRequest, ModuleGenerationService,
    },
    module_lifecycle::{
        ApprovalDecisionRequest, CreateModuleTransactionRequest, ModuleLifecycleService,
        ModuleTransaction, ModuleTransitionRequest, TransactionListQuery,
    },
    module_pagination::PageInfo,
    module_registry::{ModuleSpec, get_module, list_modules},
    observability,
    phase8_runtime::{
        InMemoryRateLimiter, Phase8DependencyReadiness, Phase8Metrics, Phase8ReadinessResponse,
        Phase8RuntimeConfig, RateLimitSubject, current_epoch_second,
    },
    rollback_guard::RollbackGuard,
    runtime_capabilities::RuntimeCapabilities,
    runtime_context::{
        HEADER_ACTOR, HEADER_CORRELATION_ID, HEADER_PROJECT_ID, HEADER_REQUEST_ID, HEADER_ROLES,
        HEADER_TENANT_ID, PermissionGuard, RequestContext, RequestContextInput, RuntimePermission,
        RuntimeProfile,
    },
    runtime_execution::{
        CreateAiRuntimeDraftRequest, RuntimeExecutionApprovalRequest, RuntimeExecutionListQuery,
        RuntimeExecutionListResponse, RuntimeExecutionRecord, RuntimeExecutionService,
        RuntimeExecutionTraceResponse,
    },
    skill_registry::{
        CreateSkillRequest, RegistryActionRequest, SkillListQuery, SkillListResponse,
        SkillRegistryService, SkillSpec, UpdateSkillRequest,
    },
    storage_router::{ArtifactMetadata, ArtifactStorageBinding, ArtifactVersion},
    viewer_adapter::{
        ViewerAdapterCommand, ViewerCommandAckRequest, ViewerCommandCreateRequest,
        ViewerCommandListQuery, ViewerCommandListResponse, ViewerCommandService,
    },
};

#[derive(Clone)]
struct AppState {
    router: Arc<InferenceRouter>,
    cfg: Arc<AppConfig>,
    files: ModuleFileService,
    generation: ModuleGenerationService,
    assets: AssetRegistryService,
    lifecycle: ModuleLifecycleService,
    skills: SkillRegistryService,
    mcp_tools: McpToolRegistryService,
    knowledge_sources: KnowledgeSourceRegistryService,
    viewer_commands: ViewerCommandService,
    runtime_executions: RuntimeExecutionService,
    audit: Arc<ModuleAuditService>,
    runtime_profile: RuntimeProfile,
    database_config: RuntimeDatabaseConfig,
    phase8_scale_config: Arc<Phase8RuntimeConfig>,
    phase8_readiness: Phase8DependencyReadiness,
    rate_limiter: Arc<InMemoryRateLimiter>,
    metrics: Arc<Phase8Metrics>,
}

#[derive(Clone)]
struct RateLimitMiddlewareState {
    config: Arc<Phase8RuntimeConfig>,
    limiter: Arc<InMemoryRateLimiter>,
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
    let lifecycle = ModuleLifecycleService::new(Arc::clone(&audit));
    let generation = ModuleGenerationService::new(Arc::clone(&audit), lifecycle.clone());
    let assets = AssetRegistryService::new(Arc::clone(&audit));
    let viewer_commands = ViewerCommandService::new(Arc::clone(&audit), generation.clone());
    let runtime_executions = RuntimeExecutionService::new(Arc::clone(&audit));
    let skills = SkillRegistryService::new();
    let mcp_tools = McpToolRegistryService::new();
    let knowledge_sources = KnowledgeSourceRegistryService::new();
    let runtime_profile = RuntimeProfile::from_profile_name(
        &std::env::var("INSOMEOS_PROFILE").unwrap_or_else(|_| "development".to_owned()),
    );
    let database_config = RuntimeDatabaseConfig::from_env(runtime_profile)?;
    let phase8_scale_config = Arc::new(Phase8RuntimeConfig::from_env(
        runtime_profile,
        &database_config,
    )?);
    let phase8_readiness = Phase8DependencyReadiness::from_env(&database_config);
    info!(
        persistence_mode = database_config.mode.as_str(),
        in_memory_fallback = database_config.uses_in_memory_fallback(),
        "Runtime persistence boundary selected"
    );

    let state = AppState {
        router,
        cfg: Arc::new(cfg.clone()),
        files,
        generation,
        assets,
        lifecycle,
        skills,
        mcp_tools,
        knowledge_sources,
        viewer_commands,
        runtime_executions,
        audit,
        runtime_profile,
        database_config,
        phase8_scale_config: Arc::clone(&phase8_scale_config),
        phase8_readiness,
        rate_limiter: Arc::new(InMemoryRateLimiter::default()),
        metrics: Arc::new(Phase8Metrics::new()),
    };
    let metrics = Arc::clone(&state.metrics);
    let rate_limit_state = RateLimitMiddlewareState {
        config: Arc::clone(&state.phase8_scale_config),
        limiter: Arc::clone(&state.rate_limiter),
    };
    let max_request_body_bytes =
        usize::try_from(state.phase8_scale_config.max_request_body_bytes).unwrap_or(usize::MAX);

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .route("/metrics", get(metrics_handler))
        .route(
            "/v1/runtime/capabilities",
            get(runtime_capabilities_handler),
        )
        .route(
            "/v1/runtime/executions",
            get(list_runtime_executions_handler).post(create_ai_runtime_draft_handler),
        )
        .route(
            "/v1/runtime/executions/{execution_id}",
            get(get_runtime_execution_handler),
        )
        .route(
            "/v1/runtime/executions/{execution_id}/trace",
            get(get_runtime_execution_trace_handler),
        )
        .route(
            "/v1/runtime/executions/{execution_id}/approve",
            post(approve_runtime_execution_handler),
        )
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
        .route("/v1/artifacts", get(list_artifacts_handler))
        .route("/v1/artifacts/{artifact_id}", get(get_artifact_handler))
        .route(
            "/v1/artifacts/{artifact_id}/versions",
            get(get_artifact_versions_handler),
        )
        .route(
            "/v1/artifacts/{artifact_id}/metadata",
            get(get_artifact_metadata_handler),
        )
        .route(
            "/v1/artifacts/{artifact_id}/storage-binding",
            get(get_artifact_storage_binding_handler),
        )
        .route(
            "/v1/assets",
            get(list_assets_phase7_handler).post(create_asset_phase7_handler),
        )
        .route("/v1/assets/{asset_id}", get(get_asset_phase7_handler))
        .route(
            "/v1/assets/{asset_id}/versions",
            get(list_asset_versions_phase7_handler).post(create_asset_version_phase7_handler),
        )
        .route(
            "/v1/assets/{asset_id}/files/presign-upload",
            post(presign_asset_upload_phase7_handler),
        )
        .route(
            "/v1/assets/{asset_id}/files/complete-upload",
            post(complete_asset_upload_phase7_handler),
        )
        .route(
            "/v1/assets/{asset_id}/files/{file_id}/download",
            get(download_asset_file_phase7_handler),
        )
        .route(
            "/v1/conversion-jobs",
            get(list_conversion_jobs_phase7_handler).post(create_conversion_job_phase7_handler),
        )
        .route(
            "/v1/conversion-jobs/{job_id}",
            get(get_conversion_job_phase7_handler),
        )
        .route(
            "/v1/conversion-jobs/{job_id}/cancel",
            post(cancel_conversion_job_phase7_handler),
        )
        .route(
            "/v1/viewer/commands",
            get(list_viewer_commands_handler).post(create_viewer_command_handler),
        )
        .route(
            "/v1/viewer/commands/{command_id}",
            get(get_viewer_command_handler),
        )
        .route(
            "/v1/viewer/commands/{command_id}/ack",
            post(ack_viewer_command_handler),
        )
        .route(
            "/v1/skills",
            get(list_skills_handler).post(create_skill_handler),
        )
        .route(
            "/v1/skills/{skill_id}",
            get(get_skill_handler).patch(update_skill_handler),
        )
        .route("/v1/skills/{skill_id}/approve", post(approve_skill_handler))
        .route("/v1/skills/{skill_id}/disable", post(disable_skill_handler))
        .route(
            "/v1/mcp-tools",
            get(list_mcp_tools_handler).post(create_mcp_tool_handler),
        )
        .route(
            "/v1/mcp-tools/{tool_id}",
            get(get_mcp_tool_handler).patch(update_mcp_tool_handler),
        )
        .route(
            "/v1/mcp-tools/{tool_id}/approve",
            post(approve_mcp_tool_handler),
        )
        .route(
            "/v1/mcp-tools/{tool_id}/disable",
            post(disable_mcp_tool_handler),
        )
        .route(
            "/v1/knowledge-sources",
            get(list_knowledge_sources_handler).post(create_knowledge_source_handler),
        )
        .route(
            "/v1/knowledge-sources/{source_id}",
            get(get_knowledge_source_handler).patch(update_knowledge_source_handler),
        )
        .route(
            "/v1/knowledge-sources/{source_id}/ingest",
            post(ingest_knowledge_source_handler),
        )
        .route(
            "/v1/knowledge-sources/{source_id}/approve",
            post(approve_knowledge_source_handler),
        )
        .route(
            "/v1/knowledge-sources/{source_id}/disable",
            post(disable_knowledge_source_handler),
        )
        .with_state(state)
        .layer(middleware::from_fn_with_state(metrics, metrics_middleware))
        .layer(middleware::from_fn_with_state(
            rate_limit_state,
            rate_limit_middleware,
        ))
        .layer(DefaultBodyLimit::max(max_request_body_bytes))
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
    Json(readiness_response(&state))
}

async fn metrics_handler(State(state): State<AppState>) -> impl IntoResponse {
    (
        StatusCode::OK,
        [("content-type", "text/plain; version=0.0.4")],
        state.metrics.to_prometheus_text(),
    )
}

fn readiness_response(state: &AppState) -> Phase8ReadinessResponse {
    Phase8ReadinessResponse::new(
        state.runtime_profile,
        &state.database_config,
        &state.phase8_scale_config,
        &state.phase8_readiness,
    )
}

async fn rate_limit_middleware(
    State(state): State<RateLimitMiddlewareState>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let subject = rate_limit_subject_from_request(&request);
    match state
        .limiter
        .check(&state.config, &subject, current_epoch_second())
    {
        Ok(()) => next.run(request).await,
        Err(err) => err.into_response(),
    }
}

async fn metrics_middleware(
    State(metrics): State<Arc<Phase8Metrics>>,
    request: Request<Body>,
    next: Next,
) -> Response {
    metrics.begin_request();
    let started = Instant::now();
    let response = next.run(request).await;
    metrics.finish_request(response.status().as_u16(), started.elapsed());
    response
}

fn rate_limit_subject_from_request(request: &Request<Body>) -> RateLimitSubject {
    let headers = request.headers();
    let query_context = context_from_query(request.uri().query());
    RateLimitSubject::new(
        header_value(headers, HEADER_TENANT_ID)
            .or(query_context.tenant_id)
            .as_deref(),
        header_value(headers, HEADER_ACTOR)
            .or(query_context.actor)
            .as_deref(),
    )
}

async fn runtime_capabilities_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
) -> Result<Json<RuntimeCapabilities>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::RegistryRead)?;
    Ok(Json(RuntimeCapabilities::for_persistence_mode(
        state.database_config.mode,
    )))
}

async fn list_runtime_executions_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<RuntimeExecutionListQuery>,
) -> Result<Json<RuntimeExecutionListResponse>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    let page = state
        .runtime_executions
        .list_with_context(&context, &query)?;
    Ok(Json(RuntimeExecutionListResponse {
        total: page.items.len(),
        executions: page.items,
        page_info: page.page_info,
    }))
}

async fn create_ai_runtime_draft_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<CreateAiRuntimeDraftRequest>,
) -> Result<(StatusCode, Json<RuntimeExecutionRecord>)> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    let execution = state
        .runtime_executions
        .create_ai_draft_with_context(&context, req)?;
    state.metrics.record_runtime_execution();
    Ok((StatusCode::CREATED, Json(execution)))
}

async fn get_runtime_execution_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(execution_id): Path<String>,
) -> Result<Json<RuntimeExecutionRecord>> {
    let execution_id = parse_uuid(&execution_id, "execution_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .runtime_executions
        .get_with_context(&context, execution_id)
        .map(Json)
}

async fn get_runtime_execution_trace_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(execution_id): Path<String>,
) -> Result<Json<RuntimeExecutionTraceResponse>> {
    let execution_id = parse_uuid(&execution_id, "execution_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .runtime_executions
        .trace_with_context(&context, execution_id)
        .map(Json)
}

async fn approve_runtime_execution_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(execution_id): Path<String>,
    Json(req): Json<RuntimeExecutionApprovalRequest>,
) -> Result<Json<RuntimeExecutionRecord>> {
    let execution_id = parse_uuid(&execution_id, "execution_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: Some(req.actor.clone()),
            ..RequestContextInput::default()
        },
    )?;
    state
        .runtime_executions
        .approve_with_context(&context, execution_id, req)
        .map(Json)
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

fn request_context(
    state: &AppState,
    headers: &HeaderMap,
    raw_query: Option<&str>,
    body_fallback: RequestContextInput,
) -> Result<RequestContext> {
    let input = context_from_headers(headers)
        .with_fallback(&context_from_query(raw_query))
        .with_fallback(&body_fallback);
    RequestContext::from_input(input, state.runtime_profile)
}

fn context_from_headers(headers: &HeaderMap) -> RequestContextInput {
    RequestContextInput {
        tenant_id: header_value(headers, HEADER_TENANT_ID),
        project_id: header_value(headers, HEADER_PROJECT_ID),
        actor: header_value(headers, HEADER_ACTOR),
        roles: header_value(headers, HEADER_ROLES).map(|roles| vec![roles]),
        request_id: header_value(headers, HEADER_REQUEST_ID),
        correlation_id: header_value(headers, HEADER_CORRELATION_ID),
    }
}

fn context_from_query(raw_query: Option<&str>) -> RequestContextInput {
    let mut input = RequestContextInput::default();
    let Some(raw_query) = raw_query else {
        return input;
    };
    for pair in raw_query.split('&').filter(|pair| !pair.is_empty()) {
        let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
        let value = value.replace('+', " ");
        match key {
            "tenant_id" | "tenantId" | "X-Tenant-Id" => input.tenant_id = Some(value),
            "project_id" | "projectId" | "X-Project-Id" => input.project_id = Some(value),
            "actor" | "X-Actor" => input.actor = Some(value),
            "roles" | "X-Roles" => input.roles.get_or_insert_with(Vec::new).push(value),
            "request_id" | "requestId" | "X-Request-Id" => input.request_id = Some(value),
            "correlation_id" | "correlationId" | "X-Correlation-Id" => {
                input.correlation_id = Some(value);
            }
            _ => {}
        }
    }
    input
}

fn header_value(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
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
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<GenerationJobQuery>,
) -> Result<Json<GenerationJobListResponse>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    let page = state.generation.list_jobs_with_context(&context, &query)?;
    Ok(Json(GenerationJobListResponse {
        total: page.items.len(),
        jobs: page.items,
        page_info: page.page_info,
    }))
}

async fn create_generation_job_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<GenerationInput>,
) -> Result<(StatusCode, Json<GenerationJob>)> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    let job = state.generation.create_job_with_context(&context, req)?;
    Ok((StatusCode::CREATED, Json(job)))
}

async fn get_generation_job_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(job_id): Path<String>,
) -> Result<Json<GenerationJob>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .generation
        .get_job_with_context(&context, job_id)
        .map(Json)
}

async fn plan_generation_job_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(job_id): Path<String>,
    Json(req): Json<GenerationActionRequest>,
) -> Result<Json<GenerationJob>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    state
        .generation
        .plan_job_with_context(&context, job_id, req)
        .map(Json)
}

async fn run_generation_job_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(job_id): Path<String>,
    Json(req): Json<GenerationActionRequest>,
) -> Result<Json<GenerationJob>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    state
        .generation
        .run_job_with_context(&context, job_id, req)
        .map(Json)
}

async fn review_generation_job_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(job_id): Path<String>,
    Json(req): Json<GenerationReviewRequest>,
) -> Result<Json<GenerationJob>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: Some(req.reviewer.clone()),
            ..RequestContextInput::default()
        },
    )?;
    state
        .generation
        .review_job_with_context(&context, job_id, req)
        .map(Json)
}

async fn approve_generation_job_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(job_id): Path<String>,
    Json(req): Json<GenerationActionRequest>,
) -> Result<Json<GenerationJob>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    state
        .generation
        .approve_job_with_context(&context, job_id, req)
        .map(Json)
}

async fn reject_generation_job_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(job_id): Path<String>,
    Json(req): Json<GenerationActionRequest>,
) -> Result<Json<GenerationJob>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    state
        .generation
        .reject_job_with_context(&context, job_id, req)
        .map(Json)
}

async fn list_generation_artifacts_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(job_id): Path<String>,
) -> Result<Json<GenerationArtifactsResponse>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .generation
        .list_artifacts_with_context(&context, job_id)
        .map(Json)
}

async fn list_artifacts_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<ArtifactListQuery>,
) -> Result<Json<ArtifactListResponse>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    let page = state
        .generation
        .list_indexed_artifacts_with_context(&context, &query)?;
    Ok(Json(ArtifactListResponse {
        total: page.items.len(),
        artifacts: page.items,
        page_info: page.page_info,
    }))
}

async fn get_artifact_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(artifact_id): Path<String>,
) -> Result<Json<Artifact>> {
    let artifact_id = parse_uuid(&artifact_id, "artifact_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .generation
        .get_artifact_with_context(&context, artifact_id)
        .map(Json)
}

async fn get_artifact_versions_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(artifact_id): Path<String>,
) -> Result<Json<Vec<ArtifactVersion>>> {
    let artifact_id = parse_uuid(&artifact_id, "artifact_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .generation
        .get_artifact_versions_with_context(&context, artifact_id)
        .map(Json)
}

async fn get_artifact_metadata_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(artifact_id): Path<String>,
) -> Result<Json<ArtifactMetadata>> {
    let artifact_id = parse_uuid(&artifact_id, "artifact_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .generation
        .get_artifact_metadata_with_context(&context, artifact_id)
        .map(Json)
}

async fn get_artifact_storage_binding_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(artifact_id): Path<String>,
) -> Result<Json<ArtifactStorageBinding>> {
    let artifact_id = parse_uuid(&artifact_id, "artifact_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .generation
        .get_artifact_storage_binding_with_context(&context, artifact_id)
        .map(Json)
}

async fn create_asset_phase7_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<CreateAssetRequest>,
) -> Result<Json<AssetRecord>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    state
        .assets
        .create_asset_with_context(&context, req)
        .map(Json)
}

async fn list_assets_phase7_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<AssetListQuery>,
) -> Result<Json<AssetListResponse>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    let page = state.assets.list_assets_with_context(&context, &query)?;
    Ok(Json(AssetListResponse {
        total: page.items.len(),
        assets: page.items,
        page_info: page.page_info,
    }))
}

async fn get_asset_phase7_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(asset_id): Path<String>,
) -> Result<Json<AssetRecord>> {
    let asset_id = parse_uuid(&asset_id, "asset_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .assets
        .get_asset_with_context(&context, asset_id)
        .map(Json)
}

async fn create_asset_version_phase7_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(asset_id): Path<String>,
    Json(req): Json<CreateAssetVersionRequest>,
) -> Result<Json<AssetVersionRecord>> {
    let asset_id = parse_uuid(&asset_id, "asset_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    state
        .assets
        .create_version_with_context(&context, asset_id, req)
        .map(Json)
}

async fn list_asset_versions_phase7_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(asset_id): Path<String>,
) -> Result<Json<Vec<AssetVersionRecord>>> {
    let asset_id = parse_uuid(&asset_id, "asset_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .assets
        .list_versions_with_context(&context, asset_id)
        .map(Json)
}

async fn presign_asset_upload_phase7_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(asset_id): Path<String>,
    Json(req): Json<PresignUploadRequest>,
) -> Result<Json<PresignUploadResponse>> {
    let asset_id = parse_uuid(&asset_id, "asset_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    state
        .assets
        .presign_upload_with_context(&context, asset_id, req)
        .map(Json)
}

async fn complete_asset_upload_phase7_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(asset_id): Path<String>,
    Json(req): Json<CompleteUploadRequest>,
) -> Result<Json<CompleteUploadResponse>> {
    let asset_id = parse_uuid(&asset_id, "asset_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    let response = state
        .assets
        .complete_upload_with_context(&context, asset_id, req)?;
    state.metrics.record_asset_upload();
    Ok(Json(response))
}

async fn download_asset_file_phase7_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path((asset_id, file_id)): Path<(String, String)>,
) -> Result<Json<AssetFileDownloadResponse>> {
    let asset_id = parse_uuid(&asset_id, "asset_id")?;
    let file_id = parse_uuid(&file_id, "file_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .assets
        .download_file_with_context(&context, asset_id, file_id)
        .map(Json)
}

async fn create_conversion_job_phase7_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<CreateConversionJobRequest>,
) -> Result<Json<ConversionJobRecord>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    let job = state
        .assets
        .create_conversion_job_with_context(&context, req)?;
    state.metrics.record_conversion_job();
    Ok(Json(job))
}

async fn list_conversion_jobs_phase7_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<ConversionJobQuery>,
) -> Result<Json<ConversionJobListResponse>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    let page = state
        .assets
        .list_conversion_jobs_with_context(&context, &query)?;
    Ok(Json(ConversionJobListResponse {
        total: page.items.len(),
        jobs: page.items,
        page_info: page.page_info,
    }))
}

async fn get_conversion_job_phase7_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(job_id): Path<String>,
) -> Result<Json<ConversionJobRecord>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .assets
        .get_conversion_job_with_context(&context, job_id)
        .map(Json)
}

async fn cancel_conversion_job_phase7_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(job_id): Path<String>,
    Json(req): Json<ConversionJobActionRequest>,
) -> Result<Json<ConversionJobRecord>> {
    let job_id = parse_uuid(&job_id, "job_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    state
        .assets
        .cancel_conversion_job_with_context(&context, job_id, req)
        .map(Json)
}

async fn list_viewer_commands_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<ViewerCommandListQuery>,
) -> Result<Json<ViewerCommandListResponse>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    let page = state
        .viewer_commands
        .list_commands_with_context(&context, &query)?;
    Ok(Json(ViewerCommandListResponse {
        total: page.items.len(),
        commands: page.items,
        page_info: page.page_info,
    }))
}

async fn create_viewer_command_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<ViewerCommandCreateRequest>,
) -> Result<(StatusCode, Json<ViewerAdapterCommand>)> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    let command = state
        .viewer_commands
        .create_command_with_context(&context, req)?;
    Ok((StatusCode::CREATED, Json(command)))
}

async fn get_viewer_command_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(command_id): Path<String>,
) -> Result<Json<ViewerAdapterCommand>> {
    let command_id = parse_uuid(&command_id, "command_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .viewer_commands
        .get_command_with_context(&context, command_id)
        .map(Json)
}

async fn ack_viewer_command_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(command_id): Path<String>,
    Json(req): Json<ViewerCommandAckRequest>,
) -> Result<Json<ViewerAdapterCommand>> {
    let command_id = parse_uuid(&command_id, "command_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: Some(req.actor.clone()),
            ..RequestContextInput::default()
        },
    )?;
    state
        .viewer_commands
        .ack_command_with_context(&context, command_id, req)
        .map(Json)
}

async fn list_skills_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<SkillListQuery>,
) -> Result<Json<SkillListResponse>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    let page = state.skills.list_skills_with_context(&context, &query)?;
    Ok(Json(SkillListResponse {
        total: page.items.len(),
        skills: page.items,
        page_info: page.page_info,
    }))
}

async fn create_skill_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<CreateSkillRequest>,
) -> Result<(StatusCode, Json<SkillSpec>)> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    let skill = state.skills.create_skill_with_context(&context, req)?;
    Ok((StatusCode::CREATED, Json(skill)))
}

async fn get_skill_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(skill_id): Path<String>,
) -> Result<Json<SkillSpec>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .skills
        .get_skill_with_context(&context, &skill_id)
        .map(Json)
}

async fn update_skill_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(skill_id): Path<String>,
    Json(req): Json<UpdateSkillRequest>,
) -> Result<Json<SkillSpec>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .skills
        .update_skill_with_context(&context, &skill_id, req)
        .map(Json)
}

async fn approve_skill_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(skill_id): Path<String>,
    Json(req): Json<RegistryActionRequest>,
) -> Result<Json<SkillSpec>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    state
        .skills
        .approve_skill_with_context(&context, &skill_id, req)
        .map(Json)
}

async fn disable_skill_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(skill_id): Path<String>,
    Json(req): Json<RegistryActionRequest>,
) -> Result<Json<SkillSpec>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    state
        .skills
        .disable_skill_with_context(&context, &skill_id, req)
        .map(Json)
}

async fn list_mcp_tools_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<McpToolListQuery>,
) -> Result<Json<McpToolListResponse>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    let page = state.mcp_tools.list_tools_with_context(&context, &query)?;
    Ok(Json(McpToolListResponse {
        total: page.items.len(),
        tools: page.items,
        page_info: page.page_info,
    }))
}

async fn create_mcp_tool_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<CreateMcpToolRequest>,
) -> Result<(StatusCode, Json<McpToolSpec>)> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    let tool = state.mcp_tools.create_tool_with_context(&context, req)?;
    Ok((StatusCode::CREATED, Json(tool)))
}

async fn get_mcp_tool_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(tool_id): Path<String>,
) -> Result<Json<McpToolSpec>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .mcp_tools
        .get_tool_with_context(&context, &tool_id)
        .map(Json)
}

async fn update_mcp_tool_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(tool_id): Path<String>,
    Json(req): Json<UpdateMcpToolRequest>,
) -> Result<Json<McpToolSpec>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .mcp_tools
        .update_tool_with_context(&context, &tool_id, req)
        .map(Json)
}

async fn approve_mcp_tool_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(tool_id): Path<String>,
    Json(req): Json<RegistryActionRequest>,
) -> Result<Json<McpToolSpec>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    state
        .mcp_tools
        .approve_tool_with_context(&context, &tool_id, req)
        .map(Json)
}

async fn disable_mcp_tool_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(tool_id): Path<String>,
    Json(req): Json<RegistryActionRequest>,
) -> Result<Json<McpToolSpec>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    state
        .mcp_tools
        .disable_tool_with_context(&context, &tool_id, req)
        .map(Json)
}

async fn list_knowledge_sources_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<KnowledgeSourceListQuery>,
) -> Result<Json<KnowledgeSourceListResponse>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    let page = state
        .knowledge_sources
        .list_sources_with_context(&context, &query)?;
    Ok(Json(KnowledgeSourceListResponse {
        total: page.items.len(),
        sources: page.items,
        page_info: page.page_info,
    }))
}

async fn create_knowledge_source_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<CreateKnowledgeSourceRequest>,
) -> Result<(StatusCode, Json<KnowledgeSource>)> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    let source = state
        .knowledge_sources
        .create_source_with_context(&context, req)?;
    Ok((StatusCode::CREATED, Json(source)))
}

async fn get_knowledge_source_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(source_id): Path<String>,
) -> Result<Json<KnowledgeSource>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .knowledge_sources
        .get_source_with_context(&context, &source_id)
        .map(Json)
}

async fn update_knowledge_source_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(source_id): Path<String>,
    Json(req): Json<UpdateKnowledgeSourceRequest>,
) -> Result<Json<KnowledgeSource>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .knowledge_sources
        .update_source_with_context(&context, &source_id, req)
        .map(Json)
}

async fn ingest_knowledge_source_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(source_id): Path<String>,
    Json(req): Json<RegistryActionRequest>,
) -> Result<Json<KnowledgeIngestionJob>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    state
        .knowledge_sources
        .ingest_source_with_context(&context, &source_id, req)
        .map(Json)
}

async fn approve_knowledge_source_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(source_id): Path<String>,
    Json(req): Json<RegistryActionRequest>,
) -> Result<Json<KnowledgeSource>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    state
        .knowledge_sources
        .approve_source_with_context(&context, &source_id, req)
        .map(Json)
}

async fn disable_knowledge_source_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(source_id): Path<String>,
    Json(req): Json<RegistryActionRequest>,
) -> Result<Json<KnowledgeSource>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    state
        .knowledge_sources
        .disable_source_with_context(&context, &source_id, req)
        .map(Json)
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
    use axum::{
        Json,
        extract::Path,
        http::{HeaderMap, HeaderValue},
    };
    use insomeos_harness_core::{
        error::HarnessError,
        runtime_context::{
            HEADER_ROLES, RequestContext, RequestContextInput, RuntimeProfile, RuntimeRole,
        },
    };

    use super::{context_from_headers, context_from_query, get_module_handler};

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

    #[test]
    fn repeated_roles_query_parameters_are_accumulated() {
        let input = context_from_query(Some(
            "tenantId=tenant-a&projectId=project-a&actor=actor-a&roles=engineer,reviewer&roles=reviewer&roles=auditor",
        ));
        let context = RequestContext::from_input(input, RuntimeProfile::Production)
            .expect("repeated roles query parameters should parse");

        assert_eq!(
            context.roles,
            vec![
                RuntimeRole::Auditor,
                RuntimeRole::Engineer,
                RuntimeRole::Reviewer,
            ]
        );
    }

    #[test]
    fn header_roles_still_take_priority_over_query_roles() {
        let mut headers = HeaderMap::new();
        headers.insert(HEADER_ROLES, HeaderValue::from_static("admin"));
        let input = context_from_headers(&headers)
            .with_fallback(&context_from_query(Some("roles=auditor")));
        let context = RequestContext::from_input(
            RequestContextInput {
                tenant_id: Some("tenant-a".to_owned()),
                project_id: Some("project-a".to_owned()),
                actor: Some("actor-a".to_owned()),
                ..input
            },
            RuntimeProfile::Production,
        )
        .expect("header roles should parse");

        assert_eq!(context.roles, vec![RuntimeRole::Admin]);
    }
}
