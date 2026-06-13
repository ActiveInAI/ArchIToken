//! Internal unified Router architecture (Constitution §9, issue #5).
//!
//! `ArchIToken`'s constitution requires that **every** model, tool, workflow,
//! geometry, render and storage call go through an internal router abstraction —
//! never a provider SDK called directly from a business module. External
//! services (`OpenRouter`, hosted model APIs, …) are only ever *optional adapters*
//! plugged into a router, not the architecture itself.
//!
//! This module is the single façade over the seven routers. Five already exist
//! as their own files and are re-exported here unchanged; the two that the
//! constitution requires but were missing — [`ModelRouter`] and [`ToolRouter`] —
//! live under `router/`. The [`ROUTERS`] table enumerates all seven so a test
//! (and the `scripts/check-router-boundary.sh` CI guard) can assert the set is
//! complete and that direct provider calls never bypass it.

pub mod model;
pub mod tool;

pub use model::{ModelProvider, ModelRoute, ModelRouter};
pub use tool::{ToolRouteDecision, ToolRouter};

// Re-export the pre-existing routers so callers use one canonical path:
// `architoken_harness_core::router::*`.
pub use crate::geometry_router::GeometryRouter;
pub use crate::inference::InferenceRouter;
pub use crate::render_router::RenderRouter;
pub use crate::storage_router::StorageRouter;
pub use crate::workflow_router::WorkflowRouter;

/// The seven internal router kinds mandated by the constitution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RouterKind {
    /// Selects the model + provider for a request (white-list enforced).
    Model,
    /// Executes a model call against a registered inference engine.
    Inference,
    /// Governs tool dispatch with permission / sandbox / audit hooks.
    Tool,
    /// Dispatches module / agent DAG (the 6-gate harness chain).
    Workflow,
    /// Dispatches CAD/BIM geometry-kernel work.
    Geometry,
    /// Selects the rendering backend (WebGPU-first).
    Render,
    /// Selects the object / vector / time-series / state backend.
    Storage,
}

impl RouterKind {
    /// All seven kinds, in constitutional order.
    pub const ALL: [Self; 7] = [
        Self::Model,
        Self::Inference,
        Self::Tool,
        Self::Workflow,
        Self::Geometry,
        Self::Render,
        Self::Storage,
    ];
}

/// Marker trait every internal router implements, giving the architecture a
/// single uniform handle and preventing ad-hoc "routers" that aren't registered.
pub trait Router {
    /// The router kind this type provides.
    fn kind(&self) -> RouterKind;
}

/// Static description of one router and its *optional external adapters*.
///
/// External adapters are governance metadata only — the router stays the
/// architecture; the adapter is a swappable provider behind it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RouterDescriptor {
    /// Which router this describes.
    pub kind: RouterKind,
    /// Stable router name.
    pub name: &'static str,
    /// One-line responsibility.
    pub purpose: &'static str,
    /// Optional external adapters allowed behind this router (e.g. `OpenRouter`).
    pub external_adapters: &'static [&'static str],
}

/// The complete internal router set. Business modules must route through one of
/// these; the CI boundary guard rejects direct provider calls that bypass them.
pub const ROUTERS: [RouterDescriptor; 7] = [
    RouterDescriptor {
        kind: RouterKind::Model,
        name: "ModelRouter",
        purpose: "model + provider selection with white-list enforcement",
        // `OpenRouter` is the canonical *optional* external model adapter.
        external_adapters: &["openrouter"],
    },
    RouterDescriptor {
        kind: RouterKind::Inference,
        name: "InferenceRouter",
        purpose: "execute model calls against registered OpenAI-compatible engines",
        external_adapters: &[],
    },
    RouterDescriptor {
        kind: RouterKind::Tool,
        name: "ToolRouter",
        purpose: "permission / sandbox / audit-gated tool dispatch",
        external_adapters: &["mcp"],
    },
    RouterDescriptor {
        kind: RouterKind::Workflow,
        name: "WorkflowRouter",
        purpose: "module / agent DAG dispatch over the 6-gate harness chain",
        external_adapters: &[],
    },
    RouterDescriptor {
        kind: RouterKind::Geometry,
        name: "GeometryRouter",
        purpose: "CAD/BIM geometry-kernel selection",
        external_adapters: &["licensed_bim_adapter"],
    },
    RouterDescriptor {
        kind: RouterKind::Render,
        name: "RenderRouter",
        purpose: "WebGPU-first rendering backend selection",
        external_adapters: &[],
    },
    RouterDescriptor {
        kind: RouterKind::Storage,
        name: "StorageRouter",
        purpose: "object / vector / time-series / state backend selection",
        external_adapters: &["s3"],
    },
];

/// Look up the descriptor for a router kind.
#[must_use]
pub fn descriptor(kind: RouterKind) -> RouterDescriptor {
    // ROUTERS is exhaustive over RouterKind, so this never panics; the test
    // `every_router_kind_has_exactly_one_descriptor` proves it.
    ROUTERS
        .into_iter()
        .find(|d| d.kind == kind)
        .unwrap_or(ROUTERS[0])
}

impl Router for InferenceRouter {
    fn kind(&self) -> RouterKind {
        RouterKind::Inference
    }
}
impl Router for WorkflowRouter {
    fn kind(&self) -> RouterKind {
        RouterKind::Workflow
    }
}
impl Router for GeometryRouter {
    fn kind(&self) -> RouterKind {
        RouterKind::Geometry
    }
}
impl Router for RenderRouter {
    fn kind(&self) -> RouterKind {
        RouterKind::Render
    }
}
impl Router for StorageRouter {
    fn kind(&self) -> RouterKind {
        RouterKind::Storage
    }
}

#[cfg(test)]
mod tests {
    use super::{ROUTERS, Router, RouterKind, descriptor};
    use crate::render_router::RenderRouter;

    #[test]
    fn every_router_kind_has_exactly_one_descriptor() {
        for kind in RouterKind::ALL {
            let matches = ROUTERS.iter().filter(|d| d.kind == kind).count();
            assert_eq!(matches, 1, "router kind {kind:?} must appear exactly once");
        }
        assert_eq!(ROUTERS.len(), RouterKind::ALL.len());
    }

    #[test]
    fn model_router_fronts_openrouter_as_external_adapter_only() {
        let model = descriptor(RouterKind::Model);
        assert!(
            model.external_adapters.contains(&"openrouter"),
            "`OpenRouter` must be reachable only as ModelRouter's external adapter"
        );
        // Inference / render / workflow must not carry external model adapters.
        for kind in [
            RouterKind::Inference,
            RouterKind::Render,
            RouterKind::Workflow,
        ] {
            assert!(
                !descriptor(kind).external_adapters.contains(&"openrouter"),
                "{kind:?} must not front `OpenRouter` directly"
            );
        }
    }

    #[test]
    fn existing_routers_report_their_kind() {
        assert_eq!(RenderRouter::new().kind(), RouterKind::Render);
    }

    #[test]
    fn storage_router_routes_each_class_to_a_distinct_backend() {
        use crate::storage_router::{StorageBackend, StorageClass, StorageRouter};
        let r = StorageRouter::new();
        assert_eq!(
            r.route(StorageClass::Embedding).backend,
            StorageBackend::VectorIndex
        );
        assert_eq!(
            r.route(StorageClass::BinaryArtifact).backend,
            StorageBackend::ObjectStore
        );
        assert_eq!(
            r.route(StorageClass::Metric).backend,
            StorageBackend::TimeSeries
        );
    }
}
