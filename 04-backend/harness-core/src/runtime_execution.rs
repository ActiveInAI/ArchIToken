//! Phase 7 runtime execution contract types.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::{Result, durable_store::DurableRecordMetadata, module_pagination::ListPage};

/// Runtime execution kind.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeExecutionKind {
    /// AI command draft.
    AiCommandDraft,
    /// Query plan.
    QueryPlan,
    /// Action plan.
    ActionPlan,
    /// Conversion orchestration.
    Conversion,
    /// Viewer command orchestration.
    ViewerCommand,
}

/// Runtime execution status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeExecutionStatus {
    /// Draft execution.
    Draft,
    /// Waiting for approval.
    PendingApproval,
    /// Queued for worker execution.
    Queued,
    /// Running.
    Running,
    /// Completed.
    Completed,
    /// Failed.
    Failed,
    /// Cancelled.
    Cancelled,
}

/// Durable runtime execution record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeExecutionRecord {
    /// Common database metadata.
    pub metadata: DurableRecordMetadata,
    /// Stable external execution id.
    pub execution_id: Uuid,
    /// Execution kind.
    pub kind: RuntimeExecutionKind,
    /// Provider id.
    pub provider: String,
    /// Execution status.
    pub status: RuntimeExecutionStatus,
    /// Input payload.
    pub input: Value,
    /// Output payload.
    pub output: Value,
    /// Trace payload.
    pub trace: Value,
    /// Optional start timestamp.
    pub started_at: Option<DateTime<Utc>>,
    /// Optional finish timestamp.
    pub finished_at: Option<DateTime<Utc>>,
}

/// Runtime execution durable store boundary.
pub trait RuntimeExecutionStore: Send + Sync {
    /// Put or replace one runtime execution.
    ///
    /// # Errors
    /// Returns a harness error when the adapter rejects the record.
    fn put_execution(&self, record: RuntimeExecutionRecord) -> Result<RuntimeExecutionRecord>;

    /// List executions by tenant/project with deterministic pagination.
    ///
    /// # Errors
    /// Returns a harness error for invalid pagination.
    fn list_executions(
        &self,
        tenant_id: &str,
        project_id: &str,
        limit: Option<usize>,
        cursor: Option<&str>,
    ) -> Result<ListPage<RuntimeExecutionRecord>>;
}

#[cfg(test)]
mod tests {
    use super::{RuntimeExecutionKind, RuntimeExecutionStatus};

    #[test]
    fn runtime_execution_contract_serializes_snake_case() {
        assert_eq!(
            serde_json::to_value(RuntimeExecutionKind::AiCommandDraft).expect("kind serializes"),
            serde_json::json!("ai_command_draft")
        );
        assert_eq!(
            serde_json::to_value(RuntimeExecutionStatus::PendingApproval)
                .expect("status serializes"),
            serde_json::json!("pending_approval")
        );
    }
}
