//! AI-native multimodal engineering generation service.
//!
//! This is an in-memory API skeleton for `ArchIToken` AIGC generation and
//! conversion jobs. It establishes the backend contract for frontend and
//! third-party callers without connecting to real model providers, databases,
//! or object storage.

use std::{collections::HashMap, sync::Arc};

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    error::{HarnessError, Result},
    module_audit::{AuditEventInput, AuditEventKind, ModuleAuditService},
    module_lifecycle::{
        ApprovalDecisionRequest, CreateModuleTransactionRequest, ModuleLifecycleService,
        ModuleTransitionEvent, ModuleTransitionRequest,
    },
    module_pagination::{ListPage, PageInfo, paginate},
    module_registry::normalize_module_id,
    storage_router::{
        ArtifactMetadata, ArtifactRef, ArtifactRole, ArtifactStatus, ArtifactStorageBinding,
        ArtifactVersion, ElementIdNamespace, GeometryFormat, InMemoryObjectStore, ObjectPutRequest,
        ObjectStore, PropertyIndexFormat, ViewerAdapterHint,
    },
};

const DEFAULT_ACTOR: &str = "system";
const MOCK_SKILL_VERSION: &str = "0.1.0";

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
            Self::TextToImage => "text_to_image_mock_skill",
            Self::TextToDocument => "text_to_document_mock_skill",
            Self::TextToSpreadsheet => "text_to_spreadsheet_mock_skill",
            Self::TextToPdf => "text_to_pdf_mock_skill",
            Self::TextToPpt => "text_to_ppt_mock_skill",
            Self::TextToMindmap => "text_to_mindmap_mock_skill",
            Self::TextToFlowchart => "text_to_flowchart_mock_skill",
            Self::TextToGantt => "text_to_gantt_mock_skill",
            Self::TextToFloorplan => "text_to_floorplan_mock_skill",
            Self::TextToCad => "text_to_cad_mock_skill",
            Self::TextToBim => "text_to_bim_mock_skill",
            Self::TextToDigitalTwin => "text_to_digital_twin_mock_skill",
            Self::ImageToVideo => "image_to_video_mock_skill",
            Self::ImageToPdfDrawing => "image_to_pdf_drawing_mock_skill",
            Self::ImageToCad => "image_to_cad_mock_skill",
            Self::ImageToBim => "image_to_bim_mock_skill",
            Self::ImageToDigitalTwin => "image_to_digital_twin_mock_skill",
            Self::VideoToBim => "video_to_bim_mock_skill",
            Self::VideoToDigitalTwin => "video_to_digital_twin_mock_skill",
            Self::VideoToPointCloud => "video_to_point_cloud_mock_skill",
            Self::CadToBim => "cad_to_bim_mock_skill",
            Self::CadToDigitalTwin => "cad_to_digital_twin_mock_skill",
            Self::PdfDrawingToBim => "pdf_drawing_to_bim_mock_skill",
            Self::PdfDrawingToDigitalTwin => "pdf_drawing_to_digital_twin_mock_skill",
            Self::DrawingToImage => "drawing_to_image_mock_skill",
            Self::DrawingToPdf => "drawing_to_pdf_mock_skill",
            Self::ModelToTable => "model_to_table_mock_skill",
            Self::ModelToDrawing => "model_to_drawing_mock_skill",
            Self::ModelToImage => "model_to_image_mock_skill",
            Self::ModelToLightweightScene => "model_to_lightweight_scene_mock_skill",
            Self::BimToSceneTiles => "bim_to_scene_tiles_mock_skill",
            Self::CadToSceneTiles => "cad_to_scene_tiles_mock_skill",
            Self::IfcToGlb => "ifc_to_glb_mock_skill",
            Self::IfcTo3dtiles => "ifc_to_3dtiles_mock_skill",
            Self::GlbOptimize => "glb_optimize_mock_skill",
            Self::MeshSimplify => "mesh_simplify_mock_skill",
            Self::MeshDracoCompress => "mesh_draco_compress_mock_skill",
            Self::MeshMeshoptCompress => "mesh_meshopt_compress_mock_skill",
            Self::SceneLodGenerate => "scene_lod_generate_mock_skill",
            Self::ModelPropertyIndexGenerate => "model_property_index_generate_mock_skill",
            Self::ElementIdentityMapGenerate => "element_identity_map_generate_mock_skill",
            Self::DigitalTwinSceneGenerate => "digital_twin_scene_generate_mock_skill",
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
    /// Optional object-store URI. Current skeleton uses `memory://` URIs.
    pub object_uri: Option<String>,
    /// Stable file-system reference for frontend and third-party callers.
    pub file_reference: String,
    /// Artifact schema reference.
    pub schema_ref: String,
    /// Artifact version.
    pub version: u32,
    /// Optional content hash.
    pub hash: Option<String>,
    /// Small structured metadata for previews and tests.
    pub metadata: serde_json::Value,
    /// Stable artifact reference for callers and downstream workflows.
    pub reference: ArtifactRef,
    /// Current storage binding.
    pub storage_binding: ArtifactStorageBinding,
    /// Durable artifact metadata boundary.
    pub artifact_metadata: ArtifactMetadata,
    /// Artifact versions retained for audit and future `ObjectStore` migration.
    pub versions: Vec<ArtifactVersion>,
}

/// Input used to create a generation job.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationInput {
    /// Active module id or accepted legacy alias.
    pub module_id: String,
    /// Requested conversion mode.
    pub mode: GenerationMode,
    /// Natural-language prompt or task brief.
    pub prompt: String,
    /// Actor creating the job.
    pub actor: Option<String>,
    /// Optional input artifacts.
    pub input_artifacts: Option<Vec<Artifact>>,
    /// Optional constraints passed to planner and mock skill.
    pub constraints: Option<serde_json::Value>,
}

/// Output summary produced by the mock generation pipeline.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationOutput {
    /// Output artifacts created by the mock generator.
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

/// MCP tool contract selected by the mock `WorkflowRouter`.
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

/// Model routing decision made by the mock `WorkflowRouter`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRoute {
    /// Provider id. The skeleton always uses `mock`.
    pub provider: String,
    /// Model id. The skeleton never calls the model.
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
    /// Mock generator/evaluator/checkers are running.
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
    /// Active module id after alias normalization.
    pub module_id: String,
    /// Requested conversion mode.
    pub mode: GenerationMode,
    /// Current job status.
    pub status: GenerationJobStatus,
    /// Original caller input.
    pub input: GenerationInput,
    /// Output from the mock pipeline.
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
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Query shape used by `GET /v1/generation/jobs`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
pub struct GenerationJobQuery {
    /// Optional module id or accepted legacy alias.
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
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationActionRequest {
    /// Actor performing the action.
    pub actor: Option<String>,
    /// Optional action comment.
    pub comment: Option<String>,
}

/// Review request for active review after mock evaluation.
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
    /// Optional module id or accepted legacy alias.
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

/// In-memory generation service.
#[derive(Debug, Clone)]
pub struct ModuleGenerationService {
    jobs: Arc<RwLock<HashMap<Uuid, GenerationJob>>>,
    audit: Arc<ModuleAuditService>,
    lifecycle: ModuleLifecycleService,
    object_store: InMemoryObjectStore,
}

impl ModuleGenerationService {
    /// Create an empty generation service.
    #[must_use]
    pub fn new(audit: Arc<ModuleAuditService>, lifecycle: ModuleLifecycleService) -> Self {
        Self {
            jobs: Arc::new(RwLock::new(HashMap::new())),
            audit,
            lifecycle,
            object_store: InMemoryObjectStore::new(),
        }
    }

    /// Create a queued generation job.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the module id cannot be normalized
    /// and [`HarnessError::InvalidInput`] when the prompt is empty.
    pub fn create_job(&self, mut input: GenerationInput) -> Result<GenerationJob> {
        let module_id = normalize_module_id(&input.module_id)
            .ok_or_else(|| HarnessError::NotFound(format!("module_id={}", input.module_id)))?;
        if input.prompt.trim().is_empty() {
            return Err(HarnessError::InvalidInput("prompt is required".to_owned()));
        }

        module_id.as_str().clone_into(&mut input.module_id);
        let actor = input
            .actor
            .clone()
            .unwrap_or_else(|| DEFAULT_ACTOR.to_owned());
        let now = Utc::now();
        let artifacts = normalize_input_artifacts(input.input_artifacts.take());
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
            created_at: now,
            updated_at: now,
        };
        self.jobs.write().insert(job.id, job.clone());
        self.audit_job(
            &job,
            AuditEventKind::GenerationJobCreated,
            job.actor.clone(),
            "generation job created",
            json!({ "mode": job.mode }),
        );
        Ok(job)
    }

    /// List generation jobs with optional filters.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the optional module id cannot be normalized.
    pub fn list_jobs(&self, query: &GenerationJobQuery) -> Result<ListPage<GenerationJob>> {
        let normalized = query
            .module_id
            .as_deref()
            .map(|id| {
                normalize_module_id(id)
                    .ok_or_else(|| HarnessError::NotFound(format!("module_id={id}")))
            })
            .transpose()?;
        let items: Vec<GenerationJob> = self
            .jobs
            .read()
            .values()
            .filter(|job| {
                normalized
                    .as_ref()
                    .is_none_or(|module_id| job.module_id == module_id.as_str())
            })
            .filter(|job| query.status.is_none_or(|status| job.status == status))
            .filter(|job| query.mode.is_none_or(|mode| job.mode == mode))
            .cloned()
            .collect();
        paginate(&items, query.limit, query.cursor.as_deref())
    }

    /// Get one generation job.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the job id is unknown.
    pub fn get_job(&self, job_id: Uuid) -> Result<GenerationJob> {
        self.jobs
            .read()
            .get(&job_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("generation_job_id={job_id}")))
    }

    /// Run the planner stage.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the job id is unknown and
    /// [`HarnessError::InvalidInput`] when the job is not queued.
    pub fn plan_job(&self, job_id: Uuid, req: GenerationActionRequest) -> Result<GenerationJob> {
        let lifecycle = self.lifecycle.clone();
        self.mutate_job(job_id, |job| {
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
                "planner created a deterministic mock execution plan",
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
                    json!({ "stage": GenerationStage::Planner }),
                ),
                AuditSpec::new(
                    AuditEventKind::GenerationStageCompleted,
                    actor,
                    "generation planner stage completed",
                    json!({ "stage": GenerationStage::Planner }),
                ),
            ])
        })
    }

    /// Run the mock generator, evaluator, rule checker, and schema validator.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the job id is unknown and
    /// [`HarnessError::InvalidInput`] when the job was not planned.
    pub fn run_job(&self, job_id: Uuid, req: GenerationActionRequest) -> Result<GenerationJob> {
        let lifecycle = self.lifecycle.clone();
        let object_store = self.object_store.clone();
        self.mutate_job(job_id, |job| {
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
            complete_mock_pipeline(job, req, &object_store)
        })
    }

    /// Append an active-review record after evaluator output.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the job id is unknown and
    /// [`HarnessError::InvalidInput`] when review is not allowed.
    pub fn review_job(&self, job_id: Uuid, req: GenerationReviewRequest) -> Result<GenerationJob> {
        let lifecycle = self.lifecycle.clone();
        self.mutate_job(job_id, |job| {
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
                json!({ "decision": req.decision, "comment": req.comment }),
            )];
            if req.decision == GenerationReviewDecision::Rejected {
                audits.push(AuditSpec::new(
                    AuditEventKind::GenerationJobRejected,
                    req.reviewer,
                    "generation job rejected during active review",
                    json!({ "status": job.status }),
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
        let lifecycle = self.lifecycle.clone();
        self.mutate_job(job_id, |job| {
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
                    json!({ "stage": GenerationStage::Approver, "decision": "approved" }),
                ),
                AuditSpec::new(
                    AuditEventKind::GenerationJobApproved,
                    actor,
                    "generation job approved",
                    json!({ "status": job.status }),
                ),
            ])
        })
    }

    /// Reject a generation job.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the job id is unknown.
    pub fn reject_job(&self, job_id: Uuid, req: GenerationActionRequest) -> Result<GenerationJob> {
        let lifecycle = self.lifecycle.clone();
        self.mutate_job(job_id, |job| {
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
                    json!({ "stage": GenerationStage::Approver, "decision": "rejected" }),
                ),
                AuditSpec::new(
                    AuditEventKind::GenerationJobRejected,
                    actor,
                    "generation job rejected",
                    json!({ "status": job.status }),
                ),
            ])
        })
    }

    /// List artifacts attached to one generation job.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the job id is unknown.
    pub fn list_artifacts(&self, job_id: Uuid) -> Result<GenerationArtifactsResponse> {
        let job = self.get_job(job_id)?;
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
        let normalized = query
            .module_id
            .as_deref()
            .map(|id| {
                normalize_module_id(id)
                    .ok_or_else(|| HarnessError::NotFound(format!("module_id={id}")))
            })
            .transpose()?;
        let artifacts: Vec<Artifact> = self
            .jobs
            .read()
            .values()
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
        paginate(&artifacts, query.limit, query.cursor.as_deref())
    }

    /// Get one artifact by id across all generation jobs.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the artifact id is unknown.
    pub fn get_artifact(&self, artifact_id: Uuid) -> Result<Artifact> {
        self.jobs
            .read()
            .values()
            .flat_map(|job| job.artifacts.iter())
            .find(|artifact| artifact.id == artifact_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("artifact_id={artifact_id}")))
    }

    /// Get one artifact's version history.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the artifact id is unknown.
    pub fn get_artifact_versions(&self, artifact_id: Uuid) -> Result<Vec<ArtifactVersion>> {
        Ok(self.get_artifact(artifact_id)?.versions)
    }

    /// Get one artifact's metadata.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the artifact id is unknown.
    pub fn get_artifact_metadata(&self, artifact_id: Uuid) -> Result<ArtifactMetadata> {
        Ok(self.get_artifact(artifact_id)?.artifact_metadata)
    }

    /// Get one artifact's storage binding.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the artifact id is unknown.
    pub fn get_artifact_storage_binding(
        &self,
        artifact_id: Uuid,
    ) -> Result<ArtifactStorageBinding> {
        Ok(self.get_artifact(artifact_id)?.storage_binding)
    }

    fn mutate_job<F>(&self, job_id: Uuid, mutate: F) -> Result<GenerationJob>
    where
        F: FnOnce(&mut GenerationJob) -> Result<Vec<AuditSpec>>,
    {
        let (job, audit_specs) = {
            let mut jobs = self.jobs.write();
            let mut draft = jobs
                .get(&job_id)
                .cloned()
                .ok_or_else(|| HarnessError::NotFound(format!("generation_job_id={job_id}")))?;
            let audit_specs = mutate(&mut draft)?;
            draft.updated_at = Utc::now();
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
            metadata,
        });
    }
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

fn complete_mock_pipeline(
    job: &mut GenerationJob,
    req: GenerationActionRequest,
    object_store: &impl ObjectStore,
) -> Result<Vec<AuditSpec>> {
    job.status = GenerationJobStatus::Running;
    let actor_ref = req.actor.as_deref().unwrap_or(DEFAULT_ACTOR);
    append_trace(
        job,
        GenerationStage::Generator,
        "mock_generator_v1",
        "mock generator produced an artifact reference",
        json!({ "actor": actor_ref, "selfEvaluation": false }),
    );

    let artifacts = generated_artifacts(job, object_store)?;
    job.artifacts.extend(artifacts.clone());
    append_trace(
        job,
        GenerationStage::Evaluator,
        "mock_evaluator_v1",
        "independent mock evaluator reviewed the generated artifact",
        json!({
            "generatorId": "mock_generator_v1",
            "evaluatorId": "mock_evaluator_v1",
            "generatorSelfEvaluated": false
        }),
    );
    append_trace(
        job,
        GenerationStage::RuleChecker,
        "mock_rule_checker_v1",
        "deterministic rule checker passed",
        json!({ "passed": true }),
    );
    append_trace(
        job,
        GenerationStage::SchemaValidator,
        "mock_schema_validator_v1",
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
        summary: "mock generation completed without external model calls".to_owned(),
        generator_id: "mock_generator_v1".to_owned(),
        evaluator_id: "mock_evaluator_v1".to_owned(),
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
            "generation mock pipeline completed",
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
    object_store: &impl ObjectStore,
) -> Result<Vec<Artifact>> {
    let primary = generated_artifact(job, object_store, job.mode.output_kind())?;
    if job.mode == GenerationMode::ModelToLightweightScene {
        let property_index = generated_artifact(job, object_store, ArtifactKind::PropertyIndex)?;
        let identity_map = generated_artifact(job, object_store, ArtifactKind::ElementIdentityMap)?;
        return Ok(vec![primary, property_index, identity_map]);
    }
    Ok(vec![primary])
}

fn generated_artifact(
    job: &GenerationJob,
    object_store: &impl ObjectStore,
    kind: ArtifactKind,
) -> Result<Artifact> {
    let id = Uuid::new_v4();
    let role = artifact_role_for(kind);
    let object_key = format!("generation/{}/{}/{}", job.id, artifact_kind_label(kind), id);
    let mime_type = mime_type_for(kind).to_owned();
    let object = object_store.put_object(ObjectPutRequest {
        key: object_key.clone(),
        bytes: format!("mock artifact for {} via {}", job.id, job.mode.skill_id()).into_bytes(),
        content_type: mime_type.clone(),
        owner: job.actor.clone(),
    })?;
    let file_reference = format!("generation://files/{id}");
    let schema_ref = schema_ref_for(kind).to_owned();
    let status = generated_status(kind);
    let storage_binding = ArtifactStorageBinding {
        artifact_role: role,
        provider: "memory".to_owned(),
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
        source_job_id: Some(job.id),
        created_by_job_id: Some(job.id),
        approval_status: status,
        audit_event_id: None,
        created_at: object.created_at,
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
            "storage": "in_memory_stub",
            "modelCalls": 0,
            "generator": "mock_generator_v1",
            "evaluator": "mock_evaluator_v1",
            "compression": compression_metadata_for(job.mode),
            "sceneTiles": scene_tiles_metadata_for(kind)
        }),
        reference,
        storage_binding,
        artifact_metadata,
        versions: vec![version],
    })
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
    for artifact in &mut job.artifacts {
        if artifact.artifact_metadata.source_job_id == Some(job.id) {
            set_artifact_status(artifact, status);
        }
    }
    if let Some(output) = &mut job.output {
        for artifact in &mut output.artifacts {
            set_artifact_status(artifact, status);
        }
    }
}

fn set_artifact_status(artifact: &mut Artifact, status: ArtifactStatus) {
    artifact.status = status;
    artifact.reference.status = status;
    artifact.artifact_metadata.approval_status = status;
    if let Some(version) = artifact.versions.last_mut() {
        version.status = status;
        version.metadata.approval_status = status;
    }
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
        version: MOCK_SKILL_VERSION.to_owned(),
        description: "mock AIGC engineering generation skill; no external model call".to_owned(),
        input_schema: "generation.input.schema.v1".to_owned(),
        output_schema: schema_ref_for(output_kind).to_owned(),
        sandbox_profile: "mock_tool_sandbox_no_network".to_owned(),
        license_policy:
            "MIT/Apache-2.0/BSD preferred; GPL/AGPL/LGPL/SSPL/BUSL/Commons Clause denied".to_owned(),
    }
}

fn mcp_tool_for(mode: GenerationMode) -> McpToolSpec {
    McpToolSpec {
        name: "mock_generation_tool".to_owned(),
        version: MOCK_SKILL_VERSION.to_owned(),
        capability: mode.skill_id().trim_end_matches("_mock_skill").to_owned(),
        input_schema: "generation.input.schema.v1".to_owned(),
        output_schema: schema_ref_for(mode.output_kind()).to_owned(),
        permission_scope: "generation:write".to_owned(),
    }
}

fn model_route_for(mode: GenerationMode) -> ModelRoute {
    ModelRoute {
        provider: "mock".to_owned(),
        model: "mock-aigc-generator-v1".to_owned(),
        reason: format!(
            "WorkflowRouter selected local stub for {}; no external model API is called",
            mode.skill_id()
        ),
        privacy_tier: "local_stub".to_owned(),
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

    use crate::module_audit::{AuditEventKind, AuditEventQuery, ModuleAuditService};
    use crate::module_lifecycle::{
        ApprovalDecisionRequest, ModuleLifecycleService, ModuleTransactionStatus,
    };
    use crate::storage_router::{
        ArtifactMetadata, ArtifactRef, ArtifactRole, ArtifactStatus, ArtifactStorageBinding,
        ArtifactVersion, ElementIdNamespace, GeometryFormat, ViewerAdapterHint,
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

    fn input(mode: GenerationMode) -> GenerationInput {
        GenerationInput {
            module_id: "fabrication".to_owned(),
            mode,
            prompt: "Generate a production-ready preview".to_owned(),
            actor: Some("planner".to_owned()),
            input_artifacts: None,
            constraints: None,
        }
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
                module_id: Some("manufacturing".to_owned()),
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
            source_job_id: None,
            created_by_job_id: None,
            approval_status: ArtifactStatus::Draft,
            audit_event_id: None,
            created_at: now,
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
                module_id: Some("fabrication".to_owned()),
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
    fn rejects_unknown_module() {
        let (service, _audit) = service();
        let mut req = input(GenerationMode::TextToImage);
        req.module_id = "unknown".to_owned();
        assert!(service.create_job(req).is_err());
    }
}
