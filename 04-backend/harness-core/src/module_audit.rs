//! Append-only module audit event service.
//!
//! The implementation is intentionally in-memory for the Phase 2 API skeleton.
//! It establishes the API and service boundary that can later move behind an
//! `EventStore` without changing gateway handlers.

use std::sync::Arc;

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::{HarnessError, Result},
    module_pagination::{ListPage, paginate},
    module_registry::normalize_module_id,
};

/// Auditable action emitted by file, lifecycle, approval, generation, and workflow services.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventKind {
    /// A module file or folder was created.
    FileCreated,
    /// A module file or folder was updated.
    FileUpdated,
    /// A module file or folder was moved.
    FileMoved,
    /// A module file or folder was copied.
    FileCopied,
    /// A module file or folder was shared.
    FileShared,
    /// A module file or folder was soft-deleted.
    FileTrashed,
    /// In-memory file content was updated.
    FileContentUpdated,
    /// A lifecycle transaction was created.
    TransactionCreated,
    /// A lifecycle transaction state transition was applied.
    TransactionTransitioned,
    /// A lifecycle transaction was approved.
    TransactionApproved,
    /// A lifecycle transaction was rejected.
    TransactionRejected,
    /// A generation job was created.
    GenerationJobCreated,
    /// A generation job was planned.
    GenerationJobPlanned,
    /// A generation job mock pipeline was run.
    GenerationJobRun,
    /// A generation job was reviewed.
    GenerationJobReviewed,
    /// A generation job was approved.
    GenerationJobApproved,
    /// A generation job was rejected.
    GenerationJobRejected,
    /// A generation artifact was created.
    GenerationArtifactCreated,
    /// A generation pipeline stage completed.
    GenerationStageCompleted,
}

/// Append-only audit event exposed through `GET /v1/audit-events`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEvent {
    /// Audit event id.
    pub id: Uuid,
    /// Active module id after alias normalization.
    pub module_id: String,
    /// Actor that triggered the event.
    pub actor: String,
    /// Event kind.
    pub action: AuditEventKind,
    /// Logical target type such as `file` or `transaction`.
    pub target_type: String,
    /// Logical target id.
    pub target_id: String,
    /// Human-readable event summary.
    pub summary: String,
    /// Small structured details reserved for adapters and UI traces.
    pub metadata: serde_json::Value,
    /// Server-side event timestamp.
    pub created_at: DateTime<Utc>,
}

/// Query shape used by `GET /v1/audit-events`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuditEventQuery {
    /// Optional active module id or legacy alias filter.
    pub module_id: Option<String>,
    /// Optional target type filter such as `file` or `transaction`.
    pub target_type: Option<String>,
    /// Optional target id filter.
    pub target_id: Option<String>,
    /// Optional actor filter.
    pub actor: Option<String>,
    /// Optional maximum number of events to return.
    pub limit: Option<usize>,
    /// Optional numeric cursor offset.
    pub cursor: Option<String>,
}

/// Input used by services when appending an audit event.
#[derive(Debug, Clone)]
pub struct AuditEventInput {
    /// Active module id after alias normalization.
    pub module_id: String,
    /// Actor that triggered the event.
    pub actor: String,
    /// Event kind.
    pub action: AuditEventKind,
    /// Logical target type such as `file` or `transaction`.
    pub target_type: String,
    /// Logical target id.
    pub target_id: String,
    /// Human-readable event summary.
    pub summary: String,
    /// Small structured details reserved for adapters and UI traces.
    pub metadata: serde_json::Value,
}

/// In-memory append-only audit service.
#[derive(Debug, Clone, Default)]
pub struct ModuleAuditService {
    events: Arc<RwLock<Vec<AuditEvent>>>,
}

impl ModuleAuditService {
    /// Create an empty audit service.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Append one audit event and return the stored record.
    #[must_use]
    pub fn append(&self, input: AuditEventInput) -> AuditEvent {
        let event = AuditEvent {
            id: Uuid::new_v4(),
            module_id: input.module_id,
            actor: input.actor,
            action: input.action,
            target_type: input.target_type,
            target_id: input.target_id,
            summary: input.summary,
            metadata: input.metadata,
            created_at: Utc::now(),
        };
        self.events.write().push(event.clone());
        event
    }

    /// List audit events in insertion order.
    /// List audit events in insertion order.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the optional module id cannot be
    /// normalized and [`HarnessError::InvalidInput`] for an invalid cursor.
    pub fn list(&self, query: &AuditEventQuery) -> Result<ListPage<AuditEvent>> {
        let normalized_module_id = query
            .module_id
            .as_deref()
            .map(|id| {
                normalize_module_id(id)
                    .ok_or_else(|| HarnessError::NotFound(format!("module_id={id}")))
            })
            .transpose()?;

        let items: Vec<AuditEvent> = self
            .events
            .read()
            .iter()
            .filter(|event| {
                normalized_module_id
                    .as_ref()
                    .is_none_or(|module_id| event.module_id == module_id.as_str())
            })
            .filter(|event| {
                query
                    .target_type
                    .as_ref()
                    .is_none_or(|target_type| &event.target_type == target_type)
            })
            .filter(|event| {
                query
                    .target_id
                    .as_ref()
                    .is_none_or(|target_id| &event.target_id == target_id)
            })
            .filter(|event| {
                query
                    .actor
                    .as_ref()
                    .is_none_or(|actor| &event.actor == actor)
            })
            .cloned()
            .collect();
        paginate(&items, query.limit, query.cursor.as_deref())
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{AuditEventInput, AuditEventKind, AuditEventQuery, ModuleAuditService};

    #[test]
    fn audit_events_append_and_list() {
        let audit = ModuleAuditService::new();
        let _event = audit.append(AuditEventInput {
            module_id: "production_manufacturing".to_owned(),
            actor: "tester".to_owned(),
            action: AuditEventKind::FileCreated,
            target_type: "file".to_owned(),
            target_id: "file-1".to_owned(),
            summary: "created file".to_owned(),
            metadata: json!({ "name": "cnc.nc" }),
        });

        let events = audit
            .list(&AuditEventQuery {
                module_id: Some("production_manufacturing".to_owned()),
                target_type: Some("file".to_owned()),
                target_id: Some("file-1".to_owned()),
                actor: Some("tester".to_owned()),
                limit: Some(10),
                cursor: None,
            })
            .expect("audit list should work");

        assert_eq!(events.items.len(), 1);
        assert_eq!(events.items[0].action, AuditEventKind::FileCreated);
    }
}
