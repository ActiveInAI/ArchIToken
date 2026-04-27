//! Permissions, RBAC, and tenant isolation.
//!
//! Implements Constitution §16 (multi-tenant hard isolation) and
//! authenticates `JWT` bearer tokens issued by Supabase Auth 2.188.1.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;

use crate::config::AuthConfig;
use crate::error::{HarnessError, Result};

/// A tenant in the multi-tenant system.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TenantId(pub Uuid);

/// An authenticated user's subject identifier.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct UserId(pub String);

/// A role assigned to a user within a tenant.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    /// 甲方 (Owner/client)
    Owner,
    /// 设计院 (Design institute)
    Designer,
    /// 施工方 (Constructor)
    Constructor,
    /// 监理 (Supervisor)
    Supervisor,
    /// 造价 (Cost consultant)
    CostConsultant,
    /// Read-only auditor
    Auditor,
    /// Platform admin (`InsomeOS`-internal)
    Admin,
}

/// A permission scope.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    /// Read project metadata and lifecycle state.
    ProjectsRead,
    /// Create or modify project metadata and lifecycle state.
    ProjectsWrite,
    /// Read `BIM` models and related metadata.
    BimRead,
    /// Create or modify `BIM` models and related metadata.
    BimWrite,
    /// Invoke approved AI agents and tools.
    AgentsInvoke,
    /// Read bill-of-quantities data.
    BoqRead,
    /// Create or modify bill-of-quantities data.
    BoqWrite,
    /// Run standards and compliance review workflows.
    ComplianceReview,
    /// Full platform administration permission.
    AdminAll,
}

/// `JWT` claims decoded from Supabase Auth.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Subject identifier.
    pub sub: String,
    /// Tenant identifier used for isolation checks.
    pub tenant_id: Uuid,
    /// Roles granted to the subject.
    pub roles: Vec<Role>,
    /// Token issuer.
    pub iss: String,
    /// Expiration timestamp.
    pub exp: u64,
    /// Issued-at timestamp.
    pub iat: u64,
}

impl Claims {
    /// Compute the set of permissions this user has.
    #[must_use]
    pub fn permissions(&self) -> HashSet<Permission> {
        let mut perms = HashSet::new();
        for role in &self.roles {
            perms.extend(role_permissions(*role));
        }
        perms
    }

    /// Check if the user holds a specific permission.
    #[must_use]
    pub fn has(&self, p: Permission) -> bool {
        self.permissions().contains(&p)
    }
}

fn role_permissions(role: Role) -> Vec<Permission> {
    use Permission::{
        AdminAll, AgentsInvoke, BimRead, BimWrite, BoqRead, BoqWrite, ComplianceReview,
        ProjectsRead, ProjectsWrite,
    };
    match role {
        Role::Admin => vec![AdminAll],
        Role::Owner => vec![
            ProjectsRead,
            ProjectsWrite,
            BimRead,
            BoqRead,
            ComplianceReview,
            AgentsInvoke,
        ],
        Role::Designer => vec![
            ProjectsRead,
            BimRead,
            BimWrite,
            ComplianceReview,
            AgentsInvoke,
        ],
        Role::Constructor | Role::Auditor => vec![ProjectsRead, BimRead, BoqRead],
        Role::Supervisor => vec![ProjectsRead, BimRead, ComplianceReview],
        Role::CostConsultant => vec![ProjectsRead, BimRead, BoqRead, BoqWrite],
    }
}

/// Validate a JWT bearer token against the configured auth settings.
///
/// # Errors
/// Returns `HarnessError::Unauthorized` for any validation failure.
pub fn verify_jwt(token: &str, cfg: &AuthConfig) -> Result<Claims> {
    use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};

    let key = DecodingKey::from_secret(cfg.jwt_secret.as_bytes());
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_issuer(&[&cfg.jwt_issuer]);

    let data = decode::<Claims>(token, &key, &validation)
        .map_err(|e| HarnessError::Unauthorized(format!("jwt: {e}")))?;

    Ok(data.claims)
}

/// Assert that a caller belongs to the given tenant.
///
/// # Errors
/// Returns `HarnessError::TenantIsolation` on mismatch.
pub fn assert_tenant(claims: &Claims, expected: TenantId) -> Result<()> {
    if TenantId(claims.tenant_id) != expected {
        return Err(HarnessError::TenantIsolation(format!(
            "user tenant {} != requested {}",
            claims.tenant_id, expected.0
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn owner_has_compliance_review() {
        let claims = Claims {
            sub: "u1".into(),
            tenant_id: Uuid::new_v4(),
            roles: vec![Role::Owner],
            iss: "insomeos".into(),
            exp: 9_999_999_999,
            iat: 0,
        };
        assert!(claims.has(Permission::ComplianceReview));
        assert!(!claims.has(Permission::AdminAll));
    }

    #[test]
    fn admin_has_all() {
        let claims = Claims {
            sub: "admin".into(),
            tenant_id: Uuid::new_v4(),
            roles: vec![Role::Admin],
            iss: "insomeos".into(),
            exp: 9_999_999_999,
            iat: 0,
        };
        assert!(claims.has(Permission::AdminAll));
    }
}
