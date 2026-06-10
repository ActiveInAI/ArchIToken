// License: Apache-2.0

use crate::{
    heavy_steel_program::{
        DEFAULT_HEAVY_STEEL_PROGRAM_ID, DEFAULT_HEAVY_STEEL_PROJECT_ID,
        DEFAULT_HEAVY_STEEL_TENANT_ID,
    },
    module_operation_runtime::DEFAULT_MODULE_OPERATION_TENANT_ID,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum OpsMaturityError {
    #[error("database ops maturity input is invalid: {0}")]
    InvalidInput(String),
    #[error("database ops maturity query failed: {0}")]
    Query(#[from] sqlx::Error),
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpsMaturityQuery {
    pub tenant_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeavySteelEndToEndReadinessQuery {
    pub tenant_id: Option<String>,
    pub project_id: Option<String>,
    pub program_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseOpsMaturityReadiness {
    pub tenant_id: uuid::Uuid,
    pub bastion_session_count: i64,
    pub command_event_count: i64,
    pub archive_batch_count: i64,
    pub missing_recording_count: i64,
    pub pending_archive_count: i64,
    pub audit_archive_gate_state: String,
    pub active_backup_policy_count: i64,
    pub successful_backup_count: i64,
    pub passed_restore_drill_count: i64,
    pub last_successful_backup_at: Option<chrono::DateTime<chrono::Utc>>,
    pub last_passed_restore_drill_at: Option<chrono::DateTime<chrono::Utc>>,
    pub backup_restore_gate_state: String,
    pub active_module_binding_count: i64,
    pub module_operation_run_count: i64,
    pub module_operation_event_count: i64,
    pub module_operation_audit_count: i64,
    pub module_operation_graph_edge_count: i64,
    pub missing_operation_run_count: i64,
    pub integrity_ready_count: i64,
    pub integrity_blocked_count: i64,
    pub module_file_count: i64,
    pub module_file_ready_count: i64,
    pub module_file_blocked_count: i64,
    pub module_file_operation_run_count: i64,
    pub module_file_event_count: i64,
    pub module_file_audit_count: i64,
    pub module_file_graph_edge_count: i64,
    pub module_transaction_count: i64,
    pub module_transaction_ready_count: i64,
    pub module_transaction_blocked_count: i64,
    pub module_transaction_operation_run_count: i64,
    pub module_transaction_event_count: i64,
    pub module_transaction_audit_count: i64,
    pub module_transaction_graph_edge_count: i64,
    pub module_transaction_approval_count: i64,
    pub module_transaction_approval_operation_run_count: i64,
    pub p0_gate_state: String,
    pub maturity_level: String,
    pub issues: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct HeavySteelEndToEndReadiness {
    pub tenant_id: uuid::Uuid,
    pub project_id: uuid::Uuid,
    pub program_id: String,
    pub source_drawing_count: i64,
    pub source_package_count: i64,
    pub source_section_count: i64,
    pub bound_module_count: i64,
    pub package_work_item_count: i64,
    pub module_work_order_count: i64,
    pub bom_document_count: i64,
    pub bom_version_count: i64,
    pub bom_line_count: i64,
    pub bom_total_quantity: f64,
    pub bom_line_source_count: i64,
    pub downstream_link_count: i64,
    pub bridge_graph_edge_count: i64,
    pub bridge_event_count: i64,
    pub bridge_analytics_count: i64,
    pub bridge_audit_count: i64,
    pub module_file_count: i64,
    pub module_file_ready_count: i64,
    pub module_file_blocked_count: i64,
    pub module_file_operation_run_count: i64,
    pub module_file_event_count: i64,
    pub module_file_audit_count: i64,
    pub module_file_graph_edge_count: i64,
    pub module_transaction_count: i64,
    pub module_transaction_ready_count: i64,
    pub module_transaction_blocked_count: i64,
    pub module_transaction_operation_run_count: i64,
    pub module_transaction_event_count: i64,
    pub module_transaction_audit_count: i64,
    pub module_transaction_graph_edge_count: i64,
    pub module_transaction_approval_count: i64,
    pub module_transaction_approval_operation_run_count: i64,
    pub active_module_binding_count: i64,
    pub module_operation_run_count: i64,
    pub module_operation_event_count: i64,
    pub module_operation_audit_count: i64,
    pub module_operation_graph_edge_count: i64,
    pub missing_operation_run_count: i64,
    pub integrity_ready_count: i64,
    pub integrity_blocked_count: i64,
    pub heavy_steel_operation_run_count: i64,
    pub heavy_steel_event_count: i64,
    pub heavy_steel_audit_count: i64,
    pub heavy_steel_graph_edge_count: i64,
    pub audit_archive_gate_state: String,
    pub backup_restore_gate_state: String,
    pub ops_maturity_gate_state: String,
    pub p0_gate_state: String,
    pub issues: Value,
}

pub async fn load_database_ops_maturity_readiness(
    pool: &PgPool,
    query: OpsMaturityQuery,
) -> Result<DatabaseOpsMaturityReadiness, OpsMaturityError> {
    let tenant_id = parse_uuid_or_default(
        query.tenant_id.as_deref(),
        DEFAULT_MODULE_OPERATION_TENANT_ID,
        "tenantId",
    )?;

    let mut tx = pool.begin().await?;
    sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;
    let row = sqlx::query_as::<_, DatabaseOpsMaturityReadiness>(
        r#"
        SELECT
            tenant_id,
            bastion_session_count::int8,
            command_event_count::int8,
            archive_batch_count::int8,
            missing_recording_count::int8,
            pending_archive_count::int8,
            audit_archive_gate_state,
            active_backup_policy_count::int8,
            successful_backup_count::int8,
            passed_restore_drill_count::int8,
            last_successful_backup_at,
            last_passed_restore_drill_at,
            backup_restore_gate_state,
            active_module_binding_count::int8,
            module_operation_run_count::int8,
            module_operation_event_count::int8,
            module_operation_audit_count::int8,
            module_operation_graph_edge_count::int8,
            missing_operation_run_count::int8,
            integrity_ready_count::int8,
            integrity_blocked_count::int8,
            module_file_count::int8,
            module_file_ready_count::int8,
            module_file_blocked_count::int8,
            module_file_operation_run_count::int8,
            module_file_event_count::int8,
            module_file_audit_count::int8,
            module_file_graph_edge_count::int8,
            module_transaction_count::int8,
            module_transaction_ready_count::int8,
            module_transaction_blocked_count::int8,
            module_transaction_operation_run_count::int8,
            module_transaction_event_count::int8,
            module_transaction_audit_count::int8,
            module_transaction_graph_edge_count::int8,
            module_transaction_approval_count::int8,
            module_transaction_approval_operation_run_count::int8,
            p0_gate_state,
            maturity_level,
            issues
        FROM database_ops_maturity_readiness
        WHERE tenant_id = $1::uuid
        "#,
    )
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn load_heavy_steel_end_to_end_readiness(
    pool: &PgPool,
    query: HeavySteelEndToEndReadinessQuery,
) -> Result<HeavySteelEndToEndReadiness, OpsMaturityError> {
    let tenant_id = parse_uuid_or_default(
        query.tenant_id.as_deref(),
        DEFAULT_HEAVY_STEEL_TENANT_ID,
        "tenantId",
    )?;
    let project_id = parse_uuid_or_default(
        query.project_id.as_deref(),
        DEFAULT_HEAVY_STEEL_PROJECT_ID,
        "projectId",
    )?;
    let program_id =
        optional_non_empty(query.program_id.as_deref()).unwrap_or(DEFAULT_HEAVY_STEEL_PROGRAM_ID);
    validate_route_token(program_id, "programId")?;

    let mut tx = pool.begin().await?;
    sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;
    let row = sqlx::query_as::<_, HeavySteelEndToEndReadiness>(
        r#"
        SELECT
            tenant_id,
            project_id,
            program_id,
            source_drawing_count::int8,
            source_package_count::int8,
            source_section_count::int8,
            bound_module_count::int8,
            package_work_item_count::int8,
            module_work_order_count::int8,
            bom_document_count::int8,
            bom_version_count::int8,
            bom_line_count::int8,
            bom_total_quantity::float8,
            bom_line_source_count::int8,
            downstream_link_count::int8,
            bridge_graph_edge_count::int8,
            bridge_event_count::int8,
            bridge_analytics_count::int8,
            bridge_audit_count::int8,
            module_file_count::int8,
            module_file_ready_count::int8,
            module_file_blocked_count::int8,
            module_file_operation_run_count::int8,
            module_file_event_count::int8,
            module_file_audit_count::int8,
            module_file_graph_edge_count::int8,
            module_transaction_count::int8,
            module_transaction_ready_count::int8,
            module_transaction_blocked_count::int8,
            module_transaction_operation_run_count::int8,
            module_transaction_event_count::int8,
            module_transaction_audit_count::int8,
            module_transaction_graph_edge_count::int8,
            module_transaction_approval_count::int8,
            module_transaction_approval_operation_run_count::int8,
            active_module_binding_count::int8,
            module_operation_run_count::int8,
            module_operation_event_count::int8,
            module_operation_audit_count::int8,
            module_operation_graph_edge_count::int8,
            missing_operation_run_count::int8,
            integrity_ready_count::int8,
            integrity_blocked_count::int8,
            heavy_steel_operation_run_count::int8,
            heavy_steel_event_count::int8,
            heavy_steel_audit_count::int8,
            heavy_steel_graph_edge_count::int8,
            audit_archive_gate_state,
            backup_restore_gate_state,
            ops_maturity_gate_state,
            p0_gate_state,
            issues
        FROM heavy_steel_end_to_end_readiness
        WHERE tenant_id = $1::uuid
          AND project_id = $2::uuid
          AND program_id = $3
        "#,
    )
    .bind(tenant_id)
    .bind(project_id)
    .bind(program_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

fn parse_uuid_or_default(
    value: Option<&str>,
    default_value: &str,
    field_name: &str,
) -> Result<uuid::Uuid, OpsMaturityError> {
    value
        .unwrap_or(default_value)
        .parse::<uuid::Uuid>()
        .map_err(|err| {
            OpsMaturityError::InvalidInput(format!("{field_name} must be a UUID: {err}"))
        })
}

fn optional_non_empty(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|raw| !raw.is_empty())
}

fn validate_route_token(value: &str, field_name: &str) -> Result<(), OpsMaturityError> {
    if value.len() <= 160
        && !value.is_empty()
        && value
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_' || ch == '-')
    {
        Ok(())
    } else {
        Err(OpsMaturityError::InvalidInput(format!(
            "{field_name} must use lowercase registry token characters"
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_program_id() {
        assert!(validate_route_token("../bad", "programId").is_err());
    }
}
