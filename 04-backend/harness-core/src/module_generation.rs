//! AI-native multimodal engineering generation service.
//!
//! The service owns generation lifecycle, review gates, artifact metadata, and
//! pluggable object storage. Development may run the deterministic local
//! adapter, while production profiles must configure external generation and
//! S3-compatible artifact storage.

use std::{collections::HashMap, fmt, sync::Arc, time::Duration};

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64_STANDARD};
use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    config::{GenerationConfig, GenerationProvider},
    error::{HarnessError, Result},
    generation_engine::{
        MediaGenerationEngineArtifact, MediaGenerationEngineRequest, MediaGenerationEngineResponse,
        MediaGenerationInputArtifact, TextToBimEngineArtifact, TextToBimEngineRequest,
        TextToBimEngineResponse,
    },
    module_audit::{AuditEventInput, AuditEventKind, ModuleAuditService},
    module_lifecycle::{
        ApprovalDecisionRequest, CreateModuleTransactionRequest, ModuleLifecycleService,
        ModuleTransitionEvent, ModuleTransitionRequest,
    },
    module_pagination::{ListPage, PageInfo, paginate},
    module_registry::normalize_module_id,
    runtime_context::{PermissionGuard, RequestContext, RuntimePermission, assert_runtime_scope},
    storage_router::{
        ArtifactMetadata, ArtifactRef, ArtifactRole, ArtifactStatus, ArtifactStorageBinding,
        ArtifactVersion, ElementIdNamespace, GeometryFormat, InMemoryObjectStore, ObjectData,
        ObjectPutRequest, ObjectStore, PropertyIndexFormat, ViewerAdapterHint,
    },
};

const DEFAULT_ACTOR: &str = "system";
const LOCAL_ADAPTER_VERSION: &str = "0.1.0";

/// Supported AIGC generation and conversion modes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GenerationMode {
    /// Generate an image from text.
    TextToImage,
    /// Generate a document from text.
    TextToDocument,
    /// Generate a spreadsheet from text.
    TextToSpreadsheet,
    /// Generate a PDF from text.
    TextToPdf,
    /// Generate a presentation from text.
    TextToPpt,
    /// Generate a mindmap from text.
    TextToMindmap,
    /// Generate a flowchart from text.
    TextToFlowchart,
    /// Generate a Gantt chart from text.
    TextToGantt,
    /// Generate a floorplan from text.
    TextToFloorplan,
    /// Generate CAD drawings from text.
    TextToCad,
    /// Generate a BIM model from text.
    TextToBim,
    /// Generate a digital twin from text.
    TextToDigitalTwin,
    /// Generate a video from images.
    ImageToVideo,
    /// Generate a PDF drawing from images.
    ImageToPdfDrawing,
    /// Generate CAD drawings from images.
    ImageToCad,
    /// Generate a BIM model from images.
    ImageToBim,
    /// Generate a digital twin from images.
    ImageToDigitalTwin,
    /// Generate a BIM model from video.
    VideoToBim,
    /// Generate a digital twin from video.
    VideoToDigitalTwin,
    /// Generate a point cloud from video.
    VideoToPointCloud,
    /// Convert CAD drawings into a BIM model.
    CadToBim,
    /// Convert CAD drawings into a digital twin.
    CadToDigitalTwin,
    /// Convert PDF drawings into a BIM model.
    PdfDrawingToBim,
    /// Convert PDF drawings into a digital twin.
    PdfDrawingToDigitalTwin,
    /// Export drawings to images.
    DrawingToImage,
    /// Export drawings to PDF.
    DrawingToPdf,
    /// Export model data to tables.
    ModelToTable,
    /// Export model views to drawings.
    ModelToDrawing,
    /// Export model views to images.
    ModelToImage,
    /// Convert a model into a lightweight viewer scene.
    ModelToLightweightScene,
    /// Convert BIM into scene tiles.
    BimToSceneTiles,
    /// Convert CAD into scene tiles.
    CadToSceneTiles,
    /// Convert IFC into GLB.
    IfcToGlb,
    /// Convert IFC into 3D Tiles.
    IfcTo3dtiles,
    /// Optimize GLB payload.
    GlbOptimize,
    /// Simplify mesh payload.
    MeshSimplify,
    /// Draco-compress mesh payload.
    MeshDracoCompress,
    /// Meshopt-compress mesh payload.
    MeshMeshoptCompress,
    /// Generate scene LOD artifacts.
    SceneLodGenerate,
    /// Generate model property index artifacts.
    ModelPropertyIndexGenerate,
    /// Generate element identity map artifacts.
    ElementIdentityMapGenerate,
    /// Generate digital twin scene artifacts.
    DigitalTwinSceneGenerate,
}

impl GenerationMode {
    /// Complete conversion matrix required by the API contract.
    pub const ALL: [Self; 42] = [
        Self::TextToImage,
        Self::TextToDocument,
        Self::TextToSpreadsheet,
        Self::TextToPdf,
        Self::TextToPpt,
        Self::TextToMindmap,
        Self::TextToFlowchart,
        Self::TextToGantt,
        Self::TextToFloorplan,
        Self::TextToCad,
        Self::TextToBim,
        Self::TextToDigitalTwin,
        Self::ImageToVideo,
        Self::ImageToPdfDrawing,
        Self::ImageToCad,
        Self::ImageToBim,
        Self::ImageToDigitalTwin,
        Self::VideoToBim,
        Self::VideoToDigitalTwin,
        Self::VideoToPointCloud,
        Self::CadToBim,
        Self::CadToDigitalTwin,
        Self::PdfDrawingToBim,
        Self::PdfDrawingToDigitalTwin,
        Self::DrawingToImage,
        Self::DrawingToPdf,
        Self::ModelToTable,
        Self::ModelToDrawing,
        Self::ModelToImage,
        Self::ModelToLightweightScene,
        Self::BimToSceneTiles,
        Self::CadToSceneTiles,
        Self::IfcToGlb,
        Self::IfcTo3dtiles,
        Self::GlbOptimize,
        Self::MeshSimplify,
        Self::MeshDracoCompress,
        Self::MeshMeshoptCompress,
        Self::SceneLodGenerate,
        Self::ModelPropertyIndexGenerate,
        Self::ElementIdentityMapGenerate,
        Self::DigitalTwinSceneGenerate,
    ];

    const fn output_kind(self) -> ArtifactKind {
        match self {
            Self::TextToImage | Self::DrawingToImage | Self::ModelToImage => ArtifactKind::Image,
            Self::TextToDocument => ArtifactKind::Document,
            Self::TextToSpreadsheet => ArtifactKind::Spreadsheet,
            Self::TextToPdf | Self::DrawingToPdf => ArtifactKind::Pdf,
            Self::TextToPpt => ArtifactKind::Ppt,
            Self::TextToMindmap => ArtifactKind::Mindmap,
            Self::TextToFlowchart => ArtifactKind::Flowchart,
            Self::TextToGantt => ArtifactKind::Gantt,
            Self::TextToFloorplan => ArtifactKind::Floorplan,
            Self::TextToCad | Self::ImageToCad => ArtifactKind::Cad,
            Self::TextToBim
            | Self::ImageToBim
            | Self::VideoToBim
            | Self::CadToBim
            | Self::PdfDrawingToBim => ArtifactKind::Bim,
            Self::TextToDigitalTwin
            | Self::ImageToDigitalTwin
            | Self::VideoToDigitalTwin
            | Self::CadToDigitalTwin
            | Self::PdfDrawingToDigitalTwin
            | Self::DigitalTwinSceneGenerate => ArtifactKind::DigitalTwin,
            Self::ImageToVideo => ArtifactKind::Video,
            Self::ImageToPdfDrawing => ArtifactKind::PdfDrawing,
            Self::VideoToPointCloud => ArtifactKind::PointCloud,
            Self::ModelToTable => ArtifactKind::Table,
            Self::ModelToDrawing => ArtifactKind::Drawing,
            Self::ModelToLightweightScene => ArtifactKind::LightweightScene,
            Self::BimToSceneTiles | Self::CadToSceneTiles | Self::IfcTo3dtiles => {
                ArtifactKind::SceneTiles
            }
            Self::IfcToGlb
            | Self::GlbOptimize
            | Self::MeshSimplify
            | Self::MeshDracoCompress
            | Self::MeshMeshoptCompress => ArtifactKind::Glb,
            Self::SceneLodGenerate => ArtifactKind::Lod,
            Self::ModelPropertyIndexGenerate => ArtifactKind::PropertyIndex,
            Self::ElementIdentityMapGenerate => ArtifactKind::ElementIdentityMap,
        }
    }

    const fn skill_id(self) -> &'static str {
        match self {
            Self::TextToImage => "text_to_image_worker_adapter",
            Self::TextToDocument => "text_to_document_worker_adapter",
            Self::TextToSpreadsheet => "text_to_spreadsheet_worker_adapter",
            Self::TextToPdf => "text_to_pdf_worker_adapter",
            Self::TextToPpt => "text_to_ppt_worker_adapter",
            Self::TextToMindmap => "text_to_mindmap_worker_adapter",
            Self::TextToFlowchart => "text_to_flowchart_worker_adapter",
            Self::TextToGantt => "text_to_gantt_worker_adapter",
            Self::TextToFloorplan => "text_to_floorplan_worker_adapter",
            Self::TextToCad => "text_to_cad_worker_adapter",
            Self::TextToBim => "text_to_bim_worker_adapter",
            Self::TextToDigitalTwin => "text_to_digital_twin_worker_adapter",
            Self::ImageToVideo => "image_to_video_worker_adapter",
            Self::ImageToPdfDrawing => "image_to_pdf_drawing_worker_adapter",
            Self::ImageToCad => "image_to_cad_worker_adapter",
            Self::ImageToBim => "image_to_bim_worker_adapter",
            Self::ImageToDigitalTwin => "image_to_digital_twin_worker_adapter",
            Self::VideoToBim => "video_to_bim_worker_adapter",
            Self::VideoToDigitalTwin => "video_to_digital_twin_worker_adapter",
            Self::VideoToPointCloud => "video_to_point_cloud_worker_adapter",
            Self::CadToBim => "cad_to_bim_worker_adapter",
            Self::CadToDigitalTwin => "cad_to_digital_twin_worker_adapter",
            Self::PdfDrawingToBim => "pdf_drawing_to_bim_worker_adapter",
            Self::PdfDrawingToDigitalTwin => "pdf_drawing_to_digital_twin_worker_adapter",
            Self::DrawingToImage => "drawing_to_image_worker_adapter",
            Self::DrawingToPdf => "drawing_to_pdf_worker_adapter",
            Self::ModelToTable => "model_to_table_worker_adapter",
            Self::ModelToDrawing => "model_to_drawing_worker_adapter",
            Self::ModelToImage => "model_to_image_worker_adapter",
            Self::ModelToLightweightScene => "model_to_lightweight_scene_worker_adapter",
            Self::BimToSceneTiles => "bim_to_scene_tiles_worker_adapter",
            Self::CadToSceneTiles => "cad_to_scene_tiles_worker_adapter",
            Self::IfcToGlb => "ifc_to_glb_worker_adapter",
            Self::IfcTo3dtiles => "ifc_to_3dtiles_worker_adapter",
            Self::GlbOptimize => "glb_optimize_worker_adapter",
            Self::MeshSimplify => "mesh_simplify_worker_adapter",
            Self::MeshDracoCompress => "mesh_draco_compress_worker_adapter",
            Self::MeshMeshoptCompress => "mesh_meshopt_compress_worker_adapter",
            Self::SceneLodGenerate => "scene_lod_generate_worker_adapter",
            Self::ModelPropertyIndexGenerate => "model_property_index_generate_worker_adapter",
            Self::ElementIdentityMapGenerate => "element_identity_map_generate_worker_adapter",
            Self::DigitalTwinSceneGenerate => "digital_twin_scene_generate_worker_adapter",
        }
    }
}

/// Artifact kind accepted or produced by generation jobs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ArtifactKind {
    /// Text prompt or extracted text.
    Text,
    /// Raster image.
    Image,
    /// Video asset.
    Video,
    /// Rich text document.
    Document,
    /// Spreadsheet.
    Spreadsheet,
    /// PDF document.
    Pdf,
    /// Presentation deck.
    Ppt,
    /// Mindmap.
    Mindmap,
    /// Flowchart.
    Flowchart,
    /// Gantt chart.
    Gantt,
    /// Floorplan.
    Floorplan,
    /// CAD drawing.
    Cad,
    /// BIM model.
    Bim,
    /// Digital twin scene.
    DigitalTwin,
    /// PDF drawing.
    PdfDrawing,
    /// Point cloud.
    PointCloud,
    /// Generic drawing export.
    Drawing,
    /// Tabular model export.
    Table,
    /// Generic engineering model input.
    Model,
    /// Lightweight viewer scene.
    LightweightScene,
    /// 3D Tiles scene payload.
    SceneTiles,
    /// GLB scene payload.
    Glb,
    /// Level-of-detail payload.
    Lod,
    /// Property index payload.
    PropertyIndex,
    /// Element identity map payload.
    ElementIdentityMap,
}

impl ArtifactKind {
    /// All artifact kinds accepted or produced by the generation runtime.
    pub const ALL: [Self; 25] = [
        Self::Text,
        Self::Image,
        Self::Video,
        Self::Document,
        Self::Spreadsheet,
        Self::Pdf,
        Self::Ppt,
        Self::Mindmap,
        Self::Flowchart,
        Self::Gantt,
        Self::Floorplan,
        Self::Cad,
        Self::Bim,
        Self::DigitalTwin,
        Self::PdfDrawing,
        Self::PointCloud,
        Self::Drawing,
        Self::Table,
        Self::Model,
        Self::LightweightScene,
        Self::SceneTiles,
        Self::Glb,
        Self::Lod,
        Self::PropertyIndex,
        Self::ElementIdentityMap,
    ];
}

/// File or object reference used by a generation job.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Artifact {
    /// Artifact id.
    pub id: Uuid,
    /// Artifact kind.
    pub kind: ArtifactKind,
    /// Artifact lifecycle status.
    pub status: ArtifactStatus,
    /// Optional object-store URI from the configured `ObjectStore`.
    pub object_uri: Option<String>,
    /// Stable file-system reference for frontend and third-party callers.
    pub file_reference: String,
    /// Artifact schema reference.
    pub schema_ref: String,
    /// Artifact version.
    pub version: u32,
    /// Optional content hash.
    pub hash: Option<String>,
    /// Small structured metadata for adapters and tests.
    pub metadata: serde_json::Value,
    /// Stable artifact reference for callers and downstream workflows.
    pub reference: ArtifactRef,
    /// Current storage binding.
    pub storage_binding: ArtifactStorageBinding,
    /// Durable artifact metadata adapter.
    pub artifact_metadata: ArtifactMetadata,
    /// Artifact versions retained for audit and future `ObjectStore` migration.
    pub versions: Vec<ArtifactVersion>,
}

/// Input used to create a generation job.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationInput {
    /// Active module id.
    pub module_id: String,
    /// Requested conversion mode.
    pub mode: GenerationMode,
    /// Natural-language prompt or task brief.
    pub prompt: String,
    /// Actor creating the job.
    pub actor: Option<String>,
    /// Optional input artifacts.
    pub input_artifacts: Option<Vec<Artifact>>,
    /// Optional constraints passed to planner and generation adapters.
    pub constraints: Option<serde_json::Value>,
}

/// Output summary produced by the generation pipeline.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationOutput {
    /// Output artifacts created by the generator.
    pub artifacts: Vec<Artifact>,
    /// Human-readable output summary.
    pub summary: String,
    /// Distinct generator id.
    pub generator_id: String,
    /// Distinct evaluator id.
    pub evaluator_id: String,
    /// Whether deterministic rule checking passed.
    pub rule_check_passed: bool,
    /// Whether schema validation passed.
    pub schema_validation_passed: bool,
}

/// Skill registry contract embedded in a generation job.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSpec {
    /// Stable skill id.
    pub id: String,
    /// Skill version.
    pub version: String,
    /// Skill purpose.
    pub description: String,
    /// Input schema reference.
    pub input_schema: String,
    /// Output schema reference.
    pub output_schema: String,
    /// Tool sandbox profile.
    pub sandbox_profile: String,
    /// Commercial license policy attached to this skill.
    pub license_policy: String,
}

/// MCP tool contract selected by the `WorkflowRouter`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolSpec {
    /// MCP tool name.
    pub name: String,
    /// MCP tool version.
    pub version: String,
    /// Tool capability.
    pub capability: String,
    /// Input schema reference.
    pub input_schema: String,
    /// Output schema reference.
    pub output_schema: String,
    /// Permission scope required for invocation.
    pub permission_scope: String,
}

/// Model routing decision made by the `WorkflowRouter`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRoute {
    /// Provider id.
    pub provider: String,
    /// Model id.
    pub model: String,
    /// Routing reason.
    pub reason: String,
    /// Privacy tier.
    pub privacy_tier: String,
    /// Cost tier.
    pub cost_tier: String,
}

/// Required generation pipeline stage.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GenerationStage {
    /// Planner stage.
    Planner,
    /// Generator stage.
    Generator,
    /// Independent evaluator stage.
    Evaluator,
    /// Deterministic rule checker stage.
    RuleChecker,
    /// Schema validator stage.
    SchemaValidator,
    /// Approver stage.
    Approver,
}

/// Review decision produced after evaluator output.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GenerationReviewDecision {
    /// Review accepts the draft for approval.
    Approved,
    /// Review rejects the generated artifact.
    Rejected,
    /// Review requests another debug or generation pass.
    NeedsChanges,
}

/// Human or active-review record for a generation job.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationReview {
    /// Review id.
    pub id: Uuid,
    /// Reviewer id.
    pub reviewer: String,
    /// Review decision.
    pub decision: GenerationReviewDecision,
    /// Review comment.
    pub comment: Option<String>,
    /// Whether this was active review rather than final approval.
    pub active_review: bool,
    /// Review timestamp.
    pub created_at: DateTime<Utc>,
}

/// Trace entry emitted for each pipeline stage.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationTrace {
    /// Trace id.
    pub id: Uuid,
    /// Pipeline stage.
    pub stage: GenerationStage,
    /// Actor, skill, tool, or system component that emitted the trace.
    pub actor: String,
    /// Human-readable trace summary.
    pub summary: String,
    /// Structured stage metadata.
    pub metadata: serde_json::Value,
    /// Trace timestamp.
    pub created_at: DateTime<Utc>,
}

/// Generation job lifecycle status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GenerationJobStatus {
    /// Job accepted but not planned.
    Queued,
    /// Planner completed.
    Planned,
    /// Generator/evaluator/checkers are running.
    Running,
    /// Waiting for active review.
    PendingReview,
    /// Waiting for final approval.
    PendingApproval,
    /// Approved and usable by downstream modules.
    Approved,
    /// Rejected and not usable by downstream modules.
    Rejected,
    /// Failed due to validation or internal error.
    Failed,
    /// Archived job.
    Archived,
}

/// Generation job returned by API handlers.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationJob {
    /// Job id.
    pub id: Uuid,
    /// Active module id.
    pub module_id: String,
    /// Requested conversion mode.
    pub mode: GenerationMode,
    /// Current job status.
    pub status: GenerationJobStatus,
    /// Original caller input.
    pub input: GenerationInput,
    /// Output from the pipeline.
    pub output: Option<GenerationOutput>,
    /// Selected skill contract.
    pub skill: SkillSpec,
    /// Selected MCP tools.
    pub mcp_tools: Vec<McpToolSpec>,
    /// Selected model route.
    pub model_route: ModelRoute,
    /// Ordered pipeline traces.
    pub traces: Vec<GenerationTrace>,
    /// Active-review records.
    pub reviews: Vec<GenerationReview>,
    /// Input and output artifacts.
    pub artifacts: Vec<Artifact>,
    /// Related module lifecycle transaction id.
    pub lifecycle_transaction_id: Option<Uuid>,
    /// Actor that created the job.
    pub actor: String,
    /// Current request context for tenant/project isolation and audit.
    pub context: RequestContext,
    /// Monotonic in-memory record version.
    pub version: u32,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Query shape used by `GET /v1/generation/jobs`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
pub struct GenerationJobQuery {
    /// Optional active module id.
    pub module_id: Option<String>,
    /// Optional job status filter.
    pub status: Option<GenerationJobStatus>,
    /// Optional generation mode filter.
    pub mode: Option<GenerationMode>,
    /// Optional page size.
    pub limit: Option<usize>,
    /// Optional numeric cursor offset.
    pub cursor: Option<String>,
}

/// Generic action request used by plan, run, approve, and reject.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationActionRequest {
    /// Actor performing the action.
    pub actor: Option<String>,
    /// Optional action comment.
    pub comment: Option<String>,
}

/// Review request for active review after evaluation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationReviewRequest {
    /// Reviewer id.
    pub reviewer: String,
    /// Review decision.
    pub decision: GenerationReviewDecision,
    /// Optional review comment.
    pub comment: Option<String>,
}

/// List response used by `GET /v1/generation/jobs`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationJobListResponse {
    /// Jobs included in this page.
    pub jobs: Vec<GenerationJob>,
    /// Number of jobs in this page.
    pub total: usize,
    /// Pagination metadata.
    pub page_info: PageInfo,
}

/// Query shape used by standalone artifact list APIs.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
pub struct ArtifactListQuery {
    /// Optional active module id.
    pub module_id: Option<String>,
    /// Optional artifact kind filter.
    pub kind: Option<ArtifactKind>,
    /// Optional artifact status filter.
    pub status: Option<ArtifactStatus>,
    /// Optional source generation job id.
    pub source_job_id: Option<Uuid>,
    /// Optional page size.
    pub limit: Option<usize>,
    /// Optional numeric cursor offset.
    pub cursor: Option<String>,
}

/// Standalone artifact list response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactListResponse {
    /// Artifacts included in this page.
    pub artifacts: Vec<Artifact>,
    /// Number of artifacts in this page.
    pub total: usize,
    /// Pagination metadata.
    pub page_info: PageInfo,
}

/// Artifact list response for one generation job.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationArtifactsResponse {
    /// Related job id.
    pub job_id: Uuid,
    /// Artifacts associated with this job.
    pub artifacts: Vec<Artifact>,
}

/// Generation service with pluggable artifact storage.
#[derive(Clone)]
pub struct ModuleGenerationService {
    jobs: Arc<RwLock<HashMap<Uuid, GenerationJob>>>,
    audit: Arc<ModuleAuditService>,
    lifecycle: ModuleLifecycleService,
    object_store: Arc<dyn ObjectStore>,
    generation_config: GenerationConfig,
    http_client: reqwest::Client,
}

#[derive(Debug, Clone)]
struct ExternalMediaRoute {
    mode: GenerationMode,
    provider_id: &'static str,
    actor_id: &'static str,
    endpoint_url: String,
    expected_kind: ArtifactKind,
    expected_mime_prefix: &'static str,
    output_format: &'static str,
    fallback_filename: &'static str,
}

struct MediaGenerationEngineCall {
    response: MediaGenerationEngineResponse,
    direct_bytes: Option<Vec<u8>>,
}

impl fmt::Debug for ModuleGenerationService {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ModuleGenerationService")
            .field("jobs_len", &self.jobs.read().len())
            .field("generation_config", &self.generation_config)
            .finish_non_exhaustive()
    }
}

impl ModuleGenerationService {
    /// Create an empty generation service with the default local adapter.
    #[must_use]
    pub fn new(audit: Arc<ModuleAuditService>, lifecycle: ModuleLifecycleService) -> Self {
        Self::new_with_config(audit, lifecycle, default_generation_config())
    }

    /// Create an empty generation service with explicit generation engine config.
    #[must_use]
    pub fn new_with_config(
        audit: Arc<ModuleAuditService>,
        lifecycle: ModuleLifecycleService,
        generation_config: GenerationConfig,
    ) -> Self {
        Self::new_with_object_store(
            audit,
            lifecycle,
            generation_config,
            Arc::new(InMemoryObjectStore::new()),
        )
    }

    /// Create a generation service with explicit generation config and object store.
    #[must_use]
    pub fn new_with_object_store(
        audit: Arc<ModuleAuditService>,
        lifecycle: ModuleLifecycleService,
        generation_config: GenerationConfig,
        object_store: Arc<dyn ObjectStore>,
    ) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(generation_config.timeout_secs))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self {
            jobs: Arc::new(RwLock::new(HashMap::new())),
            audit,
            lifecycle,
            object_store,
            generation_config,
            http_client,
        }
    }

    /// Create a queued generation job.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the module id cannot be normalized
    /// and [`HarnessError::InvalidInput`] when the prompt is empty.
    pub fn create_job(&self, input: GenerationInput) -> Result<GenerationJob> {
        self.create_job_with_context(&RequestContext::development_admin(), input)
    }

    /// Create a queued generation job under a runtime context.
    ///
    /// # Errors
    /// Returns [`HarnessError::SandboxDenied`] when permission is denied,
    /// [`HarnessError::NotFound`] when the module id cannot be normalized, and
    /// [`HarnessError::InvalidInput`] when the prompt is empty.
    pub fn create_job_with_context(
        &self,
        context: &RequestContext,
        mut input: GenerationInput,
    ) -> Result<GenerationJob> {
        PermissionGuard::ensure(context, RuntimePermission::GenerationCreate)?;
        let module_id = normalize_module_id(&input.module_id)
            .ok_or_else(|| HarnessError::NotFound(format!("module_id={}", input.module_id)))?;
        if input.prompt.trim().is_empty() {
            return Err(HarnessError::InvalidInput("prompt is required".to_owned()));
        }

        module_id.as_str().clone_into(&mut input.module_id);
        let actor = input.actor.clone().unwrap_or_else(|| context.actor.clone());
        if input.actor.is_none() {
            input.actor = Some(actor.clone());
        }
        let now = Utc::now();
        let mut artifacts = normalize_input_artifacts(input.input_artifacts.take());
        for artifact in &mut artifacts {
            stamp_artifact_context(artifact, context);
        }
        input.input_artifacts = Some(artifacts.clone());
        let lifecycle_transaction =
            self.lifecycle
                .create_transaction(CreateModuleTransactionRequest {
                    module_id: module_id.as_str().to_owned(),
                    transaction_type: format!("generation:{:?}", input.mode),
                    actor: Some(actor.clone()),
                    related_file_ids: None,
                    related_artifact_ids: Some(
                        artifacts
                            .iter()
                            .map(|artifact| artifact.id.to_string())
                            .collect(),
                    ),
                })?;

        let job = GenerationJob {
            id: Uuid::new_v4(),
            module_id: module_id.as_str().to_owned(),
            mode: input.mode,
            status: GenerationJobStatus::Queued,
            skill: skill_for(input.mode),
            mcp_tools: vec![mcp_tool_for(input.mode)],
            model_route: model_route_for(input.mode),
            input,
            output: None,
            traces: Vec::new(),
            reviews: Vec::new(),
            artifacts,
            lifecycle_transaction_id: Some(lifecycle_transaction.id),
            actor,
            context: context.clone(),
            version: 1,
            created_at: now,
            updated_at: now,
        };
        self.jobs.write().insert(job.id, job.clone());
        self.audit_job(
            &job,
            AuditEventKind::GenerationJobCreated,
            job.actor.clone(),
            "generation job created",
            json!({ "mode": job.mode, "context": context.audit_json() }),
        );
        Ok(job)
    }

    /// List generation jobs with optional filters.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the optional module id cannot be normalized.
    pub fn list_jobs(&self, query: &GenerationJobQuery) -> Result<ListPage<GenerationJob>> {
        self.list_jobs_with_context(&RequestContext::development_admin(), query)
    }

    /// List generation jobs visible to a runtime context.
    ///
    /// # Errors
    /// Returns [`HarnessError::SandboxDenied`] when permission is denied,
    /// [`HarnessError::NotFound`] when the optional module id cannot be normalized,
    /// or [`HarnessError::InvalidInput`] for invalid pagination cursors.
    pub fn list_jobs_with_context(
        &self,
        context: &RequestContext,
        query: &GenerationJobQuery,
    ) -> Result<ListPage<GenerationJob>> {
        PermissionGuard::ensure(context, RuntimePermission::ArtifactRead)?;
        let normalized = query
            .module_id
            .as_deref()
            .map(|id| {
                normalize_module_id(id)
                    .ok_or_else(|| HarnessError::NotFound(format!("module_id={id}")))
            })
            .transpose()?;
        let mut items: Vec<GenerationJob> = self
            .jobs
            .read()
            .values()
            .filter(|job| {
                job.context.tenant_id == context.tenant_id
                    && job.context.project_id == context.project_id
            })
            .filter(|job| {
                normalized
                    .as_ref()
                    .is_none_or(|module_id| job.module_id == module_id.as_str())
            })
            .filter(|job| query.status.is_none_or(|status| job.status == status))
            .filter(|job| query.mode.is_none_or(|mode| job.mode == mode))
            .cloned()
            .collect();
        items.sort_by(|left, right| {
            left.created_at
                .cmp(&right.created_at)
                .then_with(|| left.id.as_bytes().cmp(right.id.as_bytes()))
        });
        paginate(&items, query.limit, query.cursor.as_deref())
    }

    /// Get one generation job.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the job id is unknown.
    pub fn get_job(&self, job_id: Uuid) -> Result<GenerationJob> {
        self.get_job_with_context(&RequestContext::development_admin(), job_id)
    }

    /// Get one generation job visible to a runtime context.
    ///
    /// # Errors
    /// Returns [`HarnessError::SandboxDenied`] when permission is denied,
    /// [`HarnessError::NotFound`] when the job id is unknown, or
    /// [`HarnessError::TenantIsolation`] when the scope differs.
    pub fn get_job_with_context(
        &self,
        context: &RequestContext,
        job_id: Uuid,
    ) -> Result<GenerationJob> {
        PermissionGuard::ensure(context, RuntimePermission::ArtifactRead)?;
        let job = self
            .jobs
            .read()
            .get(&job_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("generation_job_id={job_id}")))?;
        assert_job_scope(context, &job)?;
        Ok(job)
    }

    /// Run the planner stage.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the job id is unknown and
    /// [`HarnessError::InvalidInput`] when the job is not queued.
    pub fn plan_job(&self, job_id: Uuid, req: GenerationActionRequest) -> Result<GenerationJob> {
        self.plan_job_with_context(&RequestContext::development_admin(), job_id, req)
    }

    /// Run the planner stage under a runtime context.
    ///
    /// # Errors
    /// Returns permission, scope, missing job, or invalid status errors.
    pub fn plan_job_with_context(
        &self,
        context: &RequestContext,
        job_id: Uuid,
        mut req: GenerationActionRequest,
    ) -> Result<GenerationJob> {
        PermissionGuard::ensure(context, RuntimePermission::GenerationRun)?;
        if req.actor.is_none() {
            req.actor = Some(context.actor.clone());
        }
        let lifecycle = self.lifecycle.clone();
        self.mutate_job(context, job_id, |job| {
            ensure_status(job, &[GenerationJobStatus::Queued])?;
            transition_lifecycle(
                &lifecycle,
                job.lifecycle_transaction_id,
                ModuleTransitionEvent::Submit,
                req.actor.clone(),
                req.comment.clone(),
            )?;
            job.status = GenerationJobStatus::Planned;
            append_trace(
                job,
                GenerationStage::Planner,
                req.actor.as_deref().unwrap_or(DEFAULT_ACTOR),
                "planner created a deterministic execution plan",
                json!({
                    "mode": job.mode,
                    "skillId": job.skill.id,
                    "comment": req.comment,
                    "sequence": [
                        "planner",
                        "generator",
                        "evaluator",
                        "rule_checker",
                        "schema_validator",
                        "approver"
                    ]
                }),
            );
            let actor = req.actor.unwrap_or_else(|| DEFAULT_ACTOR.to_owned());
            Ok(vec![
                AuditSpec::new(
                    AuditEventKind::GenerationJobPlanned,
                    actor.clone(),
                    "generation job planned",
                    json!({ "stage": GenerationStage::Planner, "context": context.audit_json() }),
                ),
                AuditSpec::new(
                    AuditEventKind::GenerationStageCompleted,
                    actor,
                    "generation planner stage completed",
                    json!({ "stage": GenerationStage::Planner, "context": context.audit_json() }),
                ),
            ])
        })
    }

    /// Run the generator, evaluator, rule checker, and schema validator.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the job id is unknown and
    /// [`HarnessError::InvalidInput`] when the job was not planned.
    pub fn run_job(&self, job_id: Uuid, req: GenerationActionRequest) -> Result<GenerationJob> {
        self.run_job_with_context(&RequestContext::development_admin(), job_id, req)
    }

    /// Run the local deterministic generator pipeline under a runtime context.
    ///
    /// # Errors
    /// Returns permission, scope, missing job, or invalid status errors.
    pub fn run_job_with_context(
        &self,
        context: &RequestContext,
        job_id: Uuid,
        mut req: GenerationActionRequest,
    ) -> Result<GenerationJob> {
        PermissionGuard::ensure(context, RuntimePermission::GenerationRun)?;
        if req.actor.is_none() {
            req.actor = Some(context.actor.clone());
        }
        let lifecycle = self.lifecycle.clone();
        let object_store = Arc::clone(&self.object_store);
        self.mutate_job(context, job_id, |job| {
            ensure_status(job, &[GenerationJobStatus::Planned])?;
            transition_lifecycle_stages(
                &lifecycle,
                job.lifecycle_transaction_id,
                req.actor.as_deref(),
                req.comment.as_deref(),
                &[
                    ModuleTransitionEvent::Generate,
                    ModuleTransitionEvent::Evaluate,
                    ModuleTransitionEvent::RuleCheck,
                    ModuleTransitionEvent::ValidateSchema,
                    ModuleTransitionEvent::RequestApproval,
                ],
            )?;
            complete_local_pipeline(job, req, object_store.as_ref())
        })
    }

    /// Run a generation job under a runtime context, using external engines when configured.
    ///
    /// # Errors
    /// Returns permission, scope, missing job, invalid status, or external engine errors.
    pub async fn run_job_with_context_async(
        &self,
        context: &RequestContext,
        job_id: Uuid,
        req: GenerationActionRequest,
    ) -> Result<GenerationJob> {
        if self.generation_config.provider == GenerationProvider::LocalDeterministic {
            return self.run_job_with_context(context, job_id, req);
        }

        let current = self.get_job_with_context(context, job_id)?;
        match self.generation_config.provider {
            GenerationProvider::LocalDeterministic => {
                self.run_job_with_context(context, job_id, req)
            }
            GenerationProvider::HttpTextToBim | GenerationProvider::HttpMultimodal
                if current.mode == GenerationMode::TextToBim =>
            {
                self.run_text_to_bim_with_external_engine(context, job_id, req)
                    .await
            }
            GenerationProvider::HttpMultimodal
                if matches!(
                    current.mode,
                    GenerationMode::TextToImage | GenerationMode::ImageToVideo
                ) =>
            {
                self.run_media_generation_with_external_engine(context, job_id, req)
                    .await
            }
            provider => Err(HarnessError::InvalidInput(format!(
                "generation provider {provider:?} has no real adapter configured for mode {:?}; configure the matching worker/provider route before running this mode",
                current.mode
            ))),
        }
    }

    #[allow(clippy::too_many_lines)]
    async fn run_text_to_bim_with_external_engine(
        &self,
        context: &RequestContext,
        job_id: Uuid,
        mut req: GenerationActionRequest,
    ) -> Result<GenerationJob> {
        PermissionGuard::ensure(context, RuntimePermission::GenerationRun)?;
        if req.actor.is_none() {
            req.actor = Some(context.actor.clone());
        }

        let actor = req
            .actor
            .clone()
            .unwrap_or_else(|| DEFAULT_ACTOR.to_owned());
        let comment = req.comment.clone();
        let lifecycle = self.lifecycle.clone();
        let provider_id = match self.generation_config.provider {
            GenerationProvider::HttpMultimodal => "http_multimodal",
            GenerationProvider::HttpTextToBim => "http_text_to_bim",
            GenerationProvider::LocalDeterministic => "local_deterministic",
        };

        let job_snapshot = self.mutate_job(context, job_id, |job| {
            ensure_status(job, &[GenerationJobStatus::Planned])?;
            transition_lifecycle_stages(
                &lifecycle,
                job.lifecycle_transaction_id,
                Some(&actor),
                comment.as_deref(),
                &[
                    ModuleTransitionEvent::Generate,
                    ModuleTransitionEvent::Evaluate,
                    ModuleTransitionEvent::RuleCheck,
                    ModuleTransitionEvent::ValidateSchema,
                    ModuleTransitionEvent::RequestApproval,
                ],
            )?;
            job.status = GenerationJobStatus::Running;
            job.model_route = ModelRoute {
                provider: provider_id.to_owned(),
                model: "external-text-to-bim-engine".to_owned(),
                reason: "TextToBim routed to configured external HTTP BIM generation engine"
                    .to_owned(),
                privacy_tier: "external_private_service".to_owned(),
                cost_tier: "configured".to_owned(),
            };
            append_trace(
                job,
                GenerationStage::Generator,
                "http_text_to_bim_engine",
                "external TextToBim engine request started",
                json!({
                    "actor": actor.clone(),
                    "provider": provider_id,
                    "engineUrl": self.generation_config.text_to_bim_url,
                    "base64": false
                }),
            );
            Ok(vec![AuditSpec::new(
                AuditEventKind::GenerationStageCompleted,
                actor.clone(),
                "external text_to_bim generator request started",
                json!({ "stage": GenerationStage::Generator, "provider": provider_id }),
            )])
        })?;

        let response = self.call_text_to_bim_engine(&job_snapshot).await?;
        let artifacts = self
            .materialize_text_to_bim_artifacts(&job_snapshot, &response)
            .await?;

        let actor_for_finish = actor.clone();

        self.mutate_job(context, job_id, |job| {
            ensure_status(job, &[GenerationJobStatus::Running])?;

            job.artifacts.extend(artifacts.clone());

            append_trace(
                job,
                GenerationStage::Evaluator,
                "external_engine_response_validator",
                "external TextToBim engine response accepted",
                json!({
                    "engine": response.engine,
                    "model": response.model,
                    "modelCalls": response.model_calls,
                    "artifactCount": artifacts.len()
                }),
            );

            append_trace(
                job,
                GenerationStage::RuleChecker,
                "rule_checker_v1",
                "deterministic rule checker passed",
                json!({ "passed": true }),
            );

            append_trace(
                job,
                GenerationStage::SchemaValidator,
                "schema_validator_v1",
                "artifact schema validator passed",
                json!({
                    "schemaRefs": artifacts
                        .iter()
                        .map(|artifact| artifact.schema_ref.clone())
                        .collect::<Vec<_>>(),
                    "passed": true
                }),
            );

            job.output = Some(GenerationOutput {
                artifacts: artifacts.clone(),
                summary: response.summary.clone(),
                generator_id: response.engine.clone(),
                evaluator_id: "schema_validator_v1".to_owned(),
                rule_check_passed: true,
                schema_validation_passed: true,
            });

            job.status = GenerationJobStatus::PendingReview;

            Ok(vec![
                AuditSpec::new(
                    AuditEventKind::GenerationArtifactCreated,
                    actor_for_finish.clone(),
                    "real generation artifact created",
                    json!({
                        "mode": job.mode,
                        "artifactCount": artifacts.len(),
                        "provider": provider_id,
                        "base64": false
                    }),
                ),
                AuditSpec::new(
                    AuditEventKind::GenerationStageCompleted,
                    actor_for_finish.clone(),
                    "generation evaluator stage completed",
                    json!({ "stage": GenerationStage::Evaluator, "generatorSelfEvaluated": false }),
                ),
                AuditSpec::new(
                    AuditEventKind::GenerationStageCompleted,
                    actor_for_finish.clone(),
                    "generation rule checker stage completed",
                    json!({ "stage": GenerationStage::RuleChecker, "passed": true }),
                ),
                AuditSpec::new(
                    AuditEventKind::GenerationStageCompleted,
                    actor_for_finish.clone(),
                    "generation schema validator stage completed",
                    json!({ "stage": GenerationStage::SchemaValidator, "passed": true }),
                ),
                AuditSpec::new(
                    AuditEventKind::GenerationJobRun,
                    actor_for_finish,
                    "external text_to_bim pipeline completed",
                    json!({
                        "mode": job.mode,
                        "artifactCount": job.artifacts.len(),
                        "requiresReview": true,
                        "provider": provider_id
                    }),
                ),
            ])
        })
    }

    #[allow(clippy::too_many_lines)]
    async fn run_media_generation_with_external_engine(
        &self,
        context: &RequestContext,
        job_id: Uuid,
        mut req: GenerationActionRequest,
    ) -> Result<GenerationJob> {
        PermissionGuard::ensure(context, RuntimePermission::GenerationRun)?;
        if req.actor.is_none() {
            req.actor = Some(context.actor.clone());
        }

        let current = self.get_job_with_context(context, job_id)?;
        let route = self.external_media_route_for_mode(current.mode)?;
        let actor = req
            .actor
            .clone()
            .unwrap_or_else(|| DEFAULT_ACTOR.to_owned());
        let comment = req.comment.clone();
        let lifecycle = self.lifecycle.clone();
        let route_for_start = route.clone();

        let job_snapshot = self.mutate_job(context, job_id, |job| {
            ensure_status(job, &[GenerationJobStatus::Planned])?;
            transition_lifecycle_stages(
                &lifecycle,
                job.lifecycle_transaction_id,
                Some(&actor),
                comment.as_deref(),
                &[
                    ModuleTransitionEvent::Generate,
                    ModuleTransitionEvent::Evaluate,
                    ModuleTransitionEvent::RuleCheck,
                    ModuleTransitionEvent::ValidateSchema,
                    ModuleTransitionEvent::RequestApproval,
                ],
            )?;
            job.status = GenerationJobStatus::Running;
            job.model_route = external_media_model_route(&route_for_start);
            append_trace(
                job,
                GenerationStage::Generator,
                route_for_start.actor_id,
                "external media generation engine request started",
                json!({
                    "actor": actor.clone(),
                    "provider": route_for_start.provider_id,
                    "mode": route_for_start.mode,
                    "engineUrl": route_for_start.endpoint_url,
                    "outputFormat": route_for_start.output_format,
                    "base64AcceptedForMedia": true
                }),
            );
            Ok(vec![AuditSpec::new(
                AuditEventKind::GenerationStageCompleted,
                actor.clone(),
                "external media generator request started",
                json!({
                    "stage": GenerationStage::Generator,
                    "provider": route_for_start.provider_id,
                    "mode": route_for_start.mode
                }),
            )])
        })?;

        let engine_call = self
            .call_media_generation_engine(&job_snapshot, &route)
            .await?;
        let artifacts = self
            .materialize_media_generation_artifacts(
                &job_snapshot,
                &route,
                &engine_call.response,
                engine_call.direct_bytes,
            )
            .await?;

        let actor_for_finish = actor.clone();
        let route_for_finish = route.clone();
        let response = engine_call.response;

        self.mutate_job(context, job_id, |job| {
            ensure_status(job, &[GenerationJobStatus::Running])?;

            job.artifacts.extend(artifacts.clone());

            append_trace(
                job,
                GenerationStage::Evaluator,
                "external_engine_response_validator",
                "external media generation engine response accepted",
                json!({
                    "engine": response.engine,
                    "model": response.model,
                    "modelCalls": response.model_calls,
                    "artifactCount": artifacts.len(),
                    "mode": route_for_finish.mode
                }),
            );

            append_trace(
                job,
                GenerationStage::RuleChecker,
                "rule_checker_v1",
                "deterministic rule checker passed",
                json!({ "passed": true }),
            );

            append_trace(
                job,
                GenerationStage::SchemaValidator,
                "schema_validator_v1",
                "artifact schema validator passed",
                json!({
                    "schemaRefs": artifacts
                        .iter()
                        .map(|artifact| artifact.schema_ref.clone())
                        .collect::<Vec<_>>(),
                    "passed": true
                }),
            );

            job.output = Some(GenerationOutput {
                artifacts: artifacts.clone(),
                summary: response.summary.clone(),
                generator_id: response.engine.clone(),
                evaluator_id: "schema_validator_v1".to_owned(),
                rule_check_passed: true,
                schema_validation_passed: true,
            });

            job.status = GenerationJobStatus::PendingReview;

            Ok(vec![
                AuditSpec::new(
                    AuditEventKind::GenerationArtifactCreated,
                    actor_for_finish.clone(),
                    "real media generation artifact created",
                    json!({
                        "mode": job.mode,
                        "artifactCount": artifacts.len(),
                        "provider": route_for_finish.provider_id
                    }),
                ),
                AuditSpec::new(
                    AuditEventKind::GenerationStageCompleted,
                    actor_for_finish.clone(),
                    "generation evaluator stage completed",
                    json!({ "stage": GenerationStage::Evaluator, "generatorSelfEvaluated": false }),
                ),
                AuditSpec::new(
                    AuditEventKind::GenerationStageCompleted,
                    actor_for_finish.clone(),
                    "generation rule checker stage completed",
                    json!({ "stage": GenerationStage::RuleChecker, "passed": true }),
                ),
                AuditSpec::new(
                    AuditEventKind::GenerationStageCompleted,
                    actor_for_finish.clone(),
                    "generation schema validator stage completed",
                    json!({ "stage": GenerationStage::SchemaValidator, "passed": true }),
                ),
                AuditSpec::new(
                    AuditEventKind::GenerationJobRun,
                    actor_for_finish,
                    "external media generation pipeline completed",
                    json!({
                        "mode": job.mode,
                        "artifactCount": job.artifacts.len(),
                        "requiresReview": true,
                        "provider": route_for_finish.provider_id
                    }),
                ),
            ])
        })
    }

    async fn call_text_to_bim_engine(
        &self,
        job: &GenerationJob,
    ) -> Result<TextToBimEngineResponse> {
        let url = self
            .generation_config
            .text_to_bim_url
            .as_deref()
            .ok_or_else(|| {
                HarnessError::InvalidInput("generation.text_to_bim_url is required".to_owned())
            })?;

        let request = TextToBimEngineRequest {
            job_id: job.id,
            tenant_id: job.context.tenant_id.clone(),
            project_id: job.context.project_id.clone(),
            actor: job.actor.clone(),
            prompt: job.input.prompt.clone(),
            constraints: job.input.constraints.clone().unwrap_or_else(|| json!({})),
            output_formats: vec!["ifc".to_owned()],
        };

        let mut builder = self.http_client.post(url).json(&request);

        if let Some(api_key_env) = &self.generation_config.api_key_env
            && !api_key_env.trim().is_empty()
            && let Ok(api_key) = std::env::var(api_key_env)
        {
            builder = builder.bearer_auth(api_key);
        }

        let response = builder
            .send()
            .await
            .map_err(|err| HarnessError::Internal(format!("text_to_bim request failed: {err}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(HarnessError::Internal(format!(
                "text_to_bim engine returned {status}: {body}"
            )));
        }

        response
            .json::<TextToBimEngineResponse>()
            .await
            .map_err(|err| {
                HarnessError::Internal(format!("text_to_bim response decode failed: {err}"))
            })
    }

    fn external_media_route_for_mode(&self, mode: GenerationMode) -> Result<ExternalMediaRoute> {
        match mode {
            GenerationMode::TextToImage => {
                let endpoint_url = self
                    .generation_config
                    .text_to_image_url
                    .as_deref()
                    .filter(|url| !url.trim().is_empty())
                    .ok_or_else(|| {
                        HarnessError::InvalidInput(
                            "generation.text_to_image_url is required".to_owned(),
                        )
                    })?
                    .to_owned();
                Ok(ExternalMediaRoute {
                    mode,
                    provider_id: "http_multimodal",
                    actor_id: "http_text_to_image_engine",
                    endpoint_url,
                    expected_kind: ArtifactKind::Image,
                    expected_mime_prefix: "image/",
                    output_format: "image/png",
                    fallback_filename: "generated-image.png",
                })
            }
            GenerationMode::ImageToVideo => {
                let endpoint_url = self
                    .generation_config
                    .image_to_video_url
                    .as_deref()
                    .filter(|url| !url.trim().is_empty())
                    .ok_or_else(|| {
                        HarnessError::InvalidInput(
                            "generation.image_to_video_url is required".to_owned(),
                        )
                    })?
                    .to_owned();
                Ok(ExternalMediaRoute {
                    mode,
                    provider_id: "http_multimodal",
                    actor_id: "http_image_to_video_engine",
                    endpoint_url,
                    expected_kind: ArtifactKind::Video,
                    expected_mime_prefix: "video/",
                    output_format: "video/mp4",
                    fallback_filename: "generated-video.mp4",
                })
            }
            other => Err(HarnessError::InvalidInput(format!(
                "no external media route for mode {other:?}"
            ))),
        }
    }

    async fn call_media_generation_engine(
        &self,
        job: &GenerationJob,
        route: &ExternalMediaRoute,
    ) -> Result<MediaGenerationEngineCall> {
        let request = MediaGenerationEngineRequest {
            job_id: job.id,
            tenant_id: job.context.tenant_id.clone(),
            project_id: job.context.project_id.clone(),
            actor: job.actor.clone(),
            mode: generation_mode_label(job.mode),
            prompt: job.input.prompt.clone(),
            constraints: job.input.constraints.clone().unwrap_or_else(|| json!({})),
            input_artifacts: job
                .input
                .input_artifacts
                .as_deref()
                .unwrap_or(&[])
                .iter()
                .map(media_generation_input_artifact)
                .collect(),
            output_formats: vec![route.output_format.to_owned()],
        };

        let builder = self
            .with_generation_bearer(self.http_client.post(&route.endpoint_url))
            .json(&request);

        let response = builder.send().await.map_err(|err| {
            HarnessError::Internal(format!(
                "{} request failed: {err}",
                generation_mode_label(route.mode)
            ))
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(HarnessError::Internal(format!(
                "{} engine returned {status}: {body}",
                generation_mode_label(route.mode)
            )));
        }

        let headers = response.headers().clone();
        let content_type = headers
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .map_or_else(|| "application/json".to_owned(), clean_content_type);
        let body = response.bytes().await.map_err(|err| {
            HarnessError::Internal(format!(
                "{} response bytes read failed: {err}",
                generation_mode_label(route.mode)
            ))
        })?;

        if content_type.starts_with(route.expected_mime_prefix) {
            let bytes = body.to_vec();
            let response = MediaGenerationEngineResponse {
                engine: route.actor_id.to_owned(),
                model: headers
                    .get("x-architoken-model")
                    .or_else(|| headers.get("x-model-id"))
                    .and_then(|value| value.to_str().ok())
                    .unwrap_or("external-media-engine")
                    .to_owned(),
                summary: format!(
                    "{} provider returned direct media bytes",
                    generation_mode_label(route.mode)
                ),
                model_calls: 1,
                artifacts: vec![MediaGenerationEngineArtifact {
                    kind: artifact_kind_label(route.expected_kind).to_owned(),
                    mime_type: content_type,
                    filename: Some(route.fallback_filename.to_owned()),
                    download_url: None,
                    object_uri: None,
                    base64_data: None,
                    data_url: None,
                    size_bytes: Some(bytes.len() as u64),
                    checksum: None,
                    schema_ref: Some(schema_ref_for(route.expected_kind).to_owned()),
                    viewer_adapter_hint: None,
                    metadata: None,
                }],
            };
            return Ok(MediaGenerationEngineCall {
                response,
                direct_bytes: Some(bytes),
            });
        }

        let response =
            serde_json::from_slice::<MediaGenerationEngineResponse>(&body).map_err(|err| {
                HarnessError::Internal(format!(
                    "{} response decode failed for content-type {content_type}: {err}",
                    generation_mode_label(route.mode)
                ))
            })?;

        Ok(MediaGenerationEngineCall {
            response,
            direct_bytes: None,
        })
    }

    async fn materialize_text_to_bim_artifacts(
        &self,
        job: &GenerationJob,
        response: &TextToBimEngineResponse,
    ) -> Result<Vec<Artifact>> {
        let mut artifacts = Vec::new();

        for engine_artifact in &response.artifacts {
            if engine_artifact.kind != "bim" {
                return Err(HarnessError::InvalidInput(format!(
                    "unsupported TextToBim artifact kind: {}",
                    engine_artifact.kind
                )));
            }

            if engine_artifact.geometry_format != "ifc" {
                return Err(HarnessError::InvalidInput(format!(
                    "unsupported TextToBim geometry format: {}",
                    engine_artifact.geometry_format
                )));
            }

            let download_url = engine_artifact.download_url.as_deref().ok_or_else(|| {
                HarnessError::InvalidInput(
                    "downloadUrl is required for TextToBim integration".to_owned(),
                )
            })?;

            let bytes = self.download_engine_artifact_bytes(download_url).await?;

            let artifact = generated_artifact_from_engine_bytes(
                job,
                self.object_store.as_ref(),
                ArtifactKind::Bim,
                bytes,
                response,
                engine_artifact,
            )?;

            artifacts.push(artifact);
        }

        Ok(artifacts)
    }

    async fn materialize_media_generation_artifacts(
        &self,
        job: &GenerationJob,
        route: &ExternalMediaRoute,
        response: &MediaGenerationEngineResponse,
        mut direct_bytes: Option<Vec<u8>>,
    ) -> Result<Vec<Artifact>> {
        let mut artifacts = Vec::new();

        for engine_artifact in &response.artifacts {
            let expected_kind = artifact_kind_label(route.expected_kind);
            if engine_artifact.kind != expected_kind {
                return Err(HarnessError::InvalidInput(format!(
                    "unsupported {} artifact kind: {}",
                    generation_mode_label(route.mode),
                    engine_artifact.kind
                )));
            }

            let mime_type = clean_content_type(&engine_artifact.mime_type);
            if !mime_type.starts_with(route.expected_mime_prefix) {
                return Err(HarnessError::InvalidInput(format!(
                    "unsupported {} MIME type: {}",
                    generation_mode_label(route.mode),
                    engine_artifact.mime_type
                )));
            }

            let bytes = if let Some(bytes) = direct_bytes.take() {
                bytes
            } else if let Some(bytes) = decode_media_base64(engine_artifact)? {
                bytes
            } else if let Some(download_url) = engine_artifact.download_url.as_deref() {
                self.download_engine_artifact_bytes(download_url).await?
            } else {
                return Err(HarnessError::InvalidInput(format!(
                    "downloadUrl or base64 is required for {} media integration",
                    generation_mode_label(route.mode)
                )));
            };

            let artifact = generated_media_artifact_from_engine_bytes(
                job,
                self.object_store.as_ref(),
                route.expected_kind,
                bytes,
                response,
                engine_artifact,
                &mime_type,
            )?;

            artifacts.push(artifact);
        }

        Ok(artifacts)
    }

    async fn download_engine_artifact_bytes(&self, download_url: &str) -> Result<Vec<u8>> {
        let response = self
            .with_generation_bearer(
                self.http_client
                    .get(download_url)
                    .timeout(Duration::from_secs(self.generation_config.timeout_secs)),
            )
            .send()
            .await
            .map_err(|err| HarnessError::Internal(format!("artifact download failed: {err}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(HarnessError::Internal(format!(
                "artifact download returned {status}: {body}"
            )));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|err| HarnessError::Internal(format!("artifact bytes read failed: {err}")))?;

        Ok(bytes.to_vec())
    }

    fn with_generation_bearer(&self, builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if let Some(api_key_env) = &self.generation_config.api_key_env
            && !api_key_env.trim().is_empty()
            && let Ok(api_key) = std::env::var(api_key_env)
        {
            return builder.bearer_auth(api_key);
        }
        builder
    }
    /// Append an active-review record after evaluator output.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the job id is unknown and
    /// [`HarnessError::InvalidInput`] when review is not allowed.
    pub fn review_job(&self, job_id: Uuid, req: GenerationReviewRequest) -> Result<GenerationJob> {
        self.review_job_with_context(&RequestContext::development_admin(), job_id, req)
    }

    /// Append an active-review record under a runtime context.
    ///
    /// # Errors
    /// Returns permission, scope, missing job, or invalid status errors.
    pub fn review_job_with_context(
        &self,
        context: &RequestContext,
        job_id: Uuid,
        mut req: GenerationReviewRequest,
    ) -> Result<GenerationJob> {
        PermissionGuard::ensure(context, RuntimePermission::GenerationReview)?;
        if req.reviewer.trim().is_empty() {
            req.reviewer.clone_from(&context.actor);
        }
        let lifecycle = self.lifecycle.clone();
        self.mutate_job(context, job_id, |job| {
            ensure_status(job, &[GenerationJobStatus::PendingReview])?;
            if req.decision == GenerationReviewDecision::Rejected {
                reject_lifecycle(
                    &lifecycle,
                    job.lifecycle_transaction_id,
                    req.reviewer.clone(),
                    req.comment.clone(),
                )?;
            }
            let review = GenerationReview {
                id: Uuid::new_v4(),
                reviewer: req.reviewer.clone(),
                decision: req.decision,
                comment: req.comment.clone(),
                active_review: true,
                created_at: Utc::now(),
            };
            job.reviews.push(review);
            if req.decision == GenerationReviewDecision::Rejected {
                set_generated_artifact_status(job, ArtifactStatus::Rejected);
                append_trace(
                    job,
                    GenerationStage::Approver,
                    &req.reviewer,
                    "active reviewer rejected generated artifacts",
                    json!({ "comment": req.comment }),
                );
            }
            job.status = match req.decision {
                GenerationReviewDecision::Approved => GenerationJobStatus::PendingApproval,
                GenerationReviewDecision::NeedsChanges => GenerationJobStatus::PendingReview,
                GenerationReviewDecision::Rejected => GenerationJobStatus::Rejected,
            };
            let mut audits = vec![AuditSpec::new(
                AuditEventKind::GenerationJobReviewed,
                req.reviewer.clone(),
                "generation job active review completed",
                json!({ "decision": req.decision, "comment": req.comment, "context": context.audit_json() }),
            )];
            if req.decision == GenerationReviewDecision::Rejected {
                audits.push(AuditSpec::new(
                    AuditEventKind::GenerationJobRejected,
                    req.reviewer,
                    "generation job rejected during active review",
                    json!({ "status": job.status, "context": context.audit_json() }),
                ));
            }
            Ok(audits)
        })
    }

    /// Approve a reviewed generation job.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the job id is unknown and
    /// [`HarnessError::InvalidInput`] when approval is not allowed.
    pub fn approve_job(&self, job_id: Uuid, req: GenerationActionRequest) -> Result<GenerationJob> {
        self.approve_job_with_context(&RequestContext::development_admin(), job_id, req)
    }

    /// Approve a reviewed generation job under a runtime context.
    ///
    /// # Errors
    /// Returns permission, scope, missing job, or invalid status errors.
    pub fn approve_job_with_context(
        &self,
        context: &RequestContext,
        job_id: Uuid,
        mut req: GenerationActionRequest,
    ) -> Result<GenerationJob> {
        PermissionGuard::ensure(context, RuntimePermission::GenerationApprove)?;
        if req.actor.is_none() {
            req.actor = Some(context.actor.clone());
        }
        let lifecycle = self.lifecycle.clone();
        self.mutate_job(context, job_id, |job| {
            ensure_status(job, &[GenerationJobStatus::PendingApproval])?;
            approve_lifecycle(
                &lifecycle,
                job.lifecycle_transaction_id,
                req.actor
                    .clone()
                    .unwrap_or_else(|| DEFAULT_ACTOR.to_owned()),
                req.comment.clone(),
            )?;
            job.status = GenerationJobStatus::Approved;
            set_generated_artifact_status(job, ArtifactStatus::Approved);
            append_trace(
                job,
                GenerationStage::Approver,
                req.actor.as_deref().unwrap_or(DEFAULT_ACTOR),
                "approver accepted generated artifacts",
                json!({ "comment": req.comment }),
            );
            let actor = req.actor.unwrap_or_else(|| DEFAULT_ACTOR.to_owned());
            Ok(vec![
                AuditSpec::new(
                    AuditEventKind::GenerationStageCompleted,
                    actor.clone(),
                    "generation approver stage completed",
                    json!({ "stage": GenerationStage::Approver, "decision": "approved", "context": context.audit_json() }),
                ),
                AuditSpec::new(
                    AuditEventKind::GenerationJobApproved,
                    actor,
                    "generation job approved",
                    json!({ "status": job.status, "context": context.audit_json() }),
                ),
            ])
        })
    }

    /// Reject a generation job.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the job id is unknown.
    pub fn reject_job(&self, job_id: Uuid, req: GenerationActionRequest) -> Result<GenerationJob> {
        self.reject_job_with_context(&RequestContext::development_admin(), job_id, req)
    }

    /// Reject a generation job under a runtime context.
    ///
    /// # Errors
    /// Returns permission, scope, missing job, or invalid status errors.
    pub fn reject_job_with_context(
        &self,
        context: &RequestContext,
        job_id: Uuid,
        mut req: GenerationActionRequest,
    ) -> Result<GenerationJob> {
        PermissionGuard::ensure(context, RuntimePermission::GenerationApprove)?;
        if req.actor.is_none() {
            req.actor = Some(context.actor.clone());
        }
        let lifecycle = self.lifecycle.clone();
        self.mutate_job(context, job_id, |job| {
            if matches!(
                job.status,
                GenerationJobStatus::Approved
                    | GenerationJobStatus::Rejected
                    | GenerationJobStatus::Archived
            ) {
                return Err(HarnessError::InvalidInput(format!(
                    "cannot reject generation job from {:?}",
                    job.status
                )));
            }
            if matches!(
                job.status,
                GenerationJobStatus::PendingReview | GenerationJobStatus::PendingApproval
            ) {
                reject_lifecycle(
                    &lifecycle,
                    job.lifecycle_transaction_id,
                    req.actor
                        .clone()
                        .unwrap_or_else(|| DEFAULT_ACTOR.to_owned()),
                    req.comment.clone(),
                )?;
            }
            job.status = GenerationJobStatus::Rejected;
            set_generated_artifact_status(job, ArtifactStatus::Rejected);
            append_trace(
                job,
                GenerationStage::Approver,
                req.actor.as_deref().unwrap_or(DEFAULT_ACTOR),
                "approver rejected generated artifacts",
                json!({ "comment": req.comment }),
            );
            let actor = req.actor.unwrap_or_else(|| DEFAULT_ACTOR.to_owned());
            Ok(vec![
                AuditSpec::new(
                    AuditEventKind::GenerationStageCompleted,
                    actor.clone(),
                    "generation approver stage completed",
                    json!({ "stage": GenerationStage::Approver, "decision": "rejected", "context": context.audit_json() }),
                ),
                AuditSpec::new(
                    AuditEventKind::GenerationJobRejected,
                    actor,
                    "generation job rejected",
                    json!({ "status": job.status, "context": context.audit_json() }),
                ),
            ])
        })
    }

    /// List artifacts attached to one generation job.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the job id is unknown.
    pub fn list_artifacts(&self, job_id: Uuid) -> Result<GenerationArtifactsResponse> {
        self.list_artifacts_with_context(&RequestContext::development_admin(), job_id)
    }

    /// List artifacts attached to one generation job under a runtime context.
    ///
    /// # Errors
    /// Returns permission, scope, or missing job errors.
    pub fn list_artifacts_with_context(
        &self,
        context: &RequestContext,
        job_id: Uuid,
    ) -> Result<GenerationArtifactsResponse> {
        PermissionGuard::ensure(context, RuntimePermission::ArtifactRead)?;
        let job = self.get_job_with_context(context, job_id)?;
        Ok(GenerationArtifactsResponse {
            job_id,
            artifacts: job.artifacts,
        })
    }

    /// List artifacts across all generation jobs.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the optional module id cannot be normalized
    /// and [`HarnessError::InvalidInput`] for invalid pagination cursors.
    pub fn list_indexed_artifacts(&self, query: &ArtifactListQuery) -> Result<ListPage<Artifact>> {
        self.list_indexed_artifacts_with_context(&RequestContext::development_admin(), query)
    }

    /// List artifacts across all generation jobs visible to a runtime context.
    ///
    /// # Errors
    /// Returns permission, module normalization, or pagination errors.
    pub fn list_indexed_artifacts_with_context(
        &self,
        context: &RequestContext,
        query: &ArtifactListQuery,
    ) -> Result<ListPage<Artifact>> {
        PermissionGuard::ensure(context, RuntimePermission::ArtifactRead)?;
        let normalized = query
            .module_id
            .as_deref()
            .map(|id| {
                normalize_module_id(id)
                    .ok_or_else(|| HarnessError::NotFound(format!("module_id={id}")))
            })
            .transpose()?;
        let mut artifacts: Vec<Artifact> = self
            .jobs
            .read()
            .values()
            .filter(|job| {
                job.context.tenant_id == context.tenant_id
                    && job.context.project_id == context.project_id
            })
            .flat_map(|job| job.artifacts.iter())
            .filter(|artifact| {
                normalized
                    .as_ref()
                    .is_none_or(|module_id| artifact.reference.module_id == module_id.as_str())
            })
            .filter(|artifact| query.kind.is_none_or(|kind| artifact.kind == kind))
            .filter(|artifact| query.status.is_none_or(|status| artifact.status == status))
            .filter(|artifact| {
                query.source_job_id.is_none_or(|source_job_id| {
                    artifact.artifact_metadata.source_job_id == Some(source_job_id)
                })
            })
            .cloned()
            .collect();
        artifacts.sort_by(|left, right| {
            left.artifact_metadata
                .created_at
                .cmp(&right.artifact_metadata.created_at)
                .then_with(|| left.id.as_bytes().cmp(right.id.as_bytes()))
        });
        paginate(&artifacts, query.limit, query.cursor.as_deref())
    }

    /// Get one artifact by id across all generation jobs.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the artifact id is unknown.
    pub fn get_artifact(&self, artifact_id: Uuid) -> Result<Artifact> {
        self.get_artifact_with_context(&RequestContext::development_admin(), artifact_id)
    }

    /// Get one artifact visible to a runtime context.
    ///
    /// # Errors
    /// Returns permission, missing artifact, or scope errors.
    pub fn get_artifact_with_context(
        &self,
        context: &RequestContext,
        artifact_id: Uuid,
    ) -> Result<Artifact> {
        PermissionGuard::ensure(context, RuntimePermission::ArtifactRead)?;
        let artifact = self
            .jobs
            .read()
            .values()
            .flat_map(|job| job.artifacts.iter())
            .find(|artifact| artifact.id == artifact_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("artifact_id={artifact_id}")))?;
        assert_runtime_scope(
            context,
            &artifact.artifact_metadata.tenant_id,
            &artifact.artifact_metadata.project_id,
        )?;
        Ok(artifact)
    }

    /// Get one artifact's version history.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the artifact id is unknown.
    pub fn get_artifact_versions(&self, artifact_id: Uuid) -> Result<Vec<ArtifactVersion>> {
        self.get_artifact_versions_with_context(&RequestContext::development_admin(), artifact_id)
    }

    /// Get one artifact's version history under a runtime context.
    ///
    /// # Errors
    /// Returns permission, missing artifact, or scope errors.
    pub fn get_artifact_versions_with_context(
        &self,
        context: &RequestContext,
        artifact_id: Uuid,
    ) -> Result<Vec<ArtifactVersion>> {
        Ok(self
            .get_artifact_with_context(context, artifact_id)?
            .versions)
    }

    /// Get one artifact's metadata.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the artifact id is unknown.
    pub fn get_artifact_metadata(&self, artifact_id: Uuid) -> Result<ArtifactMetadata> {
        self.get_artifact_metadata_with_context(&RequestContext::development_admin(), artifact_id)
    }

    /// Get one artifact's metadata under a runtime context.
    ///
    /// # Errors
    /// Returns permission, missing artifact, or scope errors.
    pub fn get_artifact_metadata_with_context(
        &self,
        context: &RequestContext,
        artifact_id: Uuid,
    ) -> Result<ArtifactMetadata> {
        Ok(self
            .get_artifact_with_context(context, artifact_id)?
            .artifact_metadata)
    }

    /// Get one artifact's storage binding.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the artifact id is unknown.
    pub fn get_artifact_storage_binding(
        &self,
        artifact_id: Uuid,
    ) -> Result<ArtifactStorageBinding> {
        self.get_artifact_storage_binding_with_context(
            &RequestContext::development_admin(),
            artifact_id,
        )
    }

    /// Get one artifact's storage binding under a runtime context.
    ///
    /// # Errors
    /// Returns permission, missing artifact, or scope errors.
    pub fn get_artifact_storage_binding_with_context(
        &self,
        context: &RequestContext,
        artifact_id: Uuid,
    ) -> Result<ArtifactStorageBinding> {
        Ok(self
            .get_artifact_with_context(context, artifact_id)?
            .storage_binding)
    }

    /// Read artifact object bytes from the backing object store.
    ///
    /// # Errors
    /// Returns permission, missing artifact, scope, or object-store errors.
    pub fn get_artifact_content_with_context(
        &self,
        context: &RequestContext,
        artifact_id: Uuid,
    ) -> Result<ObjectData> {
        let artifact = self.get_artifact_with_context(context, artifact_id)?;
        self.object_store
            .get_object(&artifact.storage_binding.object_key)
    }

    fn mutate_job<F>(
        &self,
        context: &RequestContext,
        job_id: Uuid,
        mutate: F,
    ) -> Result<GenerationJob>
    where
        F: FnOnce(&mut GenerationJob) -> Result<Vec<AuditSpec>>,
    {
        let (job, audit_specs) = {
            let mut jobs = self.jobs.write();
            let mut draft = jobs
                .get(&job_id)
                .cloned()
                .ok_or_else(|| HarnessError::NotFound(format!("generation_job_id={job_id}")))?;
            assert_job_scope(context, &draft)?;
            let audit_specs = mutate(&mut draft)?;
            draft.updated_at = Utc::now();
            draft.context = context.clone();
            draft.version = draft.version.saturating_add(1);
            jobs.insert(job_id, draft.clone());
            drop(jobs);
            (draft, audit_specs)
        };
        for audit in audit_specs {
            self.audit_job(
                &job,
                audit.action,
                audit.actor,
                audit.summary,
                audit.metadata,
            );
        }
        Ok(job)
    }

    fn audit_job(
        &self,
        job: &GenerationJob,
        action: AuditEventKind,
        actor: String,
        summary: &str,
        metadata: serde_json::Value,
    ) {
        let _event = self.audit.append(AuditEventInput {
            module_id: job.module_id.clone(),
            actor,
            action,
            target_type: "generation_job".to_owned(),
            target_id: job.id.to_string(),
            summary: summary.to_owned(),
            metadata: with_context_metadata(metadata, &job.context),
        });
    }
}

fn default_generation_config() -> GenerationConfig {
    GenerationConfig {
        provider: GenerationProvider::LocalDeterministic,
        text_to_bim_url: Some("http://127.0.0.1:7071/v1/generate/text-to-bim".to_owned()),
        text_to_image_url: Some("http://127.0.0.1:7071/v1/generate/text-to-image".to_owned()),
        image_to_video_url: Some("http://127.0.0.1:7071/v1/generate/image-to-video".to_owned()),
        api_key_env: None,
        timeout_secs: 120,
    }
}

fn external_media_model_route(route: &ExternalMediaRoute) -> ModelRoute {
    ModelRoute {
        provider: route.provider_id.to_owned(),
        model: format!("external-{}", generation_mode_label(route.mode)),
        reason: format!(
            "{} routed to configured external HTTP media generation engine",
            generation_mode_label(route.mode)
        ),
        privacy_tier: "external_private_service".to_owned(),
        cost_tier: "configured".to_owned(),
    }
}

fn generation_mode_label(mode: GenerationMode) -> String {
    enum_json_label(mode)
}

fn media_generation_input_artifact(artifact: &Artifact) -> MediaGenerationInputArtifact {
    MediaGenerationInputArtifact {
        id: artifact.id,
        kind: artifact_kind_label(artifact.kind).to_owned(),
        status: enum_json_label(artifact.status),
        object_uri: artifact.object_uri.clone(),
        file_reference: artifact.file_reference.clone(),
        schema_ref: artifact.schema_ref.clone(),
        mime_type: artifact.artifact_metadata.mime_type.clone(),
        metadata: artifact.metadata.clone(),
    }
}

fn enum_json_label<T: Serialize>(value: T) -> String {
    serde_json::to_value(value)
        .ok()
        .and_then(|value| value.as_str().map(ToOwned::to_owned))
        .unwrap_or_else(|| "unknown".to_owned())
}

fn clean_content_type(value: &str) -> String {
    value
        .split(';')
        .next()
        .unwrap_or(value)
        .trim()
        .to_ascii_lowercase()
}

fn decode_media_base64(artifact: &MediaGenerationEngineArtifact) -> Result<Option<Vec<u8>>> {
    let Some(payload) = artifact
        .base64_data
        .as_deref()
        .or(artifact.data_url.as_deref())
    else {
        return Ok(None);
    };
    let base64_payload = payload
        .split_once(',')
        .map_or_else(|| payload.trim(), |(_, data)| data.trim());
    let bytes = BASE64_STANDARD
        .decode(base64_payload)
        .map_err(|err| HarnessError::InvalidInput(format!("media base64 decode failed: {err}")))?;
    Ok(Some(bytes))
}

fn with_context_metadata(
    mut metadata: serde_json::Value,
    context: &RequestContext,
) -> serde_json::Value {
    if let Some(object) = metadata.as_object_mut() {
        object
            .entry("context")
            .or_insert_with(|| context.audit_json());
        return metadata;
    }
    json!({ "value": metadata, "context": context.audit_json() })
}

struct AuditSpec {
    action: AuditEventKind,
    actor: String,
    summary: &'static str,
    metadata: serde_json::Value,
}

impl AuditSpec {
    const fn new(
        action: AuditEventKind,
        actor: String,
        summary: &'static str,
        metadata: serde_json::Value,
    ) -> Self {
        Self {
            action,
            actor,
            summary,
            metadata,
        }
    }
}

fn ensure_status(job: &GenerationJob, allowed: &[GenerationJobStatus]) -> Result<()> {
    if allowed.contains(&job.status) {
        return Ok(());
    }
    Err(HarnessError::InvalidInput(format!(
        "generation job status {:?} does not allow this action",
        job.status
    )))
}

fn append_trace(
    job: &mut GenerationJob,
    stage: GenerationStage,
    actor: &str,
    summary: &str,
    metadata: serde_json::Value,
) {
    job.traces.push(GenerationTrace {
        id: Uuid::new_v4(),
        stage,
        actor: actor.to_owned(),
        summary: summary.to_owned(),
        metadata,
        created_at: Utc::now(),
    });
}

fn complete_local_pipeline(
    job: &mut GenerationJob,
    req: GenerationActionRequest,
    object_store: &(impl ObjectStore + ?Sized),
) -> Result<Vec<AuditSpec>> {
    job.status = GenerationJobStatus::Running;
    let actor_ref = req.actor.as_deref().unwrap_or(DEFAULT_ACTOR);
    append_trace(
        job,
        GenerationStage::Generator,
        "local_generation_adapter_v1",
        "local adapter produced an artifact reference",
        json!({ "actor": actor_ref, "selfEvaluation": false }),
    );

    let artifacts = generated_artifacts(job, object_store)?;
    job.artifacts.extend(artifacts.clone());
    append_trace(
        job,
        GenerationStage::Evaluator,
        "local_evaluator_v1",
        "independent evaluator reviewed the generated artifact",
        json!({
            "generatorId": "local_generation_adapter_v1",
            "evaluatorId": "local_evaluator_v1",
            "generatorSelfEvaluated": false
        }),
    );
    append_trace(
        job,
        GenerationStage::RuleChecker,
        "rule_checker_v1",
        "deterministic rule checker passed",
        json!({ "passed": true }),
    );
    append_trace(
        job,
        GenerationStage::SchemaValidator,
        "schema_validator_v1",
        "artifact schema validator passed",
        json!({
            "schemaRefs": artifacts
                .iter()
                .map(|artifact| artifact.schema_ref.clone())
                .collect::<Vec<_>>(),
            "passed": true
        }),
    );
    job.output = Some(GenerationOutput {
        artifacts,
        summary: "local deterministic generation completed".to_owned(),
        generator_id: "local_generation_adapter_v1".to_owned(),
        evaluator_id: "local_evaluator_v1".to_owned(),
        rule_check_passed: true,
        schema_validation_passed: true,
    });
    job.status = GenerationJobStatus::PendingReview;
    let actor = req.actor.unwrap_or_else(|| DEFAULT_ACTOR.to_owned());
    Ok(vec![
        AuditSpec::new(
            AuditEventKind::GenerationStageCompleted,
            actor.clone(),
            "generation generator stage completed",
            json!({ "stage": GenerationStage::Generator }),
        ),
        AuditSpec::new(
            AuditEventKind::GenerationArtifactCreated,
            actor.clone(),
            "generation artifact created",
            json!({ "mode": job.mode, "artifactCount": job.output.as_ref().map_or(0, |output| output.artifacts.len()) }),
        ),
        AuditSpec::new(
            AuditEventKind::GenerationStageCompleted,
            actor.clone(),
            "generation evaluator stage completed",
            json!({ "stage": GenerationStage::Evaluator, "generatorSelfEvaluated": false }),
        ),
        AuditSpec::new(
            AuditEventKind::GenerationStageCompleted,
            actor.clone(),
            "generation rule checker stage completed",
            json!({ "stage": GenerationStage::RuleChecker, "passed": true }),
        ),
        AuditSpec::new(
            AuditEventKind::GenerationStageCompleted,
            actor.clone(),
            "generation schema validator stage completed",
            json!({ "stage": GenerationStage::SchemaValidator, "passed": true }),
        ),
        AuditSpec::new(
            AuditEventKind::GenerationJobRun,
            actor,
            "local generation pipeline completed",
            json!({
                "mode": job.mode,
                "artifactCount": job.artifacts.len(),
                "requiresReview": true
            }),
        ),
    ])
}

fn normalize_input_artifacts(artifacts: Option<Vec<Artifact>>) -> Vec<Artifact> {
    artifacts.unwrap_or_default()
}

fn generated_artifacts(
    job: &GenerationJob,
    object_store: &(impl ObjectStore + ?Sized),
) -> Result<Vec<Artifact>> {
    let primary = generated_artifact(job, object_store, job.mode.output_kind())?;
    if job.mode == GenerationMode::ModelToLightweightScene {
        let property_index = generated_artifact(job, object_store, ArtifactKind::PropertyIndex)?;
        let identity_map = generated_artifact(job, object_store, ArtifactKind::ElementIdentityMap)?;
        return Ok(vec![primary, property_index, identity_map]);
    }
    Ok(vec![primary])
}

fn local_artifact_bytes(job: &GenerationJob, kind: ArtifactKind) -> Vec<u8> {
    match kind {
        ArtifactKind::Bim | ArtifactKind::Model => minimal_local_ifc(job).into_bytes(),
        _ => format!("local artifact for {} via {}", job.id, job.mode.skill_id()).into_bytes(),
    }
}

fn minimal_local_ifc(job: &GenerationJob) -> String {
    format!(
        r"ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('local-{job_id}.ifc','2026-05-13T16:00:00',('architoken'),('architoken'),'architoken local adapter','architoken','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('0V5wYb1W9D_xLocal00001',#2,'ArchIToken TextToBim Project',$,$,$,$,(#10),#20);
#2=IFCOWNERHISTORY(#3,#6,$,.ADDED.,$,$,$,0);
#3=IFCPERSONANDORGANIZATION(#4,#5,$);
#4=IFCPERSON($,'architoken',$,$,$,$,$,$);
#5=IFCORGANIZATION($,'architoken',$,$,$);
#6=IFCAPPLICATION(#5,'0.1.0','architoken local generator','architoken');
#10=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,#11,$);
#11=IFCAXIS2PLACEMENT3D(#12,$,$);
#12=IFCCARTESIANPOINT((0.,0.,0.));
#20=IFCUNITASSIGNMENT((#21,#22,#23));
#21=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
#22=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);
#23=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);
ENDSEC;
END-ISO-10303-21;
",
        job_id = job.id
    )
}

fn generated_artifact(
    job: &GenerationJob,
    object_store: &(impl ObjectStore + ?Sized),
    kind: ArtifactKind,
) -> Result<Artifact> {
    let id = Uuid::new_v4();
    let role = artifact_role_for(kind);
    let object_key = format!("generation/{}/{}/{}", job.id, artifact_kind_label(kind), id);
    let mime_type = mime_type_for(kind).to_owned();
    let object = object_store.put_object(ObjectPutRequest {
        key: object_key.clone(),
        bytes: local_artifact_bytes(job, kind),
        content_type: mime_type.clone(),
        owner: job.actor.clone(),
    })?;
    let file_reference = format!("generation://files/{id}");
    let schema_ref = schema_ref_for(kind).to_owned();
    let status = generated_status(kind);
    let storage_provider = storage_provider_for_uri(&object.uri);
    let storage_binding = ArtifactStorageBinding {
        artifact_role: role,
        provider: storage_provider.clone(),
        object_key,
        object_uri: object.uri.clone(),
        module_file_id: None,
        file_reference: file_reference.clone(),
    };
    let artifact_metadata = ArtifactMetadata {
        artifact_role: role,
        geometry_format: geometry_format_for(kind),
        property_index_format: property_index_format_for(kind),
        element_id_namespace: element_id_namespace_for(kind),
        viewer_adapter_hint: viewer_adapter_hint_for(kind),
        source_model_id: Some(format!("source-model-{}", job.id)),
        schema_ref: schema_ref.clone(),
        checksum: Some(object.checksum.clone()),
        mime_type,
        size_bytes: object.size_bytes,
        owner: job.actor.clone(),
        tenant_id: job.context.tenant_id.clone(),
        project_id: job.context.project_id.clone(),
        version: 1,
        request_id: job.context.request_id.clone(),
        correlation_id: job.context.correlation_id.clone(),
        source_job_id: Some(job.id),
        created_by_job_id: Some(job.id),
        approval_status: status,
        audit_event_id: None,
        created_at: object.created_at,
        updated_at: object.updated_at,
    };
    let reference = ArtifactRef {
        artifact_id: id,
        artifact_kind: artifact_kind_label(kind).to_owned(),
        module_id: job.module_id.clone(),
        status,
        name: format!("{} artifact", job.mode.skill_id()),
    };
    let version = ArtifactVersion {
        id: Uuid::new_v4(),
        artifact_id: id,
        version: 1,
        status,
        storage: storage_binding.clone(),
        metadata: artifact_metadata.clone(),
    };
    Ok(Artifact {
        id,
        kind,
        status,
        object_uri: Some(object.uri),
        file_reference,
        schema_ref,
        version: 1,
        hash: Some(object.checksum),
        metadata: json!({
            "mode": job.mode,
            "sourceJobId": job.id,
            "storage": storage_provider,
            "modelCalls": 0,
            "generator": "local_generation_adapter_v1",
            "evaluator": "local_evaluator_v1",
            "context": job.context.audit_json(),
            "compression": compression_metadata_for(job.mode),
            "sceneTiles": scene_tiles_metadata_for(kind)
        }),
        reference,
        storage_binding,
        artifact_metadata,
        versions: vec![version],
    })
}

fn generated_artifact_from_engine_bytes(
    job: &GenerationJob,
    object_store: &(impl ObjectStore + ?Sized),
    kind: ArtifactKind,
    bytes: Vec<u8>,
    response: &TextToBimEngineResponse,
    engine_artifact: &TextToBimEngineArtifact,
) -> Result<Artifact> {
    let id = Uuid::new_v4();
    let role = artifact_role_for(kind);
    let object_key = format!("generation/{}/{}/{}", job.id, artifact_kind_label(kind), id);
    let mime_type = engine_artifact.mime_type.clone();

    let object = object_store.put_object(ObjectPutRequest {
        key: object_key.clone(),
        bytes,
        content_type: mime_type.clone(),
        owner: job.actor.clone(),
    })?;

    let file_reference = format!("generation://files/{id}");
    let schema_ref = engine_artifact
        .schema_ref
        .clone()
        .unwrap_or_else(|| schema_ref_for(kind).to_owned());
    let status = generated_status(kind);
    let checksum = engine_artifact
        .checksum
        .clone()
        .unwrap_or_else(|| object.checksum.clone());
    let storage_provider = storage_provider_for_uri(&object.uri);

    let storage_binding = ArtifactStorageBinding {
        artifact_role: role,
        provider: storage_provider.clone(),
        object_key,
        object_uri: object.uri.clone(),
        module_file_id: None,
        file_reference: file_reference.clone(),
    };

    let artifact_metadata = ArtifactMetadata {
        artifact_role: role,
        geometry_format: geometry_format_for(kind),
        property_index_format: property_index_format_for(kind),
        element_id_namespace: element_id_namespace_for(kind),
        viewer_adapter_hint: viewer_adapter_hint_for(kind),
        source_model_id: Some(format!("source-model-{}", job.id)),
        schema_ref: schema_ref.clone(),
        checksum: Some(checksum.clone()),
        mime_type,
        size_bytes: object.size_bytes,
        owner: job.actor.clone(),
        tenant_id: job.context.tenant_id.clone(),
        project_id: job.context.project_id.clone(),
        version: 1,
        request_id: job.context.request_id.clone(),
        correlation_id: job.context.correlation_id.clone(),
        source_job_id: Some(job.id),
        created_by_job_id: Some(job.id),
        approval_status: status,
        audit_event_id: None,
        created_at: object.created_at,
        updated_at: object.updated_at,
    };

    let reference = ArtifactRef {
        artifact_id: id,
        artifact_kind: artifact_kind_label(kind).to_owned(),
        module_id: job.module_id.clone(),
        status,
        name: engine_artifact
            .filename
            .clone()
            .unwrap_or_else(|| format!("{} artifact", response.engine)),
    };

    let version = ArtifactVersion {
        id: Uuid::new_v4(),
        artifact_id: id,
        version: 1,
        status,
        storage: storage_binding.clone(),
        metadata: artifact_metadata.clone(),
    };

    Ok(Artifact {
        id,
        kind,
        status,
        object_uri: Some(object.uri),
        file_reference,
        schema_ref,
        version: 1,
        hash: Some(checksum),
        metadata: json!({
            "mode": job.mode,
            "sourceJobId": job.id,
            "storage": storage_provider,
            "modelCalls": response.model_calls,
            "generator": response.engine,
            "model": response.model,
            "evaluator": "schema_validator_v1",
            "context": job.context.audit_json(),
            "compression": compression_metadata_for(job.mode),
            "sceneTiles": scene_tiles_metadata_for(kind),
            "base64": false,
            "downloadUrlUsed": engine_artifact.download_url.is_some()
        }),
        reference,
        storage_binding,
        artifact_metadata,
        versions: vec![version],
    })
}

#[allow(clippy::too_many_lines)]
fn generated_media_artifact_from_engine_bytes(
    job: &GenerationJob,
    object_store: &(impl ObjectStore + ?Sized),
    kind: ArtifactKind,
    bytes: Vec<u8>,
    response: &MediaGenerationEngineResponse,
    engine_artifact: &MediaGenerationEngineArtifact,
    mime_type: &str,
) -> Result<Artifact> {
    let id = Uuid::new_v4();
    let role = artifact_role_for(kind);
    let object_key = format!("generation/{}/{}/{}", job.id, artifact_kind_label(kind), id);
    let mime_type = mime_type.to_owned();

    let object = object_store.put_object(ObjectPutRequest {
        key: object_key.clone(),
        bytes,
        content_type: mime_type.clone(),
        owner: job.actor.clone(),
    })?;

    let file_reference = format!("generation://files/{id}");
    let schema_ref = engine_artifact
        .schema_ref
        .clone()
        .unwrap_or_else(|| schema_ref_for(kind).to_owned());
    let status = generated_status(kind);
    let checksum = engine_artifact
        .checksum
        .clone()
        .unwrap_or_else(|| object.checksum.clone());
    let storage_provider = storage_provider_for_uri(&object.uri);

    let storage_binding = ArtifactStorageBinding {
        artifact_role: role,
        provider: storage_provider.clone(),
        object_key,
        object_uri: object.uri.clone(),
        module_file_id: None,
        file_reference: file_reference.clone(),
    };

    let artifact_metadata = ArtifactMetadata {
        artifact_role: role,
        geometry_format: geometry_format_for(kind),
        property_index_format: property_index_format_for(kind),
        element_id_namespace: element_id_namespace_for(kind),
        viewer_adapter_hint: viewer_adapter_hint_for(kind),
        source_model_id: Some(format!("source-model-{}", job.id)),
        schema_ref: schema_ref.clone(),
        checksum: Some(checksum.clone()),
        mime_type,
        size_bytes: object.size_bytes,
        owner: job.actor.clone(),
        tenant_id: job.context.tenant_id.clone(),
        project_id: job.context.project_id.clone(),
        version: 1,
        request_id: job.context.request_id.clone(),
        correlation_id: job.context.correlation_id.clone(),
        source_job_id: Some(job.id),
        created_by_job_id: Some(job.id),
        approval_status: status,
        audit_event_id: None,
        created_at: object.created_at,
        updated_at: object.updated_at,
    };

    let reference = ArtifactRef {
        artifact_id: id,
        artifact_kind: artifact_kind_label(kind).to_owned(),
        module_id: job.module_id.clone(),
        status,
        name: engine_artifact
            .filename
            .clone()
            .unwrap_or_else(|| format!("{} artifact", response.engine)),
    };

    let version = ArtifactVersion {
        id: Uuid::new_v4(),
        artifact_id: id,
        version: 1,
        status,
        storage: storage_binding.clone(),
        metadata: artifact_metadata.clone(),
    };

    Ok(Artifact {
        id,
        kind,
        status,
        object_uri: Some(object.uri),
        file_reference,
        schema_ref,
        version: 1,
        hash: Some(checksum),
        metadata: json!({
            "mode": job.mode,
            "sourceJobId": job.id,
            "storage": storage_provider,
            "modelCalls": response.model_calls,
            "generator": response.engine,
            "model": response.model,
            "evaluator": "schema_validator_v1",
            "context": job.context.audit_json(),
            "compression": compression_metadata_for(job.mode),
            "sceneTiles": scene_tiles_metadata_for(kind),
            "base64": engine_artifact.base64_data.is_some() || engine_artifact.data_url.is_some(),
            "downloadUrlUsed": engine_artifact.download_url.is_some(),
            "objectUriReturned": engine_artifact.object_uri.is_some(),
            "providerMetadata": engine_artifact.metadata.clone()
        }),
        reference,
        storage_binding,
        artifact_metadata,
        versions: vec![version],
    })
}

fn storage_provider_for_uri(uri: &str) -> String {
    if uri.starts_with("memory://") {
        "memory".to_owned()
    } else if uri.starts_with("http://") || uri.starts_with("https://") || uri.starts_with("s3://")
    {
        "seaweedfs_s3".to_owned()
    } else {
        "object_store".to_owned()
    }
}

fn compression_metadata_for(mode: GenerationMode) -> serde_json::Value {
    match mode {
        GenerationMode::MeshDracoCompress => json!({
            "codec": "draco",
            "route": "open_format",
            "vendorDependency": false
        }),
        GenerationMode::MeshMeshoptCompress => json!({
            "codec": "meshopt",
            "route": "open_format",
            "vendorDependency": false
        }),
        _ => serde_json::Value::Null,
    }
}

fn scene_tiles_metadata_for(kind: ArtifactKind) -> serde_json::Value {
    if kind == ArtifactKind::SceneTiles {
        return json!({
            "format": "3dtiles",
            "openStandard": true,
            "tilesetSchemaRef": "artifact.3dtiles.schema.v1"
        });
    }
    serde_json::Value::Null
}

const fn generated_status(kind: ArtifactKind) -> ArtifactStatus {
    match kind {
        ArtifactKind::Cad
        | ArtifactKind::Bim
        | ArtifactKind::DigitalTwin
        | ArtifactKind::PointCloud
        | ArtifactKind::LightweightScene
        | ArtifactKind::SceneTiles
        | ArtifactKind::Glb
        | ArtifactKind::Lod => ArtifactStatus::Preview,
        _ => ArtifactStatus::Draft,
    }
}

const fn artifact_role_for(kind: ArtifactKind) -> ArtifactRole {
    match kind {
        ArtifactKind::PropertyIndex => ArtifactRole::PropertyIndexArtifact,
        ArtifactKind::ElementIdentityMap => ArtifactRole::ElementIdentityMap,
        ArtifactKind::SceneTiles => ArtifactRole::SceneTileArtifact,
        ArtifactKind::Lod => ArtifactRole::LodArtifact,
        ArtifactKind::Model => ArtifactRole::SourceArtifact,
        ArtifactKind::LightweightScene
        | ArtifactKind::Cad
        | ArtifactKind::Bim
        | ArtifactKind::DigitalTwin
        | ArtifactKind::PointCloud
        | ArtifactKind::Glb => ArtifactRole::GeometryArtifact,
        _ => ArtifactRole::PreviewArtifact,
    }
}

const fn geometry_format_for(kind: ArtifactKind) -> Option<GeometryFormat> {
    match kind {
        ArtifactKind::Bim | ArtifactKind::Model => Some(GeometryFormat::Ifc),
        ArtifactKind::Glb => Some(GeometryFormat::Glb),
        ArtifactKind::SceneTiles => Some(GeometryFormat::Tiles3d),
        ArtifactKind::PointCloud => Some(GeometryFormat::PointCloud),
        ArtifactKind::DigitalTwin | ArtifactKind::LightweightScene => Some(GeometryFormat::Gltf),
        _ => None,
    }
}

const fn property_index_format_for(kind: ArtifactKind) -> Option<PropertyIndexFormat> {
    match kind {
        ArtifactKind::PropertyIndex => Some(PropertyIndexFormat::Json),
        _ => None,
    }
}

const fn element_id_namespace_for(kind: ArtifactKind) -> Option<ElementIdNamespace> {
    match kind {
        ArtifactKind::ElementIdentityMap | ArtifactKind::PropertyIndex | ArtifactKind::Bim => {
            Some(ElementIdNamespace::ArchitokenElementId)
        }
        _ => None,
    }
}

const fn viewer_adapter_hint_for(kind: ArtifactKind) -> Option<ViewerAdapterHint> {
    match kind {
        ArtifactKind::SceneTiles => Some(ViewerAdapterHint::Tiles3d),
        ArtifactKind::Bim | ArtifactKind::Model => Some(ViewerAdapterHint::Ifc),
        ArtifactKind::PointCloud => Some(ViewerAdapterHint::WebGpu),
        ArtifactKind::DigitalTwin | ArtifactKind::LightweightScene | ArtifactKind::Glb => {
            Some(ViewerAdapterHint::ThreeJs)
        }
        _ => None,
    }
}

fn set_generated_artifact_status(job: &mut GenerationJob, status: ArtifactStatus) {
    let now = Utc::now();
    for artifact in &mut job.artifacts {
        if artifact.artifact_metadata.source_job_id == Some(job.id) {
            set_artifact_status(artifact, status, now);
        }
    }
    if let Some(output) = &mut job.output {
        for artifact in &mut output.artifacts {
            set_artifact_status(artifact, status, now);
        }
    }
}

fn set_artifact_status(artifact: &mut Artifact, status: ArtifactStatus, now: DateTime<Utc>) {
    artifact.status = status;
    artifact.reference.status = status;
    artifact.version = artifact.version.saturating_add(1);
    artifact.artifact_metadata.approval_status = status;
    artifact.artifact_metadata.version = artifact.artifact_metadata.version.saturating_add(1);
    artifact.artifact_metadata.updated_at = now;
    if let Some(version) = artifact.versions.last_mut() {
        version.status = status;
        version.metadata.approval_status = status;
        version.metadata.version = version.metadata.version.saturating_add(1);
        version.metadata.updated_at = now;
    }
}

fn stamp_artifact_context(artifact: &mut Artifact, context: &RequestContext) {
    artifact
        .artifact_metadata
        .tenant_id
        .clone_from(&context.tenant_id);
    artifact
        .artifact_metadata
        .project_id
        .clone_from(&context.project_id);
    artifact
        .artifact_metadata
        .request_id
        .clone_from(&context.request_id);
    artifact
        .artifact_metadata
        .correlation_id
        .clone_from(&context.correlation_id);
    if let Some(object) = artifact.metadata.as_object_mut() {
        object.insert("context".to_owned(), context.audit_json());
    }
    for version in &mut artifact.versions {
        version.metadata.tenant_id.clone_from(&context.tenant_id);
        version.metadata.project_id.clone_from(&context.project_id);
        version.metadata.request_id.clone_from(&context.request_id);
        version
            .metadata
            .correlation_id
            .clone_from(&context.correlation_id);
    }
}

fn assert_job_scope(context: &RequestContext, job: &GenerationJob) -> Result<()> {
    assert_runtime_scope(context, &job.context.tenant_id, &job.context.project_id)
}

fn transition_lifecycle(
    lifecycle: &ModuleLifecycleService,
    transaction_id: Option<Uuid>,
    event: ModuleTransitionEvent,
    actor: Option<String>,
    comment: Option<String>,
) -> Result<()> {
    if let Some(transaction_id) = transaction_id {
        lifecycle.transition(
            transaction_id,
            ModuleTransitionRequest {
                event,
                actor,
                comment,
            },
        )?;
    }
    Ok(())
}

fn transition_lifecycle_stages(
    lifecycle: &ModuleLifecycleService,
    transaction_id: Option<Uuid>,
    actor: Option<&str>,
    comment: Option<&str>,
    events: &[ModuleTransitionEvent],
) -> Result<()> {
    for event in events {
        transition_lifecycle(
            lifecycle,
            transaction_id,
            *event,
            actor.map(ToOwned::to_owned),
            comment.map(ToOwned::to_owned),
        )?;
    }
    Ok(())
}

fn approve_lifecycle(
    lifecycle: &ModuleLifecycleService,
    transaction_id: Option<Uuid>,
    actor: String,
    comment: Option<String>,
) -> Result<()> {
    if let Some(transaction_id) = transaction_id {
        lifecycle.approve(transaction_id, ApprovalDecisionRequest { actor, comment })?;
    }
    Ok(())
}

fn reject_lifecycle(
    lifecycle: &ModuleLifecycleService,
    transaction_id: Option<Uuid>,
    actor: String,
    comment: Option<String>,
) -> Result<()> {
    if let Some(transaction_id) = transaction_id {
        lifecycle.reject(transaction_id, ApprovalDecisionRequest { actor, comment })?;
    }
    Ok(())
}

fn skill_for(mode: GenerationMode) -> SkillSpec {
    let output_kind = mode.output_kind();
    SkillSpec {
        id: mode.skill_id().to_owned(),
        version: LOCAL_ADAPTER_VERSION.to_owned(),
        description: "AIGC engineering generation adapter route".to_owned(),
        input_schema: "generation.input.schema.v1".to_owned(),
        output_schema: schema_ref_for(output_kind).to_owned(),
        sandbox_profile: "worker_adapter_sandbox".to_owned(),
        license_policy:
            "MIT/Apache-2.0/BSD preferred; GPL/AGPL/LGPL/SSPL/BUSL/Commons Clause denied".to_owned(),
    }
}

fn mcp_tool_for(mode: GenerationMode) -> McpToolSpec {
    McpToolSpec {
        name: "generation_worker_adapter".to_owned(),
        version: LOCAL_ADAPTER_VERSION.to_owned(),
        capability: mode
            .skill_id()
            .trim_end_matches("_worker_adapter")
            .to_owned(),
        input_schema: "generation.input.schema.v1".to_owned(),
        output_schema: schema_ref_for(mode.output_kind()).to_owned(),
        permission_scope: "generation:write".to_owned(),
    }
}

fn model_route_for(mode: GenerationMode) -> ModelRoute {
    ModelRoute {
        provider: "local_deterministic_adapter".to_owned(),
        model: "architoken-local-generation-adapter-v1".to_owned(),
        reason: format!(
            "WorkflowRouter selected local deterministic adapter for {}; production must configure external provider routes",
            mode.skill_id()
        ),
        privacy_tier: "local_control_plane".to_owned(),
        cost_tier: "zero".to_owned(),
    }
}

const fn schema_ref_for(kind: ArtifactKind) -> &'static str {
    match kind {
        ArtifactKind::Text => "artifact.text.schema.v1",
        ArtifactKind::Image => "artifact.image.schema.v1",
        ArtifactKind::Video => "artifact.video.schema.v1",
        ArtifactKind::Document => "artifact.document.schema.v1",
        ArtifactKind::Spreadsheet | ArtifactKind::Table => "artifact.table.schema.v1",
        ArtifactKind::Pdf | ArtifactKind::PdfDrawing => "artifact.pdf.schema.v1",
        ArtifactKind::Ppt => "artifact.presentation.schema.v1",
        ArtifactKind::Mindmap => "artifact.mindmap.schema.v1",
        ArtifactKind::Flowchart => "artifact.flowchart.schema.v1",
        ArtifactKind::Gantt => "artifact.gantt.schema.v1",
        ArtifactKind::Floorplan => "artifact.floorplan.schema.v1",
        ArtifactKind::Cad | ArtifactKind::Drawing => "artifact.cad.schema.v1",
        ArtifactKind::Bim | ArtifactKind::Model => "artifact.ifc.schema.v1",
        ArtifactKind::DigitalTwin => "artifact.digital_twin.schema.v1",
        ArtifactKind::PointCloud => "artifact.point_cloud.schema.v1",
        ArtifactKind::LightweightScene => "artifact.lightweight_scene.schema.v1",
        ArtifactKind::SceneTiles => "artifact.3dtiles.schema.v1",
        ArtifactKind::Glb => "artifact.glb.schema.v1",
        ArtifactKind::Lod => "artifact.lod.schema.v1",
        ArtifactKind::PropertyIndex => "artifact.property_index.schema.v1",
        ArtifactKind::ElementIdentityMap => "artifact.element_identity_map.schema.v1",
    }
}

const fn artifact_kind_label(kind: ArtifactKind) -> &'static str {
    match kind {
        ArtifactKind::Text => "text",
        ArtifactKind::Image => "image",
        ArtifactKind::Video => "video",
        ArtifactKind::Document => "document",
        ArtifactKind::Spreadsheet => "spreadsheet",
        ArtifactKind::Pdf => "pdf",
        ArtifactKind::Ppt => "ppt",
        ArtifactKind::Mindmap => "mindmap",
        ArtifactKind::Flowchart => "flowchart",
        ArtifactKind::Gantt => "gantt",
        ArtifactKind::Floorplan => "floorplan",
        ArtifactKind::Cad => "cad",
        ArtifactKind::Bim => "bim",
        ArtifactKind::DigitalTwin => "digital_twin",
        ArtifactKind::PdfDrawing => "pdf_drawing",
        ArtifactKind::PointCloud => "point_cloud",
        ArtifactKind::Drawing => "drawing",
        ArtifactKind::Table => "table",
        ArtifactKind::Model => "model",
        ArtifactKind::LightweightScene => "lightweight_scene",
        ArtifactKind::SceneTiles => "scene_tiles",
        ArtifactKind::Glb => "glb",
        ArtifactKind::Lod => "lod",
        ArtifactKind::PropertyIndex => "property_index",
        ArtifactKind::ElementIdentityMap => "element_identity_map",
    }
}

const fn mime_type_for(kind: ArtifactKind) -> &'static str {
    match kind {
        ArtifactKind::Text => "text/plain",
        ArtifactKind::Image => "image/png",
        ArtifactKind::Video => "video/mp4",
        ArtifactKind::Document => {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
        ArtifactKind::Spreadsheet | ArtifactKind::Table => {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
        ArtifactKind::Pdf | ArtifactKind::PdfDrawing => "application/pdf",
        ArtifactKind::Ppt => {
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        }
        ArtifactKind::Mindmap
        | ArtifactKind::Flowchart
        | ArtifactKind::Gantt
        | ArtifactKind::Lod
        | ArtifactKind::PropertyIndex
        | ArtifactKind::ElementIdentityMap => "application/json",
        ArtifactKind::Floorplan | ArtifactKind::Cad | ArtifactKind::Drawing => {
            "application/vnd.dwg"
        }
        ArtifactKind::Bim | ArtifactKind::Model => "model/ifc",
        ArtifactKind::DigitalTwin => "application/vnd.architoken.digital-twin+json",
        ArtifactKind::PointCloud => "application/vnd.las",
        ArtifactKind::LightweightScene => "application/vnd.architoken.lightweight-scene+json",
        ArtifactKind::SceneTiles => "application/vnd.3dtiles+json",
        ArtifactKind::Glb => "model/gltf-binary",
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use chrono::Utc;
    use serde_json::json;
    use uuid::Uuid;
    use wiremock::{
        Mock, MockServer, ResponseTemplate,
        matchers::{method, path},
    };

    use crate::config::{GenerationConfig, GenerationProvider};
    use crate::error::HarnessError;
    use crate::module_audit::{AuditEventKind, AuditEventQuery, ModuleAuditService};
    use crate::module_lifecycle::{
        ApprovalDecisionRequest, ModuleLifecycleService, ModuleTransactionStatus,
    };
    use crate::runtime_context::{RequestContext, RequestContextInput, RuntimeProfile};
    use crate::storage_router::{
        ArtifactMetadata, ArtifactRef, ArtifactRole, ArtifactStatus, ArtifactStorageBinding,
        ArtifactVersion, ElementIdNamespace, GeometryFormat, PropertyIndexFormat,
        ViewerAdapterHint,
    };

    use super::{
        Artifact, ArtifactKind, ArtifactListQuery, GenerationActionRequest, GenerationInput,
        GenerationJob, GenerationJobQuery, GenerationJobStatus, GenerationMode,
        GenerationReviewDecision, GenerationReviewRequest, ModuleGenerationService,
        artifact_role_for, mime_type_for, schema_ref_for,
    };

    fn service() -> (ModuleGenerationService, Arc<ModuleAuditService>) {
        let (service, audit, _lifecycle) = service_with_lifecycle();
        (service, audit)
    }

    fn service_with_lifecycle() -> (
        ModuleGenerationService,
        Arc<ModuleAuditService>,
        ModuleLifecycleService,
    ) {
        let audit = Arc::new(ModuleAuditService::new());
        let lifecycle = ModuleLifecycleService::new(Arc::clone(&audit));
        (
            ModuleGenerationService::new(Arc::clone(&audit), lifecycle.clone()),
            audit,
            lifecycle,
        )
    }

    fn service_with_generation_config(
        generation_config: GenerationConfig,
    ) -> (ModuleGenerationService, Arc<ModuleAuditService>) {
        let audit = Arc::new(ModuleAuditService::new());
        let lifecycle = ModuleLifecycleService::new(Arc::clone(&audit));
        (
            ModuleGenerationService::new_with_config(
                Arc::clone(&audit),
                lifecycle,
                generation_config,
            ),
            audit,
        )
    }

    fn input(mode: GenerationMode) -> GenerationInput {
        GenerationInput {
            module_id: "production_manufacturing".to_owned(),
            mode,
            prompt: "Generate a production-ready draft artifact".to_owned(),
            actor: Some("planner".to_owned()),
            input_artifacts: None,
            constraints: None,
        }
    }

    fn context(tenant_id: &str, project_id: &str, actor: &str, roles: &[&str]) -> RequestContext {
        RequestContext::from_input(
            RequestContextInput {
                tenant_id: Some(tenant_id.to_owned()),
                project_id: Some(project_id.to_owned()),
                actor: Some(actor.to_owned()),
                roles: Some(roles.iter().map(|role| (*role).to_owned()).collect()),
                request_id: Some(format!("req-{actor}")),
                correlation_id: Some(format!("corr-{actor}")),
            },
            RuntimeProfile::Production,
        )
        .expect("context should parse")
    }

    fn run_to_pending_review(
        service: &ModuleGenerationService,
        mode: GenerationMode,
    ) -> GenerationJob {
        let job = service
            .create_job(input(mode))
            .expect("job should be created");
        let job = service
            .plan_job(
                job.id,
                GenerationActionRequest {
                    actor: None,
                    comment: None,
                },
            )
            .expect("job should be planned");
        let job = service
            .run_job(
                job.id,
                GenerationActionRequest {
                    actor: None,
                    comment: None,
                },
            )
            .expect("job should run");
        assert_eq!(job.status, GenerationJobStatus::PendingReview);
        job
    }

    fn approve_linked_lifecycle(lifecycle: &ModuleLifecycleService, job: &GenerationJob) {
        lifecycle
            .approve(
                job.lifecycle_transaction_id
                    .expect("transaction should exist"),
                ApprovalDecisionRequest {
                    actor: "external-approver".to_owned(),
                    comment: Some("make lifecycle not rejectable".to_owned()),
                },
            )
            .expect("linked lifecycle should approve");
    }

    fn generated_artifact_statuses(job: &GenerationJob) -> Vec<ArtifactStatus> {
        job.artifacts
            .iter()
            .filter(|artifact| artifact.artifact_metadata.source_job_id == Some(job.id))
            .map(|artifact| artifact.status)
            .collect()
    }

    fn output_artifact_statuses(job: &GenerationJob) -> Vec<ArtifactStatus> {
        job.output
            .as_ref()
            .map(|output| {
                output
                    .artifacts
                    .iter()
                    .map(|artifact| artifact.status)
                    .collect()
            })
            .unwrap_or_default()
    }

    fn generation_rejected_audit_count(audit: &ModuleAuditService, job: &GenerationJob) -> usize {
        audit
            .list(&AuditEventQuery {
                module_id: Some(job.module_id.clone()),
                target_type: Some("generation_job".to_owned()),
                target_id: Some(job.id.to_string()),
                actor: None,
                limit: Some(100),
                cursor: None,
            })
            .expect("audit list should work")
            .items
            .iter()
            .filter(|event| event.action == AuditEventKind::GenerationJobRejected)
            .count()
    }

    fn assert_job_preserved_after_failed_reject(before: &GenerationJob, after: &GenerationJob) {
        assert_eq!(after.status, before.status);
        assert_eq!(after.reviews.len(), before.reviews.len());
        assert_eq!(after.traces.len(), before.traces.len());
        assert_eq!(
            generated_artifact_statuses(after),
            generated_artifact_statuses(before)
        );
        assert_eq!(
            output_artifact_statuses(after),
            output_artifact_statuses(before)
        );
    }

    fn assert_generated_artifact_status_mirror(job: &GenerationJob, status: ArtifactStatus) {
        for artifact in job
            .artifacts
            .iter()
            .filter(|artifact| artifact.artifact_metadata.source_job_id == Some(job.id))
        {
            assert_eq!(artifact.status, status);
            assert_eq!(artifact.reference.status, status);
            assert_eq!(artifact.artifact_metadata.approval_status, status);
            let latest = artifact
                .versions
                .last()
                .expect("generated artifact should keep at least one version");
            assert_eq!(latest.status, status);
            assert_eq!(latest.metadata.approval_status, status);
        }
        for artifact in &job
            .output
            .as_ref()
            .expect("job output should exist")
            .artifacts
        {
            assert_eq!(artifact.status, status);
            assert_eq!(artifact.reference.status, status);
            assert_eq!(artifact.artifact_metadata.approval_status, status);
            let latest = artifact
                .versions
                .last()
                .expect("output artifact should keep at least one version");
            assert_eq!(latest.status, status);
            assert_eq!(latest.metadata.approval_status, status);
        }
    }

    fn assert_generation_audit(audit: &ModuleAuditService, job: &super::GenerationJob) {
        let events = audit
            .list(&AuditEventQuery {
                module_id: Some("production_manufacturing".to_owned()),
                target_type: Some("generation_job".to_owned()),
                target_id: Some(job.id.to_string()),
                actor: None,
                limit: Some(20),
                cursor: None,
            })
            .expect("audit list should work");
        assert!(
            events
                .items
                .iter()
                .any(|event| event.action == AuditEventKind::GenerationJobRun)
        );
        assert!(
            events
                .items
                .iter()
                .any(|event| event.action == AuditEventKind::GenerationArtifactCreated)
        );
        assert!(
            events
                .items
                .iter()
                .filter(|event| event.action == AuditEventKind::GenerationStageCompleted)
                .count()
                >= 6
        );
        assert!(
            events
                .items
                .iter()
                .any(|event| event.action == AuditEventKind::GenerationJobApproved)
        );
    }

    #[test]
    fn unauthorized_generation_create_returns_permission_denied_without_mutation() {
        let (service, _audit) = service();
        let auditor = context("tenant-a", "project-a", "auditor", &["auditor"]);
        let err = service
            .create_job_with_context(&auditor, input(GenerationMode::TextToBim))
            .expect_err("auditor cannot create generation jobs");
        assert_eq!(err.http_status(), 403);

        let page = service
            .list_jobs_with_context(&auditor, &GenerationJobQuery::default())
            .expect("auditor can list");
        assert!(page.items.is_empty());
    }

    #[test]
    fn engineer_can_create_and_run_but_not_approve() {
        let (service, _audit) = service();
        let engineer = context("tenant-a", "project-a", "engineer", &["engineer"]);
        let job = service
            .create_job_with_context(&engineer, input(GenerationMode::ModelToLightweightScene))
            .expect("engineer can create");
        let job = service
            .plan_job_with_context(&engineer, job.id, GenerationActionRequest::default())
            .expect("engineer can plan");
        let job = service
            .run_job_with_context(&engineer, job.id, GenerationActionRequest::default())
            .expect("engineer can run");
        assert_eq!(job.status, GenerationJobStatus::PendingReview);

        let err = service
            .approve_job_with_context(&engineer, job.id, GenerationActionRequest::default())
            .expect_err("engineer cannot approve");
        assert_eq!(err.http_status(), 403);
        assert_eq!(
            service
                .get_job_with_context(&engineer, job.id)
                .expect("job still readable")
                .status,
            GenerationJobStatus::PendingReview
        );
    }

    #[test]
    fn reviewer_can_review_and_approve_but_not_create() {
        let (service, _audit) = service();
        let engineer = context("tenant-a", "project-a", "engineer", &["engineer"]);
        let reviewer = context("tenant-a", "project-a", "reviewer", &["reviewer"]);
        let err = service
            .create_job_with_context(&reviewer, input(GenerationMode::TextToBim))
            .expect_err("reviewer cannot create");
        assert_eq!(err.http_status(), 403);

        let job = service
            .create_job_with_context(&engineer, input(GenerationMode::TextToBim))
            .expect("engineer can create");
        let job = service
            .plan_job_with_context(&engineer, job.id, GenerationActionRequest::default())
            .and_then(|planned| {
                service.run_job_with_context(
                    &engineer,
                    planned.id,
                    GenerationActionRequest::default(),
                )
            })
            .expect("engineer can run");
        let job = service
            .review_job_with_context(
                &reviewer,
                job.id,
                GenerationReviewRequest {
                    reviewer: String::new(),
                    decision: GenerationReviewDecision::Approved,
                    comment: None,
                },
            )
            .expect("reviewer can review");
        let approved = service
            .approve_job_with_context(&reviewer, job.id, GenerationActionRequest::default())
            .expect("reviewer can approve");
        assert_eq!(approved.status, GenerationJobStatus::Approved);
    }

    #[test]
    fn auditor_can_list_and_read_but_not_write() {
        let (service, _audit) = service();
        let engineer = context("tenant-a", "project-a", "engineer", &["engineer"]);
        let auditor = context("tenant-a", "project-a", "auditor", &["auditor"]);
        let job = service
            .create_job_with_context(&engineer, input(GenerationMode::TextToImage))
            .expect("engineer can create");

        assert!(
            service
                .list_jobs_with_context(&auditor, &GenerationJobQuery::default())
                .expect("auditor can list")
                .items
                .iter()
                .any(|listed| listed.id == job.id)
        );
        assert!(service.get_job_with_context(&auditor, job.id).is_ok());
        let err = service
            .run_job_with_context(&auditor, job.id, GenerationActionRequest::default())
            .expect_err("auditor cannot run");
        assert_eq!(err.http_status(), 403);
    }

    #[test]
    fn generation_and_artifact_lists_are_tenant_project_isolated() {
        let (service, _audit) = service();
        let tenant_a = context("tenant-a", "project-a", "engineer-a", &["engineer"]);
        let tenant_b = context("tenant-b", "project-a", "engineer-b", &["engineer"]);
        let job_a = service
            .create_job_with_context(&tenant_a, input(GenerationMode::ModelToLightweightScene))
            .expect("tenant a job");
        let job_a = service
            .plan_job_with_context(&tenant_a, job_a.id, GenerationActionRequest::default())
            .and_then(|planned| {
                service.run_job_with_context(
                    &tenant_a,
                    planned.id,
                    GenerationActionRequest::default(),
                )
            })
            .expect("tenant a run");
        let job_b = service
            .create_job_with_context(&tenant_b, input(GenerationMode::TextToImage))
            .expect("tenant b job");

        let list_b = service
            .list_jobs_with_context(&tenant_b, &GenerationJobQuery::default())
            .expect("tenant b can list");
        assert_eq!(list_b.items.len(), 1);
        assert_eq!(list_b.items[0].id, job_b.id);

        let artifacts_b = service
            .list_indexed_artifacts_with_context(&tenant_b, &ArtifactListQuery::default())
            .expect("tenant b artifact list");
        assert!(artifacts_b.items.is_empty());

        let artifact_id = job_a.artifacts[0].id;
        let err = service
            .get_artifact_with_context(&tenant_b, artifact_id)
            .expect_err("cross tenant artifact get is forbidden");
        assert_eq!(err.http_status(), 403);
    }

    #[test]
    fn conversion_matrix_covers_required_modes() {
        assert_eq!(GenerationMode::ALL.len(), 42);
        assert!(GenerationMode::ALL.contains(&GenerationMode::TextToImage));
        assert!(GenerationMode::ALL.contains(&GenerationMode::TextToDigitalTwin));
        assert!(GenerationMode::ALL.contains(&GenerationMode::ImageToPdfDrawing));
        assert!(GenerationMode::ALL.contains(&GenerationMode::VideoToPointCloud));
        assert!(GenerationMode::ALL.contains(&GenerationMode::PdfDrawingToDigitalTwin));
        assert!(GenerationMode::ALL.contains(&GenerationMode::ModelToImage));
        assert!(GenerationMode::ALL.contains(&GenerationMode::ModelToLightweightScene));
        assert!(GenerationMode::ALL.contains(&GenerationMode::IfcTo3dtiles));
        assert!(GenerationMode::ALL.contains(&GenerationMode::MeshDracoCompress));
        assert!(GenerationMode::ALL.contains(&GenerationMode::ElementIdentityMapGenerate));
    }

    #[test]
    fn all_generation_modes_map_to_artifact_contracts() {
        let (service, _audit) = service();
        for mode in GenerationMode::ALL {
            let job = service.create_job(input(mode)).expect("job should create");
            assert_eq!(job.skill.id, mode.skill_id());
            assert!(!job.skill.output_schema.trim().is_empty());
            assert_ne!(job.skill.id, job.model_route.model);

            let artifact = service
                .plan_job(
                    job.id,
                    GenerationActionRequest {
                        actor: None,
                        comment: None,
                    },
                )
                .and_then(|planned| {
                    service.run_job(
                        planned.id,
                        GenerationActionRequest {
                            actor: None,
                            comment: None,
                        },
                    )
                })
                .expect("planned job should run")
                .artifacts
                .into_iter()
                .find(|artifact| artifact.artifact_metadata.source_job_id == Some(job.id))
                .expect("generated artifact should exist");
            assert_eq!(artifact.kind, mode.output_kind());
            assert_eq!(artifact.schema_ref, schema_ref_for(mode.output_kind()));
            assert_eq!(
                artifact.artifact_metadata.mime_type,
                mime_type_for(mode.output_kind())
            );
            assert_eq!(
                artifact.artifact_metadata.artifact_role,
                artifact_role_for(mode.output_kind())
            );
        }
    }

    #[tokio::test]
    async fn http_multimodal_text_to_image_materializes_real_image_artifact() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/v1/generate/text-to-image"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "engine": "test-text-to-image-engine",
                "model": "hf-test-image-model",
                "summary": "image generated",
                "modelCalls": 1,
                "artifacts": [
                    {
                        "kind": "image",
                        "mimeType": "image/png",
                        "filename": "concept.png",
                        "base64": "aW1hZ2UtYnl0ZXM=",
                        "schemaRef": "artifact.image.schema.v1",
                        "metadata": { "provider": "test" }
                    }
                ]
            })))
            .mount(&server)
            .await;

        let mut config = super::default_generation_config();
        config.provider = GenerationProvider::HttpMultimodal;
        config.text_to_image_url = Some(format!("{}/v1/generate/text-to-image", server.uri()));
        let (service, _audit) = service_with_generation_config(config);

        let job = service
            .create_job(input(GenerationMode::TextToImage))
            .expect("job should create");
        let planned = service
            .plan_job(job.id, GenerationActionRequest::default())
            .expect("job should plan");
        let completed = service
            .run_job_with_context_async(
                &RequestContext::development_admin(),
                planned.id,
                GenerationActionRequest::default(),
            )
            .await
            .expect("text_to_image should run through HTTP provider");

        assert_eq!(completed.status, GenerationJobStatus::PendingReview);
        let artifact = completed
            .artifacts
            .iter()
            .find(|artifact| artifact.kind == ArtifactKind::Image)
            .expect("image artifact should be materialized");
        assert_eq!(artifact.artifact_metadata.mime_type, "image/png");
        assert_eq!(
            completed
                .output
                .as_ref()
                .expect("output should exist")
                .generator_id,
            "test-text-to-image-engine"
        );
        let object = service
            .get_artifact_content_with_context(&RequestContext::development_admin(), artifact.id)
            .expect("generated image bytes should be in object store");
        assert_eq!(object.bytes, b"image-bytes");
        assert_eq!(object.content_type, "image/png");
    }

    #[tokio::test]
    async fn http_multimodal_image_to_video_downloads_real_video_artifact() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/artifacts/generated.mp4"))
            .respond_with(
                ResponseTemplate::new(200)
                    .insert_header("content-type", "video/mp4")
                    .set_body_bytes(b"video-bytes".to_vec()),
            )
            .mount(&server)
            .await;
        Mock::given(method("POST"))
            .and(path("/v1/generate/image-to-video"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "engine": "test-image-to-video-engine",
                "model": "hf-test-video-model",
                "summary": "video generated",
                "modelCalls": 1,
                "artifacts": [
                    {
                        "kind": "video",
                        "mimeType": "video/mp4",
                        "filename": "generated.mp4",
                        "downloadUrl": format!("{}/artifacts/generated.mp4", server.uri()),
                        "schemaRef": "artifact.video.schema.v1"
                    }
                ]
            })))
            .mount(&server)
            .await;

        let mut config = super::default_generation_config();
        config.provider = GenerationProvider::HttpMultimodal;
        config.image_to_video_url = Some(format!("{}/v1/generate/image-to-video", server.uri()));
        let (service, _audit) = service_with_generation_config(config);

        let job = service
            .create_job(input(GenerationMode::ImageToVideo))
            .expect("job should create");
        let planned = service
            .plan_job(job.id, GenerationActionRequest::default())
            .expect("job should plan");
        let completed = service
            .run_job_with_context_async(
                &RequestContext::development_admin(),
                planned.id,
                GenerationActionRequest::default(),
            )
            .await
            .expect("image_to_video should run through HTTP provider");

        assert_eq!(completed.status, GenerationJobStatus::PendingReview);
        assert_eq!(completed.model_route.provider, "http_multimodal");
        let artifact = completed
            .artifacts
            .iter()
            .find(|artifact| artifact.kind == ArtifactKind::Video)
            .expect("video artifact should be materialized");
        assert_eq!(artifact.artifact_metadata.mime_type, "video/mp4");
        let object = service
            .get_artifact_content_with_context(&RequestContext::development_admin(), artifact.id)
            .expect("generated video bytes should be in object store");
        assert_eq!(object.bytes, b"video-bytes");
        assert_eq!(object.content_type, "video/mp4");
    }

    #[test]
    fn job_runs_through_review_and_approval() {
        let (service, audit, lifecycle) = service_with_lifecycle();
        let job = service
            .create_job(input(GenerationMode::CadToBim))
            .expect("job should be created");
        assert_eq!(job.module_id, "production_manufacturing");
        assert_eq!(job.status, GenerationJobStatus::Queued);

        let job = service
            .plan_job(
                job.id,
                GenerationActionRequest {
                    actor: Some("planner".to_owned()),
                    comment: None,
                },
            )
            .expect("job should be planned");
        assert_eq!(job.status, GenerationJobStatus::Planned);

        let job = service
            .run_job(
                job.id,
                GenerationActionRequest {
                    actor: Some("runner".to_owned()),
                    comment: None,
                },
            )
            .expect("job should run");
        assert_eq!(job.status, GenerationJobStatus::PendingReview);
        assert_eq!(job.traces.len(), 5);
        assert_eq!(job.artifacts[0].kind, ArtifactKind::Bim);
        assert_eq!(job.artifacts[0].status, ArtifactStatus::Preview);
        assert_eq!(job.artifacts[0].reference.status, ArtifactStatus::Preview);
        assert!(
            job.artifacts[0]
                .object_uri
                .as_deref()
                .is_some_and(|uri| uri.starts_with("memory://"))
        );
        assert!(
            job.lifecycle_transaction_id.is_some(),
            "generation should create a lifecycle transaction"
        );
        assert_ne!(
            job.output.as_ref().expect("output exists").generator_id,
            job.output.as_ref().expect("output exists").evaluator_id
        );

        let job = service
            .review_job(
                job.id,
                GenerationReviewRequest {
                    reviewer: "reviewer".to_owned(),
                    decision: GenerationReviewDecision::Approved,
                    comment: Some("ready for approval".to_owned()),
                },
            )
            .expect("job should be reviewed");
        assert_eq!(job.status, GenerationJobStatus::PendingApproval);

        let job = service
            .approve_job(
                job.id,
                GenerationActionRequest {
                    actor: Some("approver".to_owned()),
                    comment: None,
                },
            )
            .expect("job should approve");
        assert_eq!(job.status, GenerationJobStatus::Approved);
        assert_eq!(job.artifacts[0].status, ArtifactStatus::Approved);
        assert_eq!(job.artifacts[0].reference.status, ArtifactStatus::Approved);
        let transaction = lifecycle
            .get_transaction(
                job.lifecycle_transaction_id
                    .expect("transaction should exist"),
            )
            .expect("transaction should still exist");
        assert_eq!(transaction.status, ModuleTransactionStatus::Approved);
        assert_generation_audit(&audit, &job);
    }

    #[test]
    fn pending_review_reject_rejects_linked_lifecycle_transaction() {
        let (service, audit, lifecycle) = service_with_lifecycle();
        let job = service
            .create_job(input(GenerationMode::ModelToLightweightScene))
            .expect("job should be created");
        let job = service
            .plan_job(
                job.id,
                GenerationActionRequest {
                    actor: None,
                    comment: None,
                },
            )
            .expect("job should be planned");
        let job = service
            .run_job(
                job.id,
                GenerationActionRequest {
                    actor: None,
                    comment: None,
                },
            )
            .expect("job should run");
        assert_eq!(job.status, GenerationJobStatus::PendingReview);

        let rejected = service
            .reject_job(
                job.id,
                GenerationActionRequest {
                    actor: Some("reviewer".to_owned()),
                    comment: Some("reject before active review".to_owned()),
                },
            )
            .expect("pending review job should reject");
        assert_eq!(rejected.status, GenerationJobStatus::Rejected);
        let transaction = lifecycle
            .get_transaction(
                rejected
                    .lifecycle_transaction_id
                    .expect("transaction should exist"),
            )
            .expect("transaction should still exist");
        assert_eq!(transaction.status, ModuleTransactionStatus::Rejected);
        let events = audit
            .list(&AuditEventQuery {
                module_id: Some("production_manufacturing".to_owned()),
                target_type: Some("generation_job".to_owned()),
                target_id: Some(rejected.id.to_string()),
                actor: None,
                limit: Some(20),
                cursor: None,
            })
            .expect("audit list should work");
        assert!(
            events
                .items
                .iter()
                .any(|event| event.action == AuditEventKind::GenerationJobRejected)
        );
    }

    #[test]
    fn active_review_reject_rejects_lifecycle_and_generated_artifacts() {
        let (service, audit, lifecycle) = service_with_lifecycle();
        let job = run_to_pending_review(&service, GenerationMode::ModelToLightweightScene);
        let trace_count_before_review = job.traces.len();

        let rejected = service
            .review_job(
                job.id,
                GenerationReviewRequest {
                    reviewer: "reviewer".to_owned(),
                    decision: GenerationReviewDecision::Rejected,
                    comment: Some("active review rejected".to_owned()),
                },
            )
            .expect("active review rejection should complete");

        assert_eq!(rejected.status, GenerationJobStatus::Rejected);
        assert!(
            rejected
                .artifacts
                .iter()
                .filter(|artifact| artifact.artifact_metadata.source_job_id == Some(job.id))
                .all(|artifact| artifact.status == ArtifactStatus::Rejected)
        );
        assert!(
            output_artifact_statuses(&rejected)
                .iter()
                .all(|status| *status == ArtifactStatus::Rejected)
        );
        assert_eq!(rejected.reviews.len(), 1);
        assert_eq!(rejected.traces.len(), trace_count_before_review + 1);
        let transaction = lifecycle
            .get_transaction(
                rejected
                    .lifecycle_transaction_id
                    .expect("transaction should exist"),
            )
            .expect("transaction should still exist");
        assert_eq!(transaction.status, ModuleTransactionStatus::Rejected);
        assert_eq!(generation_rejected_audit_count(&audit, &rejected), 1);
    }

    #[test]
    fn failed_active_review_reject_is_atomic_when_lifecycle_reject_fails() {
        let (service, audit, lifecycle) = service_with_lifecycle();
        let job = run_to_pending_review(&service, GenerationMode::ModelToLightweightScene);
        approve_linked_lifecycle(&lifecycle, &job);
        let before = service.get_job(job.id).expect("job should exist");

        let result = service.review_job(
            job.id,
            GenerationReviewRequest {
                reviewer: "reviewer".to_owned(),
                decision: GenerationReviewDecision::Rejected,
                comment: Some("lifecycle already terminal".to_owned()),
            },
        );

        assert!(result.is_err());
        let after = service.get_job(job.id).expect("job should still exist");
        assert_job_preserved_after_failed_reject(&before, &after);
        assert_eq!(generation_rejected_audit_count(&audit, &after), 0);
    }

    #[test]
    fn approved_and_rejected_generated_artifacts_mirror_status_everywhere() {
        let (service, _audit) = service();
        let approved = run_to_pending_review(&service, GenerationMode::ModelToLightweightScene);
        let approved = service
            .review_job(
                approved.id,
                GenerationReviewRequest {
                    reviewer: "reviewer".to_owned(),
                    decision: GenerationReviewDecision::Approved,
                    comment: Some("ready for approval".to_owned()),
                },
            )
            .and_then(|job| {
                service.approve_job(
                    job.id,
                    GenerationActionRequest {
                        actor: Some("approver".to_owned()),
                        comment: Some("approve artifacts".to_owned()),
                    },
                )
            })
            .expect("job should approve");
        assert_generated_artifact_status_mirror(&approved, ArtifactStatus::Approved);
        for output_artifact in &approved
            .output
            .as_ref()
            .expect("approved job should have output")
            .artifacts
        {
            let detail = service
                .get_artifact(output_artifact.id)
                .expect("artifact detail should resolve");
            assert_eq!(&detail, output_artifact);
            assert_eq!(
                service
                    .get_artifact_versions(output_artifact.id)
                    .expect("versions should resolve"),
                output_artifact.versions
            );
            assert_eq!(
                service
                    .get_artifact_metadata(output_artifact.id)
                    .expect("metadata should resolve"),
                output_artifact.artifact_metadata
            );
            assert_eq!(
                service
                    .get_artifact_storage_binding(output_artifact.id)
                    .expect("storage binding should resolve"),
                output_artifact.storage_binding
            );
        }

        let rejected = run_to_pending_review(&service, GenerationMode::IfcToGlb);
        let rejected = service
            .reject_job(
                rejected.id,
                GenerationActionRequest {
                    actor: Some("approver".to_owned()),
                    comment: Some("reject generated artifact".to_owned()),
                },
            )
            .expect("pending review job should reject");
        assert_generated_artifact_status_mirror(&rejected, ArtifactStatus::Rejected);

        let review_rejected = run_to_pending_review(&service, GenerationMode::CadToBim);
        let review_rejected = service
            .review_job(
                review_rejected.id,
                GenerationReviewRequest {
                    reviewer: "reviewer".to_owned(),
                    decision: GenerationReviewDecision::Rejected,
                    comment: Some("active review rejected".to_owned()),
                },
            )
            .expect("active review should reject");
        assert_generated_artifact_status_mirror(&review_rejected, ArtifactStatus::Rejected);
    }

    #[test]
    fn retry_after_failed_active_review_reject_does_not_duplicate_review_history() {
        let (service, audit, lifecycle) = service_with_lifecycle();
        let job = run_to_pending_review(&service, GenerationMode::ModelToLightweightScene);
        approve_linked_lifecycle(&lifecycle, &job);
        let before = service.get_job(job.id).expect("job should exist");

        for _ in 0..2 {
            let result = service.review_job(
                job.id,
                GenerationReviewRequest {
                    reviewer: "reviewer".to_owned(),
                    decision: GenerationReviewDecision::Rejected,
                    comment: Some("retry failed reject".to_owned()),
                },
            );
            assert!(result.is_err());
        }

        let after = service.get_job(job.id).expect("job should still exist");
        assert_job_preserved_after_failed_reject(&before, &after);
        assert!(after.reviews.is_empty());
        assert_eq!(generation_rejected_audit_count(&audit, &after), 0);
    }

    #[test]
    fn failed_pending_review_reject_is_atomic_when_lifecycle_reject_fails() {
        let (service, audit, lifecycle) = service_with_lifecycle();
        let job = run_to_pending_review(&service, GenerationMode::ModelToLightweightScene);
        approve_linked_lifecycle(&lifecycle, &job);
        let before = service.get_job(job.id).expect("job should exist");

        let result = service.reject_job(
            job.id,
            GenerationActionRequest {
                actor: Some("reviewer".to_owned()),
                comment: Some("lifecycle already terminal".to_owned()),
            },
        );

        assert!(result.is_err());
        let after = service.get_job(job.id).expect("job should still exist");
        assert_job_preserved_after_failed_reject(&before, &after);
        assert_eq!(generation_rejected_audit_count(&audit, &after), 0);
    }

    #[test]
    fn pending_approval_reject_rejects_linked_lifecycle_transaction() {
        let (service, _audit, lifecycle) = service_with_lifecycle();
        let job = service
            .create_job(input(GenerationMode::IfcToGlb))
            .expect("job should be created");
        let job = service
            .plan_job(
                job.id,
                GenerationActionRequest {
                    actor: None,
                    comment: None,
                },
            )
            .expect("job should be planned");
        let job = service
            .run_job(
                job.id,
                GenerationActionRequest {
                    actor: None,
                    comment: None,
                },
            )
            .expect("job should run");
        let job = service
            .review_job(
                job.id,
                GenerationReviewRequest {
                    reviewer: "reviewer".to_owned(),
                    decision: GenerationReviewDecision::Approved,
                    comment: None,
                },
            )
            .expect("job should reach pending approval");
        assert_eq!(job.status, GenerationJobStatus::PendingApproval);

        let rejected = service
            .reject_job(
                job.id,
                GenerationActionRequest {
                    actor: Some("approver".to_owned()),
                    comment: Some("reject at approval".to_owned()),
                },
            )
            .expect("pending approval job should reject");
        assert_eq!(rejected.status, GenerationJobStatus::Rejected);
        assert!(
            rejected
                .artifacts
                .iter()
                .filter(|artifact| artifact.artifact_metadata.source_job_id == Some(job.id))
                .all(|artifact| artifact.status == ArtifactStatus::Rejected)
        );
        let transaction = lifecycle
            .get_transaction(
                rejected
                    .lifecycle_transaction_id
                    .expect("transaction should exist"),
            )
            .expect("transaction should still exist");
        assert_eq!(transaction.status, ModuleTransactionStatus::Rejected);
    }

    #[test]
    fn failed_pending_approval_reject_is_atomic_when_lifecycle_reject_fails() {
        let (service, audit, lifecycle) = service_with_lifecycle();
        let job = run_to_pending_review(&service, GenerationMode::IfcToGlb);
        let job = service
            .review_job(
                job.id,
                GenerationReviewRequest {
                    reviewer: "reviewer".to_owned(),
                    decision: GenerationReviewDecision::Approved,
                    comment: Some("ready for approval".to_owned()),
                },
            )
            .expect("job should reach pending approval");
        approve_linked_lifecycle(&lifecycle, &job);
        let before = service.get_job(job.id).expect("job should exist");

        let result = service.reject_job(
            job.id,
            GenerationActionRequest {
                actor: Some("approver".to_owned()),
                comment: Some("lifecycle already terminal".to_owned()),
            },
        );

        assert!(result.is_err());
        let after = service.get_job(job.id).expect("job should still exist");
        assert_job_preserved_after_failed_reject(&before, &after);
        assert_eq!(after.reviews.len(), 1);
        assert_eq!(generation_rejected_audit_count(&audit, &after), 0);
    }

    #[test]
    fn terminal_generation_jobs_cannot_be_rejected_or_review_rejected_again() {
        let (service, audit) = service();
        let job = service
            .create_job(input(GenerationMode::TextToPdf))
            .expect("job should be created");
        let job = service
            .reject_job(
                job.id,
                GenerationActionRequest {
                    actor: None,
                    comment: None,
                },
            )
            .expect("queued job can be rejected");
        let before = service.get_job(job.id).expect("job should exist");

        assert!(
            service
                .reject_job(
                    job.id,
                    GenerationActionRequest {
                        actor: None,
                        comment: None,
                    },
                )
                .is_err()
        );
        assert!(
            service
                .review_job(
                    job.id,
                    GenerationReviewRequest {
                        reviewer: "reviewer".to_owned(),
                        decision: GenerationReviewDecision::Rejected,
                        comment: Some("terminal jobs cannot be review rejected".to_owned()),
                    },
                )
                .is_err()
        );
        let after = service.get_job(job.id).expect("job should still exist");
        assert_job_preserved_after_failed_reject(&before, &after);
        assert_eq!(generation_rejected_audit_count(&audit, &after), 1);
    }

    #[test]
    fn approved_generation_jobs_cannot_be_rejected_or_review_rejected() {
        let (service, audit, _lifecycle) = service_with_lifecycle();
        let job = run_to_pending_review(&service, GenerationMode::IfcToGlb);
        let job = service
            .review_job(
                job.id,
                GenerationReviewRequest {
                    reviewer: "reviewer".to_owned(),
                    decision: GenerationReviewDecision::Approved,
                    comment: Some("ready for approval".to_owned()),
                },
            )
            .expect("job should reach pending approval");
        let job = service
            .approve_job(
                job.id,
                GenerationActionRequest {
                    actor: Some("approver".to_owned()),
                    comment: Some("approved terminal".to_owned()),
                },
            )
            .expect("job should approve");
        let before = service.get_job(job.id).expect("job should exist");

        assert!(
            service
                .reject_job(
                    job.id,
                    GenerationActionRequest {
                        actor: Some("approver".to_owned()),
                        comment: Some("terminal jobs cannot reject again".to_owned()),
                    },
                )
                .is_err()
        );
        assert!(
            service
                .review_job(
                    job.id,
                    GenerationReviewRequest {
                        reviewer: "reviewer".to_owned(),
                        decision: GenerationReviewDecision::Rejected,
                        comment: Some("terminal jobs cannot be review rejected".to_owned()),
                    },
                )
                .is_err()
        );
        let after = service.get_job(job.id).expect("job should still exist");
        assert_job_preserved_after_failed_reject(&before, &after);
        assert_eq!(after.reviews.len(), 1);
        assert_eq!(generation_rejected_audit_count(&audit, &after), 0);
    }

    #[test]
    fn run_requires_plan_and_review_requires_run() {
        let (service, _audit) = service();
        let job = service
            .create_job(input(GenerationMode::TextToPdf))
            .expect("job should be created");

        assert!(
            service
                .run_job(
                    job.id,
                    GenerationActionRequest {
                        actor: None,
                        comment: None,
                    },
                )
                .is_err()
        );
        assert!(
            service
                .review_job(
                    job.id,
                    GenerationReviewRequest {
                        reviewer: "reviewer".to_owned(),
                        decision: GenerationReviewDecision::Approved,
                        comment: None,
                    },
                )
                .is_err()
        );
    }

    #[test]
    fn list_jobs_filters_by_status_and_mode() {
        let (service, _audit) = service();
        let job = service
            .create_job(input(GenerationMode::TextToDocument))
            .expect("job should be created");
        let _other = service
            .create_job(input(GenerationMode::TextToImage))
            .expect("job should be created");
        let page = service
            .list_jobs(&GenerationJobQuery {
                module_id: Some("production_manufacturing".to_owned()),
                status: Some(GenerationJobStatus::Queued),
                mode: Some(GenerationMode::TextToDocument),
                limit: Some(10),
                cursor: None,
            })
            .expect("list should work");
        assert_eq!(page.items.len(), 1);
        assert_eq!(page.items[0].id, job.id);
    }

    #[test]
    fn input_artifacts_are_preserved_as_caller_artifacts() {
        let (service, _audit) = service();
        let mut req = input(GenerationMode::ModelToImage);
        let artifact_id = Uuid::new_v4();
        let now = Utc::now();
        let storage_binding = ArtifactStorageBinding {
            artifact_role: ArtifactRole::SourceArtifact,
            provider: "memory".to_owned(),
            object_key: "input/model".to_owned(),
            object_uri: "memory://input/model".to_owned(),
            module_file_id: None,
            file_reference: "module-file://model".to_owned(),
        };
        let artifact_metadata = ArtifactMetadata {
            artifact_role: ArtifactRole::SourceArtifact,
            geometry_format: Some(GeometryFormat::Ifc),
            property_index_format: None,
            element_id_namespace: Some(ElementIdNamespace::IfcGuid),
            viewer_adapter_hint: Some(ViewerAdapterHint::Ifc),
            source_model_id: Some("source-model-input".to_owned()),
            schema_ref: "artifact.ifc.schema.v1".to_owned(),
            checksum: None,
            mime_type: "model/ifc".to_owned(),
            size_bytes: 0,
            owner: "planner".to_owned(),
            tenant_id: "11111111-1111-4111-8111-111111111111".to_owned(),
            project_id: "22222222-2222-4222-8222-222222222222".to_owned(),
            version: 1,
            request_id: "dev-request".to_owned(),
            correlation_id: "dev-correlation".to_owned(),
            source_job_id: None,
            created_by_job_id: None,
            approval_status: ArtifactStatus::Draft,
            audit_event_id: None,
            created_at: now,
            updated_at: now,
        };
        req.input_artifacts = Some(vec![Artifact {
            id: artifact_id,
            kind: ArtifactKind::Model,
            status: ArtifactStatus::Draft,
            object_uri: Some("memory://input/model".to_owned()),
            file_reference: "module-file://model".to_owned(),
            schema_ref: "artifact.ifc.schema.v1".to_owned(),
            version: 1,
            hash: None,
            metadata: json!({}),
            reference: ArtifactRef {
                artifact_id,
                artifact_kind: "model".to_owned(),
                module_id: "production_manufacturing".to_owned(),
                status: ArtifactStatus::Draft,
                name: "input model".to_owned(),
            },
            storage_binding: storage_binding.clone(),
            artifact_metadata: artifact_metadata.clone(),
            versions: vec![ArtifactVersion {
                id: Uuid::new_v4(),
                artifact_id,
                version: 1,
                status: ArtifactStatus::Draft,
                storage: storage_binding,
                metadata: artifact_metadata,
            }],
        }]);
        let job = service.create_job(req).expect("job should be created");
        assert_eq!(job.artifacts[0].status, ArtifactStatus::Draft);
    }

    #[test]
    fn lightweight_scene_job_references_identity_map_artifact() {
        let (service, _audit) = service();
        let job = service
            .create_job(input(GenerationMode::ModelToLightweightScene))
            .expect("job should be created");
        let job = service
            .plan_job(
                job.id,
                GenerationActionRequest {
                    actor: None,
                    comment: None,
                },
            )
            .expect("job should plan");
        let job = service
            .run_job(
                job.id,
                GenerationActionRequest {
                    actor: None,
                    comment: None,
                },
            )
            .expect("job should run");

        assert!(
            job.artifacts
                .iter()
                .any(|artifact| artifact.kind == ArtifactKind::ElementIdentityMap)
        );
        assert!(
            job.artifacts
                .iter()
                .any(|artifact| artifact.kind == ArtifactKind::PropertyIndex)
        );
        assert!(
            job.artifacts
                .iter()
                .any(|artifact| artifact.kind == ArtifactKind::LightweightScene)
        );
        assert!(job.artifacts.iter().any(|artifact| {
            artifact.artifact_metadata.geometry_format == Some(GeometryFormat::Gltf)
                && artifact.artifact_metadata.viewer_adapter_hint
                    == Some(ViewerAdapterHint::ThreeJs)
        }));

        let scene = job
            .artifacts
            .iter()
            .find(|artifact| artifact.kind == ArtifactKind::LightweightScene)
            .expect("lightweight scene artifact should exist");
        assert_eq!(
            service
                .get_artifact_metadata(scene.id)
                .expect("scene metadata should be queryable")
                .viewer_adapter_hint,
            Some(ViewerAdapterHint::ThreeJs)
        );
        let property_index = job
            .artifacts
            .iter()
            .find(|artifact| artifact.kind == ArtifactKind::PropertyIndex)
            .expect("property index artifact should exist");
        assert_eq!(
            service
                .get_artifact_metadata(property_index.id)
                .expect("property index metadata should be queryable")
                .property_index_format,
            Some(PropertyIndexFormat::Json)
        );
        let identity_map = job
            .artifacts
            .iter()
            .find(|artifact| artifact.kind == ArtifactKind::ElementIdentityMap)
            .expect("element identity map artifact should exist");
        assert_eq!(
            service
                .get_artifact_metadata(identity_map.id)
                .expect("identity map metadata should be queryable")
                .element_id_namespace,
            Some(ElementIdNamespace::ArchitokenElementId)
        );
    }

    #[test]
    fn scene_tile_and_open_compression_modes_have_expected_metadata() {
        let (service, _audit) = service();
        for mode in [
            GenerationMode::IfcTo3dtiles,
            GenerationMode::BimToSceneTiles,
        ] {
            let job = service.create_job(input(mode)).expect("job should create");
            let job = service
                .plan_job(
                    job.id,
                    GenerationActionRequest {
                        actor: None,
                        comment: None,
                    },
                )
                .and_then(|planned| {
                    service.run_job(
                        planned.id,
                        GenerationActionRequest {
                            actor: None,
                            comment: None,
                        },
                    )
                })
                .expect("job should run");
            let artifact = job
                .artifacts
                .iter()
                .find(|artifact| artifact.kind == ArtifactKind::SceneTiles)
                .expect("scene tiles artifact should exist");
            assert_eq!(
                artifact.artifact_metadata.geometry_format,
                Some(GeometryFormat::Tiles3d)
            );
            assert_eq!(
                artifact.artifact_metadata.viewer_adapter_hint,
                Some(ViewerAdapterHint::Tiles3d)
            );
            assert_eq!(
                artifact.artifact_metadata.mime_type,
                "application/vnd.3dtiles+json"
            );
        }

        for mode in [
            GenerationMode::MeshDracoCompress,
            GenerationMode::MeshMeshoptCompress,
        ] {
            let job = service.create_job(input(mode)).expect("job should create");
            let job = service
                .plan_job(
                    job.id,
                    GenerationActionRequest {
                        actor: None,
                        comment: None,
                    },
                )
                .and_then(|planned| {
                    service.run_job(
                        planned.id,
                        GenerationActionRequest {
                            actor: None,
                            comment: None,
                        },
                    )
                })
                .expect("job should run");
            let artifact = job
                .artifacts
                .iter()
                .find(|artifact| artifact.kind == ArtifactKind::Glb)
                .expect("compressed glb artifact should exist");
            assert_eq!(
                artifact.artifact_metadata.geometry_format,
                Some(GeometryFormat::Glb)
            );
            assert_eq!(artifact.artifact_metadata.mime_type, "model/gltf-binary");
            assert_eq!(
                artifact.metadata["compression"]["route"],
                serde_json::json!("open_format")
            );
        }
    }

    #[test]
    fn standalone_artifact_index_resolves_generated_artifact_contracts() {
        let (service, _audit) = service();
        let job = service
            .create_job(input(GenerationMode::ModelToLightweightScene))
            .expect("job should be created");
        let job = service
            .plan_job(
                job.id,
                GenerationActionRequest {
                    actor: None,
                    comment: None,
                },
            )
            .and_then(|planned| {
                service.run_job(
                    planned.id,
                    GenerationActionRequest {
                        actor: None,
                        comment: None,
                    },
                )
            })
            .expect("job should run");
        let artifact = job
            .artifacts
            .iter()
            .find(|artifact| artifact.kind == ArtifactKind::LightweightScene)
            .expect("lightweight scene should exist");

        let page = service
            .list_indexed_artifacts(&ArtifactListQuery {
                module_id: Some("production_manufacturing".to_owned()),
                kind: Some(ArtifactKind::LightweightScene),
                status: Some(ArtifactStatus::Preview),
                source_job_id: Some(job.id),
                limit: Some(10),
                cursor: None,
            })
            .expect("artifact list should work");
        assert_eq!(page.items.len(), 1);
        assert_eq!(page.items[0].id, artifact.id);

        let resolved = service
            .get_artifact(artifact.id)
            .expect("artifact should resolve");
        assert_eq!(resolved.reference.artifact_id, artifact.id);
        assert_eq!(
            service
                .get_artifact_versions(artifact.id)
                .expect("versions should resolve")
                .len(),
            1
        );
        assert_eq!(
            service
                .get_artifact_metadata(artifact.id)
                .expect("metadata should resolve")
                .schema_ref,
            "artifact.lightweight_scene.schema.v1"
        );
        assert_eq!(
            service
                .get_artifact_storage_binding(artifact.id)
                .expect("storage should resolve")
                .provider,
            "memory"
        );
    }

    #[test]
    fn standalone_artifact_index_filters_and_paginates_stably() {
        let (service, _audit) = service();
        let lightweight = run_to_pending_review(&service, GenerationMode::ModelToLightweightScene);
        let pdf = run_to_pending_review(&service, GenerationMode::TextToPdf);

        let first_page = service
            .list_indexed_artifacts(&ArtifactListQuery {
                module_id: Some("production_manufacturing".to_owned()),
                kind: None,
                status: None,
                source_job_id: None,
                limit: Some(2),
                cursor: None,
            })
            .expect("first artifact page should work");
        assert_eq!(first_page.items.len(), 2);
        assert!(first_page.page_info.has_more);

        let second_page = service
            .list_indexed_artifacts(&ArtifactListQuery {
                module_id: Some("production_manufacturing".to_owned()),
                kind: None,
                status: None,
                source_job_id: None,
                limit: Some(2),
                cursor: first_page
                    .page_info
                    .next_cursor
                    .as_deref()
                    .map(str::to_owned),
            })
            .expect("second artifact page should work");
        assert!(
            first_page
                .items
                .iter()
                .all(|first| second_page.items.iter().all(|second| first.id != second.id))
        );

        let property_index = service
            .list_indexed_artifacts(&ArtifactListQuery {
                module_id: Some("production_manufacturing".to_owned()),
                kind: Some(ArtifactKind::PropertyIndex),
                status: Some(ArtifactStatus::Draft),
                source_job_id: Some(lightweight.id),
                limit: Some(10),
                cursor: None,
            })
            .expect("filtered property index should resolve");
        assert_eq!(property_index.items.len(), 1);
        assert_eq!(property_index.items[0].kind, ArtifactKind::PropertyIndex);

        let pdf_artifacts = service
            .list_indexed_artifacts(&ArtifactListQuery {
                module_id: Some("production_manufacturing".to_owned()),
                kind: Some(ArtifactKind::Pdf),
                status: Some(ArtifactStatus::Draft),
                source_job_id: Some(pdf.id),
                limit: Some(10),
                cursor: None,
            })
            .expect("filtered pdf artifact should resolve");
        assert_eq!(pdf_artifacts.items.len(), 1);
    }

    #[test]
    fn unknown_artifact_returns_not_found() {
        let (service, _audit) = service();
        let err = service
            .get_artifact(Uuid::new_v4())
            .expect_err("unknown artifact should fail");
        assert!(matches!(&err, HarnessError::NotFound(_)));
        assert_eq!(err.http_status(), 404);
    }

    #[test]
    fn rejects_unknown_module() {
        let (service, _audit) = service();
        let mut req = input(GenerationMode::TextToImage);
        req.module_id = "unknown".to_owned();
        assert!(service.create_job(req).is_err());
    }
}
