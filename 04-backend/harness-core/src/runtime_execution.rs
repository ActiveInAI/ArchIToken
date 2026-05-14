//! Phase 7 runtime execution types and approval-gated execution service.

use std::{collections::HashMap, sync::Arc};

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{
    Result,
    durable_store::DurableRecordMetadata,
    error::HarnessError,
    module_audit::{AuditEventInput, AuditEventKind, ModuleAuditService},
    module_pagination::{ListPage, PageInfo, paginate},
    runtime_context::{PermissionGuard, RequestContext, RuntimePermission, assert_runtime_scope},
    viewer_adapter::ViewerCommandKind,
};

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

/// AI query plan generated before any action can be approved.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiQueryPlan {
    /// User-visible objective.
    pub objective: String,
    /// Search or retrieval strategy.
    pub retrieval_strategy: String,
    /// Asset filters for tenant-scoped retrieval.
    pub asset_filters: Value,
}

/// One approval-gated AI action.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPlannedAction {
    /// Stable action type.
    pub action_type: String,
    /// Optional target asset id.
    pub target_asset_id: Option<Uuid>,
    /// Optional viewer command draft.
    pub viewer_command: Option<ViewerCommandKind>,
    /// Action arguments.
    pub arguments: Value,
    /// Asset mutation marker. Phase 7 rejects direct mutations from AI actions.
    pub mutates_assets: bool,
}

/// AI action plan. Execution remains approval gated.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiActionPlan {
    /// Human-readable plan summary.
    pub summary: String,
    /// Whether human approval is required before queueing.
    pub requires_approval: bool,
    /// Planned actions.
    pub actions: Vec<AiPlannedAction>,
}

/// Draft viewer command emitted by an AI plan.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiDraftViewerCommand {
    /// Viewer command kind.
    pub command: ViewerCommandKind,
    /// Optional target artifact id.
    pub artifact_id: Option<Uuid>,
    /// Element ids targeted by the draft.
    pub element_ids: Vec<String>,
    /// Draft command arguments.
    pub arguments: Value,
}

/// Request to create an AI runtime draft execution.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAiRuntimeDraftRequest {
    /// Provider registry id.
    pub provider: String,
    /// Source prompt. No external model is called in Phase 7.
    pub prompt: String,
    /// Query plan.
    pub query_plan: AiQueryPlan,
    /// Action plan.
    pub action_plan: AiActionPlan,
    /// Draft viewer commands produced by the plan.
    pub draft_viewer_commands: Vec<AiDraftViewerCommand>,
    /// Optional actor fallback.
    pub actor: Option<String>,
}

/// Request to approve or reject an AI runtime draft.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeExecutionApprovalRequest {
    /// Reviewer actor.
    pub actor: String,
    /// Approval decision.
    pub approved: bool,
    /// Optional review comment.
    pub comment: Option<String>,
}

/// Runtime execution list query.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
pub struct RuntimeExecutionListQuery {
    /// Optional execution kind.
    pub kind: Option<RuntimeExecutionKind>,
    /// Optional execution status.
    pub status: Option<RuntimeExecutionStatus>,
    /// Optional page size.
    pub limit: Option<usize>,
    /// Optional numeric cursor offset.
    pub cursor: Option<String>,
}

/// Runtime execution list response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeExecutionListResponse {
    /// Executions included in this page.
    pub executions: Vec<RuntimeExecutionRecord>,
    /// Number of executions in this page.
    pub total: usize,
    /// Pagination metadata.
    pub page_info: PageInfo,
}

/// Runtime execution trace response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeExecutionTraceResponse {
    /// Execution record.
    pub execution: RuntimeExecutionRecord,
    /// Trace events extracted from the execution trace payload.
    pub trace_events: Vec<Value>,
}

/// In-memory runtime execution service.
#[derive(Debug, Clone)]
pub struct RuntimeExecutionService {
    executions: Arc<RwLock<HashMap<Uuid, RuntimeExecutionRecord>>>,
    audit: Arc<ModuleAuditService>,
}

impl RuntimeExecutionService {
    /// Create an empty runtime execution service.
    #[must_use]
    pub fn new(audit: Arc<ModuleAuditService>) -> Self {
        Self {
            executions: Arc::new(RwLock::new(HashMap::new())),
            audit,
        }
    }

    /// Create an approval-gated AI draft execution.
    ///
    /// # Errors
    /// Returns permission errors or validation errors for direct asset mutation plans.
    pub fn create_ai_draft_with_context(
        &self,
        context: &RequestContext,
        req: CreateAiRuntimeDraftRequest,
    ) -> Result<RuntimeExecutionRecord> {
        PermissionGuard::ensure(context, RuntimePermission::GenerationCreate)?;
        reject_direct_asset_mutation(&req.action_plan)?;
        let now = Utc::now();
        let execution_id = Uuid::new_v4();
        let actor = req.actor.unwrap_or_else(|| context.actor.clone());
        let record = RuntimeExecutionRecord {
            metadata: DurableRecordMetadata {
                id: Uuid::new_v4(),
                tenant_id: context.tenant_id.clone(),
                project_id: Some(context.project_id.clone()),
                created_at: now,
                updated_at: now,
                created_by: Some(actor.clone()),
            },
            execution_id,
            kind: RuntimeExecutionKind::AiCommandDraft,
            provider: req.provider.clone(),
            status: RuntimeExecutionStatus::PendingApproval,
            input: json!({
                "prompt": req.prompt,
                "queryPlan": req.query_plan,
                "actionPlan": req.action_plan,
                "draftViewerCommands": req.draft_viewer_commands,
                "context": context.audit_json()
            }),
            output: json!({
                "assetMutationAllowed": false,
                "directAssetMutation": false,
                "draftOnly": true
            }),
            trace: json!({
                "events": [
                    {
                        "event": "ai_draft_created",
                        "at": now,
                        "actor": actor,
                        "approvalRequired": true
                    },
                    {
                        "event": "draft_viewer_commands_generated",
                        "at": now,
                        "count": req.draft_viewer_commands.len()
                    }
                ]
            }),
            started_at: None,
            finished_at: None,
        };
        self.executions.write().insert(execution_id, record.clone());
        let _ = self.audit.append(AuditEventInput {
            module_id: "digital_twin".to_owned(),
            actor,
            action: AuditEventKind::AiRuntimeDraftCreated,
            target_type: "runtime_execution".to_owned(),
            target_id: execution_id.to_string(),
            summary: "AI runtime draft created".to_owned(),
            metadata: json!({
                "provider": req.provider,
                "status": record.status,
                "context": context.audit_json()
            }),
        });
        Ok(record)
    }

    /// List runtime executions visible to a context.
    ///
    /// # Errors
    /// Returns permission or pagination errors.
    pub fn list_with_context(
        &self,
        context: &RequestContext,
        query: &RuntimeExecutionListQuery,
    ) -> Result<ListPage<RuntimeExecutionRecord>> {
        PermissionGuard::ensure(context, RuntimePermission::ArtifactRead)?;
        let mut items: Vec<_> = self
            .executions
            .read()
            .values()
            .filter(|execution| execution.metadata.tenant_id == context.tenant_id)
            .filter(|execution| {
                execution.metadata.project_id.as_deref() == Some(&context.project_id)
            })
            .filter(|execution| query.kind.is_none_or(|kind| execution.kind == kind))
            .filter(|execution| query.status.is_none_or(|status| execution.status == status))
            .cloned()
            .collect();
        items.sort_by(|left, right| {
            left.metadata
                .created_at
                .cmp(&right.metadata.created_at)
                .then_with(|| {
                    left.execution_id
                        .as_bytes()
                        .cmp(right.execution_id.as_bytes())
                })
        });
        paginate(&items, query.limit, query.cursor.as_deref())
    }

    /// Get a runtime execution visible to a context.
    ///
    /// # Errors
    /// Returns permission, not found, or scope errors.
    pub fn get_with_context(
        &self,
        context: &RequestContext,
        execution_id: Uuid,
    ) -> Result<RuntimeExecutionRecord> {
        PermissionGuard::ensure(context, RuntimePermission::ArtifactRead)?;
        let execution = self
            .executions
            .read()
            .get(&execution_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("execution_id={execution_id}")))?;
        assert_runtime_scope(
            context,
            &execution.metadata.tenant_id,
            execution.metadata.project_id.as_deref().unwrap_or_default(),
        )?;
        Ok(execution)
    }

    /// Get runtime trace events for a visible execution.
    ///
    /// # Errors
    /// Returns permission, not found, or scope errors.
    pub fn trace_with_context(
        &self,
        context: &RequestContext,
        execution_id: Uuid,
    ) -> Result<RuntimeExecutionTraceResponse> {
        let execution = self.get_with_context(context, execution_id)?;
        let trace_events = execution
            .trace
            .get("events")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        Ok(RuntimeExecutionTraceResponse {
            execution,
            trace_events,
        })
    }

    /// Approve or reject an AI runtime draft.
    ///
    /// # Errors
    /// Returns permission, not found, scope, or invalid transition errors.
    pub fn approve_with_context(
        &self,
        context: &RequestContext,
        execution_id: Uuid,
        mut req: RuntimeExecutionApprovalRequest,
    ) -> Result<RuntimeExecutionRecord> {
        PermissionGuard::ensure(context, RuntimePermission::GenerationApprove)?;
        if req.actor.trim().is_empty() {
            req.actor.clone_from(&context.actor);
        }
        let now = Utc::now();
        let record = {
            let mut executions = self.executions.write();
            let execution = executions
                .get_mut(&execution_id)
                .ok_or_else(|| HarnessError::NotFound(format!("execution_id={execution_id}")))?;
            assert_runtime_scope(
                context,
                &execution.metadata.tenant_id,
                execution.metadata.project_id.as_deref().unwrap_or_default(),
            )?;
            if execution.status != RuntimeExecutionStatus::PendingApproval {
                return Err(HarnessError::InvalidInput(format!(
                    "runtime execution status {:?} does not allow approval",
                    execution.status
                )));
            }
            execution.status = if req.approved {
                RuntimeExecutionStatus::Queued
            } else {
                RuntimeExecutionStatus::Cancelled
            };
            execution.metadata.updated_at = now;
            execution.finished_at = if req.approved { None } else { Some(now) };
            append_trace_event(
                &mut execution.trace,
                json!({
                    "event": if req.approved { "ai_runtime_approved" } else { "ai_runtime_rejected" },
                    "at": now,
                    "actor": req.actor,
                    "comment": req.comment,
                    "queuedForExecution": req.approved
                }),
            );
            execution.output = json!({
                "approved": req.approved,
                "queuedForExecution": req.approved,
                "directAssetMutation": false
            });
            let record = execution.clone();
            drop(executions);
            record
        };
        let _ = self.audit.append(AuditEventInput {
            module_id: "digital_twin".to_owned(),
            actor: req.actor,
            action: if req.approved {
                AuditEventKind::AiRuntimeExecutionApproved
            } else {
                AuditEventKind::AiRuntimeExecutionRejected
            },
            target_type: "runtime_execution".to_owned(),
            target_id: record.execution_id.to_string(),
            summary: if req.approved {
                "AI runtime draft approved".to_owned()
            } else {
                "AI runtime draft rejected".to_owned()
            },
            metadata: json!({
                "status": record.status,
                "context": context.audit_json()
            }),
        });
        Ok(record)
    }
}

/// Runtime execution durable store adapter.
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

fn reject_direct_asset_mutation(plan: &AiActionPlan) -> Result<()> {
    if plan.actions.iter().any(|action| action.mutates_assets) {
        return Err(HarnessError::InvalidInput(
            "AI runtime actions must produce draft commands and cannot directly mutate assets"
                .to_owned(),
        ));
    }
    Ok(())
}

fn append_trace_event(trace: &mut Value, event: Value) {
    if let Some(events) = trace.get_mut("events").and_then(Value::as_array_mut) {
        events.push(event);
        return;
    }
    *trace = json!({ "events": [event] });
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use serde_json::json;

    use crate::{
        module_audit::{AuditEventKind, AuditEventQuery, ModuleAuditService},
        runtime_context::{RequestContext, RequestContextInput, RuntimeProfile},
        viewer_adapter::ViewerCommandKind,
    };

    use super::{
        AiActionPlan, AiDraftViewerCommand, AiPlannedAction, AiQueryPlan,
        CreateAiRuntimeDraftRequest, RuntimeExecutionApprovalRequest, RuntimeExecutionKind,
        RuntimeExecutionListQuery, RuntimeExecutionService, RuntimeExecutionStatus,
    };

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

    fn context(actor: &str, roles: &[&str], tenant: &str) -> RequestContext {
        RequestContext::from_input(
            RequestContextInput {
                tenant_id: Some(tenant.to_owned()),
                project_id: Some("project-a".to_owned()),
                actor: Some(actor.to_owned()),
                roles: Some(roles.iter().map(|role| (*role).to_owned()).collect()),
                request_id: Some(format!("req-{actor}")),
                correlation_id: Some(format!("corr-{actor}")),
            },
            RuntimeProfile::Production,
        )
        .expect("context should parse")
    }

    fn draft_request() -> CreateAiRuntimeDraftRequest {
        CreateAiRuntimeDraftRequest {
            provider: "architoken-provider-router".to_owned(),
            prompt: "Find walls and draft a section plane".to_owned(),
            query_plan: AiQueryPlan {
                objective: "inspect model context".to_owned(),
                retrieval_strategy: "tenant_project_assets".to_owned(),
                asset_filters: json!({ "kind": "ifc" }),
            },
            action_plan: AiActionPlan {
                summary: "Draft viewer commands only".to_owned(),
                requires_approval: true,
                actions: vec![AiPlannedAction {
                    action_type: "viewer_command".to_owned(),
                    target_asset_id: None,
                    viewer_command: Some(ViewerCommandKind::SectionPlane),
                    arguments: json!({ "normal": [0, 0, 1] }),
                    mutates_assets: false,
                }],
            },
            draft_viewer_commands: vec![AiDraftViewerCommand {
                command: ViewerCommandKind::SectionPlane,
                artifact_id: None,
                element_ids: vec!["architoken:wall:001".to_owned()],
                arguments: json!({ "offset": 1.2 }),
            }],
            actor: None,
        }
    }

    #[test]
    fn ai_runtime_draft_is_approval_gated_and_audited() {
        let audit = Arc::new(ModuleAuditService::new());
        let service = RuntimeExecutionService::new(audit.clone());
        let engineer = context("engineer", &["engineer"], "tenant-a");
        let record = service
            .create_ai_draft_with_context(&engineer, draft_request())
            .expect("engineer can create AI draft");

        assert_eq!(record.kind, RuntimeExecutionKind::AiCommandDraft);
        assert_eq!(record.status, RuntimeExecutionStatus::PendingApproval);
        assert_eq!(record.output["directAssetMutation"], json!(false));
        assert_eq!(record.metadata.tenant_id, "tenant-a");

        let events = audit
            .list(&AuditEventQuery {
                module_id: Some("digital_twin".to_owned()),
                target_type: Some("runtime_execution".to_owned()),
                target_id: Some(record.execution_id.to_string()),
                actor: Some("engineer".to_owned()),
                limit: Some(10),
                cursor: None,
            })
            .expect("audit list works");
        assert!(
            events
                .items
                .iter()
                .any(|event| event.action == AuditEventKind::AiRuntimeDraftCreated)
        );
    }

    #[test]
    fn ai_runtime_rejects_direct_asset_mutation() {
        let service = RuntimeExecutionService::new(Arc::new(ModuleAuditService::new()));
        let engineer = context("engineer", &["engineer"], "tenant-a");
        let mut req = draft_request();
        req.action_plan.actions[0].mutates_assets = true;

        let err = service
            .create_ai_draft_with_context(&engineer, req)
            .expect_err("direct mutation must fail");
        assert_eq!(err.http_status(), 400);
        assert_eq!(
            service
                .list_with_context(&engineer, &RuntimeExecutionListQuery::default())
                .expect("list works")
                .items
                .len(),
            0
        );
    }

    #[test]
    fn reviewer_can_approve_ai_runtime_but_engineer_cannot() {
        let service = RuntimeExecutionService::new(Arc::new(ModuleAuditService::new()));
        let engineer = context("engineer", &["engineer"], "tenant-a");
        let reviewer = context("reviewer", &["reviewer"], "tenant-a");
        let record = service
            .create_ai_draft_with_context(&engineer, draft_request())
            .expect("draft creates");

        let err = service
            .approve_with_context(
                &engineer,
                record.execution_id,
                RuntimeExecutionApprovalRequest {
                    actor: "engineer".to_owned(),
                    approved: true,
                    comment: None,
                },
            )
            .expect_err("engineer cannot approve");
        assert_eq!(err.http_status(), 403);

        let approved = service
            .approve_with_context(
                &reviewer,
                record.execution_id,
                RuntimeExecutionApprovalRequest {
                    actor: "reviewer".to_owned(),
                    approved: true,
                    comment: Some("approved for queued execution".to_owned()),
                },
            )
            .expect("reviewer can approve");
        assert_eq!(approved.status, RuntimeExecutionStatus::Queued);
        assert_eq!(approved.output["queuedForExecution"], json!(true));
    }

    #[test]
    fn runtime_execution_lists_are_tenant_isolated_and_trace_visible() {
        let service = RuntimeExecutionService::new(Arc::new(ModuleAuditService::new()));
        let tenant_a = context("engineer-a", &["engineer"], "tenant-a");
        let tenant_b = context("engineer-b", &["engineer"], "tenant-b");
        let record = service
            .create_ai_draft_with_context(&tenant_a, draft_request())
            .expect("draft creates");

        let a_page = service
            .list_with_context(&tenant_a, &RuntimeExecutionListQuery::default())
            .expect("tenant a list works");
        assert_eq!(a_page.items.len(), 1);

        let b_page = service
            .list_with_context(&tenant_b, &RuntimeExecutionListQuery::default())
            .expect("tenant b list works");
        assert!(b_page.items.is_empty());

        let trace = service
            .trace_with_context(&tenant_a, record.execution_id)
            .expect("trace is visible");
        assert_eq!(trace.trace_events.len(), 2);
    }
}
