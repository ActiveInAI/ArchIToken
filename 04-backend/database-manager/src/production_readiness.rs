// License: Apache-2.0

use crate::{
    inventory::{DatabaseInventoryStatus, DatabaseManagerInventory},
    module_file_operation_runtime::ModuleFileOperationRuntimeSummary,
    module_operation_runtime::ModuleOperationRuntimeSummary,
    module_transaction_operation_runtime::ModuleTransactionOperationRuntimeSummary,
};
use serde::Serialize;
use serde_json::{Value, json};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseProductionReadiness {
    pub generated_at_unix_ms: u128,
    pub status: String,
    pub live_database_count: usize,
    pub unavailable_database_count: usize,
    pub not_configured_database_count: usize,
    pub active_module_binding_count: i64,
    pub module_operation_run_count: i64,
    pub module_file_count: i64,
    pub module_file_ready_count: i64,
    pub module_file_blocked_count: i64,
    pub module_transaction_count: i64,
    pub module_transaction_ready_count: i64,
    pub module_transaction_blocked_count: i64,
    pub module_transaction_operation_run_count: i64,
    pub integrity_ready_count: i64,
    pub integrity_blocked_count: i64,
    pub graph_sidecar_ready: bool,
    pub checks: Vec<DatabaseProductionReadinessCheck>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseProductionReadinessCheck {
    pub check: &'static str,
    pub status: &'static str,
    pub summary: Value,
    pub error: Option<String>,
}

pub fn build_database_production_readiness(
    inventory: DatabaseManagerInventory,
    module_runtime_result: Result<ModuleOperationRuntimeSummary, String>,
    file_runtime_result: Result<ModuleFileOperationRuntimeSummary, String>,
    transaction_runtime_result: Result<ModuleTransactionOperationRuntimeSummary, String>,
) -> DatabaseProductionReadiness {
    let not_configured_database_count = inventory
        .items
        .iter()
        .filter(|item| item.status == DatabaseInventoryStatus::NotConfigured)
        .count();
    let database_inventory_ready =
        inventory.unavailable_count == 0 && not_configured_database_count == 0;
    let graph_sidecar_ready = inventory
        .items
        .iter()
        .any(|item| item.engine == "graph_sidecar" && item.status == DatabaseInventoryStatus::Live);

    let (
        active_module_binding_count,
        module_operation_run_count,
        missing_operation_run_count,
        module_operation_event_count,
        module_operation_audit_count,
        module_operation_graph_edge_count,
        integrity_ready_count,
        integrity_blocked_count,
    ) = match &module_runtime_result {
        Ok(summary) => (
            summary.active_binding_count,
            summary.operation_run_count,
            summary.missing_operation_run_count,
            summary.event_count,
            summary.audit_count,
            summary.graph_edge_count,
            summary.integrity_ready_count,
            summary.integrity_blocked_count,
        ),
        Err(_) => (0, 0, 0, 0, 0, 0, 0, 0),
    };
    let module_binding_ready = module_runtime_result.is_ok()
        && active_module_binding_count > 0
        && missing_operation_run_count == 0;
    let integrity_ready = module_runtime_result.is_ok()
        && module_operation_run_count > 0
        && integrity_blocked_count == 0
        && integrity_ready_count == module_operation_run_count
        && module_operation_event_count == module_operation_run_count
        && module_operation_audit_count == module_operation_run_count
        && module_operation_graph_edge_count == module_operation_run_count;

    let (module_file_count, module_file_ready_count, module_file_blocked_count) =
        match &file_runtime_result {
            Ok(summary) => (
                summary.file_count,
                summary.ready_count,
                summary.blocked_count,
            ),
            Err(_) => (0, 0, 0),
        };
    let file_runtime_ready = file_runtime_result.is_ok()
        && module_file_count > 0
        && module_file_ready_count == module_file_count
        && module_file_blocked_count == 0;

    let (
        module_transaction_count,
        module_transaction_ready_count,
        module_transaction_blocked_count,
        module_transaction_operation_run_count,
        module_transaction_approval_count,
        module_transaction_approval_operation_run_count,
    ) = match &transaction_runtime_result {
        Ok(summary) => (
            summary.transaction_count,
            summary.ready_count,
            summary.blocked_count,
            summary.operation_run_count,
            summary.approval_count,
            summary.approval_operation_run_count,
        ),
        Err(_) => (0, 0, 0, 0, 0, 0),
    };
    let transaction_runtime_ready = transaction_runtime_result.is_ok()
        && module_transaction_count > 0
        && module_transaction_blocked_count == 0
        && module_transaction_ready_count == module_transaction_count
        && module_transaction_operation_run_count >= module_transaction_count
        && module_transaction_approval_operation_run_count >= module_transaction_approval_count;

    let status = if database_inventory_ready
        && graph_sidecar_ready
        && module_binding_ready
        && integrity_ready
        && file_runtime_ready
        && transaction_runtime_ready
    {
        "ready"
    } else if integrity_blocked_count > 0
        || module_file_blocked_count > 0
        || module_transaction_blocked_count > 0
        || module_runtime_result.is_err()
        || file_runtime_result.is_err()
        || transaction_runtime_result.is_err()
    {
        "blocked"
    } else {
        "degraded"
    }
    .to_owned();

    let checks = vec![
        DatabaseProductionReadinessCheck {
            check: "database_inventory",
            status: if database_inventory_ready {
                "ready"
            } else {
                "degraded"
            },
            summary: json!({
                "items": inventory.item_count,
                "live": inventory.live_count,
                "unavailable": inventory.unavailable_count,
                "notConfigured": not_configured_database_count,
            }),
            error: None,
        },
        DatabaseProductionReadinessCheck {
            check: "graph_sidecar",
            status: if graph_sidecar_ready {
                "ready"
            } else {
                "degraded"
            },
            summary: inventory
                .items
                .iter()
                .find(|item| item.engine == "graph_sidecar")
                .map(|item| item.summary.clone())
                .unwrap_or_else(|| json!({})),
            error: inventory
                .items
                .iter()
                .find(|item| item.engine == "graph_sidecar")
                .and_then(|item| item.error.clone()),
        },
        DatabaseProductionReadinessCheck {
            check: "module_operation_bindings",
            status: if module_binding_ready {
                "ready"
            } else {
                "blocked"
            },
            summary: json!({
                "activeBindings": active_module_binding_count,
                "operationRuns": module_operation_run_count,
                "missingOperationRuns": missing_operation_run_count,
            }),
            error: module_runtime_result.as_ref().err().cloned(),
        },
        DatabaseProductionReadinessCheck {
            check: "module_operation_integrity",
            status: if integrity_ready { "ready" } else { "blocked" },
            summary: json!({
                "ready": integrity_ready_count,
                "blocked": integrity_blocked_count,
                "events": module_operation_event_count,
                "audits": module_operation_audit_count,
                "graphEdges": module_operation_graph_edge_count,
            }),
            error: module_runtime_result.err(),
        },
        DatabaseProductionReadinessCheck {
            check: "module_file_operation_runtime",
            status: if file_runtime_ready {
                "ready"
            } else {
                "blocked"
            },
            summary: json!({
                "files": module_file_count,
                "ready": module_file_ready_count,
                "blocked": module_file_blocked_count,
                "operationRuns": file_runtime_result
                    .as_ref()
                    .map(|summary| summary.operation_run_count)
                    .unwrap_or_default(),
                "events": file_runtime_result
                    .as_ref()
                    .map(|summary| summary.event_count)
                    .unwrap_or_default(),
                "audits": file_runtime_result
                    .as_ref()
                    .map(|summary| summary.audit_count)
                    .unwrap_or_default(),
                "graphEdges": file_runtime_result
                    .as_ref()
                    .map(|summary| summary.graph_edge_count)
                    .unwrap_or_default(),
            }),
            error: file_runtime_result.err(),
        },
        DatabaseProductionReadinessCheck {
            check: "module_transaction_operation_runtime",
            status: if transaction_runtime_ready {
                "ready"
            } else {
                "blocked"
            },
            summary: json!({
                "transactions": module_transaction_count,
                "ready": module_transaction_ready_count,
                "blocked": module_transaction_blocked_count,
                "operationRuns": module_transaction_operation_run_count,
                "approvals": module_transaction_approval_count,
                "approvalOperationRuns": module_transaction_approval_operation_run_count,
            }),
            error: transaction_runtime_result.err(),
        },
    ];

    DatabaseProductionReadiness {
        generated_at_unix_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or_default(),
        status,
        live_database_count: inventory.live_count,
        unavailable_database_count: inventory.unavailable_count,
        not_configured_database_count,
        active_module_binding_count,
        module_operation_run_count,
        module_file_count,
        module_file_ready_count,
        module_file_blocked_count,
        module_transaction_count,
        module_transaction_ready_count,
        module_transaction_blocked_count,
        module_transaction_operation_run_count,
        integrity_ready_count,
        integrity_blocked_count,
        graph_sidecar_ready,
        checks,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::inventory::DatabaseInventoryItem;

    #[test]
    fn readiness_blocks_when_integrity_has_gaps() {
        let inventory = DatabaseManagerInventory {
            generated_at_unix_ms: 0,
            status: "ready",
            item_count: 1,
            live_count: 1,
            unavailable_count: 0,
            items: vec![DatabaseInventoryItem {
                engine: "graph_sidecar",
                status: DatabaseInventoryStatus::Live,
                source: Some("http://127.0.0.1:8088".to_owned()),
                summary: json!({"provider": "architoken_graph_sidecar"}),
                data: None,
                error: None,
            }],
        };

        let readiness = build_database_production_readiness(
            inventory,
            Err("gap".to_owned()),
            Ok(ModuleFileOperationRuntimeSummary {
                file_count: 1,
                ready_count: 1,
                blocked_count: 0,
                operation_run_count: 1,
                event_count: 1,
                audit_count: 1,
                graph_edge_count: 1,
            }),
            Ok(ModuleTransactionOperationRuntimeSummary {
                transaction_count: 1,
                ready_count: 1,
                blocked_count: 0,
                operation_run_count: 1,
                event_count: 1,
                audit_count: 1,
                graph_edge_count: 1,
                approval_count: 0,
                approval_operation_run_count: 0,
            }),
        );

        assert_eq!(readiness.status, "blocked");
        assert_eq!(readiness.integrity_blocked_count, 0);
        assert!(
            readiness
                .checks
                .iter()
                .any(|check| check.check == "module_operation_integrity"
                    && check.status == "blocked")
        );
    }
}
