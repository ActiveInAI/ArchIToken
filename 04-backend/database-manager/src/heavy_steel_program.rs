// License: Apache-2.0

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use thiserror::Error;

pub const DEFAULT_HEAVY_STEEL_PROGRAM_ID: &str = "heavy_steel_hotel_100_rooms_q235b_bolted";
pub const DEFAULT_HEAVY_STEEL_TENANT_ID: &str = "11111111-1111-4111-8111-111111111111";
pub const DEFAULT_HEAVY_STEEL_PROJECT_ID: &str = "5abffe50-2670-42e2-97ea-ec6ac71d8183";

#[derive(Debug, Error)]
pub enum HeavySteelProgramError {
    #[error("heavy steel program input is invalid: {0}")]
    InvalidInput(String),
    #[error("heavy steel program query failed: {0}")]
    Query(#[from] sqlx::Error),
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeavySteelProgramCatalog {
    pub engine: &'static str,
    pub source: String,
    pub program: HeavySteelProgram,
    pub source_document: HeavySteelSourceDocument,
    pub packages: Vec<HeavySteelDrawingPackage>,
    pub sections: Vec<HeavySteelDrawingSection>,
    pub module_bindings: Vec<HeavySteelModuleBinding>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeavySteelDatabaseBridge {
    pub engine: &'static str,
    pub source: String,
    pub status: HeavySteelDatabaseBridgeStatus,
    pub module_bindings: Vec<ModuleDatabaseOperationBinding>,
    pub bom_lines: Vec<ComponentBomLine>,
}

#[derive(Debug, Clone, PartialEq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct HeavySteelDatabaseBridgeStatus {
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
    pub module_operation_run_count: i64,
    pub graph_edge_count: i64,
    pub event_count: i64,
    pub module_operation_event_count: i64,
    pub analytics_count: i64,
    pub audit_count: i64,
    pub module_operation_audit_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ModuleDatabaseOperationBinding {
    pub module_id: String,
    pub operation_surface: String,
    pub relational_route: String,
    pub object_route: String,
    pub graph_route: String,
    pub event_route: String,
    pub analytics_route: String,
    pub audit_route: String,
    pub write_policy: String,
    pub binding_state: String,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ComponentBomLine {
    pub line_no: i32,
    pub source_row: i32,
    pub category_name: String,
    pub category_code: String,
    pub component_name: String,
    pub section_size: String,
    pub length_mm: Option<f64>,
    pub position_ref: String,
    pub material_grade: String,
    pub specification: String,
    pub drawing_no: String,
    pub floor_level: String,
    pub unit: String,
    pub set_quantity: f64,
    pub total_quantity: f64,
    pub weight_state: String,
    pub validation_state: String,
    pub source_path: String,
    pub source_sheet: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeavySteelModuleOperationRequest {
    pub module_id: String,
    pub operation_key: String,
    pub operation_label: String,
    pub actor: String,
    pub operation_kind: Option<String>,
    pub status: Option<String>,
    pub source_surface: Option<String>,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub bom_line_no: Option<i32>,
    pub idempotency_key: Option<String>,
    pub request_payload: Option<Value>,
    pub evidence: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct HeavySteelModuleOperationRun {
    pub operation_run_id: uuid::Uuid,
    pub tenant_id: uuid::Uuid,
    pub project_id: uuid::Uuid,
    pub module_id: String,
    pub operation_key: String,
    pub operation_label: String,
    pub operation_kind: String,
    pub status: String,
    pub actor: String,
    pub source_surface: String,
    pub target_type: String,
    pub target_id: String,
    pub bom_version_id: Option<uuid::Uuid>,
    pub bom_line_id: Option<uuid::Uuid>,
    pub downstream_link_id: Option<uuid::Uuid>,
    pub idempotency_key: String,
    pub request_payload: Value,
    pub result_payload: Value,
    pub evidence: Value,
    pub professional_state: String,
    pub event_id: Option<uuid::Uuid>,
    pub audit_event_id: Option<uuid::Uuid>,
    pub graph_edge_id: Option<uuid::Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct HeavySteelSourceDocument {
    pub source_document_id: String,
    pub source_path: String,
    pub source_kind: String,
    pub title: String,
    pub provenance_state: String,
    pub extracted_to: Vec<String>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct HeavySteelProgram {
    pub program_id: String,
    pub source_document_id: String,
    pub project_title: String,
    pub structure_system: String,
    pub precision_rule: String,
    pub modular_rule: String,
    pub delivery_window: String,
    pub total_drawings: i32,
    pub package_count: i32,
    pub section_count: i32,
    pub phase_counts: serde_json::Value,
    pub priority_counts: serde_json::Value,
    pub hard_rules: serde_json::Value,
    pub professional_state: String,
    pub catalog_snapshot: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct HeavySteelDrawingPackage {
    pub program_id: String,
    pub package_mark: String,
    pub package_name: String,
    pub drawing_count: i32,
    pub description: String,
    pub module_ids: Vec<String>,
    pub section_keys: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct HeavySteelDrawingSection {
    pub program_id: String,
    pub section_key: String,
    pub section_name: String,
    pub package_name: String,
    pub drawing_count: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct HeavySteelModuleBinding {
    pub program_id: String,
    pub module_id: String,
    pub package_count: i32,
    pub drawing_count: i32,
    pub binding_state: String,
}

pub async fn load_heavy_steel_program_catalog(
    pool: &PgPool,
    source: impl Into<String>,
) -> Result<HeavySteelProgramCatalog, HeavySteelProgramError> {
    let program = sqlx::query_as::<_, HeavySteelProgram>(
        r#"
        SELECT
            program_id,
            source_document_id,
            project_title,
            structure_system,
            precision_rule,
            modular_rule,
            delivery_window,
            total_drawings,
            package_count,
            section_count,
            phase_counts,
            priority_counts,
            hard_rules,
            professional_state,
            catalog_snapshot
        FROM heavy_steel_programs
        WHERE program_id = $1
        "#,
    )
    .bind(DEFAULT_HEAVY_STEEL_PROGRAM_ID)
    .fetch_one(pool)
    .await?;

    let source_document = sqlx::query_as::<_, HeavySteelSourceDocument>(
        r#"
        SELECT
            source_document_id,
            source_path,
            source_kind,
            title,
            provenance_state,
            extracted_to,
            metadata
        FROM heavy_steel_source_documents
        WHERE source_document_id = $1
        "#,
    )
    .bind(&program.source_document_id)
    .fetch_one(pool)
    .await?;

    let packages = sqlx::query_as::<_, HeavySteelDrawingPackage>(
        r#"
        SELECT
            program_id,
            package_mark,
            package_name,
            drawing_count,
            description,
            module_ids,
            section_keys
        FROM heavy_steel_drawing_packages
        WHERE program_id = $1
        ORDER BY package_mark
        "#,
    )
    .bind(&program.program_id)
    .fetch_all(pool)
    .await?;

    let sections = sqlx::query_as::<_, HeavySteelDrawingSection>(
        r#"
        SELECT
            program_id,
            section_key,
            section_name,
            package_name,
            drawing_count
        FROM heavy_steel_drawing_sections
        WHERE program_id = $1
        ORDER BY section_key
        "#,
    )
    .bind(&program.program_id)
    .fetch_all(pool)
    .await?;

    let module_bindings = sqlx::query_as::<_, HeavySteelModuleBinding>(
        r#"
        SELECT
            program_id,
            module_id,
            package_count,
            drawing_count,
            binding_state
        FROM heavy_steel_module_bindings
        WHERE program_id = $1
        ORDER BY module_id
        "#,
    )
    .bind(&program.program_id)
    .fetch_all(pool)
    .await?;

    Ok(HeavySteelProgramCatalog {
        engine: "postgresql",
        source: source.into(),
        program,
        source_document,
        packages,
        sections,
        module_bindings,
    })
}

pub async fn load_heavy_steel_database_bridge(
    pool: &PgPool,
    source: impl Into<String>,
) -> Result<HeavySteelDatabaseBridge, HeavySteelProgramError> {
    let mut conn = pool.acquire().await?;
    sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
        .bind(DEFAULT_HEAVY_STEEL_TENANT_ID)
        .execute(&mut *conn)
        .await?;

    let status = sqlx::query_as::<_, HeavySteelDatabaseBridgeStatus>(
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
            module_operation_run_count::int8,
            graph_edge_count::int8,
            event_count::int8,
            module_operation_event_count::int8,
            analytics_count::int8,
            audit_count::int8,
            module_operation_audit_count::int8
        FROM heavy_steel_database_bridge_status
        WHERE tenant_id = $1::uuid
          AND project_id = $2::uuid
        "#,
    )
    .bind(DEFAULT_HEAVY_STEEL_TENANT_ID)
    .bind(DEFAULT_HEAVY_STEEL_PROJECT_ID)
    .fetch_one(&mut *conn)
    .await?;

    let module_bindings = sqlx::query_as::<_, ModuleDatabaseOperationBinding>(
        r#"
        SELECT
            module_id,
            operation_surface,
            relational_route,
            object_route,
            graph_route,
            event_route,
            analytics_route,
            audit_route,
            write_policy,
            binding_state,
            metadata
        FROM module_database_operation_bindings
        WHERE tenant_id = $1::uuid
          AND project_id = $2::uuid
        ORDER BY module_id
        "#,
    )
    .bind(DEFAULT_HEAVY_STEEL_TENANT_ID)
    .bind(DEFAULT_HEAVY_STEEL_PROJECT_ID)
    .fetch_all(&mut *conn)
    .await?;

    let bom_lines = sqlx::query_as::<_, ComponentBomLine>(
        r#"
        SELECT
            bl.line_no,
            COALESCE(bls.source_row, 0)::int4 AS source_row,
            bl.category_name,
            bl.category_code,
            bl.component_name,
            bl.section_size,
            bl.length_mm::float8 AS length_mm,
            bl.position_ref,
            bl.material_grade,
            bl.specification,
            bl.drawing_no,
            bl.floor_level,
            bl.unit,
            bl.set_quantity::float8 AS set_quantity,
            bl.total_quantity::float8 AS total_quantity,
            bl.weight_state,
            bl.validation_state,
            COALESCE(bls.source_path, '') AS source_path,
            COALESCE(bls.source_sheet, '') AS source_sheet
        FROM bom_lines bl
        LEFT JOIN bom_line_sources bls ON bls.bom_line_id = bl.bom_line_id
        WHERE bl.tenant_id = $1::uuid
          AND bl.project_id = $2::uuid
        ORDER BY bl.line_no
        "#,
    )
    .bind(DEFAULT_HEAVY_STEEL_TENANT_ID)
    .bind(DEFAULT_HEAVY_STEEL_PROJECT_ID)
    .fetch_all(&mut *conn)
    .await?;

    Ok(HeavySteelDatabaseBridge {
        engine: "postgresql",
        source: source.into(),
        status,
        module_bindings,
        bom_lines,
    })
}

pub async fn create_heavy_steel_module_operation(
    pool: &PgPool,
    request: HeavySteelModuleOperationRequest,
) -> Result<HeavySteelModuleOperationRun, HeavySteelProgramError> {
    validate_module_operation_request(&request)?;

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
    let idempotency_key = request.idempotency_key.clone().unwrap_or_else(|| {
        format!(
            "api:{}:{}:{}",
            request.module_id,
            request.operation_key,
            uuid::Uuid::new_v4()
        )
    });
    let request_payload = request
        .request_payload
        .clone()
        .unwrap_or_else(|| Value::Object(Default::default()));
    let evidence = request
        .evidence
        .clone()
        .unwrap_or_else(|| Value::Object(Default::default()));

    let mut tx = pool.begin().await?;
    sqlx::query("SELECT set_config('app.current_tenant', $1, false)")
        .bind(DEFAULT_HEAVY_STEEL_TENANT_ID)
        .execute(&mut *tx)
        .await?;

    let (bom_line_id, bom_version_id) = match request.bom_line_no {
        Some(line_no) => sqlx::query_as::<_, (uuid::Uuid, uuid::Uuid)>(
            r#"
            SELECT bom_line_id, bom_version_id
            FROM bom_lines
            WHERE tenant_id = $1::uuid
              AND project_id = $2::uuid
              AND line_no = $3
            "#,
        )
        .bind(DEFAULT_HEAVY_STEEL_TENANT_ID)
        .bind(DEFAULT_HEAVY_STEEL_PROJECT_ID)
        .bind(line_no)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| {
            HeavySteelProgramError::InvalidInput(format!(
                "BOM line {line_no} does not exist in the heavy-steel bridge"
            ))
        })?,
        None => (uuid::Uuid::nil(), uuid::Uuid::nil()),
    };
    let bom_line_id = request.bom_line_no.map(|_| bom_line_id);
    let bom_version_id = request.bom_line_no.map(|_| bom_version_id);

    let downstream_link_id = if let Some(bom_line_id) = bom_line_id {
        sqlx::query_as::<_, (uuid::Uuid,)>(
            r#"
            SELECT downstream_link_id
            FROM bom_downstream_links
            WHERE tenant_id = $1::uuid
              AND project_id = $2::uuid
              AND bom_line_id = $3
              AND module_id = $4
            LIMIT 1
            "#,
        )
        .bind(DEFAULT_HEAVY_STEEL_TENANT_ID)
        .bind(DEFAULT_HEAVY_STEEL_PROJECT_ID)
        .bind(bom_line_id)
        .bind(&request.module_id)
        .fetch_optional(&mut *tx)
        .await?
        .map(|row| row.0)
    } else {
        None
    };

    let target_type = request.target_type.clone().unwrap_or_else(|| {
        if bom_line_id.is_some() {
            "bom_line".to_owned()
        } else {
            "heavy_steel_project".to_owned()
        }
    });
    let target_id = request.target_id.clone().unwrap_or_else(|| {
        bom_line_id
            .map(|id| id.to_string())
            .unwrap_or_else(|| DEFAULT_HEAVY_STEEL_PROJECT_ID.to_owned())
    });

    let run = sqlx::query_as::<_, HeavySteelModuleOperationRun>(
        r#"
        INSERT INTO heavy_steel_module_operation_runs (
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
            bom_version_id,
            bom_line_id,
            downstream_link_id,
            idempotency_key,
            request_payload,
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
            $12::uuid,
            $13::uuid,
            $14::uuid,
            $15,
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
            bom_version_id = EXCLUDED.bom_version_id,
            bom_line_id = EXCLUDED.bom_line_id,
            downstream_link_id = EXCLUDED.downstream_link_id,
            request_payload = EXCLUDED.request_payload,
            evidence = EXCLUDED.evidence,
            professional_state = 'professional_review_required',
            updated_at = NOW()
        RETURNING
            operation_run_id,
            tenant_id,
            project_id,
            module_id,
            operation_key,
            operation_label,
            operation_kind,
            status,
            actor,
            source_surface,
            target_type,
            target_id,
            bom_version_id,
            bom_line_id,
            downstream_link_id,
            idempotency_key,
            request_payload,
            result_payload,
            evidence,
            professional_state,
            event_id,
            audit_event_id,
            graph_edge_id,
            created_at,
            updated_at
        "#,
    )
    .bind(DEFAULT_HEAVY_STEEL_TENANT_ID)
    .bind(DEFAULT_HEAVY_STEEL_PROJECT_ID)
    .bind(&request.module_id)
    .bind(&request.operation_key)
    .bind(&request.operation_label)
    .bind(&operation_kind)
    .bind(&status)
    .bind(&request.actor)
    .bind(&source_surface)
    .bind(&target_type)
    .bind(&target_id)
    .bind(bom_version_id)
    .bind(bom_line_id)
    .bind(downstream_link_id)
    .bind(&idempotency_key)
    .bind(&request_payload)
    .bind(&evidence)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        HeavySteelProgramError::InvalidInput(format!(
            "module {} is not bound to an active heavy-steel database write route",
            request.module_id
        ))
    })?;

    tx.commit().await?;
    Ok(run)
}

fn validate_module_operation_request(
    request: &HeavySteelModuleOperationRequest,
) -> Result<(), HeavySteelProgramError> {
    if !is_route_token(&request.module_id) {
        return Err(HeavySteelProgramError::InvalidInput(
            "moduleId must use lowercase registry token characters".to_owned(),
        ));
    }
    if !is_operation_key(&request.operation_key) {
        return Err(HeavySteelProgramError::InvalidInput(
            "operationKey must be 3-128 chars and use lowercase route token characters".to_owned(),
        ));
    }
    if request.operation_label.trim().is_empty() || request.operation_label.len() > 200 {
        return Err(HeavySteelProgramError::InvalidInput(
            "operationLabel must be 1-200 chars".to_owned(),
        ));
    }
    if request.actor.trim().is_empty() || request.actor.len() > 160 {
        return Err(HeavySteelProgramError::InvalidInput(
            "actor must be 1-160 chars".to_owned(),
        ));
    }
    if let Some(line_no) = request.bom_line_no
        && line_no <= 0
    {
        return Err(HeavySteelProgramError::InvalidInput(
            "bomLineNo must be positive".to_owned(),
        ));
    }
    if let Some(kind) = &request.operation_kind
        && !matches!(
            kind.as_str(),
            "module_business_operation"
                | "bom_to_boq"
                | "bom_to_procurement"
                | "bom_to_work_order"
                | "bom_to_construction_task"
                | "bom_to_archive"
                | "professional_review"
                | "database_maintenance"
        )
    {
        return Err(HeavySteelProgramError::InvalidInput(format!(
            "unsupported operationKind: {kind}"
        )));
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
        return Err(HeavySteelProgramError::InvalidInput(format!(
            "unsupported status: {status}"
        )));
    }
    Ok(())
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

    fn valid_request() -> HeavySteelModuleOperationRequest {
        HeavySteelModuleOperationRequest {
            module_id: "quantity_costing".to_owned(),
            operation_key: "bom.generate_boq_draft".to_owned(),
            operation_label: "从重钢 BOM 行生成 BOQ 草稿".to_owned(),
            actor: "database-smoke".to_owned(),
            operation_kind: Some("bom_to_boq".to_owned()),
            status: Some("requested".to_owned()),
            source_surface: None,
            target_type: None,
            target_id: None,
            bom_line_no: Some(1),
            idempotency_key: Some("smoke:quantity_costing:bom_line:1".to_owned()),
            request_payload: None,
            evidence: None,
        }
    }

    #[test]
    fn module_operation_request_accepts_safe_registry_tokens() {
        let request = valid_request();

        validate_module_operation_request(&request).expect("request should validate");
    }

    #[test]
    fn module_operation_request_rejects_unregistered_token_shape() {
        let request = HeavySteelModuleOperationRequest {
            module_id: "Quantity Costing".to_owned(),
            ..valid_request()
        };

        let error = validate_module_operation_request(&request).unwrap_err();
        assert!(error.to_string().contains("moduleId"));
    }

    #[test]
    fn module_operation_request_rejects_invalid_status() {
        let request = HeavySteelModuleOperationRequest {
            status: Some("approved_without_review".to_owned()),
            ..valid_request()
        };

        let error = validate_module_operation_request(&request).unwrap_err();
        assert!(error.to_string().contains("unsupported status"));
    }
}
