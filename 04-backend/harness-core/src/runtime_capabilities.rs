//! Runtime capability discovery for local preview clients.
//!
//! The endpoint lets frontend and third-party callers discover the active
//! contract surface without hardcoding generation modes, artifact formats, or
//! registry availability.

use serde::Serialize;

use crate::{
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
}

impl RuntimeCapabilities {
    /// Build the runtime capabilities for the current in-memory preview mode.
    #[must_use]
    pub fn in_memory_preview() -> Self {
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
                providers: vec!["memory".to_owned()],
                persists_real_bytes: false,
                production_ready: false,
            },
            local_implementation_mode: "in_memory_preview".to_owned(),
            production_caveats: vec![
                "No real commercial model APIs are connected.".to_owned(),
                "Artifacts expose metadata and memory:// bindings only; real bytes are not persisted.".to_owned(),
                "Vendor formats and vendor_optrapid3d are candidate-only and disabled for production routes.".to_owned(),
                "Generator and evaluator remain separate mock actors in this preview.".to_owned(),
            ],
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::storage_router::ViewerAdapterHint;

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
        assert!(
            capabilities
                .viewer
                .candidate_only_adapter_hints
                .contains(&ViewerAdapterHint::VendorOptrapid3d)
        );
        assert_eq!(capabilities.generation.modes.len(), 42);
    }
}
