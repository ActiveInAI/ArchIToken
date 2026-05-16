//! Open CDE capability contracts.
//!
//! This module is the runtime contract for the `ArchIToken` CDE plane. It keeps
//! ISO 19650 information states, buildingSMART/openBIM standards, Speckle object
//! graph sync, and enterprise ecosystem adapters visible as auditable product
//! capabilities instead of burying them in UI copy.

use serde::Serialize;

/// ISO 19650 CDE information container state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CdeInformationState {
    /// Internal authoring and task-team work.
    WorkInProgress,
    /// Shared information suitable for project-team coordination.
    Shared,
    /// Contracted or authorized published information.
    Published,
    /// Immutable archive and evidence record.
    Archive,
}

/// Standard or ecosystem family represented in the CDE contract matrix.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CdeStandardFamily {
    /// ISO 19650 information management and CDE governance.
    InformationManagement,
    /// buildingSMART IFC semantic model and schema family.
    SemanticModel,
    /// Exchange requirements and model view definitions.
    InformationRequirement,
    /// Issue coordination and topic exchange.
    IssueCoordination,
    /// Classification and data dictionary semantics.
    Classification,
    /// Asset handover and operational data.
    Handover,
    /// API-based CDE and model synchronization.
    ApiAndSync,
    /// Enterprise AEC commercial-system interoperability.
    EnterpriseInterop,
}

/// Runtime execution maturity for a CDE contract.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CdeExecutionStatus {
    /// Enforced directly by gateway/runtime code today.
    Enforced,
    /// Adapter or worker route exists, and may require external configuration.
    AdapterReady,
    /// Enterprise licensed API/service boundary is required.
    ExternalServiceRequired,
    /// Tracked as a standard reference, but not asserted as executable support.
    ReferenceOnly,
}

/// One standards contract in the CDE matrix.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CdeStandardContract {
    /// Stable contract id.
    pub id: String,
    /// Human-readable standard or specification name.
    pub name: String,
    /// Contract family.
    pub family: CdeStandardFamily,
    /// Normative or ecosystem basis.
    pub basis: String,
    /// Runtime maturity.
    pub status: CdeExecutionStatus,
    /// Controls the product must expose for this contract to count.
    pub controls: Vec<String>,
}

/// External ecosystem adapter contract.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CdeExternalAdapterContract {
    /// Stable adapter id.
    pub id: String,
    /// Product/ecosystem name.
    pub name: String,
    /// Runtime boundary.
    pub boundary: String,
    /// Primary role in the CDE.
    pub role: String,
    /// Supported CDE routes.
    pub routes: Vec<String>,
    /// Production rule for licensing and runtime safety.
    pub production_rule: String,
}

/// Full CDE capability matrix returned to clients.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools)]
pub struct CdeCapabilities {
    /// Supported ISO 19650 information states.
    pub information_states: Vec<CdeInformationState>,
    /// Standard contracts represented in the runtime.
    pub standard_contracts: Vec<CdeStandardContract>,
    /// External system adapter contracts.
    pub external_adapters: Vec<CdeExternalAdapterContract>,
    /// Mandatory controls for every CDE information container.
    pub mandatory_container_controls: Vec<String>,
    /// Whether the buildingSMART/openBIM standard surface is completely represented.
    pub complete_open_bim_standard_coverage: bool,
    /// Whether the active deployment has certified every openBIM runtime dependency with real evidence.
    pub production_certified_open_bim_runtime: bool,
    /// Runtime blockers that prevent claiming production buildingSMART/openBIM certification.
    pub open_bim_certification_blockers: Vec<String>,
    /// Whether Speckle object graph sync is represented as a first-class route.
    pub speckle_object_graph_ready: bool,
    /// Whether Chinese enterprise ecosystem adapters are represented as gated routes.
    pub china_enterprise_interop_ready: bool,
}

/// Return the runtime CDE capability matrix.
#[must_use]
pub fn cde_capabilities() -> CdeCapabilities {
    let standard_contracts = cde_standard_contracts();
    let external_adapters = cde_external_adapters();
    CdeCapabilities {
        information_states: vec![
            CdeInformationState::WorkInProgress,
            CdeInformationState::Shared,
            CdeInformationState::Published,
            CdeInformationState::Archive,
        ],
        standard_contracts,
        external_adapters,
        mandatory_container_controls: strings([
            "tenant_project_scope",
            "container_id",
            "revision",
            "status_code",
            "suitability_code",
            "approval_gate",
            "checksum",
            "object_store_binding",
            "audit_event",
            "retention_policy",
        ]),
        complete_open_bim_standard_coverage: true,
        production_certified_open_bim_runtime: false,
        open_bim_certification_blockers: strings([
            "IFCDB-Agent v1.0.9 sidecar must pass health/index/query/export/clash/quantity smoke evidence.",
            "buildingSMART Validate service or CLI must be configured and executed for production certification.",
            "IDS validation requires ifctester plus project IDS files; missing IDS cannot be treated as pass.",
            "BCF support must include API workflow evidence, not only BCFZIP package ingestion.",
            "bSDD enrichment must bind real IFC elements/properties to versioned dictionary references.",
        ]),
        speckle_object_graph_ready: true,
        china_enterprise_interop_ready: true,
    }
}

fn cde_standard_contracts() -> Vec<CdeStandardContract> {
    let mut contracts = cde_governance_standard_contracts();
    contracts.extend(cde_collaboration_standard_contracts());
    contracts
}

fn cde_governance_standard_contracts() -> Vec<CdeStandardContract> {
    vec![
        standard(
            "iso_19650",
            "ISO 19650 information management CDE",
            CdeStandardFamily::InformationManagement,
            "ISO 19650-1/2/3/4 information states, status codes, approval and audit process",
            CdeExecutionStatus::Enforced,
            [
                "wip_shared_published_archive",
                "approval_transition",
                "revision_status_suitability",
                "immutable_archive",
            ],
        ),
        standard(
            "ifc",
            "Industry Foundation Classes",
            CdeStandardFamily::SemanticModel,
            "buildingSMART IFC schema family: IFC2x3, IFC4, IFC4.3, IFC5 tracked as reference",
            CdeExecutionStatus::Enforced,
            [
                "ifc_schema_detection",
                "ifc_guid_namespace",
                "element_property_quantity_extraction",
                "viewer_manifest",
            ],
        ),
        standard(
            "idm",
            "Information Delivery Manual",
            CdeStandardFamily::InformationRequirement,
            "buildingSMART IDM / ISO 29481 process and exchange requirement modelling",
            CdeExecutionStatus::AdapterReady,
            [
                "exchange_requirement_manifest",
                "actor_milestone_mapping",
                "deliverable_requirement_trace",
            ],
        ),
        standard(
            "mvd",
            "Model View Definition",
            CdeStandardFamily::InformationRequirement,
            "buildingSMART MVD / view requirement profile aligned to IFC exchange purpose",
            CdeExecutionStatus::ReferenceOnly,
            [
                "view_requirement_profile",
                "exchange_purpose_mapping",
                "ids_supersedes_many_checks",
            ],
        ),
        standard(
            "ids",
            "Information Delivery Specification",
            CdeStandardFamily::InformationRequirement,
            "buildingSMART IDS machine-checkable IFC information requirements",
            CdeExecutionStatus::AdapterReady,
            [
                "ids_file_registration",
                "ifc_requirement_validation",
                "audit_report_artifact",
            ],
        ),
    ]
}

fn cde_collaboration_standard_contracts() -> Vec<CdeStandardContract> {
    vec![
        standard(
            "bcf",
            "BIM Collaboration Format",
            CdeStandardFamily::IssueCoordination,
            "buildingSMART BCF XML/API issue, viewpoint, topic and comment exchange",
            CdeExecutionStatus::AdapterReady,
            [
                "topic_comment_viewpoint_ingest",
                "issue_status_mapping",
                "model_element_reference",
            ],
        ),
        standard(
            "bsdd",
            "buildingSMART Data Dictionary",
            CdeStandardFamily::Classification,
            "buildingSMART bSDD classification and property dictionary service",
            CdeExecutionStatus::AdapterReady,
            [
                "classification_lookup",
                "property_dictionary_reference",
                "ids_bsdd_alignment",
            ],
        ),
        standard(
            "cobie",
            "COBie handover dataset",
            CdeStandardFamily::Handover,
            "Construction Operations Building information exchange handover data",
            CdeExecutionStatus::AdapterReady,
            [
                "asset_space_system_handover",
                "spreadsheet_import_export",
                "digital_archive_binding",
            ],
        ),
        standard(
            "opencde_api",
            "buildingSMART OpenCDE API",
            CdeStandardFamily::ApiAndSync,
            "OpenCDE-style issue/document/model API contract reference",
            CdeExecutionStatus::ReferenceOnly,
            [
                "cde_api_contract_reference",
                "bcf_api_alignment",
                "document_model_issue_links",
            ],
        ),
        standard(
            "buildingsmart_validate",
            "buildingSMART Validate",
            CdeStandardFamily::SemanticModel,
            "buildingSMART validation service/CLI pattern plus local IFC checks",
            CdeExecutionStatus::AdapterReady,
            [
                "ifc_syntax_schema_validation",
                "external_validator_report",
                "non_synthetic_pass_rule",
            ],
        ),
    ]
}

fn cde_external_adapters() -> Vec<CdeExternalAdapterContract> {
    vec![
        adapter(
            "ifcdb_agent",
            "IFCDB-Agent",
            "sidecar_service",
            "IFC database, object graph, SQL/natural-language query, export, clash and quantity route",
            [
                "ifcdb_index",
                "ifcdb_query",
                "ifcdb_export",
                "ifcdb_clash",
                "ifcdb_quantity",
                "bsdd_constrained_agent_query",
            ],
            "Run DeeJoin/IFCDB-Agent v1.0.9 as an isolated configured service; the gateway never links installer/runtime code into core.",
        ),
        adapter(
            "speckle",
            "Speckle",
            "sidecar_service",
            "Open AEC object graph, model version and connector sync route",
            [
                "object_graph_send",
                "project_model_version_mapping",
                "connector_metadata_sync",
                "automate_qaqc_webhook",
            ],
            "Use configured Speckle Server/API and token; do not vendor Speckle Server into gateway core.",
        ),
        adapter(
            "glodon",
            "Glodon / 广联达",
            "licensed_service",
            "Cost, BIM5D, schedule, procurement and construction evidence exchange",
            [
                "boq_import_export",
                "bim5d_progress_cost_sync",
                "contract_change_evidence",
                "archive_attachment_sync",
            ],
            "Integrate through licensed customer API/export files only; no proprietary format reverse engineering in core.",
        ),
        adapter(
            "pkpm_gouli",
            "PKPM / 北京构力",
            "licensed_service",
            "Structural analysis, code-check and review-evidence exchange",
            [
                "analysis_result_import",
                "member_check_evidence",
                "calculation_book_archive",
                "ifc_element_result_mapping",
            ],
            "Keep structural solvers outside gateway; import signed result/evidence packages through licensed adapters.",
        ),
        adapter(
            "autodesk_acc_revit",
            "Autodesk ACC / Revit",
            "licensed_service",
            "Authoring and document-management interoperability",
            [
                "ifc_export_ingest",
                "document_reference_sync",
                "issue_reference_sync",
                "rvt_metadata_bridge",
            ],
            "Prefer IFC/BCF/OpenCDE routes; use Autodesk APIs only with explicit tenant credentials.",
        ),
        adapter(
            "tekla_trimble",
            "Tekla / Trimble Connect",
            "licensed_service",
            "Steel detailing, fabrication and model coordination interoperability",
            [
                "ifc4x3_steel_ingest",
                "fabrication_bom_sync",
                "bcf_issue_exchange",
                "manufacturing_package_archive",
            ],
            "Respect Tekla/Trimble as the detailing system of record; CDE stores evidence, versions and approvals.",
        ),
    ]
}

fn standard(
    id: &str,
    name: &str,
    family: CdeStandardFamily,
    basis: &str,
    status: CdeExecutionStatus,
    controls: impl IntoIterator<Item = &'static str>,
) -> CdeStandardContract {
    CdeStandardContract {
        id: id.to_owned(),
        name: name.to_owned(),
        family,
        basis: basis.to_owned(),
        status,
        controls: controls.into_iter().map(str::to_owned).collect(),
    }
}

fn adapter(
    id: &str,
    name: &str,
    boundary: &str,
    role: &str,
    routes: impl IntoIterator<Item = &'static str>,
    production_rule: &str,
) -> CdeExternalAdapterContract {
    CdeExternalAdapterContract {
        id: id.to_owned(),
        name: name.to_owned(),
        boundary: boundary.to_owned(),
        role: role.to_owned(),
        routes: routes.into_iter().map(str::to_owned).collect(),
        production_rule: production_rule.to_owned(),
    }
}

fn strings(values: impl IntoIterator<Item = &'static str>) -> Vec<String> {
    values.into_iter().map(str::to_owned).collect()
}

#[cfg(test)]
mod tests {
    use super::{CdeExecutionStatus, CdeInformationState, cde_capabilities};

    #[test]
    fn cde_matrix_covers_iso_19650_states_and_openbim_standards() {
        let capabilities = cde_capabilities();
        assert_eq!(
            capabilities.information_states,
            vec![
                CdeInformationState::WorkInProgress,
                CdeInformationState::Shared,
                CdeInformationState::Published,
                CdeInformationState::Archive,
            ]
        );
        for required in [
            "iso_19650",
            "ifc",
            "idm",
            "mvd",
            "ids",
            "bcf",
            "bsdd",
            "cobie",
            "opencde_api",
            "buildingsmart_validate",
        ] {
            assert!(
                capabilities
                    .standard_contracts
                    .iter()
                    .any(|standard| standard.id == required),
                "missing CDE standard contract {required}"
            );
        }
        assert!(capabilities.complete_open_bim_standard_coverage);
        assert!(!capabilities.production_certified_open_bim_runtime);
        assert!(
            capabilities
                .open_bim_certification_blockers
                .iter()
                .any(|blocker| blocker.contains("IFCDB-Agent v1.0.9"))
        );
        assert!(
            capabilities
                .mandatory_container_controls
                .contains(&"approval_gate".to_owned())
        );
    }

    #[test]
    fn cde_matrix_models_speckle_and_chinese_enterprise_boundaries() {
        let capabilities = cde_capabilities();
        assert!(capabilities.speckle_object_graph_ready);
        assert!(capabilities.china_enterprise_interop_ready);
        let adapter_ids = capabilities
            .external_adapters
            .iter()
            .map(|adapter| adapter.id.as_str())
            .collect::<Vec<_>>();
        assert!(adapter_ids.contains(&"ifcdb_agent"));
        assert!(adapter_ids.contains(&"speckle"));
        assert!(adapter_ids.contains(&"glodon"));
        assert!(adapter_ids.contains(&"pkpm_gouli"));
        let glodon = capabilities
            .external_adapters
            .iter()
            .find(|adapter| adapter.id == "glodon")
            .expect("glodon adapter contract");
        assert_eq!(glodon.boundary, "licensed_service");
        assert!(
            capabilities
                .standard_contracts
                .iter()
                .any(|standard| standard.status == CdeExecutionStatus::ReferenceOnly)
        );
    }
}
