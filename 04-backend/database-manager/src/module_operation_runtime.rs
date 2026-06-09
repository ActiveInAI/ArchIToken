// License: Apache-2.0

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use thiserror::Error;

pub const DEFAULT_MODULE_OPERATION_TENANT_ID: &str = "11111111-1111-4111-8111-111111111111";
pub const DEFAULT_MODULE_OPERATION_PROJECT_ID: &str = "5abffe50-2670-42e2-97ea-ec6ac71d8183";
const DEFAULT_LIMIT: i64 = 100;
const MAX_LIMIT: i64 = 500;

#[derive(Debug, Error)]
pub enum ModuleOperationRuntimeError {
    #[error("module operation runtime input is invalid: {0}")]
    InvalidInput(String),
    #[error("module operation runtime query failed: {0}")]
    Query(#[from] sqlx::Error),
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleOperationRequest {
    pub tenant_id: Option<String>,
    pub project_id: Option<String>,
    pub module_id: String,
    pub operation_key: String,
    pub operation_label: String,
    pub actor: String,
    pub operation_kind: Option<String>,
    pub status: Option<String>,
    pub source_surface: Option<String>,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub related_file_ids: Option<Value>,
    pub related_artifact_ids: Option<Value>,
    pub idempotency_key: Option<String>,
    pub request_payload: Option<Value>,
    pub result_payload: Option<Value>,
    pub evidence: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleOperationListQuery {
    pub tenant_id: Option<String>,
    pub project_id: Option<String>,
    pub module_id: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ModuleOperationRuntimeStatus {
    pub tenant_id: uuid::Uuid,
    pub project_id: uuid::Uuid,
    pub module_id: String,
    pub module_zh_name: String,
    pub module_en_name: String,
    pub operation_surface: String,
    pub write_policy: String,
    pub binding_state: String,
    pub relational_route: String,
    pub object_route: String,
    pub graph_route: String,
    pub event_route: String,
    pub analytics_route: String,
    pub audit_route: String,
    pub operation_run_count: i64,
    pub event_count: i64,
    pub audit_count: i64,
    pub graph_edge_count: i64,
    pub last_operation_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ModuleOperationRun {
    pub operation_run_id: uuid::Uuid,
    pub tenant_id: uuid::Uuid,
    pub project_id: uuid::Uuid,
    pub module_id: String,
    pub operation_surface: String,
    pub operation_key: String,
    pub operation_label: String,
    pub operation_kind: String,
    pub status: String,
    pub actor: String,
    pub source_surface: String,
    pub target_type: String,
    pub target_id: String,
    pub related_file_ids: Value,
    pub related_artifact_ids: Value,
    pub idempotency_key: String,
    pub request_payload: Value,
    pub result_payload: Value,
    pub evidence: Value,
    pub professional_state: String,
    pub approval_state: String,
    pub event_id: Option<uuid::Uuid>,
    pub audit_event_id: Option<uuid::Uuid>,
    pub graph_edge_id: Option<uuid::Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub async fn create_module_operation(
    pool: &PgPool,
    request: ModuleOperationRequest,
) -> Result<ModuleOperationRun, ModuleOperationRuntimeError> {
    validate_module_operation_request(&request)?;

    let tenant_id = parse_uuid_or_default(
        request.tenant_id.as_deref(),
        DEFAULT_MODULE_OPERATION_TENANT_ID,
        "tenantId",
    )?;
    let project_id = parse_uuid_or_default(
        request.project_id.as_deref(),
        DEFAULT_MODULE_OPERATION_PROJECT_ID,
        "projectId",
    )?;
    let operation_kind = request
        .operation_kind
        .clone()
        .unwrap_or_else(|| "module_business_operation".to_owned());
    let status = request
        .status
        .clone()
        .unwrap_or_else(|| "requested".to_owned());
    let source_surface = request
        .source_surface
        .clone()
        .unwrap_or_else(|| "database_manager_api".to_owned());
    let target_type = request
        .target_type
        .clone()
        .unwrap_or_else(|| "module".to_owned());
    let target_id = request
        .target_id
        .clone()
        .unwrap_or_else(|| request.module_id.clone());
    let idempotency_key = request.idempotency_key.clone().unwrap_or_else(|| {
        format!(
            "api:{}:{}:{}",
            request.module_id,
            request.operation_key,
            uuid::Uuid::new_v4()
        )
    });
    let related_file_ids = request
        .related_file_ids
        .clone()
        .unwrap_or_else(|| Value::Array(Vec::new()));
    let related_artifact_ids = request
        .related_artifact_ids
        .clone()
        .unwrap_or_else(|| Value::Array(Vec::new()));
    let request_payload = request
        .request_payload
        .clone()
        .unwrap_or_else(|| Value::Object(Default::default()));
    let result_payload = request
        .result_payload
        .clone()
        .unwrap_or_else(|| Value::Object(Default::default()));
    let evidence = request
        .evidence
        .clone()
        .unwrap_or_else(|| Value::Object(Default::default()));

    let mut tx = pool.begin().await?;
    sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    let run = sqlx::query_as::<_, ModuleOperationRun>(
        r#"
        INSERT INTO module_operation_runs (
            tenant_id,
            project_id,
            module_id,
            operation_surface,
            operation_key,
            operation_label,
            operation_kind,
            status,
            actor,
            source_surface,
            target_type,
            target_id,
            related_file_ids,
            related_artifact_ids,
            idempotency_key,
            request_payload,
            result_payload,
            evidence
        )
        SELECT
            $1::uuid,
            $2::uuid,
            $3,
            'module_operation_write',
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12::jsonb,
            $13::jsonb,
            $14,
            $15::jsonb,
            $16::jsonb,
            $17::jsonb
        WHERE EXISTS (
            SELECT 1
            FROM module_database_operation_bindings
            WHERE tenant_id = $1::uuid
              AND project_id = $2::uuid
              AND module_id = $3
              AND operation_surface = 'module_operation_write'
              AND binding_state = 'active'
              AND write_policy <> 'read_only'
        )
        ON CONFLICT (tenant_id, project_id, module_id, idempotency_key) DO UPDATE SET
            operation_key = EXCLUDED.operation_key,
            operation_label = EXCLUDED.operation_label,
            operation_kind = EXCLUDED.operation_kind,
            status = EXCLUDED.status,
            actor = EXCLUDED.actor,
            source_surface = EXCLUDED.source_surface,
            target_type = EXCLUDED.target_type,
            target_id = EXCLUDED.target_id,
            related_file_ids = EXCLUDED.related_file_ids,
            related_artifact_ids = EXCLUDED.related_artifact_ids,
            request_payload = EXCLUDED.request_payload,
            result_payload = EXCLUDED.result_payload,
            evidence = EXCLUDED.evidence,
            professional_state = 'professional_review_required',
            approval_state = 'approval_required',
            updated_at = NOW()
        RETURNING
            operation_run_id,
            tenant_id,
            project_id,
            module_id,
            operation_surface,
            operation_key,
            operation_label,
            operation_kind,
            status,
            actor,
            source_surface,
            target_type,
            target_id,
            related_file_ids,
            related_artifact_ids,
            idempotency_key,
            request_payload,
            result_payload,
            evidence,
            professional_state,
            approval_state,
            event_id,
            audit_event_id,
            graph_edge_id,
            created_at,
            updated_at
        "#,
    )
    .bind(tenant_id)
    .bind(project_id)
    .bind(&request.module_id)
    .bind(&request.operation_key)
    .bind(&request.operation_label)
    .bind(&operation_kind)
    .bind(&status)
    .bind(&request.actor)
    .bind(&source_surface)
    .bind(&target_type)
    .bind(&target_id)
    .bind(&related_file_ids)
    .bind(&related_artifact_ids)
    .bind(&idempotency_key)
    .bind(&request_payload)
    .bind(&result_payload)
    .bind(&evidence)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        ModuleOperationRuntimeError::InvalidInput(format!(
            "module {} is not bound to an active database write route",
            request.module_id
        ))
    })?;

    tx.commit().await?;
    Ok(run)
}

pub async fn list_module_operations(
    pool: &PgPool,
    query: ModuleOperationListQuery,
) -> Result<Vec<ModuleOperationRun>, ModuleOperationRuntimeError> {
    let tenant_id = parse_uuid_or_default(
        query.tenant_id.as_deref(),
        DEFAULT_MODULE_OPERATION_TENANT_ID,
        "tenantId",
    )?;
    let project_id = parse_uuid_or_default(
        query.project_id.as_deref(),
        DEFAULT_MODULE_OPERATION_PROJECT_ID,
        "projectId",
    )?;
    let module_id = query.module_id.as_deref();
    if let Some(module_id) = module_id
        && !is_route_token(module_id)
    {
        return Err(ModuleOperationRuntimeError::InvalidInput(
            "moduleId must use lowercase registry token characters".to_owned(),
        ));
    }
    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);

    let mut tx = pool.begin().await?;
    sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;
    let runs = sqlx::query_as::<_, ModuleOperationRun>(
        r#"
        SELECT
            operation_run_id,
            tenant_id,
            project_id,
            module_id,
            operation_surface,
            operation_key,
            operation_label,
            operation_kind,
            status,
            actor,
            source_surface,
            target_type,
            target_id,
            related_file_ids,
            related_artifact_ids,
            idempotency_key,
            request_payload,
            result_payload,
            evidence,
            professional_state,
            approval_state,
            event_id,
            audit_event_id,
            graph_edge_id,
            created_at,
            updated_at
        FROM module_operation_runs
        WHERE tenant_id = $1::uuid
          AND project_id = $2::uuid
          AND ($3::text IS NULL OR module_id = $3)
        ORDER BY updated_at DESC, operation_run_id
        LIMIT $4
        "#,
    )
    .bind(tenant_id)
    .bind(project_id)
    .bind(module_id)
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(runs)
}

pub async fn load_module_operation_runtime_status(
    pool: &PgPool,
    query: ModuleOperationListQuery,
) -> Result<Vec<ModuleOperationRuntimeStatus>, ModuleOperationRuntimeError> {
    let tenant_id = parse_uuid_or_default(
        query.tenant_id.as_deref(),
        DEFAULT_MODULE_OPERATION_TENANT_ID,
        "tenantId",
    )?;
    let project_id = parse_uuid_or_default(
        query.project_id.as_deref(),
        DEFAULT_MODULE_OPERATION_PROJECT_ID,
        "projectId",
    )?;
    let module_id = query.module_id.as_deref();
    if let Some(module_id) = module_id
        && !is_route_token(module_id)
    {
        return Err(ModuleOperationRuntimeError::InvalidInput(
            "moduleId must use lowercase registry token characters".to_owned(),
        ));
    }

    let mut tx = pool.begin().await?;
    sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;
    let rows = sqlx::query_as::<_, ModuleOperationRuntimeStatus>(
        r#"
        SELECT
            tenant_id,
            project_id,
            module_id,
            module_zh_name,
            module_en_name,
            operation_surface,
            write_policy,
            binding_state,
            relational_route,
            object_route,
            graph_route,
            event_route,
            analytics_route,
            audit_route,
            operation_run_count::int8,
            event_count::int8,
            audit_count::int8,
            graph_edge_count::int8,
            last_operation_at
        FROM module_operation_runtime_status
        WHERE tenant_id = $1::uuid
          AND project_id = $2::uuid
          AND ($3::text IS NULL OR module_id = $3)
        ORDER BY module_id
        "#,
    )
    .bind(tenant_id)
    .bind(project_id)
    .bind(module_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

fn validate_module_operation_request(
    request: &ModuleOperationRequest,
) -> Result<(), ModuleOperationRuntimeError> {
    if !is_route_token(&request.module_id) {
        return Err(ModuleOperationRuntimeError::InvalidInput(
            "moduleId must use lowercase registry token characters".to_owned(),
        ));
    }
    if !is_operation_key(&request.operation_key) {
        return Err(ModuleOperationRuntimeError::InvalidInput(
            "operationKey must be 3-128 chars and use lowercase route token characters".to_owned(),
        ));
    }
    if request.operation_label.trim().is_empty() || request.operation_label.len() > 200 {
        return Err(ModuleOperationRuntimeError::InvalidInput(
            "operationLabel must be 1-200 chars".to_owned(),
        ));
    }
    if request.actor.trim().is_empty() || request.actor.len() > 160 {
        return Err(ModuleOperationRuntimeError::InvalidInput(
            "actor must be 1-160 chars".to_owned(),
        ));
    }
    if let Some(kind) = &request.operation_kind
        && !is_operation_key(kind)
    {
        return Err(ModuleOperationRuntimeError::InvalidInput(
            "operationKind must use route token characters".to_owned(),
        ));
    }
    if let Some(status) = &request.status
        && !matches!(
            status.as_str(),
            "requested"
                | "running"
                | "blocked"
                | "completed"
                | "failed"
                | "cancelled"
                | "professional_review_required"
        )
    {
        return Err(ModuleOperationRuntimeError::InvalidInput(format!(
            "unsupported status: {status}"
        )));
    }
    Ok(())
}

fn parse_uuid_or_default(
    value: Option<&str>,
    default_value: &str,
    field_name: &str,
) -> Result<uuid::Uuid, ModuleOperationRuntimeError> {
    let raw = value.unwrap_or(default_value);
    raw.parse::<uuid::Uuid>().map_err(|err| {
        ModuleOperationRuntimeError::InvalidInput(format!("{field_name} must be a UUID: {err}"))
    })
}

fn is_route_token(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_' || ch == '-')
}

fn is_operation_key(value: &str) -> bool {
    (3..=128).contains(&value.len())
        && value.chars().all(|ch| {
            ch.is_ascii_lowercase()
                || ch.is_ascii_digit()
                || ch == '_'
                || ch == '-'
                || ch == '.'
                || ch == ':'
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_request() -> ModuleOperationRequest {
        ModuleOperationRequest {
            tenant_id: None,
            project_id: None,
            module_id: "standard_library".to_owned(),
            operation_key: "library.publish_version".to_owned(),
            operation_label: "发布标准族库版本".to_owned(),
            actor: "database-runtime-smoke".to_owned(),
            operation_kind: Some("module_business_operation".to_owned()),
            status: Some("requested".to_owned()),
            source_surface: None,
            target_type: None,
            target_id: None,
            related_file_ids: None,
            related_artifact_ids: None,
            idempotency_key: Some("smoke:standard_library:publish_version".to_owned()),
            request_payload: None,
            result_payload: None,
            evidence: None,
        }
    }

    #[test]
    fn validates_module_operation_request() {
        validate_module_operation_request(&valid_request()).expect("request should validate");
    }

    #[test]
    fn rejects_invalid_module_id() {
        let request = ModuleOperationRequest {
            module_id: "Standard Library".to_owned(),
            ..valid_request()
        };

        let error = validate_module_operation_request(&request).unwrap_err();
        assert!(error.to_string().contains("moduleId"));
    }

    #[test]
    fn rejects_invalid_operation_key() {
        let request = ModuleOperationRequest {
            operation_key: "Publish Version".to_owned(),
            ..valid_request()
        };

        let error = validate_module_operation_request(&request).unwrap_err();
        assert!(error.to_string().contains("operationKey"));
    }

    #[test]
    fn rejects_invalid_uuid_context() {
        let error = parse_uuid_or_default(
            Some("not-a-uuid"),
            DEFAULT_MODULE_OPERATION_TENANT_ID,
            "tenantId",
        )
        .unwrap_err();

        assert!(error.to_string().contains("tenantId"));
    }
}
