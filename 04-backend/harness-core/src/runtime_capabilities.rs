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
    file_runtime_registry::{
        FileRuntimeRoute, REQUESTED_ENGINE_EXTENSIONS, list_file_runtime_routes,
        requested_extensions_are_mapped,
    },
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
    /// Data-plane capability routing and progressive physical split state.
    pub data_plane: RuntimeDataPlaneCapabilities,
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
    /// Backend-native source format routes used by conversion jobs and viewers.
    pub runtime_routes: Vec<FileRuntimeRoute>,
    /// High-priority extensions requested for backend parsing/viewing coverage.
    pub requested_engine_extensions: Vec<String>,
    /// Whether every requested extension has a real route or explicit fail-closed adapter boundary.
    pub all_requested_engine_extensions_mapped: bool,
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

/// Progressive data-plane split status advertised to clients and operators.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDataPlaneCapabilities {
    /// Split strategy name.
    pub split_strategy: String,
    /// Highest active split phase detected from configuration.
    pub active_phase: String,
    /// Store capability records.
    pub stores: Vec<RuntimeDataStoreCapability>,
    /// Whether business code is expected to route storage by capability.
    pub storage_router_enforced: bool,
    /// Number of stores backed by an external physical service beyond Postgres/memory.
    pub external_physical_store_count: usize,
}

/// One routed data capability in the progressive split matrix.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDataStoreCapability {
    /// Capability id such as `vector_store` or `time_series_store`.
    pub capability: String,
    /// Provider selected by the current runtime configuration.
    pub current_provider: String,
    /// Fallback provider used before the physical split is enabled.
    pub fallback_provider: String,
    /// Whether this capability has a usable backing store in the current runtime.
    pub configured: bool,
    /// Whether this capability is ready for production workloads in the current runtime.
    pub production_ready: bool,
    /// Target split phase for moving this capability out of the Postgres trunk.
    pub split_phase: String,
    /// Routing rule that business logic must follow.
    pub routing_rule: String,
    /// Environment variables that enable the external provider.
    pub required_env: Vec<String>,
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
    /// Generation modes with configured external provider routes in this runtime.
    pub external_provider_modes: Vec<GenerationMode>,
    /// Artifact kinds produced by configured external provider routes.
    pub external_provider_artifact_kinds: Vec<ArtifactKind>,
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
        let text_to_image_configured = text_to_image_provider_configured();
        let image_to_video_configured = image_to_video_provider_configured();
        let external_provider_modes = external_generation_modes(
            text_to_bim_configured,
            text_to_image_configured,
            image_to_video_configured,
        );
        let ifcdb_agent_configured = ifcdb_agent_configured();
        let engine_coverage = engine_coverage_report();
        Self {
            active_module_ids: list_modules()
                .into_iter()
                .map(|module| module.id.to_string())
                .collect(),
            generation: RuntimeGenerationCapabilities {
                modes: GenerationMode::ALL.to_vec(),
                external_provider_artifact_kinds: external_generation_artifact_kinds(
                    &external_provider_modes,
                ),
                external_provider_modes,
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
                    "ifcdb_agent_object_graph_query".to_owned(),
                    "ifcdb_agent_export_clash_quantity".to_owned(),
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
                runtime_routes: list_file_runtime_routes(),
                requested_engine_extensions: REQUESTED_ENGINE_EXTENSIONS
                    .iter()
                    .map(|extension| (*extension).to_owned())
                    .collect(),
                all_requested_engine_extensions_mapped: requested_extensions_are_mapped(),
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
            data_plane: data_plane_capabilities(in_memory, s3_configured),
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
                if text_to_image_configured {
                    "External Text-to-Image provider route is configured.".to_owned()
                } else {
                    "External Text-to-Image provider route is not configured.".to_owned()
                },
                if image_to_video_configured {
                    "External Image-to-Video provider route is configured.".to_owned()
                } else {
                    "External Image-to-Video provider route is not configured.".to_owned()
                },
                if ifcdb_agent_configured {
                    "IFCDB-Agent v1.0.9 sidecar route is configured.".to_owned()
                } else {
                    "IFCDB-Agent v1.0.9 sidecar route is not configured; ifcdb_* jobs will block at the worker boundary.".to_owned()
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

#[allow(clippy::too_many_lines)]
fn data_plane_capabilities(in_memory: bool, s3_configured: bool) -> RuntimeDataPlaneCapabilities {
    let vector_external = env_any_present(&["ARCHITOKEN_VECTOR__URL", "QDRANT_URL"]);
    let time_series_external = env_any_present(&[
        "ARCHITOKEN_TIMESERIES__URL",
        "ARCHITOKEN_TIME_SERIES__URL",
        "CLICKHOUSE_URL",
    ]);
    let event_external = env_any_present(&["ARCHITOKEN_EVENT__URL", "NATS_URL"]);
    let analytics_external = env_any_present(&["ARCHITOKEN_ANALYTICS__URL", "CLICKHOUSE_URL"]);
    let cache_configured = env_any_present(&["ARCHITOKEN_CACHE__URL", "REDIS_URL", "VALKEY_URL"]);
    let graph_external = env_any_present(&["ARCHITOKEN_GRAPH__URL"]);

    let mut stores = vec![
        data_store(
            "relational_store",
            if in_memory { "memory" } else { "postgres" },
            "memory",
            true,
            !in_memory,
            "phase_1_postgres_trunk",
            "modules, projects, permissions, lifecycle and registry records stay in the primary relational store.",
            &["ARCHITOKEN_DATABASE__URL", "DATABASE_URL"],
        ),
        data_store(
            "object_store",
            if s3_configured {
                "seaweedfs_s3"
            } else {
                "memory"
            },
            "memory",
            s3_configured || in_memory,
            s3_configured && !in_memory,
            "phase_1_object_store",
            "large source files and derived artifacts route through ObjectStore bindings only.",
            &["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET"],
        ),
        data_store(
            "vector_store",
            if vector_external {
                "qdrant"
            } else if in_memory {
                "memory"
            } else {
                "postgres_pgvector"
            },
            if in_memory {
                "memory"
            } else {
                "postgres_pgvector"
            },
            true,
            vector_external || !in_memory,
            "phase_2_vector_split",
            "RAG and semantic search route through VectorStore; pgvector remains the trunk fallback.",
            &["ARCHITOKEN_VECTOR__URL", "QDRANT_URL"],
        ),
        data_store(
            "time_series_store",
            if time_series_external {
                "clickhouse"
            } else if in_memory {
                "memory"
            } else {
                "postgres_partitioned"
            },
            if in_memory {
                "memory"
            } else {
                "postgres_partitioned"
            },
            true,
            time_series_external || !in_memory,
            "phase_3_time_series_split",
            "IoT, telemetry, progress and equipment state route through TimeSeriesStore.",
            &[
                "ARCHITOKEN_TIMESERIES__URL",
                "ARCHITOKEN_TIME_SERIES__URL",
                "CLICKHOUSE_URL",
            ],
        ),
        data_store(
            "graph_store",
            if graph_external {
                "architoken_graph_sidecar"
            } else if in_memory {
                "memory"
            } else {
                "postgres_adjacency"
            },
            if in_memory {
                "memory"
            } else {
                "postgres_adjacency"
            },
            true,
            graph_external || !in_memory,
            "phase_4_graph_split",
            "component, workflow, knowledge and supply-chain relationships route through the GraphStore sidecar; PostgreSQL adjacency remains the canonical fallback.",
            &["ARCHITOKEN_GRAPH__URL"],
        ),
        data_store(
            "event_store",
            if event_external {
                "nats_jetstream"
            } else if in_memory {
                "memory"
            } else {
                "postgres_outbox"
            },
            if in_memory {
                "memory"
            } else {
                "postgres_outbox"
            },
            true,
            event_external || !in_memory,
            "phase_5_event_split",
            "audit, workflow events and integration fan-out route through EventStore.",
            &["ARCHITOKEN_EVENT__URL", "NATS_URL"],
        ),
        data_store(
            "cache_store",
            if cache_configured { "valkey" } else { "memory" },
            "memory",
            cache_configured || in_memory,
            cache_configured,
            "phase_1_cache",
            "ephemeral UI, workflow and rate-limit state route through CacheStore.",
            &["ARCHITOKEN_CACHE__URL", "REDIS_URL", "VALKEY_URL"],
        ),
        data_store(
            "analytics_store",
            if analytics_external {
                "clickhouse"
            } else if in_memory {
                "memory"
            } else {
                "postgres_materialized_views"
            },
            if in_memory {
                "memory"
            } else {
                "postgres_materialized_views"
            },
            true,
            analytics_external || !in_memory,
            "phase_6_analytics_split",
            "operational aggregates and product analytics route through AnalyticsStore.",
            &["ARCHITOKEN_ANALYTICS__URL", "CLICKHOUSE_URL"],
        ),
    ];
    stores.sort_by(|left, right| left.capability.cmp(&right.capability));

    let external_physical_store_count = stores
        .iter()
        .filter(|store| {
            !matches!(
                store.current_provider.as_str(),
                "memory"
                    | "postgres"
                    | "postgres_pgvector"
                    | "postgres_partitioned"
                    | "postgres_adjacency"
                    | "postgres_outbox"
                    | "postgres_materialized_views"
            )
        })
        .count();

    RuntimeDataPlaneCapabilities {
        split_strategy: "capability_first_progressive_split".to_owned(),
        active_phase: active_data_plane_phase(in_memory, &stores),
        stores,
        storage_router_enforced: true,
        external_physical_store_count,
    }
}

#[allow(clippy::too_many_arguments)]
fn data_store(
    capability: &str,
    current_provider: &str,
    fallback_provider: &str,
    configured: bool,
    production_ready: bool,
    split_phase: &str,
    routing_rule: &str,
    required_env: &[&str],
) -> RuntimeDataStoreCapability {
    RuntimeDataStoreCapability {
        capability: capability.to_owned(),
        current_provider: current_provider.to_owned(),
        fallback_provider: fallback_provider.to_owned(),
        configured,
        production_ready,
        split_phase: split_phase.to_owned(),
        routing_rule: routing_rule.to_owned(),
        required_env: required_env.iter().map(|env| (*env).to_owned()).collect(),
    }
}

fn active_data_plane_phase(in_memory: bool, stores: &[RuntimeDataStoreCapability]) -> String {
    if in_memory {
        return "phase_0_memory_preview".to_owned();
    }
    stores
        .iter()
        .filter(|store| store.current_provider != store.fallback_provider)
        .map(|store| store.split_phase.as_str())
        .max()
        .unwrap_or("phase_1_postgres_trunk")
        .to_owned()
}

fn s3_object_store_configured() -> bool {
    ["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET"]
        .into_iter()
        .all(env_present)
}

fn env_any_present(keys: &[&str]) -> bool {
    keys.iter().any(|key| env_present(key))
}

fn text_to_bim_provider_configured() -> bool {
    generation_provider_is_any(&["http_text_to_bim", "http_multimodal"])
        && env_present("ARCHITOKEN_GENERATION__TEXT_TO_BIM_URL")
}

fn text_to_image_provider_configured() -> bool {
    generation_provider_is_any(&["http_multimodal"])
        && env_present("ARCHITOKEN_GENERATION__TEXT_TO_IMAGE_URL")
}

fn image_to_video_provider_configured() -> bool {
    generation_provider_is_any(&["http_multimodal"])
        && env_present("ARCHITOKEN_GENERATION__IMAGE_TO_VIDEO_URL")
}

fn generation_provider_is_any(expected: &[&str]) -> bool {
    std::env::var("ARCHITOKEN_GENERATION__PROVIDER")
        .ok()
        .is_some_and(|value| {
            let normalized = value.trim().to_ascii_lowercase();
            expected.iter().any(|candidate| normalized == *candidate)
        })
}

fn external_generation_modes(
    text_to_bim_configured: bool,
    text_to_image_configured: bool,
    image_to_video_configured: bool,
) -> Vec<GenerationMode> {
    let mut modes = Vec::new();
    if text_to_bim_configured {
        modes.push(GenerationMode::TextToBim);
    }
    if text_to_image_configured {
        modes.push(GenerationMode::TextToImage);
    }
    if image_to_video_configured {
        modes.push(GenerationMode::ImageToVideo);
    }
    modes
}

fn external_generation_artifact_kinds(modes: &[GenerationMode]) -> Vec<ArtifactKind> {
    let mut kinds = Vec::new();
    for mode in modes {
        let kind = match mode {
            GenerationMode::TextToBim => ArtifactKind::Bim,
            GenerationMode::TextToImage => ArtifactKind::Image,
            GenerationMode::ImageToVideo => ArtifactKind::Video,
            _ => continue,
        };
        if !kinds.contains(&kind) {
            kinds.push(kind);
        }
    }
    kinds
}

fn ifcdb_agent_configured() -> bool {
    env_present("IFCDB_AGENT_URL")
        && std::env::var("IFCDB_AGENT_VERSION")
            .ok()
            .is_some_and(|value| {
                matches!(
                    value.trim().to_ascii_lowercase().as_str(),
                    "v1.0.9" | "1.0.9"
                )
            })
}

fn env_present(key: &str) -> bool {
    std::env::var(key)
        .ok()
        .is_some_and(|value| !value.trim().is_empty())
}

#[cfg(test)]
mod tests {
    use crate::{
        asset_registry::AssetKind,
        db::RuntimePersistenceMode,
        harness_engines::{BimInformationDomain, EngineeringFileFormat, HarnessEngineKind},
        module_generation::{ArtifactKind, GenerationMode},
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
        assert_eq!(
            capabilities.data_plane.split_strategy,
            "capability_first_progressive_split"
        );
        assert_eq!(
            capabilities.data_plane.active_phase,
            "phase_0_memory_preview"
        );
        assert!(capabilities.data_plane.storage_router_enforced);
        assert!(
            capabilities
                .data_plane
                .stores
                .iter()
                .any(|store| store.capability == "vector_store")
        );
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
        assert!(
            capabilities
                .open_bim
                .first_delivery_features
                .contains(&"ifcdb_agent_object_graph_query".to_owned())
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
                .file_workbench
                .all_requested_engine_extensions_mapped
        );
        assert!(
            capabilities
                .file_workbench
                .runtime_routes
                .iter()
                .any(|route| {
                    route.extension == "rvt" && route.default_adapter == "licensed_bim_adapter"
                })
        );
        assert!(
            capabilities
                .file_workbench
                .runtime_routes
                .iter()
                .any(|route| {
                    route.extension == "usd" && route.default_adapter == "prengine_openusd"
                })
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
        assert!(
            capabilities
                .generation
                .conversion_operations
                .contains(&crate::asset_registry::ConversionOperation::IfcdbQuery)
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
                assert!(capabilities.data_plane.stores.iter().any(|store| {
                    store.capability == "object_store" && store.current_provider == "seaweedfs_s3"
                }));
            },
        );
    }

    #[test]
    fn capabilities_report_progressive_external_data_split() {
        temp_env::with_vars(
            [
                ("ARCHITOKEN_VECTOR__URL", Some("http://qdrant:6333")),
                ("ARCHITOKEN_TIMESERIES__URL", Some("http://timeseries:8123")),
                ("ARCHITOKEN_GRAPH__URL", Some("http://graph:8080")),
                ("ARCHITOKEN_EVENT__URL", Some("nats://nats:4222")),
                ("ARCHITOKEN_ANALYTICS__URL", Some("http://analytics:8123")),
                ("ARCHITOKEN_CACHE__URL", Some("redis://valkey:6379/0")),
            ],
            || {
                let capabilities = RuntimeCapabilities::for_persistence_mode(
                    RuntimePersistenceMode::DurablePostgres,
                );
                assert_eq!(
                    capabilities.data_plane.active_phase,
                    "phase_6_analytics_split"
                );
                assert!(capabilities.data_plane.external_physical_store_count >= 5);
                assert!(capabilities.data_plane.stores.iter().any(|store| {
                    store.capability == "vector_store"
                        && store.current_provider == "qdrant"
                        && store.fallback_provider == "postgres_pgvector"
                }));
                assert!(capabilities.data_plane.stores.iter().any(|store| {
                    store.capability == "graph_store"
                        && store.current_provider == "architoken_graph_sidecar"
                        && store.fallback_provider == "postgres_adjacency"
                }));
            },
        );
    }

    #[test]
    fn capabilities_register_configured_external_image_and_video_generation_modes() {
        temp_env::with_vars(
            [
                ("ARCHITOKEN_GENERATION__PROVIDER", Some("http_multimodal")),
                (
                    "ARCHITOKEN_GENERATION__TEXT_TO_BIM_URL",
                    Some("http://generation/text-to-bim"),
                ),
                (
                    "ARCHITOKEN_GENERATION__TEXT_TO_IMAGE_URL",
                    Some("http://generation/text-to-image"),
                ),
                (
                    "ARCHITOKEN_GENERATION__IMAGE_TO_VIDEO_URL",
                    Some("http://generation/image-to-video"),
                ),
            ],
            || {
                let capabilities = RuntimeCapabilities::in_memory_preview();
                assert!(
                    capabilities
                        .generation
                        .external_provider_modes
                        .contains(&GenerationMode::TextToImage)
                );
                assert!(
                    capabilities
                        .generation
                        .external_provider_modes
                        .contains(&GenerationMode::ImageToVideo)
                );
                assert!(
                    capabilities
                        .generation
                        .external_provider_artifact_kinds
                        .contains(&ArtifactKind::Image)
                );
                assert!(
                    capabilities
                        .generation
                        .external_provider_artifact_kinds
                        .contains(&ArtifactKind::Video)
                );
            },
        );
    }
}
