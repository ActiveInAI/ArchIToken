// License: Apache-2.0

use serde::Serialize;
use sqlx::PgPool;
use thiserror::Error;

pub const DEFAULT_HEAVY_STEEL_PROGRAM_ID: &str = "heavy_steel_hotel_100_rooms_q235b_bolted";
pub const DEFAULT_HEAVY_STEEL_TENANT_ID: &str = "11111111-1111-4111-8111-111111111111";
pub const DEFAULT_HEAVY_STEEL_PROJECT_ID: &str = "5abffe50-2670-42e2-97ea-ec6ac71d8183";

#[derive(Debug, Error)]
pub enum HeavySteelProgramError {
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
    pub graph_edge_count: i64,
    pub event_count: i64,
    pub analytics_count: i64,
    pub audit_count: i64,
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
    sqlx::query("SELECT set_config('app.current_tenant', $1, false)")
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
            graph_edge_count::int8,
            event_count::int8,
            analytics_count::int8,
            audit_count::int8
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
