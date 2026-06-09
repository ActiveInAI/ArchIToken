// License: Apache-2.0

use crate::module_operation_runtime::{
    DEFAULT_MODULE_OPERATION_TENANT_ID, ModuleOperationRuntimeError,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;

const DEFAULT_LIMIT: i64 = 100;
const MAX_LIMIT: i64 = 500;

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleFileOperationStatusQuery {
    pub tenant_id: Option<String>,
    pub project_id: Option<String>,
    pub module_id: Option<String>,
    pub file_id: Option<String>,
    pub runtime_status: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ModuleFileOperationRuntimeStatus {
    pub tenant_id: uuid::Uuid,
    pub project_id: uuid::Uuid,
    pub module_id: String,
    pub module_zh_name: String,
    pub module_en_name: String,
    pub file_id: uuid::Uuid,
    pub parent_id: Option<uuid::Uuid>,
    pub name: String,
    pub kind: String,
    pub file_status: String,
    pub validation_status: String,
    pub version: i32,
    pub owner: String,
    pub size_bytes: i64,
    pub mime_type: Option<String>,
    pub checksum: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub operation_run_count: i64,
    pub latest_operation_run_id: Option<uuid::Uuid>,
    pub latest_operation_key: Option<String>,
    pub latest_operation_status: Option<String>,
    pub event_count: i64,
    pub audit_count: i64,
    pub graph_edge_count: i64,
    pub runtime_status: String,
    pub issues: Value,
}

pub async fn load_module_file_operation_runtime_status(
    pool: &PgPool,
    query: ModuleFileOperationStatusQuery,
) -> Result<Vec<ModuleFileOperationRuntimeStatus>, ModuleOperationRuntimeError> {
    let tenant_id = parse_uuid_or_default(
        query.tenant_id.as_deref(),
        DEFAULT_MODULE_OPERATION_TENANT_ID,
        "tenantId",
    )?;
    let project_id = parse_optional_uuid(query.project_id.as_deref(), "projectId")?;
    let module_id = optional_non_empty(query.module_id.as_deref());
    if let Some(module_id) = module_id
        && !is_route_token(module_id)
    {
        return Err(ModuleOperationRuntimeError::InvalidInput(
            "moduleId must use lowercase registry token characters".to_owned(),
        ));
    }
    let file_id = parse_optional_uuid(query.file_id.as_deref(), "fileId")?;
    let runtime_status = optional_non_empty(query.runtime_status.as_deref());
    if let Some(runtime_status) = runtime_status
        && !matches!(runtime_status, "ready" | "blocked")
    {
        return Err(ModuleOperationRuntimeError::InvalidInput(
            "runtimeStatus must be ready or blocked".to_owned(),
        ));
    }
    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);

    let mut tx = pool.begin().await?;
    sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;
    let rows = sqlx::query_as::<_, ModuleFileOperationRuntimeStatus>(
        r#"
        SELECT
            tenant_id,
            project_id,
            module_id,
            module_zh_name,
            module_en_name,
            file_id,
            parent_id,
            name,
            kind,
            file_status,
            validation_status,
            version,
            owner,
            size_bytes,
            mime_type,
            checksum,
            created_at,
            updated_at,
            operation_run_count::int8,
            latest_operation_run_id,
            latest_operation_key,
            latest_operation_status,
            event_count::int8,
            audit_count::int8,
            graph_edge_count::int8,
            runtime_status,
            issues
        FROM module_file_operation_runtime_status
        WHERE tenant_id = $1::uuid
          AND ($2::uuid IS NULL OR project_id = $2::uuid)
          AND ($3::text IS NULL OR module_id = $3)
          AND ($4::uuid IS NULL OR file_id = $4::uuid)
          AND ($5::text IS NULL OR runtime_status = $5)
        ORDER BY
            CASE WHEN runtime_status = 'blocked' THEN 0 ELSE 1 END,
            updated_at DESC,
            file_id
        LIMIT $6
        "#,
    )
    .bind(tenant_id)
    .bind(project_id)
    .bind(module_id)
    .bind(file_id)
    .bind(runtime_status)
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

fn parse_uuid_or_default(
    value: Option<&str>,
    default_value: &str,
    field_name: &str,
) -> Result<uuid::Uuid, ModuleOperationRuntimeError> {
    parse_uuid(value.unwrap_or(default_value), field_name)
}

fn parse_uuid(value: &str, field_name: &str) -> Result<uuid::Uuid, ModuleOperationRuntimeError> {
    value.parse::<uuid::Uuid>().map_err(|err| {
        ModuleOperationRuntimeError::InvalidInput(format!("{field_name} must be a UUID: {err}"))
    })
}

fn parse_optional_uuid(
    value: Option<&str>,
    field_name: &str,
) -> Result<Option<uuid::Uuid>, ModuleOperationRuntimeError> {
    match value.map(str::trim).filter(|raw| !raw.is_empty()) {
        Some(raw) => parse_uuid(raw, field_name).map(Some),
        None => Ok(None),
    }
}

fn optional_non_empty(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|raw| !raw.is_empty())
}

fn is_route_token(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_' || ch == '-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_file_id() {
        let error = parse_uuid("bad", "fileId").unwrap_err();
        assert!(error.to_string().contains("fileId"));
    }

    #[test]
    fn optional_uuid_treats_blank_as_missing() {
        assert_eq!(parse_optional_uuid(Some(""), "projectId").unwrap(), None);
        assert_eq!(parse_optional_uuid(Some("   "), "fileId").unwrap(), None);
    }

    #[test]
    fn accepts_route_token_module_id() {
        assert!(is_route_token("standard_library"));
        assert!(!is_route_token("Standard Library"));
    }
}
