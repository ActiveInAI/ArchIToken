//! Runtime capability discovery for local preview clients.
//!
//! The endpoint lets frontend and third-party callers discover the active
//! contract surface without hardcoding generation modes, artifact formats, or
//! registry availability.

use serde::Serialize;

use crate::{
    asset_registry::{AssetKind, ConversionOperation},
    db::RuntimePersistenceMode,
    module_generation::{ArtifactKind, GenerationMode},
    module_registry::list_modules,
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
    /// Viewer adapter and command capabilities.
    pub viewer: RuntimeViewerCapabilities,
    /// Registry availability.
    pub registry: RuntimeRegistryCapabilities,
    /// Storage adapter availability.
    pub storage: RuntimeStorageCapabilities,
    /// Durable store boundary availability.
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

/// Durable store boundary flags for the current runtime.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools)]
pub struct RuntimeStoreCapabilities {
    /// `ObjectStore` boundary is present.
    pub object_store: bool,
    /// `TransactionStore` boundary is present.
    pub transaction_store: bool,
    /// `EventStore` boundary is present.
    pub event_store: bool,
    /// `RegistryStore` boundary is present.
    pub registry_store: bool,
    /// `ArtifactStore` boundary is present.
    pub artifact_store: bool,
    /// `ViewerCommandStore` boundary is present.
    pub viewer_command_store: bool,
    /// `KnowledgeSourceStore` boundary is present.
    pub knowledge_source_store: bool,
    /// Whether current adapters are in-memory only.
    pub in_memory_only: bool,
    /// Whether development may use memory when `DATABASE_URL` is absent.
    pub in_memory_fallback_allowed: bool,
    /// Whether a `PostgreSQL` durable store boundary is configured.
    pub postgres: bool,
    /// Whether `SeaORM` migration contracts are present.
    pub sea_orm_migrations: bool,
    /// Whether `SeaweedFS` S3 object-store boundary is present.
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
    pub fn for_persistence_mode(mode: RuntimePersistenceMode) -> Self {
        let in_memory = matches!(mode, RuntimePersistenceMode::InMemoryFallback);
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
                providers: if in_memory {
                    vec!["memory".to_owned(), "seaweedfs_s3_boundary".to_owned()]
                } else {
                    vec!["postgres".to_owned(), "seaweedfs_s3_boundary".to_owned()]
                },
                persists_real_bytes: !in_memory,
                production_ready: !in_memory,
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
                "No real commercial model APIs are connected.".to_owned(),
                if in_memory {
                    "Development mode is using in-memory fallback because DATABASE_URL is absent."
                        .to_owned()
                } else {
                    "Durable PostgreSQL/SeaORM boundary is configured; migrations remain explicit."
                        .to_owned()
                },
                "Vendor formats and vendor_optrapid3d are candidate-only and disabled for production routes.".to_owned(),
                "Generator and evaluator remain separate mock actors in this preview.".to_owned(),
            ],
        }
    }

    /// Build the runtime capabilities for the current in-memory preview mode.
    #[must_use]
    pub fn in_memory_preview() -> Self {
        Self::for_persistence_mode(RuntimePersistenceMode::InMemoryFallback)
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        asset_registry::AssetKind, db::RuntimePersistenceMode, storage_router::ViewerAdapterHint,
    };

    use super::RuntimeCapabilities;

    #[test]
    fn capabilities_include_required_runtime_surface() {
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
        let capabilities =
            RuntimeCapabilities::for_persistence_mode(RuntimePersistenceMode::DurablePostgres);
        assert_eq!(capabilities.local_implementation_mode, "durable_postgres");
        assert!(!capabilities.store_capabilities.in_memory_only);
        assert!(capabilities.store_capabilities.postgres);
        assert!(capabilities.storage.production_ready);
    }
}
