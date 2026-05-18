//! Module lifecycle transaction and approval service.
//!
//! The service implements the documented workbench state machine.
//! It is intentionally deterministic: callers submit typed events instead of
//! arbitrary status strings.

use std::{collections::HashMap, sync::Arc};

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    error::{HarnessError, Result},
    module_audit::{AuditEventInput, AuditEventKind, ModuleAuditService},
    module_pagination::{ListPage, paginate},
    module_registry::normalize_module_id,
};

const DEFAULT_ACTOR: &str = "system";

/// Lifecycle status for module transactions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModuleTransactionStatus {
    /// Initial editable transaction state.
    Draft,
    /// Submitted for downstream workflow execution.
    Submitted,
    /// Generator stage is running or queued.
    Generating,
    /// Independent evaluator stage is running or queued.
    Evaluating,
    /// Deterministic rule checker stage is running or queued.
    RuleChecking,
    /// Schema validation stage is running or queued.
    SchemaValidating,
    /// Waiting for human or automated approval.
    PendingApproval,
    /// Transaction was approved.
    Approved,
    /// Transaction was archived.
    Archived,
    /// Transaction was rejected.
    Rejected,
    /// Transaction is blocked by an explicit issue.
    Blocked,
}

/// Typed lifecycle transition event.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModuleTransitionEvent {
    /// Creation event reserved for audit semantics.
    Create,
    /// Submit the transaction.
    Submit,
    /// Move into generator stage.
    Generate,
    /// Move into evaluator stage.
    Evaluate,
    /// Move into rule checker stage.
    RuleCheck,
    /// Move into schema validator stage.
    ValidateSchema,
    /// Request approval.
    RequestApproval,
    /// Approve the transaction.
    Approve,
    /// Reject the transaction.
    Reject,
    /// Archive the transaction.
    Archive,
    /// Reopen into draft.
    Reopen,
    /// Block the transaction.
    Block,
    /// Resolve blocker into submitted state.
    ResolveBlocker,
}

/// Approval decision stored on a transaction.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalDecision {
    /// Transaction was approved.
    Approved,
    /// Transaction was rejected.
    Rejected,
}

/// Approval record attached to a module transaction.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleApproval {
    /// Approval id.
    pub id: Uuid,
    /// Related transaction id.
    pub transaction_id: Uuid,
    /// Approver display name or user id.
    pub approver: String,
    /// Approval decision.
    pub decision: ApprovalDecision,
    /// Optional approval comment.
    pub comment: Option<String>,
    /// Decision timestamp.
    pub decided_at: DateTime<Utc>,
}

/// Lifecycle transaction record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleTransaction {
    /// Transaction id.
    pub id: Uuid,
    /// Active module id.
    pub module_id: String,
    /// Business transaction type.
    pub transaction_type: String,
    /// Current lifecycle status.
    pub status: ModuleTransactionStatus,
    /// Actor that created the transaction.
    pub actor: String,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
    /// Related file ids.
    pub related_file_ids: Vec<Uuid>,
    /// Related artifact ids.
    pub related_artifact_ids: Vec<String>,
    /// Approval records.
    pub approvals: Vec<ModuleApproval>,
}

/// Create transaction request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateModuleTransactionRequest {
    /// Active module id.
    pub module_id: String,
    /// Business transaction type.
    pub transaction_type: String,
    /// Actor creating the transaction.
    pub actor: Option<String>,
    /// Related file ids.
    pub related_file_ids: Option<Vec<Uuid>>,
    /// Related artifact ids.
    pub related_artifact_ids: Option<Vec<String>>,
}

/// Transition transaction request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleTransitionRequest {
    /// Typed transition event.
    pub event: ModuleTransitionEvent,
    /// Actor triggering the event.
    pub actor: Option<String>,
    /// Optional transition comment.
    pub comment: Option<String>,
}

/// Approval decision request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalDecisionRequest {
    /// Approver display name or user id.
    pub actor: String,
    /// Optional approval or rejection comment.
    pub comment: Option<String>,
}

/// Query shape used by `GET /v1/transactions`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
pub struct TransactionListQuery {
    /// Optional active module id.
    pub module_id: Option<String>,
    /// Optional transaction status filter.
    pub status: Option<ModuleTransactionStatus>,
    /// Optional page size.
    pub limit: Option<usize>,
    /// Optional numeric cursor offset.
    pub cursor: Option<String>,
}

/// In-memory lifecycle transaction service.
#[derive(Debug, Clone)]
pub struct ModuleLifecycleService {
    transactions: Arc<RwLock<HashMap<Uuid, ModuleTransaction>>>,
    audit: Arc<ModuleAuditService>,
}

impl ModuleLifecycleService {
    /// Create an empty lifecycle service.
    #[must_use]
    pub fn new(audit: Arc<ModuleAuditService>) -> Self {
        Self {
            transactions: Arc::new(RwLock::new(HashMap::new())),
            audit,
        }
    }

    /// Create a lifecycle transaction in `draft`.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the module id cannot be normalized
    /// and [`HarnessError::InvalidInput`] when the transaction type is empty.
    pub fn create_transaction(
        &self,
        req: CreateModuleTransactionRequest,
    ) -> Result<ModuleTransaction> {
        let module_id = normalize_module_id(&req.module_id)
            .ok_or_else(|| HarnessError::NotFound(format!("module_id={}", req.module_id)))?;
        if req.transaction_type.trim().is_empty() {
            return Err(HarnessError::InvalidInput(
                "transaction_type is required".to_owned(),
            ));
        }

        let now = Utc::now();
        let transaction = ModuleTransaction {
            id: Uuid::new_v4(),
            module_id: module_id.as_str().to_owned(),
            transaction_type: req.transaction_type,
            status: ModuleTransactionStatus::Draft,
            actor: req.actor.unwrap_or_else(|| DEFAULT_ACTOR.to_owned()),
            created_at: now,
            updated_at: now,
            related_file_ids: req.related_file_ids.unwrap_or_default(),
            related_artifact_ids: req.related_artifact_ids.unwrap_or_default(),
            approvals: Vec::new(),
        };
        self.transactions
            .write()
            .insert(transaction.id, transaction.clone());
        self.audit_transaction(
            &transaction,
            AuditEventKind::TransactionCreated,
            transaction.actor.clone(),
            "transaction created",
            json!({ "event": ModuleTransitionEvent::Create }),
        );
        Ok(transaction)
    }

    /// List transactions, optionally filtered by active module id.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the optional module id cannot be normalized.
    pub fn list_transactions(
        &self,
        query: &TransactionListQuery,
    ) -> Result<ListPage<ModuleTransaction>> {
        let normalized = query
            .module_id
            .as_deref()
            .map(|id| {
                normalize_module_id(id)
                    .ok_or_else(|| HarnessError::NotFound(format!("module_id={id}")))
            })
            .transpose()?;
        let items: Vec<ModuleTransaction> = self
            .transactions
            .read()
            .values()
            .filter(|transaction| {
                normalized
                    .as_ref()
                    .is_none_or(|module_id| transaction.module_id == module_id.as_str())
            })
            .filter(|transaction| {
                query
                    .status
                    .is_none_or(|status| transaction.status == status)
            })
            .cloned()
            .collect();
        paginate(&items, query.limit, query.cursor.as_deref())
    }

    /// Get one transaction.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the transaction id is unknown.
    pub fn get_transaction(&self, transaction_id: Uuid) -> Result<ModuleTransaction> {
        self.transactions
            .read()
            .get(&transaction_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("transaction_id={transaction_id}")))
    }

    /// Apply a typed state transition.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the transaction id is unknown and
    /// [`HarnessError::InvalidInput`] when the transition is not allowed.
    pub fn transition(
        &self,
        transaction_id: Uuid,
        req: ModuleTransitionRequest,
    ) -> Result<ModuleTransaction> {
        let actor = req.actor.unwrap_or_else(|| DEFAULT_ACTOR.to_owned());
        let event = req.event;
        let transaction = {
            let mut transactions = self.transactions.write();
            let transaction = transactions.get_mut(&transaction_id).ok_or_else(|| {
                HarnessError::NotFound(format!("transaction_id={transaction_id}"))
            })?;
            let next_status = next_module_transaction_status(transaction.status, event)
                .ok_or_else(|| {
                    HarnessError::InvalidInput(format!(
                        "invalid transition from {:?} via {:?}",
                        transaction.status, event
                    ))
                })?;
            transaction.status = next_status;
            transaction.updated_at = Utc::now();
            let transaction = transaction.clone();
            drop(transactions);
            transaction
        };
        self.audit_transaction(
            &transaction,
            AuditEventKind::TransactionTransitioned,
            actor,
            "transaction transitioned",
            json!({ "event": event, "comment": req.comment }),
        );
        Ok(transaction)
    }

    /// Approve a transaction and append an approval record.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the transaction id is unknown and
    /// [`HarnessError::InvalidInput`] when approval is not allowed from the current state.
    pub fn approve(
        &self,
        transaction_id: Uuid,
        req: ApprovalDecisionRequest,
    ) -> Result<ModuleTransaction> {
        self.decide(transaction_id, req, ApprovalDecision::Approved)
    }

    /// Reject a transaction and append an approval record.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the transaction id is unknown and
    /// [`HarnessError::InvalidInput`] when rejection is not allowed from the current state.
    pub fn reject(
        &self,
        transaction_id: Uuid,
        req: ApprovalDecisionRequest,
    ) -> Result<ModuleTransaction> {
        self.decide(transaction_id, req, ApprovalDecision::Rejected)
    }

    fn decide(
        &self,
        transaction_id: Uuid,
        req: ApprovalDecisionRequest,
        decision: ApprovalDecision,
    ) -> Result<ModuleTransaction> {
        let event = match decision {
            ApprovalDecision::Approved => ModuleTransitionEvent::Approve,
            ApprovalDecision::Rejected => ModuleTransitionEvent::Reject,
        };
        let audit_kind = match decision {
            ApprovalDecision::Approved => AuditEventKind::TransactionApproved,
            ApprovalDecision::Rejected => AuditEventKind::TransactionRejected,
        };
        let transaction = {
            let mut transactions = self.transactions.write();
            let transaction = transactions.get_mut(&transaction_id).ok_or_else(|| {
                HarnessError::NotFound(format!("transaction_id={transaction_id}"))
            })?;
            let next_status = next_module_transaction_status(transaction.status, event)
                .ok_or_else(|| {
                    HarnessError::InvalidInput(format!(
                        "invalid approval decision from {:?}",
                        transaction.status
                    ))
                })?;
            let approval = ModuleApproval {
                id: Uuid::new_v4(),
                transaction_id,
                approver: req.actor.clone(),
                decision,
                comment: req.comment.clone(),
                decided_at: Utc::now(),
            };
            transaction.status = next_status;
            transaction.updated_at = approval.decided_at;
            transaction.approvals.push(approval);
            let transaction = transaction.clone();
            drop(transactions);
            transaction
        };
        self.audit_transaction(
            &transaction,
            audit_kind,
            req.actor,
            "transaction approval decision",
            json!({ "decision": decision, "comment": req.comment }),
        );
        Ok(transaction)
    }

    fn audit_transaction(
        &self,
        transaction: &ModuleTransaction,
        action: AuditEventKind,
        actor: String,
        summary: &str,
        metadata: serde_json::Value,
    ) {
        let _event = self.audit.append(AuditEventInput {
            module_id: transaction.module_id.clone(),
            actor,
            action,
            target_type: "transaction".to_owned(),
            target_id: transaction.id.to_string(),
            summary: summary.to_owned(),
            metadata,
        });
    }
}

/// Return the next lifecycle status for one typed event.
#[must_use]
pub const fn next_module_transaction_status(
    status: ModuleTransactionStatus,
    event: ModuleTransitionEvent,
) -> Option<ModuleTransactionStatus> {
    use ModuleTransactionStatus as Status;
    use ModuleTransitionEvent as Event;

    let next = match (status, event) {
        (Status::Draft | Status::Rejected, Event::Submit)
        | (Status::Blocked, Event::ResolveBlocker) => Status::Submitted,
        (Status::Draft | Status::Submitted, Event::Generate) => Status::Generating,
        (
            Status::Draft
            | Status::Submitted
            | Status::Generating
            | Status::Evaluating
            | Status::RuleChecking
            | Status::SchemaValidating
            | Status::PendingApproval
            | Status::Approved,
            Event::Block,
        ) => Status::Blocked,
        (Status::Submitted | Status::Generating, Event::Evaluate) => Status::Evaluating,
        (Status::Submitted | Status::Evaluating, Event::RequestApproval) => Status::PendingApproval,
        (Status::Submitted | Status::SchemaValidating | Status::PendingApproval, Event::Reject) => {
            Status::Rejected
        }
        (Status::Generating | Status::Evaluating, Event::RuleCheck) => Status::RuleChecking,
        (Status::Evaluating | Status::RuleChecking, Event::ValidateSchema) => {
            Status::SchemaValidating
        }
        (Status::RuleChecking | Status::SchemaValidating, Event::RequestApproval) => {
            Status::PendingApproval
        }
        (Status::SchemaValidating | Status::PendingApproval, Event::Approve) => Status::Approved,
        (
            Status::PendingApproval
            | Status::Approved
            | Status::Archived
            | Status::Rejected
            | Status::Blocked,
            Event::Reopen,
        ) => Status::Draft,
        (Status::Approved, Event::Archive) => Status::Archived,
        _ => return None,
    };
    Some(next)
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use crate::module_audit::{AuditEventKind, AuditEventQuery, ModuleAuditService};

    use super::{
        ApprovalDecisionRequest, CreateModuleTransactionRequest, ModuleLifecycleService,
        ModuleTransactionStatus, ModuleTransitionEvent, ModuleTransitionRequest,
        TransactionListQuery,
    };

    fn create_request(module_id: &str) -> CreateModuleTransactionRequest {
        CreateModuleTransactionRequest {
            module_id: module_id.to_owned(),
            transaction_type: "release".to_owned(),
            actor: Some("pm".to_owned()),
            related_file_ids: None,
            related_artifact_ids: None,
        }
    }

    #[test]
    fn transaction_transition_approve_and_reject_flow() {
        let audit = Arc::new(ModuleAuditService::new());
        let lifecycle = ModuleLifecycleService::new(Arc::clone(&audit));

        let approved = lifecycle
            .create_transaction(create_request("production_manufacturing"))
            .expect("transaction should be created");
        assert_eq!(approved.module_id, "production_manufacturing");

        let submitted = lifecycle
            .transition(
                approved.id,
                ModuleTransitionRequest {
                    event: ModuleTransitionEvent::Submit,
                    actor: Some("pm".to_owned()),
                    comment: None,
                },
            )
            .expect("submit should be valid");
        assert_eq!(submitted.status, ModuleTransactionStatus::Submitted);

        let pending = lifecycle
            .transition(
                approved.id,
                ModuleTransitionRequest {
                    event: ModuleTransitionEvent::RequestApproval,
                    actor: Some("pm".to_owned()),
                    comment: Some("ready".to_owned()),
                },
            )
            .expect("request approval should be valid");
        assert_eq!(pending.status, ModuleTransactionStatus::PendingApproval);

        let done = lifecycle
            .approve(
                approved.id,
                ApprovalDecisionRequest {
                    actor: "approver".to_owned(),
                    comment: Some("ship it".to_owned()),
                },
            )
            .expect("approve should be valid");
        assert_eq!(done.status, ModuleTransactionStatus::Approved);
        assert_eq!(done.approvals.len(), 1);

        let rejected = lifecycle
            .create_transaction(create_request("production_manufacturing"))
            .expect("transaction should be created");
        lifecycle
            .transition(
                rejected.id,
                ModuleTransitionRequest {
                    event: ModuleTransitionEvent::Submit,
                    actor: None,
                    comment: None,
                },
            )
            .expect("submit should be valid");
        lifecycle
            .transition(
                rejected.id,
                ModuleTransitionRequest {
                    event: ModuleTransitionEvent::RequestApproval,
                    actor: None,
                    comment: None,
                },
            )
            .expect("request approval should be valid");
        let rejected = lifecycle
            .reject(
                rejected.id,
                ApprovalDecisionRequest {
                    actor: "approver".to_owned(),
                    comment: Some("needs changes".to_owned()),
                },
            )
            .expect("reject should be valid");
        assert_eq!(rejected.status, ModuleTransactionStatus::Rejected);

        let events = audit
            .list(&AuditEventQuery {
                module_id: Some("production_manufacturing".to_owned()),
                target_type: Some("transaction".to_owned()),
                target_id: None,
                actor: None,
                limit: Some(50),
                cursor: None,
            })
            .expect("audit events should list");
        assert!(
            events
                .items
                .iter()
                .any(|event| event.action == AuditEventKind::TransactionApproved)
        );
        assert!(
            events
                .items
                .iter()
                .any(|event| event.action == AuditEventKind::TransactionRejected)
        );
    }

    #[test]
    fn transaction_list_supports_status_filter() {
        let audit = Arc::new(ModuleAuditService::new());
        let lifecycle = ModuleLifecycleService::new(audit);

        let transaction = lifecycle
            .create_transaction(create_request("production_manufacturing"))
            .expect("transaction should be created");
        lifecycle
            .transition(
                transaction.id,
                ModuleTransitionRequest {
                    event: ModuleTransitionEvent::Submit,
                    actor: None,
                    comment: None,
                },
            )
            .expect("submit should work");

        let page = lifecycle
            .list_transactions(&TransactionListQuery {
                module_id: Some("production_manufacturing".to_owned()),
                status: Some(ModuleTransactionStatus::Submitted),
                limit: Some(10),
                cursor: None,
            })
            .expect("transaction list should work");

        assert_eq!(page.items.len(), 1);
        assert_eq!(page.items[0].module_id, "production_manufacturing");
        assert_eq!(page.items[0].status, ModuleTransactionStatus::Submitted);
    }

    #[test]
    fn invalid_transition_is_rejected() {
        let audit = Arc::new(ModuleAuditService::new());
        let lifecycle = ModuleLifecycleService::new(audit);
        let transaction = lifecycle
            .create_transaction(create_request("production_manufacturing"))
            .expect("transaction should be created");
        let err = lifecycle
            .transition(
                transaction.id,
                ModuleTransitionRequest {
                    event: ModuleTransitionEvent::Approve,
                    actor: None,
                    comment: None,
                },
            )
            .expect_err("approve from draft should fail");
        assert_eq!(err.http_status(), 400);
    }
}
