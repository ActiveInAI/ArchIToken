//! Runtime capability discovery for gateway clients.
//!
//! The endpoint lets frontend and third-party callers discover the active
//! contract surface without hardcoding generation modes, artifact formats, or
//! registry availability.

use serde::Serialize;

use crate::{
    asset_registry::{AssetKind, ConversionOperation},
    cde::{CdeCapabilities, cde_capabilities},
    db::RuntimePersistenceMode,
    harness_engines::{
        BimInformationDomain, EngineeringFileFormat, HarnessEngineCapability, HarnessEngineKind,
        engine_coverage_report, list_harness_engines,
    },
    module_generation::{ArtifactKind, GenerationMode},
    module_registry::list_modules,
    openbim::{OpenBimStandard, SourceAuthoringTool},
    storage_router::{ArtifactStatus, GeometryFormat, PropertyIndexFormat, ViewerAdapterHint},
    viewer_adapter::ViewerCommandKind,
};

/// Full runtime capability response returned by `GET /v1/runtime/capabilities`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeCapabilities {
    /// Active module ids available in this runtime.
    pub active_module_ids: Vec<String>,
    /// Generation runtime capabilities.
    pub generation: RuntimeGenerationCapabilities,
    /// Backend Harness engine capabilities.
    pub engines: RuntimeHarnessEngineCapabilities,
    /// buildingSMART openBIM capabilities.
    pub open_bim: RuntimeOpenBimCapabilities,
    /// Open CDE, Speckle, and enterprise interoperability capabilities.
    pub cde: CdeCapabilities,
    /// Universal file workbench capabilities.
    pub file_workbench: RuntimeFileWorkbenchCapabilities,
    /// Viewer adapter and command capabilities.
    pub viewer: RuntimeViewerCapabilities,
    /// Registry availability.
    pub registry: RuntimeRegistryCapabilities,
    /// Storage adapter availability.
    pub storage: RuntimeStorageCapabilities,
    /// Durable store adapter availability.
    pub store_capabilities: RuntimeStoreCapabilities,
    /// Local implementation mode.
    pub local_implementation_mode: String,
    /// Production caveats clients should show in developer consoles.
    pub production_caveats: Vec<String>,
}

/// Registry capability flags.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeRegistryCapabilities {
    /// Whether Skill Registry endpoints are available.
    pub skills: bool,
    /// Whether MCP Tool Registry endpoints are available.
    pub mcp_tools: bool,
    /// Whether Knowledge Source Registry endpoints are available.
    pub knowledge_sources: bool,
}

/// Backend Harness engine capability matrix.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeHarnessEngineCapabilities {
    /// Required backend engine categories.
    pub engine_kinds: Vec<HarnessEngineKind>,
    /// Required engineering file/media families.
    pub required_formats: Vec<EngineeringFileFormat>,
    /// Required BIM information domains.
    pub required_bim_domains: Vec<BimInformationDomain>,
    /// BIM information domains covered by at least one backend engine.
    pub covered_bim_domains: Vec<BimInformationDomain>,
    /// Detailed capability records for each backend engine.
    pub capabilities: Vec<HarnessEngineCapability>,
    /// Whether every required file/media family is covered.
    pub all_required_formats_covered: bool,
    /// Whether every required BIM information domain is covered.
    pub all_required_bim_domains_covered: bool,
    /// Whether every engine enforces the complete Harness governance sequence.
    pub all_harness_stages_enforced: bool,
}

/// buildingSMART openBIM runtime capabilities.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeOpenBimCapabilities {
    /// buildingSMART standards treated as first-class contracts.
    pub standards: Vec<OpenBimStandard>,
    /// Source authoring workflows accepted as metadata for IFC ingest.
    pub source_authoring_tools: Vec<SourceAuthoringTool>,
    /// Current first-delivery backend features.
    pub first_delivery_features: Vec<String>,
    /// Whether direct BIM model viewing is enabled.
    pub model_view_enabled: bool,
    /// Whether heavy-steel component BOM export is enabled.
    pub steel_bom_export_enabled: bool,
    /// Whether text-to-BIM generation is part of the current delivery path.
    pub text_to_bim_currently_deferred: bool,
}

/// Universal file workbench runtime capabilities.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeFileWorkbenchCapabilities {
    /// File families that can be listed, opened, and displayed by the workbench contract.
    pub view_families: Vec<String>,
    /// Mutating file operations exposed by backend file APIs.
    pub edit_operations: Vec<String>,
    /// Whether heavy binary formats require converter/editor adapters for semantic edits.
    pub binary_semantic_edit_requires_adapter: bool,
}

/// Storage capability flags for the current runtime.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStorageCapabilities {
    /// Storage provider ids available in this runtime.
    pub providers: Vec<String>,
    /// Whether this runtime persists real artifact bytes.
    pub persists_real_bytes: bool,
    /// Whether this runtime is safe for production storage.
    pub production_ready: bool,
    /// Whether S3-compatible object binding contracts are available.
    pub s3_object_bindings: bool,
}

/// Durable store adapter flags for the current runtime.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools)]
pub struct RuntimeStoreCapabilities {
    /// `ObjectStore` adapter is present.
    pub object_store: bool,
    /// `TransactionStore` adapter is present.
    pub transaction_store: bool,
    /// `EventStore` adapter is present.
    pub event_store: bool,
    /// `RegistryStore` adapter is present.
    pub registry_store: bool,
    /// `ArtifactStore` adapter is present.
    pub artifact_store: bool,
    /// `ViewerCommandStore` adapter is present.
    pub viewer_command_store: bool,
    /// `KnowledgeSourceStore` adapter is present.
    pub knowledge_source_store: bool,
    /// Whether current adapters are in-memory only.
    pub in_memory_only: bool,
    /// Whether development may use memory when `DATABASE_URL` is absent.
    pub in_memory_fallback_allowed: bool,
    /// Whether a `PostgreSQL` durable store adapter is configured.
    pub postgres: bool,
    /// Whether `SeaORM` migration contracts are present.
    pub sea_orm_migrations: bool,
    /// Whether `SeaweedFS` S3 object-store adapter is present.
    pub seaweedfs_s3: bool,
    /// Whether list APIs use deterministic ordering before pagination.
    pub deterministic_pagination: bool,
}

/// Viewer capability hints.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeViewerCapabilities {
    /// Viewer adapter hints exposed to clients.
    pub adapter_hints: Vec<ViewerAdapterHint>,
    /// Auditable viewer command kinds accepted by the backend.
    pub command_kinds: Vec<ViewerCommandKind>,
    /// Candidate-only adapter hints that must not become production routes.
    pub candidate_only_adapter_hints: Vec<ViewerAdapterHint>,
}

/// Generation capability matrix.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeGenerationCapabilities {
    /// Supported generation and conversion modes.
    pub modes: Vec<GenerationMode>,
    /// Supported artifact kinds.
    pub artifact_kinds: Vec<ArtifactKind>,
    /// Supported artifact statuses.
    pub artifact_statuses: Vec<ArtifactStatus>,
    /// Supported open and candidate geometry formats.
    pub geometry_formats: Vec<GeometryFormat>,
    /// Supported open and candidate property index formats.
    pub property_index_formats: Vec<PropertyIndexFormat>,
    /// Supported Phase 7 asset kinds.
    pub asset_kinds_phase7: Vec<AssetKind>,
    /// Supported Phase 7 conversion operations.
    pub conversion_operations: Vec<ConversionOperation>,
}

impl RuntimeCapabilities {
    /// Build runtime capabilities for the selected persistence mode.
    #[must_use]
    #[allow(clippy::too_many_lines)]
    pub fn for_persistence_mode(mode: RuntimePersistenceMode) -> Self {
        let in_memory = matches!(mode, RuntimePersistenceMode::InMemoryFallback);
        let s3_configured = s3_object_store_configured();
        let text_to_bim_configured = text_to_bim_provider_configured();
        let engine_coverage = engine_coverage_report();
        Self {
            active_module_ids: list_modules()
                .into_iter()
                .map(|module| module.id.to_string())
                .collect(),
            generation: RuntimeGenerationCapabilities {
                modes: GenerationMode::ALL.to_vec(),
                artifact_kinds: ArtifactKind::ALL.to_vec(),
                artifact_statuses: ArtifactStatus::ALL.to_vec(),
                geometry_formats: GeometryFormat::ALL.to_vec(),
                property_index_formats: PropertyIndexFormat::ALL.to_vec(),
                asset_kinds_phase7: AssetKind::ALL.to_vec(),
                conversion_operations: ConversionOperation::ALL.to_vec(),
            },
            engines: RuntimeHarnessEngineCapabilities {
                engine_kinds: engine_coverage.present_engine_kinds,
                required_formats: engine_coverage.required_formats,
                required_bim_domains: engine_coverage.required_bim_domains,
                covered_bim_domains: engine_coverage.covered_bim_domains,
                capabilities: list_harness_engines(),
                all_required_formats_covered: engine_coverage.all_required_formats_covered,
                all_required_bim_domains_covered: engine_coverage
                    .all_required_bim_domains_covered,
                all_harness_stages_enforced: engine_coverage.all_harness_stages_enforced,
            },
            open_bim: RuntimeOpenBimCapabilities {
                standards: vec![
                    OpenBimStandard::Ifc,
                    OpenBimStandard::Ifc2x3,
                    OpenBimStandard::Ifc4,
                    OpenBimStandard::Ifc4x3,
                    OpenBimStandard::Idm,
                    OpenBimStandard::Mvd,
                    OpenBimStandard::Bsdd,
                    OpenBimStandard::Bcf,
                    OpenBimStandard::Ids,
                    OpenBimStandard::Validate,
                    OpenBimStandard::Cobie,
                    OpenBimStandard::OpenCdeApi,
                ],
                source_authoring_tools: vec![
                    SourceAuthoringTool::Cad,
                    SourceAuthoringTool::TeklaStructures,
                    SourceAuthoringTool::Revit,
                    SourceAuthoringTool::Rhino,
                    SourceAuthoringTool::SketchUp,
                    SourceAuthoringTool::SolidWorks,
                    SourceAuthoringTool::Unknown,
                ],
                first_delivery_features: vec![
                    "bim_model_view".to_owned(),
                    "heavy_steel_component_bom_export".to_owned(),
                    "openbim_ifc_ingest".to_owned(),
                    "viewer_manifest".to_owned(),
                ],
                model_view_enabled: true,
                steel_bom_export_enabled: true,
                text_to_bim_currently_deferred: !text_to_bim_configured,
            },
            cde: cde_capabilities(),
            file_workbench: RuntimeFileWorkbenchCapabilities {
                view_families: vec![
                    "cad".to_owned(),
                    "bim".to_owned(),
                    "pdf".to_owned(),
                    "office".to_owned(),
                    "image".to_owned(),
                    "voice".to_owned(),
                    "video".to_owned(),
                    "point_cloud".to_owned(),
                    "panorama".to_owned(),
                    "model_3d".to_owned(),
                ],
                edit_operations: vec![
                    "create".to_owned(),
                    "rename".to_owned(),
                    "move".to_owned(),
                    "copy".to_owned(),
                    "share".to_owned(),
                    "trash".to_owned(),
                    "replace_content".to_owned(),
                    "update_metadata".to_owned(),
                ],
                binary_semantic_edit_requires_adapter: true,
            },
            viewer: RuntimeViewerCapabilities {
                adapter_hints: ViewerAdapterHint::ALL.to_vec(),
                command_kinds: ViewerCommandKind::ALL.to_vec(),
                candidate_only_adapter_hints: vec![ViewerAdapterHint::VendorOptrapid3d],
            },
            registry: RuntimeRegistryCapabilities {
                skills: true,
                mcp_tools: true,
                knowledge_sources: true,
            },
            storage: RuntimeStorageCapabilities {
                providers: storage_providers(in_memory, s3_configured),
                persists_real_bytes: s3_configured,
                production_ready: !in_memory && s3_configured,
                s3_object_bindings: true,
            },
            store_capabilities: RuntimeStoreCapabilities {
                object_store: true,
                transaction_store: true,
                event_store: true,
                registry_store: true,
                artifact_store: true,
                viewer_command_store: true,
                knowledge_source_store: true,
                in_memory_only: in_memory,
                in_memory_fallback_allowed: in_memory,
                postgres: !in_memory,
                sea_orm_migrations: true,
                seaweedfs_s3: true,
                deterministic_pagination: true,
            },
            local_implementation_mode: mode.as_str().to_owned(),
            production_caveats: vec![
                if text_to_bim_configured {
                    "External Text-to-BIM provider route is configured.".to_owned()
                } else {
                    "External Text-to-BIM provider route is not configured.".to_owned()
                },
                if in_memory {
                    "Development mode is using in-memory fallback because DATABASE_URL is absent."
                        .to_owned()
                } else {
                    "Durable PostgreSQL/SeaORM adapter is configured; migrations remain explicit."
                        .to_owned()
                },
                "Vendor formats and vendor_optrapid3d are candidate-only and disabled for production routes.".to_owned(),
                if s3_configured {
                    "S3-compatible object storage is configured for artifact bytes.".to_owned()
                } else {
                    "S3-compatible object storage is not configured; development artifact bytes remain in process memory.".to_owned()
                },
                "Generator and evaluator remain separate pipeline stages.".to_owned(),
            ],
        }
    }

    /// Build the runtime capabilities for the current development in-memory mode.
    #[must_use]
    pub fn in_memory_preview() -> Self {
        Self::for_persistence_mode(RuntimePersistenceMode::InMemoryFallback)
    }
}

fn storage_providers(in_memory: bool, s3_configured: bool) -> Vec<String> {
    match (in_memory, s3_configured) {
        (true, true) => vec!["memory".to_owned(), "seaweedfs_s3".to_owned()],
        (true, false) => vec!["memory".to_owned()],
        (false, true) => vec!["postgres".to_owned(), "seaweedfs_s3".to_owned()],
        (false, false) => vec!["postgres".to_owned()],
    }
}

fn s3_object_store_configured() -> bool {
    ["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET"]
        .into_iter()
        .all(env_present)
}

fn text_to_bim_provider_configured() -> bool {
    env_equals("ARCHITOKEN_GENERATION__PROVIDER", "http_text_to_bim")
        && env_present("ARCHITOKEN_GENERATION__TEXT_TO_BIM_URL")
}

fn env_present(key: &str) -> bool {
    std::env::var(key)
        .ok()
        .is_some_and(|value| !value.trim().is_empty())
}

fn env_equals(key: &str, expected: &str) -> bool {
    std::env::var(key)
        .ok()
        .is_some_and(|value| value.trim() == expected)
}

#[cfg(test)]
mod tests {
    use crate::{
        asset_registry::AssetKind,
        db::RuntimePersistenceMode,
        harness_engines::{BimInformationDomain, EngineeringFileFormat, HarnessEngineKind},
        openbim::{OpenBimStandard, SourceAuthoringTool},
        storage_router::ViewerAdapterHint,
    };

    use super::RuntimeCapabilities;

    #[test]
    fn capabilities_include_storage_and_registry_surface() {
        let capabilities = RuntimeCapabilities::in_memory_preview();
        assert!(
            capabilities
                .active_module_ids
                .contains(&"digital_twin".to_owned())
        );
        assert_eq!(capabilities.local_implementation_mode, "in_memory_preview");
        assert!(capabilities.registry.skills);
        assert!(
            capabilities
                .storage
                .providers
                .contains(&"memory".to_owned())
        );
        assert!(capabilities.store_capabilities.artifact_store);
        assert!(capabilities.store_capabilities.sea_orm_migrations);
        assert!(capabilities.store_capabilities.seaweedfs_s3);
        assert!(capabilities.store_capabilities.deterministic_pagination);
    }

    #[test]
    fn capabilities_include_engine_and_openbim_surface() {
        let capabilities = RuntimeCapabilities::in_memory_preview();
        assert!(
            capabilities
                .engines
                .engine_kinds
                .contains(&HarnessEngineKind::Geometry)
        );
        assert!(
            capabilities
                .engines
                .engine_kinds
                .contains(&HarnessEngineKind::Ai)
        );
        assert!(
            capabilities
                .engines
                .required_formats
                .contains(&EngineeringFileFormat::Cad)
        );
        assert!(
            capabilities
                .engines
                .required_formats
                .contains(&EngineeringFileFormat::Voice)
        );
        assert!(
            capabilities
                .engines
                .required_bim_domains
                .contains(&BimInformationDomain::ModelQuantityTakeoff)
        );
        assert!(
            capabilities
                .engines
                .covered_bim_domains
                .contains(&BimInformationDomain::Cost5d)
        );
        assert!(capabilities.engines.all_required_formats_covered);
        assert!(capabilities.engines.all_required_bim_domains_covered);
        assert!(capabilities.engines.all_harness_stages_enforced);
        assert!(capabilities.open_bim.model_view_enabled);
        assert!(capabilities.open_bim.steel_bom_export_enabled);
        assert!(capabilities.open_bim.text_to_bim_currently_deferred);
        assert!(
            capabilities
                .open_bim
                .standards
                .contains(&OpenBimStandard::Ifc4x3)
        );
        assert!(
            capabilities
                .open_bim
                .standards
                .contains(&OpenBimStandard::Idm)
        );
        assert!(
            capabilities
                .open_bim
                .standards
                .contains(&OpenBimStandard::Validate)
        );
        assert!(
            capabilities
                .open_bim
                .source_authoring_tools
                .contains(&SourceAuthoringTool::TeklaStructures)
        );
    }

    #[test]
    fn capabilities_include_cde_generation_and_file_surface() {
        let capabilities = RuntimeCapabilities::in_memory_preview();
        assert!(capabilities.cde.complete_open_bim_standard_coverage);
        assert!(capabilities.cde.speckle_object_graph_ready);
        assert!(
            capabilities
                .cde
                .external_adapters
                .iter()
                .any(|adapter| adapter.id == "glodon")
        );
        assert!(
            capabilities
                .file_workbench
                .view_families
                .contains(&"bim".to_owned())
        );
        assert!(
            capabilities
                .file_workbench
                .edit_operations
                .contains(&"replace_content".to_owned())
        );
        assert!(
            capabilities
                .viewer
                .candidate_only_adapter_hints
                .contains(&ViewerAdapterHint::VendorOptrapid3d)
        );
        assert_eq!(capabilities.generation.modes.len(), 42);
        assert!(
            capabilities
                .generation
                .asset_kinds_phase7
                .contains(&AssetKind::Ifc)
        );
    }

    #[test]
    fn durable_postgres_capabilities_disable_memory_fallback() {
        temp_env::with_vars(
            [
                ("S3_ENDPOINT", Some("http://seaweedfs:8333")),
                ("S3_ACCESS_KEY", Some("architoken")),
                ("S3_SECRET_KEY", Some("architoken-secret")),
                ("S3_BUCKET", Some("architoken-assets")),
            ],
            || {
                let capabilities = RuntimeCapabilities::for_persistence_mode(
                    RuntimePersistenceMode::DurablePostgres,
                );
                assert_eq!(capabilities.local_implementation_mode, "durable_postgres");
                assert!(!capabilities.store_capabilities.in_memory_only);
                assert!(capabilities.store_capabilities.postgres);
                assert!(capabilities.storage.production_ready);
            },
        );
    }
}
