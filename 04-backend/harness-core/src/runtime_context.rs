//! Runtime request context, tenant/project scope, and preview RBAC guard.
//!
//! This module is deliberately adapter-free. It models the durable runtime
//! boundary used by HTTP handlers and in-memory services today, while leaving
//! JWT, database-backed policy, and external identity providers replaceable.

use std::{collections::HashSet, fmt};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::{HarnessError, Result},
    storage_router::StoreRecordMetadata,
};

/// Header carrying the active tenant id.
pub const HEADER_TENANT_ID: &str = "x-tenant-id";
/// Header carrying the active project id.
pub const HEADER_PROJECT_ID: &str = "x-project-id";
/// Header carrying the actor id.
pub const HEADER_ACTOR: &str = "x-actor";
/// Header carrying comma-separated runtime roles.
pub const HEADER_ROLES: &str = "x-roles";
/// Header carrying the request id.
pub const HEADER_REQUEST_ID: &str = "x-request-id";
/// Header carrying the correlation id.
pub const HEADER_CORRELATION_ID: &str = "x-correlation-id";

const DEV_TENANT_ID: &str = "dev-tenant";
const DEV_PROJECT_ID: &str = "dev-project";
const DEV_ACTOR: &str = "dev-actor";

/// Runtime profile used to decide whether weak dev context fallback is allowed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeProfile {
    /// Local development preview. Missing context may use deterministic dev fallback.
    Development,
    /// Production-like profile. Tenant/project/actor/roles must be explicit.
    Production,
}

impl RuntimeProfile {
    /// Build a profile from `ARCHITOKEN_PROFILE` or equivalent config value.
    #[must_use]
    pub fn from_profile_name(value: &str) -> Self {
        match value.trim().to_ascii_lowercase().as_str() {
            "production" | "prod" | "staging" | "preview" => Self::Production,
            _ => Self::Development,
        }
    }

    /// Whether weak local fallback is allowed.
    #[must_use]
    pub const fn allows_weak_fallback(self) -> bool {
        matches!(self, Self::Development)
    }

    /// Stable lowercase profile name for readiness and metrics contracts.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Development => "development",
            Self::Production => "production",
        }
    }
}

/// Runtime RBAC role used by Phase 6 preview policy.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeRole {
    /// Full access.
    Admin,
    /// Engineering author allowed to create/run/write preview resources.
    Engineer,
    /// Reviewer allowed to review/approve/read resources.
    Reviewer,
    /// Read-only auditor.
    Auditor,
}

impl RuntimeRole {
    /// Parse a role string from headers/query/body values.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when the role is unknown.
    pub fn parse(value: &str) -> Result<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "admin" => Ok(Self::Admin),
            "engineer" => Ok(Self::Engineer),
            "reviewer" => Ok(Self::Reviewer),
            "auditor" => Ok(Self::Auditor),
            unknown => Err(HarnessError::InvalidInput(format!(
                "unknown runtime role: {unknown}"
            ))),
        }
    }
}

impl fmt::Display for RuntimeRole {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            Self::Admin => "admin",
            Self::Engineer => "engineer",
            Self::Reviewer => "reviewer",
            Self::Auditor => "auditor",
        };
        f.write_str(value)
    }
}

/// Runtime permission checked by the Phase 6 preview guard.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimePermission {
    /// `artifact:read`.
    #[serde(rename = "artifact:read")]
    ArtifactRead,
    /// `artifact:write`.
    #[serde(rename = "artifact:write")]
    ArtifactWrite,
    /// `asset:read`.
    #[serde(rename = "asset:read")]
    AssetRead,
    /// `asset:write`.
    #[serde(rename = "asset:write")]
    AssetWrite,
    /// `asset:delete`.
    #[serde(rename = "asset:delete")]
    AssetDelete,
    /// `asset:approve`.
    #[serde(rename = "asset:approve")]
    AssetApprove,
    /// `conversion:run`.
    #[serde(rename = "conversion:run")]
    ConversionRun,
    /// `generation:create`.
    #[serde(rename = "generation:create")]
    GenerationCreate,
    /// `generation:run`.
    #[serde(rename = "generation:run")]
    GenerationRun,
    /// `generation:review`.
    #[serde(rename = "generation:review")]
    GenerationReview,
    /// `generation:approve`.
    #[serde(rename = "generation:approve")]
    GenerationApprove,
    /// `registry:read`.
    #[serde(rename = "registry:read")]
    RegistryRead,
    /// `registry:write`.
    #[serde(rename = "registry:write")]
    RegistryWrite,
    /// `registry:approve`.
    #[serde(rename = "registry:approve")]
    RegistryApprove,
    /// `viewer:command:create`.
    #[serde(rename = "viewer:command:create")]
    ViewerCommandCreate,
    /// `viewer:command:ack`.
    #[serde(rename = "viewer:command:ack")]
    ViewerCommandAck,
    /// `knowledge:ingest`.
    #[serde(rename = "knowledge:ingest")]
    KnowledgeIngest,
}

impl fmt::Display for RuntimePermission {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            Self::ArtifactRead => "artifact:read",
            Self::ArtifactWrite => "artifact:write",
            Self::AssetRead => "asset:read",
            Self::AssetWrite => "asset:write",
            Self::AssetDelete => "asset:delete",
            Self::AssetApprove => "asset:approve",
            Self::ConversionRun => "conversion:run",
            Self::GenerationCreate => "generation:create",
            Self::GenerationRun => "generation:run",
            Self::GenerationReview => "generation:review",
            Self::GenerationApprove => "generation:approve",
            Self::RegistryRead => "registry:read",
            Self::RegistryWrite => "registry:write",
            Self::RegistryApprove => "registry:approve",
            Self::ViewerCommandCreate => "viewer:command:create",
            Self::ViewerCommandAck => "viewer:command:ack",
            Self::KnowledgeIngest => "knowledge:ingest",
        };
        f.write_str(value)
    }
}

/// Context fields accepted from headers, query params, or request bodies.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RequestContextInput {
    /// Tenant id candidate.
    pub tenant_id: Option<String>,
    /// Project id candidate.
    pub project_id: Option<String>,
    /// Actor candidate.
    pub actor: Option<String>,
    /// Runtime roles candidate.
    pub roles: Option<Vec<String>>,
    /// Request id candidate.
    pub request_id: Option<String>,
    /// Correlation id candidate.
    pub correlation_id: Option<String>,
}

impl RequestContextInput {
    /// Fill unset fields from a lower-priority source.
    #[must_use]
    pub fn with_fallback(mut self, fallback: &Self) -> Self {
        if self.tenant_id.is_none() {
            self.tenant_id.clone_from(&fallback.tenant_id);
        }
        if self.project_id.is_none() {
            self.project_id.clone_from(&fallback.project_id);
        }
        if self.actor.is_none() {
            self.actor.clone_from(&fallback.actor);
        }
        if self.roles.is_none() {
            self.roles.clone_from(&fallback.roles);
        }
        if self.request_id.is_none() {
            self.request_id.clone_from(&fallback.request_id);
        }
        if self.correlation_id.is_none() {
            self.correlation_id.clone_from(&fallback.correlation_id);
        }
        self
    }
}

/// Tenant/project/actor context carried through runtime services.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestContext {
    /// Tenant id.
    pub tenant_id: String,
    /// Project id.
    pub project_id: String,
    /// Actor id.
    pub actor: String,
    /// Runtime roles.
    pub roles: Vec<RuntimeRole>,
    /// Request id.
    pub request_id: String,
    /// Correlation id.
    pub correlation_id: String,
}

impl RequestContext {
    /// Deterministic local dev admin context used by unit tests.
    #[must_use]
    pub fn development_admin() -> Self {
        Self {
            tenant_id: DEV_TENANT_ID.to_owned(),
            project_id: DEV_PROJECT_ID.to_owned(),
            actor: DEV_ACTOR.to_owned(),
            roles: vec![RuntimeRole::Admin],
            request_id: "dev-request".to_owned(),
            correlation_id: "dev-correlation".to_owned(),
        }
    }

    /// Build a context from merged request inputs.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when required production context
    /// fields are missing or role names are unknown.
    pub fn from_input(input: RequestContextInput, profile: RuntimeProfile) -> Result<Self> {
        let allow_fallback = profile.allows_weak_fallback();
        let tenant_id =
            required_or_dev(input.tenant_id, "tenant_id", DEV_TENANT_ID, allow_fallback)?;
        let project_id = required_or_dev(
            input.project_id,
            "project_id",
            DEV_PROJECT_ID,
            allow_fallback,
        )?;
        let actor = required_or_dev(input.actor, "actor", DEV_ACTOR, allow_fallback)?;
        let roles = match input.roles {
            Some(values) if !values.is_empty() => parse_roles(values)?,
            Some(_) | None if allow_fallback => vec![RuntimeRole::Admin],
            Some(_) | None => {
                return Err(HarnessError::InvalidInput(
                    "roles are required in production runtime context".to_owned(),
                ));
            }
        };
        Ok(Self {
            tenant_id,
            project_id,
            actor,
            roles,
            request_id: optional_or_generated(input.request_id, "request"),
            correlation_id: optional_or_generated(input.correlation_id, "correlation"),
        })
    }

    /// Convert context to durable-store metadata.
    #[must_use]
    pub fn store_metadata(&self, owner: impl Into<String>) -> StoreRecordMetadata {
        StoreRecordMetadata::new(
            owner.into(),
            self.tenant_id.clone(),
            self.project_id.clone(),
            self.request_id.clone(),
            self.correlation_id.clone(),
        )
    }

    /// JSON representation used in audit payloads and artifact metadata.
    #[must_use]
    pub fn audit_json(&self) -> serde_json::Value {
        serde_json::json!({
            "tenantId": self.tenant_id,
            "projectId": self.project_id,
            "actor": self.actor,
            "roles": self.roles.iter().map(ToString::to_string).collect::<Vec<_>>(),
            "requestId": self.request_id,
            "correlationId": self.correlation_id
        })
    }
}

/// Permission decision emitted by the preview guard.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionDecision {
    /// Whether the permission was allowed.
    pub allowed: bool,
    /// Permission being checked.
    pub permission: RuntimePermission,
    /// Actor being checked.
    pub actor: String,
    /// Roles used for the decision.
    pub roles: Vec<RuntimeRole>,
    /// Tenant id.
    pub tenant_id: String,
    /// Project id.
    pub project_id: String,
    /// Request id.
    pub request_id: String,
    /// Correlation id.
    pub correlation_id: String,
    /// Optional denial reason.
    pub reason: Option<String>,
}

impl PermissionDecision {
    fn from_context(
        context: &RequestContext,
        permission: RuntimePermission,
        allowed: bool,
        reason: Option<String>,
    ) -> Self {
        Self {
            allowed,
            permission,
            actor: context.actor.clone(),
            roles: context.roles.clone(),
            tenant_id: context.tenant_id.clone(),
            project_id: context.project_id.clone(),
            request_id: context.request_id.clone(),
            correlation_id: context.correlation_id.clone(),
            reason,
        }
    }
}

/// In-memory role policy used until a durable policy store is wired.
#[derive(Debug, Clone, Default)]
pub struct PermissionGuard;

impl PermissionGuard {
    /// Return the decision for a permission check without throwing.
    #[must_use]
    pub fn decide(context: &RequestContext, permission: RuntimePermission) -> PermissionDecision {
        let allowed = allowed_permissions(&context.roles).contains(&permission);
        let reason = if allowed {
            None
        } else {
            Some(format!(
                "permission {permission} denied for actor {} roles {:?}",
                context.actor, context.roles
            ))
        };
        PermissionDecision::from_context(context, permission, allowed, reason)
    }

    /// Ensure the context is allowed to perform a permission.
    ///
    /// # Errors
    /// Returns [`HarnessError::SandboxDenied`] with HTTP 403 when denied.
    pub fn ensure(
        context: &RequestContext,
        permission: RuntimePermission,
    ) -> Result<PermissionDecision> {
        let decision = Self::decide(context, permission);
        if decision.allowed {
            return Ok(decision);
        }
        Err(HarnessError::SandboxDenied(
            serde_json::to_string(&decision).unwrap_or_else(|_| {
                format!("permission {permission} denied for actor {}", context.actor)
            }),
        ))
    }
}

/// Assert a record belongs to the request tenant/project.
///
/// # Errors
/// Returns [`HarnessError::TenantIsolation`] with HTTP 403 when scoped ids differ.
pub fn assert_runtime_scope(
    context: &RequestContext,
    tenant_id: &str,
    project_id: &str,
) -> Result<()> {
    if context.tenant_id == tenant_id && context.project_id == project_id {
        return Ok(());
    }
    Err(HarnessError::TenantIsolation(format!(
        "actor {} cannot access tenant/project {tenant_id}/{project_id}",
        context.actor
    )))
}

/// Parse comma-separated or repeated role values.
///
/// # Errors
/// Returns [`HarnessError::InvalidInput`] for unknown role names.
pub fn parse_roles(values: Vec<String>) -> Result<Vec<RuntimeRole>> {
    let mut roles = Vec::new();
    for value in values {
        for role in value.split(',') {
            let trimmed = role.trim();
            if !trimmed.is_empty() {
                roles.push(RuntimeRole::parse(trimmed)?);
            }
        }
    }
    if roles.is_empty() {
        return Err(HarnessError::InvalidInput(
            "at least one runtime role is required".to_owned(),
        ));
    }
    roles.sort_by_key(ToString::to_string);
    roles.dedup();
    Ok(roles)
}

fn allowed_permissions(roles: &[RuntimeRole]) -> HashSet<RuntimePermission> {
    use RuntimePermission::{
        ArtifactRead, ArtifactWrite, AssetApprove, AssetDelete, AssetRead, AssetWrite,
        ConversionRun, GenerationApprove, GenerationCreate, GenerationReview, GenerationRun,
        KnowledgeIngest, RegistryApprove, RegistryRead, RegistryWrite, ViewerCommandAck,
        ViewerCommandCreate,
    };

    let mut permissions = HashSet::new();
    for role in roles {
        match role {
            RuntimeRole::Admin => {
                permissions.extend([
                    ArtifactRead,
                    ArtifactWrite,
                    AssetRead,
                    AssetWrite,
                    AssetDelete,
                    AssetApprove,
                    ConversionRun,
                    GenerationCreate,
                    GenerationRun,
                    GenerationReview,
                    GenerationApprove,
                    RegistryRead,
                    RegistryWrite,
                    RegistryApprove,
                    ViewerCommandCreate,
                    ViewerCommandAck,
                    KnowledgeIngest,
                ]);
            }
            RuntimeRole::Engineer => {
                permissions.extend([
                    ArtifactRead,
                    ArtifactWrite,
                    AssetRead,
                    AssetWrite,
                    ConversionRun,
                    GenerationCreate,
                    GenerationRun,
                    RegistryRead,
                    RegistryWrite,
                    ViewerCommandCreate,
                ]);
            }
            RuntimeRole::Reviewer => {
                permissions.extend([
                    ArtifactRead,
                    AssetRead,
                    AssetApprove,
                    GenerationReview,
                    GenerationApprove,
                    RegistryRead,
                    RegistryApprove,
                ]);
            }
            RuntimeRole::Auditor => {
                permissions.extend([ArtifactRead, AssetRead, RegistryRead]);
            }
        }
    }
    permissions
}

fn required_or_dev(
    value: Option<String>,
    field: &str,
    dev_value: &str,
    allow_fallback: bool,
) -> Result<String> {
    let trimmed = value.and_then(|candidate| {
        let trimmed = candidate.trim().to_owned();
        (!trimmed.is_empty()).then_some(trimmed)
    });
    if let Some(value) = trimmed {
        return Ok(value);
    }
    if allow_fallback {
        return Ok(dev_value.to_owned());
    }
    Err(HarnessError::InvalidInput(format!(
        "{field} is required in production runtime context"
    )))
}

fn optional_or_generated(value: Option<String>, prefix: &str) -> String {
    value
        .and_then(|candidate| {
            let trimmed = candidate.trim().to_owned();
            (!trimmed.is_empty()).then_some(trimmed)
        })
        .unwrap_or_else(|| format!("{prefix}-{}", Uuid::new_v4()))
}

#[cfg(test)]
mod tests {
    use super::{
        PermissionGuard, RequestContext, RequestContextInput, RuntimePermission, RuntimeProfile,
        RuntimeRole, assert_runtime_scope,
    };

    #[test]
    fn context_header_body_fallback_parsing() {
        let header = RequestContextInput {
            tenant_id: Some("tenant-a".to_owned()),
            project_id: Some("project-a".to_owned()),
            actor: None,
            roles: None,
            request_id: Some("req-1".to_owned()),
            correlation_id: None,
        };
        let body = RequestContextInput {
            actor: Some("body-actor".to_owned()),
            roles: Some(vec!["engineer,reviewer".to_owned()]),
            correlation_id: Some("corr-1".to_owned()),
            ..RequestContextInput::default()
        };
        let context =
            RequestContext::from_input(header.with_fallback(&body), RuntimeProfile::Development)
                .expect("context should parse");
        assert_eq!(context.tenant_id, "tenant-a");
        assert_eq!(context.project_id, "project-a");
        assert_eq!(context.actor, "body-actor");
        assert_eq!(
            context.roles,
            vec![RuntimeRole::Engineer, RuntimeRole::Reviewer]
        );
        assert_eq!(context.request_id, "req-1");
        assert_eq!(context.correlation_id, "corr-1");
    }

    #[test]
    fn production_profile_rejects_weak_context_fallback() {
        let err = RequestContext::from_input(
            RequestContextInput {
                tenant_id: Some("tenant-a".to_owned()),
                ..RequestContextInput::default()
            },
            RuntimeProfile::Production,
        )
        .expect_err("project/actor/roles should be required");
        assert_eq!(err.http_status(), 400);
    }

    #[test]
    fn profile_name_parsing_is_case_insensitive() {
        assert_eq!(
            RuntimeProfile::from_profile_name("PRODUCTION"),
            RuntimeProfile::Production
        );
        assert_eq!(
            RuntimeProfile::from_profile_name("Production"),
            RuntimeProfile::Production
        );
        assert_eq!(
            RuntimeProfile::from_profile_name("STAGING"),
            RuntimeProfile::Production
        );
        assert_eq!(
            RuntimeProfile::from_profile_name("Development"),
            RuntimeProfile::Development
        );
    }

    #[test]
    fn uppercase_production_profile_rejects_weak_context_fallback() {
        let err = RequestContext::from_input(
            RequestContextInput {
                tenant_id: Some("tenant-a".to_owned()),
                ..RequestContextInput::default()
            },
            RuntimeProfile::from_profile_name("PRODUCTION"),
        )
        .expect_err("uppercase production profile must not allow development fallback");
        assert_eq!(err.http_status(), 400);
    }

    #[test]
    fn role_policy_matches_phase6_contract() {
        let mut context = RequestContext::development_admin();
        context.roles = vec![RuntimeRole::Engineer];
        assert!(PermissionGuard::ensure(&context, RuntimePermission::GenerationCreate).is_ok());
        assert!(PermissionGuard::ensure(&context, RuntimePermission::GenerationApprove).is_err());

        context.roles = vec![RuntimeRole::Reviewer];
        assert!(PermissionGuard::ensure(&context, RuntimePermission::GenerationApprove).is_ok());
        assert!(PermissionGuard::ensure(&context, RuntimePermission::GenerationCreate).is_err());

        context.roles = vec![RuntimeRole::Auditor];
        assert!(PermissionGuard::ensure(&context, RuntimePermission::ArtifactRead).is_ok());
        assert!(PermissionGuard::ensure(&context, RuntimePermission::RegistryWrite).is_err());
    }

    #[test]
    fn tenant_project_scope_is_enforced() {
        let context = RequestContext::from_input(
            RequestContextInput {
                tenant_id: Some("tenant-a".to_owned()),
                project_id: Some("project-a".to_owned()),
                actor: Some("actor-a".to_owned()),
                roles: Some(vec!["admin".to_owned()]),
                ..RequestContextInput::default()
            },
            RuntimeProfile::Production,
        )
        .expect("context should parse");
        assert!(assert_runtime_scope(&context, "tenant-a", "project-a").is_ok());
        let err =
            assert_runtime_scope(&context, "tenant-b", "project-a").expect_err("scope mismatch");
        assert_eq!(err.http_status(), 403);
    }
}
