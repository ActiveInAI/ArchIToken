//! Harness engine capability registry.
//!
//! The backend treats geometry, data, display, render, and AI as first-class
//! engine contracts. Concrete adapters can evolve independently, but every
//! adapter must pass through the same Harness stages before it can mutate
//! project state or publish artifacts.

use serde::Serialize;
use utoipa::ToSchema;

use crate::{HarnessError, Result};

/// Required backend engine categories.
pub const REQUIRED_ENGINE_KINDS: [HarnessEngineKind; 5] = [
    HarnessEngineKind::Geometry,
    HarnessEngineKind::Data,
    HarnessEngineKind::Display,
    HarnessEngineKind::Render,
    HarnessEngineKind::Ai,
];

/// Required engineering file/media families.
pub const REQUIRED_FILE_FORMATS: [EngineeringFileFormat; 7] = [
    EngineeringFileFormat::Cad,
    EngineeringFileFormat::Bim,
    EngineeringFileFormat::Pdf,
    EngineeringFileFormat::Office,
    EngineeringFileFormat::Image,
    EngineeringFileFormat::Voice,
    EngineeringFileFormat::Video,
];

/// Required `BIM` information domains.
///
/// `BIM` is treated as a cross-engine information model. Geometry/CAD data is
/// one BIM domain, not the definition of BIM.
pub const REQUIRED_BIM_INFORMATION_DOMAINS: [BimInformationDomain; 17] = [
    BimInformationDomain::SpatialStructure,
    BimInformationDomain::ElementIdentity,
    BimInformationDomain::Geometry,
    BimInformationDomain::Properties,
    BimInformationDomain::Materials,
    BimInformationDomain::Systems,
    BimInformationDomain::Relationships,
    BimInformationDomain::Classifications,
    BimInformationDomain::ModelQuantityTakeoff,
    BimInformationDomain::Schedule4d,
    BimInformationDomain::Cost5d,
    BimInformationDomain::Documents,
    BimInformationDomain::Coordination,
    BimInformationDomain::IssueManagement,
    BimInformationDomain::GeospatialContext,
    BimInformationDomain::Operations,
    BimInformationDomain::ChangeHistory,
];

const REQUIRED_HARNESS_STAGES: [HarnessStage; 6] = [
    HarnessStage::Planner,
    HarnessStage::Generator,
    HarnessStage::Evaluator,
    HarnessStage::RuleChecker,
    HarnessStage::SchemaValidator,
    HarnessStage::Approver,
];

/// Backend engine category.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum HarnessEngineKind {
    /// CAD geometry and BIM geometric domains, topology, quantities, meshing, and clash boundaries.
    Geometry,
    /// Durable, indexed, queryable data and metadata engine.
    Data,
    /// Viewer command, scene manifest, layer, and inspectable display engine.
    Display,
    /// Server-side derivative, thumbnail, preview, waveform, and raster/vector render engine.
    Render,
    /// Model routing, tool planning, extraction, generation, and evaluation engine.
    Ai,
}

/// Required engineering input/output families.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum EngineeringFileFormat {
    /// CAD formats such as DWG, DXF, STEP, SAT, IGES, and NC-adjacent data.
    Cad,
    /// BIM information model exchanges such as IFC, IDS, BCF, `COBie`, model graphs, and manifests.
    Bim,
    /// PDF, PDF/A, drawing sheets, scanned contracts, and report packages.
    Pdf,
    /// Office documents, spreadsheets, slides, schedules, and tabular handover data.
    Office,
    /// Raster, photo, scan, panorama frame, diagram, and rendered image data.
    Image,
    /// Speech, voice notes, meeting audio, site radio capture, and waveform data.
    Voice,
    /// Video, drone capture, site inspection footage, timelapse, and rendered clips.
    Video,
}

/// `BIM` information domain covered by backend engines.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum BimInformationDomain {
    /// Site, project, building, storey, zone, room, and spatial containment structure.
    SpatialStructure,
    /// Stable model, element, type, assembly, and instance identity.
    ElementIdentity,
    /// Geometry, placement, topology, mesh, solids, surfaces, and bounding volumes.
    Geometry,
    /// Property sets, attributes, parameters, and semantic metadata.
    Properties,
    /// Materials, finishes, layers, specifications, and product data.
    Materials,
    /// MEP, structure, envelope, process, production, and discipline systems.
    Systems,
    /// Containment, aggregation, connection, dependency, and graph relationships.
    Relationships,
    /// Classification, codes, standards, taxonomy, naming, and package systems.
    Classifications,
    /// Model quantity takeoff, measurement rules, area, volume, count, and BOQ facts.
    ModelQuantityTakeoff,
    /// 4D schedule, sequencing, construction method, and progress linkage.
    #[serde(rename = "schedule_4d")]
    Schedule4d,
    /// 5D cost, estimate, budget, contract, and commercial linkage.
    #[serde(rename = "cost_5d")]
    Cost5d,
    /// Linked drawings, PDFs, office records, RFIs, submittals, photos, voice, and video.
    Documents,
    /// Coordination, clash, review, federation, approval, and issue evidence.
    Coordination,
    /// BCF-style issues, tasks, comments, assignees, status, and resolution history.
    IssueManagement,
    /// GIS, survey, coordinate reference system, location, and site context.
    GeospatialContext,
    /// Asset handover, operations, maintenance, inspection, `IoT`, and facility management.
    Operations,
    /// Revisions, versions, deltas, provenance, audit, and model change history.
    ChangeHistory,
}

/// Harness governance stage required around every engine adapter.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum HarnessStage {
    /// Plan the deterministic and AI-assisted operation.
    Planner,
    /// Produce draft output or conversion artifacts.
    Generator,
    /// Evaluate draft output with a separate actor or deterministic validator.
    Evaluator,
    /// Run business, safety, license, and mutation rules.
    RuleChecker,
    /// Validate `OpenAPI`, JSON Schema, IFC Schema, Module Schema, and artifact manifests.
    SchemaValidator,
    /// Require human or policy approval before durable publication.
    Approver,
}

/// Engine isolation adapter.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum EngineExecutionBoundary {
    /// Runs inside the Rust gateway/core process.
    InProcess,
    /// Runs as an isolated worker behind job and artifact contracts.
    IsolatedWorker,
    /// Runs through an explicit external adapter.
    ExternalAdapter,
}

/// Engine implementation maturity.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum EngineMaturity {
    /// Contract is defined and enforced; concrete adapters are still being wired.
    Contract,
    /// Preview implementation exists but is not production certified.
    Preview,
    /// Production route is enabled and covered by deployment evidence.
    ProductionReady,
}

/// One backend engine capability record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct HarnessEngineCapability {
    /// Engine category.
    pub kind: HarnessEngineKind,
    /// Stable internal engine id.
    pub engine_id: String,
    /// Human-readable engine name.
    pub display_name: String,
    /// File and media families accepted by this engine.
    pub formats: Vec<EngineeringFileFormat>,
    /// BIM information domains covered by this engine.
    pub bim_domains: Vec<BimInformationDomain>,
    /// Required Harness governance stages.
    pub harness_stages: Vec<HarnessStage>,
    /// Short responsibility statements.
    pub responsibilities: Vec<String>,
    /// Runtime isolation adapter.
    pub execution_boundary: EngineExecutionBoundary,
    /// Current maturity.
    pub maturity: EngineMaturity,
    /// Whether this capability may publish to production routes today.
    pub production_route_enabled: bool,
    /// Whether this engine is allowed to embed proprietary runtime libraries in core.
    pub proprietary_runtime_allowed: bool,
}

/// Aggregated engine contract coverage.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools)]
pub struct EngineCoverageReport {
    /// Required backend engine categories.
    pub required_engine_kinds: Vec<HarnessEngineKind>,
    /// Required engineering file/media families.
    pub required_formats: Vec<EngineeringFileFormat>,
    /// Engine categories currently present.
    pub present_engine_kinds: Vec<HarnessEngineKind>,
    /// File/media families covered by at least one engine.
    pub covered_formats: Vec<EngineeringFileFormat>,
    /// Required `BIM` information domains.
    pub required_bim_domains: Vec<BimInformationDomain>,
    /// `BIM` information domains covered by at least one engine.
    pub covered_bim_domains: Vec<BimInformationDomain>,
    /// Whether every required engine category is present.
    pub all_required_engines_present: bool,
    /// Whether every required file/media family is covered.
    pub all_required_formats_covered: bool,
    /// Whether every required `BIM` information domain is covered.
    pub all_required_bim_domains_covered: bool,
    /// Whether every engine goes through all required Harness stages.
    pub all_harness_stages_enforced: bool,
}

/// Return the canonical engine capability registry.
#[must_use]
#[allow(clippy::too_many_lines)]
pub fn list_harness_engines() -> Vec<HarnessEngineCapability> {
    vec![
        HarnessEngineCapability {
            kind: HarnessEngineKind::Geometry,
            engine_id: "architoken.geometry.engine".to_owned(),
            display_name: "Geometry Engine".to_owned(),
            formats: vec![
                EngineeringFileFormat::Cad,
                EngineeringFileFormat::Bim,
                EngineeringFileFormat::Image,
                EngineeringFileFormat::Video,
            ],
            bim_domains: vec![
                BimInformationDomain::SpatialStructure,
                BimInformationDomain::ElementIdentity,
                BimInformationDomain::Geometry,
                BimInformationDomain::Relationships,
                BimInformationDomain::ModelQuantityTakeoff,
                BimInformationDomain::Coordination,
                BimInformationDomain::GeospatialContext,
            ],
            harness_stages: required_harness_stages(),
            responsibilities: vec![
                "parse CAD geometry and BIM geometric domains without treating BIM as CAD"
                    .to_owned(),
                "derive topology, model quantity takeoff inputs, clash candidates, and geometric scene manifests".to_owned(),
                "keep proprietary CAD kernels outside core unless explicitly isolated".to_owned(),
            ],
            execution_boundary: EngineExecutionBoundary::IsolatedWorker,
            maturity: EngineMaturity::Contract,
            production_route_enabled: false,
            proprietary_runtime_allowed: false,
        },
        HarnessEngineCapability {
            kind: HarnessEngineKind::Data,
            engine_id: "architoken.data.engine".to_owned(),
            display_name: "Data Engine".to_owned(),
            formats: REQUIRED_FILE_FORMATS.to_vec(),
            bim_domains: required_bim_domains(),
            harness_stages: required_harness_stages(),
            responsibilities: vec![
                "bind BIM semantics, objects, relationships, documents, audit, vectors, graph, and timeseries".to_owned(),
                "enforce tenant/project scope before indexing or retrieval".to_owned(),
                "produce deterministic manifests for downstream engines".to_owned(),
            ],
            execution_boundary: EngineExecutionBoundary::InProcess,
            maturity: EngineMaturity::Preview,
            production_route_enabled: false,
            proprietary_runtime_allowed: false,
        },
        HarnessEngineCapability {
            kind: HarnessEngineKind::Display,
            engine_id: "architoken.display.engine".to_owned(),
            display_name: "Display Engine".to_owned(),
            formats: REQUIRED_FILE_FORMATS.to_vec(),
            bim_domains: vec![
                BimInformationDomain::SpatialStructure,
                BimInformationDomain::ElementIdentity,
                BimInformationDomain::Geometry,
                BimInformationDomain::Properties,
                BimInformationDomain::Systems,
                BimInformationDomain::Relationships,
                BimInformationDomain::Classifications,
                BimInformationDomain::Documents,
                BimInformationDomain::Coordination,
                BimInformationDomain::IssueManagement,
                BimInformationDomain::GeospatialContext,
                BimInformationDomain::ChangeHistory,
            ],
            harness_stages: required_harness_stages(),
            responsibilities: vec![
                "translate artifacts into auditable viewer command and layer contracts".to_owned(),
                "separate viewer intent from client-specific rendering implementation".to_owned(),
                "serve inspectable scene, document, media, and evidence manifests".to_owned(),
            ],
            execution_boundary: EngineExecutionBoundary::InProcess,
            maturity: EngineMaturity::Preview,
            production_route_enabled: false,
            proprietary_runtime_allowed: false,
        },
        HarnessEngineCapability {
            kind: HarnessEngineKind::Render,
            engine_id: "architoken.render.engine".to_owned(),
            display_name: "Render Engine".to_owned(),
            formats: REQUIRED_FILE_FORMATS.to_vec(),
            bim_domains: vec![
                BimInformationDomain::SpatialStructure,
                BimInformationDomain::ElementIdentity,
                BimInformationDomain::Geometry,
                BimInformationDomain::Properties,
                BimInformationDomain::Documents,
                BimInformationDomain::Coordination,
                BimInformationDomain::IssueManagement,
                BimInformationDomain::GeospatialContext,
                BimInformationDomain::ChangeHistory,
            ],
            harness_stages: required_harness_stages(),
            responsibilities: vec![
                "produce thumbnails, previews, sheets, waveforms, spectrograms, frames, and derivatives"
                    .to_owned(),
                "prepare WebGPU/Three.js compatible render payloads without coupling to frontend"
                    .to_owned(),
                "route heavy rasterization and transcoding through worker contracts".to_owned(),
            ],
            execution_boundary: EngineExecutionBoundary::IsolatedWorker,
            maturity: EngineMaturity::Contract,
            production_route_enabled: false,
            proprietary_runtime_allowed: false,
        },
        HarnessEngineCapability {
            kind: HarnessEngineKind::Ai,
            engine_id: "architoken.ai.engine".to_owned(),
            display_name: "AI Engine".to_owned(),
            formats: REQUIRED_FILE_FORMATS.to_vec(),
            bim_domains: required_bim_domains(),
            harness_stages: required_harness_stages(),
            responsibilities: vec![
                "route model calls through InferenceRouter and approved provider adapters".to_owned(),
                "generate, extract, classify, summarize, and evaluate BIM information domains"
                    .to_owned(),
                "keep planner, generator, evaluator, rule checker, validator, and approver separated"
                    .to_owned(),
            ],
            execution_boundary: EngineExecutionBoundary::ExternalAdapter,
            maturity: EngineMaturity::Preview,
            production_route_enabled: false,
            proprietary_runtime_allowed: false,
        },
    ]
}

/// Build the current engine coverage report.
#[must_use]
pub fn engine_coverage_report() -> EngineCoverageReport {
    let engines = list_harness_engines();
    let present_engine_kinds = collect_engine_kinds(&engines);
    let covered_formats = collect_formats(&engines);
    let covered_bim_domains = collect_bim_domains(&engines);
    EngineCoverageReport {
        required_engine_kinds: REQUIRED_ENGINE_KINDS.to_vec(),
        required_formats: REQUIRED_FILE_FORMATS.to_vec(),
        present_engine_kinds: present_engine_kinds.clone(),
        covered_formats: covered_formats.clone(),
        required_bim_domains: REQUIRED_BIM_INFORMATION_DOMAINS.to_vec(),
        covered_bim_domains: covered_bim_domains.clone(),
        all_required_engines_present: REQUIRED_ENGINE_KINDS
            .iter()
            .all(|kind| present_engine_kinds.contains(kind)),
        all_required_formats_covered: REQUIRED_FILE_FORMATS
            .iter()
            .all(|format| covered_formats.contains(format)),
        all_required_bim_domains_covered: REQUIRED_BIM_INFORMATION_DOMAINS
            .iter()
            .all(|domain| covered_bim_domains.contains(domain)),
        all_harness_stages_enforced: engines
            .iter()
            .all(|engine| engine.harness_stages == required_harness_stages()),
    }
}

/// Validate engine contract invariants during gateway startup.
///
/// # Errors
/// Returns an internal error when a required engine, required file family, or
/// Harness governance stage is missing.
pub fn verify_harness_engine_contract() -> Result<()> {
    let report = engine_coverage_report();
    if !report.all_required_engines_present {
        return Err(HarnessError::Internal(
            "Harness engine contract missing a required engine kind".to_owned(),
        ));
    }
    if !report.all_required_formats_covered {
        return Err(HarnessError::Internal(
            "Harness engine contract missing a required file/media format".to_owned(),
        ));
    }
    if !report.all_required_bim_domains_covered {
        return Err(HarnessError::Internal(
            "Harness engine contract missing a required BIM information domain".to_owned(),
        ));
    }
    if !report.all_harness_stages_enforced {
        return Err(HarnessError::Internal(
            "Harness engine contract missing required governance stages".to_owned(),
        ));
    }
    Ok(())
}

fn required_bim_domains() -> Vec<BimInformationDomain> {
    REQUIRED_BIM_INFORMATION_DOMAINS.to_vec()
}

fn required_harness_stages() -> Vec<HarnessStage> {
    REQUIRED_HARNESS_STAGES.to_vec()
}

fn collect_engine_kinds(engines: &[HarnessEngineCapability]) -> Vec<HarnessEngineKind> {
    let mut values = Vec::new();
    for engine in engines {
        if !values.contains(&engine.kind) {
            values.push(engine.kind);
        }
    }
    values
}

fn collect_formats(engines: &[HarnessEngineCapability]) -> Vec<EngineeringFileFormat> {
    let mut values = Vec::new();
    for format in engines.iter().flat_map(|engine| &engine.formats) {
        if !values.contains(format) {
            values.push(*format);
        }
    }
    values
}

fn collect_bim_domains(engines: &[HarnessEngineCapability]) -> Vec<BimInformationDomain> {
    let mut values = Vec::new();
    for domain in engines.iter().flat_map(|engine| &engine.bim_domains) {
        if !values.contains(domain) {
            values.push(*domain);
        }
    }
    values
}

#[cfg(test)]
mod tests {
    use super::{
        BimInformationDomain, EngineeringFileFormat, HarnessEngineKind,
        REQUIRED_BIM_INFORMATION_DOMAINS, REQUIRED_ENGINE_KINDS, REQUIRED_FILE_FORMATS,
        engine_coverage_report, list_harness_engines, verify_harness_engine_contract,
    };

    #[test]
    fn registry_declares_the_five_required_engine_categories() {
        let report = engine_coverage_report();
        assert_eq!(report.required_engine_kinds, REQUIRED_ENGINE_KINDS);
        assert!(report.all_required_engines_present);
        assert!(
            report
                .present_engine_kinds
                .contains(&HarnessEngineKind::Geometry)
        );
        assert!(report.present_engine_kinds.contains(&HarnessEngineKind::Ai));
    }

    #[test]
    fn registry_covers_all_required_file_and_media_families() {
        let report = engine_coverage_report();
        assert_eq!(report.required_formats, REQUIRED_FILE_FORMATS);
        assert!(report.all_required_formats_covered);
        assert!(report.covered_formats.contains(&EngineeringFileFormat::Cad));
        assert!(report.covered_formats.contains(&EngineeringFileFormat::Bim));
        assert!(
            report
                .covered_formats
                .contains(&EngineeringFileFormat::Voice)
        );
        assert!(
            report
                .covered_formats
                .contains(&EngineeringFileFormat::Video)
        );
    }

    #[test]
    fn registry_models_bim_as_cross_engine_information_model() {
        let report = engine_coverage_report();
        assert_eq!(
            report.required_bim_domains,
            REQUIRED_BIM_INFORMATION_DOMAINS
        );
        assert!(report.all_required_bim_domains_covered);
        assert!(
            report
                .covered_bim_domains
                .contains(&BimInformationDomain::Schedule4d)
        );
        assert!(
            report
                .covered_bim_domains
                .contains(&BimInformationDomain::Cost5d)
        );
        assert!(
            report
                .covered_bim_domains
                .contains(&BimInformationDomain::Operations)
        );

        let engines = list_harness_engines();
        let geometry_engine = engines
            .iter()
            .find(|engine| engine.kind == HarnessEngineKind::Geometry)
            .expect("geometry engine must be present");
        assert!(
            geometry_engine
                .bim_domains
                .contains(&BimInformationDomain::Geometry)
        );
        assert!(
            !geometry_engine
                .bim_domains
                .contains(&BimInformationDomain::Cost5d)
        );

        let data_engine = engines
            .iter()
            .find(|engine| engine.kind == HarnessEngineKind::Data)
            .expect("data engine must be present");
        assert_eq!(
            data_engine.bim_domains,
            REQUIRED_BIM_INFORMATION_DOMAINS.to_vec()
        );
    }

    #[test]
    fn every_engine_uses_strict_harness_governance() {
        let report = engine_coverage_report();
        assert!(report.all_harness_stages_enforced);
        for engine in list_harness_engines() {
            assert_eq!(engine.harness_stages.len(), 6);
            assert!(!engine.proprietary_runtime_allowed);
            assert!(!engine.production_route_enabled);
        }
    }

    #[test]
    fn startup_contract_validation_passes_for_canonical_registry() {
        verify_harness_engine_contract().expect("engine contract must validate");
    }
}
