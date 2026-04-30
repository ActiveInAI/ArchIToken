//! Viewer adapter command schema.
//!
//! This module defines backend-owned command contracts for frontend and
//! third-party viewers. It does not implement a frontend viewer and does not
//! import proprietary viewer loaders.

use std::{collections::HashMap, sync::Arc};

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    error::{HarnessError, Result},
    module_audit::{AuditEventInput, AuditEventKind, ModuleAuditService},
    module_generation::ModuleGenerationService,
    module_pagination::{ListPage, PageInfo, paginate},
    module_registry::normalize_module_id,
    storage_router::ViewerAdapterHint,
};

const DEFAULT_VIEWER_MODULE_ID: &str = "digital_twin";
const DEFAULT_ACTOR: &str = "viewer";

/// Viewer command supported by the `ViewerAdapter` contract.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ViewerCommandKind {
    /// Load an artifact into the viewer.
    LoadArtifact,
    /// Unload an artifact from the viewer.
    UnloadArtifact,
    /// Pick one element or screen location.
    Pick,
    /// Set element color.
    SetColor,
    /// Set element visibility.
    SetVisible,
    /// Set element opacity.
    SetOpacity,
    /// Isolate elements.
    Isolate,
    /// Clear isolation state.
    ClearIsolation,
    /// Offset elements.
    Offset,
    /// Clear element offset.
    ClearOffset,
    /// Rotate elements.
    Rotate,
    /// Clear element rotation.
    ClearRotate,
    /// Zoom to artifact or elements.
    ZoomTo,
    /// Capture a viewer snapshot.
    Snapshot,
    /// Export viewer image.
    ExportImage,
    /// Dispose viewer resources.
    Dispose,
}

impl ViewerCommandKind {
    /// All auditable viewer commands accepted by the backend contract.
    pub const ALL: [Self; 16] = [
        Self::LoadArtifact,
        Self::UnloadArtifact,
        Self::Pick,
        Self::SetColor,
        Self::SetVisible,
        Self::SetOpacity,
        Self::Isolate,
        Self::ClearIsolation,
        Self::Offset,
        Self::ClearOffset,
        Self::Rotate,
        Self::ClearRotate,
        Self::ZoomTo,
        Self::Snapshot,
        Self::ExportImage,
        Self::Dispose,
    ];
}

/// Viewer command lifecycle status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ViewerCommandStatus {
    /// Command was accepted but not acknowledged by a viewer adapter.
    Queued,
    /// Viewer adapter acknowledged receipt.
    Acknowledged,
    /// Viewer adapter executed the command.
    Executed,
    /// Viewer adapter skipped the command.
    Skipped,
}

/// Auditable viewer command payload.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewerAdapterCommand {
    /// Command id.
    pub id: Uuid,
    /// Viewer adapter hint.
    pub adapter: ViewerAdapterHint,
    /// Command kind.
    pub command: ViewerCommandKind,
    /// Optional artifact id.
    pub artifact_id: Option<Uuid>,
    /// Element ids targeted by the command.
    pub element_ids: Vec<String>,
    /// Command arguments such as color, opacity, transform, camera, or image format.
    pub arguments: serde_json::Value,
    /// Current command status.
    pub status: ViewerCommandStatus,
    /// Audit event id that records this viewer command.
    pub audit_event_id: Option<Uuid>,
    /// Actor that acknowledged or executed the command.
    pub acknowledged_by: Option<String>,
    /// Acknowledgement timestamp.
    pub acknowledged_at: Option<DateTime<Utc>>,
    /// Command creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Request body for `POST /v1/viewer/commands`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewerCommandCreateRequest {
    /// Viewer adapter hint.
    pub adapter: ViewerAdapterHint,
    /// Command kind.
    pub command: ViewerCommandKind,
    /// Optional active module id or accepted legacy alias.
    pub module_id: Option<String>,
    /// Optional artifact id. When present it must resolve through the artifact index.
    pub artifact_id: Option<Uuid>,
    /// Element ids targeted by the command.
    pub element_ids: Option<Vec<String>>,
    /// Command arguments such as color, opacity, transform, camera, or image format.
    pub arguments: Option<serde_json::Value>,
    /// Actor creating the command.
    pub actor: Option<String>,
}

/// Request body for `POST /v1/viewer/commands/{command_id}/ack`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewerCommandAckRequest {
    /// Actor acknowledging the command.
    pub actor: String,
    /// New acknowledgement status.
    pub status: ViewerCommandStatus,
    /// Optional acknowledgement comment.
    pub comment: Option<String>,
    /// Optional structured adapter result.
    pub result: Option<serde_json::Value>,
}

/// Query shape used by `GET /v1/viewer/commands`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
pub struct ViewerCommandListQuery {
    /// Optional command status filter.
    pub status: Option<ViewerCommandStatus>,
    /// Optional artifact id filter.
    pub artifact_id: Option<Uuid>,
    /// Optional viewer adapter hint filter.
    pub adapter: Option<ViewerAdapterHint>,
    /// Optional command kind filter.
    pub command: Option<ViewerCommandKind>,
    /// Optional page size.
    pub limit: Option<usize>,
    /// Optional numeric cursor offset.
    pub cursor: Option<String>,
}

/// Viewer command list response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewerCommandListResponse {
    /// Commands included in this page.
    pub commands: Vec<ViewerAdapterCommand>,
    /// Number of commands in this page.
    pub total: usize,
    /// Pagination metadata.
    pub page_info: PageInfo,
}

/// In-memory viewer command service.
#[derive(Debug, Clone)]
pub struct ViewerCommandService {
    commands: Arc<RwLock<HashMap<Uuid, ViewerAdapterCommand>>>,
    audit: Arc<ModuleAuditService>,
    generation: ModuleGenerationService,
}

impl ViewerCommandService {
    /// Create an empty viewer command service.
    #[must_use]
    pub fn new(audit: Arc<ModuleAuditService>, generation: ModuleGenerationService) -> Self {
        Self {
            commands: Arc::new(RwLock::new(HashMap::new())),
            audit,
            generation,
        }
    }

    /// Create one auditable viewer command.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the referenced artifact or module
    /// is unknown and [`HarnessError::InvalidInput`] when a vendor adapter is
    /// requested as a production route.
    pub fn create_command(&self, req: ViewerCommandCreateRequest) -> Result<ViewerAdapterCommand> {
        let mut arguments = req.arguments.unwrap_or_else(|| json!({}));
        reject_vendor_production_route(req.adapter, &arguments)?;
        if req.adapter == ViewerAdapterHint::VendorOptrapid3d {
            mark_candidate_adapter(&mut arguments);
        }

        let module_id = if let Some(artifact_id) = req.artifact_id {
            self.generation
                .get_artifact(artifact_id)?
                .reference
                .module_id
        } else if let Some(module_id) = req.module_id.as_deref() {
            normalize_module_id(module_id)
                .ok_or_else(|| HarnessError::NotFound(format!("module_id={module_id}")))?
                .to_string()
        } else {
            DEFAULT_VIEWER_MODULE_ID.to_owned()
        };

        let actor = req.actor.unwrap_or_else(|| DEFAULT_ACTOR.to_owned());
        let now = Utc::now();
        let mut command = ViewerAdapterCommand {
            id: Uuid::new_v4(),
            adapter: req.adapter,
            command: req.command,
            artifact_id: req.artifact_id,
            element_ids: req.element_ids.unwrap_or_default(),
            arguments,
            status: ViewerCommandStatus::Queued,
            audit_event_id: None,
            acknowledged_by: None,
            acknowledged_at: None,
            created_at: now,
            updated_at: now,
        };
        let audit = self.audit.append(AuditEventInput {
            module_id,
            actor,
            action: AuditEventKind::ViewerCommandCreated,
            target_type: "viewer_command".to_owned(),
            target_id: command.id.to_string(),
            summary: "viewer command created".to_owned(),
            metadata: json!({
                "adapter": command.adapter,
                "command": command.command,
                "artifactId": command.artifact_id,
                "candidateOnly": command.adapter == ViewerAdapterHint::VendorOptrapid3d
            }),
        });
        command.audit_event_id = Some(audit.id);
        self.commands.write().insert(command.id, command.clone());
        Ok(command)
    }

    /// List viewer commands.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] for invalid pagination cursors.
    pub fn list_commands(
        &self,
        query: &ViewerCommandListQuery,
    ) -> Result<ListPage<ViewerAdapterCommand>> {
        let items: Vec<ViewerAdapterCommand> = self
            .commands
            .read()
            .values()
            .filter(|command| query.status.is_none_or(|status| command.status == status))
            .filter(|command| {
                query
                    .artifact_id
                    .is_none_or(|artifact_id| command.artifact_id == Some(artifact_id))
            })
            .filter(|command| {
                query
                    .adapter
                    .is_none_or(|adapter| command.adapter == adapter)
            })
            .filter(|command| query.command.is_none_or(|kind| command.command == kind))
            .cloned()
            .collect();
        paginate(&items, query.limit, query.cursor.as_deref())
    }

    /// Get one viewer command.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the command id is unknown.
    pub fn get_command(&self, command_id: Uuid) -> Result<ViewerAdapterCommand> {
        self.commands
            .read()
            .get(&command_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("viewer_command_id={command_id}")))
    }

    /// Acknowledge, execute, or skip one viewer command.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the command id is unknown and
    /// [`HarnessError::InvalidInput`] for invalid status transitions.
    pub fn ack_command(
        &self,
        command_id: Uuid,
        req: ViewerCommandAckRequest,
    ) -> Result<ViewerAdapterCommand> {
        if req.status == ViewerCommandStatus::Queued {
            return Err(HarnessError::InvalidInput(
                "ack status must be acknowledged, executed, or skipped".to_owned(),
            ));
        }
        let command = {
            let mut commands = self.commands.write();
            let command = commands
                .get_mut(&command_id)
                .ok_or_else(|| HarnessError::NotFound(format!("viewer_command_id={command_id}")))?;
            if matches!(
                command.status,
                ViewerCommandStatus::Executed | ViewerCommandStatus::Skipped
            ) {
                return Err(HarnessError::InvalidInput(format!(
                    "viewer command status {:?} does not allow ack",
                    command.status
                )));
            }
            let now = Utc::now();
            command.status = req.status;
            command.acknowledged_by = Some(req.actor.clone());
            command.acknowledged_at = Some(now);
            command.updated_at = now;
            let command = command.clone();
            drop(commands);
            command
        };
        let module_id = command
            .artifact_id
            .and_then(|artifact_id| self.generation.get_artifact(artifact_id).ok())
            .map_or_else(
                || DEFAULT_VIEWER_MODULE_ID.to_owned(),
                |artifact| artifact.reference.module_id,
            );
        let _event = self.audit.append(AuditEventInput {
            module_id,
            actor: req.actor,
            action: AuditEventKind::ViewerCommandAcknowledged,
            target_type: "viewer_command".to_owned(),
            target_id: command.id.to_string(),
            summary: "viewer command acknowledged".to_owned(),
            metadata: json!({
                "status": command.status,
                "comment": req.comment,
                "result": req.result
            }),
        });
        Ok(command)
    }
}

fn reject_vendor_production_route(
    adapter: ViewerAdapterHint,
    arguments: &serde_json::Value,
) -> Result<()> {
    if adapter != ViewerAdapterHint::VendorOptrapid3d {
        return Ok(());
    }
    let production_enabled = arguments
        .get("productionRouteEnabled")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);
    let route = arguments
        .get("route")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    if production_enabled || route == "production" {
        return Err(HarnessError::InvalidInput(
            "vendor_optrapid3d commands are candidate/evaluation metadata only".to_owned(),
        ));
    }
    Ok(())
}

fn mark_candidate_adapter(arguments: &mut serde_json::Value) {
    if let Some(map) = arguments.as_object_mut() {
        map.insert("candidateAdapterOnly".to_owned(), json!(true));
        map.insert("productionRouteEnabled".to_owned(), json!(false));
        return;
    }
    *arguments = json!({
        "payload": arguments,
        "candidateAdapterOnly": true,
        "productionRouteEnabled": false
    });
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use std::sync::Arc;
    use uuid::Uuid;

    use crate::{
        module_audit::{AuditEventKind, AuditEventQuery, ModuleAuditService},
        module_generation::{
            GenerationActionRequest, GenerationInput, GenerationMode, GenerationReviewDecision,
            GenerationReviewRequest, ModuleGenerationService,
        },
        module_lifecycle::ModuleLifecycleService,
        storage_router::ViewerAdapterHint,
    };

    use super::{
        ViewerAdapterCommand, ViewerCommandAckRequest, ViewerCommandCreateRequest,
        ViewerCommandKind, ViewerCommandService, ViewerCommandStatus,
    };

    fn generation_service(
        audit: Arc<ModuleAuditService>,
    ) -> (ModuleGenerationService, ModuleLifecycleService) {
        let lifecycle = ModuleLifecycleService::new(audit.clone());
        (
            ModuleGenerationService::new(audit, lifecycle.clone()),
            lifecycle,
        )
    }

    fn generated_artifact_id(generation: &ModuleGenerationService) -> Uuid {
        let job = generation
            .create_job(GenerationInput {
                module_id: "digital_twin".to_owned(),
                mode: GenerationMode::ModelToLightweightScene,
                prompt: "prepare viewer artifact".to_owned(),
                actor: Some("tester".to_owned()),
                input_artifacts: None,
                constraints: None,
            })
            .expect("job creates");
        let job = generation
            .plan_job(
                job.id,
                GenerationActionRequest {
                    actor: None,
                    comment: None,
                },
            )
            .and_then(|planned| {
                generation.run_job(
                    planned.id,
                    GenerationActionRequest {
                        actor: None,
                        comment: None,
                    },
                )
            })
            .and_then(|run| {
                generation.review_job(
                    run.id,
                    GenerationReviewRequest {
                        reviewer: "reviewer".to_owned(),
                        decision: GenerationReviewDecision::Approved,
                        comment: None,
                    },
                )
            })
            .expect("job runs");
        job.artifacts[0].id
    }

    #[test]
    fn viewer_adapter_command_schema_serializes() {
        let command = ViewerAdapterCommand {
            id: Uuid::new_v4(),
            adapter: ViewerAdapterHint::ThreeJs,
            command: ViewerCommandKind::SetColor,
            artifact_id: Some(Uuid::new_v4()),
            element_ids: vec!["architoken:wall:001".to_owned()],
            arguments: json!({ "color": "#ff6600" }),
            status: ViewerCommandStatus::Queued,
            audit_event_id: Some(Uuid::new_v4()),
            acknowledged_by: None,
            acknowledged_at: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let encoded = serde_json::to_string(&command).expect("command serializes");
        let decoded: ViewerAdapterCommand =
            serde_json::from_str(&encoded).expect("command deserializes");
        assert_eq!(decoded.command, ViewerCommandKind::SetColor);
        assert_eq!(decoded.adapter, ViewerAdapterHint::ThreeJs);
        assert_eq!(decoded.element_ids, vec!["architoken:wall:001"]);
    }

    #[test]
    fn set_color_command_appends_audit_event() {
        let audit = Arc::new(ModuleAuditService::new());
        let (generation, _lifecycle) = generation_service(audit.clone());
        let artifact_id = generated_artifact_id(&generation);
        let service = ViewerCommandService::new(audit.clone(), generation);

        let command = service
            .create_command(ViewerCommandCreateRequest {
                adapter: ViewerAdapterHint::ThreeJs,
                command: ViewerCommandKind::SetColor,
                module_id: None,
                artifact_id: Some(artifact_id),
                element_ids: Some(vec!["architoken:wall:001".to_owned()]),
                arguments: Some(json!({ "color": "#ff6600" })),
                actor: Some("viewer-dev".to_owned()),
            })
            .expect("command should create");
        assert_eq!(command.status, ViewerCommandStatus::Queued);
        assert!(command.audit_event_id.is_some());

        let events = audit
            .list(&AuditEventQuery {
                module_id: Some("digital_twin".to_owned()),
                target_type: Some("viewer_command".to_owned()),
                target_id: Some(command.id.to_string()),
                actor: None,
                limit: Some(10),
                cursor: None,
            })
            .expect("audit list should work");
        assert!(
            events
                .items
                .iter()
                .any(|event| event.action == AuditEventKind::ViewerCommandCreated)
        );
    }

    #[test]
    fn command_with_unknown_artifact_rejects() {
        let audit = Arc::new(ModuleAuditService::new());
        let (generation, _lifecycle) = generation_service(audit.clone());
        let service = ViewerCommandService::new(audit, generation);

        let result = service.create_command(ViewerCommandCreateRequest {
            adapter: ViewerAdapterHint::ThreeJs,
            command: ViewerCommandKind::LoadArtifact,
            module_id: None,
            artifact_id: Some(Uuid::new_v4()),
            element_ids: None,
            arguments: None,
            actor: None,
        });
        assert!(result.is_err());
    }

    #[test]
    fn ack_transitions_command_status() {
        let audit = Arc::new(ModuleAuditService::new());
        let (generation, _lifecycle) = generation_service(audit);
        let artifact_id = generated_artifact_id(&generation);
        let service = ViewerCommandService::new(Arc::new(ModuleAuditService::new()), generation);
        let command = service
            .create_command(ViewerCommandCreateRequest {
                adapter: ViewerAdapterHint::ThreeJs,
                command: ViewerCommandKind::SetOpacity,
                module_id: None,
                artifact_id: Some(artifact_id),
                element_ids: None,
                arguments: Some(json!({ "opacity": 0.4 })),
                actor: None,
            })
            .expect("command creates");

        let acked = service
            .ack_command(
                command.id,
                ViewerCommandAckRequest {
                    actor: "viewer".to_owned(),
                    status: ViewerCommandStatus::Executed,
                    comment: Some("rendered".to_owned()),
                    result: Some(json!({ "ok": true })),
                },
            )
            .expect("ack should work");
        assert_eq!(acked.status, ViewerCommandStatus::Executed);
        assert_eq!(acked.acknowledged_by.as_deref(), Some("viewer"));
    }

    #[test]
    fn ack_rejects_queued_status_and_terminal_regression() {
        let audit = Arc::new(ModuleAuditService::new());
        let (generation, _lifecycle) = generation_service(audit);
        let artifact_id = generated_artifact_id(&generation);
        let service = ViewerCommandService::new(Arc::new(ModuleAuditService::new()), generation);
        let command = service
            .create_command(ViewerCommandCreateRequest {
                adapter: ViewerAdapterHint::ThreeJs,
                command: ViewerCommandKind::ZoomTo,
                module_id: None,
                artifact_id: Some(artifact_id),
                element_ids: None,
                arguments: Some(json!({ "fit": true })),
                actor: None,
            })
            .expect("command creates");

        assert!(
            service
                .ack_command(
                    command.id,
                    ViewerCommandAckRequest {
                        actor: "viewer".to_owned(),
                        status: ViewerCommandStatus::Queued,
                        comment: None,
                        result: None,
                    },
                )
                .is_err()
        );

        service
            .ack_command(
                command.id,
                ViewerCommandAckRequest {
                    actor: "viewer".to_owned(),
                    status: ViewerCommandStatus::Executed,
                    comment: None,
                    result: None,
                },
            )
            .expect("first terminal ack should work");

        assert!(
            service
                .ack_command(
                    command.id,
                    ViewerCommandAckRequest {
                        actor: "viewer".to_owned(),
                        status: ViewerCommandStatus::Acknowledged,
                        comment: Some("regress".to_owned()),
                        result: None,
                    },
                )
                .is_err()
        );
    }

    #[test]
    fn required_viewer_command_kinds_are_accepted_as_contracts() {
        let audit = Arc::new(ModuleAuditService::new());
        let (generation, _lifecycle) = generation_service(audit.clone());
        let artifact_id = generated_artifact_id(&generation);
        let service = ViewerCommandService::new(audit.clone(), generation);
        let command_kinds = [
            ViewerCommandKind::SetColor,
            ViewerCommandKind::SetVisible,
            ViewerCommandKind::SetOpacity,
            ViewerCommandKind::Offset,
            ViewerCommandKind::Rotate,
            ViewerCommandKind::ZoomTo,
            ViewerCommandKind::Snapshot,
            ViewerCommandKind::ExportImage,
            ViewerCommandKind::Dispose,
        ];

        for command in command_kinds {
            let created = service
                .create_command(ViewerCommandCreateRequest {
                    adapter: ViewerAdapterHint::ThreeJs,
                    command,
                    module_id: None,
                    artifact_id: Some(artifact_id),
                    element_ids: Some(vec!["architoken:demo:001".to_owned()]),
                    arguments: Some(json!({ "contractOnly": true })),
                    actor: Some("viewer-contract-test".to_owned()),
                })
                .expect("viewer command contract should be accepted");
            assert_eq!(created.command, command);
            assert_eq!(created.status, ViewerCommandStatus::Queued);
            assert!(created.audit_event_id.is_some());
        }

        let events = audit
            .list(&AuditEventQuery {
                module_id: Some("digital_twin".to_owned()),
                target_type: Some("viewer_command".to_owned()),
                target_id: None,
                actor: Some("viewer-contract-test".to_owned()),
                limit: Some(20),
                cursor: None,
            })
            .expect("audit list should work");
        assert_eq!(events.items.len(), command_kinds.len());
    }

    #[test]
    fn vendor_adapter_command_is_candidate_only() {
        let audit = Arc::new(ModuleAuditService::new());
        let (generation, _lifecycle) = generation_service(audit.clone());
        let service = ViewerCommandService::new(audit, generation);

        let command = service
            .create_command(ViewerCommandCreateRequest {
                adapter: ViewerAdapterHint::VendorOptrapid3d,
                command: ViewerCommandKind::LoadArtifact,
                module_id: Some("digital_twin".to_owned()),
                artifact_id: None,
                element_ids: None,
                arguments: Some(json!({ "route": "candidate_evaluation" })),
                actor: None,
            })
            .expect("candidate vendor command should create");
        assert_eq!(command.arguments["candidateAdapterOnly"], json!(true));
        assert_eq!(command.arguments["productionRouteEnabled"], json!(false));

        assert!(
            service
                .create_command(ViewerCommandCreateRequest {
                    adapter: ViewerAdapterHint::VendorOptrapid3d,
                    command: ViewerCommandKind::LoadArtifact,
                    module_id: Some("digital_twin".to_owned()),
                    artifact_id: None,
                    element_ids: None,
                    arguments: Some(json!({ "productionRouteEnabled": true })),
                    actor: None,
                })
                .is_err()
        );
    }
}
