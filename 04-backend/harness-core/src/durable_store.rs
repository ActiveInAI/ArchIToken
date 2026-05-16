//! Durable store contracts for Phase 7 database-backed runtime records.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::{Result, module_pagination::ListPage};

/// Common database record metadata.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DurableRecordMetadata {
    /// Stable row id.
    pub id: Uuid,
    /// Tenant id for isolation.
    pub tenant_id: String,
    /// Project id for isolation.
    pub project_id: Option<String>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
    /// Actor that created the row.
    pub created_by: Option<String>,
}

impl DurableRecordMetadata {
    /// Build deterministic test/dev metadata.
    #[must_use]
    pub fn new(
        tenant_id: impl Into<String>,
        project_id: Option<String>,
        actor: Option<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            tenant_id: tenant_id.into(),
            project_id,
            created_at: now,
            updated_at: now,
            created_by: actor,
        }
    }
}

/// Runtime table names managed by the Phase 7 migration.
pub const PHASE7_TABLES: &[&str] = &[
    "tenants",
    "projects",
    "assets",
    "asset_versions",
    "asset_files",
    "object_store_bindings",
    "conversion_jobs",
    "module_files",
    "runtime_executions",
    "audit_events",
];

/// Tenant database record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TenantRecord {
    /// Common metadata.
    pub metadata: DurableRecordMetadata,
    /// Tenant display name.
    pub name: String,
    /// Extensible JSON metadata.
    pub payload: Value,
}

/// Project database record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRecord {
    /// Common metadata.
    pub metadata: DurableRecordMetadata,
    /// Project display name.
    pub name: String,
    /// Extensible JSON metadata.
    pub payload: Value,
}

/// Durable tenant/project store adapter.
pub trait TenantProjectStore: Send + Sync {
    /// Create or replace a tenant record.
    ///
    /// # Errors
    /// Returns a harness error when the store rejects the record.
    fn put_tenant(&self, record: TenantRecord) -> Result<TenantRecord>;

    /// Create or replace a project record.
    ///
    /// # Errors
    /// Returns a harness error when the store rejects the record.
    fn put_project(&self, record: ProjectRecord) -> Result<ProjectRecord>;

    /// List projects by tenant with deterministic pagination.
    ///
    /// # Errors
    /// Returns a harness error when pagination is invalid.
    fn list_projects(
        &self,
        tenant_id: &str,
        limit: Option<usize>,
        cursor: Option<&str>,
    ) -> Result<ListPage<ProjectRecord>>;
}

/// Durable audit event store adapter.
pub trait DurableAuditStore: Send + Sync {
    /// Append one audit event payload.
    ///
    /// # Errors
    /// Returns a harness error when append fails.
    fn append_audit_event(&self, metadata: DurableRecordMetadata, payload: Value) -> Result<Uuid>;
}

#[cfg(test)]
mod tests {
    use super::PHASE7_TABLES;

    #[test]
    fn phase7_table_manifest_contains_required_tables() {
        for table in [
            "tenants",
            "projects",
            "assets",
            "asset_versions",
            "asset_files",
            "object_store_bindings",
            "conversion_jobs",
            "module_files",
            "runtime_executions",
            "audit_events",
        ] {
            assert!(PHASE7_TABLES.contains(&table));
        }
    }
}
