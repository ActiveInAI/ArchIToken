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
    module_pagination::{ListPage, PageInfo, paginate},
    module_registry::normalize_module_id,
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
}

impl GenerationMode {
    /// Complete conversion matrix required by the API contract.
    pub const ALL: [Self; 29] = [
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
            | Self::PdfDrawingToDigitalTwin => ArtifactKind::DigitalTwin,
            Self::ImageToVideo => ArtifactKind::Video,
            Self::ImageToPdfDrawing => ArtifactKind::PdfDrawing,
            Self::VideoToPointCloud => ArtifactKind::PointCloud,
            Self::ModelToTable => ArtifactKind::Table,
            Self::ModelToDrawing => ArtifactKind::Drawing,
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
}

/// Lifecycle state for generated artifacts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ArtifactStatus {
    /// Input artifact supplied by caller.
    Input,
    /// Preview artifact, not valid for production use.
    Preview,
    /// Draft artifact awaiting approval.
    Draft,
    /// Approved artifact.
    Approved,
    /// Rejected artifact.
    Rejected,
    /// Archived artifact.
    Archived,
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
}

impl ModuleGenerationService {
    /// Create an empty generation service.
    #[must_use]
    pub fn new(audit: Arc<ModuleAuditService>) -> Self {
        Self {
            jobs: Arc::new(RwLock::new(HashMap::new())),
            audit,
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
        self.mutate_job(job_id, |job| {
            ensure_status(job, &[GenerationJobStatus::Queued])?;
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
        self.mutate_job(job_id, |job| {
            ensure_status(job, &[GenerationJobStatus::Planned])?;
            job.status = GenerationJobStatus::Running;
            let actor = req.actor.as_deref().unwrap_or(DEFAULT_ACTOR);
            append_trace(
                job,
                GenerationStage::Generator,
                "mock_generator_v1",
                "mock generator produced an artifact reference",
                json!({ "actor": actor, "selfEvaluation": false }),
            );

            let artifact = generated_artifact(job);
            job.artifacts.push(artifact.clone());
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
                json!({ "schemaRef": artifact.schema_ref, "passed": true }),
            );
            job.output = Some(GenerationOutput {
                artifacts: vec![artifact],
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
                    json!({ "mode": job.mode, "artifactCount": 1 }),
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
        })
    }

    /// Append an active-review record after evaluator output.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the job id is unknown and
    /// [`HarnessError::InvalidInput`] when review is not allowed.
    pub fn review_job(&self, job_id: Uuid, req: GenerationReviewRequest) -> Result<GenerationJob> {
        self.mutate_job(job_id, |job| {
            ensure_status(job, &[GenerationJobStatus::PendingReview])?;
            let review = GenerationReview {
                id: Uuid::new_v4(),
                reviewer: req.reviewer.clone(),
                decision: req.decision,
                comment: req.comment.clone(),
                active_review: true,
                created_at: Utc::now(),
            };
            job.reviews.push(review);
            job.status = match req.decision {
                GenerationReviewDecision::Approved => GenerationJobStatus::PendingApproval,
                GenerationReviewDecision::NeedsChanges => GenerationJobStatus::PendingReview,
                GenerationReviewDecision::Rejected => GenerationJobStatus::Rejected,
            };
            Ok(vec![AuditSpec::new(
                AuditEventKind::GenerationJobReviewed,
                req.reviewer,
                "generation job active review completed",
                json!({ "decision": req.decision, "comment": req.comment }),
            )])
        })
    }

    /// Approve a reviewed generation job.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the job id is unknown and
    /// [`HarnessError::InvalidInput`] when approval is not allowed.
    pub fn approve_job(&self, job_id: Uuid, req: GenerationActionRequest) -> Result<GenerationJob> {
        self.mutate_job(job_id, |job| {
            ensure_status(job, &[GenerationJobStatus::PendingApproval])?;
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
        self.mutate_job(job_id, |job| {
            if matches!(
                job.status,
                GenerationJobStatus::Approved | GenerationJobStatus::Archived
            ) {
                return Err(HarnessError::InvalidInput(format!(
                    "cannot reject generation job from {:?}",
                    job.status
                )));
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

    fn mutate_job<F>(&self, job_id: Uuid, mutate: F) -> Result<GenerationJob>
    where
        F: FnOnce(&mut GenerationJob) -> Result<Vec<AuditSpec>>,
    {
        let (job, audit_specs) = {
            let mut jobs = self.jobs.write();
            let job = jobs
                .get_mut(&job_id)
                .ok_or_else(|| HarnessError::NotFound(format!("generation_job_id={job_id}")))?;
            let audit_specs = mutate(job)?;
            job.updated_at = Utc::now();
            let job = job.clone();
            drop(jobs);
            (job, audit_specs)
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

fn normalize_input_artifacts(artifacts: Option<Vec<Artifact>>) -> Vec<Artifact> {
    artifacts
        .unwrap_or_default()
        .into_iter()
        .map(|mut artifact| {
            artifact.status = ArtifactStatus::Input;
            artifact
        })
        .collect()
}

fn generated_artifact(job: &GenerationJob) -> Artifact {
    let kind = job.mode.output_kind();
    let id = Uuid::new_v4();
    Artifact {
        id,
        kind,
        status: generated_status(kind),
        object_uri: Some(format!("memory://generation/{}/{}", job.id, id)),
        file_reference: format!("generation://files/{id}"),
        schema_ref: schema_ref_for(kind).to_owned(),
        version: 1,
        hash: Some(format!("mock-{}-{id}", job.mode.skill_id())),
        metadata: json!({
            "mode": job.mode,
            "sourceJobId": job.id,
            "storage": "in_memory_stub",
            "modelCalls": 0,
            "generator": "mock_generator_v1",
            "evaluator": "mock_evaluator_v1"
        }),
    }
}

const fn generated_status(kind: ArtifactKind) -> ArtifactStatus {
    match kind {
        ArtifactKind::Cad
        | ArtifactKind::Bim
        | ArtifactKind::DigitalTwin
        | ArtifactKind::PointCloud => ArtifactStatus::Preview,
        _ => ArtifactStatus::Draft,
    }
}

fn set_generated_artifact_status(job: &mut GenerationJob, status: ArtifactStatus) {
    for artifact in &mut job.artifacts {
        if artifact.status != ArtifactStatus::Input {
            artifact.status = status;
        }
    }
    if let Some(output) = &mut job.output {
        for artifact in &mut output.artifacts {
            artifact.status = status;
        }
    }
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
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use serde_json::json;
    use uuid::Uuid;

    use crate::module_audit::{AuditEventKind, AuditEventQuery, ModuleAuditService};

    use super::{
        Artifact, ArtifactKind, ArtifactStatus, GenerationActionRequest, GenerationInput,
        GenerationJobQuery, GenerationJobStatus, GenerationMode, GenerationReviewDecision,
        GenerationReviewRequest, ModuleGenerationService,
    };

    fn service() -> (ModuleGenerationService, Arc<ModuleAuditService>) {
        let audit = Arc::new(ModuleAuditService::new());
        (ModuleGenerationService::new(Arc::clone(&audit)), audit)
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

    #[test]
    fn conversion_matrix_covers_required_modes() {
        assert_eq!(GenerationMode::ALL.len(), 29);
        assert!(GenerationMode::ALL.contains(&GenerationMode::TextToImage));
        assert!(GenerationMode::ALL.contains(&GenerationMode::TextToDigitalTwin));
        assert!(GenerationMode::ALL.contains(&GenerationMode::ImageToPdfDrawing));
        assert!(GenerationMode::ALL.contains(&GenerationMode::VideoToPointCloud));
        assert!(GenerationMode::ALL.contains(&GenerationMode::PdfDrawingToDigitalTwin));
        assert!(GenerationMode::ALL.contains(&GenerationMode::ModelToImage));
    }

    #[test]
    fn job_runs_through_review_and_approval() {
        let (service, audit) = service();
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
    fn input_artifacts_are_normalized_to_input_status() {
        let (service, _audit) = service();
        let mut req = input(GenerationMode::ModelToImage);
        req.input_artifacts = Some(vec![Artifact {
            id: Uuid::new_v4(),
            kind: ArtifactKind::Model,
            status: ArtifactStatus::Draft,
            object_uri: Some("memory://input/model".to_owned()),
            file_reference: "module-file://model".to_owned(),
            schema_ref: "artifact.ifc.schema.v1".to_owned(),
            version: 1,
            hash: None,
            metadata: json!({}),
        }]);
        let job = service.create_job(req).expect("job should be created");
        assert_eq!(job.artifacts[0].status, ArtifactStatus::Input);
    }

    #[test]
    fn rejects_unknown_module() {
        let (service, _audit) = service();
        let mut req = input(GenerationMode::TextToImage);
        req.module_id = "unknown".to_owned();
        assert!(service.create_job(req).is_err());
    }
}
