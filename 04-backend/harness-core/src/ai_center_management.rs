//! AI center management contracts.
//!
//! These records are tenant-scoped `PostgreSQL` state for AI interface contracts,
//! database bindings, and visualization panels. The frontend must read and write
//! these routes instead of rendering hardcoded management cards.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Stable module id for AI center management records.
pub const AI_CENTER_MODULE_ID: &str = "ai_center";

/// Valid management status values.
pub const AI_CENTER_MANAGEMENT_STATUSES: &[&str] =
    &["draft", "configured", "review", "approved", "disabled"];

/// Interface contract row.
#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AiCenterInterfaceContract {
    /// Record id.
    pub id: Uuid,
    /// Tenant id.
    pub tenant_id: Uuid,
    /// Module id, always `ai_center`.
    pub module_id: String,
    /// Stable natural key.
    pub contract_key: String,
    /// Display name.
    pub name: String,
    /// HTTP method.
    pub method: String,
    /// API path.
    pub path: String,
    /// Business/system boundary.
    pub boundary: String,
    /// Auth policy.
    pub auth_policy: String,
    /// Backing data object.
    pub data_object: String,
    /// Owner role.
    pub owner_role: String,
    /// Workflow status.
    pub status: String,
    /// Metadata.
    pub metadata: serde_json::Value,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Database binding row.
#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AiCenterDatabaseBinding {
    /// Record id.
    pub id: Uuid,
    /// Tenant id.
    pub tenant_id: Uuid,
    /// Module id, always `ai_center`.
    pub module_id: String,
    /// Stable natural key.
    pub binding_key: String,
    /// Display name.
    pub name: String,
    /// Database object name.
    pub object_name: String,
    /// Storage adapter.
    pub storage_adapter: String,
    /// Lifecycle policy.
    pub lifecycle_policy: String,
    /// RLS policy description.
    pub rls_policy: String,
    /// Owner role.
    pub owner_role: String,
    /// Workflow status.
    pub status: String,
    /// Metadata.
    pub metadata: serde_json::Value,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Visualization panel row.
#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AiCenterVisualizationPanel {
    /// Record id.
    pub id: Uuid,
    /// Tenant id.
    pub tenant_id: Uuid,
    /// Module id, always `ai_center`.
    pub module_id: String,
    /// Stable natural key.
    pub panel_key: String,
    /// Display name.
    pub name: String,
    /// Dataset contract.
    pub dataset: String,
    /// View mode.
    pub view_mode: String,
    /// Refresh policy.
    pub refresh_policy: String,
    /// Readiness from 0 to 100.
    pub readiness: i32,
    /// Owner role.
    pub owner_role: String,
    /// Workflow status.
    pub status: String,
    /// Metadata.
    pub metadata: serde_json::Value,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Combined AI center management response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCenterManagementResponse {
    /// Interface contracts.
    pub interface_contracts: Vec<AiCenterInterfaceContract>,
    /// Database bindings.
    pub database_bindings: Vec<AiCenterDatabaseBinding>,
    /// Visualization panels.
    pub visualization_panels: Vec<AiCenterVisualizationPanel>,
}

/// Status/metadata update request shared by all management resources.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCenterManagementUpdateRequest {
    /// Optional status update.
    pub status: Option<String>,
    /// Optional metadata patch merged into the existing JSON object.
    pub metadata: Option<serde_json::Value>,
}

impl AiCenterManagementUpdateRequest {
    /// Return a normalized validated status.
    ///
    /// # Errors
    /// Returns [`crate::error::HarnessError::InvalidInput`] when the supplied
    /// status is not one of the AI center management lifecycle values.
    pub fn normalized_status(&self) -> crate::error::Result<Option<String>> {
        let Some(status) = self.status.as_deref() else {
            return Ok(None);
        };
        let status = status.trim().to_ascii_lowercase();
        if AI_CENTER_MANAGEMENT_STATUSES.contains(&status.as_str()) {
            Ok(Some(status))
        } else {
            Err(crate::error::HarnessError::InvalidInput(format!(
                "unsupported AI center management status: {status}"
            )))
        }
    }

    /// Return metadata patch object or an empty object.
    #[must_use]
    pub fn metadata_patch(&self) -> serde_json::Value {
        self.metadata
            .clone()
            .filter(serde_json::Value::is_object)
            .unwrap_or_else(|| serde_json::json!({}))
    }
}
