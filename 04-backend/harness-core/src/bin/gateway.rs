//! ArchIToken Gateway — the unified L5 API entrypoint.
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
    extract::{DefaultBodyLimit, Multipart},
    extract::{Path, Query, RawQuery, State},
    http::{HeaderMap, HeaderValue, Method, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use chrono::{DateTime, Utc};
use reqwest::Url;
use ring::digest;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Postgres, Transaction, postgres::PgPoolOptions};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;
use uuid::Uuid;

use architoken_harness_core::{
    asset_registry::{
        AssetFileDownloadResponse, AssetListQuery, AssetListResponse, AssetRecord,
        AssetRegistryService, AssetVersionRecord, CompleteUploadRequest, CompleteUploadResponse,
        ConversionJobActionRequest, ConversionJobListResponse, ConversionJobQuery,
        ConversionJobRecord, ConversionOperation, CreateAssetRequest, CreateAssetVersionRequest,
        CreateConversionJobRequest, PresignUploadRequest, PresignUploadResponse,
    },
    config::AppConfig,
    db::RuntimeDatabaseConfig,
    error::{HarnessError, Result},
    file_runtime_registry::default_adapter_for_conversion_source,
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
    object_store_s3::S3ObjectStore,
    observability,
    openbim::{
        BimViewerManifest, OpenBimIngestRequest, OpenBimModelRecord, OpenBimService, SteelBomExport,
    },
    permissions::{Claims, Role, verify_jwt},
    phase8_runtime::{
        InMemoryRateLimiter, Phase8DependencyReadiness, Phase8Metrics, Phase8ReadinessResponse,
        Phase8RuntimeConfig, RateLimitSubject, current_epoch_second,
    },
    postgres_runtime_store,
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
    storage_router::{
        ArtifactMetadata, ArtifactStorageBinding, ArtifactVersion, InMemoryObjectStore,
        ObjectPutRequest, ObjectStore,
    },
    viewer_adapter::{
        ViewerAdapterCommand, ViewerCommandAckRequest, ViewerCommandCreateRequest,
        ViewerCommandListQuery, ViewerCommandListResponse, ViewerCommandService,
    },
};

const TENANT_SCOPE_PROJECT_ID: &str = "00000000-0000-4000-8000-000000000000";

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
    openbim: OpenBimService,
    runtime_executions: RuntimeExecutionService,
    audit: Arc<ModuleAuditService>,
    runtime_profile: RuntimeProfile,
    database_config: RuntimeDatabaseConfig,
    db_pool: Option<Arc<PgPool>>,
    object_store: Arc<dyn ObjectStore>,
    http_client: reqwest::Client,
    agent_orchestrator_url: String,
    phase8_scale_config: Arc<Phase8RuntimeConfig>,
    phase8_readiness: Phase8DependencyReadiness,
    rate_limiter: Arc<InMemoryRateLimiter>,
    metrics: Arc<Phase8Metrics>,
}

#[derive(Clone)]
struct RateLimitMiddlewareState {
    config: Arc<Phase8RuntimeConfig>,
    limiter: Arc<InMemoryRateLimiter>,
    cache_url: Option<String>,
    runtime_profile: RuntimeProfile,
}

#[derive(Clone)]
struct AuthMiddlewareState {
    cfg: Arc<AppConfig>,
    runtime_profile: RuntimeProfile,
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

#[derive(Debug, Clone, Deserialize)]
struct ProjectListQuery {
    page: Option<u32>,
    page_size: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
struct ProjectCreateRequest {
    name: String,
    description: Option<String>,
    current_module_id: Option<String>,
    area_sqm: Option<f64>,
    location: Option<String>,
    budget_cny: Option<i64>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
struct ProjectRecord {
    id: Uuid,
    tenant_id: Uuid,
    name: String,
    description: Option<String>,
    current_module_id: Option<String>,
    area_sqm: Option<f64>,
    location: Option<String>,
    budget_cny: Option<i64>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
struct ProjectListResponse {
    items: Vec<ProjectRecord>,
    total: i64,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
struct BoqItemRecord {
    id: Uuid,
    project_id: Uuid,
    code: String,
    description: String,
    unit: String,
    quantity: f64,
    unit_price_cny: f64,
    total_cny: f64,
    category: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
struct ComplianceFindingRecord {
    id: Uuid,
    project_id: Uuid,
    severity: String,
    regulation_code: String,
    regulation_clause: String,
    finding: String,
    recommendation: String,
    element_id: Option<String>,
    resolved: bool,
}

#[derive(Debug, Clone, Serialize)]
struct BimUploadQueuedResponse {
    upload_id: Uuid,
    status: &'static str,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConversionWorkerResultRequest {
    job_id: Option<Uuid>,
    status: String,
    #[serde(default)]
    artifacts: Vec<serde_json::Value>,
    #[serde(default)]
    output: serde_json::Value,
    #[serde(default)]
    error: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AgentInvokeRequest {
    project_id: Uuid,
    tenant_id: Uuid,
    module_id: String,
    user_input: String,
    #[serde(default)]
    attachments: Vec<String>,
    #[serde(default = "default_agent_locale")]
    locale: String,
}

fn default_agent_locale() -> String {
    "zh-CN".to_owned()
}

#[tokio::main]
async fn main() -> Result<()> {
    let cfg = AppConfig::load()?;
    cfg.validate()?;

    let _obs = observability::init(&cfg.observability)?;
    architoken_harness_core::invariants::verify_licenses()?;
    architoken_harness_core::invariants::verify_engine_contract()?;

    info!(
        version = architoken_harness_core::VERSION,
        "ArchIToken Gateway starting"
    );

    let guard = Arc::new(RollbackGuard::new());
    let router = Arc::new(InferenceRouter::new(cfg.inference.default_engine, guard));

    // Register engine adapters here; dedicated crates implement `ChatCompletion`.
    // router.register(Arc::new(VllmAdapter::new(...)));
    // router.register(Arc::new(SgLangAdapter::new(...)));
    // ...

    let audit = Arc::new(ModuleAuditService::new());
    let runtime_profile = RuntimeProfile::from_profile_name(
        &std::env::var("ARCHITOKEN_PROFILE").unwrap_or_else(|_| "development".to_owned()),
    );
    let database_config = RuntimeDatabaseConfig::from_env(runtime_profile)?;
    let object_store: Arc<dyn ObjectStore> = match (S3ObjectStore::from_env(), runtime_profile) {
        (Ok(store), _) => {
            info!(bucket = store.bucket(), "S3 object store adapter enabled");
            Arc::new(store)
        }
        (Err(err), RuntimeProfile::Production) => return Err(err),
        (Err(err), RuntimeProfile::Development) => {
            info!(
                error = %err,
                "S3 object store is not configured; development uses in-memory object store"
            );
            Arc::new(InMemoryObjectStore::new())
        }
    };
    let phase8_scale_config = Arc::new(Phase8RuntimeConfig::from_env(
        runtime_profile,
        &database_config,
    )?);
    let db_pool = connect_runtime_database(&database_config, &phase8_scale_config).await?;
    if let Some(pool) = db_pool.as_deref() {
        maybe_apply_core_sql_migrations(pool, runtime_profile).await?;
        maybe_apply_gateway_schema_upgrades(pool).await?;
        postgres_runtime_store::ensure_phase7_runtime_schema(pool).await?;
        validate_gateway_database_schema(pool).await?;
    }
    let files = ModuleFileService::new(Arc::clone(&audit));
    let lifecycle = ModuleLifecycleService::new(Arc::clone(&audit));
    let generation = ModuleGenerationService::new_with_object_store(
        Arc::clone(&audit),
        lifecycle.clone(),
        cfg.generation.clone(),
        Arc::clone(&object_store),
    );
    let assets = AssetRegistryService::new(Arc::clone(&audit));
    let viewer_commands = ViewerCommandService::new(Arc::clone(&audit), generation.clone());
    let runtime_executions = RuntimeExecutionService::new(Arc::clone(&audit));
    let skills = SkillRegistryService::new();
    let mcp_tools = McpToolRegistryService::new();
    let knowledge_sources = KnowledgeSourceRegistryService::new();
    let openbim = OpenBimService::new(Arc::clone(&audit));
    let phase8_readiness = Phase8DependencyReadiness::from_env(&database_config);
    info!(
        persistence_mode = database_config.mode.as_str(),
        in_memory_fallback = database_config.uses_in_memory_fallback(),
        "Runtime persistence adapter selected"
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
        openbim,
        runtime_executions,
        audit,
        runtime_profile,
        database_config,
        db_pool,
        object_store,
        http_client: reqwest::Client::new(),
        agent_orchestrator_url: agent_orchestrator_url(),
        phase8_scale_config: Arc::clone(&phase8_scale_config),
        phase8_readiness,
        rate_limiter: Arc::new(InMemoryRateLimiter::default()),
        metrics: Arc::new(Phase8Metrics::new()),
    };
    let metrics = Arc::clone(&state.metrics);
    let rate_limit_state = RateLimitMiddlewareState {
        config: Arc::clone(&state.phase8_scale_config),
        limiter: Arc::clone(&state.rate_limiter),
        cache_url: runtime_cache_url(&state.cfg),
        runtime_profile: state.runtime_profile,
    };
    let auth_state = AuthMiddlewareState {
        cfg: Arc::clone(&state.cfg),
        runtime_profile: state.runtime_profile,
    };
    let max_request_body_bytes =
        usize::try_from(state.phase8_scale_config.max_request_body_bytes).unwrap_or(usize::MAX);

    let cors = cors_layer(&cfg, runtime_profile)?;

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
        .route("/v1/agents/invoke", post(invoke_agent_handler))
        .route(
            "/v1/projects",
            get(list_projects_handler).post(create_project_handler),
        )
        .route("/v1/projects/{id}", get(get_project_handler))
        .route("/v1/projects/{id}/bim", post(upload_project_bim_handler))
        .route("/v1/projects/{id}/boq", get(list_project_boq_handler))
        .route(
            "/v1/projects/{id}/compliance",
            get(list_project_compliance_handler),
        )
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
            "/v1/artifacts/{artifact_id}/content",
            get(get_artifact_content_handler),
        )
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
        .route("/v1/openbim/models", post(ingest_openbim_model_handler))
        .route(
            "/v1/openbim/models/{model_id}",
            get(get_openbim_model_handler),
        )
        .route(
            "/v1/openbim/models/{model_id}/viewer-manifest",
            get(get_openbim_viewer_manifest_handler),
        )
        .route(
            "/v1/openbim/models/{model_id}/bom",
            get(get_openbim_steel_bom_handler),
        )
        .route(
            "/v1/openbim/models/{model_id}/bom.csv",
            get(download_openbim_steel_bom_csv_handler),
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
        .route(
            "/internal/conversion-jobs/{job_id}/worker-result",
            post(apply_conversion_worker_result_handler),
        )
        .with_state(state)
        .layer(middleware::from_fn_with_state(metrics, metrics_middleware))
        .layer(middleware::from_fn_with_state(
            rate_limit_state,
            rate_limit_middleware,
        ))
        .layer(middleware::from_fn_with_state(
            auth_state,
            auth_required_middleware,
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

async fn connect_runtime_database(
    database_config: &RuntimeDatabaseConfig,
    scale_config: &Phase8RuntimeConfig,
) -> Result<Option<Arc<PgPool>>> {
    let Some(database_url) = database_config.database_url.as_deref() else {
        return Ok(None);
    };
    let pool = PgPoolOptions::new()
        .max_connections(scale_config.db_pool_max_connections)
        .connect(database_url)
        .await?;
    info!(
        max_connections = scale_config.db_pool_max_connections,
        "PostgreSQL runtime pool connected"
    );
    Ok(Some(Arc::new(pool)))
}

async fn maybe_apply_core_sql_migrations(pool: &PgPool, profile: RuntimeProfile) -> Result<()> {
    let enabled = std::env::var("ARCHITOKEN_DATABASE_AUTO_MIGRATE")
        .ok()
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes"
            )
        })
        .unwrap_or_else(|| matches!(profile, RuntimeProfile::Development));
    if !enabled || table_exists(pool, "projects").await? {
        return Ok(());
    }
    info!("Applying core PostgreSQL schema and RLS migrations");
    sqlx::raw_sql(include_str!(
        "../../../migrations/20260419000001_initial_schema.sql"
    ))
    .execute(pool)
    .await?;
    sqlx::raw_sql(include_str!(
        "../../../migrations/20260419000002_rls_policies.sql"
    ))
    .execute(pool)
    .await?;
    Ok(())
}

async fn maybe_apply_gateway_schema_upgrades(pool: &PgPool) -> Result<()> {
    if !table_exists(pool, "projects").await? {
        return Ok(());
    }
    sqlx::raw_sql(
        r"
        CREATE TABLE IF NOT EXISTS modules (
            id              TEXT PRIMARY KEY,
            zh_name         TEXT NOT NULL,
            en_name         TEXT NOT NULL,
            order_num       INTEGER NOT NULL UNIQUE,
            description     TEXT NOT NULL,
            enabled         BOOLEAN NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE projects ADD COLUMN IF NOT EXISTS current_module_id TEXT;
        ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_current_module_id_fkey;
        UPDATE projects
        SET current_module_id = NULL
        WHERE current_module_id IN (
            SELECT id FROM modules
            WHERE order_num BETWEEN 1 AND 14
              AND id NOT IN (
                'marketing_service',
                'planning_management',
                'concept_design',
                'standard_library',
                'detailed_design',
                'quantity_costing',
                'material_logistics',
                'production_manufacturing',
                'construction_management',
                'digital_twin',
                'digital_archive',
                'finance_hr',
                'ai_center',
                'settings_center'
              )
        );
        DELETE FROM modules
        WHERE order_num BETWEEN 1 AND 14
          AND id NOT IN (
            'marketing_service',
            'planning_management',
            'concept_design',
            'standard_library',
            'detailed_design',
            'quantity_costing',
            'material_logistics',
            'production_manufacturing',
            'construction_management',
            'digital_twin',
            'digital_archive',
            'finance_hr',
            'ai_center',
            'settings_center'
          );
        UPDATE modules
        SET order_num = CASE id
            WHEN 'marketing_service' THEN -1
            WHEN 'planning_management' THEN -2
            WHEN 'concept_design' THEN -3
            WHEN 'standard_library' THEN -4
            WHEN 'detailed_design' THEN -5
            WHEN 'quantity_costing' THEN -6
            WHEN 'material_logistics' THEN -7
            WHEN 'production_manufacturing' THEN -8
            WHEN 'construction_management' THEN -9
            WHEN 'digital_twin' THEN -10
            WHEN 'digital_archive' THEN -11
            WHEN 'finance_hr' THEN -12
            WHEN 'ai_center' THEN -13
            WHEN 'settings_center' THEN -14
            ELSE order_num
        END
        WHERE id IN (
            'marketing_service',
            'planning_management',
            'concept_design',
            'standard_library',
            'detailed_design',
            'quantity_costing',
            'material_logistics',
            'production_manufacturing',
            'construction_management',
            'digital_twin',
            'digital_archive',
            'finance_hr',
            'ai_center',
            'settings_center'
        );

        INSERT INTO modules (id, zh_name, en_name, order_num, description) VALUES
            ('marketing_service', '市场客服', 'Marketing Service', 1, '客户线索、需求澄清、报价和初版方案入口'),
            ('planning_management', '计划管理', 'Planning Management', 2, 'WBS、里程碑、资源计划、审批计划和总控排程'),
            ('concept_design', '方案设计', 'Concept Design', 3, '多方案生成、初步三维表达、合规约束和造价估算'),
            ('standard_library', '标准族库', 'Standard Library', 4, '规范条文、族库构件、材料、模板和规则包'),
            ('detailed_design', '深化设计', 'Detailed Design', 5, 'IFC、施工图、节点深化、结构连接和碰撞检查'),
            ('quantity_costing', '计量造价', 'Quantity Costing', 6, '工程量、BOQ、清单、价格库和变更估算'),
            ('material_logistics', '材料物流', 'Material Logistics', 7, '材料库存、采购、包装、装车、物流和签收'),
            ('production_manufacturing', '生产制造', 'Production Manufacturing', 8, '生产计划、工序路线、CNC、焊接、质检和发运'),
            ('construction_management', '施工管理', 'Construction Management', 9, '施工方案、进度、质量、安全、日志、整改和竣工资料'),
            ('digital_twin', '数字孪生', 'Digital Twin', 10, 'IFC、GLB、点云、IoT、SCADA 和运维告警'),
            ('digital_archive', '数字档案', 'Digital Archive', 11, '工程档案、版本链、签章、留存和检索'),
            ('finance_hr', '财务人力', 'Finance & HR', 12, '合同、收付款、发票、成本、人员、班组和绩效'),
            ('ai_center', 'AI中心', 'AI Capability Center', 13, '模型路由、RAG、MCP、Agent、权限和成本审计'),
            ('settings_center', '设置中心', 'Settings Center', 14, '租户、RBAC、模型路由、SLA、存储和审计策略')
        ON CONFLICT (id) DO UPDATE
        SET zh_name = EXCLUDED.zh_name,
            en_name = EXCLUDED.en_name,
            order_num = EXCLUDED.order_num,
            description = EXCLUDED.description,
            enabled = TRUE,
            updated_at = NOW();

        UPDATE projects
        SET current_module_id = 'construction_management'
        WHERE current_module_id IN (
            SELECT id FROM modules
            WHERE order_num = 9 AND id <> 'construction_management'
        );
        DELETE FROM modules
        WHERE order_num = 9 AND id <> 'construction_management';
        UPDATE projects
        SET current_module_id = 'marketing_service'
        WHERE current_module_id IS NULL
           OR current_module_id NOT IN (SELECT id FROM modules);
        ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_current_module_id_fkey;
        ALTER TABLE projects
            ADD CONSTRAINT projects_current_module_id_fkey
            FOREIGN KEY (current_module_id) REFERENCES modules(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_projects_module ON projects(tenant_id, current_module_id);
        ",
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn validate_gateway_database_schema(pool: &PgPool) -> Result<()> {
    for table in [
        "tenants",
        "users",
        "modules",
        "projects",
        "bim_uploads",
        "boq_items",
        "compliance_findings",
        "agent_invocations",
        "assets",
        "asset_versions",
        "asset_files",
        "object_store_bindings",
        "conversion_jobs",
        "module_files",
        "runtime_executions",
        "audit_events",
    ] {
        if !table_exists(pool, table).await? {
            return Err(HarnessError::InvalidInput(format!(
                "database table public.{table} is missing; run migrations or set ARCHITOKEN_DATABASE_AUTO_MIGRATE=true"
            )));
        }
    }
    for (table, columns) in [
        (
            "projects",
            &[
                "id",
                "tenant_id",
                "name",
                "description",
                "current_module_id",
                "area_sqm",
                "location",
                "budget_cny",
                "metadata",
                "created_at",
                "updated_at",
            ][..],
        ),
        (
            "bim_uploads",
            &[
                "id",
                "project_id",
                "tenant_id",
                "filename",
                "format",
                "byte_size",
                "storage_key",
                "sha256",
                "metadata",
                "uploaded_at",
            ][..],
        ),
    ] {
        for column in columns {
            if !column_exists(pool, table, column).await? {
                return Err(HarnessError::InvalidInput(format!(
                    "database column public.{table}.{column} is missing; run migrations or enable gateway schema upgrades"
                )));
            }
        }
    }
    Ok(())
}

async fn table_exists(pool: &PgPool, table: &str) -> Result<bool> {
    let regclass: Option<String> = sqlx::query_scalar("SELECT to_regclass($1)::text")
        .bind(format!("public.{table}"))
        .fetch_one(pool)
        .await?;
    Ok(regclass.is_some())
}

async fn column_exists(pool: &PgPool, table: &str, column: &str) -> Result<bool> {
    let exists = sqlx::query_scalar::<_, bool>(
        r"
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1
              AND column_name = $2
        )
        ",
    )
    .bind(table)
    .bind(column)
    .fetch_one(pool)
    .await?;
    Ok(exists)
}

fn cors_layer(cfg: &AppConfig, profile: RuntimeProfile) -> Result<CorsLayer> {
    let base = CorsLayer::new().allow_methods(Any).allow_headers(Any);
    if cfg.server.cors_origins.iter().any(|origin| origin == "*") {
        if matches!(profile, RuntimeProfile::Production) {
            return Err(HarnessError::InvalidInput(
                "production CORS rejects wildcard origin; configure ARCHITOKEN_SERVER__CORS_ORIGINS"
                    .to_owned(),
            ));
        }
        return Ok(base.allow_origin(Any));
    }
    if cfg.server.cors_origins.is_empty() {
        return Err(HarnessError::InvalidInput(
            "at least one CORS origin is required".to_owned(),
        ));
    }
    let origins = cfg
        .server
        .cors_origins
        .iter()
        .map(|origin| {
            origin.parse::<HeaderValue>().map_err(|err| {
                HarnessError::InvalidInput(format!("invalid CORS origin {origin:?}: {err}"))
            })
        })
        .collect::<Result<Vec<_>>>()?;
    Ok(base.allow_origin(origins))
}

fn runtime_cache_url(cfg: &AppConfig) -> Option<String> {
    std::env::var("ARCHITOKEN_CACHE__URL")
        .ok()
        .or_else(|| std::env::var("REDIS_URL").ok())
        .or_else(|| Some(cfg.cache.url.clone()))
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

async fn auth_required_middleware(
    State(state): State<AuthMiddlewareState>,
    request: Request<Body>,
    next: Next,
) -> Response {
    if !matches!(state.runtime_profile, RuntimeProfile::Production)
        || request.method() == Method::OPTIONS
        || !request.uri().path().starts_with("/v1/")
    {
        return next.run(request).await;
    }
    match bearer_claims(request.headers(), &state.cfg) {
        Ok(Some(_)) => next.run(request).await,
        Ok(None) => HarnessError::Unauthorized(
            "Authorization: Bearer <jwt> is required in production".to_owned(),
        )
        .into_response(),
        Err(err) => err.into_response(),
    }
}

async fn rate_limit_middleware(
    State(state): State<RateLimitMiddlewareState>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let subject = rate_limit_subject_from_request(&request);
    if let Some(cache_url) = state.cache_url.as_deref() {
        match check_valkey_rate_limit(cache_url, &state.config, &subject, current_epoch_second())
            .await
        {
            Ok(()) => return next.run(request).await,
            Err(err) if matches!(state.runtime_profile, RuntimeProfile::Production) => {
                return err.into_response();
            }
            Err(err) => {
                tracing::debug!(error = %err, "Valkey rate limiter unavailable; using development memory limiter");
            }
        }
    }
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

async fn check_valkey_rate_limit(
    cache_url: &str,
    config: &Phase8RuntimeConfig,
    subject: &RateLimitSubject,
    now_epoch_second: u64,
) -> Result<()> {
    let url = Url::parse(cache_url)
        .map_err(|err| HarnessError::InvalidInput(format!("invalid cache URL: {err}")))?;
    let host = url
        .host_str()
        .ok_or_else(|| HarnessError::InvalidInput("cache URL host is required".to_owned()))?;
    let port = url.port().unwrap_or(6379);
    let mut stream = TcpStream::connect((host, port)).await?;
    authenticate_valkey(&mut stream, &url).await?;
    select_valkey_database(&mut stream, &url).await?;

    check_valkey_window(&mut stream, "api:*", config.api_rps_limit, now_epoch_second).await?;
    check_valkey_window(
        &mut stream,
        &format!("tenant:{}", subject.tenant_id),
        config.tenant_rps_limit,
        now_epoch_second,
    )
    .await?;
    check_valkey_window(
        &mut stream,
        &format!("actor:{}:{}", subject.tenant_id, subject.actor),
        config.actor_rps_limit,
        now_epoch_second,
    )
    .await?;
    Ok(())
}

async fn authenticate_valkey(stream: &mut TcpStream, url: &Url) -> Result<()> {
    if url.username().is_empty() && url.password().is_none() {
        return Ok(());
    }
    let reply = if let Some(password) = url.password() {
        if url.username().is_empty() {
            valkey_command(stream, &["AUTH", password]).await?
        } else {
            valkey_command(stream, &["AUTH", url.username(), password]).await?
        }
    } else {
        valkey_command(stream, &["AUTH", url.username()]).await?
    };
    ensure_valkey_ok(&reply, "AUTH")
}

async fn select_valkey_database(stream: &mut TcpStream, url: &Url) -> Result<()> {
    let db = url.path().trim_matches('/');
    if db.is_empty() {
        return Ok(());
    }
    let reply = valkey_command(stream, &["SELECT", db]).await?;
    ensure_valkey_ok(&reply, "SELECT")
}

async fn check_valkey_window(
    stream: &mut TcpStream,
    subject_key: &str,
    limit: u64,
    second: u64,
) -> Result<()> {
    let key = format!("architoken:rate-limit:{second}:{subject_key}");
    let count = parse_valkey_integer(&valkey_command(stream, &["INCR", &key]).await?, "INCR")?;
    let _expire = valkey_command(stream, &["EXPIRE", &key, "2"]).await?;
    if count > limit {
        return Err(HarnessError::RateLimited(format!(
            "Phase 8 Valkey rate limit exceeded for {subject_key}"
        )));
    }
    Ok(())
}

async fn valkey_command(stream: &mut TcpStream, args: &[&str]) -> Result<String> {
    let mut command = format!("*{}\r\n", args.len());
    for arg in args {
        command.push_str(&format!("${}\r\n{arg}\r\n", arg.len()));
    }
    stream.write_all(command.as_bytes()).await?;
    stream.flush().await?;
    read_valkey_line(stream).await
}

async fn read_valkey_line(stream: &mut TcpStream) -> Result<String> {
    let mut bytes = Vec::with_capacity(64);
    loop {
        let mut byte = [0_u8; 1];
        let read = stream.read(&mut byte).await?;
        if read == 0 {
            return Err(HarnessError::Upstream(
                "Valkey closed connection before response".to_owned(),
            ));
        }
        bytes.push(byte[0]);
        if bytes.ends_with(b"\r\n") {
            bytes.truncate(bytes.len().saturating_sub(2));
            return String::from_utf8(bytes).map_err(|err| {
                HarnessError::Upstream(format!("Valkey response is not UTF-8: {err}"))
            });
        }
    }
}

fn ensure_valkey_ok(reply: &str, command: &str) -> Result<()> {
    if reply.starts_with("+OK") || reply == ":1" {
        return Ok(());
    }
    if let Some(error) = reply.strip_prefix('-') {
        return Err(HarnessError::Upstream(format!(
            "Valkey {command} failed: {error}"
        )));
    }
    Err(HarnessError::Upstream(format!(
        "Valkey {command} returned unexpected reply: {reply}"
    )))
}

fn parse_valkey_integer(reply: &str, command: &str) -> Result<u64> {
    if let Some(error) = reply.strip_prefix('-') {
        return Err(HarnessError::Upstream(format!(
            "Valkey {command} failed: {error}"
        )));
    }
    reply
        .strip_prefix(':')
        .ok_or_else(|| {
            HarnessError::Upstream(format!(
                "Valkey {command} returned non-integer reply: {reply}"
            ))
        })?
        .parse::<u64>()
        .map_err(|err| {
            HarnessError::Upstream(format!("Valkey {command} integer parse failed: {err}"))
        })
}

async fn runtime_capabilities_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
) -> Result<Json<RuntimeCapabilities>> {
    let context = tenant_scope_request_context(
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
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        let page = postgres_runtime_store::list_runtime_executions(pool, &context, &query).await?;
        return Ok(Json(RuntimeExecutionListResponse {
            total: page.items.len(),
            executions: page.items,
            page_info: page.page_info,
        }));
    }
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
    let execution = if let Some(pool) = state.db_pool.as_deref() {
        postgres_runtime_store::create_ai_runtime_draft(pool, &context, req).await?
    } else {
        state
            .runtime_executions
            .create_ai_draft_with_context(&context, req)?
    };
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
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::get_runtime_execution(pool, &context, execution_id)
            .await
            .map(Json);
    }
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
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::runtime_execution_trace(pool, &context, execution_id)
            .await
            .map(Json);
    }
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
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::approve_runtime_execution(
            pool,
            &context,
            execution_id,
            req,
        )
        .await
        .map(Json);
    }
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

async fn list_projects_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<ProjectListQuery>,
) -> Result<Json<ProjectListResponse>> {
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::RegistryRead)?;
    let tenant_id = context_tenant_uuid(&context)?;
    let pool = db_pool(&state)?;
    let mut tx = begin_tenant_tx(pool, &context).await?;
    let page_size = i64::from(query.page_size.unwrap_or(20).clamp(1, 100));
    let page = i64::from(query.page.unwrap_or(1).max(1));
    let offset = (page - 1) * page_size;
    let items = sqlx::query_as::<_, ProjectRecord>(
        r"
        SELECT id, tenant_id, name, description, current_module_id, area_sqm::float8 AS area_sqm,
               location, budget_cny, created_at, updated_at
        FROM projects
        WHERE tenant_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2 OFFSET $3
        ",
    )
    .bind(tenant_id)
    .bind(page_size)
    .bind(offset)
    .fetch_all(&mut *tx)
    .await?;
    let total = sqlx::query_scalar::<_, i64>("SELECT count(*) FROM projects WHERE tenant_id = $1")
        .bind(tenant_id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(ProjectListResponse { items, total }))
}

async fn create_project_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<ProjectCreateRequest>,
) -> Result<(StatusCode, Json<ProjectRecord>)> {
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::RegistryWrite)?;
    if req.name.trim().is_empty() {
        return Err(HarnessError::InvalidInput(
            "project name is required".to_owned(),
        ));
    }
    let module_id = req
        .current_module_id
        .as_deref()
        .unwrap_or("marketing_service")
        .trim();
    if get_module(module_id).is_none() {
        return Err(HarnessError::InvalidInput(format!(
            "unknown current_module_id: {module_id}"
        )));
    }
    let tenant_id = context_tenant_uuid(&context)?;
    let pool = db_pool(&state)?;
    let mut tx = begin_tenant_tx(pool, &context).await?;
    let project = sqlx::query_as::<_, ProjectRecord>(
        r"
        INSERT INTO projects
            (tenant_id, name, description, current_module_id, area_sqm, location, budget_cny, metadata)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb)
        RETURNING id, tenant_id, name, description, current_module_id, area_sqm::float8 AS area_sqm,
                  location, budget_cny, created_at, updated_at
        ",
    )
    .bind(tenant_id)
    .bind(req.name.trim())
    .bind(req.description.as_deref().map(str::trim))
    .bind(module_id)
    .bind(req.area_sqm)
    .bind(req.location.as_deref().map(str::trim))
    .bind(req.budget_cny)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(project)))
}

async fn get_project_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(project_id): Path<Uuid>,
) -> Result<Json<ProjectRecord>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            project_id: Some(project_id.to_string()),
            ..RequestContextInput::default()
        },
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::RegistryRead)?;
    let tenant_id = context_tenant_uuid(&context)?;
    let pool = db_pool(&state)?;
    let mut tx = begin_tenant_tx(pool, &context).await?;
    let project = fetch_project_in_tx(&mut tx, project_id, tenant_id).await?;
    tx.commit().await?;
    Ok(Json(project))
}

async fn list_project_boq_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<BoqItemRecord>>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            project_id: Some(project_id.to_string()),
            ..RequestContextInput::default()
        },
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::ArtifactRead)?;
    let tenant_id = context_tenant_uuid(&context)?;
    let pool = db_pool(&state)?;
    let mut tx = begin_tenant_tx(pool, &context).await?;
    ensure_project_exists_in_tx(&mut tx, project_id, tenant_id).await?;
    let items = sqlx::query_as::<_, BoqItemRecord>(
        r"
        SELECT id, project_id, code::text AS code, description, unit, quantity, unit_price_cny,
               total_cny, category
        FROM boq_items
        WHERE project_id = $1 AND tenant_id = $2
        ORDER BY code ASC, id ASC
        ",
    )
    .bind(project_id)
    .bind(tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(items))
}

async fn list_project_compliance_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<ComplianceFindingRecord>>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            project_id: Some(project_id.to_string()),
            ..RequestContextInput::default()
        },
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::ArtifactRead)?;
    let tenant_id = context_tenant_uuid(&context)?;
    let pool = db_pool(&state)?;
    let mut tx = begin_tenant_tx(pool, &context).await?;
    ensure_project_exists_in_tx(&mut tx, project_id, tenant_id).await?;
    let findings = sqlx::query_as::<_, ComplianceFindingRecord>(
        r"
        SELECT id, project_id, severity::text AS severity, regulation_code, regulation_clause,
               finding, recommendation, element_id, resolved
        FROM compliance_findings
        WHERE project_id = $1 AND tenant_id = $2
        ORDER BY created_at DESC, id DESC
        ",
    )
    .bind(project_id)
    .bind(tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(findings))
}

async fn upload_project_bim_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(project_id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<BimUploadQueuedResponse>)> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            project_id: Some(project_id.to_string()),
            ..RequestContextInput::default()
        },
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::ArtifactWrite)?;
    let tenant_id = context_tenant_uuid(&context)?;
    let pool = db_pool(&state)?;
    let mut tx = begin_tenant_tx(pool, &context).await?;
    ensure_project_exists_in_tx(&mut tx, project_id, tenant_id).await?;

    let mut upload = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|err| HarnessError::InvalidInput(format!("multipart: {err}")))?
    {
        if field.name() != Some("file") {
            continue;
        }
        let filename = field.file_name().unwrap_or("model.ifc").to_owned();
        let content_type = field
            .content_type()
            .unwrap_or("application/octet-stream")
            .to_owned();
        let bytes = field
            .bytes()
            .await
            .map_err(|err| HarnessError::InvalidInput(format!("multipart file: {err}")))?
            .to_vec();
        upload = Some((filename, content_type, bytes));
        break;
    }
    let Some((filename, content_type, bytes)) = upload else {
        return Err(HarnessError::InvalidInput(
            "multipart field 'file' is required".to_owned(),
        ));
    };
    if bytes.is_empty() {
        return Err(HarnessError::InvalidInput(
            "uploaded file is empty".to_owned(),
        ));
    }
    let upload_id = Uuid::new_v4();
    let safe_name = sanitize_filename(&filename);
    let storage_key = format!("bim/{tenant_id}/{project_id}/{upload_id}/{safe_name}");
    let sha256 = sha256_hex(&bytes);
    let byte_size = i64::try_from(bytes.len())
        .map_err(|_| HarnessError::InvalidInput("uploaded file is too large".to_owned()))?;
    let store = Arc::clone(&state.object_store);
    let owner = context.actor.clone();
    let key_for_store = storage_key.clone();
    tokio::task::spawn_blocking(move || {
        store.put_object(ObjectPutRequest {
            key: key_for_store,
            bytes,
            content_type,
            owner,
        })
    })
    .await
    .map_err(|err| HarnessError::Internal(format!("object-store task failed: {err}")))??;

    sqlx::query(
        r"
        INSERT INTO bim_uploads
            (id, project_id, tenant_id, filename, format, byte_size, storage_key, sha256, metadata)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb)
        ",
    )
    .bind(upload_id)
    .bind(project_id)
    .bind(tenant_id)
    .bind(filename)
    .bind(file_format_from_name(&safe_name))
    .bind(byte_size)
    .bind(storage_key)
    .bind(sha256)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok((
        StatusCode::ACCEPTED,
        Json(BimUploadQueuedResponse {
            upload_id,
            status: "queued",
        }),
    ))
}

async fn invoke_agent_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<AgentInvokeRequest>,
) -> Result<Response> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            tenant_id: Some(req.tenant_id.to_string()),
            project_id: Some(req.project_id.to_string()),
            ..RequestContextInput::default()
        },
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::GenerationCreate)?;
    if context.tenant_id != req.tenant_id.to_string() {
        return Err(HarnessError::TenantIsolation(format!(
            "agent request tenant {} does not match context tenant {}",
            req.tenant_id, context.tenant_id
        )));
    }
    let upstream = format!("{}/v1/agents/invoke", state.agent_orchestrator_url);
    let response = state.http_client.post(upstream).json(&req).send().await?;
    let status = response.status();
    let content_type = response
        .headers()
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/json")
        .to_owned();
    let bytes = response.bytes().await?;
    if !status.is_success() {
        return Err(HarnessError::Upstream(format!(
            "agent orchestrator returned {}: {}",
            status.as_u16(),
            String::from_utf8_lossy(&bytes)
        )));
    }
    Response::builder()
        .status(status)
        .header("content-type", content_type)
        .body(Body::from(bytes))
        .map_err(|err| HarnessError::Internal(format!("failed to build agent response: {err}")))
}

fn request_context(
    state: &AppState,
    headers: &HeaderMap,
    raw_query: Option<&str>,
    body_fallback: RequestContextInput,
) -> Result<RequestContext> {
    let header_input = context_from_headers(headers);
    let query_input = context_from_query(raw_query);
    if let Some(claims) = bearer_claims(headers, &state.cfg)? {
        reject_spoofed_tenant(&claims, [&header_input, &query_input, &body_fallback])?;
        let tenant_id = claims.tenant_id.to_string();
        let actor = claims.sub.clone();
        let roles = runtime_roles_from_claims(&claims.roles);
        let input = RequestContextInput {
            tenant_id: Some(tenant_id),
            project_id: header_input
                .project_id
                .clone()
                .or(query_input.project_id.clone())
                .or(body_fallback.project_id.clone()),
            actor: Some(actor),
            roles: Some(roles),
            request_id: header_input
                .request_id
                .clone()
                .or(query_input.request_id.clone())
                .or(body_fallback.request_id.clone()),
            correlation_id: header_input
                .correlation_id
                .clone()
                .or(query_input.correlation_id.clone())
                .or(body_fallback.correlation_id.clone()),
        };
        return RequestContext::from_input(input, state.runtime_profile);
    }
    if matches!(state.runtime_profile, RuntimeProfile::Production) {
        return Err(HarnessError::Unauthorized(
            "Authorization: Bearer <jwt> is required in production".to_owned(),
        ));
    }
    let input = header_input
        .with_fallback(&query_input)
        .with_fallback(&body_fallback);
    RequestContext::from_input(input, state.runtime_profile)
}

fn tenant_scope_request_context(
    state: &AppState,
    headers: &HeaderMap,
    raw_query: Option<&str>,
    mut body_fallback: RequestContextInput,
) -> Result<RequestContext> {
    body_fallback
        .project_id
        .get_or_insert_with(|| TENANT_SCOPE_PROJECT_ID.to_owned());
    request_context(state, headers, raw_query, body_fallback)
}

fn bearer_claims(headers: &HeaderMap, cfg: &AppConfig) -> Result<Option<Claims>> {
    let Some(token) = bearer_token(headers) else {
        return Ok(None);
    };
    verify_jwt(&token, &cfg.auth).map(Some)
}

fn bearer_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .and_then(|value| {
            value
                .strip_prefix("Bearer ")
                .or_else(|| value.strip_prefix("bearer "))
        })
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn reject_spoofed_tenant(claims: &Claims, inputs: [&RequestContextInput; 3]) -> Result<()> {
    let trusted = claims.tenant_id.to_string();
    for input in inputs {
        if let Some(candidate) = input.tenant_id.as_deref()
            && candidate.trim() != trusted
        {
            return Err(HarnessError::TenantIsolation(format!(
                "request tenant {candidate} does not match token tenant {trusted}"
            )));
        }
    }
    Ok(())
}

fn runtime_roles_from_claims(roles: &[Role]) -> Vec<String> {
    let mut out = roles
        .iter()
        .map(|role| match role {
            Role::Admin => "admin",
            Role::Auditor => "auditor",
            Role::Supervisor | Role::CostConsultant => "reviewer",
            Role::Owner | Role::Designer | Role::Constructor => "engineer",
        })
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    out.sort();
    out.dedup();
    out
}

fn db_pool(state: &AppState) -> Result<&PgPool> {
    state.db_pool.as_deref().ok_or_else(|| {
        HarnessError::Internal(
            "PostgreSQL is not configured; set DATABASE_URL or ARCHITOKEN_DATABASE__URL".to_owned(),
        )
    })
}

async fn begin_tenant_tx<'a>(
    pool: &'a PgPool,
    context: &RequestContext,
) -> Result<Transaction<'a, Postgres>> {
    let tenant_id = context_tenant_uuid(context)?;
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;
    Ok(tx)
}

fn context_tenant_uuid(context: &RequestContext) -> Result<Uuid> {
    context.tenant_id.parse::<Uuid>().map_err(|_| {
        HarnessError::InvalidInput(format!(
            "tenant_id must be a UUID for database-backed routes: {}",
            context.tenant_id
        ))
    })
}

async fn fetch_project_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    project_id: Uuid,
    tenant_id: Uuid,
) -> Result<ProjectRecord> {
    sqlx::query_as::<_, ProjectRecord>(
        r"
        SELECT id, tenant_id, name, description, current_module_id, area_sqm::float8 AS area_sqm,
               location, budget_cny, created_at, updated_at
        FROM projects
        WHERE id = $1 AND tenant_id = $2
        ",
    )
    .bind(project_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("project_id={project_id}")))
}

async fn ensure_project_exists_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    project_id: Uuid,
    tenant_id: Uuid,
) -> Result<()> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM projects WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(project_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    if exists {
        Ok(())
    } else {
        Err(HarnessError::NotFound(format!("project_id={project_id}")))
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    digest::digest(&digest::SHA256, bytes)
        .as_ref()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn sanitize_filename(filename: &str) -> String {
    let sanitized = filename.trim().replace(['\\', '/', '"', '\r', '\n'], "_");
    if sanitized.is_empty() {
        "upload.bin".to_owned()
    } else {
        sanitized
    }
}

fn file_format_from_name(filename: &str) -> String {
    filename
        .rsplit_once('.')
        .map(|(_, ext)| ext.trim().to_ascii_lowercase())
        .filter(|ext| !ext.is_empty())
        .unwrap_or_else(|| "ifc".to_owned())
}

fn agent_orchestrator_url() -> String {
    std::env::var("ARCHITOKEN_AGENT_ORCHESTRATOR_URL")
        .or_else(|_| std::env::var("AGENT_ORCHESTRATOR_URL"))
        .unwrap_or_else(|_| "http://127.0.0.1:7001".to_owned())
        .trim_end_matches('/')
        .to_owned()
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
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(module_id): Path<String>,
    Query(query): Query<FileListQuery>,
) -> Result<Json<ModuleFileListResponse>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        let page =
            postgres_runtime_store::list_module_files(pool, &context, &module_id, &query).await?;
        return Ok(Json(ModuleFileListResponse {
            total: page.items.len(),
            files: page.items,
            page_info: page.page_info,
        }));
    }
    let page = state.files.list_module_files(&module_id, &query)?;
    Ok(Json(ModuleFileListResponse {
        total: page.items.len(),
        files: page.items,
        page_info: page.page_info,
    }))
}

async fn create_module_file_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(module_id): Path<String>,
    Json(req): Json<CreateModuleFileRequest>,
) -> Result<(StatusCode, Json<ModuleFileNode>)> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.owner.clone(),
            ..RequestContextInput::default()
        },
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        let file = postgres_runtime_store::create_module_file(pool, &context, &module_id, req)
            .await?;
        return Ok((StatusCode::CREATED, Json(file)));
    }
    let file = state.files.create_file(&module_id, req)?;
    Ok((StatusCode::CREATED, Json(file)))
}

async fn get_file_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(file_id): Path<String>,
) -> Result<Json<ModuleFileNode>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::get_module_file(pool, &context, file_id)
            .await
            .map(Json);
    }
    state.files.get_file(file_id).map(Json)
}

async fn update_file_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(file_id): Path<String>,
    Json(req): Json<UpdateModuleFileRequest>,
) -> Result<Json<ModuleFileNode>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.owner.clone(),
            ..RequestContextInput::default()
        },
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::update_module_file(pool, &context, file_id, req)
            .await
            .map(Json);
    }
    state.files.update_file(file_id, req).map(Json)
}

async fn get_file_metadata_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(file_id): Path<String>,
) -> Result<Json<ModuleFileMetadata>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::module_file_metadata(pool, &context, file_id)
            .await
            .map(Json);
    }
    state.files.metadata(file_id).map(Json)
}

async fn get_file_content_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(file_id): Path<String>,
) -> Result<Json<FileContentResponse>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::module_file_content(pool, &context, file_id)
            .await
            .map(Json);
    }
    state.files.content(file_id).map(Json)
}

async fn update_file_content_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(file_id): Path<String>,
    Json(req): Json<UpdateFileContentRequest>,
) -> Result<Json<FileContentResponse>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::update_module_file_content(pool, &context, file_id, req)
            .await
            .map(Json);
    }
    state.files.update_content(file_id, req).map(Json)
}

async fn move_file_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(file_id): Path<String>,
    Json(req): Json<MoveFileRequest>,
) -> Result<Json<ModuleFileNode>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::move_module_file(pool, &context, file_id, req)
            .await
            .map(Json);
    }
    state.files.move_file(file_id, req).map(Json)
}

async fn copy_file_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(file_id): Path<String>,
    Json(req): Json<CopyFileRequest>,
) -> Result<(StatusCode, Json<ModuleFileNode>)> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        let file = postgres_runtime_store::copy_module_file(pool, &context, file_id, req)
            .await?;
        return Ok((StatusCode::CREATED, Json(file)));
    }
    let file = state.files.copy_file(file_id, req)?;
    Ok((StatusCode::CREATED, Json(file)))
}

async fn share_file_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(file_id): Path<String>,
    Json(req): Json<ShareFileRequest>,
) -> Result<Json<ShareFileResponse>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::share_module_file(pool, &context, file_id, req)
            .await
            .map(Json);
    }
    state.files.share_file(file_id, req).map(Json)
}

async fn trash_file_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(file_id): Path<String>,
) -> Result<Json<ModuleFileNode>> {
    let file_id = parse_uuid(&file_id, "file_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::trash_module_file(pool, &context, file_id)
            .await
            .map(Json);
    }
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
    if let Some(pool) = state.db_pool.as_deref() {
        let page = postgres_runtime_store::list_audit_events(pool, &query).await?;
        return Ok(Json(AuditEventListResponse {
            total: page.items.len(),
            events: page.items,
            page_info: page.page_info,
            query,
        }));
    }
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
    let job = state
        .generation
        .run_job_with_context_async(&context, job_id, req)
        .await?;

    Ok(Json(job))
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

async fn get_artifact_content_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(artifact_id): Path<String>,
) -> Result<Response> {
    let artifact_id = parse_uuid(&artifact_id, "artifact_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;

    let artifact = state
        .generation
        .get_artifact_with_context(&context, artifact_id)?;
    let object = state
        .generation
        .get_artifact_content_with_context(&context, artifact_id)?;

    let filename = artifact
        .reference
        .name
        .replace(['\\', '/', '"', '\r', '\n'], "_");

    Response::builder()
        .status(StatusCode::OK)
        .header("content-type", object.content_type)
        .header("content-length", object.bytes.len().to_string())
        .header(
            "content-disposition",
            format!("inline; filename=\"{}-{}.bin\"", filename, artifact.id),
        )
        .body(Body::from(object.bytes))
        .map_err(|err| HarnessError::Internal(format!("failed to build artifact response: {err}")))
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

async fn ingest_openbim_model_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<OpenBimIngestRequest>,
) -> Result<(StatusCode, Json<OpenBimModelRecord>)> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput {
            actor: req.actor.clone(),
            ..RequestContextInput::default()
        },
    )?;
    let model = state.openbim.ingest_model_with_context(&context, req)?;
    Ok((StatusCode::CREATED, Json(model)))
}

async fn get_openbim_model_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(model_id): Path<String>,
) -> Result<Json<OpenBimModelRecord>> {
    let model_id = parse_uuid(&model_id, "model_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .openbim
        .get_model_with_context(&context, model_id)
        .map(Json)
}

async fn get_openbim_viewer_manifest_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(model_id): Path<String>,
) -> Result<Json<BimViewerManifest>> {
    let model_id = parse_uuid(&model_id, "model_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .openbim
        .viewer_manifest_with_context(&context, model_id)
        .map(Json)
}

async fn get_openbim_steel_bom_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(model_id): Path<String>,
) -> Result<Json<SteelBomExport>> {
    let model_id = parse_uuid(&model_id, "model_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    state
        .openbim
        .steel_bom_with_context(&context, model_id)
        .map(Json)
}

async fn download_openbim_steel_bom_csv_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(model_id): Path<String>,
) -> Result<Response> {
    let model_id = parse_uuid(&model_id, "model_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    let bom = state.openbim.steel_bom_with_context(&context, model_id)?;
    let filename = bom.model_name.replace(['\\', '/', '"', '\r', '\n'], "_");
    Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "text/csv; charset=utf-8")
        .header(
            "content-disposition",
            format!("attachment; filename=\"{}-steel-bom.csv\"", filename),
        )
        .body(Body::from(bom.csv))
        .map_err(|err| HarnessError::Internal(format!("failed to build BOM CSV response: {err}")))
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
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::create_asset(pool, &context, req)
            .await
            .map(Json);
    }
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
    if let Some(pool) = state.db_pool.as_deref() {
        let page = postgres_runtime_store::list_assets(pool, &context, &query).await?;
        return Ok(Json(AssetListResponse {
            total: page.items.len(),
            assets: page.items,
            page_info: page.page_info,
        }));
    }
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
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::get_asset(pool, &context, asset_id)
            .await
            .map(Json);
    }
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
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::create_asset_version(pool, &context, asset_id, req)
            .await
            .map(Json);
    }
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
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::list_asset_versions(pool, &context, asset_id)
            .await
            .map(Json);
    }
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
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::presign_upload(pool, &context, asset_id, req)
            .await
            .map(Json);
    }
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
    if let Some(pool) = state.db_pool.as_deref() {
        let response =
            postgres_runtime_store::complete_upload(pool, &context, asset_id, req).await?;
        state.metrics.record_asset_upload();
        return Ok(Json(response));
    }
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
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::download_file(pool, &context, asset_id, file_id)
            .await
            .map(Json);
    }
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
    let job = if let Some(pool) = state.db_pool.as_deref() {
        postgres_runtime_store::create_conversion_job(pool, &context, req).await?
    } else {
        state
            .assets
            .create_conversion_job_with_context(&context, req)?
    };
    let job = match dispatch_conversion_job(&state, &context, &job).await {
        Ok(dispatched) => dispatched,
        Err(err) => {
            if let Some(pool) = state.db_pool.as_deref() {
                let _ = postgres_runtime_store::fail_conversion_job_dispatch(
                    pool,
                    job.job_id,
                    &err.to_string(),
                )
                .await;
            } else {
                let _ = state
                    .assets
                    .fail_conversion_job_dispatch(job.job_id, &err.to_string());
            }
            return Err(err);
        }
    };
    state.metrics.record_conversion_job();
    Ok(Json(job))
}

async fn dispatch_conversion_job(
    state: &AppState,
    context: &RequestContext,
    job: &ConversionJobRecord,
) -> Result<ConversionJobRecord> {
    if production_contract_smoke_job(state.runtime_profile, job) {
        return Ok(job.clone());
    }
    let Some(nats_url) = std::env::var("NATS_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
    else {
        if matches!(state.runtime_profile, RuntimeProfile::Production) {
            return Err(HarnessError::InvalidInput(
                "NATS_URL is required to dispatch production conversion jobs".to_owned(),
            ));
        }
        return Ok(job.clone());
    };
    let subject = std::env::var("ARCHITOKEN_WORKER_SUBJECT")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "architoken.conversion.jobs".to_owned());
    let payload = conversion_worker_payload(state, context, job).await?;
    publish_nats_json(&nats_url, &subject, &payload).await?;
    if let Some(pool) = state.db_pool.as_deref() {
        postgres_runtime_store::mark_conversion_job_dispatched(pool, job.job_id, &subject).await
    } else {
        state
            .assets
            .mark_conversion_job_dispatched(job.job_id, &subject)
    }
}

fn production_contract_smoke_job(profile: RuntimeProfile, job: &ConversionJobRecord) -> bool {
    matches!(profile, RuntimeProfile::Production)
        && env_truthy("ARCHITOKEN_PRODUCTION_CONTRACT_SMOKE")
        && job.input.get("worker").and_then(serde_json::Value::as_str) == Some("contract")
}

fn env_truthy(key: &str) -> bool {
    std::env::var(key)
        .ok()
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
}

async fn conversion_worker_payload(
    state: &AppState,
    context: &RequestContext,
    job: &ConversionJobRecord,
) -> Result<serde_json::Value> {
    let download = if let Some(pool) = state.db_pool.as_deref() {
        postgres_runtime_store::download_file(
            pool,
            context,
            job.source_asset_id,
            job.source_file_id,
        )
        .await?
    } else {
        state
            .assets
            .download_file_with_context(context, job.source_asset_id, job.source_file_id)?
    };
    let mut input = job.input.clone();
    let object = input.as_object_mut().ok_or_else(|| {
        HarnessError::InvalidInput("conversion job input must be a JSON object".to_owned())
    })?;
    let source_file_name = source_file_name_from_key(&download.binding.key);
    object.entry("adapter".to_owned()).or_insert_with(|| {
        serde_json::json!(default_adapter_for_conversion(
            job.operation,
            &source_file_name
        ))
    });
    object.insert(
        "sourceObjectKey".to_owned(),
        serde_json::json!(download.binding.key),
    );
    object.insert(
        "sourceBucket".to_owned(),
        serde_json::json!(download.binding.bucket),
    );
    object.insert(
        "sourceFileName".to_owned(),
        serde_json::json!(source_file_name),
    );
    object.insert(
        "sourceContentType".to_owned(),
        serde_json::json!(download.binding.content_type),
    );
    object.insert(
        "sourceDownloadUrl".to_owned(),
        serde_json::json!(download.download_url),
    );
    Ok(serde_json::json!({
        "job_id": job.job_id,
        "tenant_id": job.metadata.tenant_id,
        "project_id": job.metadata.project_id.clone().unwrap_or_default(),
        "actor": job.metadata.created_by.clone().unwrap_or_else(|| context.actor.clone()),
        "operation": serde_json::to_value(job.operation)?,
        "source_asset_id": job.source_asset_id,
        "source_file_id": job.source_file_id,
        "input": input,
    }))
}

fn default_adapter_for_conversion(
    operation: ConversionOperation,
    source_file_name: &str,
) -> &'static str {
    if let Some(adapter) = default_adapter_for_conversion_source(operation, source_file_name) {
        return adapter;
    }
    match operation {
        ConversionOperation::IfcIngest
        | ConversionOperation::IfcToGlb
        | ConversionOperation::IfcTo3dtiles => "ifcopenshell",
        ConversionOperation::OpenbimValidate => "buildingsmart_validate",
        ConversionOperation::BcfIngest => "bcf",
        ConversionOperation::IdmIngest => "idm",
        ConversionOperation::BsddEnrich => "bsdd",
        ConversionOperation::IfcdbIndex
        | ConversionOperation::IfcdbQuery
        | ConversionOperation::IfcdbExport
        | ConversionOperation::IfcdbClash
        | ConversionOperation::IfcdbQuantity => "ifcdb_agent",
        ConversionOperation::CadExtractEntities => "dxf",
        ConversionOperation::CadConvert => "freecad",
        ConversionOperation::PdfParse => "docling",
        ConversionOperation::Ocr => "paddleocr",
        ConversionOperation::OfficeConvert => "libreoffice",
        ConversionOperation::GisTile => "geojson",
        ConversionOperation::PointcloudTile => "pointcloud_tiles",
        ConversionOperation::PanoramaIngest => "panorama",
        ConversionOperation::MediaTranscode => "ffmpeg",
        ConversionOperation::ImageGenerate
        | ConversionOperation::AudioGenerate
        | ConversionOperation::VideoGenerate => "ai_provider",
        ConversionOperation::DrawingGenerate | ConversionOperation::ModelGenerate => "forgecad",
        ConversionOperation::BimGenerate => "ifcopenshell_text_to_bim",
        ConversionOperation::DocumentGenerate => "markitdown",
        ConversionOperation::TableGenerate => "chart_spec",
        ConversionOperation::GanttGenerate
        | ConversionOperation::FlowGenerate
        | ConversionOperation::MindmapGenerate => "mermaid",
    }
}

fn source_file_name_from_key(key: &str) -> String {
    key.rsplit('/')
        .next()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("source.bin")
        .to_owned()
}

async fn publish_nats_json(
    nats_url: &str,
    subject: &str,
    payload: &serde_json::Value,
) -> Result<()> {
    if subject.split_whitespace().count() != 1 {
        return Err(HarnessError::InvalidInput(format!(
            "invalid NATS subject: {subject:?}"
        )));
    }
    let url = Url::parse(nats_url).map_err(|err| {
        HarnessError::InvalidInput(format!("invalid NATS_URL {nats_url:?}: {err}"))
    })?;
    let host = url
        .host_str()
        .ok_or_else(|| HarnessError::InvalidInput("NATS_URL host is required".to_owned()))?;
    let port = url.port().unwrap_or(4222);
    let mut stream = TcpStream::connect((host, port)).await?;
    let mut info_buf = [0_u8; 4096];
    let _ = stream.read(&mut info_buf).await?;
    stream.write_all(nats_connect_line(&url).as_bytes()).await?;
    let bytes = serde_json::to_vec(payload)?;
    stream
        .write_all(format!("PUB {subject} {}\r\n", bytes.len()).as_bytes())
        .await?;
    stream.write_all(&bytes).await?;
    stream.write_all(b"\r\n").await?;
    stream.flush().await?;
    Ok(())
}

fn nats_connect_line(url: &Url) -> String {
    let mut payload = serde_json::json!({
        "verbose": false,
        "pedantic": false,
        "name": "architoken-gateway",
    });
    if !url.username().is_empty() {
        if let Some(password) = url.password() {
            payload["user"] = serde_json::json!(url.username());
            payload["pass"] = serde_json::json!(password);
        } else {
            payload["auth_token"] = serde_json::json!(url.username());
        }
    }
    format!("CONNECT {payload}\r\n")
}

async fn apply_conversion_worker_result_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
    Json(req): Json<ConversionWorkerResultRequest>,
) -> Result<Json<ConversionJobRecord>> {
    ensure_worker_result_token(&state, &headers)?;
    let job_id = parse_uuid(&job_id, "job_id")?;
    if req
        .job_id
        .is_some_and(|payload_job_id| payload_job_id != job_id)
    {
        return Err(HarnessError::InvalidInput(
            "worker result job_id does not match path".to_owned(),
        ));
    }
    let mut output = req.output;
    merge_worker_artifacts(&mut output, req.artifacts);
    ensure_worker_artifacts_persisted(state.runtime_profile, &req.status, &output)?;
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::apply_conversion_job_worker_result(
            pool,
            job_id,
            &req.status,
            output,
            req.error,
        )
        .await
        .map(Json);
    }
    state
        .assets
        .apply_conversion_job_worker_result(job_id, &req.status, output, req.error)
        .map(Json)
}

fn merge_worker_artifacts(output: &mut serde_json::Value, artifacts: Vec<serde_json::Value>) {
    if artifacts.is_empty() {
        return;
    }
    if !output.is_object() {
        let previous = std::mem::take(output);
        *output = serde_json::json!({ "payload": previous });
    }
    if let Some(object) = output.as_object_mut() {
        object.insert("artifacts".to_owned(), serde_json::Value::Array(artifacts));
    }
}

fn ensure_worker_artifacts_persisted(
    profile: RuntimeProfile,
    status: &str,
    output: &serde_json::Value,
) -> Result<()> {
    if !matches!(profile, RuntimeProfile::Production) || status != "completed" {
        return Ok(());
    }
    let artifacts = output
        .get("artifacts")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| {
            HarnessError::InvalidInput(
                "completed worker result must include persisted artifacts in production".to_owned(),
            )
        })?;
    if artifacts.is_empty() {
        return Err(HarnessError::InvalidInput(
            "completed worker result must include at least one artifact in production".to_owned(),
        ));
    }
    for artifact in artifacts {
        let metadata = artifact
            .get("metadata")
            .and_then(serde_json::Value::as_object)
            .ok_or_else(|| {
                HarnessError::InvalidInput(
                    "worker artifact metadata is required in production".to_owned(),
                )
            })?;
        let object_persisted = metadata
            .get("objectPersisted")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false);
        let object_key = metadata
            .get("objectKey")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("")
            .trim();
        if !object_persisted || object_key.is_empty() {
            return Err(HarnessError::InvalidInput(
                "completed worker artifacts must be uploaded to object storage in production"
                    .to_owned(),
            ));
        }
    }
    Ok(())
}

fn ensure_worker_result_token(state: &AppState, headers: &HeaderMap) -> Result<()> {
    let expected = std::env::var("ARCHITOKEN_WORKER_RESULT_TOKEN")
        .ok()
        .filter(|value| !value.trim().is_empty());
    let provided = header_value(headers, "x-architoken-worker-token");
    match (state.runtime_profile, expected, provided) {
        (RuntimeProfile::Production, None, _) => Err(HarnessError::InvalidInput(
            "ARCHITOKEN_WORKER_RESULT_TOKEN is required in production".to_owned(),
        )),
        (RuntimeProfile::Production, Some(expected), Some(provided)) if provided == expected => {
            Ok(())
        }
        (RuntimeProfile::Production, Some(_), _) => Err(HarnessError::Unauthorized(
            "invalid worker result token".to_owned(),
        )),
        (RuntimeProfile::Development, Some(expected), Some(provided)) if provided == expected => {
            Ok(())
        }
        (RuntimeProfile::Development, Some(_), _) => Err(HarnessError::Unauthorized(
            "invalid worker result token".to_owned(),
        )),
        (RuntimeProfile::Development, None, _) => Ok(()),
    }
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
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::list_conversion_jobs(pool, &context, &query)
            .await
            .map(Json);
    }
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
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::get_conversion_job(pool, &context, job_id)
            .await
            .map(Json);
    }
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
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::cancel_conversion_job(pool, &context, job_id, req)
            .await
            .map(Json);
    }
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
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<ChatRequest>,
) -> Result<Json<serde_json::Value>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::GenerationRun)?;
    // Enforce whitelist (Constitution §10).
    if !state
        .cfg
        .inference
        .whitelisted_models
        .iter()
        .any(|m| m == &req.model.0)
    {
        return Err(
            architoken_harness_core::error::HarnessError::ModelNotWhitelisted(req.model.0.clone()),
        );
    }

    let resp = state.router.complete(req).await?;
    Ok(Json(serde_json::to_value(resp)?))
}

#[cfg(test)]
mod tests {
    use architoken_harness_core::{
        asset_registry::{ConversionJobRecord, ConversionOperation},
        durable_store::DurableRecordMetadata,
        error::HarnessError,
        permissions::{Claims, Role},
        runtime_context::{
            HEADER_ROLES, RequestContext, RequestContextInput, RuntimeProfile, RuntimeRole,
        },
    };
    use axum::{
        extract::Path,
        http::{HeaderMap, HeaderValue},
    };
    use uuid::Uuid;

    use super::{context_from_headers, context_from_query, get_module_handler};

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

    #[test]
    fn bearer_token_parser_accepts_authorization_header() {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_static("Bearer token-123"),
        );

        assert_eq!(super::bearer_token(&headers), Some("token-123".to_owned()));
    }

    #[test]
    fn jwt_claim_roles_map_to_runtime_roles() {
        assert_eq!(
            super::runtime_roles_from_claims(&[
                Role::Admin,
                Role::Designer,
                Role::Supervisor,
                Role::Auditor
            ]),
            vec![
                "admin".to_owned(),
                "auditor".to_owned(),
                "engineer".to_owned(),
                "reviewer".to_owned()
            ]
        );
    }

    #[test]
    fn jwt_tenant_rejects_spoofed_request_context_tenant() {
        let claims = Claims {
            sub: "user-1".to_owned(),
            tenant_id: Uuid::parse_str("22222222-2222-4222-8222-222222222222").expect("uuid"),
            roles: vec![Role::Admin],
            iss: "issuer".to_owned(),
            exp: 9_999_999_999,
            iat: 0,
        };
        let header = RequestContextInput {
            tenant_id: Some("33333333-3333-4333-8333-333333333333".to_owned()),
            ..RequestContextInput::default()
        };

        let err = super::reject_spoofed_tenant(
            &claims,
            [
                &header,
                &RequestContextInput::default(),
                &RequestContextInput::default(),
            ],
        )
        .expect_err("spoofed tenant should fail");

        assert_eq!(err.http_status(), 403);
    }

    #[test]
    fn worker_artifacts_are_merged_into_conversion_output() {
        let mut output = serde_json::json!({"engine": "cadquery"});
        super::merge_worker_artifacts(
            &mut output,
            vec![serde_json::json!({
                "name": "model.step",
                "metadata": {
                    "objectPersisted": true,
                    "objectKey": "workers/tenant/project/job/model.step"
                }
            })],
        );

        assert_eq!(output["artifacts"][0]["name"], "model.step");
    }

    #[test]
    fn production_contract_smoke_job_requires_explicit_switch() {
        let job = ConversionJobRecord {
            metadata: DurableRecordMetadata::new(
                "tenant-a",
                Some("project-a".to_owned()),
                Some("tester".to_owned()),
            ),
            job_id: Uuid::new_v4(),
            operation: ConversionOperation::IfcIngest,
            source_asset_id: Uuid::new_v4(),
            source_file_id: Uuid::new_v4(),
            status: "queued".to_owned(),
            input: serde_json::json!({"worker":"contract"}),
            output: serde_json::json!({}),
            error: serde_json::json!({}),
            started_at: None,
            finished_at: None,
        };

        temp_env::with_vars(
            [("ARCHITOKEN_PRODUCTION_CONTRACT_SMOKE", None::<&str>)],
            || {
                assert!(!super::production_contract_smoke_job(
                    RuntimeProfile::Production,
                    &job
                ));
            },
        );
        temp_env::with_vars(
            [("ARCHITOKEN_PRODUCTION_CONTRACT_SMOKE", Some("1"))],
            || {
                assert!(super::production_contract_smoke_job(
                    RuntimeProfile::Production,
                    &job
                ));
                assert!(!super::production_contract_smoke_job(
                    RuntimeProfile::Development,
                    &job
                ));
            },
        );
    }

    #[test]
    fn production_rejects_completed_worker_result_without_persisted_artifacts() {
        let output = serde_json::json!({
            "artifacts": [
                {
                    "name": "model.step",
                    "metadata": {
                        "objectPersisted": false
                    }
                }
            ]
        });

        let err = super::ensure_worker_artifacts_persisted(
            RuntimeProfile::Production,
            "completed",
            &output,
        )
        .expect_err("production must reject local-only artifacts");

        assert_eq!(err.http_status(), 400);
    }

    #[test]
    fn production_accepts_completed_worker_result_with_persisted_artifacts() {
        let output = serde_json::json!({
            "artifacts": [
                {
                    "name": "model.step",
                    "metadata": {
                        "objectPersisted": true,
                        "objectKey": "workers/tenant/project/job/model.step"
                    }
                }
            ]
        });

        super::ensure_worker_artifacts_persisted(RuntimeProfile::Production, "completed", &output)
            .expect("persisted artifacts should be accepted");
    }

    #[test]
    fn valkey_integer_parser_accepts_incr_reply_and_rejects_errors() {
        assert_eq!(
            super::parse_valkey_integer(":12", "INCR").expect("integer reply"),
            12
        );

        let err = super::parse_valkey_integer("-ERR blocked", "INCR")
            .expect_err("error reply should fail");
        assert_eq!(err.http_status(), 500);
    }
}
