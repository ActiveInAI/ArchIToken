// License: Apache-2.0

use crate::{
    inventory::{DatabaseInventoryStatus, DatabaseManagerInventory},
    module_operation_runtime::{ModuleOperationIntegrityRow, ModuleOperationRuntimeStatus},
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
    pub active_module_binding_count: usize,
    pub module_operation_run_count: i64,
    pub integrity_ready_count: usize,
    pub integrity_blocked_count: usize,
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
    module_status_result: Result<Vec<ModuleOperationRuntimeStatus>, String>,
    integrity_result: Result<Vec<ModuleOperationIntegrityRow>, String>,
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

    let (active_module_binding_count, module_operation_run_count, missing_operation_run_count) =
        match &module_status_result {
            Ok(rows) => {
                let active_rows: Vec<_> = rows
                    .iter()
                    .filter(|row| row.binding_state == "active")
                    .collect();
                let missing = active_rows
                    .iter()
                    .filter(|row| row.operation_run_count == 0)
                    .count();
                let operation_runs = active_rows
                    .iter()
                    .map(|row| row.operation_run_count)
                    .sum::<i64>();
                (active_rows.len(), operation_runs, missing)
            }
            Err(_) => (0, 0, 0),
        };
    let module_binding_ready = module_status_result.is_ok()
        && active_module_binding_count > 0
        && missing_operation_run_count == 0;

    let (integrity_ready_count, integrity_blocked_count) = match &integrity_result {
        Ok(rows) => {
            let ready = rows
                .iter()
                .filter(|row| row.integrity_status == "ready")
                .count();
            let blocked = rows.len().saturating_sub(ready);
            (ready, blocked)
        }
        Err(_) => (0, 0),
    };
    let integrity_ready = integrity_result.is_ok() && integrity_blocked_count == 0;

    let status = if database_inventory_ready
        && graph_sidecar_ready
        && module_binding_ready
        && integrity_ready
    {
        "ready"
    } else if integrity_blocked_count > 0
        || module_status_result.is_err()
        || integrity_result.is_err()
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
            error: module_status_result.err(),
        },
        DatabaseProductionReadinessCheck {
            check: "module_operation_integrity",
            status: if integrity_ready { "ready" } else { "blocked" },
            summary: json!({
                "ready": integrity_ready_count,
                "blocked": integrity_blocked_count,
            }),
            error: integrity_result.err(),
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

        let readiness =
            build_database_production_readiness(inventory, Ok(Vec::new()), Err("gap".to_owned()));

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
