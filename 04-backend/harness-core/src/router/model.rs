//! `ModelRouter` — model + provider selection (Constitution §9, issue #5).
//!
//! The `ModelRouter` decides *which provider serves a model*, enforcing a
//! white-list: known internal models route to their self-hosted inference
//! [`Engine`]; everything else is only reachable through an **optional**
//! external adapter (`OpenRouter`), which is off by default and always audited.
//! Actual execution is delegated to the `InferenceRouter` — this router is the
//! governance/selection layer above it.

use std::collections::HashMap;

use serde::Serialize;

use crate::inference::Engine;

/// The canonical external model adapter name. `OpenRouter` is an *adapter*, never
/// the architecture — it is only reachable through the `ModelRouter`.
pub const OPENROUTER_ADAPTER: &str = "openrouter";

/// Where a routed model is served from.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind", content = "ref")]
pub enum ModelProvider {
    /// A self-hosted internal inference engine (Constitution-preferred path).
    Internal(Engine),
    /// An external adapter (e.g. `OpenRouter`) — optional, audited, off by default.
    External(String),
}

/// An auditable model routing decision.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRoute {
    /// The requested model id.
    pub model: String,
    /// The provider selected to serve it.
    pub provider: ModelProvider,
    /// Whether the call is approved to proceed.
    pub approved: bool,
    /// Human-readable routing rationale.
    pub reason: String,
}

/// Selects the provider for a model and enforces the internal white-list.
#[derive(Debug, Clone, Default)]
pub struct ModelRouter {
    catalog: HashMap<String, Engine>,
    allow_external: bool,
}

impl ModelRouter {
    /// Create a router. `allow_external` enables the `OpenRouter` adapter for
    /// models that are not on the internal white-list (default: disabled).
    #[must_use]
    pub fn new(allow_external: bool) -> Self {
        Self {
            catalog: HashMap::new(),
            allow_external,
        }
    }

    /// Register an internal model and the engine that serves it.
    pub fn register(&mut self, model: impl Into<String>, engine: Engine) {
        self.catalog.insert(model.into(), engine);
    }

    /// Whether the external (`OpenRouter`) adapter is enabled.
    #[must_use]
    pub const fn external_enabled(&self) -> bool {
        self.allow_external
    }

    /// Route a model id to a provider decision.
    ///
    /// - On the internal white-list → [`ModelProvider::Internal`], approved.
    /// - Off the list but external enabled → [`ModelProvider::External`]
    ///   (`OpenRouter`), approved but audited.
    /// - Off the list and external disabled → not approved.
    #[must_use]
    pub fn route(&self, model: &str) -> ModelRoute {
        let key = model.trim();
        if let Some(&engine) = self.catalog.get(key) {
            return ModelRoute {
                model: key.to_owned(),
                provider: ModelProvider::Internal(engine),
                approved: true,
                reason: format!("internal white-listed model -> engine {engine:?}"),
            };
        }
        if self.allow_external {
            return ModelRoute {
                model: key.to_owned(),
                provider: ModelProvider::External(OPENROUTER_ADAPTER.to_owned()),
                approved: true,
                reason: format!(
                    "not white-listed; routed to optional external adapter '{OPENROUTER_ADAPTER}'"
                ),
            };
        }
        ModelRoute {
            model: key.to_owned(),
            provider: ModelProvider::External(OPENROUTER_ADAPTER.to_owned()),
            approved: false,
            reason: "not white-listed and external adapter disabled -> rejected".to_owned(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{ModelProvider, ModelRouter, OPENROUTER_ADAPTER};
    use crate::inference::Engine;

    #[test]
    fn whitelisted_model_routes_to_internal_engine() {
        let mut router = ModelRouter::new(false);
        router.register("qwen3-coder", Engine::SgLang);
        let route = router.route("qwen3-coder");
        assert!(route.approved);
        assert_eq!(route.provider, ModelProvider::Internal(Engine::SgLang));
    }

    #[test]
    fn unknown_model_is_rejected_when_external_disabled() {
        let router = ModelRouter::new(false);
        let route = router.route("some-frontier-model");
        assert!(
            !route.approved,
            "external disabled must reject unknown model"
        );
    }

    #[test]
    fn unknown_model_uses_openrouter_only_when_external_enabled() {
        let router = ModelRouter::new(true);
        let route = router.route("some-frontier-model");
        assert!(route.approved);
        assert_eq!(
            route.provider,
            ModelProvider::External(OPENROUTER_ADAPTER.to_owned())
        );
    }
}
