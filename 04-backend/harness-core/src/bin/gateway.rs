//! ArchIToken Gateway — the unified L5 API entrypoint.
//!
//! This binary starts:
//! - axum 0.8.9 HTTP server (REST + SSE)
//! - OpenTelemetry / Prometheus exporter
//! - InferenceRouter with 6 adapters
//! - RAG engine
//!
//! Wire it into Kubernetes via `05-infra/k8s/deployment.yaml`.

use std::{collections::BTreeMap, sync::Arc, time::Instant};

use argon2::{
    Algorithm as Argon2Algorithm, Argon2, Params, Version,
    password_hash::{PasswordHasher, PasswordVerifier, phc::PasswordHash},
};
use axum::{
    Json, Router,
    body::Body,
    extract::{DefaultBodyLimit, Multipart},
    extract::{Path, Query, RawQuery, State},
    http::{
        HeaderMap, HeaderValue, Method, Request, StatusCode,
        header::{COOKIE, ORIGIN, SET_COOKIE},
    },
    middleware::{self, Next},
    response::{IntoResponse, Redirect, Response},
    routing::{delete, get, patch, post},
};
use base64::{
    Engine as _,
    engine::general_purpose::{STANDARD as BASE64_STANDARD, URL_SAFE_NO_PAD},
};
use chrono::{DateTime, Utc};
use jsonwebtoken::{EncodingKey, Header};
use reqwest::Url;
use ring::{
    digest, hmac,
    rand::{SecureRandom, SystemRandom},
    rsa, signature,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Postgres, Transaction, postgres::PgPoolOptions};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
};
use tower_http::cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;
use uuid::Uuid;

use architoken_harness_core::{
    ai_center_management::{
        AiCenterDatabaseBinding, AiCenterInterfaceContract, AiCenterManagementResponse,
        AiCenterManagementUpdateRequest, AiCenterVisualizationPanel,
    },
    asset_registry::{
        AssetFileDownloadResponse, AssetListQuery, AssetListResponse, AssetRecord,
        AssetRegistryService, AssetVersionRecord, CompleteUploadRequest, CompleteUploadResponse,
        ConversionJobActionRequest, ConversionJobListResponse, ConversionJobQuery,
        ConversionJobRecord, ConversionOperation, CreateAssetRequest, CreateAssetVersionRequest,
        CreateConversionJobRequest, PresignUploadRequest, PresignUploadResponse,
    },
    config::AppConfig,
    data_plane_store::{
        DataAnalyticsEventInput, DataAnalyticsEventQuery, DataAnalyticsEventRecord,
        DataEventOutboxInput, DataEventOutboxQuery, DataEventOutboxRecord, DataGraphEdgeInput,
        DataGraphEdgeQuery, DataGraphEdgeRecord, DataPlaneBindingRecord, DataTimeSeriesPointInput,
        DataTimeSeriesPointQuery, DataTimeSeriesPointRecord,
    },
    db::RuntimeDatabaseConfig,
    error::{HarnessError, Result},
    file_runtime_registry::default_adapter_for_conversion_source,
    inference::{ChatRequest, InferenceRouter, OpenAiCompatibleChatAdapter},
    knowledge_registry::{
        CreateKnowledgeSourceRequest, KnowledgeIngestionJob, KnowledgeSource,
        KnowledgeSourceListQuery, KnowledgeSourceListResponse, KnowledgeSourceRegistryService,
        UpdateKnowledgeSourceRequest,
    },
    mcp_tool_registry::{
        CreateMcpToolRequest, McpToolListQuery, McpToolListResponse, McpToolRegistryService,
        McpToolSpec, UpdateMcpToolRequest,
    },
    module_audit::{
        AuditEvent, AuditEventInput, AuditEventKind, AuditEventQuery, ModuleAuditService,
    },
    module_files::{
        CopyFileRequest, CreateModuleFileRequest, FileContentResponse, FileListQuery,
        ModuleFileMetadata, ModuleFileNode, ModuleFileService, MoveFileRequest, ShareFileRequest,
        ShareFileResponse, UpdateFileContentRequest, UpdateFileValidationRequest,
        UpdateModuleFileRequest,
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
        RuntimeProfile, RuntimeRole,
    },
    runtime_execution::{
        CreateAiRuntimeDraftRequest, RuntimeExecutionApprovalRequest, RuntimeExecutionListQuery,
        RuntimeExecutionListResponse, RuntimeExecutionRecord, RuntimeExecutionService,
        RuntimeExecutionTraceResponse,
    },
    semantic_dictionary::{
        SJG157_STANDARD_ID, SemanticCategoryListResponse, SemanticCategoryQuery,
        SemanticDictionaryCategory, SemanticDictionaryStandard, sjg157_fallback_standard,
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
const AUTH_SESSION_COOKIE: &str = "architoken_session";
const AUTH_ACCESS_COOKIE: &str = "architoken_access";
const AUTH_SESSION_TTL_SECS: i64 = 60 * 60 * 24 * 7;
const AUTH_CODE_TTL_MINUTES: i64 = 5;
const AUTH_OAUTH_STATE_TTL_MINUTES: i64 = 10;
const AUTH_QR_LOGIN_TTL_SECS: i64 = 120;
const WECHAT_DEV_OAUTH_CODE_PREFIX: &str = "architoken-dev-wechat-";

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DataPlaneBindingListResponse {
    bindings: Vec<DataPlaneBindingRecord>,
    total: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DataGraphEdgeListResponse {
    edges: Vec<DataGraphEdgeRecord>,
    total: usize,
    query: DataGraphEdgeQuery,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DataTimeSeriesPointListResponse {
    points: Vec<DataTimeSeriesPointRecord>,
    total: usize,
    query: DataTimeSeriesPointQuery,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DataEventOutboxListResponse {
    events: Vec<DataEventOutboxRecord>,
    total: usize,
    query: DataEventOutboxQuery,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DataAnalyticsEventListResponse {
    events: Vec<DataAnalyticsEventRecord>,
    total: usize,
    query: DataAnalyticsEventQuery,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BimSemanticReadinessResponse {
    asset_id: Uuid,
    source_asset_id: Option<Uuid>,
    source_file_id: Option<Uuid>,
    ingest_job_id: Option<Uuid>,
    conversion_status: Option<String>,
    readiness_status: String,
    semantics: serde_json::Value,
    semantic_layers: serde_json::Value,
    required_evidence: serde_json::Value,
    open_bim_claim: serde_json::Value,
    missing_evidence: Vec<String>,
    failed_evidence: Vec<String>,
    artifacts: Vec<serde_json::Value>,
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthVerificationCodeRequest {
    channel: String,
    destination: String,
    purpose: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthVerificationCodeResponse {
    channel: String,
    destination: String,
    purpose: String,
    expires_in_seconds: i64,
    delivery_status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    debug_code: Option<String>,
}

#[derive(Debug, Clone)]
struct AuthDeliveryReceipt {
    provider: String,
    status: String,
    message_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthRegisterRequest {
    tenant_name: String,
    full_name: String,
    email: Option<String>,
    phone: Option<String>,
    password: String,
    verification_channel: String,
    verification_code: String,
    job_title: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthLoginRequest {
    identifier: String,
    password: String,
    tenant_id: Option<Uuid>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthCodeLoginRequest {
    channel: String,
    destination: String,
    verification_code: String,
    tenant_id: Option<Uuid>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthPasswordResetRequest {
    channel: String,
    destination: String,
    verification_code: String,
    password: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthQrCreateRequest {
    account_type: Option<String>,
    return_to: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthQrChallengeResponse {
    challenge_id: Uuid,
    qr_payload: String,
    poll_token: String,
    status: String,
    expires_in_seconds: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthQrPollQuery {
    poll_token: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthQrPollResponse {
    challenge_id: Uuid,
    status: String,
    expires_in_seconds: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    auth: Option<AuthResponse>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthQrTokenRequest {
    scan_token: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthQrStatusResponse {
    challenge_id: Uuid,
    status: String,
    expires_in_seconds: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthResponse {
    account_id: Uuid,
    tenant_id: Uuid,
    person_id: Option<Uuid>,
    access_token: String,
    expires_in_seconds: u64,
    runtime_roles: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthMeResponse {
    account_id: String,
    tenant_id: Uuid,
    person_id: Option<Uuid>,
    email: Option<String>,
    phone: Option<String>,
    full_name: Option<String>,
    display_name: Option<String>,
    runtime_roles: Vec<String>,
    job_titles: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthLogoutResponse {
    logged_out: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthOAuthStartQuery {
    account_type: Option<String>,
    return_to: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct AuthOAuthCallbackQuery {
    code: Option<String>,
    auth_code: Option<String>,
    state: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct AuthLoginRow {
    account_id: Uuid,
    password_hash: String,
    tenant_id: Uuid,
    person_id: Option<Uuid>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct AuthAccountTenantRow {
    account_id: Uuid,
    tenant_id: Uuid,
    person_id: Option<Uuid>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct AuthMeRow {
    account_id: Uuid,
    tenant_id: Uuid,
    person_id: Option<Uuid>,
    email: Option<String>,
    phone: Option<String>,
    full_name: Option<String>,
    display_name: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct AuthOAuthStateRow {
    account_type: String,
    return_to: String,
    code_verifier: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct AuthQrChallengeRow {
    challenge_id: Uuid,
    status: String,
    account_id: Option<Uuid>,
    tenant_id: Option<Uuid>,
    person_id: Option<Uuid>,
    expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct IamSummaryResponse {
    tenant_id: Uuid,
    org_units: Vec<IamOrgUnitRow>,
    people: Vec<IamPersonProfileRow>,
    job_titles: Vec<IamJobTitleRow>,
    permissions: Vec<IamPermissionRow>,
    roles: Vec<IamRoleRow>,
    role_bindings: Vec<IamRoleBindingRow>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct IamOrgUnitRow {
    id: Uuid,
    tenant_id: Uuid,
    parent_id: Option<Uuid>,
    unit_code: Option<String>,
    name: String,
    unit_type: String,
    status: String,
    sort_order: i32,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct IamPersonProfileRow {
    id: Uuid,
    tenant_id: Uuid,
    account_id: Option<Uuid>,
    org_unit_id: Option<Uuid>,
    full_name: String,
    display_name: Option<String>,
    primary_phone: Option<String>,
    primary_email: Option<String>,
    employment_status: String,
    credential_summary: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct IamJobTitleRow {
    id: Uuid,
    tenant_id: Option<Uuid>,
    code: String,
    name: String,
    category: String,
    default_scope: String,
    is_system: bool,
    sort_order: i32,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct IamPermissionRow {
    id: String,
    category: String,
    action: String,
    resource_type: String,
    description: String,
    risk_level: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct IamRoleRow {
    id: Uuid,
    tenant_id: Uuid,
    role_key: String,
    name: String,
    description: Option<String>,
    runtime_role: String,
    role_type: String,
    permission_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct IamRoleBindingRow {
    id: Uuid,
    tenant_id: Uuid,
    role_id: Uuid,
    role_key: String,
    role_name: String,
    runtime_role: String,
    principal_type: String,
    principal_id: Uuid,
    principal_name: String,
    resource_type: String,
    resource_id: Option<Uuid>,
    starts_at: DateTime<Utc>,
    expires_at: Option<DateTime<Utc>>,
    granted_by: Option<Uuid>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IamCreateRoleBindingRequest {
    role_id: Option<Uuid>,
    role_key: Option<String>,
    principal_type: String,
    principal_id: Uuid,
    resource_type: Option<String>,
    resource_id: Option<Uuid>,
    expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IamPermissionDecisionRequest {
    principal_type: Option<String>,
    principal_id: Uuid,
    permission_id: String,
    resource_type: Option<String>,
    resource_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct IamPermissionDecisionResponse {
    allowed: bool,
    permission_id: String,
    principal_type: String,
    principal_id: Uuid,
    resource_type: Option<String>,
    resource_id: Option<Uuid>,
    matched_roles: Vec<String>,
    reason: String,
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
struct QuantityCostingOverviewRecord {
    project_id: Uuid,
    cost_project_count: i64,
    review_version_count: i64,
    boq_item_count: i64,
    measure_item_count: i64,
    other_item_count: i64,
    fee_item_count: i64,
    report_count: i64,
    boq_submitted_total: f64,
    boq_approved_total: f64,
    boq_amount_delta: f64,
    measure_submitted_total: f64,
    measure_approved_total: f64,
    measure_amount_delta: f64,
    other_submitted_total: f64,
    other_approved_total: f64,
    other_amount_delta: f64,
    fee_submitted_total: f64,
    fee_approved_total: f64,
    fee_amount_delta: f64,
    increase_amount: f64,
    decrease_amount: f64,
    source_review_required_count: i64,
    latest_review_status: Option<String>,
    latest_review_output_state: Option<String>,
    latest_review_updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuantityCostingSnapshotRequest {
    costing_project_key: String,
    name: String,
    jurisdiction: String,
    standard_profile_id: String,
    quota_library_id: String,
    review_key: String,
    review_round: i32,
    review_description: String,
    tree_nodes: Vec<QuantityCostingTreeNodeRequest>,
    boq_items: Vec<QuantityCostingBoqItemRequest>,
    measure_items: Vec<QuantityCostingMeasureItemRequest>,
    other_items: Vec<QuantityCostingOtherItemRequest>,
    fee_summary_items: Vec<QuantityCostingFeeSummaryItemRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct QuantityCostingTreeNodeRequest {
    node_id: String,
    parent_id: Option<String>,
    node_type: String,
    name: String,
    specialty: String,
    sort_order: i32,
    standard_profile_id: String,
    quota_library_id: String,
    audit_state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct QuantityCostingBoqItemRequest {
    item_id: String,
    node_id: String,
    submitted_code: String,
    approved_code: String,
    submitted_name: String,
    approved_name: String,
    submitted_feature: String,
    approved_feature: String,
    unit: String,
    submitted_qty: f64,
    approved_qty: f64,
    qty_delta: f64,
    submitted_unit_price: f64,
    approved_unit_price: f64,
    submitted_total: f64,
    approved_total: f64,
    amount_delta: f64,
    increase_amount: f64,
    decrease_amount: f64,
    change_mark: String,
    change_reason: String,
    source_ref: String,
    rule_id: String,
    element_id: Option<String>,
    source_review_required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct QuantityCostingMeasureItemRequest {
    item_id: String,
    name: String,
    measure_type: String,
    submitted_base_amount: f64,
    approved_base_amount: f64,
    submitted_rate: f64,
    approved_rate: f64,
    submitted_amount: f64,
    approved_amount: f64,
    amount_delta: f64,
    change_mark: String,
    source_rule_id: String,
    source_ref: String,
    source_review_required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct QuantityCostingOtherItemRequest {
    item_id: String,
    name: String,
    other_type: String,
    submitted_amount: f64,
    approved_amount: f64,
    amount_delta: f64,
    change_mark: String,
    source_rule_id: String,
    source_ref: String,
    source_review_required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct QuantityCostingFeeSummaryItemRequest {
    fee_id: String,
    name: String,
    submitted_base_amount: f64,
    approved_base_amount: f64,
    submitted_rate: f64,
    approved_rate: f64,
    submitted_amount: f64,
    approved_amount: f64,
    amount_delta: f64,
    change_mark: String,
    source_rule_id: String,
    source_ref: String,
    source_review_required: bool,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
struct QuantityCostingSnapshotHeadRecord {
    cost_project_id: Uuid,
    review_version_id: Option<Uuid>,
    costing_project_key: String,
    name: String,
    jurisdiction: String,
    standard_profile_id: String,
    quota_library_id: String,
    review_key: String,
    review_round: i32,
    review_description: String,
}

#[derive(Debug, Clone, Serialize)]
struct QuantityCostingSnapshotResponse {
    cost_project_id: Uuid,
    review_version_id: Option<Uuid>,
    costing_project_key: String,
    name: String,
    jurisdiction: String,
    standard_profile_id: String,
    quota_library_id: String,
    review_key: String,
    review_round: i32,
    review_description: String,
    tree_nodes: Vec<QuantityCostingTreeNodeRequest>,
    boq_items: Vec<QuantityCostingBoqItemRequest>,
    measure_items: Vec<QuantityCostingMeasureItemRequest>,
    other_items: Vec<QuantityCostingOtherItemRequest>,
    fee_summary_items: Vec<QuantityCostingFeeSummaryItemRequest>,
}

#[derive(Debug, Clone, Serialize)]
struct QuantityCostingSnapshotSaveResponse {
    cost_project_id: Uuid,
    review_version_id: Uuid,
    tree_node_count: usize,
    boq_item_count: usize,
    measure_item_count: usize,
    other_item_count: usize,
    fee_item_count: usize,
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

#[derive(Debug, Clone, Deserialize)]
struct AgentInvokeResponseSummary {
    #[serde(alias = "requestId")]
    request_id: String,
    #[serde(alias = "moduleId")]
    module_id: String,
    verdict: String,
    #[serde(default, alias = "revisionCount")]
    revision_count: i64,
    #[serde(default, alias = "outputStatus")]
    output_status: String,
    #[serde(default)]
    gates: Vec<serde_json::Value>,
    #[serde(default, alias = "toolResults")]
    tool_results: Vec<serde_json::Value>,
    #[serde(default, alias = "ragChunks")]
    rag_chunks: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
struct RagRetrieveRequest {
    #[serde(alias = "tenantId")]
    tenant_id: Uuid,
    #[serde(alias = "projectId")]
    project_id: Uuid,
    query: String,
    #[serde(default = "default_rag_top_k", alias = "topK")]
    top_k: i64,
    #[serde(default)]
    corpora: Vec<String>,
    #[serde(default, alias = "queryEmbedding")]
    query_embedding: Vec<f32>,
}

#[derive(Debug, Clone, Serialize)]
struct RagRetrieveResponse {
    schema: &'static str,
    retrieval_status: &'static str,
    tenant_id: Uuid,
    project_id: Uuid,
    top_k: i64,
    corpora: Vec<String>,
    chunks: Vec<RagRetrievedChunk>,
    metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
struct RagRetrievedChunk {
    id: Uuid,
    source: String,
    heading: String,
    content: String,
    score: f32,
    metadata: serde_json::Value,
}

fn default_agent_locale() -> String {
    "zh-CN".to_owned()
}

fn default_rag_top_k() -> i64 {
    5
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

    for engine_config in &cfg.inference.engines {
        router.register(Arc::new(OpenAiCompatibleChatAdapter::from_config(
            engine_config,
        )?));
    }

    let audit = Arc::new(ModuleAuditService::new());
    let runtime_profile = RuntimeProfile::from_profile_name(
        &std::env::var("ARCHITOKEN_PROFILE").unwrap_or_else(|_| "development".to_owned()),
    );
    let database_config =
        RuntimeDatabaseConfig::from_env_or_config(runtime_profile, Some(&cfg.database.url))?;
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
        ensure_data_plane_schema(pool).await?;
        postgres_runtime_store::ensure_phase7_runtime_schema(pool).await?;
        ensure_auth_iam_schema(pool).await?;
        ensure_project_planning_studio_schema(pool).await?;
        ensure_project_planning_progress_schema(pool).await?;
        ensure_sjg157_semantic_dictionary_schema(pool).await?;
        ensure_ai_center_management_schema(pool).await?;
        ensure_quantity_costing_workflow_schema(pool).await?;
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
            "/v1/data-plane/bindings",
            get(list_data_plane_bindings_handler),
        )
        .route(
            "/v1/data-plane/graph-edges",
            get(list_data_graph_edges_handler).post(upsert_data_graph_edge_handler),
        )
        .route(
            "/v1/data-plane/time-series/points",
            get(list_data_time_series_points_handler).post(write_data_time_series_point_handler),
        )
        .route(
            "/v1/data-plane/event-outbox",
            get(list_data_event_outbox_handler).post(append_data_event_outbox_handler),
        )
        .route(
            "/v1/data-plane/analytics-events",
            get(list_data_analytics_events_handler).post(record_data_analytics_event_handler),
        )
        .route(
            "/v1/auth/verification-codes",
            post(issue_auth_verification_code_handler),
        )
        .route("/v1/auth/register", post(register_auth_handler))
        .route("/v1/auth/login", post(login_auth_handler))
        .route("/v1/auth/login/code", post(login_auth_code_handler))
        .route("/v1/auth/password/reset", post(reset_auth_password_handler))
        .route(
            "/v1/auth/qr/challenges",
            post(create_auth_qr_challenge_handler),
        )
        .route(
            "/v1/auth/qr/challenges/{challenge_id}",
            get(poll_auth_qr_challenge_handler),
        )
        .route(
            "/v1/auth/qr/challenges/{challenge_id}/scan",
            post(scan_auth_qr_challenge_handler),
        )
        .route(
            "/v1/auth/qr/challenges/{challenge_id}/approve",
            post(approve_auth_qr_challenge_handler),
        )
        .route(
            "/v1/auth/oauth/{provider}/start",
            get(start_auth_oauth_handler),
        )
        .route(
            "/v1/auth/oauth/{provider}/callback",
            get(callback_auth_oauth_handler),
        )
        .route("/v1/auth/logout", post(logout_auth_handler))
        .route("/v1/auth/me", get(me_auth_handler))
        .route("/v1/iam/summary", get(get_iam_summary_handler))
        .route(
            "/v1/iam/role-bindings",
            post(create_iam_role_binding_handler),
        )
        .route(
            "/v1/iam/role-bindings/{binding_id}",
            delete(delete_iam_role_binding_handler),
        )
        .route(
            "/v1/iam/permission-decisions",
            post(decide_iam_permission_handler),
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
        .route("/v1/rag/retrieve", post(retrieve_rag_handler))
        .route(
            "/v1/projects",
            get(list_projects_handler).post(create_project_handler),
        )
        .route("/v1/projects/{id}", get(get_project_handler))
        .route("/v1/projects/{id}/bim", post(upload_project_bim_handler))
        .route("/v1/projects/{id}/boq", get(list_project_boq_handler))
        .route(
            "/v1/projects/{id}/quantity-costing/overview",
            get(get_quantity_costing_overview_handler),
        )
        .route(
            "/v1/projects/{id}/quantity-costing/snapshots/latest",
            get(get_latest_quantity_costing_snapshot_handler),
        )
        .route(
            "/v1/projects/{id}/quantity-costing/snapshots",
            post(save_quantity_costing_snapshot_handler),
        )
        .route(
            "/v1/projects/{id}/compliance",
            get(list_project_compliance_handler),
        )
        .route("/v1/modules", get(list_modules_handler))
        .route("/v1/modules/{module_id}", get(get_module_handler))
        .route(
            "/v1/semantic-dictionaries/sjg157",
            get(get_sjg157_standard_handler),
        )
        .route(
            "/v1/semantic-dictionaries/sjg157/categories",
            get(list_sjg157_categories_handler),
        )
        .route(
            "/v1/semantic-dictionaries/sjg157/categories/{code}",
            get(get_sjg157_category_handler),
        )
        .route(
            "/v1/ai-center/management",
            get(get_ai_center_management_handler),
        )
        .route(
            "/v1/ai-center/interface-contracts/{contract_key}",
            get(get_ai_center_interface_contract_handler)
                .patch(update_ai_center_interface_contract_handler),
        )
        .route(
            "/v1/ai-center/database-bindings/{binding_key}",
            get(get_ai_center_database_binding_handler)
                .patch(update_ai_center_database_binding_handler),
        )
        .route(
            "/v1/ai-center/visualization-panels/{panel_key}",
            get(get_ai_center_visualization_panel_handler)
                .patch(update_ai_center_visualization_panel_handler),
        )
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
        .route(
            "/v1/files/{file_id}/validation",
            patch(update_file_validation_handler),
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
            "/v1/bim/models/{asset_id}/semantics",
            get(get_bim_model_semantics_handler),
        )
        .route(
            "/v1/bim/models/{asset_id}/openbim-readiness",
            get(get_bim_model_semantics_handler),
        )
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
        SET current_module_id = 'finance_management'
        WHERE current_module_id = 'finance_hr';

        UPDATE projects
        SET current_module_id = NULL
        WHERE current_module_id IN (
            SELECT id FROM modules
            WHERE order_num BETWEEN 1 AND 16
              AND id NOT IN (
                'personal_center',
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
                'finance_management',
                'human_resources',
                'ai_center',
                'settings_center'
              )
        );
        UPDATE modules
        SET enabled = FALSE,
            order_num = order_num + 1000,
            updated_at = NOW()
        WHERE order_num BETWEEN 1 AND 16
          AND id NOT IN (
            'personal_center',
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
            'finance_management',
            'human_resources',
            'ai_center',
            'settings_center'
          );
        UPDATE modules
        SET order_num = CASE id
            WHEN 'personal_center' THEN -1
            WHEN 'marketing_service' THEN -2
            WHEN 'planning_management' THEN -3
            WHEN 'concept_design' THEN -4
            WHEN 'standard_library' THEN -5
            WHEN 'detailed_design' THEN -6
            WHEN 'quantity_costing' THEN -7
            WHEN 'material_logistics' THEN -8
            WHEN 'production_manufacturing' THEN -9
            WHEN 'construction_management' THEN -10
            WHEN 'digital_twin' THEN -11
            WHEN 'digital_archive' THEN -12
            WHEN 'finance_management' THEN -13
            WHEN 'human_resources' THEN -14
            WHEN 'ai_center' THEN -15
            WHEN 'settings_center' THEN -16
            WHEN 'finance_hr' THEN -1200
            ELSE order_num
        END
        WHERE id IN (
            'personal_center',
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
            'finance_management',
            'human_resources',
            'ai_center',
            'settings_center',
            'finance_hr'
        );

        INSERT INTO modules (id, zh_name, en_name, order_num, description) VALUES
            ('personal_center', '个人中心', 'Personal Center', 1, '个人资料、账号安全、通知、最近工作、个人审批、收藏和偏好入口'),
            ('marketing_service', '市场客服', 'Marketing Service', 2, '客户线索、需求澄清、报价和初版方案入口'),
            ('planning_management', '计划管理', 'Planning Management', 3, 'WBS、里程碑、资源计划、审批计划和总控排程'),
            ('concept_design', '方案设计', 'Concept Design', 4, '多方案生成、初步三维表达、合规约束和造价估算'),
            ('standard_library', '标准族库', 'Standard Library', 5, '规范条文、族库构件、材料、模板和规则包'),
            ('detailed_design', '深化设计', 'Detailed Design', 6, 'IFC、施工图、节点深化、结构连接和碰撞检查'),
            ('quantity_costing', '计量造价', 'Quantity & Costing', 7, '工程量、BOQ、清单、价格库和变更估算'),
            ('material_logistics', '材料物流', 'Material Logistics', 8, '材料库存、采购、包装、装车、物流和签收'),
            ('production_manufacturing', '生产制造', 'Production Manufacturing', 9, '生产计划、工序路线、CNC、焊接、质检、发运和 Paperclip 模块内编排'),
            ('construction_management', '施工管理', 'Construction Management', 10, '施工方案、进度、质量、安全、日志、整改和竣工资料'),
            ('digital_twin', '数字孪生', 'Digital Twin', 11, 'IFC、GLB、点云、IoT、SCADA 和运维告警'),
            ('digital_archive', '数字档案', 'Digital Archive', 12, '工程档案、版本链、签章、留存和检索'),
            ('finance_management', '财务管理', 'Finance Management', 13, '合同、收付款、发票、成本、预算、现金流、佣金和结算归档'),
            ('human_resources', '人力资源', 'Human Resources', 14, '组织岗位、人员班组、资质证书、考勤工时、培训记录、绩效评估和劳动合规'),
            ('ai_center', 'AI中心', 'AI Capability Center', 15, '模型路由、RAG、MCP、Agent、权限和成本审计'),
            ('settings_center', '设置中心', 'Settings Center', 16, '人员、账号、密码、头像、单位、岗位、角色和权限')
        ON CONFLICT (id) DO UPDATE
        SET zh_name = EXCLUDED.zh_name,
            en_name = EXCLUDED.en_name,
            order_num = EXCLUDED.order_num,
            description = EXCLUDED.description,
            enabled = TRUE,
            updated_at = NOW();

        INSERT INTO modules (id, zh_name, en_name, order_num, description, enabled) VALUES
            ('finance_hr', '财务人力', 'Finance & HR', 1200, '历史兼容别名;当前拆分为 finance_management 与 human_resources', FALSE)
        ON CONFLICT (id) DO UPDATE
        SET zh_name = EXCLUDED.zh_name,
            en_name = EXCLUDED.en_name,
            order_num = EXCLUDED.order_num,
            description = EXCLUDED.description,
            enabled = FALSE,
            updated_at = NOW();

        UPDATE projects
        SET current_module_id = 'construction_management'
        WHERE current_module_id IN (
            SELECT id FROM modules
            WHERE order_num = 10 AND id <> 'construction_management'
        );
        UPDATE projects
        SET current_module_id = 'marketing_service'
        WHERE current_module_id IS NULL
           OR current_module_id NOT IN (SELECT id FROM modules WHERE enabled = TRUE);
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

async fn ensure_data_plane_schema(pool: &PgPool) -> Result<()> {
    if !table_exists(pool, "projects").await? || !table_exists(pool, "modules").await? {
        return Ok(());
    }
    sqlx::raw_sql(include_str!(
        "../../../migrations/20260601000002_data_plane_progressive_split.sql"
    ))
    .execute(pool)
    .await?;
    Ok(())
}

async fn ensure_sjg157_semantic_dictionary_schema(pool: &PgPool) -> Result<()> {
    sqlx::raw_sql(include_str!(
        "../../../migrations/20260521000002_sjg157_semantic_dictionary.sql"
    ))
    .execute(pool)
    .await?;
    Ok(())
}

async fn ensure_ai_center_management_schema(pool: &PgPool) -> Result<()> {
    sqlx::raw_sql(include_str!(
        "../../../migrations/20260521000003_ai_center_management.sql"
    ))
    .execute(pool)
    .await?;
    Ok(())
}

async fn ensure_quantity_costing_workflow_schema(pool: &PgPool) -> Result<()> {
    sqlx::raw_sql(include_str!(
        "../../../migrations/20260523000001_quantity_costing_workflow.sql"
    ))
    .execute(pool)
    .await?;
    Ok(())
}

async fn ensure_project_planning_studio_schema(pool: &PgPool) -> Result<()> {
    sqlx::raw_sql(include_str!(
        "../../../migrations/20260519000003_project_planning_studio.sql"
    ))
    .execute(pool)
    .await?;
    Ok(())
}

async fn ensure_project_planning_progress_schema(pool: &PgPool) -> Result<()> {
    sqlx::raw_sql(include_str!(
        "../../../migrations/20260521000001_project_planning_progress_control.sql"
    ))
    .execute(pool)
    .await?;
    Ok(())
}

async fn ensure_auth_iam_schema(pool: &PgPool) -> Result<()> {
    sqlx::raw_sql(include_str!(
        "../../../migrations/20260525000001_auth_iam_baseline.sql"
    ))
    .execute(pool)
    .await?;
    Ok(())
}

async fn validate_gateway_database_schema(pool: &PgPool) -> Result<()> {
    for table in [
        "tenants",
        "users",
        "auth_accounts",
        "auth_password_credentials",
        "auth_verification_codes",
        "auth_sessions",
        "auth_account_tenants",
        "auth_oauth_states",
        "auth_oauth_identities",
        "auth_qr_login_challenges",
        "iam_org_units",
        "iam_person_profiles",
        "iam_job_titles",
        "iam_person_job_assignments",
        "iam_permissions",
        "iam_roles",
        "iam_role_permissions",
        "iam_role_bindings",
        "iam_relationship_tuples",
        "modules",
        "projects",
        "project_plan_tokens",
        "project_plan_versions",
        "project_plan_wbs_items",
        "project_plan_tasks",
        "project_plan_milestones",
        "project_plan_resources",
        "project_plan_risks",
        "project_plan_raci_entries",
        "project_plan_diagrams",
        "project_plan_progress_feedback",
        "project_plan_schedule_alerts",
        "project_plan_schedule_adjustments",
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
        "module_transactions",
        "module_transaction_approvals",
        "runtime_executions",
        "audit_events",
        "data_plane_bindings",
        "data_graph_edges",
        "data_timeseries_points",
        "data_event_outbox",
        "data_analytics_events",
        "semantic_dictionary_standards",
        "semantic_dictionary_namespaces",
        "semantic_dictionary_rdf_terms",
        "semantic_dictionary_categories",
        "semantic_dictionary_classification_mappings",
        "semantic_dictionary_terminologies",
        "semantic_dictionary_term_projections",
        "project_semantic_standard_adoptions",
        "bim_model_unit_semantic_bindings",
        "ai_center_interface_contracts",
        "ai_center_database_bindings",
        "ai_center_visualization_panels",
        "cost_projects",
        "cost_project_tree_nodes",
        "cost_standards",
        "cost_quota_libraries",
        "cost_quota_items",
        "cost_price_snapshots",
        "cost_resource_items",
        "cost_bill_versions",
        "cost_review_versions",
        "cost_boq_items",
        "cost_quota_subitems",
        "cost_unit_price_components",
        "cost_quantity_details",
        "cost_measure_items",
        "cost_other_items",
        "cost_fee_summary_items",
        "cost_delta_analysis_items",
        "cost_report_templates",
        "cost_review_reports",
        "cost_approval_records",
        "cost_audit_events",
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
    let base = CorsLayer::new()
        .allow_credentials(true)
        .allow_methods(AllowMethods::mirror_request())
        .allow_headers(AllowHeaders::mirror_request());
    let has_wildcard = cfg.server.cors_origins.iter().any(|origin| origin == "*");
    if has_wildcard {
        if matches!(profile, RuntimeProfile::Production) {
            return Err(HarnessError::InvalidInput(
                "production CORS rejects wildcard origin; configure ARCHITOKEN_SERVER__CORS_ORIGINS"
                    .to_owned(),
            ));
        }
        return Ok(base.allow_origin(AllowOrigin::mirror_request()));
    }
    if cfg.server.cors_origins.is_empty() {
        return Err(HarnessError::InvalidInput(
            "at least one CORS origin is required".to_owned(),
        ));
    }
    if !matches!(profile, RuntimeProfile::Production) {
        let configured_origins = cfg.server.cors_origins.clone();
        return Ok(
            base.allow_origin(AllowOrigin::predicate(move |origin, _request_parts| {
                let Ok(origin) = origin.to_str() else {
                    return false;
                };
                configured_origins
                    .iter()
                    .any(|configured| configured == origin)
                    || is_development_cors_origin(origin)
            })),
        );
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

fn is_development_cors_origin(origin: &str) -> bool {
    let Ok(url) = Url::parse(origin) else {
        return false;
    };
    if !matches!(url.scheme(), "http" | "https") || url.port_or_known_default() != Some(3000) {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    host == "localhost"
        || host == "127.0.0.1"
        || host == "::1"
        || host
            .parse::<std::net::Ipv4Addr>()
            .is_ok_and(|address| address.is_private() || address.is_loopback())
}

fn runtime_cache_url(cfg: &AppConfig) -> Option<String> {
    std::env::var("ARCHITOKEN_CACHE__URL")
        .ok()
        .or_else(|| std::env::var("VALKEY_URL").ok())
        .or_else(|| std::env::var("REDIS_URL").ok())
        .or_else(|| Some(cfg.cache.url.clone()))
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn runtime_nats_url() -> Option<String> {
    std::env::var("NATS_URL")
        .ok()
        .or_else(|| std::env::var("ARCHITOKEN_EVENT__URL").ok())
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
        || request.uri().path().starts_with("/v1/auth/")
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

async fn list_data_plane_bindings_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
) -> Result<Json<DataPlaneBindingListResponse>> {
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::RegistryRead)?;
    let bindings =
        architoken_harness_core::data_plane_store::list_data_plane_bindings(db_pool(&state)?)
            .await?;
    Ok(Json(DataPlaneBindingListResponse {
        total: bindings.len(),
        bindings,
    }))
}

async fn list_data_graph_edges_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<DataGraphEdgeQuery>,
) -> Result<Json<DataGraphEdgeListResponse>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::ArtifactRead)?;
    let edges = architoken_harness_core::data_plane_store::list_graph_edges(
        db_pool(&state)?,
        &context,
        &query,
    )
    .await?;
    Ok(Json(DataGraphEdgeListResponse {
        total: edges.len(),
        edges,
        query,
    }))
}

async fn upsert_data_graph_edge_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<DataGraphEdgeInput>,
) -> Result<(StatusCode, Json<DataGraphEdgeRecord>)> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::ArtifactWrite)?;
    let edge = architoken_harness_core::data_plane_store::upsert_graph_edge(
        db_pool(&state)?,
        &context,
        req,
    )
    .await?;
    Ok((StatusCode::CREATED, Json(edge)))
}

async fn list_data_time_series_points_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<DataTimeSeriesPointQuery>,
) -> Result<Json<DataTimeSeriesPointListResponse>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::ArtifactRead)?;
    let points = architoken_harness_core::data_plane_store::list_time_series_points(
        db_pool(&state)?,
        &context,
        &query,
    )
    .await?;
    Ok(Json(DataTimeSeriesPointListResponse {
        total: points.len(),
        points,
        query,
    }))
}

async fn write_data_time_series_point_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<DataTimeSeriesPointInput>,
) -> Result<(StatusCode, Json<DataTimeSeriesPointRecord>)> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::ArtifactWrite)?;
    let point = architoken_harness_core::data_plane_store::write_time_series_point(
        db_pool(&state)?,
        &context,
        req,
    )
    .await?;
    Ok((StatusCode::CREATED, Json(point)))
}

async fn list_data_event_outbox_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<DataEventOutboxQuery>,
) -> Result<Json<DataEventOutboxListResponse>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::ArtifactRead)?;
    let events = architoken_harness_core::data_plane_store::list_event_outbox(
        db_pool(&state)?,
        &context,
        &query,
    )
    .await?;
    Ok(Json(DataEventOutboxListResponse {
        total: events.len(),
        events,
        query,
    }))
}

async fn append_data_event_outbox_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<DataEventOutboxInput>,
) -> Result<(StatusCode, Json<DataEventOutboxRecord>)> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::ArtifactWrite)?;
    let event = architoken_harness_core::data_plane_store::append_event_outbox(
        db_pool(&state)?,
        &context,
        req,
    )
    .await?;
    Ok((StatusCode::CREATED, Json(event)))
}

async fn list_data_analytics_events_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<DataAnalyticsEventQuery>,
) -> Result<Json<DataAnalyticsEventListResponse>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::ArtifactRead)?;
    let events = architoken_harness_core::data_plane_store::list_analytics_events(
        db_pool(&state)?,
        &context,
        &query,
    )
    .await?;
    Ok(Json(DataAnalyticsEventListResponse {
        total: events.len(),
        events,
        query,
    }))
}

async fn record_data_analytics_event_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<DataAnalyticsEventInput>,
) -> Result<(StatusCode, Json<DataAnalyticsEventRecord>)> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::ArtifactWrite)?;
    let event = architoken_harness_core::data_plane_store::record_analytics_event(
        db_pool(&state)?,
        &context,
        req,
    )
    .await?;
    Ok((StatusCode::CREATED, Json(event)))
}

async fn issue_auth_verification_code_handler(
    State(state): State<AppState>,
    Json(req): Json<AuthVerificationCodeRequest>,
) -> Result<Json<AuthVerificationCodeResponse>> {
    let pool = db_pool(&state)?;
    let channel = normalize_auth_channel(&req.channel)?;
    let destination = normalize_auth_destination(&channel, &req.destination)?;
    let purpose = normalize_auth_purpose(req.purpose.as_deref().unwrap_or("register"))?;
    let code = generate_verification_code()?;
    let code_hash = verification_code_hash(&state, &channel, &destination, &purpose, &code)?;
    let expires_at = Utc::now() + chrono::Duration::minutes(AUTH_CODE_TTL_MINUTES);
    let verification_id = Uuid::new_v4();
    let pending_metadata = serde_json::json!({
        "deliveryProvider": "pending",
        "deliveryStatus": "pending"
    });

    sqlx::query(
        r"
        INSERT INTO auth_verification_codes
            (id, channel, destination, purpose, code_hash, expires_at, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ",
    )
    .bind(verification_id)
    .bind(&channel)
    .bind(&destination)
    .bind(&purpose)
    .bind(&code_hash)
    .bind(expires_at)
    .bind(&pending_metadata)
    .execute(pool)
    .await?;

    let delivery = match deliver_auth_verification_code(
        &state,
        &channel,
        &destination,
        &purpose,
        &code,
        AUTH_CODE_TTL_MINUTES * 60,
    )
    .await
    {
        Ok(delivery) => delivery,
        Err(err) => {
            let failure_metadata = serde_json::json!({
                "deliveryProvider": "failed",
                "deliveryStatus": "failed",
                "deliveryError": err.to_string()
            });
            let _ = sqlx::query(
                r"
                UPDATE auth_verification_codes
                SET consumed_at = NOW(),
                    metadata = $2
                WHERE id = $1
                ",
            )
            .bind(verification_id)
            .bind(&failure_metadata)
            .execute(pool)
            .await;
            return Err(err);
        }
    };
    let delivery_metadata = serde_json::json!({
        "deliveryProvider": delivery.provider.clone(),
        "deliveryStatus": delivery.status.clone(),
        "deliveryMessageId": delivery.message_id.clone()
    });
    sqlx::query(
        r"
        UPDATE auth_verification_codes
        SET metadata = $2
        WHERE id = $1
        ",
    )
    .bind(verification_id)
    .bind(&delivery_metadata)
    .execute(pool)
    .await?;

    let debug_code = auth_delivery_debug_enabled(&state).then_some(code);
    Ok(Json(AuthVerificationCodeResponse {
        channel,
        destination,
        purpose,
        expires_in_seconds: AUTH_CODE_TTL_MINUTES * 60,
        delivery_status: delivery.status,
        debug_code,
    }))
}

async fn register_auth_handler(
    State(state): State<AppState>,
    Json(req): Json<AuthRegisterRequest>,
) -> Result<Response> {
    let pool = db_pool(&state)?;
    let email = req.email.as_deref().map(normalize_email).transpose()?;
    let phone = req.phone.as_deref().map(normalize_phone).transpose()?;
    if email.is_none() && phone.is_none() {
        return Err(HarnessError::InvalidInput(
            "email or phone is required".to_owned(),
        ));
    }
    validate_auth_password(&req.password)?;
    let channel = normalize_auth_channel(&req.verification_channel)?;
    let destination = match channel.as_str() {
        "email" => email.clone().ok_or_else(|| {
            HarnessError::InvalidInput("email verification requires email".into())
        })?,
        "phone" => phone.clone().ok_or_else(|| {
            HarnessError::InvalidInput("phone verification requires phone".into())
        })?,
        _ => unreachable!("auth channel is normalized"),
    };
    ensure_auth_account_available(pool, email.as_deref(), phone.as_deref()).await?;
    consume_verification_code(
        pool,
        &state,
        &channel,
        &destination,
        "register",
        &req.verification_code,
    )
    .await?;

    let password_hash = hash_auth_password(&state, &req.password)?;
    let tenant_name = non_empty_string(&req.tenant_name, "tenantName")?;
    let full_name = non_empty_string(&req.full_name, "fullName")?;
    let account_id = Uuid::new_v4();
    let tenant_id = Uuid::new_v4();
    let person_id = Uuid::new_v4();
    let mut tx = pool.begin().await?;

    sqlx::query(
        r"
        INSERT INTO tenants (id, name, locale, region)
        VALUES ($1, $2, 'zh-CN', 'cn')
        ",
    )
    .bind(tenant_id)
    .bind(&tenant_name)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r"
        INSERT INTO auth_accounts (id, primary_email, primary_phone, status)
        VALUES ($1, $2, $3, 'active')
        ",
    )
    .bind(account_id)
    .bind(&email)
    .bind(&phone)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO auth_password_credentials
            (account_id, password_hash, algorithm, params)
        VALUES (
            $1, $2, 'argon2id',
            '{"m_cost_kib":65536,"t_cost":3,"p_cost":4,"pepper":"server_side"}'::jsonb
        )
        "#,
    )
    .bind(account_id)
    .bind(&password_hash)
    .execute(&mut *tx)
    .await?;

    set_tenant_in_tx(&mut tx, tenant_id).await?;
    ensure_default_iam_roles_in_tx(&mut tx, tenant_id).await?;

    sqlx::query(
        r"
        INSERT INTO iam_person_profiles
            (id, tenant_id, account_id, full_name, display_name, primary_phone, primary_email)
        VALUES ($1, $2, $3, $4, $4, $5, $6)
        ",
    )
    .bind(person_id)
    .bind(tenant_id)
    .bind(account_id)
    .bind(&full_name)
    .bind(&phone)
    .bind(&email)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r"
        INSERT INTO auth_account_tenants (account_id, tenant_id, person_id, status)
        VALUES ($1, $2, $3, 'active')
        ON CONFLICT (account_id, tenant_id) DO UPDATE
        SET person_id = EXCLUDED.person_id,
            status = 'active',
            updated_at = NOW()
        ",
    )
    .bind(account_id)
    .bind(tenant_id)
    .bind(person_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r"
        INSERT INTO iam_role_bindings
            (tenant_id, role_id, principal_type, principal_id, resource_type, resource_id)
        SELECT $1, id, 'account', $2, 'tenant', $1
        FROM iam_roles
        WHERE tenant_id = $1 AND role_key = 'tenant_owner'
        ON CONFLICT DO NOTHING
        ",
    )
    .bind(tenant_id)
    .bind(account_id)
    .execute(&mut *tx)
    .await?;

    if let Some(job_title) = req
        .job_title
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        assign_initial_job_title_in_tx(&mut tx, tenant_id, person_id, job_title).await?;
    }

    let runtime_roles =
        fetch_runtime_roles_for_account_in_tx(&mut tx, tenant_id, account_id).await?;
    let (session_token, _session_id) =
        create_auth_session_in_tx(&mut tx, &state, account_id, tenant_id, Some(person_id)).await?;
    tx.commit().await?;

    let access_token = create_auth_access_token(&state, account_id, tenant_id, &runtime_roles)?;
    let response = AuthResponse {
        account_id,
        tenant_id,
        person_id: Some(person_id),
        access_token: access_token.clone(),
        expires_in_seconds: state.cfg.auth.jwt_expiry_secs,
        runtime_roles,
    };
    json_with_auth_cookies(
        response,
        &session_token,
        &access_token,
        state.runtime_profile,
        state.cfg.auth.jwt_expiry_secs,
    )
}

async fn login_auth_handler(
    State(state): State<AppState>,
    Json(req): Json<AuthLoginRequest>,
) -> Result<Response> {
    let pool = db_pool(&state)?;
    let identifier = normalize_login_identifier(&req.identifier)?;
    let row = sqlx::query_as::<_, AuthLoginRow>(
        r"
        SELECT a.id AS account_id,
               pc.password_hash,
               at.tenant_id,
               at.person_id
        FROM auth_accounts a
        JOIN auth_password_credentials pc ON pc.account_id = a.id
        JOIN auth_account_tenants at ON at.account_id = a.id AND at.status = 'active'
        WHERE a.status = 'active'
          AND (
              lower(a.primary_email) = lower($1)
              OR a.primary_phone = $1
          )
          AND ($2::uuid IS NULL OR at.tenant_id = $2)
        ORDER BY at.created_at ASC
        LIMIT 1
        ",
    )
    .bind(&identifier)
    .bind(req.tenant_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(invalid_auth_credentials)?;

    verify_auth_password(&state, &req.password, &row.password_hash)?;
    let mut tx = pool.begin().await?;
    set_tenant_in_tx(&mut tx, row.tenant_id).await?;
    let runtime_roles =
        fetch_runtime_roles_for_account_in_tx(&mut tx, row.tenant_id, row.account_id).await?;
    let (session_token, _session_id) = create_auth_session_in_tx(
        &mut tx,
        &state,
        row.account_id,
        row.tenant_id,
        row.person_id,
    )
    .await?;
    tx.commit().await?;

    let access_token =
        create_auth_access_token(&state, row.account_id, row.tenant_id, &runtime_roles)?;
    let response = AuthResponse {
        account_id: row.account_id,
        tenant_id: row.tenant_id,
        person_id: row.person_id,
        access_token: access_token.clone(),
        expires_in_seconds: state.cfg.auth.jwt_expiry_secs,
        runtime_roles,
    };
    json_with_auth_cookies(
        response,
        &session_token,
        &access_token,
        state.runtime_profile,
        state.cfg.auth.jwt_expiry_secs,
    )
}

async fn login_auth_code_handler(
    State(state): State<AppState>,
    Json(req): Json<AuthCodeLoginRequest>,
) -> Result<Response> {
    let pool = db_pool(&state)?;
    let channel = normalize_auth_channel(&req.channel)?;
    let destination = normalize_auth_destination(&channel, &req.destination)?;
    consume_verification_code(
        pool,
        &state,
        &channel,
        &destination,
        "login",
        &req.verification_code,
    )
    .await?;

    let row = fetch_account_tenant_for_destination(pool, &channel, &destination, req.tenant_id)
        .await?
        .ok_or_else(invalid_auth_code_credentials)?;
    let mut tx = pool.begin().await?;
    set_tenant_in_tx(&mut tx, row.tenant_id).await?;
    let runtime_roles =
        fetch_runtime_roles_for_account_in_tx(&mut tx, row.tenant_id, row.account_id).await?;
    let (session_token, _session_id) = create_auth_session_in_tx(
        &mut tx,
        &state,
        row.account_id,
        row.tenant_id,
        row.person_id,
    )
    .await?;
    tx.commit().await?;

    let access_token =
        create_auth_access_token(&state, row.account_id, row.tenant_id, &runtime_roles)?;
    let response = AuthResponse {
        account_id: row.account_id,
        tenant_id: row.tenant_id,
        person_id: row.person_id,
        access_token: access_token.clone(),
        expires_in_seconds: state.cfg.auth.jwt_expiry_secs,
        runtime_roles,
    };
    json_with_auth_cookies(
        response,
        &session_token,
        &access_token,
        state.runtime_profile,
        state.cfg.auth.jwt_expiry_secs,
    )
}

async fn reset_auth_password_handler(
    State(state): State<AppState>,
    Json(req): Json<AuthPasswordResetRequest>,
) -> Result<StatusCode> {
    let pool = db_pool(&state)?;
    let channel = normalize_auth_channel(&req.channel)?;
    let destination = normalize_auth_destination(&channel, &req.destination)?;
    validate_auth_password(&req.password)?;

    let account = fetch_account_tenant_for_destination(pool, &channel, &destination, None)
        .await?
        .ok_or_else(invalid_auth_code_credentials)?;
    consume_verification_code(
        pool,
        &state,
        &channel,
        &destination,
        "reset_password",
        &req.verification_code,
    )
    .await?;

    let password_hash = hash_auth_password(&state, &req.password)?;
    let mut tx = pool.begin().await?;
    sqlx::query(
        r#"
        INSERT INTO auth_password_credentials
            (account_id, password_hash, algorithm, params, password_changed_at)
        VALUES (
            $1, $2, 'argon2id',
            '{"m_cost_kib":65536,"t_cost":3,"p_cost":4,"pepper":"server_side"}'::jsonb,
            NOW()
        )
        ON CONFLICT (account_id) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            algorithm = EXCLUDED.algorithm,
            params = EXCLUDED.params,
            password_changed_at = NOW(),
            updated_at = NOW()
        "#,
    )
    .bind(account.account_id)
    .bind(&password_hash)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r"
        UPDATE auth_sessions
        SET revoked_at = NOW()
        WHERE account_id = $1
          AND revoked_at IS NULL
        ",
    )
    .bind(account.account_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn create_auth_qr_challenge_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<AuthQrCreateRequest>,
) -> Result<Json<AuthQrChallengeResponse>> {
    let pool = db_pool(&state)?;
    let account_type = normalize_oauth_account_type(req.account_type.as_deref())?;
    let return_to = normalize_oauth_return_to(req.return_to.as_deref())?;
    let frontend_base_url = frontend_base_url_from_headers(&headers, state.runtime_profile);
    let challenge_id = Uuid::new_v4();
    let scan_token = random_hex::<32>()?;
    let poll_token = random_hex::<32>()?;
    let scan_token_hash = auth_qr_scan_token_hash(&state, &scan_token)?;
    let poll_token_hash = auth_qr_poll_token_hash(&state, &poll_token)?;
    let expires_at = Utc::now() + chrono::Duration::seconds(AUTH_QR_LOGIN_TTL_SECS);

    sqlx::query(
        r"
        INSERT INTO auth_qr_login_challenges
            (id, scan_token_hash, poll_token_hash, account_type, return_to, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ",
    )
    .bind(challenge_id)
    .bind(&scan_token_hash)
    .bind(&poll_token_hash)
    .bind(&account_type)
    .bind(&return_to)
    .bind(expires_at)
    .execute(pool)
    .await?;

    Ok(Json(AuthQrChallengeResponse {
        challenge_id,
        qr_payload: auth_qr_scan_payload(&frontend_base_url, challenge_id, &scan_token)?,
        poll_token,
        status: "pending".to_owned(),
        expires_in_seconds: auth_qr_remaining_seconds(expires_at),
    }))
}

async fn poll_auth_qr_challenge_handler(
    State(state): State<AppState>,
    Path(challenge_id): Path<Uuid>,
    Query(query): Query<AuthQrPollQuery>,
) -> Result<Response> {
    let pool = db_pool(&state)?;
    let poll_token_hash = auth_qr_poll_token_hash(&state, &query.poll_token)?;
    let mut tx = pool.begin().await?;
    let mut row = sqlx::query_as::<_, AuthQrChallengeRow>(
        r"
        SELECT id AS challenge_id,
               status,
               account_id,
               tenant_id,
               person_id,
               expires_at
        FROM auth_qr_login_challenges
        WHERE id = $1 AND poll_token_hash = $2
        FOR UPDATE
        ",
    )
    .bind(challenge_id)
    .bind(&poll_token_hash)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| HarnessError::Unauthorized("invalid QR login challenge".to_owned()))?;

    if auth_qr_is_expired(&row) {
        row.status = expire_auth_qr_challenge_in_tx(&mut tx, row.challenge_id).await?;
    }

    if row.status != "approved" {
        let response = AuthQrPollResponse {
            challenge_id: row.challenge_id,
            status: row.status,
            expires_in_seconds: auth_qr_remaining_seconds(row.expires_at),
            auth: None,
        };
        tx.commit().await?;
        return Ok(Json(response).into_response());
    }

    let account_id = row
        .account_id
        .ok_or_else(|| HarnessError::Unauthorized("QR login has no approved account".to_owned()))?;
    let tenant_id = row
        .tenant_id
        .ok_or_else(|| HarnessError::Unauthorized("QR login has no approved tenant".to_owned()))?;
    set_tenant_in_tx(&mut tx, tenant_id).await?;
    let runtime_roles =
        fetch_runtime_roles_for_account_in_tx(&mut tx, tenant_id, account_id).await?;
    let (session_token, _session_id) =
        create_auth_session_in_tx(&mut tx, &state, account_id, tenant_id, row.person_id).await?;
    sqlx::query(
        r"
        UPDATE auth_qr_login_challenges
        SET status = 'consumed',
            consumed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        ",
    )
    .bind(row.challenge_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    let access_token = create_auth_access_token(&state, account_id, tenant_id, &runtime_roles)?;
    let auth = AuthResponse {
        account_id,
        tenant_id,
        person_id: row.person_id,
        access_token: access_token.clone(),
        expires_in_seconds: state.cfg.auth.jwt_expiry_secs,
        runtime_roles,
    };
    let response = AuthQrPollResponse {
        challenge_id: row.challenge_id,
        status: "approved".to_owned(),
        expires_in_seconds: auth_qr_remaining_seconds(row.expires_at),
        auth: Some(auth),
    };
    json_with_auth_cookies(
        response,
        &session_token,
        &access_token,
        state.runtime_profile,
        state.cfg.auth.jwt_expiry_secs,
    )
}

async fn scan_auth_qr_challenge_handler(
    State(state): State<AppState>,
    Path(challenge_id): Path<Uuid>,
    Json(req): Json<AuthQrTokenRequest>,
) -> Result<Json<AuthQrStatusResponse>> {
    let row = update_auth_qr_scan_status(&state, challenge_id, &req.scan_token, false).await?;
    Ok(Json(AuthQrStatusResponse {
        challenge_id: row.challenge_id,
        status: row.status,
        expires_in_seconds: auth_qr_remaining_seconds(row.expires_at),
    }))
}

async fn approve_auth_qr_challenge_handler(
    State(state): State<AppState>,
    Path(challenge_id): Path<Uuid>,
    headers: HeaderMap,
    Json(req): Json<AuthQrTokenRequest>,
) -> Result<Json<AuthQrStatusResponse>> {
    let claims = bearer_claims(&headers, &state.cfg)?.ok_or_else(|| {
        HarnessError::Unauthorized("scan approval requires signed-in device".to_owned())
    })?;
    let account_id = claims
        .sub
        .parse::<Uuid>()
        .map_err(|_| HarnessError::Unauthorized("auth subject is not an account id".to_owned()))?;
    let pool = db_pool(&state)?;
    let scan_token_hash = auth_qr_scan_token_hash(&state, &req.scan_token)?;
    let mut tx = pool.begin().await?;
    let mut row = sqlx::query_as::<_, AuthQrChallengeRow>(
        r"
        SELECT id AS challenge_id,
               status,
               account_id,
               tenant_id,
               person_id,
               expires_at
        FROM auth_qr_login_challenges
        WHERE id = $1 AND scan_token_hash = $2
        FOR UPDATE
        ",
    )
    .bind(challenge_id)
    .bind(&scan_token_hash)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| HarnessError::Unauthorized("invalid QR login challenge".to_owned()))?;

    if auth_qr_is_expired(&row) {
        row.status = expire_auth_qr_challenge_in_tx(&mut tx, row.challenge_id).await?;
        let response = AuthQrStatusResponse {
            challenge_id: row.challenge_id,
            status: row.status,
            expires_in_seconds: auth_qr_remaining_seconds(row.expires_at),
        };
        tx.commit().await?;
        return Ok(Json(response));
    }

    if !matches!(row.status.as_str(), "pending" | "scanned" | "approved") {
        let response = AuthQrStatusResponse {
            challenge_id: row.challenge_id,
            status: row.status,
            expires_in_seconds: auth_qr_remaining_seconds(row.expires_at),
        };
        tx.commit().await?;
        return Ok(Json(response));
    }

    let account_tenant = sqlx::query_as::<_, AuthAccountTenantRow>(
        r"
        SELECT account_id, tenant_id, person_id
        FROM auth_account_tenants
        WHERE account_id = $1
          AND tenant_id = $2
          AND status = 'active'
        LIMIT 1
        ",
    )
    .bind(account_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| HarnessError::Unauthorized("account is not active in this tenant".to_owned()))?;

    row = sqlx::query_as::<_, AuthQrChallengeRow>(
        r"
        UPDATE auth_qr_login_challenges
        SET status = 'approved',
            account_id = $2,
            tenant_id = $3,
            person_id = $4,
            approved_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id AS challenge_id,
                  status,
                  account_id,
                  tenant_id,
                  person_id,
                  expires_at
        ",
    )
    .bind(row.challenge_id)
    .bind(account_tenant.account_id)
    .bind(account_tenant.tenant_id)
    .bind(account_tenant.person_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(AuthQrStatusResponse {
        challenge_id: row.challenge_id,
        status: row.status,
        expires_in_seconds: auth_qr_remaining_seconds(row.expires_at),
    }))
}

async fn start_auth_oauth_handler(
    State(state): State<AppState>,
    Path(provider): Path<String>,
    Query(query): Query<AuthOAuthStartQuery>,
    headers: HeaderMap,
) -> Result<Redirect> {
    let pool = db_pool(&state)?;
    let provider = normalize_oauth_provider(&provider)?;
    let spec = oauth_provider_spec(&provider)?;
    let account_type = normalize_oauth_account_type(query.account_type.as_deref())?;
    let return_to = normalize_oauth_return_to(query.return_to.as_deref())?;
    let state_token = random_hex::<32>()?;
    let state_hash = oauth_state_hash(&state, &state_token)?;
    let code_verifier = spec
        .supports_pkce
        .then(random_oauth_code_verifier)
        .transpose()?;
    let redirect_url = match oauth_provider_config(&provider) {
        Ok(config) if provider == "wechat" && config.client_secret.is_none() => {
            if wechat_dev_oauth_enabled(state.runtime_profile) {
                wechat_dev_oauth_callback_url(&headers, state.runtime_profile, &state_token)?
            } else {
                return Err(wechat_oauth_missing_secret_error());
            }
        }
        Ok(config) => oauth_authorization_url(&config, &state_token, code_verifier.as_deref())?,
        Err(err) if should_use_wechat_dev_oauth(&provider, state.runtime_profile, &err) => {
            wechat_dev_oauth_callback_url(&headers, state.runtime_profile, &state_token)?
        }
        Err(err) => return Err(err),
    };
    let expires_at = Utc::now() + chrono::Duration::minutes(AUTH_OAUTH_STATE_TTL_MINUTES);

    sqlx::query(
        r"
        INSERT INTO auth_oauth_states
            (provider, state_hash, account_type, return_to, code_verifier, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ",
    )
    .bind(&provider)
    .bind(&state_hash)
    .bind(&account_type)
    .bind(&return_to)
    .bind(&code_verifier)
    .bind(expires_at)
    .execute(pool)
    .await?;

    Ok(Redirect::temporary(redirect_url.as_str()))
}

async fn callback_auth_oauth_handler(
    State(state): State<AppState>,
    Path(provider): Path<String>,
    Query(query): Query<AuthOAuthCallbackQuery>,
    headers: HeaderMap,
) -> Result<Response> {
    let provider = normalize_oauth_provider(&provider)?;
    if let Some(error) = query.error.as_deref() {
        let message = query
            .error_description
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(error);
        return Ok(Redirect::temporary(&auth_error_redirect_from_headers(
            &headers,
            state.runtime_profile,
            &provider,
            message,
        ))
        .into_response());
    }

    let code = query
        .code
        .or(query.auth_code)
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| HarnessError::InvalidInput("OAuth callback missing code".to_owned()))?;
    let state_token = query
        .state
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| HarnessError::InvalidInput("OAuth callback missing state".to_owned()))?;
    let state_hash = oauth_state_hash(&state, &state_token)?;
    let pool = db_pool(&state)?;
    let oauth_state = sqlx::query_as::<_, AuthOAuthStateRow>(
        r"
        UPDATE auth_oauth_states
        SET consumed_at = NOW()
        WHERE id = (
            SELECT id
            FROM auth_oauth_states
            WHERE provider = $1
              AND state_hash = $2
              AND consumed_at IS NULL
              AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
        )
        RETURNING account_type, return_to, code_verifier
        ",
    )
    .bind(&provider)
    .bind(&state_hash)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| HarnessError::Unauthorized("invalid or expired OAuth state".to_owned()))?;

    let profile = exchange_oauth_code_for_profile(
        &state,
        &provider,
        &code,
        oauth_state.code_verifier.as_deref(),
    )
    .await?;
    let auth = login_or_create_oauth_account(&state, &provider, &oauth_state.account_type, profile)
        .await?;

    let redirect_to = frontend_redirect_url_from_headers(
        &headers,
        state.runtime_profile,
        &oauth_state.return_to,
    )?;
    redirect_with_auth_cookies(
        &redirect_to,
        &auth.session_token,
        &auth.access_token,
        state.runtime_profile,
        state.cfg.auth.jwt_expiry_secs,
    )
}

async fn logout_auth_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response> {
    if let (Some(token), Some(pool)) = (
        session_token_from_headers(&headers),
        state.db_pool.as_deref(),
    ) {
        let token_hash = session_token_hash(&state, &token)?;
        sqlx::query(
            r"
            UPDATE auth_sessions
            SET revoked_at = COALESCE(revoked_at, NOW())
            WHERE token_hash = $1
            ",
        )
        .bind(token_hash)
        .execute(pool)
        .await?;
    }
    let mut response = Json(AuthLogoutResponse { logged_out: true }).into_response();
    response.headers_mut().append(
        SET_COOKIE,
        HeaderValue::from_str(&expired_session_cookie(state.runtime_profile))
            .map_err(|err| HarnessError::Internal(format!("invalid session cookie: {err}")))?,
    );
    response.headers_mut().append(
        SET_COOKIE,
        HeaderValue::from_str(&expired_access_cookie(state.runtime_profile))
            .map_err(|err| HarnessError::Internal(format!("invalid access cookie: {err}")))?,
    );
    Ok(response)
}

async fn me_auth_handler(State(state): State<AppState>, headers: HeaderMap) -> Result<Response> {
    let pool = db_pool(&state)?;
    let claims = bearer_claims(&headers, &state.cfg)?.ok_or_else(|| {
        HarnessError::Unauthorized("Authorization bearer token is required".into())
    })?;
    let account_id = claims
        .sub
        .parse::<Uuid>()
        .map_err(|_| HarnessError::Unauthorized("auth subject is not an account id".into()))?;
    let mut tx = pool.begin().await?;
    set_tenant_in_tx(&mut tx, claims.tenant_id).await?;
    let row = sqlx::query_as::<_, AuthMeRow>(
        r"
        SELECT a.id AS account_id,
               $2 AS tenant_id,
               p.id AS person_id,
               a.primary_email AS email,
               a.primary_phone AS phone,
               p.full_name,
               p.display_name
        FROM auth_accounts a
        LEFT JOIN iam_person_profiles p
          ON p.account_id = a.id AND p.tenant_id = $2
        WHERE a.id = $1
        LIMIT 1
        ",
    )
    .bind(account_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("account_id={account_id}")))?;
    let runtime_roles =
        fetch_runtime_roles_for_account_in_tx(&mut tx, claims.tenant_id, account_id).await?;
    let job_titles =
        fetch_job_titles_for_person_in_tx(&mut tx, claims.tenant_id, row.person_id).await?;
    tx.commit().await?;

    Ok(Json(AuthMeResponse {
        account_id: row.account_id.to_string(),
        tenant_id: row.tenant_id,
        person_id: row.person_id,
        email: row.email,
        phone: row.phone,
        full_name: row.full_name,
        display_name: row.display_name,
        runtime_roles,
        job_titles,
    })
    .into_response())
}

async fn get_iam_summary_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
) -> Result<Json<IamSummaryResponse>> {
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::RegistryRead)?;
    let pool = db_pool(&state)?;
    let tenant_id = context_tenant_uuid(&context)?;
    let mut tx = begin_tenant_tx(pool, &context).await?;
    ensure_default_iam_roles_in_tx(&mut tx, tenant_id).await?;
    let summary = load_iam_summary_in_tx(&mut tx, tenant_id).await?;
    tx.commit().await?;
    Ok(Json(summary))
}

async fn create_iam_role_binding_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<IamCreateRoleBindingRequest>,
) -> Result<Json<IamRoleBindingRow>> {
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    ensure_iam_admin_context(&context)?;
    let pool = db_pool(&state)?;
    let tenant_id = context_tenant_uuid(&context)?;
    let mut tx = begin_tenant_tx(pool, &context).await?;
    ensure_default_iam_roles_in_tx(&mut tx, tenant_id).await?;

    let role_id = resolve_iam_role_id_in_tx(&mut tx, tenant_id, req.role_id, req.role_key).await?;
    let principal_type = normalize_iam_principal_type(&req.principal_type)?;
    ensure_iam_principal_exists_in_tx(&mut tx, tenant_id, &principal_type, req.principal_id)
        .await?;
    let resource_type = normalize_iam_resource_type(req.resource_type)?;
    let granted_by = context.actor.parse::<Uuid>().ok();

    let existing_id = sqlx::query_scalar::<_, Uuid>(
        r"
        SELECT id
        FROM iam_role_bindings
        WHERE tenant_id = $1
          AND role_id = $2
          AND principal_type = $3
          AND principal_id = $4
          AND resource_type = $5
          AND (
              ($6::uuid IS NULL AND resource_id IS NULL)
              OR resource_id = $6
          )
        ORDER BY created_at DESC
        LIMIT 1
        ",
    )
    .bind(tenant_id)
    .bind(role_id)
    .bind(&principal_type)
    .bind(req.principal_id)
    .bind(&resource_type)
    .bind(req.resource_id)
    .fetch_optional(&mut *tx)
    .await?;

    let binding_id = if let Some(existing_id) = existing_id {
        sqlx::query_scalar::<_, Uuid>(
            r"
            UPDATE iam_role_bindings
            SET expires_at = $2,
                granted_by = COALESCE($3, granted_by)
            WHERE id = $1
            RETURNING id
            ",
        )
        .bind(existing_id)
        .bind(req.expires_at)
        .bind(granted_by)
        .fetch_one(&mut *tx)
        .await?
    } else {
        sqlx::query_scalar::<_, Uuid>(
            r"
            INSERT INTO iam_role_bindings
                (tenant_id, role_id, principal_type, principal_id, resource_type, resource_id, expires_at, granted_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
            ",
        )
        .bind(tenant_id)
        .bind(role_id)
        .bind(&principal_type)
        .bind(req.principal_id)
        .bind(&resource_type)
        .bind(req.resource_id)
        .bind(req.expires_at)
        .bind(granted_by)
        .fetch_one(&mut *tx)
        .await?
    };

    let binding = fetch_iam_role_binding_by_id_in_tx(&mut tx, tenant_id, binding_id).await?;
    tx.commit().await?;
    Ok(Json(binding))
}

async fn delete_iam_role_binding_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(binding_id): Path<Uuid>,
) -> Result<StatusCode> {
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    ensure_iam_admin_context(&context)?;
    let pool = db_pool(&state)?;
    let tenant_id = context_tenant_uuid(&context)?;
    let mut tx = begin_tenant_tx(pool, &context).await?;
    let deleted = sqlx::query_scalar::<_, Uuid>(
        r"
        DELETE FROM iam_role_bindings
        WHERE id = $1 AND tenant_id = $2
        RETURNING id
        ",
    )
    .bind(binding_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    if deleted.is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(HarnessError::NotFound(format!(
            "role_binding_id={binding_id}"
        )))
    }
}

async fn decide_iam_permission_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<IamPermissionDecisionRequest>,
) -> Result<Json<IamPermissionDecisionResponse>> {
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::RegistryRead)?;
    let pool = db_pool(&state)?;
    let tenant_id = context_tenant_uuid(&context)?;
    let principal_type =
        normalize_iam_principal_type(req.principal_type.as_deref().unwrap_or("account"))?;
    let resource_type = req
        .resource_type
        .as_ref()
        .map(|value| normalize_iam_resource_type(Some(value.clone())))
        .transpose()?;
    let mut tx = begin_tenant_tx(pool, &context).await?;

    let permission_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM iam_permissions WHERE id = $1)",
    )
    .bind(&req.permission_id)
    .fetch_one(&mut *tx)
    .await?;
    if !permission_exists {
        return Err(HarnessError::InvalidInput(format!(
            "unknown permission_id: {}",
            req.permission_id
        )));
    }

    let matched_roles = sqlx::query_scalar::<_, String>(
        r"
        SELECT DISTINCT r.role_key
        FROM iam_role_bindings rb
        JOIN iam_roles r ON r.id = rb.role_id AND r.tenant_id = rb.tenant_id
        JOIN iam_role_permissions rp ON rp.role_id = r.id
        WHERE rb.tenant_id = $1
          AND rb.principal_type = $2
          AND rb.principal_id = $3
          AND rp.permission_id = $4
          AND rb.starts_at <= NOW()
          AND (rb.expires_at IS NULL OR rb.expires_at > NOW())
          AND ($5::text IS NULL OR rb.resource_type = 'tenant' OR rb.resource_type = $5)
          AND ($6::uuid IS NULL OR rb.resource_id IS NULL OR rb.resource_id = $6)
        ORDER BY r.role_key
        ",
    )
    .bind(tenant_id)
    .bind(&principal_type)
    .bind(req.principal_id)
    .bind(&req.permission_id)
    .bind(resource_type.as_deref())
    .bind(req.resource_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let allowed = !matched_roles.is_empty();
    let reason = if allowed {
        format!(
            "permission {} allowed by {}",
            req.permission_id,
            matched_roles.join(", ")
        )
    } else {
        format!(
            "permission {} denied for {} {}",
            req.permission_id, principal_type, req.principal_id
        )
    };
    Ok(Json(IamPermissionDecisionResponse {
        allowed,
        permission_id: req.permission_id,
        principal_type,
        principal_id: req.principal_id,
        resource_type,
        resource_id: req.resource_id,
        matched_roles,
        reason,
    }))
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

async fn get_sjg157_standard_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
) -> Result<Json<SemanticDictionaryStandard>> {
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::RegistryRead)?;
    let Some(pool) = state.db_pool.as_deref() else {
        return Ok(Json(sjg157_fallback_standard()));
    };
    fetch_sjg157_standard(pool).await.map(Json)
}

async fn list_sjg157_categories_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<SemanticCategoryQuery>,
) -> Result<Json<SemanticCategoryListResponse>> {
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::RegistryRead)?;
    let limit = query.bounded_limit();
    let offset = query.bounded_offset();
    let Some(pool) = state.db_pool.as_deref() else {
        let standard = sjg157_fallback_standard();
        return Ok(Json(SemanticCategoryListResponse {
            standard,
            items: Vec::new(),
            total: 0,
            limit,
            offset,
        }));
    };
    let standard = fetch_sjg157_standard(pool).await?;
    let q = query.normalized_query();
    let object_group = query
        .object_group
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let table_code = query
        .table_code
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let ifc_entity = query
        .ifc_entity
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let total = sqlx::query_scalar::<_, i64>(
        r"
        SELECT count(*)
        FROM semantic_dictionary_categories c
        WHERE c.standard_id = $1
          AND ($2::text IS NULL OR c.object_group = $2)
          AND ($3::text IS NULL OR c.table_code = $3)
          AND ($4::text IS NULL OR c.ifc_entity = $4)
          AND ($5::int2 IS NULL OR c.level_num = $5)
          AND (
            $6::text IS NULL
            OR c.code ILIKE '%' || $6 || '%'
            OR c.name_zh ILIKE '%' || $6 || '%'
            OR c.ifc_entity ILIKE '%' || $6 || '%'
            OR c.raw_text ILIKE '%' || $6 || '%'
          )
        ",
    )
    .bind(SJG157_STANDARD_ID)
    .bind(object_group)
    .bind(table_code)
    .bind(ifc_entity)
    .bind(query.level)
    .bind(q.as_deref())
    .fetch_one(pool)
    .await?;

    let items = sqlx::query_as::<_, SemanticDictionaryCategory>(
        r"
        SELECT c.code,
               c.table_code,
               c.object_group,
               c.level_num,
               c.level_name,
               c.parent_code,
               parent.name_zh AS parent_name_zh,
               c.name_zh,
               c.rdf_identifier,
               c.rdf_uri,
               c.ifc_entity,
               c.ifc_mapping_raw,
               c.terminology_raw,
               c.remark,
               c.source_line
        FROM semantic_dictionary_categories c
        LEFT JOIN semantic_dictionary_categories parent
          ON parent.standard_id = c.standard_id
         AND parent.code = c.parent_code
        WHERE c.standard_id = $1
          AND ($2::text IS NULL OR c.object_group = $2)
          AND ($3::text IS NULL OR c.table_code = $3)
          AND ($4::text IS NULL OR c.ifc_entity = $4)
          AND ($5::int2 IS NULL OR c.level_num = $5)
          AND (
            $6::text IS NULL
            OR c.code ILIKE '%' || $6 || '%'
            OR c.name_zh ILIKE '%' || $6 || '%'
            OR c.ifc_entity ILIKE '%' || $6 || '%'
            OR c.raw_text ILIKE '%' || $6 || '%'
          )
        ORDER BY c.table_code ASC, c.code ASC
        LIMIT $7 OFFSET $8
        ",
    )
    .bind(SJG157_STANDARD_ID)
    .bind(object_group)
    .bind(table_code)
    .bind(ifc_entity)
    .bind(query.level)
    .bind(q.as_deref())
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(Json(SemanticCategoryListResponse {
        standard,
        items,
        total,
        limit,
        offset,
    }))
}

async fn get_sjg157_category_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(code): Path<String>,
) -> Result<Json<SemanticDictionaryCategory>> {
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    PermissionGuard::ensure(&context, RuntimePermission::RegistryRead)?;
    let pool = db_pool(&state)?;
    let category = sqlx::query_as::<_, SemanticDictionaryCategory>(
        r"
        SELECT c.code,
               c.table_code,
               c.object_group,
               c.level_num,
               c.level_name,
               c.parent_code,
               parent.name_zh AS parent_name_zh,
               c.name_zh,
               c.rdf_identifier,
               c.rdf_uri,
               c.ifc_entity,
               c.ifc_mapping_raw,
               c.terminology_raw,
               c.remark,
               c.source_line
        FROM semantic_dictionary_categories c
        LEFT JOIN semantic_dictionary_categories parent
          ON parent.standard_id = c.standard_id
         AND parent.code = c.parent_code
        WHERE c.standard_id = $1 AND c.code = $2
        ",
    )
    .bind(SJG157_STANDARD_ID)
    .bind(code.trim())
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("SJG 157 category code={code}")))?;
    Ok(Json(category))
}

async fn fetch_sjg157_standard(pool: &PgPool) -> Result<SemanticDictionaryStandard> {
    let standard = sqlx::query_as::<_, SemanticDictionaryStandard>(
        r"
        SELECT id,
               standard_code,
               title_zh,
               title_en,
               jurisdiction,
               source_authority,
               published_on,
               effective_on,
               digital_representation,
               namespace_prefix,
               namespace_uri,
               source_file_name,
               source_sha256,
               ingestion_status,
               metadata,
               updated_at
        FROM semantic_dictionary_standards
        WHERE id = $1
        ",
    )
    .bind(SJG157_STANDARD_ID)
    .fetch_optional(pool)
    .await?;
    Ok(standard.unwrap_or_else(sjg157_fallback_standard))
}

async fn get_ai_center_management_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
) -> Result<Json<AiCenterManagementResponse>> {
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
    ensure_ai_center_management_defaults_in_tx(&mut tx, tenant_id).await?;
    let response = fetch_ai_center_management_response_in_tx(&mut tx, tenant_id).await?;
    tx.commit().await?;
    Ok(Json(response))
}

async fn get_ai_center_interface_contract_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(contract_key): Path<String>,
) -> Result<Json<AiCenterInterfaceContract>> {
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
    ensure_ai_center_management_defaults_in_tx(&mut tx, tenant_id).await?;
    let item = fetch_ai_center_interface_contract_in_tx(&mut tx, tenant_id, &contract_key).await?;
    tx.commit().await?;
    Ok(Json(item))
}

async fn update_ai_center_interface_contract_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(contract_key): Path<String>,
    Json(req): Json<AiCenterManagementUpdateRequest>,
) -> Result<Json<AiCenterInterfaceContract>> {
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    ensure_ai_center_management_update_permission(&context, &req)?;
    let status = req.normalized_status()?;
    let metadata = req.metadata_patch();
    let tenant_id = context_tenant_uuid(&context)?;
    let pool = db_pool(&state)?;
    let mut tx = begin_tenant_tx(pool, &context).await?;
    ensure_ai_center_management_defaults_in_tx(&mut tx, tenant_id).await?;
    let item = sqlx::query_as::<_, AiCenterInterfaceContract>(
        r"
        UPDATE ai_center_interface_contracts
        SET status = COALESCE($3, status),
            metadata = metadata || $4,
            updated_at = NOW()
        WHERE tenant_id = $1 AND contract_key = $2
        RETURNING id, tenant_id, module_id, contract_key, name, method, path, boundary,
                  auth_policy, data_object, owner_role, status, metadata, updated_at
        ",
    )
    .bind(tenant_id)
    .bind(contract_key.trim())
    .bind(status)
    .bind(metadata)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("AI interface contract={contract_key}")))?;
    tx.commit().await?;
    Ok(Json(item))
}

async fn get_ai_center_database_binding_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(binding_key): Path<String>,
) -> Result<Json<AiCenterDatabaseBinding>> {
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
    ensure_ai_center_management_defaults_in_tx(&mut tx, tenant_id).await?;
    let item = fetch_ai_center_database_binding_in_tx(&mut tx, tenant_id, &binding_key).await?;
    tx.commit().await?;
    Ok(Json(item))
}

async fn update_ai_center_database_binding_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(binding_key): Path<String>,
    Json(req): Json<AiCenterManagementUpdateRequest>,
) -> Result<Json<AiCenterDatabaseBinding>> {
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    ensure_ai_center_management_update_permission(&context, &req)?;
    let status = req.normalized_status()?;
    let metadata = req.metadata_patch();
    let tenant_id = context_tenant_uuid(&context)?;
    let pool = db_pool(&state)?;
    let mut tx = begin_tenant_tx(pool, &context).await?;
    ensure_ai_center_management_defaults_in_tx(&mut tx, tenant_id).await?;
    let item = sqlx::query_as::<_, AiCenterDatabaseBinding>(
        r"
        UPDATE ai_center_database_bindings
        SET status = COALESCE($3, status),
            metadata = metadata || $4,
            updated_at = NOW()
        WHERE tenant_id = $1 AND binding_key = $2
        RETURNING id, tenant_id, module_id, binding_key, name, object_name, storage_adapter,
                  lifecycle_policy, rls_policy, owner_role, status, metadata, updated_at
        ",
    )
    .bind(tenant_id)
    .bind(binding_key.trim())
    .bind(status)
    .bind(metadata)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("AI database binding={binding_key}")))?;
    tx.commit().await?;
    Ok(Json(item))
}

async fn get_ai_center_visualization_panel_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(panel_key): Path<String>,
) -> Result<Json<AiCenterVisualizationPanel>> {
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
    ensure_ai_center_management_defaults_in_tx(&mut tx, tenant_id).await?;
    let item = fetch_ai_center_visualization_panel_in_tx(&mut tx, tenant_id, &panel_key).await?;
    tx.commit().await?;
    Ok(Json(item))
}

async fn update_ai_center_visualization_panel_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(panel_key): Path<String>,
    Json(req): Json<AiCenterManagementUpdateRequest>,
) -> Result<Json<AiCenterVisualizationPanel>> {
    let context = tenant_scope_request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    ensure_ai_center_management_update_permission(&context, &req)?;
    let status = req.normalized_status()?;
    let metadata = req.metadata_patch();
    let tenant_id = context_tenant_uuid(&context)?;
    let pool = db_pool(&state)?;
    let mut tx = begin_tenant_tx(pool, &context).await?;
    ensure_ai_center_management_defaults_in_tx(&mut tx, tenant_id).await?;
    let item = sqlx::query_as::<_, AiCenterVisualizationPanel>(
        r"
        UPDATE ai_center_visualization_panels
        SET status = COALESCE($3, status),
            metadata = metadata || $4,
            updated_at = NOW()
        WHERE tenant_id = $1 AND panel_key = $2
        RETURNING id, tenant_id, module_id, panel_key, name, dataset, view_mode,
                  refresh_policy, readiness, owner_role, status, metadata, updated_at
        ",
    )
    .bind(tenant_id)
    .bind(panel_key.trim())
    .bind(status)
    .bind(metadata)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("AI visualization panel={panel_key}")))?;
    tx.commit().await?;
    Ok(Json(item))
}

fn ensure_ai_center_management_update_permission(
    context: &RequestContext,
    req: &AiCenterManagementUpdateRequest,
) -> Result<()> {
    let status = req.normalized_status()?;
    if matches!(status.as_deref(), Some("approved")) {
        PermissionGuard::ensure(context, RuntimePermission::RegistryApprove)?;
    } else {
        PermissionGuard::ensure(context, RuntimePermission::RegistryWrite)?;
    }
    Ok(())
}

async fn ensure_ai_center_management_defaults_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<()> {
    for item in [
        (
            "harness-invoke",
            "Harness AI 调用入口",
            "POST",
            "/v1/harness/invoke",
            "业务模块通过 Router 统一发起 AI 任务",
            "租户上下文 + generation:create 权限",
            "agent_invocations",
            "AI 平台工程师",
            "configured",
        ),
        (
            "runtime-executions",
            "运行时执行队列",
            "POST",
            "/v1/runtime/executions",
            "Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver 链路",
            "租户上下文 + generation:create/approve 权限",
            "runtime_executions",
            "Agent 架构师",
            "configured",
        ),
        (
            "panai-chat",
            "PanAI 自动化会话",
            "POST",
            "/api/ai/panai/chat",
            "PanAI 直接控制 ArchIToken 业务动作与人工确认",
            "PanAI Host Bridge + 后端网关回退",
            "panai_jobs",
            "自动化管理员",
            "review",
        ),
        (
            "rag-catalog",
            "RAG 知识库索引",
            "GET",
            "/v1/knowledge-sources",
            "规范、合同、图纸和项目文档检索",
            "租户上下文 + registry:read 权限",
            "rag_collections",
            "知识库管理员",
            "configured",
        ),
        (
            "mcp-tool-registry",
            "MCP 工具注册表",
            "GET",
            "/v1/mcp-tools",
            "文件、BIM、数据库、造价、审批工具授权",
            "租户上下文 + registry:read/write 权限",
            "mcp_tools",
            "集成工程师",
            "configured",
        ),
    ] {
        sqlx::query(
            r"
            INSERT INTO ai_center_interface_contracts (
                tenant_id, contract_key, name, method, path, boundary, auth_policy,
                data_object, owner_role, status, metadata
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,jsonb_build_object('seededBy','gateway'))
            ON CONFLICT (tenant_id, contract_key) DO NOTHING
            ",
        )
        .bind(tenant_id)
        .bind(item.0)
        .bind(item.1)
        .bind(item.2)
        .bind(item.3)
        .bind(item.4)
        .bind(item.5)
        .bind(item.6)
        .bind(item.7)
        .bind(item.8)
        .execute(&mut **tx)
        .await?;
    }

    for item in [
        (
            "agent-invocations",
            "模型调用账本",
            "agent_invocations",
            "PostgreSQL + 审计事件",
            "任务提交、响应、失败原因和人工确认",
            "tenant_id = current_tenant()",
            "AI 平台工程师",
            "configured",
        ),
        (
            "runtime-executions",
            "运行时执行记录",
            "runtime_executions",
            "PostgreSQL + 队列状态",
            "编排链路、审批状态、回滚证据",
            "tenant_id = current_tenant()",
            "Agent 架构师",
            "configured",
        ),
        (
            "rag-sources",
            "知识库来源",
            "knowledge_sources / rag_collections",
            "PostgreSQL + 向量索引引用",
            "语料版本、来源文件、索引批次",
            "tenant_id = current_tenant()",
            "知识库管理员",
            "review",
        ),
        (
            "mcp-tools",
            "工具权限注册",
            "mcp_tools / tool_permissions",
            "PostgreSQL + RLS",
            "工具 schema、权限边界、调用审计",
            "tenant_id = current_tenant()",
            "集成工程师",
            "review",
        ),
        (
            "ai-cost-events",
            "成本与配额事件",
            "ai_cost_events / cost_policies",
            "PostgreSQL + FinOps 汇总",
            "租户、项目、模块、模型和预算策略",
            "tenant_id = current_tenant()",
            "FinOps 负责人",
            "draft",
        ),
    ] {
        sqlx::query(
            r"
            INSERT INTO ai_center_database_bindings (
                tenant_id, binding_key, name, object_name, storage_adapter, lifecycle_policy,
                rls_policy, owner_role, status, metadata
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,jsonb_build_object('seededBy','gateway'))
            ON CONFLICT (tenant_id, binding_key) DO NOTHING
            ",
        )
        .bind(tenant_id)
        .bind(item.0)
        .bind(item.1)
        .bind(item.2)
        .bind(item.3)
        .bind(item.4)
        .bind(item.5)
        .bind(item.6)
        .bind(item.7)
        .execute(&mut **tx)
        .await?;
    }

    for item in [
        (
            "router-topology",
            "模型路由拓扑",
            "model_providers + agent_invocations",
            "拓扑图",
            "配置变更后刷新",
            100_i32,
            "AI 平台工程师",
            "configured",
        ),
        (
            "rag-observability",
            "RAG 检索面板",
            "knowledge_sources + rag_collections",
            "检索质量看板",
            "索引批次刷新",
            64_i32,
            "知识库管理员",
            "review",
        ),
        (
            "tool-call-audit",
            "MCP 工具调用审计",
            "mcp_tools + tool_permissions",
            "权限矩阵",
            "调用事件刷新",
            72_i32,
            "安全审计员",
            "review",
        ),
        (
            "cost-control",
            "成本与配额治理",
            "ai_cost_events + cost_policies",
            "预算燃尽图",
            "账本汇总刷新",
            36_i32,
            "FinOps 负责人",
            "draft",
        ),
    ] {
        sqlx::query(
            r"
            INSERT INTO ai_center_visualization_panels (
                tenant_id, panel_key, name, dataset, view_mode, refresh_policy,
                readiness, owner_role, status, metadata
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,jsonb_build_object('seededBy','gateway'))
            ON CONFLICT (tenant_id, panel_key) DO NOTHING
            ",
        )
        .bind(tenant_id)
        .bind(item.0)
        .bind(item.1)
        .bind(item.2)
        .bind(item.3)
        .bind(item.4)
        .bind(item.5)
        .bind(item.6)
        .bind(item.7)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

async fn fetch_ai_center_management_response_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<AiCenterManagementResponse> {
    let interface_contracts = sqlx::query_as::<_, AiCenterInterfaceContract>(
        r"
        SELECT id, tenant_id, module_id, contract_key, name, method, path, boundary,
               auth_policy, data_object, owner_role, status, metadata, updated_at
        FROM ai_center_interface_contracts
        WHERE tenant_id = $1
        ORDER BY updated_at DESC, contract_key ASC
        ",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    let database_bindings = sqlx::query_as::<_, AiCenterDatabaseBinding>(
        r"
        SELECT id, tenant_id, module_id, binding_key, name, object_name, storage_adapter,
               lifecycle_policy, rls_policy, owner_role, status, metadata, updated_at
        FROM ai_center_database_bindings
        WHERE tenant_id = $1
        ORDER BY updated_at DESC, binding_key ASC
        ",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    let visualization_panels = sqlx::query_as::<_, AiCenterVisualizationPanel>(
        r"
        SELECT id, tenant_id, module_id, panel_key, name, dataset, view_mode,
               refresh_policy, readiness, owner_role, status, metadata, updated_at
        FROM ai_center_visualization_panels
        WHERE tenant_id = $1
        ORDER BY updated_at DESC, panel_key ASC
        ",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    Ok(AiCenterManagementResponse {
        interface_contracts,
        database_bindings,
        visualization_panels,
    })
}

async fn fetch_ai_center_interface_contract_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    contract_key: &str,
) -> Result<AiCenterInterfaceContract> {
    sqlx::query_as::<_, AiCenterInterfaceContract>(
        r"
        SELECT id, tenant_id, module_id, contract_key, name, method, path, boundary,
               auth_policy, data_object, owner_role, status, metadata, updated_at
        FROM ai_center_interface_contracts
        WHERE tenant_id = $1 AND contract_key = $2
        ",
    )
    .bind(tenant_id)
    .bind(contract_key.trim())
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("AI interface contract={contract_key}")))
}

async fn fetch_ai_center_database_binding_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    binding_key: &str,
) -> Result<AiCenterDatabaseBinding> {
    sqlx::query_as::<_, AiCenterDatabaseBinding>(
        r"
        SELECT id, tenant_id, module_id, binding_key, name, object_name, storage_adapter,
               lifecycle_policy, rls_policy, owner_role, status, metadata, updated_at
        FROM ai_center_database_bindings
        WHERE tenant_id = $1 AND binding_key = $2
        ",
    )
    .bind(tenant_id)
    .bind(binding_key.trim())
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("AI database binding={binding_key}")))
}

async fn fetch_ai_center_visualization_panel_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    panel_key: &str,
) -> Result<AiCenterVisualizationPanel> {
    sqlx::query_as::<_, AiCenterVisualizationPanel>(
        r"
        SELECT id, tenant_id, module_id, panel_key, name, dataset, view_mode,
               refresh_policy, readiness, owner_role, status, metadata, updated_at
        FROM ai_center_visualization_panels
        WHERE tenant_id = $1 AND panel_key = $2
        ",
    )
    .bind(tenant_id)
    .bind(panel_key.trim())
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("AI visualization panel={panel_key}")))
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

async fn get_quantity_costing_overview_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(project_id): Path<Uuid>,
) -> Result<Json<QuantityCostingOverviewRecord>> {
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
    let overview = sqlx::query_as::<_, QuantityCostingOverviewRecord>(
        r"
        WITH latest_review AS (
            SELECT status, output_state, updated_at
            FROM cost_review_versions
            WHERE tenant_id = $2 AND project_id = $1
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
        ),
        boq AS (
            SELECT
                COALESCE(sum(submitted_total), 0)::float8 AS submitted_total,
                COALESCE(sum(approved_total), 0)::float8 AS approved_total,
                COALESCE(sum(amount_delta), 0)::float8 AS amount_delta,
                COALESCE(sum(increase_amount), 0)::float8 AS increase_amount,
                COALESCE(sum(decrease_amount), 0)::float8 AS decrease_amount
            FROM cost_boq_items
            WHERE tenant_id = $2 AND project_id = $1
        ),
        measure_items AS (
            SELECT
                COALESCE(sum(submitted_amount), 0)::float8 AS submitted_total,
                COALESCE(sum(approved_amount), 0)::float8 AS approved_total,
                COALESCE(sum(amount_delta), 0)::float8 AS amount_delta,
                COALESCE(sum(GREATEST(amount_delta, 0)), 0)::float8 AS increase_amount,
                COALESCE(sum(GREATEST(-amount_delta, 0)), 0)::float8 AS decrease_amount
            FROM cost_measure_items
            WHERE tenant_id = $2 AND project_id = $1
        ),
        other_items AS (
            SELECT
                COALESCE(sum(submitted_amount), 0)::float8 AS submitted_total,
                COALESCE(sum(approved_amount), 0)::float8 AS approved_total,
                COALESCE(sum(amount_delta), 0)::float8 AS amount_delta,
                COALESCE(sum(GREATEST(amount_delta, 0)), 0)::float8 AS increase_amount,
                COALESCE(sum(GREATEST(-amount_delta, 0)), 0)::float8 AS decrease_amount
            FROM cost_other_items
            WHERE tenant_id = $2 AND project_id = $1
        ),
        fee_items AS (
            SELECT
                COALESCE(sum(submitted_amount), 0)::float8 AS submitted_total,
                COALESCE(sum(approved_amount), 0)::float8 AS approved_total,
                COALESCE(sum(amount_delta), 0)::float8 AS amount_delta,
                COALESCE(sum(GREATEST(amount_delta, 0)), 0)::float8 AS increase_amount,
                COALESCE(sum(GREATEST(-amount_delta, 0)), 0)::float8 AS decrease_amount
            FROM cost_fee_summary_items
            WHERE tenant_id = $2 AND project_id = $1
        )
        SELECT
            $1::uuid AS project_id,
            (SELECT count(*) FROM cost_projects WHERE tenant_id = $2 AND project_id = $1) AS cost_project_count,
            (SELECT count(*) FROM cost_review_versions WHERE tenant_id = $2 AND project_id = $1) AS review_version_count,
            (SELECT count(*) FROM cost_boq_items WHERE tenant_id = $2 AND project_id = $1) AS boq_item_count,
            (SELECT count(*) FROM cost_measure_items WHERE tenant_id = $2 AND project_id = $1) AS measure_item_count,
            (SELECT count(*) FROM cost_other_items WHERE tenant_id = $2 AND project_id = $1) AS other_item_count,
            (SELECT count(*) FROM cost_fee_summary_items WHERE tenant_id = $2 AND project_id = $1) AS fee_item_count,
            (SELECT count(*) FROM cost_review_reports WHERE tenant_id = $2 AND project_id = $1) AS report_count,
            boq.submitted_total AS boq_submitted_total,
            boq.approved_total AS boq_approved_total,
            boq.amount_delta AS boq_amount_delta,
            measure_items.submitted_total AS measure_submitted_total,
            measure_items.approved_total AS measure_approved_total,
            measure_items.amount_delta AS measure_amount_delta,
            other_items.submitted_total AS other_submitted_total,
            other_items.approved_total AS other_approved_total,
            other_items.amount_delta AS other_amount_delta,
            fee_items.submitted_total AS fee_submitted_total,
            fee_items.approved_total AS fee_approved_total,
            fee_items.amount_delta AS fee_amount_delta,
            (boq.increase_amount + measure_items.increase_amount + other_items.increase_amount + fee_items.increase_amount)::float8 AS increase_amount,
            (boq.decrease_amount + measure_items.decrease_amount + other_items.decrease_amount + fee_items.decrease_amount)::float8 AS decrease_amount,
            (
                (SELECT count(*) FROM cost_boq_items WHERE tenant_id = $2 AND project_id = $1 AND source_review_required)
                + (SELECT count(*) FROM cost_measure_items WHERE tenant_id = $2 AND project_id = $1 AND source_review_required)
                + (SELECT count(*) FROM cost_other_items WHERE tenant_id = $2 AND project_id = $1 AND source_review_required)
                + (SELECT count(*) FROM cost_fee_summary_items WHERE tenant_id = $2 AND project_id = $1 AND source_review_required)
            ) AS source_review_required_count,
            (SELECT status FROM latest_review) AS latest_review_status,
            (SELECT output_state FROM latest_review) AS latest_review_output_state,
            (SELECT updated_at FROM latest_review) AS latest_review_updated_at
        FROM boq, measure_items, other_items, fee_items
        ",
    )
    .bind(project_id)
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(overview))
}

async fn get_latest_quantity_costing_snapshot_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Option<QuantityCostingSnapshotResponse>>> {
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

    let head = sqlx::query_as::<_, QuantityCostingSnapshotHeadRecord>(
        r"
        SELECT
            cp.id AS cost_project_id,
            latest_review.id AS review_version_id,
            cp.costing_project_key,
            cp.name,
            cp.jurisdiction,
            cp.standard_profile_id,
            cp.quota_library_id,
            COALESCE(latest_review.review_key, 'review-1') AS review_key,
            COALESCE(latest_review.review_round, 1)::int4 AS review_round,
            COALESCE(latest_review.description, '最新编审快照') AS review_description
        FROM cost_projects cp
        LEFT JOIN LATERAL (
            SELECT id, review_key, review_round, description
            FROM cost_review_versions
            WHERE tenant_id = cp.tenant_id
              AND project_id = cp.project_id
              AND cost_project_id = cp.id
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
        ) latest_review ON TRUE
        WHERE cp.tenant_id = $2 AND cp.project_id = $1
        ORDER BY cp.updated_at DESC, cp.id DESC
        LIMIT 1
        ",
    )
    .bind(project_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(head) = head else {
        tx.commit().await?;
        return Ok(Json(None));
    };

    let tree_nodes = sqlx::query_as::<_, QuantityCostingTreeNodeRequest>(
        r"
        SELECT
            child.node_key AS node_id,
            parent.node_key AS parent_id,
            child.node_type,
            child.name,
            child.specialty,
            child.sort_order,
            child.standard_profile_id,
            child.quota_library_id,
            child.audit_state
        FROM cost_project_tree_nodes child
        LEFT JOIN cost_project_tree_nodes parent ON parent.id = child.parent_id
        WHERE child.tenant_id = $1 AND child.cost_project_id = $2
        ORDER BY child.sort_order ASC, child.node_key ASC
        ",
    )
    .bind(tenant_id)
    .bind(head.cost_project_id)
    .fetch_all(&mut *tx)
    .await?;

    let boq_items = sqlx::query_as::<_, QuantityCostingBoqItemRequest>(
        r"
        SELECT
            item.item_key AS item_id,
            COALESCE(node.node_key, '') AS node_id,
            item.submitted_code,
            item.approved_code,
            item.submitted_name,
            item.approved_name,
            item.submitted_feature,
            item.approved_feature,
            item.unit,
            item.submitted_qty::float8 AS submitted_qty,
            item.approved_qty::float8 AS approved_qty,
            item.qty_delta::float8 AS qty_delta,
            item.submitted_unit_price::float8 AS submitted_unit_price,
            item.approved_unit_price::float8 AS approved_unit_price,
            item.submitted_total::float8 AS submitted_total,
            item.approved_total::float8 AS approved_total,
            item.amount_delta::float8 AS amount_delta,
            item.increase_amount::float8 AS increase_amount,
            item.decrease_amount::float8 AS decrease_amount,
            item.change_mark,
            item.change_reason,
            item.source_ref,
            item.rule_id,
            item.element_id,
            item.source_review_required
        FROM cost_boq_items item
        LEFT JOIN cost_project_tree_nodes node ON node.id = item.tree_node_id
        WHERE item.tenant_id = $1 AND item.cost_project_id = $2
        ORDER BY item.item_key ASC
        ",
    )
    .bind(tenant_id)
    .bind(head.cost_project_id)
    .fetch_all(&mut *tx)
    .await?;

    let measure_items = sqlx::query_as::<_, QuantityCostingMeasureItemRequest>(
        r"
        SELECT
            item_key AS item_id,
            name,
            measure_type,
            submitted_base_amount::float8 AS submitted_base_amount,
            approved_base_amount::float8 AS approved_base_amount,
            submitted_rate::float8 AS submitted_rate,
            approved_rate::float8 AS approved_rate,
            submitted_amount::float8 AS submitted_amount,
            approved_amount::float8 AS approved_amount,
            amount_delta::float8 AS amount_delta,
            change_mark,
            source_rule_id,
            source_ref,
            source_review_required
        FROM cost_measure_items
        WHERE tenant_id = $1 AND cost_project_id = $2
        ORDER BY item_key ASC
        ",
    )
    .bind(tenant_id)
    .bind(head.cost_project_id)
    .fetch_all(&mut *tx)
    .await?;

    let other_items = sqlx::query_as::<_, QuantityCostingOtherItemRequest>(
        r"
        SELECT
            item_key AS item_id,
            name,
            other_type,
            submitted_amount::float8 AS submitted_amount,
            approved_amount::float8 AS approved_amount,
            amount_delta::float8 AS amount_delta,
            change_mark,
            source_rule_id,
            source_ref,
            source_review_required
        FROM cost_other_items
        WHERE tenant_id = $1 AND cost_project_id = $2
        ORDER BY item_key ASC
        ",
    )
    .bind(tenant_id)
    .bind(head.cost_project_id)
    .fetch_all(&mut *tx)
    .await?;

    let fee_summary_items = sqlx::query_as::<_, QuantityCostingFeeSummaryItemRequest>(
        r"
        SELECT
            fee_key AS fee_id,
            name,
            submitted_base_amount::float8 AS submitted_base_amount,
            approved_base_amount::float8 AS approved_base_amount,
            submitted_rate::float8 AS submitted_rate,
            approved_rate::float8 AS approved_rate,
            submitted_amount::float8 AS submitted_amount,
            approved_amount::float8 AS approved_amount,
            amount_delta::float8 AS amount_delta,
            change_mark,
            source_rule_id,
            source_ref,
            source_review_required
        FROM cost_fee_summary_items
        WHERE tenant_id = $1 AND cost_project_id = $2
        ORDER BY fee_key ASC
        ",
    )
    .bind(tenant_id)
    .bind(head.cost_project_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(Some(QuantityCostingSnapshotResponse {
        cost_project_id: head.cost_project_id,
        review_version_id: head.review_version_id,
        costing_project_key: head.costing_project_key,
        name: head.name,
        jurisdiction: head.jurisdiction,
        standard_profile_id: head.standard_profile_id,
        quota_library_id: head.quota_library_id,
        review_key: head.review_key,
        review_round: head.review_round,
        review_description: head.review_description,
        tree_nodes,
        boq_items,
        measure_items,
        other_items,
        fee_summary_items,
    })))
}

async fn save_quantity_costing_snapshot_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(project_id): Path<Uuid>,
    Json(req): Json<QuantityCostingSnapshotRequest>,
) -> Result<(StatusCode, Json<QuantityCostingSnapshotSaveResponse>)> {
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
    if [
        req.costing_project_key.as_str(),
        req.name.as_str(),
        req.jurisdiction.as_str(),
        req.standard_profile_id.as_str(),
        req.quota_library_id.as_str(),
        req.review_key.as_str(),
        req.review_description.as_str(),
    ]
    .iter()
    .any(|value| value.trim().is_empty())
    {
        return Err(HarnessError::InvalidInput(
            "quantity costing snapshot key, name, standard, quota and review fields are required"
                .to_owned(),
        ));
    }
    if req.review_round < 1 {
        return Err(HarnessError::InvalidInput(
            "quantity costing review_round must be >= 1".to_owned(),
        ));
    }

    let tenant_id = context_tenant_uuid(&context)?;
    let pool = db_pool(&state)?;
    let mut tx = begin_tenant_tx(pool, &context).await?;
    ensure_project_exists_in_tx(&mut tx, project_id, tenant_id).await?;

    let cost_project_id = sqlx::query_scalar::<_, Uuid>(
        r"
        INSERT INTO cost_projects
            (tenant_id, project_id, costing_project_key, name, jurisdiction,
             standard_profile_id, quota_library_id, status, output_state, metadata)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, 'reviewing', 'professional_review_required',
             jsonb_build_object('source', 'quantity_costing_snapshot'))
        ON CONFLICT (tenant_id, costing_project_key) DO UPDATE
        SET project_id = EXCLUDED.project_id,
            name = EXCLUDED.name,
            jurisdiction = EXCLUDED.jurisdiction,
            standard_profile_id = EXCLUDED.standard_profile_id,
            quota_library_id = EXCLUDED.quota_library_id,
            status = EXCLUDED.status,
            output_state = EXCLUDED.output_state,
            updated_at = NOW()
        RETURNING id
        ",
    )
    .bind(tenant_id)
    .bind(project_id)
    .bind(req.costing_project_key.trim())
    .bind(req.name.trim())
    .bind(req.jurisdiction.trim())
    .bind(req.standard_profile_id.trim())
    .bind(req.quota_library_id.trim())
    .fetch_one(&mut *tx)
    .await?;

    for node in &req.tree_nodes {
        sqlx::query(
            r"
            INSERT INTO cost_project_tree_nodes
                (tenant_id, project_id, cost_project_id, parent_id, node_key,
                 node_type, name, specialty, sort_order, standard_profile_id,
                 quota_library_id, audit_state, metadata)
            VALUES
                ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11,
                 jsonb_build_object('source', 'quantity_costing_snapshot'))
            ON CONFLICT (tenant_id, cost_project_id, node_key) DO UPDATE
            SET node_type = EXCLUDED.node_type,
                name = EXCLUDED.name,
                specialty = EXCLUDED.specialty,
                sort_order = EXCLUDED.sort_order,
                standard_profile_id = EXCLUDED.standard_profile_id,
                quota_library_id = EXCLUDED.quota_library_id,
                audit_state = EXCLUDED.audit_state,
                updated_at = NOW()
            ",
        )
        .bind(tenant_id)
        .bind(project_id)
        .bind(cost_project_id)
        .bind(node.node_id.trim())
        .bind(node.node_type.trim())
        .bind(node.name.trim())
        .bind(node.specialty.trim())
        .bind(node.sort_order)
        .bind(node.standard_profile_id.trim())
        .bind(node.quota_library_id.trim())
        .bind(node.audit_state.trim())
        .execute(&mut *tx)
        .await?;
    }

    for node in &req.tree_nodes {
        if let Some(parent_id) = node
            .parent_id
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            sqlx::query(
                r"
                UPDATE cost_project_tree_nodes AS child
                SET parent_id = parent.id,
                    updated_at = NOW()
                FROM cost_project_tree_nodes AS parent
                WHERE child.tenant_id = $1
                  AND child.cost_project_id = $2
                  AND child.node_key = $3
                  AND parent.tenant_id = child.tenant_id
                  AND parent.cost_project_id = child.cost_project_id
                  AND parent.node_key = $4
                ",
            )
            .bind(tenant_id)
            .bind(cost_project_id)
            .bind(node.node_id.trim())
            .bind(parent_id.trim())
            .execute(&mut *tx)
            .await?;
        }
    }

    let review_version_id = sqlx::query_scalar::<_, Uuid>(
        r"
        INSERT INTO cost_review_versions
            (tenant_id, project_id, cost_project_id, review_key, review_round,
             description, status, output_state, metadata)
        VALUES
            ($1, $2, $3, $4, $5, $6, 'professional_review_required',
             'professional_review_required',
             jsonb_build_object('source', 'quantity_costing_snapshot'))
        ON CONFLICT (tenant_id, cost_project_id, review_key) DO UPDATE
        SET review_round = EXCLUDED.review_round,
            description = EXCLUDED.description,
            status = EXCLUDED.status,
            output_state = EXCLUDED.output_state,
            updated_at = NOW()
        RETURNING id
        ",
    )
    .bind(tenant_id)
    .bind(project_id)
    .bind(cost_project_id)
    .bind(req.review_key.trim())
    .bind(req.review_round)
    .bind(req.review_description.trim())
    .fetch_one(&mut *tx)
    .await?;

    for table in [
        "cost_delta_analysis_items",
        "cost_fee_summary_items",
        "cost_other_items",
        "cost_measure_items",
        "cost_boq_items",
    ] {
        let delete_sql =
            format!("DELETE FROM {table} WHERE tenant_id = $1 AND cost_project_id = $2");
        sqlx::query(&delete_sql)
            .bind(tenant_id)
            .bind(cost_project_id)
            .execute(&mut *tx)
            .await?;
    }

    for item in &req.boq_items {
        sqlx::query(
            r"
            INSERT INTO cost_boq_items
                (tenant_id, project_id, cost_project_id, review_version_id, tree_node_id,
                 item_key, submitted_code, approved_code, submitted_name, approved_name,
                 submitted_feature, approved_feature, unit, submitted_qty, approved_qty,
                 qty_delta, submitted_unit_price, approved_unit_price, submitted_total,
                 approved_total, amount_delta, increase_amount, decrease_amount, change_mark,
                 change_reason, source_ref, rule_id, element_id, source_review_required, metadata)
            VALUES
                ($1, $2, $3, $4,
                 (SELECT id FROM cost_project_tree_nodes
                  WHERE tenant_id = $1 AND cost_project_id = $3 AND node_key = $5
                  LIMIT 1),
                 $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                 $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
                 jsonb_build_object('source', 'quantity_costing_snapshot'))
            ",
        )
        .bind(tenant_id)
        .bind(project_id)
        .bind(cost_project_id)
        .bind(review_version_id)
        .bind(item.node_id.trim())
        .bind(item.item_id.trim())
        .bind(item.submitted_code.trim())
        .bind(item.approved_code.trim())
        .bind(item.submitted_name.trim())
        .bind(item.approved_name.trim())
        .bind(item.submitted_feature.trim())
        .bind(item.approved_feature.trim())
        .bind(item.unit.trim())
        .bind(item.submitted_qty)
        .bind(item.approved_qty)
        .bind(item.qty_delta)
        .bind(item.submitted_unit_price)
        .bind(item.approved_unit_price)
        .bind(item.submitted_total)
        .bind(item.approved_total)
        .bind(item.amount_delta)
        .bind(item.increase_amount)
        .bind(item.decrease_amount)
        .bind(item.change_mark.trim())
        .bind(item.change_reason.trim())
        .bind(item.source_ref.trim())
        .bind(item.rule_id.trim())
        .bind(item.element_id.as_deref().map(str::trim))
        .bind(item.source_review_required)
        .execute(&mut *tx)
        .await?;
    }

    for item in &req.measure_items {
        sqlx::query(
            r"
            INSERT INTO cost_measure_items
                (tenant_id, project_id, cost_project_id, review_version_id, item_key,
                 name, measure_type, submitted_base_amount, approved_base_amount,
                 submitted_rate, approved_rate, submitted_amount, approved_amount,
                 amount_delta, change_mark, source_rule_id, source_ref,
                 source_review_required, metadata)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 $14, $15, $16, $17, $18,
                 jsonb_build_object('source', 'quantity_costing_snapshot'))
            ",
        )
        .bind(tenant_id)
        .bind(project_id)
        .bind(cost_project_id)
        .bind(review_version_id)
        .bind(item.item_id.trim())
        .bind(item.name.trim())
        .bind(item.measure_type.trim())
        .bind(item.submitted_base_amount)
        .bind(item.approved_base_amount)
        .bind(item.submitted_rate)
        .bind(item.approved_rate)
        .bind(item.submitted_amount)
        .bind(item.approved_amount)
        .bind(item.amount_delta)
        .bind(item.change_mark.trim())
        .bind(item.source_rule_id.trim())
        .bind(item.source_ref.trim())
        .bind(item.source_review_required)
        .execute(&mut *tx)
        .await?;
    }

    for item in &req.other_items {
        sqlx::query(
            r"
            INSERT INTO cost_other_items
                (tenant_id, project_id, cost_project_id, review_version_id, item_key,
                 name, other_type, submitted_amount, approved_amount, amount_delta,
                 change_mark, source_rule_id, source_ref, source_review_required, metadata)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 $14, jsonb_build_object('source', 'quantity_costing_snapshot'))
            ",
        )
        .bind(tenant_id)
        .bind(project_id)
        .bind(cost_project_id)
        .bind(review_version_id)
        .bind(item.item_id.trim())
        .bind(item.name.trim())
        .bind(item.other_type.trim())
        .bind(item.submitted_amount)
        .bind(item.approved_amount)
        .bind(item.amount_delta)
        .bind(item.change_mark.trim())
        .bind(item.source_rule_id.trim())
        .bind(item.source_ref.trim())
        .bind(item.source_review_required)
        .execute(&mut *tx)
        .await?;
    }

    for item in &req.fee_summary_items {
        sqlx::query(
            r"
            INSERT INTO cost_fee_summary_items
                (tenant_id, project_id, cost_project_id, review_version_id, fee_key,
                 name, submitted_base_amount, approved_base_amount, submitted_rate,
                 approved_rate, submitted_amount, approved_amount, amount_delta,
                 change_mark, source_rule_id, source_ref, source_review_required, metadata)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 $14, $15, $16, $17,
                 jsonb_build_object('source', 'quantity_costing_snapshot'))
            ",
        )
        .bind(tenant_id)
        .bind(project_id)
        .bind(cost_project_id)
        .bind(review_version_id)
        .bind(item.fee_id.trim())
        .bind(item.name.trim())
        .bind(item.submitted_base_amount)
        .bind(item.approved_base_amount)
        .bind(item.submitted_rate)
        .bind(item.approved_rate)
        .bind(item.submitted_amount)
        .bind(item.approved_amount)
        .bind(item.amount_delta)
        .bind(item.change_mark.trim())
        .bind(item.source_rule_id.trim())
        .bind(item.source_ref.trim())
        .bind(item.source_review_required)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok((
        StatusCode::CREATED,
        Json(QuantityCostingSnapshotSaveResponse {
            cost_project_id,
            review_version_id,
            tree_node_count: req.tree_nodes.len(),
            boq_item_count: req.boq_items.len(),
            measure_item_count: req.measure_items.len(),
            other_item_count: req.other_items.len(),
            fee_item_count: req.fee_summary_items.len(),
        }),
    ))
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
    let agent_response: AgentInvokeResponseSummary =
        serde_json::from_slice(&bytes).map_err(|err| {
            HarnessError::Upstream(format!("agent orchestrator returned invalid JSON: {err}"))
        })?;
    append_agent_invoke_audit_events(&state, &context, &req, &agent_response).await?;
    Response::builder()
        .status(status)
        .header("content-type", content_type)
        .body(Body::from(bytes))
        .map_err(|err| HarnessError::Internal(format!("failed to build agent response: {err}")))
}

async fn append_agent_invoke_audit_events(
    state: &AppState,
    context: &RequestContext,
    req: &AgentInvokeRequest,
    response: &AgentInvokeResponseSummary,
) -> Result<()> {
    let target_id = response.request_id.clone();
    let actor = context.actor.clone();
    append_gateway_audit_event(
        state,
        context,
        AuditEventInput {
            module_id: req.module_id.clone(),
            actor: actor.clone(),
            action: AuditEventKind::AgentInvoked,
            target_type: "agent_run".to_owned(),
            target_id: target_id.clone(),
            summary: "agent invocation completed through Gateway".to_owned(),
            metadata: serde_json::json!({
                "agentRequestId": &response.request_id,
                "moduleId": &response.module_id,
                "verdict": &response.verdict,
                "outputStatus": &response.output_status,
                "revisionCount": response.revision_count,
                "attachmentCount": req.attachments.len(),
                "locale": &req.locale,
                "context": context.audit_json()
            }),
        },
    )
    .await?;
    append_gateway_audit_event(
        state,
        context,
        AuditEventInput {
            module_id: req.module_id.clone(),
            actor: actor.clone(),
            action: AuditEventKind::AgentToolContextResolved,
            target_type: "agent_run".to_owned(),
            target_id: target_id.clone(),
            summary: "agent ToolRouter context and source evidence resolved".to_owned(),
            metadata: serde_json::json!({
                "agentRequestId": &response.request_id,
                "toolResultCount": response.tool_results.len(),
                "ragChunkCount": response.rag_chunks.len(),
                "context": context.audit_json()
            }),
        },
    )
    .await?;
    append_gateway_audit_event(
        state,
        context,
        AuditEventInput {
            module_id: req.module_id.clone(),
            actor,
            action: AuditEventKind::AgentGateDecisionRecorded,
            target_type: "agent_run".to_owned(),
            target_id,
            summary: "agent gate verdicts and output status recorded".to_owned(),
            metadata: serde_json::json!({
                "agentRequestId": &response.request_id,
                "verdict": &response.verdict,
                "outputStatus": &response.output_status,
                "revisionCount": response.revision_count,
                "gateCount": response.gates.len(),
                "gates": &response.gates,
                "context": context.audit_json()
            }),
        },
    )
    .await?;
    Ok(())
}

async fn append_gateway_audit_event(
    state: &AppState,
    context: &RequestContext,
    input: AuditEventInput,
) -> Result<AuditEvent> {
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::append_audit_event(pool, context, input).await;
    }
    Ok(state.audit.append(input))
}

async fn retrieve_rag_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<RagRetrieveRequest>,
) -> Result<Json<RagRetrieveResponse>> {
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
    PermissionGuard::ensure(&context, RuntimePermission::RegistryRead)?;
    if context.tenant_id != req.tenant_id.to_string()
        || context.project_id != req.project_id.to_string()
    {
        return Err(HarnessError::TenantIsolation(format!(
            "RAG request tenant/project {}/{} does not match context {}/{}",
            req.tenant_id, req.project_id, context.tenant_id, context.project_id
        )));
    }
    if req.query.trim().is_empty() {
        return Err(HarnessError::InvalidInput("query is required".to_owned()));
    }
    if req.top_k <= 0 || req.top_k > 50 {
        return Err(HarnessError::InvalidInput("topK must be 1..=50".to_owned()));
    }

    let corpora = if req.corpora.is_empty() {
        vec!["gb".to_owned(), "project".to_owned()]
    } else {
        req.corpora.clone()
    };
    if req.query_embedding.is_empty() {
        return Ok(Json(RagRetrieveResponse {
            schema: "architoken.rag.retrieve.v1",
            retrieval_status: "embedding_required",
            tenant_id: req.tenant_id,
            project_id: req.project_id,
            top_k: req.top_k,
            corpora,
            chunks: Vec::new(),
            metadata: serde_json::json!({
                "query": req.query,
                "embeddingDimension": 1536,
                "embeddingProvider": "external ModelRouter/EmbeddingRouter required",
                "context": context.audit_json()
            }),
        }));
    }
    if req.query_embedding.len() != 1536 {
        return Err(HarnessError::InvalidInput(
            "queryEmbedding must contain 1536 floats".to_owned(),
        ));
    }

    let Some(pool) = state.db_pool.as_deref() else {
        return Ok(Json(RagRetrieveResponse {
            schema: "architoken.rag.retrieve.v1",
            retrieval_status: "vector_store_unavailable",
            tenant_id: req.tenant_id,
            project_id: req.project_id,
            top_k: req.top_k,
            corpora,
            chunks: Vec::new(),
            metadata: serde_json::json!({
                "query": req.query,
                "provider": "postgres_pgvector",
                "reason": "PostgreSQL runtime is not configured",
                "context": context.audit_json()
            }),
        }));
    };

    let chunks = retrieve_rag_chunks_pgvector(
        pool,
        req.tenant_id,
        &format_pgvector(&req.query_embedding),
        req.top_k,
        &corpora,
    )
    .await?;
    Ok(Json(RagRetrieveResponse {
        schema: "architoken.rag.retrieve.v1",
        retrieval_status: "retrieved",
        tenant_id: req.tenant_id,
        project_id: req.project_id,
        top_k: req.top_k,
        corpora,
        chunks,
        metadata: serde_json::json!({
            "query": req.query,
            "provider": "postgres_pgvector",
            "embeddingDimension": req.query_embedding.len(),
            "context": context.audit_json()
        }),
    }))
}

async fn retrieve_rag_chunks_pgvector(
    pool: &PgPool,
    tenant_id: Uuid,
    embedding: &str,
    top_k: i64,
    corpora: &[String],
) -> Result<Vec<RagRetrievedChunk>> {
    sqlx::query_as::<_, RagRetrievedChunk>(
        r"
        SELECT id, source, heading, content,
               (1 - (embedding <=> $1::vector))::real AS score,
               metadata
        FROM rag_chunks
        WHERE tenant_id = $2
          AND corpus = ANY($3::text[])
        ORDER BY embedding <=> $1::vector
        LIMIT $4
        ",
    )
    .bind(embedding)
    .bind(tenant_id)
    .bind(corpora)
    .bind(top_k)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

fn format_pgvector(values: &[f32]) -> String {
    let mut out = String::from("[");
    for (index, value) in values.iter().enumerate() {
        if index > 0 {
            out.push(',');
        }
        out.push_str(&value.to_string());
    }
    out.push(']');
    out
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
        .or_else(|| cookie_value(headers, AUTH_ACCESS_COOKIE))
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

#[derive(Debug, Clone, Copy)]
struct OAuthProviderSpec {
    id: &'static str,
    label: &'static str,
    auth_url: &'static str,
    token_url: &'static str,
    userinfo_url: Option<&'static str>,
    scope: &'static str,
    client_id_env: &'static str,
    client_secret_env: Option<&'static str>,
    supports_pkce: bool,
}

#[derive(Debug, Clone)]
struct OAuthProviderConfig {
    spec: &'static OAuthProviderSpec,
    client_id: String,
    client_secret: Option<String>,
}

#[derive(Debug, Clone)]
struct OAuthProfile {
    subject: String,
    email: Option<String>,
    phone: Option<String>,
    display_name: Option<String>,
    avatar_url: Option<String>,
    raw_profile: serde_json::Value,
}

#[derive(Debug, Clone)]
struct OAuthAuthBundle {
    access_token: String,
    session_token: String,
}

const OAUTH_PROVIDER_SPECS: &[OAuthProviderSpec] = &[
    OAuthProviderSpec {
        id: "wechat",
        label: "微信",
        auth_url: "https://open.weixin.qq.com/connect/qrconnect",
        token_url: "https://api.weixin.qq.com/sns/oauth2/access_token",
        userinfo_url: Some("https://api.weixin.qq.com/sns/userinfo"),
        scope: "snsapi_login",
        client_id_env: "ARCHITOKEN_OAUTH_WECHAT_CLIENT_ID",
        client_secret_env: Some("ARCHITOKEN_OAUTH_WECHAT_CLIENT_SECRET"),
        supports_pkce: false,
    },
    OAuthProviderSpec {
        id: "douyin",
        label: "抖音",
        auth_url: "https://open.douyin.com/platform/oauth/connect/",
        token_url: "https://open.douyin.com/oauth/access_token/",
        userinfo_url: Some("https://open.douyin.com/oauth/userinfo/"),
        scope: "user_info",
        client_id_env: "ARCHITOKEN_OAUTH_DOUYIN_CLIENT_ID",
        client_secret_env: Some("ARCHITOKEN_OAUTH_DOUYIN_CLIENT_SECRET"),
        supports_pkce: false,
    },
    OAuthProviderSpec {
        id: "alipay",
        label: "支付宝",
        auth_url: "https://openauth.alipay.com/oauth2/publicAppAuthorize.htm",
        token_url: "https://openapi.alipay.com/gateway.do",
        userinfo_url: None,
        scope: "auth_user",
        client_id_env: "ARCHITOKEN_OAUTH_ALIPAY_APP_ID",
        client_secret_env: None,
        supports_pkce: false,
    },
    OAuthProviderSpec {
        id: "microsoft",
        label: "微软",
        auth_url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        token_url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        userinfo_url: Some("https://graph.microsoft.com/oidc/userinfo"),
        scope: "openid profile email",
        client_id_env: "ARCHITOKEN_OAUTH_MICROSOFT_CLIENT_ID",
        client_secret_env: Some("ARCHITOKEN_OAUTH_MICROSOFT_CLIENT_SECRET"),
        supports_pkce: true,
    },
    OAuthProviderSpec {
        id: "google",
        label: "Google",
        auth_url: "https://accounts.google.com/o/oauth2/v2/auth",
        token_url: "https://oauth2.googleapis.com/token",
        userinfo_url: Some("https://openidconnect.googleapis.com/v1/userinfo"),
        scope: "openid profile email",
        client_id_env: "ARCHITOKEN_OAUTH_GOOGLE_CLIENT_ID",
        client_secret_env: Some("ARCHITOKEN_OAUTH_GOOGLE_CLIENT_SECRET"),
        supports_pkce: true,
    },
];

fn normalize_auth_channel(value: &str) -> Result<String> {
    match value.trim().to_ascii_lowercase().as_str() {
        "email" => Ok("email".to_owned()),
        "phone" | "mobile" | "sms" => Ok("phone".to_owned()),
        other => Err(HarnessError::InvalidInput(format!(
            "unsupported auth channel: {other}"
        ))),
    }
}

fn normalize_auth_purpose(value: &str) -> Result<String> {
    match value.trim().to_ascii_lowercase().as_str() {
        "register" | "login" | "reset_password" => Ok(value.trim().to_ascii_lowercase()),
        other => Err(HarnessError::InvalidInput(format!(
            "unsupported verification purpose: {other}"
        ))),
    }
}

fn normalize_auth_destination(channel: &str, value: &str) -> Result<String> {
    match channel {
        "email" => normalize_email(value),
        "phone" => normalize_phone(value),
        _ => Err(HarnessError::InvalidInput(
            "invalid auth channel".to_owned(),
        )),
    }
}

fn normalize_email(value: &str) -> Result<String> {
    let email = value.trim().to_ascii_lowercase();
    if email.len() < 3 || !email.contains('@') || email.contains(char::is_whitespace) {
        return Err(HarnessError::InvalidInput("invalid email".to_owned()));
    }
    Ok(email)
}

fn normalize_phone(value: &str) -> Result<String> {
    let phone = value
        .trim()
        .chars()
        .filter(|ch| ch.is_ascii_digit() || *ch == '+')
        .collect::<String>();
    let digit_count = phone.chars().filter(char::is_ascii_digit).count();
    if !(8..=15).contains(&digit_count) {
        return Err(HarnessError::InvalidInput("invalid phone".to_owned()));
    }
    Ok(phone)
}

fn normalize_login_identifier(value: &str) -> Result<String> {
    let trimmed = value.trim();
    if trimmed.contains('@') {
        normalize_email(trimmed)
    } else {
        normalize_phone(trimmed)
    }
}

fn non_empty_string(value: &str, field: &str) -> Result<String> {
    let value = value.trim().to_owned();
    if value.is_empty() {
        return Err(HarnessError::InvalidInput(format!("{field} is required")));
    }
    Ok(value)
}

fn validate_auth_password(password: &str) -> Result<()> {
    let length = password.chars().count();
    if !(8..=1024).contains(&length) {
        return Err(HarnessError::InvalidInput(
            "password length must be between 8 and 1024 characters".to_owned(),
        ));
    }
    Ok(())
}

fn invalid_auth_credentials() -> HarnessError {
    HarnessError::Unauthorized("invalid account or password".to_owned())
}

fn invalid_auth_code_credentials() -> HarnessError {
    HarnessError::Unauthorized("invalid account or verification code".to_owned())
}

fn normalize_oauth_provider(value: &str) -> Result<String> {
    let provider = value.trim().to_ascii_lowercase();
    if OAUTH_PROVIDER_SPECS
        .iter()
        .any(|spec| spec.id == provider.as_str())
    {
        Ok(provider)
    } else {
        Err(HarnessError::InvalidInput(format!(
            "unsupported OAuth provider: {provider}"
        )))
    }
}

fn normalize_oauth_account_type(value: Option<&str>) -> Result<String> {
    match value
        .unwrap_or("personal")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "personal" => Ok("personal".to_owned()),
        "enterprise" | "business" => Ok("enterprise".to_owned()),
        other => Err(HarnessError::InvalidInput(format!(
            "unsupported OAuth account type: {other}"
        ))),
    }
}

fn normalize_oauth_return_to(value: Option<&str>) -> Result<String> {
    let path = value.unwrap_or("/app/modules").trim();
    if path.is_empty() {
        return Ok("/app/modules".to_owned());
    }
    if !path.starts_with('/') || path.starts_with("//") || path.contains('\\') {
        return Err(HarnessError::InvalidInput(
            "OAuth returnTo must be a same-origin path".to_owned(),
        ));
    }
    Ok(path.to_owned())
}

fn oauth_provider_spec(provider: &str) -> Result<&'static OAuthProviderSpec> {
    OAUTH_PROVIDER_SPECS
        .iter()
        .find(|spec| spec.id == provider)
        .ok_or_else(|| {
            HarnessError::InvalidInput(format!("unsupported OAuth provider: {provider}"))
        })
}

fn env_trimmed(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn oauth_provider_config(provider: &str) -> Result<OAuthProviderConfig> {
    let spec = oauth_provider_spec(provider)?;
    let client_id = env_trimmed(spec.client_id_env).ok_or_else(|| {
        HarnessError::InvalidInput(format!(
            "{} OAuth requires {}",
            spec.label, spec.client_id_env
        ))
    })?;
    let client_secret = spec.client_secret_env.and_then(env_trimmed);
    Ok(OAuthProviderConfig {
        spec,
        client_id,
        client_secret,
    })
}

fn should_use_wechat_dev_oauth(
    provider: &str,
    profile: RuntimeProfile,
    err: &HarnessError,
) -> bool {
    provider == "wechat"
        && wechat_dev_oauth_enabled(profile)
        && matches!(
            err,
            HarnessError::InvalidInput(message)
                if message.starts_with("微信 OAuth requires ARCHITOKEN_OAUTH_WECHAT_")
        )
}

fn wechat_oauth_missing_secret_error() -> HarnessError {
    HarnessError::InvalidInput(
        "微信 OAuth requires ARCHITOKEN_OAUTH_WECHAT_CLIENT_SECRET".to_owned(),
    )
}

fn wechat_dev_oauth_enabled(profile: RuntimeProfile) -> bool {
    let flag = env_trimmed("ARCHITOKEN_OAUTH_WECHAT_DEV_LOGIN");
    wechat_dev_oauth_enabled_for_flag(profile, flag.as_deref())
}

fn wechat_dev_oauth_enabled_for_flag(profile: RuntimeProfile, flag: Option<&str>) -> bool {
    matches!(profile, RuntimeProfile::Development)
        && matches!(
            flag.map(|value| value.trim().to_ascii_lowercase())
                .as_deref(),
            Some("1" | "true" | "yes" | "on")
        )
}

fn oauth_public_api_base_url() -> String {
    env_trimmed("ARCHITOKEN_PUBLIC_API_BASE_URL")
        .or_else(|| env_trimmed("ARCHITOKEN_OAUTH_PUBLIC_BASE_URL"))
        .unwrap_or_else(|| "http://localhost:8080".to_owned())
}

fn frontend_base_url() -> String {
    env_trimmed("ARCHITOKEN_FRONTEND_BASE_URL")
        .unwrap_or_else(|| "http://localhost:3000".to_owned())
}

fn frontend_base_url_from_headers(headers: &HeaderMap, profile: RuntimeProfile) -> String {
    headers
        .get(ORIGIN)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|origin| is_allowed_auth_frontend_origin(origin, profile))
        .map(ToOwned::to_owned)
        .unwrap_or_else(frontend_base_url)
}

fn is_allowed_auth_frontend_origin(origin: &str, profile: RuntimeProfile) -> bool {
    let configured = frontend_base_url();
    let configured = configured.trim_end_matches('/');
    origin.trim_end_matches('/') == configured
        || (!matches!(profile, RuntimeProfile::Production) && is_development_cors_origin(origin))
}

fn frontend_redirect_url_from_headers(
    headers: &HeaderMap,
    profile: RuntimeProfile,
    return_to: &str,
) -> Result<String> {
    let path = normalize_oauth_return_to(Some(return_to))?;
    Ok(format!(
        "{}{}",
        frontend_base_url_from_headers(headers, profile).trim_end_matches('/'),
        path
    ))
}

fn oauth_redirect_uri(provider: &str) -> String {
    format!(
        "{}/v1/auth/oauth/{provider}/callback",
        oauth_public_api_base_url().trim_end_matches('/')
    )
}

fn auth_error_redirect_from_headers(
    headers: &HeaderMap,
    profile: RuntimeProfile,
    provider: &str,
    message: &str,
) -> String {
    auth_error_redirect_with_base(
        &frontend_base_url_from_headers(headers, profile),
        provider,
        message,
    )
}

fn auth_error_redirect_with_base(base_url: &str, provider: &str, message: &str) -> String {
    let mut url = Url::parse(&format!("{}/auth", base_url.trim_end_matches('/')))
        .unwrap_or_else(|_| Url::parse("http://localhost:3000/auth").expect("valid fallback URL"));
    url.query_pairs_mut()
        .append_pair("error", message)
        .append_pair("provider", provider);
    url.to_string()
}

fn wechat_dev_oauth_callback_url(
    headers: &HeaderMap,
    profile: RuntimeProfile,
    state_token: &str,
) -> Result<Url> {
    let base = frontend_base_url_from_headers(headers, profile);
    let mut url = Url::parse(&format!(
        "{}/api/architoken/v1/auth/oauth/wechat/callback",
        base.trim_end_matches('/')
    ))
    .map_err(|err| HarnessError::Internal(format!("invalid WeChat dev callback URL: {err}")))?;
    let code = format!("{WECHAT_DEV_OAUTH_CODE_PREFIX}{state_token}");
    url.query_pairs_mut()
        .append_pair("code", &code)
        .append_pair("state", state_token);
    Ok(url)
}

fn oauth_authorization_url(
    config: &OAuthProviderConfig,
    state_token: &str,
    code_verifier: Option<&str>,
) -> Result<Url> {
    let redirect_uri = oauth_redirect_uri(config.spec.id);
    let mut url = Url::parse(config.spec.auth_url)
        .map_err(|err| HarnessError::Internal(format!("invalid OAuth auth URL: {err}")))?;
    {
        let mut query = url.query_pairs_mut();
        match config.spec.id {
            "wechat" => {
                query
                    .append_pair("appid", &config.client_id)
                    .append_pair("redirect_uri", &redirect_uri)
                    .append_pair("response_type", "code")
                    .append_pair("scope", config.spec.scope)
                    .append_pair("state", state_token);
            }
            "douyin" => {
                query
                    .append_pair("client_key", &config.client_id)
                    .append_pair("response_type", "code")
                    .append_pair("scope", config.spec.scope)
                    .append_pair("redirect_uri", &redirect_uri)
                    .append_pair("state", state_token);
            }
            "alipay" => {
                query
                    .append_pair("app_id", &config.client_id)
                    .append_pair("scope", config.spec.scope)
                    .append_pair("redirect_uri", &redirect_uri)
                    .append_pair("state", state_token);
            }
            "google" => {
                query
                    .append_pair("client_id", &config.client_id)
                    .append_pair("response_type", "code")
                    .append_pair("redirect_uri", &redirect_uri)
                    .append_pair("scope", config.spec.scope)
                    .append_pair("state", state_token)
                    .append_pair("prompt", "select_account");
                if let Some(verifier) = code_verifier {
                    query
                        .append_pair("code_challenge", &oauth_code_challenge(verifier))
                        .append_pair("code_challenge_method", "S256");
                }
            }
            _ => {
                query
                    .append_pair("client_id", &config.client_id)
                    .append_pair("response_type", "code")
                    .append_pair("redirect_uri", &redirect_uri)
                    .append_pair("scope", config.spec.scope)
                    .append_pair("state", state_token);
                if let Some(verifier) = code_verifier {
                    query
                        .append_pair("code_challenge", &oauth_code_challenge(verifier))
                        .append_pair("code_challenge_method", "S256");
                }
            }
        }
    }
    if config.spec.id == "wechat" {
        url.set_fragment(Some("wechat_redirect"));
    }
    Ok(url)
}

fn random_oauth_code_verifier() -> Result<String> {
    Ok(URL_SAFE_NO_PAD.encode(random_bytes::<32>()?))
}

fn oauth_code_challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(digest::digest(&digest::SHA256, verifier.as_bytes()).as_ref())
}

fn oauth_state_hash(state: &AppState, state_token: &str) -> Result<String> {
    let pepper = auth_password_pepper(state)?;
    Ok(hmac_sha256_hex(
        pepper.as_bytes(),
        &format!("oauth_state:{state_token}"),
    ))
}

fn auth_qr_scan_token_hash(state: &AppState, token: &str) -> Result<String> {
    let token = token.trim();
    if token.is_empty() {
        return Err(HarnessError::InvalidInput(
            "scan token is required".to_owned(),
        ));
    }
    let pepper = auth_password_pepper(state)?;
    Ok(hmac_sha256_hex(
        pepper.as_bytes(),
        &format!("auth_qr_scan:{token}"),
    ))
}

fn auth_qr_poll_token_hash(state: &AppState, token: &str) -> Result<String> {
    let token = token.trim();
    if token.is_empty() {
        return Err(HarnessError::InvalidInput(
            "poll token is required".to_owned(),
        ));
    }
    let pepper = auth_password_pepper(state)?;
    Ok(hmac_sha256_hex(
        pepper.as_bytes(),
        &format!("auth_qr_poll:{token}"),
    ))
}

fn auth_qr_scan_payload(
    frontend_base_url: &str,
    challenge_id: Uuid,
    scan_token: &str,
) -> Result<String> {
    let mut url = Url::parse(&format!(
        "{}/auth/scan",
        frontend_base_url.trim_end_matches('/')
    ))
    .map_err(|err| HarnessError::Internal(format!("invalid frontend base URL: {err}")))?;
    url.query_pairs_mut()
        .append_pair("challengeId", &challenge_id.to_string())
        .append_pair("scanToken", scan_token);
    Ok(url.to_string())
}

fn auth_qr_remaining_seconds(expires_at: DateTime<Utc>) -> i64 {
    (expires_at - Utc::now()).num_seconds().max(0)
}

fn auth_qr_is_expired(row: &AuthQrChallengeRow) -> bool {
    matches!(row.status.as_str(), "pending" | "scanned") && row.expires_at <= Utc::now()
}

async fn expire_auth_qr_challenge_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    challenge_id: Uuid,
) -> Result<String> {
    let status = sqlx::query_scalar::<_, String>(
        r"
        UPDATE auth_qr_login_challenges
        SET status = 'expired',
            updated_at = NOW()
        WHERE id = $1
          AND status IN ('pending', 'scanned')
        RETURNING status
        ",
    )
    .bind(challenge_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(status.unwrap_or_else(|| "expired".to_owned()))
}

async fn update_auth_qr_scan_status(
    state: &AppState,
    challenge_id: Uuid,
    scan_token: &str,
    approve: bool,
) -> Result<AuthQrChallengeRow> {
    let pool = db_pool(state)?;
    let scan_token_hash = auth_qr_scan_token_hash(state, scan_token)?;
    let mut tx = pool.begin().await?;
    let mut row = sqlx::query_as::<_, AuthQrChallengeRow>(
        r"
        SELECT id AS challenge_id,
               status,
               account_id,
               tenant_id,
               person_id,
               expires_at
        FROM auth_qr_login_challenges
        WHERE id = $1 AND scan_token_hash = $2
        FOR UPDATE
        ",
    )
    .bind(challenge_id)
    .bind(&scan_token_hash)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| HarnessError::Unauthorized("invalid QR login challenge".to_owned()))?;

    if auth_qr_is_expired(&row) {
        row.status = expire_auth_qr_challenge_in_tx(&mut tx, row.challenge_id).await?;
        tx.commit().await?;
        return Ok(row);
    }

    if !approve && row.status == "pending" {
        row = sqlx::query_as::<_, AuthQrChallengeRow>(
            r"
            UPDATE auth_qr_login_challenges
            SET status = 'scanned',
                scanned_at = COALESCE(scanned_at, NOW()),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id AS challenge_id,
                      status,
                      account_id,
                      tenant_id,
                      person_id,
                      expires_at
            ",
        )
        .bind(row.challenge_id)
        .fetch_one(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(row)
}

async fn exchange_oauth_code_for_profile(
    state: &AppState,
    provider: &str,
    code: &str,
    code_verifier: Option<&str>,
) -> Result<OAuthProfile> {
    match provider {
        "wechat" => exchange_wechat_oauth_profile(state, code).await,
        "douyin" => exchange_douyin_oauth_profile(state, code).await,
        "alipay" => exchange_alipay_oauth_profile(state, code).await,
        "microsoft" | "google" => {
            exchange_oidc_oauth_profile(state, provider, code, code_verifier).await
        }
        _ => Err(HarnessError::InvalidInput(format!(
            "unsupported OAuth provider: {provider}"
        ))),
    }
}

async fn exchange_oidc_oauth_profile(
    state: &AppState,
    provider: &str,
    code: &str,
    code_verifier: Option<&str>,
) -> Result<OAuthProfile> {
    let config = oauth_provider_config(provider)?;
    let client_secret = config.client_secret.clone().ok_or_else(|| {
        HarnessError::InvalidInput(format!(
            "{} OAuth requires {}",
            config.spec.label,
            config.spec.client_secret_env.unwrap_or("client secret")
        ))
    })?;
    let redirect_uri = oauth_redirect_uri(provider);
    let mut form = vec![
        ("client_id".to_owned(), config.client_id),
        ("client_secret".to_owned(), client_secret),
        ("code".to_owned(), code.to_owned()),
        ("grant_type".to_owned(), "authorization_code".to_owned()),
        ("redirect_uri".to_owned(), redirect_uri),
    ];
    if let Some(verifier) = code_verifier {
        form.push(("code_verifier".to_owned(), verifier.to_owned()));
    }
    let token = state
        .http_client
        .post(config.spec.token_url)
        .form(&form)
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;
    let access_token = json_string(&token, &["access_token"]).ok_or_else(|| {
        HarnessError::Upstream(format!(
            "{} OAuth token response missing access_token",
            config.spec.label
        ))
    })?;
    let userinfo_url = config
        .spec
        .userinfo_url
        .ok_or_else(|| HarnessError::Internal("OIDC provider missing userinfo URL".to_owned()))?;
    let profile = state
        .http_client
        .get(userinfo_url)
        .bearer_auth(access_token)
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;
    let subject = json_string(&profile, &["sub"])
        .or_else(|| json_string(&profile, &["id"]))
        .ok_or_else(|| {
            HarnessError::Upstream(format!("{} profile missing subject", config.spec.label))
        })?;
    Ok(OAuthProfile {
        subject,
        email: json_string(&profile, &["email"])
            .or_else(|| json_string(&profile, &["preferred_username"]))
            .and_then(|value| normalize_email(&value).ok()),
        phone: json_string(&profile, &["phone_number"])
            .and_then(|value| normalize_phone(&value).ok()),
        display_name: json_string(&profile, &["name"]),
        avatar_url: json_string(&profile, &["picture"]),
        raw_profile: profile,
    })
}

async fn exchange_wechat_oauth_profile(state: &AppState, code: &str) -> Result<OAuthProfile> {
    if let Some(profile) = wechat_dev_oauth_profile(state.runtime_profile, code)? {
        return Ok(profile);
    }

    let config = oauth_provider_config("wechat")?;
    let client_secret = config
        .client_secret
        .clone()
        .ok_or_else(wechat_oauth_missing_secret_error)?;
    let mut token_url = Url::parse(config.spec.token_url)
        .map_err(|err| HarnessError::Internal(format!("invalid WeChat token URL: {err}")))?;
    token_url
        .query_pairs_mut()
        .append_pair("appid", &config.client_id)
        .append_pair("secret", &client_secret)
        .append_pair("code", code)
        .append_pair("grant_type", "authorization_code");
    let token = state
        .http_client
        .get(token_url)
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;
    ensure_no_oauth_error("微信", &token)?;
    let access_token = json_string(&token, &["access_token"]).ok_or_else(|| {
        HarnessError::Upstream("微信 OAuth token response missing access_token".to_owned())
    })?;
    let openid = json_string(&token, &["openid"]).ok_or_else(|| {
        HarnessError::Upstream("微信 OAuth token response missing openid".to_owned())
    })?;
    let mut userinfo_url = Url::parse(config.spec.userinfo_url.unwrap_or(""))
        .map_err(|err| HarnessError::Internal(format!("invalid WeChat userinfo URL: {err}")))?;
    userinfo_url
        .query_pairs_mut()
        .append_pair("access_token", &access_token)
        .append_pair("openid", &openid)
        .append_pair("lang", "zh_CN");
    let profile = state
        .http_client
        .get(userinfo_url)
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;
    ensure_no_oauth_error("微信", &profile)?;
    let subject = json_string(&profile, &["unionid"])
        .or_else(|| json_string(&profile, &["openid"]))
        .unwrap_or(openid);
    Ok(OAuthProfile {
        subject,
        email: None,
        phone: None,
        display_name: json_string(&profile, &["nickname"]),
        avatar_url: json_string(&profile, &["headimgurl"]),
        raw_profile: profile,
    })
}

fn is_wechat_dev_oauth_code(code: &str) -> bool {
    code.trim().starts_with(WECHAT_DEV_OAUTH_CODE_PREFIX)
}

fn wechat_dev_oauth_profile(profile: RuntimeProfile, code: &str) -> Result<Option<OAuthProfile>> {
    if !is_wechat_dev_oauth_code(code) {
        return Ok(None);
    }
    if !wechat_dev_oauth_enabled(profile) {
        return Err(HarnessError::Unauthorized(
            "微信开发登录只允许在 development profile 使用".to_owned(),
        ));
    }

    let subject = env_trimmed("ARCHITOKEN_OAUTH_WECHAT_DEV_SUBJECT")
        .unwrap_or_else(|| "architoken-dev-wechat-user".to_owned());
    let display_name = env_trimmed("ARCHITOKEN_OAUTH_WECHAT_DEV_DISPLAY_NAME")
        .unwrap_or_else(|| "微信开发用户".to_owned());
    let avatar_url = env_trimmed("ARCHITOKEN_OAUTH_WECHAT_DEV_AVATAR_URL");
    let raw_profile = serde_json::json!({
        "provider": "wechat",
        "mode": "development",
        "openid": subject,
        "unionid": subject,
        "nickname": display_name,
        "headimgurl": avatar_url.clone(),
    });

    Ok(Some(OAuthProfile {
        subject,
        email: None,
        phone: None,
        display_name: Some(display_name),
        avatar_url,
        raw_profile,
    }))
}

async fn exchange_douyin_oauth_profile(state: &AppState, code: &str) -> Result<OAuthProfile> {
    let config = oauth_provider_config("douyin")?;
    let client_secret = config.client_secret.clone().ok_or_else(|| {
        HarnessError::InvalidInput(
            "抖音 OAuth requires ARCHITOKEN_OAUTH_DOUYIN_CLIENT_SECRET".to_owned(),
        )
    })?;
    let form = vec![
        ("client_key".to_owned(), config.client_id),
        ("client_secret".to_owned(), client_secret),
        ("code".to_owned(), code.to_owned()),
        ("grant_type".to_owned(), "authorization_code".to_owned()),
    ];
    let token = state
        .http_client
        .post(config.spec.token_url)
        .form(&form)
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;
    ensure_no_oauth_error("抖音", &token)?;
    let access_token = json_string(&token, &["access_token"])
        .or_else(|| json_string(&token, &["data", "access_token"]))
        .ok_or_else(|| {
            HarnessError::Upstream("抖音 OAuth token response missing access_token".to_owned())
        })?;
    let open_id = json_string(&token, &["open_id"])
        .or_else(|| json_string(&token, &["data", "open_id"]))
        .ok_or_else(|| {
            HarnessError::Upstream("抖音 OAuth token response missing open_id".to_owned())
        })?;
    let userinfo_form = vec![
        ("access_token".to_owned(), access_token),
        ("open_id".to_owned(), open_id.clone()),
    ];
    let profile = state
        .http_client
        .post(config.spec.userinfo_url.unwrap_or(""))
        .form(&userinfo_form)
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;
    ensure_no_oauth_error("抖音", &profile)?;
    Ok(OAuthProfile {
        subject: json_string(&profile, &["open_id"])
            .or_else(|| json_string(&profile, &["data", "open_id"]))
            .unwrap_or(open_id),
        email: None,
        phone: None,
        display_name: json_string(&profile, &["nickname"])
            .or_else(|| json_string(&profile, &["data", "nickname"])),
        avatar_url: json_string(&profile, &["avatar"])
            .or_else(|| json_string(&profile, &["data", "avatar"])),
        raw_profile: profile,
    })
}

async fn exchange_alipay_oauth_profile(state: &AppState, code: &str) -> Result<OAuthProfile> {
    let token = signed_alipay_request(
        state,
        "alipay.system.oauth.token",
        &[
            ("grant_type", "authorization_code".to_owned()),
            ("code", code.to_owned()),
        ],
        None,
    )
    .await?;
    let token_body = token
        .get("alipay_system_oauth_token_response")
        .unwrap_or(&token);
    let access_token = json_string(token_body, &["access_token"]).ok_or_else(|| {
        HarnessError::Upstream("支付宝 OAuth token response missing access_token".to_owned())
    })?;
    let user_id = json_string(token_body, &["user_id"]).ok_or_else(|| {
        HarnessError::Upstream("支付宝 OAuth token response missing user_id".to_owned())
    })?;
    let profile_response =
        signed_alipay_request(state, "alipay.user.info.share", &[], Some(&access_token)).await?;
    let profile = profile_response
        .get("alipay_user_info_share_response")
        .cloned()
        .unwrap_or(profile_response);
    Ok(OAuthProfile {
        subject: json_string(&profile, &["user_id"]).unwrap_or(user_id),
        email: json_string(&profile, &["email"]).and_then(|value| normalize_email(&value).ok()),
        phone: json_string(&profile, &["mobile"]).and_then(|value| normalize_phone(&value).ok()),
        display_name: json_string(&profile, &["nick_name"])
            .or_else(|| json_string(&profile, &["user_name"])),
        avatar_url: json_string(&profile, &["avatar"]),
        raw_profile: profile,
    })
}

async fn signed_alipay_request(
    state: &AppState,
    method: &str,
    biz_params: &[(&str, String)],
    auth_token: Option<&str>,
) -> Result<serde_json::Value> {
    let app_id = env_trimmed("ARCHITOKEN_OAUTH_ALIPAY_APP_ID").ok_or_else(|| {
        HarnessError::InvalidInput(
            "支付宝 OAuth requires ARCHITOKEN_OAUTH_ALIPAY_APP_ID".to_owned(),
        )
    })?;
    let private_key = env_trimmed("ARCHITOKEN_OAUTH_ALIPAY_PRIVATE_KEY").ok_or_else(|| {
        HarnessError::InvalidInput(
            "支付宝 OAuth requires ARCHITOKEN_OAUTH_ALIPAY_PRIVATE_KEY".to_owned(),
        )
    })?;
    let mut params = BTreeMap::from([
        ("app_id".to_owned(), app_id),
        ("method".to_owned(), method.to_owned()),
        ("charset".to_owned(), "UTF-8".to_owned()),
        ("sign_type".to_owned(), "RSA2".to_owned()),
        (
            "timestamp".to_owned(),
            Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        ),
        ("version".to_owned(), "1.0".to_owned()),
    ]);
    if let Some(token) = auth_token {
        params.insert("auth_token".to_owned(), token.to_owned());
    }
    for (key, value) in biz_params {
        params.insert((*key).to_owned(), value.to_owned());
    }
    let sign_content = alipay_sign_content(&params);
    let sign = rsa_sha256_sign_base64(&private_key, &sign_content)?;
    params.insert("sign".to_owned(), sign);
    let response = state
        .http_client
        .post("https://openapi.alipay.com/gateway.do")
        .form(&params)
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;
    if let Some(error) = response.get("error_response") {
        return Err(HarnessError::Upstream(format!(
            "支付宝 OAuth error: {error}"
        )));
    }
    Ok(response)
}

fn alipay_sign_content(params: &BTreeMap<String, String>) -> String {
    params
        .iter()
        .filter(|(key, value)| key.as_str() != "sign" && !value.is_empty())
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join("&")
}

fn rsa_sha256_sign_base64(private_key_pem: &str, message: &str) -> Result<String> {
    let der = pem_or_base64_der(private_key_pem)?;
    let key_pair = rsa::KeyPair::from_pkcs8(&der)
        .or_else(|_| rsa::KeyPair::from_der(&der))
        .map_err(|_| HarnessError::InvalidInput("invalid Alipay RSA private key".to_owned()))?;
    let rng = SystemRandom::new();
    let mut signature_bytes = vec![0_u8; key_pair.public().modulus_len()];
    key_pair
        .sign(
            &signature::RSA_PKCS1_SHA256,
            &rng,
            message.as_bytes(),
            &mut signature_bytes,
        )
        .map_err(|_| HarnessError::Internal("Alipay RSA signing failed".to_owned()))?;
    Ok(BASE64_STANDARD.encode(signature_bytes))
}

fn pem_or_base64_der(value: &str) -> Result<Vec<u8>> {
    let cleaned = value
        .lines()
        .map(str::trim)
        .filter(|line| !line.starts_with("-----BEGIN") && !line.starts_with("-----END"))
        .collect::<String>();
    BASE64_STANDARD
        .decode(cleaned.as_bytes())
        .map_err(|err| HarnessError::InvalidInput(format!("invalid base64 private key: {err}")))
}

fn ensure_no_oauth_error(provider_label: &str, value: &serde_json::Value) -> Result<()> {
    let code = json_string(value, &["errcode"])
        .or_else(|| json_string(value, &["error_code"]))
        .or_else(|| json_string(value, &["data", "error_code"]));
    if let Some(code) = code.filter(|code| code != "0") {
        let message = json_string(value, &["errmsg"])
            .or_else(|| json_string(value, &["description"]))
            .or_else(|| json_string(value, &["data", "description"]))
            .unwrap_or_else(|| value.to_string());
        Err(HarnessError::Upstream(format!(
            "{provider_label} OAuth error {code}: {message}"
        )))
    } else {
        Ok(())
    }
}

fn json_string(value: &serde_json::Value, path: &[&str]) -> Option<String> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn auth_password_pepper(state: &AppState) -> Result<String> {
    match std::env::var("ARCHITOKEN_AUTH_PASSWORD_PEPPER") {
        Ok(value) if !value.trim().is_empty() => Ok(value),
        _ if matches!(state.runtime_profile, RuntimeProfile::Development) => {
            Ok(state.cfg.auth.jwt_secret.clone())
        }
        _ => Err(HarnessError::InvalidInput(
            "production auth requires ARCHITOKEN_AUTH_PASSWORD_PEPPER".to_owned(),
        )),
    }
}

fn auth_argon2_params() -> Result<Params> {
    Params::new(64 * 1024, 3, 4, Some(32))
        .map_err(|err| HarnessError::Internal(format!("invalid Argon2 params: {err}")))
}

fn hash_auth_password(state: &AppState, password: &str) -> Result<String> {
    let pepper = auth_password_pepper(state)?;
    let argon2 = Argon2::new_with_secret(
        pepper.as_bytes(),
        Argon2Algorithm::Argon2id,
        Version::V0x13,
        auth_argon2_params()?,
    )
    .map_err(|err| HarnessError::Internal(format!("invalid Argon2 secret: {err}")))?;
    let salt = random_bytes::<16>()?;
    let hash = argon2
        .hash_password_with_salt(password.as_bytes(), &salt)
        .map_err(|err| HarnessError::Internal(format!("password hash failed: {err}")))?;
    Ok(hash.to_string())
}

fn verify_auth_password(state: &AppState, password: &str, password_hash: &str) -> Result<()> {
    let parsed = PasswordHash::new(password_hash).map_err(|_| invalid_auth_credentials())?;
    let pepper = auth_password_pepper(state)?;
    let argon2 = Argon2::new_with_secret(
        pepper.as_bytes(),
        Argon2Algorithm::Argon2id,
        Version::V0x13,
        auth_argon2_params()?,
    )
    .map_err(|err| HarnessError::Internal(format!("invalid Argon2 secret: {err}")))?;
    argon2
        .verify_password(password.as_bytes(), &parsed)
        .map_err(|_| invalid_auth_credentials())
}

fn random_bytes<const N: usize>() -> Result<[u8; N]> {
    let rng = SystemRandom::new();
    let mut bytes = [0_u8; N];
    rng.fill(&mut bytes)
        .map_err(|_| HarnessError::Internal("secure random generation failed".to_owned()))?;
    Ok(bytes)
}

fn random_hex<const N: usize>() -> Result<String> {
    Ok(hex_lower(&random_bytes::<N>()?))
}

fn hex_lower(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn generate_verification_code() -> Result<String> {
    let bytes = random_bytes::<4>()?;
    let raw = u32::from_be_bytes(bytes) % 1_000_000;
    Ok(format!("{raw:06}"))
}

async fn deliver_auth_verification_code(
    state: &AppState,
    channel: &str,
    destination: &str,
    purpose: &str,
    code: &str,
    expires_in_seconds: i64,
) -> Result<AuthDeliveryReceipt> {
    match channel {
        "phone" => {
            deliver_sms_verification_code(state, destination, purpose, code, expires_in_seconds)
                .await
        }
        "email" if auth_delivery_debug_enabled(state) => Ok(AuthDeliveryReceipt {
            provider: "development_debug".to_owned(),
            status: "development_debug".to_owned(),
            message_id: None,
        }),
        "email" => Err(HarnessError::InvalidInput(
            "email verification delivery is not configured".to_owned(),
        )),
        _ => Err(HarnessError::InvalidInput(
            "invalid auth verification channel".to_owned(),
        )),
    }
}

async fn deliver_sms_verification_code(
    state: &AppState,
    destination: &str,
    purpose: &str,
    code: &str,
    expires_in_seconds: i64,
) -> Result<AuthDeliveryReceipt> {
    match env_trimmed("ARCHITOKEN_SMS_PROVIDER")
        .map(|provider| provider.to_ascii_lowercase())
        .as_deref()
    {
        Some("http") | Some("webhook") => {
            deliver_sms_webhook(state, destination, purpose, code, expires_in_seconds).await
        }
        Some("disabled") | None if auth_delivery_debug_enabled(state) => Ok(AuthDeliveryReceipt {
            provider: "development_debug".to_owned(),
            status: "development_debug".to_owned(),
            message_id: None,
        }),
        None => Err(HarnessError::InvalidInput(
            "phone verification requires ARCHITOKEN_SMS_PROVIDER=http and ARCHITOKEN_SMS_WEBHOOK_URL"
                .to_owned(),
        )),
        Some(provider) => Err(HarnessError::InvalidInput(format!(
            "unsupported SMS provider: {provider}"
        ))),
    }
}

async fn deliver_sms_webhook(
    state: &AppState,
    destination: &str,
    purpose: &str,
    code: &str,
    expires_in_seconds: i64,
) -> Result<AuthDeliveryReceipt> {
    let url = env_trimmed("ARCHITOKEN_SMS_WEBHOOK_URL").ok_or_else(|| {
        HarnessError::InvalidInput(
            "ARCHITOKEN_SMS_WEBHOOK_URL is required when ARCHITOKEN_SMS_PROVIDER=http".to_owned(),
        )
    })?;
    let message = sms_verification_message(code, purpose, expires_in_seconds);
    let payload = serde_json::json!({
        "channel": "sms",
        "destination": destination,
        "purpose": purpose,
        "code": code,
        "expiresInSeconds": expires_in_seconds,
        "message": message,
        "templateId": env_trimmed("ARCHITOKEN_SMS_TEMPLATE_ID"),
        "signName": env_trimmed("ARCHITOKEN_SMS_SIGN_NAME")
    });
    let mut request = state.http_client.post(&url).json(&payload);
    if let Some(token) = env_trimmed("ARCHITOKEN_SMS_WEBHOOK_TOKEN") {
        request = request.bearer_auth(token);
    }

    let response = request.send().await?;
    let status = response.status();
    let body_text = response.text().await?;
    let body_json = if body_text.trim().is_empty() {
        None
    } else {
        serde_json::from_str::<serde_json::Value>(&body_text).ok()
    };
    if !status.is_success() {
        return Err(HarnessError::Upstream(format!(
            "SMS webhook returned HTTP {}: {}",
            status.as_u16(),
            compact_http_body_for_error(&body_text)
        )));
    }

    let delivery_status = body_json
        .as_ref()
        .and_then(|body| {
            json_string(body, &["deliveryStatus"])
                .or_else(|| json_string(body, &["status"]))
                .or_else(|| json_string(body, &["data", "status"]))
        })
        .unwrap_or_else(|| {
            if status.as_u16() == 202 {
                "queued".to_owned()
            } else {
                "sent".to_owned()
            }
        });
    let message_id = body_json.as_ref().and_then(|body| {
        json_string(body, &["messageId"])
            .or_else(|| json_string(body, &["requestId"]))
            .or_else(|| json_string(body, &["data", "messageId"]))
            .or_else(|| json_string(body, &["data", "requestId"]))
    });
    Ok(AuthDeliveryReceipt {
        provider: "http".to_owned(),
        status: delivery_status,
        message_id,
    })
}

fn sms_verification_message(code: &str, purpose: &str, expires_in_seconds: i64) -> String {
    let action = match purpose {
        "login" => "登录",
        "reset_password" => "重置密码",
        _ => "注册",
    };
    let minutes = (expires_in_seconds / 60).max(1);
    format!("ArchIToken {action}验证码：{code}，{minutes}分钟内有效。")
}

fn auth_delivery_debug_enabled(state: &AppState) -> bool {
    if !matches!(state.runtime_profile, RuntimeProfile::Development) {
        return false;
    }
    !matches!(
        env_trimmed("ARCHITOKEN_AUTH_DEBUG_DELIVERY")
            .map(|value| value.to_ascii_lowercase())
            .as_deref(),
        Some("0" | "false" | "no" | "off")
    )
}

fn compact_http_body_for_error(body: &str) -> String {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return "<empty body>".to_owned();
    }
    let mut compact = trimmed.chars().take(240).collect::<String>();
    if trimmed.chars().count() > 240 {
        compact.push_str("...");
    }
    compact
}

fn hmac_sha256_hex(secret: &[u8], message: &str) -> String {
    let key = hmac::Key::new(hmac::HMAC_SHA256, secret);
    hex_lower(hmac::sign(&key, message.as_bytes()).as_ref())
}

fn verification_code_hash(
    state: &AppState,
    channel: &str,
    destination: &str,
    purpose: &str,
    code: &str,
) -> Result<String> {
    let pepper = auth_password_pepper(state)?;
    Ok(hmac_sha256_hex(
        pepper.as_bytes(),
        &format!("verification:{channel}:{destination}:{purpose}:{code}"),
    ))
}

fn session_token_hash(state: &AppState, token: &str) -> Result<String> {
    let pepper = auth_password_pepper(state)?;
    Ok(hmac_sha256_hex(
        pepper.as_bytes(),
        &format!("session:{token}"),
    ))
}

async fn consume_verification_code(
    pool: &PgPool,
    state: &AppState,
    channel: &str,
    destination: &str,
    purpose: &str,
    code: &str,
) -> Result<()> {
    let code_hash = verification_code_hash(state, channel, destination, purpose, code)?;
    let consumed = sqlx::query_scalar::<_, Uuid>(
        r"
        UPDATE auth_verification_codes
        SET consumed_at = NOW()
        WHERE id = (
            SELECT id
            FROM auth_verification_codes
            WHERE channel = $1
              AND destination = $2
              AND purpose = $3
              AND code_hash = $4
              AND consumed_at IS NULL
              AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
        )
        RETURNING id
        ",
    )
    .bind(channel)
    .bind(destination)
    .bind(purpose)
    .bind(code_hash)
    .fetch_optional(pool)
    .await?;
    if consumed.is_some() {
        Ok(())
    } else {
        Err(HarnessError::Unauthorized(
            "invalid or expired verification code".to_owned(),
        ))
    }
}

async fn ensure_auth_account_available(
    pool: &PgPool,
    email: Option<&str>,
    phone: Option<&str>,
) -> Result<()> {
    let exists = sqlx::query_scalar::<_, bool>(
        r"
        SELECT EXISTS (
            SELECT 1
            FROM auth_accounts
            WHERE ($1::text IS NOT NULL AND lower(primary_email) = lower($1))
               OR ($2::text IS NOT NULL AND primary_phone = $2)
        )
        ",
    )
    .bind(email)
    .bind(phone)
    .fetch_one(pool)
    .await?;
    if exists {
        Err(HarnessError::InvalidInput(
            "account email or phone already exists".to_owned(),
        ))
    } else {
        Ok(())
    }
}

async fn fetch_account_tenant_for_destination(
    pool: &PgPool,
    channel: &str,
    destination: &str,
    tenant_id: Option<Uuid>,
) -> Result<Option<AuthAccountTenantRow>> {
    let row = sqlx::query_as::<_, AuthAccountTenantRow>(
        r"
        SELECT a.id AS account_id,
               at.tenant_id,
               at.person_id
        FROM auth_accounts a
        JOIN auth_account_tenants at ON at.account_id = a.id AND at.status = 'active'
        WHERE a.status = 'active'
          AND (
              ($1 = 'email' AND lower(a.primary_email) = lower($2))
              OR ($1 = 'phone' AND a.primary_phone = $2)
          )
          AND ($3::uuid IS NULL OR at.tenant_id = $3)
        ORDER BY at.created_at ASC
        LIMIT 1
        ",
    )
    .bind(channel)
    .bind(destination)
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

async fn set_tenant_in_tx(tx: &mut Transaction<'_, Postgres>, tenant_id: Uuid) -> Result<()> {
    sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut **tx)
        .await?;
    Ok(())
}

async fn ensure_default_iam_roles_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<()> {
    sqlx::query(
        r"
        INSERT INTO iam_roles (tenant_id, role_key, name, description, runtime_role, role_type)
        VALUES
            ($1, 'tenant_owner', '企业所有者', '企业级最高权限和安全配置责任人', 'admin', 'tenant'),
            ($1, 'executive_manager', '经营管理者', '企业经营和项目总控权限', 'admin', 'tenant'),
            ($1, 'finance_director', '财务负责人', '合同、成本、付款和发票审批权限', 'reviewer', 'tenant'),
            ($1, 'project_manager', '项目经理', '项目执行、任务分派和项目文件审批权限', 'engineer', 'project'),
            ($1, 'discipline_engineer', '专业工程师', '设计、BIM、工艺、造价、材料、物流、安全等专业执行权限', 'engineer', 'project'),
            ($1, 'reviewer', '审批复核人', '专业复核、审批和发布前检查权限', 'reviewer', 'project'),
            ($1, 'auditor', '审计观察者', '只读审计和证据查看权限', 'auditor', 'tenant')
        ON CONFLICT (tenant_id, role_key) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            runtime_role = EXCLUDED.runtime_role,
            role_type = EXCLUDED.role_type,
            updated_at = NOW()
        ",
    )
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        r"
        INSERT INTO iam_role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM iam_roles r
        JOIN iam_permissions p ON (
            r.role_key = 'tenant_owner'
            OR (r.role_key = 'executive_manager' AND p.id IN (
                'tenant.read','project.read','project.manage','finance.read',
                'bim.read','audit.read','ai.invoke'
            ))
            OR (r.role_key = 'finance_director' AND p.id IN (
                'tenant.read','project.read','finance.read','finance.approve','audit.read'
            ))
            OR (r.role_key = 'project_manager' AND p.id IN (
                'tenant.read','project.read','project.manage','bim.read','archive.write','ai.invoke'
            ))
            OR (r.role_key = 'discipline_engineer' AND p.id IN (
                'project.read','bim.read','bim.write','design.write','cost.write',
                'material.write','safety.write','archive.write','ai.invoke'
            ))
            OR (r.role_key = 'reviewer' AND p.id IN (
                'tenant.read','project.read','bim.read','finance.read','audit.read'
            ))
            OR (r.role_key = 'auditor' AND p.id IN (
                'tenant.read','project.read','bim.read','audit.read'
            ))
        )
        WHERE r.tenant_id = $1
        ON CONFLICT DO NOTHING
        ",
    )
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn assign_initial_job_title_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    person_id: Uuid,
    job_title: &str,
) -> Result<()> {
    let job_title_id = sqlx::query_scalar::<_, Option<Uuid>>(
        r"
        SELECT id
        FROM iam_job_titles
        WHERE tenant_id IS NULL AND name = $1
        ORDER BY sort_order ASC
        LIMIT 1
        ",
    )
    .bind(job_title)
    .fetch_optional(&mut **tx)
    .await?
    .flatten();
    let job_title_id = match job_title_id {
        Some(id) => id,
        None => {
            sqlx::query_scalar::<_, Uuid>(
                r"
                INSERT INTO iam_job_titles
                    (tenant_id, code, name, category, default_scope, is_system)
                VALUES ($1, $2, $3, 'custom', 'tenant', FALSE)
                ON CONFLICT (tenant_id, name) DO UPDATE
                SET updated_at = NOW()
                RETURNING id
                ",
            )
            .bind(tenant_id)
            .bind(format!("custom_{}", sha256_hex(job_title.as_bytes())))
            .bind(job_title)
            .fetch_one(&mut **tx)
            .await?
        }
    };
    sqlx::query(
        r"
        INSERT INTO iam_person_job_assignments
            (tenant_id, person_id, job_title_id, is_primary)
        VALUES ($1, $2, $3, TRUE)
        ",
    )
    .bind(tenant_id)
    .bind(person_id)
    .bind(job_title_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn fetch_runtime_roles_for_account_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    account_id: Uuid,
) -> Result<Vec<String>> {
    let mut roles = sqlx::query_scalar::<_, String>(
        r"
        SELECT DISTINCT r.runtime_role
        FROM iam_role_bindings rb
        JOIN iam_roles r ON r.id = rb.role_id AND r.tenant_id = rb.tenant_id
        WHERE rb.tenant_id = $1
          AND rb.principal_type = 'account'
          AND rb.principal_id = $2
          AND rb.starts_at <= NOW()
          AND (rb.expires_at IS NULL OR rb.expires_at > NOW())
        ORDER BY r.runtime_role
        ",
    )
    .bind(tenant_id)
    .bind(account_id)
    .fetch_all(&mut **tx)
    .await?;
    if roles.is_empty() {
        roles.push("auditor".to_owned());
    }
    Ok(roles)
}

async fn fetch_job_titles_for_person_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    person_id: Option<Uuid>,
) -> Result<Vec<String>> {
    let Some(person_id) = person_id else {
        return Ok(Vec::new());
    };
    let titles = sqlx::query_scalar::<_, String>(
        r"
        SELECT jt.name
        FROM iam_person_job_assignments pja
        JOIN iam_job_titles jt ON jt.id = pja.job_title_id
        WHERE pja.tenant_id = $1
          AND pja.person_id = $2
          AND (pja.ends_at IS NULL OR pja.ends_at > NOW())
        ORDER BY pja.is_primary DESC, jt.sort_order ASC, jt.name ASC
        ",
    )
    .bind(tenant_id)
    .bind(person_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(titles)
}

fn ensure_iam_admin_context(context: &RequestContext) -> Result<()> {
    PermissionGuard::ensure(context, RuntimePermission::RegistryWrite)?;
    if context.roles.contains(&RuntimeRole::Admin) {
        return Ok(());
    }
    Err(HarnessError::SandboxDenied(
        serde_json::json!({
            "allowed": false,
            "permission": "iam:admin",
            "actor": context.actor.clone(),
            "roles": context.roles.iter().map(ToString::to_string).collect::<Vec<_>>(),
            "tenantId": context.tenant_id.clone(),
            "projectId": context.project_id.clone(),
            "reason": "IAM role binding changes require runtime admin"
        })
        .to_string(),
    ))
}

async fn load_iam_summary_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<IamSummaryResponse> {
    let org_units = sqlx::query_as::<_, IamOrgUnitRow>(
        r"
        SELECT id, tenant_id, parent_id, unit_code, name, unit_type, status, sort_order
        FROM iam_org_units
        WHERE tenant_id = $1
        ORDER BY sort_order ASC, name ASC
        ",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    let people = sqlx::query_as::<_, IamPersonProfileRow>(
        r"
        SELECT id, tenant_id, account_id, org_unit_id, full_name, display_name,
               primary_phone, primary_email, employment_status, credential_summary
        FROM iam_person_profiles
        WHERE tenant_id = $1
        ORDER BY full_name ASC, created_at ASC
        ",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    let job_titles = sqlx::query_as::<_, IamJobTitleRow>(
        r"
        SELECT id, tenant_id, code, name, category, default_scope, is_system, sort_order
        FROM iam_job_titles
        WHERE tenant_id IS NULL OR tenant_id = $1
        ORDER BY tenant_id NULLS FIRST, sort_order ASC, name ASC
        ",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    let permissions = sqlx::query_as::<_, IamPermissionRow>(
        r"
        SELECT id, category, action, resource_type, description, risk_level
        FROM iam_permissions
        ORDER BY category ASC, id ASC
        ",
    )
    .fetch_all(&mut **tx)
    .await?;

    let roles = sqlx::query_as::<_, IamRoleRow>(
        r"
        SELECT r.id, r.tenant_id, r.role_key, r.name, r.description,
               r.runtime_role, r.role_type,
               COALESCE(
                   array_remove(array_agg(rp.permission_id ORDER BY rp.permission_id), NULL),
                   ARRAY[]::text[]
               ) AS permission_ids
        FROM iam_roles r
        LEFT JOIN iam_role_permissions rp ON rp.role_id = r.id
        WHERE r.tenant_id = $1
        GROUP BY r.id, r.tenant_id, r.role_key, r.name, r.description, r.runtime_role, r.role_type
        ORDER BY r.role_type ASC, r.name ASC
        ",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    let role_bindings = fetch_iam_role_bindings_in_tx(tx, tenant_id).await?;

    Ok(IamSummaryResponse {
        tenant_id,
        org_units,
        people,
        job_titles,
        permissions,
        roles,
        role_bindings,
    })
}

async fn fetch_iam_role_bindings_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<Vec<IamRoleBindingRow>> {
    sqlx::query_as::<_, IamRoleBindingRow>(
        r"
        SELECT rb.id,
               rb.tenant_id,
               rb.role_id,
               r.role_key,
               r.name AS role_name,
               r.runtime_role,
               rb.principal_type,
               rb.principal_id,
               COALESCE(pp.full_name, ou.name, a.primary_email, a.primary_phone, rb.principal_id::text) AS principal_name,
               rb.resource_type,
               rb.resource_id,
               rb.starts_at,
               rb.expires_at,
               rb.granted_by,
               rb.created_at
        FROM iam_role_bindings rb
        JOIN iam_roles r ON r.id = rb.role_id AND r.tenant_id = rb.tenant_id
        LEFT JOIN iam_person_profiles pp
          ON pp.tenant_id = rb.tenant_id
         AND (
              (rb.principal_type = 'person' AND pp.id = rb.principal_id)
              OR (rb.principal_type = 'account' AND pp.account_id = rb.principal_id)
         )
        LEFT JOIN auth_accounts a
          ON rb.principal_type = 'account' AND a.id = rb.principal_id
        LEFT JOIN iam_org_units ou
          ON rb.principal_type = 'org_unit' AND ou.id = rb.principal_id AND ou.tenant_id = rb.tenant_id
        WHERE rb.tenant_id = $1
        ORDER BY rb.created_at DESC, r.name ASC
        ",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}

async fn fetch_iam_role_binding_by_id_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    binding_id: Uuid,
) -> Result<IamRoleBindingRow> {
    let binding = fetch_iam_role_bindings_in_tx(tx, tenant_id)
        .await?
        .into_iter()
        .find(|binding| binding.id == binding_id)
        .ok_or_else(|| HarnessError::NotFound(format!("role_binding_id={binding_id}")))?;
    Ok(binding)
}

async fn resolve_iam_role_id_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    role_id: Option<Uuid>,
    role_key: Option<String>,
) -> Result<Uuid> {
    if let Some(role_id) = role_id {
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (SELECT 1 FROM iam_roles WHERE tenant_id = $1 AND id = $2)",
        )
        .bind(tenant_id)
        .bind(role_id)
        .fetch_one(&mut **tx)
        .await?;
        if exists {
            return Ok(role_id);
        }
        return Err(HarnessError::NotFound(format!("role_id={role_id}")));
    }

    let role_key = role_key
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| HarnessError::InvalidInput("roleId or roleKey is required".to_owned()))?;
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM iam_roles WHERE tenant_id = $1 AND role_key = $2")
        .bind(tenant_id)
        .bind(&role_key)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| HarnessError::NotFound(format!("role_key={role_key}")))
}

async fn ensure_iam_principal_exists_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    principal_type: &str,
    principal_id: Uuid,
) -> Result<()> {
    let exists = match principal_type {
        "account" => {
            sqlx::query_scalar::<_, bool>(
                r"
                SELECT EXISTS (
                    SELECT 1 FROM auth_account_tenants
                    WHERE tenant_id = $1 AND account_id = $2 AND status = 'active'
                )
                ",
            )
            .bind(tenant_id)
            .bind(principal_id)
            .fetch_one(&mut **tx)
            .await?
        }
        "person" => sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (SELECT 1 FROM iam_person_profiles WHERE tenant_id = $1 AND id = $2)",
        )
        .bind(tenant_id)
        .bind(principal_id)
        .fetch_one(&mut **tx)
        .await?,
        "org_unit" => {
            sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS (SELECT 1 FROM iam_org_units WHERE tenant_id = $1 AND id = $2)",
            )
            .bind(tenant_id)
            .bind(principal_id)
            .fetch_one(&mut **tx)
            .await?
        }
        _ => false,
    };
    if exists {
        Ok(())
    } else {
        Err(HarnessError::NotFound(format!(
            "{principal_type}_id={principal_id}"
        )))
    }
}

fn normalize_iam_principal_type(value: &str) -> Result<String> {
    match value.trim().to_ascii_lowercase().as_str() {
        "account" | "person" | "org_unit" => Ok(value.trim().to_ascii_lowercase()),
        other => Err(HarnessError::InvalidInput(format!(
            "unsupported IAM principal_type: {other}"
        ))),
    }
}

fn normalize_iam_resource_type(value: Option<String>) -> Result<String> {
    let resource_type = value
        .map(|candidate| candidate.trim().to_ascii_lowercase())
        .filter(|candidate| !candidate.is_empty())
        .unwrap_or_else(|| "tenant".to_owned());
    if resource_type
        .chars()
        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_')
    {
        Ok(resource_type)
    } else {
        Err(HarnessError::InvalidInput(format!(
            "invalid IAM resource_type: {resource_type}"
        )))
    }
}

async fn create_auth_session_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    state: &AppState,
    account_id: Uuid,
    tenant_id: Uuid,
    person_id: Option<Uuid>,
) -> Result<(String, Uuid)> {
    let token = random_hex::<32>()?;
    let token_hash = session_token_hash(state, &token)?;
    let session_id = Uuid::new_v4();
    let expires_at = Utc::now() + chrono::Duration::seconds(AUTH_SESSION_TTL_SECS);
    sqlx::query(
        r"
        INSERT INTO auth_sessions
            (id, account_id, tenant_id, person_id, token_hash, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ",
    )
    .bind(session_id)
    .bind(account_id)
    .bind(tenant_id)
    .bind(person_id)
    .bind(token_hash)
    .bind(expires_at)
    .execute(&mut **tx)
    .await?;
    Ok((token, session_id))
}

async fn login_or_create_oauth_account(
    state: &AppState,
    provider: &str,
    account_type: &str,
    profile: OAuthProfile,
) -> Result<OAuthAuthBundle> {
    let pool = db_pool(state)?;
    let mut tx = pool.begin().await?;

    let linked_account_id = sqlx::query_scalar::<_, Uuid>(
        r"
        SELECT account_id
        FROM auth_oauth_identities
        WHERE provider = $1 AND provider_subject = $2
        LIMIT 1
        ",
    )
    .bind(provider)
    .bind(&profile.subject)
    .fetch_optional(&mut *tx)
    .await?;

    let email_account_id = match (&linked_account_id, profile.email.as_deref()) {
        (None, Some(email)) => {
            sqlx::query_scalar::<_, Uuid>(
                r"
                SELECT id
                FROM auth_accounts
                WHERE lower(primary_email) = lower($1) AND status = 'active'
                LIMIT 1
                ",
            )
            .bind(email)
            .fetch_optional(&mut *tx)
            .await?
        }
        _ => None,
    };

    let account_id = match linked_account_id.or(email_account_id) {
        Some(account_id) => account_id,
        None => {
            create_oauth_account_in_tx(&mut tx, state, provider, account_type, &profile).await?
        }
    };

    let account_tenant = fetch_or_create_oauth_account_tenant_in_tx(
        &mut tx,
        state,
        account_id,
        provider,
        account_type,
        &profile,
    )
    .await?;
    set_tenant_in_tx(&mut tx, account_tenant.tenant_id).await?;

    sqlx::query(
        r"
        INSERT INTO auth_oauth_identities
            (provider, provider_subject, account_id, email, phone, display_name, avatar_url, raw_profile, last_login_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (provider, provider_subject) DO UPDATE
        SET account_id = EXCLUDED.account_id,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            display_name = EXCLUDED.display_name,
            avatar_url = EXCLUDED.avatar_url,
            raw_profile = EXCLUDED.raw_profile,
            last_login_at = NOW(),
            updated_at = NOW()
        ",
    )
    .bind(provider)
    .bind(&profile.subject)
    .bind(account_id)
    .bind(&profile.email)
    .bind(&profile.phone)
    .bind(&profile.display_name)
    .bind(&profile.avatar_url)
    .bind(&profile.raw_profile)
    .execute(&mut *tx)
    .await?;

    let runtime_roles =
        fetch_runtime_roles_for_account_in_tx(&mut tx, account_tenant.tenant_id, account_id)
            .await?;
    let (session_token, _session_id) = create_auth_session_in_tx(
        &mut tx,
        state,
        account_id,
        account_tenant.tenant_id,
        account_tenant.person_id,
    )
    .await?;
    tx.commit().await?;

    let access_token =
        create_auth_access_token(state, account_id, account_tenant.tenant_id, &runtime_roles)?;
    Ok(OAuthAuthBundle {
        access_token,
        session_token,
    })
}

async fn create_oauth_account_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    state: &AppState,
    provider: &str,
    account_type: &str,
    profile: &OAuthProfile,
) -> Result<Uuid> {
    let account_id = Uuid::new_v4();
    sqlx::query(
        r"
        INSERT INTO auth_accounts
            (id, primary_email, primary_phone, primary_oauth_provider, primary_oauth_subject, status)
        VALUES ($1, $2, $3, $4, $5, 'active')
        ",
    )
    .bind(account_id)
    .bind(&profile.email)
    .bind(&profile.phone)
    .bind(provider)
    .bind(&profile.subject)
    .execute(&mut **tx)
    .await?;
    let account_tenant =
        create_oauth_account_tenant_in_tx(tx, state, account_id, provider, account_type, profile)
            .await?;
    set_tenant_in_tx(tx, account_tenant.tenant_id).await?;
    Ok(account_id)
}

async fn fetch_or_create_oauth_account_tenant_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    state: &AppState,
    account_id: Uuid,
    provider: &str,
    account_type: &str,
    profile: &OAuthProfile,
) -> Result<AuthAccountTenantRow> {
    if let Some(row) = sqlx::query_as::<_, AuthAccountTenantRow>(
        r"
        SELECT account_id, tenant_id, person_id
        FROM auth_account_tenants
        WHERE account_id = $1 AND status = 'active'
        ORDER BY created_at ASC
        LIMIT 1
        ",
    )
    .bind(account_id)
    .fetch_optional(&mut **tx)
    .await?
    {
        return Ok(row);
    }
    create_oauth_account_tenant_in_tx(tx, state, account_id, provider, account_type, profile).await
}

async fn create_oauth_account_tenant_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    state: &AppState,
    account_id: Uuid,
    provider: &str,
    account_type: &str,
    profile: &OAuthProfile,
) -> Result<AuthAccountTenantRow> {
    let tenant_id = Uuid::new_v4();
    let person_id = Uuid::new_v4();
    let provider_label = oauth_provider_spec(provider)?.label;
    let display_name = profile
        .display_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(provider_label);
    let tenant_name = if account_type == "enterprise" {
        format!("{display_name}的企业")
    } else {
        format!("{display_name}的工作区")
    };
    sqlx::query(
        r"
        INSERT INTO tenants (id, name, locale, region)
        VALUES ($1, $2, 'zh-CN', 'cn')
        ",
    )
    .bind(tenant_id)
    .bind(&tenant_name)
    .execute(&mut **tx)
    .await?;

    set_tenant_in_tx(tx, tenant_id).await?;
    ensure_default_iam_roles_in_tx(tx, tenant_id).await?;

    sqlx::query(
        r"
        INSERT INTO iam_person_profiles
            (id, tenant_id, account_id, full_name, display_name, primary_phone, primary_email)
        VALUES ($1, $2, $3, $4, $4, $5, $6)
        ",
    )
    .bind(person_id)
    .bind(tenant_id)
    .bind(account_id)
    .bind(display_name)
    .bind(&profile.phone)
    .bind(&profile.email)
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        r"
        INSERT INTO auth_account_tenants (account_id, tenant_id, person_id, status)
        VALUES ($1, $2, $3, 'active')
        ",
    )
    .bind(account_id)
    .bind(tenant_id)
    .bind(person_id)
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        r"
        INSERT INTO iam_role_bindings
            (tenant_id, role_id, principal_type, principal_id, resource_type, resource_id)
        SELECT $1, id, 'account', $2, 'tenant', $1
        FROM iam_roles
        WHERE tenant_id = $1 AND role_key = 'tenant_owner'
        ON CONFLICT DO NOTHING
        ",
    )
    .bind(tenant_id)
    .bind(account_id)
    .execute(&mut **tx)
    .await?;

    // Keep external sign-in usable immediately, then let IAM admins refine roles.
    let _ = state;
    Ok(AuthAccountTenantRow {
        account_id,
        tenant_id,
        person_id: Some(person_id),
    })
}

fn runtime_roles_to_claim_roles(runtime_roles: &[String]) -> Vec<Role> {
    let mut roles = runtime_roles
        .iter()
        .map(|role| match role.as_str() {
            "admin" => Role::Admin,
            "reviewer" => Role::Supervisor,
            "engineer" => Role::Designer,
            "auditor" => Role::Auditor,
            _ => Role::Auditor,
        })
        .collect::<Vec<_>>();
    roles.sort_by_key(|role| format!("{role:?}"));
    roles.dedup();
    if roles.is_empty() {
        roles.push(Role::Auditor);
    }
    roles
}

fn create_auth_access_token(
    state: &AppState,
    account_id: Uuid,
    tenant_id: Uuid,
    runtime_roles: &[String],
) -> Result<String> {
    let iat = Utc::now().timestamp();
    let exp = iat
        .checked_add(i64::try_from(state.cfg.auth.jwt_expiry_secs).unwrap_or(i64::MAX))
        .ok_or_else(|| HarnessError::Internal("JWT expiry overflow".to_owned()))?;
    let claims = Claims {
        sub: account_id.to_string(),
        tenant_id,
        roles: runtime_roles_to_claim_roles(runtime_roles),
        iss: state.cfg.auth.jwt_issuer.clone(),
        exp: u64::try_from(exp)
            .map_err(|_| HarnessError::Internal("JWT exp is negative".to_owned()))?,
        iat: u64::try_from(iat)
            .map_err(|_| HarnessError::Internal("JWT iat is negative".to_owned()))?,
    };
    jsonwebtoken::encode(
        &Header::new(jsonwebtoken::Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(state.cfg.auth.jwt_secret.as_bytes()),
    )
    .map_err(|err| HarnessError::Internal(format!("JWT signing failed: {err}")))
}

fn session_cookie(token: &str, profile: RuntimeProfile) -> String {
    let secure = if matches!(profile, RuntimeProfile::Production) {
        "; Secure"
    } else {
        ""
    };
    format!(
        "{AUTH_SESSION_COOKIE}={token}; Path=/; Max-Age={AUTH_SESSION_TTL_SECS}; HttpOnly; SameSite=Strict{secure}"
    )
}

fn access_cookie(token: &str, profile: RuntimeProfile, max_age_secs: u64) -> String {
    let secure = if matches!(profile, RuntimeProfile::Production) {
        "; Secure"
    } else {
        ""
    };
    format!(
        "{AUTH_ACCESS_COOKIE}={token}; Path=/; Max-Age={max_age_secs}; HttpOnly; SameSite=Strict{secure}"
    )
}

fn expired_session_cookie(profile: RuntimeProfile) -> String {
    let secure = if matches!(profile, RuntimeProfile::Production) {
        "; Secure"
    } else {
        ""
    };
    format!("{AUTH_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict{secure}")
}

fn expired_access_cookie(profile: RuntimeProfile) -> String {
    let secure = if matches!(profile, RuntimeProfile::Production) {
        "; Secure"
    } else {
        ""
    };
    format!("{AUTH_ACCESS_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict{secure}")
}

fn json_with_auth_cookies<T: Serialize>(
    body: T,
    session_token: &str,
    access_token: &str,
    profile: RuntimeProfile,
    access_max_age_secs: u64,
) -> Result<Response> {
    let mut response = Json(body).into_response();
    response.headers_mut().append(
        SET_COOKIE,
        HeaderValue::from_str(&session_cookie(session_token, profile))
            .map_err(|err| HarnessError::Internal(format!("invalid session cookie: {err}")))?,
    );
    response.headers_mut().append(
        SET_COOKIE,
        HeaderValue::from_str(&access_cookie(access_token, profile, access_max_age_secs))
            .map_err(|err| HarnessError::Internal(format!("invalid access cookie: {err}")))?,
    );
    Ok(response)
}

fn redirect_with_auth_cookies(
    location: &str,
    session_token: &str,
    access_token: &str,
    profile: RuntimeProfile,
    access_max_age_secs: u64,
) -> Result<Response> {
    let mut response = Redirect::temporary(location).into_response();
    response.headers_mut().append(
        SET_COOKIE,
        HeaderValue::from_str(&session_cookie(session_token, profile))
            .map_err(|err| HarnessError::Internal(format!("invalid session cookie: {err}")))?,
    );
    response.headers_mut().append(
        SET_COOKIE,
        HeaderValue::from_str(&access_cookie(access_token, profile, access_max_age_secs))
            .map_err(|err| HarnessError::Internal(format!("invalid access cookie: {err}")))?,
    );
    Ok(response)
}

fn session_token_from_headers(headers: &HeaderMap) -> Option<String> {
    cookie_value(headers, AUTH_SESSION_COOKIE)
}

fn cookie_value(headers: &HeaderMap, cookie_name: &str) -> Option<String> {
    headers
        .get(COOKIE)
        .and_then(|value| value.to_str().ok())
        .and_then(|cookie_header| {
            cookie_header.split(';').find_map(|part| {
                let (name, value) = part.trim().split_once('=')?;
                (name == cookie_name && !value.is_empty()).then(|| value.to_owned())
            })
        })
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
        let file =
            postgres_runtime_store::create_module_file(pool, &context, &module_id, req).await?;
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

async fn update_file_validation_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(file_id): Path<String>,
    Json(req): Json<UpdateFileValidationRequest>,
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
        return postgres_runtime_store::update_module_file_validation(pool, &context, file_id, req)
            .await
            .map(Json);
    }
    state.files.update_validation(file_id, req).map(Json)
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
        let file = postgres_runtime_store::copy_module_file(pool, &context, file_id, req).await?;
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
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Query(query): Query<TransactionListQuery>,
) -> Result<Json<ModuleTransactionListResponse>> {
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        let page = postgres_runtime_store::list_module_transactions(pool, &context, &query).await?;
        return Ok(Json(ModuleTransactionListResponse {
            total: page.items.len(),
            transactions: page.items,
            page_info: page.page_info,
        }));
    }
    let page = state.lifecycle.list_transactions(&query)?;
    Ok(Json(ModuleTransactionListResponse {
        total: page.items.len(),
        transactions: page.items,
        page_info: page.page_info,
    }))
}

async fn create_transaction_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Json(req): Json<CreateModuleTransactionRequest>,
) -> Result<(StatusCode, Json<ModuleTransaction>)> {
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
        let transaction =
            postgres_runtime_store::create_module_transaction(pool, &context, req).await?;
        return Ok((StatusCode::CREATED, Json(transaction)));
    }
    let transaction = state.lifecycle.create_transaction(req)?;
    Ok((StatusCode::CREATED, Json(transaction)))
}

async fn get_transaction_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(transaction_id): Path<String>,
) -> Result<Json<ModuleTransaction>> {
    let transaction_id = parse_uuid(&transaction_id, "transaction_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    if let Some(pool) = state.db_pool.as_deref() {
        return postgres_runtime_store::get_module_transaction(pool, &context, transaction_id)
            .await
            .map(Json);
    }
    state.lifecycle.get_transaction(transaction_id).map(Json)
}

async fn transition_transaction_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(transaction_id): Path<String>,
    Json(req): Json<ModuleTransitionRequest>,
) -> Result<Json<ModuleTransaction>> {
    let transaction_id = parse_uuid(&transaction_id, "transaction_id")?;
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
        return postgres_runtime_store::transition_module_transaction(
            pool,
            &context,
            transaction_id,
            req,
        )
        .await
        .map(Json);
    }
    state.lifecycle.transition(transaction_id, req).map(Json)
}

async fn approve_transaction_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(transaction_id): Path<String>,
    Json(req): Json<ApprovalDecisionRequest>,
) -> Result<Json<ModuleTransaction>> {
    let transaction_id = parse_uuid(&transaction_id, "transaction_id")?;
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
        return postgres_runtime_store::approve_module_transaction(
            pool,
            &context,
            transaction_id,
            req,
        )
        .await
        .map(Json);
    }
    state.lifecycle.approve(transaction_id, req).map(Json)
}

async fn reject_transaction_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(transaction_id): Path<String>,
    Json(req): Json<ApprovalDecisionRequest>,
) -> Result<Json<ModuleTransaction>> {
    let transaction_id = parse_uuid(&transaction_id, "transaction_id")?;
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
        return postgres_runtime_store::reject_module_transaction(
            pool,
            &context,
            transaction_id,
            req,
        )
        .await
        .map(Json);
    }
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

async fn get_bim_model_semantics_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    RawQuery(raw_query): RawQuery,
    Path(asset_id): Path<String>,
) -> Result<Json<BimSemanticReadinessResponse>> {
    let asset_id = parse_uuid(&asset_id, "asset_id")?;
    let context = request_context(
        &state,
        &headers,
        raw_query.as_deref(),
        RequestContextInput::default(),
    )?;
    let query = ConversionJobQuery::default();
    if let Some(pool) = state.db_pool.as_deref() {
        postgres_runtime_store::get_asset(pool, &context, asset_id).await?;
        let jobs = postgres_runtime_store::list_conversion_jobs(pool, &context, &query)
            .await?
            .jobs;
        let latest = latest_ifc_ingest_job_for_asset(&jobs, asset_id);
        return Ok(Json(build_bim_semantics_readiness_response(
            asset_id, latest, &jobs,
        )));
    }
    state.assets.get_asset_with_context(&context, asset_id)?;
    let jobs = state
        .assets
        .list_conversion_jobs_with_context(&context, &query)?
        .items;
    let latest = latest_ifc_ingest_job_for_asset(&jobs, asset_id);
    Ok(Json(build_bim_semantics_readiness_response(
        asset_id, latest, &jobs,
    )))
}

fn latest_ifc_ingest_job_for_asset(
    jobs: &[ConversionJobRecord],
    asset_id: Uuid,
) -> Option<&ConversionJobRecord> {
    let mut candidates = jobs
        .iter()
        .filter(|job| job.source_asset_id == asset_id)
        .filter(|job| job.operation == ConversionOperation::IfcIngest)
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| {
        conversion_job_sort_time(left)
            .cmp(&conversion_job_sort_time(right))
            .then_with(|| left.job_id.as_u128().cmp(&right.job_id.as_u128()))
    });
    candidates.pop()
}

fn conversion_job_sort_time(job: &ConversionJobRecord) -> DateTime<Utc> {
    job.finished_at
        .or(job.started_at)
        .unwrap_or(job.metadata.updated_at)
}

fn build_bim_semantics_readiness_response(
    asset_id: Uuid,
    ingest_job: Option<&ConversionJobRecord>,
    all_jobs: &[ConversionJobRecord],
) -> BimSemanticReadinessResponse {
    let required_evidence = aggregate_openbim_required_evidence(asset_id, all_jobs);
    let evidence_artifacts = openbim_artifacts_for_asset(asset_id, all_jobs);
    let Some(job) = ingest_job else {
        let missing_evidence = evidence_keys_by_status(&required_evidence, &["required_pending"]);
        let failed_evidence = failed_evidence_keys(&required_evidence);
        let missing_claim_evidence = evidence_keys_by_scope_status(
            &required_evidence,
            OpenBimEvidenceScope::Claim,
            &["required_pending"],
        );
        let open_bim_claim = serde_json::json!({
            "status": "ifc_ingest_required",
            "mayEnterBuildingSmartOpenBimReview": false,
            "mayClaimBuildingSmartOpenBim": false,
            "missingEvidence": missing_evidence.clone(),
            "failedEvidence": failed_evidence.clone(),
            "missingClaimEvidence": missing_claim_evidence,
            "failedClaimEvidence": [],
            "claimAuthority": "Approver must issue the final claim after reviewing linked evidence and audit state."
        });
        return BimSemanticReadinessResponse {
            asset_id,
            source_asset_id: None,
            source_file_id: None,
            ingest_job_id: None,
            conversion_status: None,
            readiness_status: "ifc_ingest_required".to_owned(),
            semantics: serde_json::json!({
                "schema": "architoken.bim_semantics_manifest.v1",
                "status": "ifc_ingest_required",
                "message": "Run an ifc_ingest conversion job before OpenBIM readiness can be evaluated."
            }),
            semantic_layers: serde_json::Value::Array(Vec::new()),
            required_evidence,
            open_bim_claim,
            missing_evidence,
            failed_evidence,
            artifacts: evidence_artifacts,
        };
    };

    let missing_semantics_status = missing_bim_semantics_status(&job.status);
    let has_semantics = job.output.get("semantics").is_some();
    let mut semantics = job.output.get("semantics").cloned().unwrap_or_else(|| {
        serde_json::json!({
            "schema": "architoken.bim_semantics_manifest.v1",
            "status": missing_semantics_status,
            "message": "The latest ifc_ingest job did not publish a bim_semantics_manifest."
        })
    });
    let open_bim_claim = if job.status != "completed" || !has_semantics {
        let status = missing_bim_semantics_status(&job.status);
        serde_json::json!({
            "status": status,
            "mayEnterBuildingSmartOpenBimReview": false,
            "mayClaimBuildingSmartOpenBim": false,
            "missingEvidence": evidence_keys_by_status(&required_evidence, &["required_pending"]),
            "failedEvidence": failed_evidence_keys(&required_evidence),
            "missingClaimEvidence": evidence_keys_by_scope_status(&required_evidence, OpenBimEvidenceScope::Claim, &["required_pending"]),
            "failedClaimEvidence": failed_evidence_keys_by_scope(&required_evidence, OpenBimEvidenceScope::Claim),
            "claimAuthority": "Approver must issue the final claim after reviewing linked evidence and audit state."
        })
    } else {
        build_openbim_claim_from_required_evidence(&required_evidence)
    };
    if let Some(object) = semantics.as_object_mut() {
        object.insert("requiredEvidence".to_owned(), required_evidence.clone());
        object.insert("openBimClaim".to_owned(), open_bim_claim.clone());
        object.insert(
            "evidenceAggregation".to_owned(),
            serde_json::json!({
                "source": "conversion_jobs",
                "assetId": asset_id,
                "ifcIngestJobId": job.job_id,
            }),
        );
    }
    let readiness_status = open_bim_claim
        .get("status")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("semantic_manifest_missing")
        .to_owned();
    let missing_evidence = open_bim_claim
        .get("missingEvidence")
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let failed_evidence = open_bim_claim
        .get("failedEvidence")
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let semantic_layers = semantics
        .get("semanticLayers")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(Vec::new()));

    BimSemanticReadinessResponse {
        asset_id,
        source_asset_id: Some(job.source_asset_id),
        source_file_id: Some(job.source_file_id),
        ingest_job_id: Some(job.job_id),
        conversion_status: Some(job.status.clone()),
        readiness_status,
        semantics,
        semantic_layers,
        required_evidence,
        open_bim_claim,
        missing_evidence,
        failed_evidence,
        artifacts: evidence_artifacts,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OpenBimEvidenceScope {
    Review,
    Claim,
}

impl OpenBimEvidenceScope {
    const fn as_str(self) -> &'static str {
        match self {
            Self::Review => "review",
            Self::Claim => "claim",
        }
    }
}

#[derive(Debug, Clone, Copy)]
struct OpenBimEvidenceSpec {
    key: &'static str,
    artifact: &'static str,
    operation: Option<ConversionOperation>,
    reason: &'static str,
    scope: OpenBimEvidenceScope,
}

const OPENBIM_EVIDENCE_SPECS: [OpenBimEvidenceSpec; 9] = [
    OpenBimEvidenceSpec {
        key: "idsValidation",
        artifact: "ids_validation_report.json",
        operation: Some(ConversionOperation::OpenbimValidate),
        reason: "IDS validation report is required before claiming buildingSMART openBIM compliance.",
        scope: OpenBimEvidenceScope::Review,
    },
    OpenBimEvidenceSpec {
        key: "buildingSmartValidate",
        artifact: "buildingsmart_validate_report.json",
        operation: Some(ConversionOperation::OpenbimValidate),
        reason: "Official buildingSMART Validate service or CLI evidence is required before claiming IFC syntax/schema/normative validation.",
        scope: OpenBimEvidenceScope::Review,
    },
    OpenBimEvidenceSpec {
        key: "bsddClassification",
        artifact: "bsdd_classification_report.json",
        operation: Some(ConversionOperation::BsddEnrich),
        reason: "bSDD or approved standard-dictionary mapping evidence is required for semantic terms and URI mappings.",
        scope: OpenBimEvidenceScope::Review,
    },
    OpenBimEvidenceSpec {
        key: "bcfIssueClosure",
        artifact: "bcf_manifest.json",
        operation: Some(ConversionOperation::BcfIngest),
        reason: "BCF-compatible issue, clash, viewpoint, responsibility, and closure evidence is required.",
        scope: OpenBimEvidenceScope::Review,
    },
    OpenBimEvidenceSpec {
        key: "idmExchangeRequirements",
        artifact: "idm_manifest.json",
        operation: Some(ConversionOperation::IdmIngest),
        reason: "IDM exchange requirements are required to prove who exchanges what information and when.",
        scope: OpenBimEvidenceScope::Review,
    },
    OpenBimEvidenceSpec {
        key: "approvalAuditChain",
        artifact: "approval_audit_chain.json",
        operation: None,
        reason: "Approval, version, responsible party, close-state, and audit-chain evidence is required.",
        scope: OpenBimEvidenceScope::Review,
    },
    OpenBimEvidenceSpec {
        key: "fullChainSampleValidation",
        artifact: "openbim_full_chain_sample_report.json",
        operation: None,
        reason: "A real project IFC+IDS+bSDD+BCF+IDM full-chain sample validation report is required.",
        scope: OpenBimEvidenceScope::Review,
    },
    OpenBimEvidenceSpec {
        key: "openCdeApiContract",
        artifact: "opencde_api_contract_report.json",
        operation: None,
        reason: "OpenCDE Foundation/Documents, BCF API, and Dictionaries API end-to-end contract evidence is required.",
        scope: OpenBimEvidenceScope::Review,
    },
    OpenBimEvidenceSpec {
        key: "buildingSmartCertification",
        artifact: "buildingsmart_certification_report.json",
        operation: None,
        reason: "Official buildingSMART certification or conformance-report evidence is required before external claim.",
        scope: OpenBimEvidenceScope::Claim,
    },
];

fn aggregate_openbim_required_evidence(
    asset_id: Uuid,
    jobs: &[ConversionJobRecord],
) -> serde_json::Value {
    let mut evidence = serde_json::Map::new();
    for spec in OPENBIM_EVIDENCE_SPECS {
        evidence.insert(
            spec.key.to_owned(),
            openbim_evidence_from_jobs(asset_id, jobs, spec),
        );
    }
    serde_json::Value::Object(evidence)
}

fn openbim_evidence_from_jobs(
    asset_id: Uuid,
    jobs: &[ConversionJobRecord],
    spec: OpenBimEvidenceSpec,
) -> serde_json::Value {
    let Some(job) = latest_openbim_evidence_job(asset_id, jobs, spec) else {
        return serde_json::json!({
            "status": "required_pending",
            "artifact": spec.artifact,
            "required": true,
            "scope": spec.scope.as_str(),
            "reason": spec.reason,
        });
    };
    let artifact = job_artifact_by_name(job, spec.artifact);
    let has_output_pointer = output_pointer_present(job, spec);
    let status = if job.status != "completed" {
        format!("job_{}", job.status)
    } else if evidence_not_executed(job, spec) {
        "not_executed".to_owned()
    } else if artifact.is_none() && !has_output_pointer {
        "artifact_missing".to_owned()
    } else if evidence_failed(job, spec) {
        "failed".to_owned()
    } else {
        "ready".to_owned()
    };
    let mut payload = serde_json::json!({
        "status": status,
        "artifact": spec.artifact,
        "required": true,
        "scope": spec.scope.as_str(),
        "jobId": job.job_id,
        "operation": job.operation,
        "conversionStatus": job.status,
        "passed": job.output.get("passed").cloned(),
        "reason": evidence_reason(job, spec, &status),
    });
    if let Some(artifact) = artifact
        && let Some(object) = payload.as_object_mut()
    {
        object.insert("workerArtifact".to_owned(), artifact.clone());
    }
    payload
}

fn latest_openbim_evidence_job(
    asset_id: Uuid,
    jobs: &[ConversionJobRecord],
    spec: OpenBimEvidenceSpec,
) -> Option<&ConversionJobRecord> {
    let mut candidates = jobs
        .iter()
        .filter(|job| job.source_asset_id == asset_id)
        .filter(|job| {
            spec.operation
                .is_none_or(|operation| job.operation == operation)
        })
        .filter(|job| job_matches_openbim_evidence_spec(job, spec))
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| {
        conversion_job_sort_time(left)
            .cmp(&conversion_job_sort_time(right))
            .then_with(|| left.job_id.as_u128().cmp(&right.job_id.as_u128()))
    });
    candidates.pop()
}

fn job_matches_openbim_evidence_spec(job: &ConversionJobRecord, spec: OpenBimEvidenceSpec) -> bool {
    if job_artifact_by_name(job, spec.artifact).is_some() || output_pointer_present(job, spec) {
        return true;
    }
    match spec.key {
        "idsValidation" => {
            job.input.get("adapter").and_then(serde_json::Value::as_str) == Some("ids")
                || job
                    .output
                    .get("standard")
                    .and_then(serde_json::Value::as_str)
                    == Some("IDS")
        }
        "buildingSmartValidate" => {
            job.input.get("adapter").and_then(serde_json::Value::as_str)
                == Some("buildingsmart_validate")
                || job
                    .output
                    .get("standard")
                    .and_then(serde_json::Value::as_str)
                    == Some("buildingSMART Validate")
        }
        "approvalAuditChain" => false,
        "fullChainSampleValidation" | "openCdeApiContract" | "buildingSmartCertification" => false,
        _ => spec
            .operation
            .is_some_and(|operation| job.operation == operation),
    }
}

fn job_artifact_by_name<'a>(
    job: &'a ConversionJobRecord,
    name: &str,
) -> Option<&'a serde_json::Value> {
    job.output
        .get("artifacts")
        .and_then(serde_json::Value::as_array)
        .and_then(|artifacts| {
            artifacts.iter().find(|artifact| {
                artifact.get("name").and_then(serde_json::Value::as_str) == Some(name)
            })
        })
}

fn output_pointer_present(job: &ConversionJobRecord, spec: OpenBimEvidenceSpec) -> bool {
    match spec.key {
        "idsValidation" | "buildingSmartValidate" => job
            .output
            .get("reportPath")
            .and_then(serde_json::Value::as_str)
            .is_some_and(|path| path.contains(spec.artifact)),
        "bsddClassification" => job
            .output
            .get("sourceUrl")
            .and_then(serde_json::Value::as_str)
            .is_some(),
        "idmExchangeRequirements" => job
            .output
            .get("manifestPath")
            .and_then(serde_json::Value::as_str)
            .is_some_and(|path| path.contains(spec.artifact)),
        "fullChainSampleValidation" | "openCdeApiContract" | "buildingSmartCertification" => job
            .output
            .get("reportPath")
            .and_then(serde_json::Value::as_str)
            .is_some_and(|path| path.contains(spec.artifact)),
        _ => false,
    }
}

fn evidence_not_executed(job: &ConversionJobRecord, spec: OpenBimEvidenceSpec) -> bool {
    match spec.key {
        "idsValidation" => {
            job.output
                .get("passed")
                .is_none_or(serde_json::Value::is_null)
                || job.output.get("reason").is_some()
        }
        "buildingSmartValidate" => !official_buildingsmart_validate_executed(&job.output),
        "bsddClassification" => job.output.get("reason").is_some(),
        "idmExchangeRequirements" => {
            job.output
                .get("machineReadable")
                .and_then(serde_json::Value::as_bool)
                == Some(false)
        }
        "fullChainSampleValidation" => {
            job.output.get("sourceIfcChecksum").is_none()
                || job.output.get("chainArtifacts").is_none()
        }
        "openCdeApiContract" => job.output.get("contractSuite").is_none(),
        "buildingSmartCertification" => {
            job.output.get("issuedBy").is_none()
                || job.output.get("certificateId").is_none()
                || job.output.get("reportUrl").is_none()
        }
        _ => false,
    }
}

fn evidence_failed(job: &ConversionJobRecord, spec: OpenBimEvidenceSpec) -> bool {
    match spec.key {
        "idsValidation" | "buildingSmartValidate" => {
            job.output
                .get("passed")
                .and_then(serde_json::Value::as_bool)
                == Some(false)
        }
        "approvalAuditChain" => job
            .output
            .get("approvalState")
            .and_then(serde_json::Value::as_str)
            .is_some_and(|state| !matches!(state, "approved" | "closed" | "certified")),
        "fullChainSampleValidation" | "openCdeApiContract" => {
            job.output
                .get("passed")
                .and_then(serde_json::Value::as_bool)
                == Some(false)
        }
        "buildingSmartCertification" => !building_smart_certification_authorized(&job.output),
        _ => false,
    }
}

fn official_buildingsmart_validate_executed(output: &serde_json::Value) -> bool {
    output
        .get("serviceExecuted")
        .and_then(serde_json::Value::as_bool)
        == Some(true)
        || output
            .get("cliExecuted")
            .and_then(serde_json::Value::as_bool)
            == Some(true)
        || output
            .get("officialReportUrl")
            .and_then(serde_json::Value::as_str)
            .is_some()
}

fn building_smart_certification_authorized(output: &serde_json::Value) -> bool {
    let status = output
        .get("status")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    let issuer = output
        .get("issuedBy")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
        .to_ascii_lowercase();
    matches!(status, "certified" | "passed" | "approved")
        && issuer.contains("buildingsmart")
        && output
            .get("certificateId")
            .and_then(serde_json::Value::as_str)
            .is_some_and(|value| !value.trim().is_empty())
        && output
            .get("reportUrl")
            .and_then(serde_json::Value::as_str)
            .is_some_and(|value| {
                Url::parse(value).ok().is_some_and(|url| {
                    url.scheme() == "https"
                        && url.host_str().is_some_and(|host| {
                            host.eq_ignore_ascii_case("buildingsmart.org")
                                || host.ends_with(".buildingsmart.org")
                        })
                })
            })
}

fn evidence_reason(
    job: &ConversionJobRecord,
    spec: OpenBimEvidenceSpec,
    status: &str,
) -> Option<String> {
    match status {
        "ready" => None,
        "required_pending" => Some(spec.reason.to_owned()),
        "not_executed" => job
            .output
            .get("reason")
            .and_then(serde_json::Value::as_str)
            .map(ToOwned::to_owned)
            .or_else(|| {
                Some(format!(
                    "{} was present but not machine-executable.",
                    spec.key
                ))
            }),
        "artifact_missing" => Some(format!(
            "{} completed without the required artifact {}.",
            spec.key, spec.artifact
        )),
        "failed" => Some(format!("{} reported failed validation.", spec.key)),
        other if other.starts_with("job_") => Some(format!(
            "{} conversion job is {}.",
            spec.key,
            other.trim_start_matches("job_")
        )),
        _ => Some(spec.reason.to_owned()),
    }
}

fn build_openbim_claim_from_required_evidence(evidence: &serde_json::Value) -> serde_json::Value {
    let missing = evidence_keys_by_scope_status(
        evidence,
        OpenBimEvidenceScope::Review,
        &["required_pending"],
    );
    let failed = failed_evidence_keys_by_scope(evidence, OpenBimEvidenceScope::Review);
    let missing_claim =
        evidence_keys_by_scope_status(evidence, OpenBimEvidenceScope::Claim, &["required_pending"]);
    let failed_claim = failed_evidence_keys_by_scope(evidence, OpenBimEvidenceScope::Claim);
    let may_enter_review = missing.is_empty() && failed.is_empty();
    let may_claim = may_enter_review && missing_claim.is_empty() && failed_claim.is_empty();
    let status = if !missing.is_empty() {
        "blocked_pending_required_evidence"
    } else if !failed.is_empty() {
        "blocked_failed_required_evidence"
    } else if !failed_claim.is_empty() {
        "ready_for_openbim_review_claim_blocked"
    } else if !missing_claim.is_empty() {
        "ready_for_openbim_review"
    } else {
        "buildingSMART_openBIM_claim_authorized"
    };
    serde_json::json!({
        "status": status,
        "mayEnterBuildingSmartOpenBimReview": may_enter_review,
        "mayClaimBuildingSmartOpenBim": may_claim,
        "claimAuthority": "Approver may issue an external claim only after review evidence, official buildingSMART certification/conformance evidence, and audit closure are linked.",
        "missingEvidence": missing,
        "failedEvidence": failed,
        "missingClaimEvidence": missing_claim,
        "failedClaimEvidence": failed_claim,
        "rule": "IFC semantic extraction is necessary but not sufficient; IDS, official buildingSMART Validate, bSDD/standard dictionary, BCF/issue closure, IDM, approval/audit, real full-chain sample, and OpenCDE/API contract evidence must be linked and non-failing before review. External buildingSMART claims also require official certification or conformance-report evidence."
    })
}

fn failed_evidence_keys_by_scope(
    evidence: &serde_json::Value,
    scope: OpenBimEvidenceScope,
) -> Vec<String> {
    let missing = evidence_keys_by_scope_status(evidence, scope, &["required_pending"]);
    evidence_keys_by_scope_not_ready(evidence, scope)
        .into_iter()
        .filter(|key| !missing.contains(key))
        .collect()
}

fn evidence_keys_by_status(evidence: &serde_json::Value, statuses: &[&str]) -> Vec<String> {
    evidence_keys_by_scope_status(evidence, OpenBimEvidenceScope::Review, statuses)
}

fn failed_evidence_keys(evidence: &serde_json::Value) -> Vec<String> {
    failed_evidence_keys_by_scope(evidence, OpenBimEvidenceScope::Review)
}

fn evidence_keys_by_scope_status(
    evidence: &serde_json::Value,
    scope: OpenBimEvidenceScope,
    statuses: &[&str],
) -> Vec<String> {
    let Some(object) = evidence.as_object() else {
        return Vec::new();
    };
    object
        .iter()
        .filter(|(_, value)| {
            value
                .get("scope")
                .and_then(serde_json::Value::as_str)
                .is_none_or(|value_scope| value_scope == scope.as_str())
                && value
                    .get("status")
                    .and_then(serde_json::Value::as_str)
                    .is_some_and(|status| statuses.contains(&status))
        })
        .map(|(key, _)| key.clone())
        .collect()
}

fn evidence_keys_by_scope_not_ready(
    evidence: &serde_json::Value,
    scope: OpenBimEvidenceScope,
) -> Vec<String> {
    let Some(object) = evidence.as_object() else {
        return Vec::new();
    };
    object
        .iter()
        .filter(|(_, value)| {
            value
                .get("scope")
                .and_then(serde_json::Value::as_str)
                .is_none_or(|value_scope| value_scope == scope.as_str())
                && value.get("status").and_then(serde_json::Value::as_str) != Some("ready")
        })
        .map(|(key, _)| key.clone())
        .collect()
}

fn openbim_artifacts_for_asset(
    asset_id: Uuid,
    jobs: &[ConversionJobRecord],
) -> Vec<serde_json::Value> {
    jobs.iter()
        .filter(|job| job.source_asset_id == asset_id)
        .filter(|job| {
            is_openbim_evidence_operation(job.operation) || job_has_openbim_evidence_artifact(job)
        })
        .flat_map(|job| {
            job.output
                .get("artifacts")
                .and_then(serde_json::Value::as_array)
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .map(|mut artifact| {
                    if let Some(object) = artifact.as_object_mut() {
                        object.insert("jobId".to_owned(), serde_json::json!(job.job_id));
                        object.insert("operation".to_owned(), serde_json::json!(job.operation));
                    }
                    artifact
                })
        })
        .collect()
}

fn job_has_openbim_evidence_artifact(job: &ConversionJobRecord) -> bool {
    OPENBIM_EVIDENCE_SPECS.iter().any(|spec| {
        job_artifact_by_name(job, spec.artifact).is_some() || output_pointer_present(job, *spec)
    })
}

const fn is_openbim_evidence_operation(operation: ConversionOperation) -> bool {
    matches!(
        operation,
        ConversionOperation::IfcIngest
            | ConversionOperation::OpenbimValidate
            | ConversionOperation::BcfIngest
            | ConversionOperation::IdmIngest
            | ConversionOperation::BsddEnrich
    )
}

fn missing_bim_semantics_status(conversion_status: &str) -> String {
    if conversion_status == "completed" {
        "semantic_manifest_missing".to_owned()
    } else {
        format!("ifc_ingest_{conversion_status}")
    }
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
    let Some(nats_url) = runtime_nats_url() else {
        if matches!(state.runtime_profile, RuntimeProfile::Production) {
            return Err(HarnessError::InvalidInput(
                "NATS_URL or ARCHITOKEN_EVENT__URL is required to dispatch production conversion jobs".to_owned(),
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
            &source_file_name,
            &job.input,
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
    input: &serde_json::Value,
) -> &'static str {
    if let Some(adapter) = default_adapter_for_conversion_source(operation, source_file_name) {
        return adapter;
    }
    if operation == ConversionOperation::OpenbimValidate && openbim_validate_uses_ids(input) {
        return "ids";
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

fn openbim_validate_uses_ids(input: &serde_json::Value) -> bool {
    input.get("idsPath").is_some()
        || input.get("ids_path").is_some()
        || input.get("idsObjectKey").is_some()
        || input.get("ids_object_key").is_some()
        || input
            .get("validator")
            .and_then(serde_json::Value::as_str)
            .is_some_and(|value| value.eq_ignore_ascii_case("ids"))
        || input
            .get("standard")
            .and_then(serde_json::Value::as_str)
            .is_some_and(|value| value.eq_ignore_ascii_case("ids"))
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
    use std::sync::Arc;

    use architoken_harness_core::{
        asset_registry::{AssetRegistryService, ConversionJobRecord, ConversionOperation},
        config::AppConfig,
        db::RuntimeDatabaseConfig,
        durable_store::DurableRecordMetadata,
        error::HarnessError,
        inference::InferenceRouter,
        knowledge_registry::KnowledgeSourceRegistryService,
        mcp_tool_registry::McpToolRegistryService,
        module_audit::{AuditEventKind, AuditEventQuery, ModuleAuditService},
        module_files::ModuleFileService,
        module_generation::ModuleGenerationService,
        module_lifecycle::ModuleLifecycleService,
        openbim::OpenBimService,
        permissions::{Claims, Role},
        phase8_runtime::{
            InMemoryRateLimiter, Phase8DependencyReadiness, Phase8Metrics, Phase8RuntimeConfig,
        },
        rollback_guard::RollbackGuard,
        runtime_context::{
            HEADER_ROLES, RequestContext, RequestContextInput, RuntimeProfile, RuntimeRole,
        },
        runtime_execution::RuntimeExecutionService,
        skill_registry::SkillRegistryService,
        storage_router::{InMemoryObjectStore, ObjectStore},
        viewer_adapter::ViewerCommandService,
    };
    use axum::{
        extract::Path,
        http::{HeaderMap, HeaderValue},
    };
    use serde_json::json;
    use uuid::Uuid;

    use super::{
        AgentInvokeRequest, AgentInvokeResponseSummary, AppState, RagRetrieveRequest,
        append_agent_invoke_audit_events, context_from_headers, context_from_query,
        format_pgvector, get_module_handler,
    };

    fn test_app_state(audit: Arc<ModuleAuditService>) -> AppState {
        let cfg = AppConfig::development_preview();
        let runtime_profile = RuntimeProfile::Development;
        let database_config = RuntimeDatabaseConfig::from_database_url(runtime_profile, None)
            .expect("development should allow in-memory database fallback");
        let phase8_scale_config = Arc::new(
            Phase8RuntimeConfig::from_pairs(runtime_profile, &database_config, &[])
                .expect("development phase8 config"),
        );
        let object_store: Arc<dyn ObjectStore> = Arc::new(InMemoryObjectStore::new());
        let lifecycle = ModuleLifecycleService::new(Arc::clone(&audit));
        let generation = ModuleGenerationService::new_with_object_store(
            Arc::clone(&audit),
            lifecycle.clone(),
            cfg.generation.clone(),
            Arc::clone(&object_store),
        );

        AppState {
            router: Arc::new(InferenceRouter::new(
                cfg.inference.default_engine,
                Arc::new(RollbackGuard::new()),
            )),
            cfg: Arc::new(cfg),
            files: ModuleFileService::new(Arc::clone(&audit)),
            generation: generation.clone(),
            assets: AssetRegistryService::new(Arc::clone(&audit)),
            lifecycle,
            skills: SkillRegistryService::new(),
            mcp_tools: McpToolRegistryService::new(),
            knowledge_sources: KnowledgeSourceRegistryService::new(),
            viewer_commands: ViewerCommandService::new(Arc::clone(&audit), generation),
            openbim: OpenBimService::new(Arc::clone(&audit)),
            runtime_executions: RuntimeExecutionService::new(Arc::clone(&audit)),
            audit,
            runtime_profile,
            database_config: database_config.clone(),
            db_pool: None,
            object_store,
            http_client: reqwest::Client::new(),
            agent_orchestrator_url: "http://agent.test".to_owned(),
            phase8_scale_config,
            phase8_readiness: Phase8DependencyReadiness::from_lookup(&database_config, |_| None),
            rate_limiter: Arc::new(InMemoryRateLimiter::default()),
            metrics: Arc::new(Phase8Metrics::new()),
        }
    }

    #[tokio::test]
    async fn module_route_rejects_unknown_module() {
        let result = get_module_handler(Path("unknown_module".to_owned())).await;
        assert!(matches!(result, Err(HarnessError::NotFound(_))));
    }

    #[test]
    fn agent_invoke_summary_accepts_snake_and_camel_case() {
        let snake: AgentInvokeResponseSummary = serde_json::from_value(json!({
            "request_id": "agent-req-1",
            "module_id": "standard_library",
            "verdict": "approved",
            "revision_count": 1,
            "output_status": "professional_review_required",
            "tool_results": [{"name": "rag.retrieve"}],
            "rag_chunks": [{"source": "rag-chunk://1"}]
        }))
        .expect("snake_case agent response should parse");
        assert_eq!(snake.request_id, "agent-req-1");
        assert_eq!(snake.tool_results.len(), 1);

        let camel: AgentInvokeResponseSummary = serde_json::from_value(json!({
            "requestId": "agent-req-2",
            "moduleId": "standard_library",
            "verdict": "approved",
            "revisionCount": 2,
            "outputStatus": "professional_review_required",
            "toolResults": [{"name": "rag.retrieve"}],
            "ragChunks": [{"source": "rag-chunk://2"}]
        }))
        .expect("camelCase agent response should parse");
        assert_eq!(camel.request_id, "agent-req-2");
        assert_eq!(camel.revision_count, 2);
    }

    #[test]
    fn rag_retrieve_request_accepts_snake_and_camel_case() {
        let tenant_id = Uuid::parse_str("00000000-0000-4000-8000-000000000001").unwrap();
        let project_id = Uuid::parse_str("00000000-0000-4000-8000-000000000002").unwrap();
        let snake: RagRetrieveRequest = serde_json::from_value(json!({
            "tenant_id": tenant_id,
            "project_id": project_id,
            "query": "标准条文",
            "top_k": 3,
            "query_embedding": [0.1, 0.2]
        }))
        .expect("snake_case RAG request should parse");
        assert_eq!(snake.tenant_id, tenant_id);
        assert_eq!(snake.top_k, 3);
        assert_eq!(snake.query_embedding.len(), 2);

        let camel: RagRetrieveRequest = serde_json::from_value(json!({
            "tenantId": tenant_id,
            "projectId": project_id,
            "query": "标准条文",
            "topK": 4,
            "queryEmbedding": [0.3, 0.4]
        }))
        .expect("camelCase RAG request should parse");
        assert_eq!(camel.project_id, project_id);
        assert_eq!(camel.top_k, 4);
        assert_eq!(camel.query_embedding[0], 0.3);
    }

    #[test]
    fn pgvector_formatter_uses_pgvector_array_syntax() {
        assert_eq!(format_pgvector(&[0.1, -2.0, 3.5]), "[0.1,-2,3.5]");
    }

    #[tokio::test]
    async fn agent_invoke_audit_events_are_recorded() {
        let audit = Arc::new(ModuleAuditService::new());
        let state = test_app_state(Arc::clone(&audit));
        let context = RequestContext::from_input(
            RequestContextInput {
                tenant_id: Some("00000000-0000-4000-8000-000000000001".to_owned()),
                project_id: Some("00000000-0000-4000-8000-000000000002".to_owned()),
                actor: Some("engineer@example.com".to_owned()),
                roles: Some(vec!["engineer".to_owned(), "reviewer".to_owned()]),
                request_id: Some("gateway-req-1".to_owned()),
                correlation_id: Some("gateway-corr-1".to_owned()),
            },
            RuntimeProfile::Production,
        )
        .expect("request context should be valid");
        let req = AgentInvokeRequest {
            tenant_id: Uuid::parse_str("00000000-0000-4000-8000-000000000001").unwrap(),
            project_id: Uuid::parse_str("00000000-0000-4000-8000-000000000002").unwrap(),
            module_id: "standard_library".to_owned(),
            user_input: "请检查标准条文".to_owned(),
            attachments: vec!["规范条文.pdf".to_owned()],
            locale: "zh-CN".to_owned(),
        };
        let response = AgentInvokeResponseSummary {
            request_id: "agent-req-1".to_owned(),
            module_id: "standard_library".to_owned(),
            verdict: "approved".to_owned(),
            revision_count: 1,
            output_status: "professional_review_required".to_owned(),
            gates: vec![json!({"name": "Approver", "status": "blocked"})],
            tool_results: vec![json!({"name": "rag.retrieve", "ok": true})],
            rag_chunks: vec![json!({"source": "rag-chunk://chunk-1"})],
        };

        append_agent_invoke_audit_events(&state, &context, &req, &response)
            .await
            .expect("agent invoke audit events should append");

        let events = audit
            .list(&AuditEventQuery {
                module_id: Some("standard_library".to_owned()),
                target_type: Some("agent_run".to_owned()),
                target_id: Some("agent-req-1".to_owned()),
                actor: Some("engineer@example.com".to_owned()),
                limit: Some(10),
                cursor: None,
            })
            .expect("audit events should list");
        let actions = events
            .items
            .iter()
            .map(|event| event.action)
            .collect::<Vec<_>>();
        assert_eq!(
            actions,
            vec![
                AuditEventKind::AgentInvoked,
                AuditEventKind::AgentToolContextResolved,
                AuditEventKind::AgentGateDecisionRecorded,
            ]
        );
        assert_eq!(events.items[0].metadata["agentRequestId"], "agent-req-1");
        assert_eq!(events.items[1].metadata["toolResultCount"], 1);
        assert_eq!(
            events.items[2].metadata["outputStatus"],
            "professional_review_required"
        );
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
    fn iam_normalizes_principal_and_resource_types() {
        assert_eq!(
            super::normalize_iam_principal_type("org_unit").expect("principal type"),
            "org_unit"
        );
        assert_eq!(
            super::normalize_iam_resource_type(Some("Project_Zone1".to_owned()))
                .expect("resource type"),
            "project_zone1"
        );
        assert!(super::normalize_iam_principal_type("team").is_err());
        assert!(super::normalize_iam_resource_type(Some("bad/type".to_owned())).is_err());
    }

    #[test]
    fn iam_write_requires_runtime_admin() {
        let engineer = RequestContext {
            tenant_id: "tenant-a".to_owned(),
            project_id: "project-a".to_owned(),
            actor: "engineer-a".to_owned(),
            roles: vec![RuntimeRole::Engineer],
            request_id: "req-a".to_owned(),
            correlation_id: "corr-a".to_owned(),
        };
        let admin = RequestContext {
            roles: vec![RuntimeRole::Admin],
            ..engineer.clone()
        };

        assert!(super::ensure_iam_admin_context(&admin).is_ok());
        let err = super::ensure_iam_admin_context(&engineer)
            .expect_err("engineer cannot change IAM role bindings");
        assert_eq!(err.http_status(), 403);
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
    fn bearer_token_parser_accepts_access_cookie_fallback() {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::COOKIE,
            HeaderValue::from_static("other=1; architoken_access=jwt-cookie-123"),
        );

        assert_eq!(
            super::bearer_token(&headers),
            Some("jwt-cookie-123".to_owned())
        );
    }

    #[test]
    fn oauth_provider_registry_accepts_supported_providers() {
        for provider in ["wechat", "douyin", "alipay", "microsoft", "google"] {
            assert_eq!(
                super::normalize_oauth_provider(provider).expect("provider should be supported"),
                provider
            );
        }
        assert_eq!(super::OAUTH_PROVIDER_SPECS.len(), 5);
    }

    #[test]
    fn oauth_return_to_rejects_external_redirects() {
        assert_eq!(
            super::normalize_oauth_return_to(Some("/app/modules")).unwrap(),
            "/app/modules"
        );
        assert!(super::normalize_oauth_return_to(Some("https://evil.example")).is_err());
        assert!(super::normalize_oauth_return_to(Some("//evil.example")).is_err());
    }

    #[test]
    fn wechat_dev_oauth_is_development_only() {
        assert!(!super::wechat_dev_oauth_enabled_for_flag(
            RuntimeProfile::Development,
            None
        ));
        assert!(super::wechat_dev_oauth_enabled_for_flag(
            RuntimeProfile::Development,
            Some("true")
        ));
        assert!(!super::wechat_dev_oauth_enabled_for_flag(
            RuntimeProfile::Development,
            Some("false")
        ));
        assert!(!super::wechat_dev_oauth_enabled_for_flag(
            RuntimeProfile::Production,
            None
        ));
    }

    #[test]
    fn wechat_dev_oauth_callback_uses_frontend_origin() {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::ORIGIN,
            HeaderValue::from_static("http://192.168.1.100:3000"),
        );

        temp_env::with_vars(
            [("ARCHITOKEN_OAUTH_WECHAT_DEV_LOGIN", Some("true"))],
            || {
                let callback = super::wechat_dev_oauth_callback_url(
                    &headers,
                    RuntimeProfile::Development,
                    "state-123",
                )
                .expect("dev callback URL");
                assert_eq!(callback.scheme(), "http");
                assert_eq!(callback.host_str(), Some("192.168.1.100"));
                assert_eq!(callback.port(), Some(3000));
                assert_eq!(
                    callback.path(),
                    "/api/architoken/v1/auth/oauth/wechat/callback"
                );
                assert!(
                    callback
                        .as_str()
                        .contains("code=architoken-dev-wechat-state-123")
                );
                assert!(callback.as_str().contains("state=state-123"));
            },
        );

        assert_eq!(
            super::frontend_redirect_url_from_headers(
                &headers,
                RuntimeProfile::Development,
                "/app/modules"
            )
            .expect("frontend redirect"),
            "http://192.168.1.100:3000/app/modules"
        );
    }

    #[test]
    fn wechat_dev_oauth_profile_ignores_normal_codes() {
        assert!(
            super::wechat_dev_oauth_profile(RuntimeProfile::Development, "wechat-normal-code")
                .expect("normal code should not error")
                .is_none()
        );
        assert!(super::is_wechat_dev_oauth_code(
            "architoken-dev-wechat-state-123"
        ));
        assert!(!super::is_wechat_dev_oauth_code("wechat-normal-code"));
        temp_env::with_vars(
            [("ARCHITOKEN_OAUTH_WECHAT_DEV_LOGIN", None::<&str>)],
            || {
                assert!(
                    super::wechat_dev_oauth_profile(
                        RuntimeProfile::Development,
                        "architoken-dev-wechat-state-123"
                    )
                    .is_err()
                );
            },
        );
        temp_env::with_vars(
            [("ARCHITOKEN_OAUTH_WECHAT_DEV_LOGIN", Some("true"))],
            || {
                assert!(
                    super::wechat_dev_oauth_profile(
                        RuntimeProfile::Development,
                        "architoken-dev-wechat-state-123"
                    )
                    .expect("explicit dev login should be allowed")
                    .is_some()
                );
            },
        );
    }

    #[test]
    fn wechat_real_oauth_authorization_url_uses_public_proxy_callback() {
        temp_env::with_vars(
            [
                (
                    "ARCHITOKEN_PUBLIC_API_BASE_URL",
                    Some("https://architoken.example.com/api/architoken"),
                ),
                ("ARCHITOKEN_OAUTH_PUBLIC_BASE_URL", None::<&str>),
                ("ARCHITOKEN_OAUTH_WECHAT_CLIENT_ID", Some("wx-open-appid")),
                (
                    "ARCHITOKEN_OAUTH_WECHAT_CLIENT_SECRET",
                    Some("wx-open-secret"),
                ),
            ],
            || {
                let config =
                    super::oauth_provider_config("wechat").expect("WeChat config should load");
                let auth_url = super::oauth_authorization_url(&config, "state-abc", None)
                    .expect("WeChat authorization URL");
                let query = auth_url
                    .query_pairs()
                    .map(|(key, value)| (key.to_string(), value.to_string()))
                    .collect::<std::collections::HashMap<_, _>>();

                assert_eq!(auth_url.scheme(), "https");
                assert_eq!(auth_url.host_str(), Some("open.weixin.qq.com"));
                assert_eq!(auth_url.path(), "/connect/qrconnect");
                assert_eq!(auth_url.fragment(), Some("wechat_redirect"));
                assert_eq!(
                    query.get("appid").map(String::as_str),
                    Some("wx-open-appid")
                );
                assert_eq!(query.get("response_type").map(String::as_str), Some("code"));
                assert_eq!(query.get("scope").map(String::as_str), Some("snsapi_login"));
                assert_eq!(query.get("state").map(String::as_str), Some("state-abc"));
                assert_eq!(
                    query.get("redirect_uri").map(String::as_str),
                    Some(
                        "https://architoken.example.com/api/architoken/v1/auth/oauth/wechat/callback"
                    )
                );
            },
        );
    }

    #[test]
    fn auth_password_policy_accepts_eight_characters() {
        assert!(super::validate_auth_password("Aa123456").is_ok());
        assert!(super::validate_auth_password("Aa12345").is_err());
    }

    #[test]
    fn sms_verification_message_includes_code_and_expiry() {
        let message = super::sms_verification_message("123456", "login", 300);
        assert!(message.contains("登录"));
        assert!(message.contains("123456"));
        assert!(message.contains("5分钟"));
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
    fn bim_semantics_response_requires_ifc_ingest_before_readiness() {
        let asset_id = Uuid::new_v4();
        let response = super::build_bim_semantics_readiness_response(asset_id, None, &[]);

        assert_eq!(response.asset_id, asset_id);
        assert_eq!(response.readiness_status, "ifc_ingest_required");
        assert_eq!(response.ingest_job_id, None);
        assert_eq!(
            response.missing_evidence,
            vec![
                "approvalAuditChain".to_owned(),
                "bcfIssueClosure".to_owned(),
                "bsddClassification".to_owned(),
                "buildingSmartValidate".to_owned(),
                "fullChainSampleValidation".to_owned(),
                "idmExchangeRequirements".to_owned(),
                "idsValidation".to_owned(),
                "openCdeApiContract".to_owned(),
            ]
        );
        assert_eq!(
            response.open_bim_claim["mayClaimBuildingSmartOpenBim"],
            serde_json::json!(false)
        );
    }

    #[test]
    fn bim_semantics_response_extracts_missing_openbim_evidence() {
        let asset_id = Uuid::new_v4();
        let job = test_conversion_job(
            asset_id,
            "completed",
            serde_json::json!({
                "semantics": {
                    "schema": "architoken.bim_semantics_manifest.v1",
                    "semanticLayers": [
                        { "layer": "ifcSource", "status": "ready" }
                    ],
                    "requiredEvidence": [
                        { "artifact": "idsValidation", "status": "missing" },
                        { "artifact": "buildingSmartValidate", "status": "missing" }
                    ],
                    "openBimClaim": {
                        "status": "blocked_pending_required_evidence",
                        "mayClaimBuildingSmartOpenBim": false,
                        "missingEvidence": [
                            "idsValidation",
                            "buildingSmartValidate"
                        ]
                    }
                },
                "artifacts": [
                    { "name": "bim_semantics_manifest.json" }
                ]
            }),
        );

        let jobs = vec![job.clone()];
        let response = super::build_bim_semantics_readiness_response(asset_id, Some(&job), &jobs);

        assert_eq!(
            response.readiness_status,
            "blocked_pending_required_evidence"
        );
        assert_eq!(
            response.missing_evidence,
            vec![
                "approvalAuditChain".to_owned(),
                "bcfIssueClosure".to_owned(),
                "bsddClassification".to_owned(),
                "buildingSmartValidate".to_owned(),
                "fullChainSampleValidation".to_owned(),
                "idmExchangeRequirements".to_owned(),
                "idsValidation".to_owned(),
                "openCdeApiContract".to_owned(),
            ]
        );
        assert_eq!(response.semantic_layers[0]["layer"], "ifcSource");
        assert_eq!(
            response.required_evidence["idsValidation"]["artifact"],
            "ids_validation_report.json"
        );
        assert_eq!(response.artifacts[0]["name"], "bim_semantics_manifest.json");
    }

    #[test]
    fn latest_ifc_ingest_job_selects_newest_candidate_for_asset() {
        let asset_id = Uuid::new_v4();
        let other_asset_id = Uuid::new_v4();
        let base_time = chrono::Utc::now();
        let mut completed = test_conversion_job(
            asset_id,
            "completed",
            serde_json::json!({
                "semantics": {
                    "openBimClaim": {
                        "status": "ready_for_openbim_review"
                    }
                }
            }),
        );
        completed.finished_at = Some(base_time);
        completed.metadata.updated_at = base_time;
        let mut failed = test_conversion_job(asset_id, "failed", serde_json::json!({}));
        failed.finished_at = Some(base_time + chrono::Duration::seconds(1));
        failed.metadata.updated_at = base_time + chrono::Duration::seconds(1);
        let other_asset = test_conversion_job(
            other_asset_id,
            "completed",
            serde_json::json!({
                "semantics": {
                    "openBimClaim": {
                        "status": "other_asset"
                    }
                }
            }),
        );

        let jobs = vec![completed, other_asset, failed];
        let selected = super::latest_ifc_ingest_job_for_asset(&jobs, asset_id).expect("candidate");

        assert_eq!(selected.source_asset_id, asset_id);
        assert_eq!(selected.status, "failed");
    }

    #[test]
    fn bim_semantics_response_surfaces_latest_failed_ingest() {
        let asset_id = Uuid::new_v4();
        let job = test_conversion_job(asset_id, "failed", serde_json::json!({}));

        let jobs = vec![job.clone()];
        let response = super::build_bim_semantics_readiness_response(asset_id, Some(&job), &jobs);

        assert_eq!(response.conversion_status, Some("failed".to_owned()));
        assert_eq!(response.readiness_status, "ifc_ingest_failed");
        assert_eq!(response.semantics["status"], "ifc_ingest_failed");
        assert_eq!(
            response.open_bim_claim["mayClaimBuildingSmartOpenBim"],
            serde_json::json!(false)
        );
    }

    #[test]
    fn bim_semantics_response_aggregates_all_required_openbim_evidence() {
        let asset_id = Uuid::new_v4();
        let ingest = test_conversion_job(
            asset_id,
            "completed",
            serde_json::json!({
                "semantics": {
                    "schema": "architoken.bim_semantics_manifest.v1",
                    "semanticLayers": [
                        { "layer": "ifcSource", "status": "ready" }
                    ],
                    "openBimClaim": {
                        "status": "blocked_pending_required_evidence"
                    }
                },
                "artifacts": [
                    { "name": "bim_semantics_manifest.json" }
                ]
            }),
        );
        let jobs = vec![
            ingest.clone(),
            evidence_job(
                asset_id,
                ConversionOperation::OpenbimValidate,
                "ids_validation_report.json",
                serde_json::json!({"standard": "IDS", "passed": true}),
            ),
            evidence_job(
                asset_id,
                ConversionOperation::OpenbimValidate,
                "buildingsmart_validate_report.json",
                serde_json::json!({"standard": "buildingSMART Validate", "passed": true, "serviceExecuted": true}),
            ),
            evidence_job(
                asset_id,
                ConversionOperation::BsddEnrich,
                "bsdd_classification_report.json",
                serde_json::json!({
                    "dictionary": "bSDD",
                    "sourceUrl": "https://api.bsdd.buildingsmart.org/api/Classification/v4/Search?SearchText=Wall",
                    "classifications": [{"namespaceUri": "https://identifier.buildingsmart.org/uri/bsdd"}]
                }),
            ),
            evidence_job(
                asset_id,
                ConversionOperation::BcfIngest,
                "bcf_manifest.json",
                serde_json::json!({"standard": "BCF", "topicCount": 1}),
            ),
            evidence_job(
                asset_id,
                ConversionOperation::IdmIngest,
                "idm_manifest.json",
                serde_json::json!({"standard": "IDM", "machineReadable": true}),
            ),
            evidence_job(
                asset_id,
                ConversionOperation::DocumentGenerate,
                "approval_audit_chain.json",
                serde_json::json!({"approvalState": "closed", "auditChain": []}),
            ),
            evidence_job(
                asset_id,
                ConversionOperation::DocumentGenerate,
                "openbim_full_chain_sample_report.json",
                serde_json::json!({
                    "passed": true,
                    "sourceIfcChecksum": "c".repeat(64),
                    "chainArtifacts": {
                        "ifc": "model.ifc",
                        "ids": "handover.ids",
                        "bsdd": "bsdd_classification_report.json",
                        "bcf": "issues.bcfzip",
                        "idm": "idm_manifest.json"
                    }
                }),
            ),
            evidence_job(
                asset_id,
                ConversionOperation::DocumentGenerate,
                "opencde_api_contract_report.json",
                serde_json::json!({
                    "passed": true,
                    "contractSuite": "OpenCDE Foundation/Documents + BCF API + Dictionaries API",
                    "contracts": ["foundation", "documents", "bcf", "dictionaries"]
                }),
            ),
        ];

        let response =
            super::build_bim_semantics_readiness_response(asset_id, Some(&ingest), &jobs);

        assert_eq!(response.readiness_status, "ready_for_openbim_review");
        assert!(response.missing_evidence.is_empty());
        assert!(response.failed_evidence.is_empty());
        assert_eq!(
            response.required_evidence["idsValidation"]["status"],
            "ready"
        );
        assert_eq!(
            response.open_bim_claim["mayEnterBuildingSmartOpenBimReview"],
            serde_json::json!(true)
        );
        assert_eq!(
            response.open_bim_claim["mayClaimBuildingSmartOpenBim"],
            serde_json::json!(false)
        );
        assert_eq!(
            response.open_bim_claim["missingClaimEvidence"],
            serde_json::json!(["buildingSmartCertification"])
        );
    }

    #[test]
    fn bim_semantics_response_authorizes_claim_when_official_certification_evidence_is_linked() {
        let asset_id = Uuid::new_v4();
        let ingest = test_conversion_job(
            asset_id,
            "completed",
            serde_json::json!({
                "semantics": {
                    "schema": "architoken.bim_semantics_manifest.v1",
                    "semanticLayers": [
                        { "layer": "ifcSource", "status": "ready" }
                    ]
                },
                "artifacts": [
                    { "name": "bim_semantics_manifest.json" }
                ]
            }),
        );
        let mut jobs = ready_openbim_review_evidence_jobs(asset_id);
        jobs.insert(0, ingest.clone());
        jobs.push(evidence_job(
            asset_id,
            ConversionOperation::DocumentGenerate,
            "buildingsmart_certification_report.json",
            serde_json::json!({
                "status": "certified",
                "issuedBy": "buildingSMART International",
                "certificateId": "test-certificate-id",
                "reportUrl": "https://www.buildingsmart.org/compliance/software-certification/ifc/"
            }),
        ));

        let response =
            super::build_bim_semantics_readiness_response(asset_id, Some(&ingest), &jobs);

        assert_eq!(
            response.readiness_status,
            "buildingSMART_openBIM_claim_authorized"
        );
        assert_eq!(
            response.open_bim_claim["mayEnterBuildingSmartOpenBimReview"],
            serde_json::json!(true)
        );
        assert_eq!(
            response.open_bim_claim["mayClaimBuildingSmartOpenBim"],
            serde_json::json!(true)
        );
        assert_eq!(
            response.required_evidence["buildingSmartCertification"]["scope"],
            serde_json::json!("claim")
        );
    }

    #[test]
    fn bim_semantics_response_blocks_review_on_failed_required_evidence() {
        let asset_id = Uuid::new_v4();
        let ingest = test_conversion_job(
            asset_id,
            "completed",
            serde_json::json!({
                "semantics": {
                    "schema": "architoken.bim_semantics_manifest.v1",
                    "semanticLayers": []
                },
                "artifacts": [
                    { "name": "bim_semantics_manifest.json" }
                ]
            }),
        );
        let mut jobs = ready_openbim_evidence_jobs(asset_id);
        jobs.insert(0, ingest.clone());
        jobs.push(evidence_job(
            asset_id,
            ConversionOperation::OpenbimValidate,
            "ids_validation_report.json",
            serde_json::json!({"standard": "IDS", "passed": false}),
        ));

        let response =
            super::build_bim_semantics_readiness_response(asset_id, Some(&ingest), &jobs);

        assert_eq!(
            response.readiness_status,
            "blocked_failed_required_evidence"
        );
        assert_eq!(response.missing_evidence, Vec::<String>::new());
        assert_eq!(response.failed_evidence, vec!["idsValidation".to_owned()]);
        assert_eq!(
            response.required_evidence["idsValidation"]["status"],
            "failed"
        );
    }

    #[test]
    fn openbim_validate_defaults_to_ids_adapter_when_ids_input_is_present() {
        assert_eq!(
            super::default_adapter_for_conversion(
                ConversionOperation::OpenbimValidate,
                "model.ifc",
                &serde_json::json!({"idsPath": "/tmp/project.ids"})
            ),
            "ids"
        );
        assert_eq!(
            super::default_adapter_for_conversion(
                ConversionOperation::OpenbimValidate,
                "model.ifc",
                &serde_json::json!({})
            ),
            "buildingsmart_validate"
        );
    }

    fn evidence_job(
        source_asset_id: Uuid,
        operation: ConversionOperation,
        artifact_name: &str,
        mut output: serde_json::Value,
    ) -> ConversionJobRecord {
        output
            .as_object_mut()
            .expect("evidence output object")
            .insert(
                "artifacts".to_owned(),
                serde_json::json!([
                    {
                        "name": artifact_name,
                        "metadata": {
                            "objectPersisted": true,
                            "objectKey": format!("workers/test/{artifact_name}")
                        }
                    }
                ]),
            );
        test_conversion_job_for_operation(source_asset_id, operation, "completed", output)
    }

    fn ready_openbim_evidence_jobs(asset_id: Uuid) -> Vec<ConversionJobRecord> {
        vec![
            evidence_job(
                asset_id,
                ConversionOperation::OpenbimValidate,
                "buildingsmart_validate_report.json",
                serde_json::json!({"standard": "buildingSMART Validate", "passed": true, "serviceExecuted": true}),
            ),
            evidence_job(
                asset_id,
                ConversionOperation::BsddEnrich,
                "bsdd_classification_report.json",
                serde_json::json!({
                    "dictionary": "bSDD",
                    "sourceUrl": "https://api.bsdd.buildingsmart.org/api/Classification/v4/Search?SearchText=Wall",
                    "classifications": [{"namespaceUri": "https://identifier.buildingsmart.org/uri/bsdd"}]
                }),
            ),
            evidence_job(
                asset_id,
                ConversionOperation::BcfIngest,
                "bcf_manifest.json",
                serde_json::json!({"standard": "BCF", "topicCount": 1}),
            ),
            evidence_job(
                asset_id,
                ConversionOperation::IdmIngest,
                "idm_manifest.json",
                serde_json::json!({"standard": "IDM", "machineReadable": true}),
            ),
            evidence_job(
                asset_id,
                ConversionOperation::DocumentGenerate,
                "approval_audit_chain.json",
                serde_json::json!({"approvalState": "closed", "auditChain": []}),
            ),
            evidence_job(
                asset_id,
                ConversionOperation::DocumentGenerate,
                "openbim_full_chain_sample_report.json",
                serde_json::json!({
                    "passed": true,
                    "sourceIfcChecksum": "c".repeat(64),
                    "chainArtifacts": {
                        "ifc": "model.ifc",
                        "ids": "handover.ids",
                        "bsdd": "bsdd_classification_report.json",
                        "bcf": "issues.bcfzip",
                        "idm": "idm_manifest.json"
                    }
                }),
            ),
            evidence_job(
                asset_id,
                ConversionOperation::DocumentGenerate,
                "opencde_api_contract_report.json",
                serde_json::json!({
                    "passed": true,
                    "contractSuite": "OpenCDE Foundation/Documents + BCF API + Dictionaries API",
                    "contracts": ["foundation", "documents", "bcf", "dictionaries"]
                }),
            ),
        ]
    }

    fn ready_openbim_review_evidence_jobs(asset_id: Uuid) -> Vec<ConversionJobRecord> {
        let mut jobs = ready_openbim_evidence_jobs(asset_id);
        jobs.insert(
            0,
            evidence_job(
                asset_id,
                ConversionOperation::OpenbimValidate,
                "ids_validation_report.json",
                serde_json::json!({"standard": "IDS", "passed": true}),
            ),
        );
        jobs
    }

    fn test_conversion_job(
        source_asset_id: Uuid,
        status: &str,
        output: serde_json::Value,
    ) -> ConversionJobRecord {
        test_conversion_job_for_operation(
            source_asset_id,
            ConversionOperation::IfcIngest,
            status,
            output,
        )
    }

    fn test_conversion_job_for_operation(
        source_asset_id: Uuid,
        operation: ConversionOperation,
        status: &str,
        output: serde_json::Value,
    ) -> ConversionJobRecord {
        ConversionJobRecord {
            metadata: DurableRecordMetadata::new(
                "tenant-a",
                Some("project-a".to_owned()),
                Some("tester".to_owned()),
            ),
            job_id: Uuid::new_v4(),
            operation,
            source_asset_id,
            source_file_id: Uuid::new_v4(),
            status: status.to_owned(),
            input: serde_json::json!({}),
            output,
            error: serde_json::json!({}),
            started_at: None,
            finished_at: None,
        }
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
    fn runtime_cache_url_accepts_valkey_url_alias() {
        temp_env::with_vars(
            [
                ("ARCHITOKEN_CACHE__URL", None::<&str>),
                ("VALKEY_URL", Some(" redis://valkey:6379/0 ")),
                ("REDIS_URL", Some("redis://redis:6379/0")),
            ],
            || {
                let cfg = architoken_harness_core::config::AppConfig::development_preview();
                assert_eq!(
                    super::runtime_cache_url(&cfg).as_deref(),
                    Some("redis://valkey:6379/0")
                );
            },
        );
    }

    #[test]
    fn runtime_nats_url_accepts_event_url_alias() {
        temp_env::with_vars(
            [
                ("NATS_URL", None::<&str>),
                ("ARCHITOKEN_EVENT__URL", Some(" nats://nats:4222 ")),
            ],
            || {
                assert_eq!(
                    super::runtime_nats_url().as_deref(),
                    Some("nats://nats:4222")
                );
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
