//! `ToolRouter` — permission / sandbox / audit-gated tool dispatch routing
//! (Constitution §9, issue #5).
//!
//! The [`crate::tools::ToolRegistry`] knows *how* to execute a tool; the
//! `ToolRouter` is the governance layer that decides *whether* a caller may,
//! producing an auditable [`ToolRouteDecision`] with the required permissions,
//! mutation flag and audit requirement. Business modules must obtain a decision
//! here before dispatch rather than calling a tool implementation directly.

use serde::Serialize;

use crate::permissions::{Claims, Permission};
use crate::tools::ToolRegistry;

/// An auditable decision about routing a tool call.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolRouteDecision {
    /// The requested tool name.
    pub tool: String,
    /// Whether the caller is authorized to dispatch it.
    pub allowed: bool,
    /// Permissions the tool requires.
    pub required_permissions: Vec<Permission>,
    /// Whether the tool mutates state.
    pub mutating: bool,
    /// Whether the dispatch must be written to the audit log.
    pub audit_required: bool,
    /// Human-readable rationale.
    pub reason: String,
}

/// Governs tool dispatch over a [`ToolRegistry`] with permission/sandbox/audit
/// hooks.
#[derive(Clone, Copy)]
pub struct ToolRouter<'a> {
    registry: &'a ToolRegistry,
}

impl<'a> ToolRouter<'a> {
    /// Create a router over an existing tool registry.
    #[must_use]
    pub const fn new(registry: &'a ToolRegistry) -> Self {
        Self { registry }
    }

    /// Decide whether `claims` may dispatch `tool`. Unknown tools and missing
    /// permissions both yield a non-allowed decision (never a panic).
    #[must_use]
    pub fn route(&self, tool: &str, claims: &Claims) -> ToolRouteDecision {
        let Some(spec) = self.registry.get_spec(tool) else {
            return ToolRouteDecision {
                tool: tool.to_owned(),
                allowed: false,
                required_permissions: Vec::new(),
                mutating: false,
                audit_required: false,
                reason: format!("unknown tool '{tool}' — not registered"),
            };
        };

        let missing: Vec<Permission> = spec
            .required_permissions
            .iter()
            .copied()
            .filter(|p| !claims.has(*p))
            .collect();
        let allowed = missing.is_empty();
        // Mutating tools are always audited; read-only tools are audited when
        // they require any permission (i.e. touch governed data).
        let audit_required = spec.mutating || !spec.required_permissions.is_empty();
        let reason = if allowed {
            format!(
                "authorized; mutating={}, audited={audit_required}",
                spec.mutating
            )
        } else {
            format!("denied: caller lacks {missing:?}")
        };

        ToolRouteDecision {
            tool: tool.to_owned(),
            allowed,
            required_permissions: spec.required_permissions.clone(),
            mutating: spec.mutating,
            audit_required,
            reason,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ToolRouter;
    use crate::permissions::{Claims, Permission};
    use crate::tools::{Tool, ToolRegistry, ToolSpec};
    use async_trait::async_trait;
    use std::sync::Arc;
    use uuid::Uuid;

    struct StubTool(ToolSpec);

    #[async_trait]
    impl Tool for StubTool {
        fn spec(&self) -> &ToolSpec {
            &self.0
        }
        async fn execute(
            &self,
            _args: serde_json::Value,
        ) -> crate::error::Result<serde_json::Value> {
            Ok(serde_json::Value::Null)
        }
    }

    fn registry_with_bim_write() -> ToolRegistry {
        let mut reg = ToolRegistry::new();
        reg.register(Arc::new(StubTool(ToolSpec {
            name: "bim_write".to_owned(),
            description: "mutating BIM tool".to_owned(),
            parameters_schema: serde_json::json!({}),
            required_permissions: vec![Permission::BimWrite],
            mutating: true,
        })));
        reg
    }

    fn claims_with(roles: Vec<crate::permissions::Role>) -> Claims {
        Claims {
            sub: "u".to_owned(),
            tenant_id: Uuid::nil(),
            roles,
            iss: "architoken".to_owned(),
            exp: 9_999_999_999,
            iat: 0,
        }
    }

    #[test]
    fn unknown_tool_is_not_allowed() {
        let reg = ToolRegistry::new();
        let decision = ToolRouter::new(&reg).route("nope", &claims_with(vec![]));
        assert!(!decision.allowed);
    }

    #[test]
    fn missing_permission_is_denied() {
        let reg = registry_with_bim_write();
        // Constructor has no BimWrite.
        let decision = ToolRouter::new(&reg).route(
            "bim_write",
            &claims_with(vec![crate::permissions::Role::Constructor]),
        );
        assert!(!decision.allowed);
        assert!(
            decision
                .required_permissions
                .contains(&Permission::BimWrite)
        );
    }

    #[test]
    fn authorized_mutating_tool_requires_audit() {
        let reg = registry_with_bim_write();
        let decision = ToolRouter::new(&reg).route(
            "bim_write",
            &claims_with(vec![crate::permissions::Role::Designer]),
        );
        assert!(decision.allowed, "designer has BimWrite");
        assert!(decision.mutating);
        assert!(decision.audit_required);
    }
}
