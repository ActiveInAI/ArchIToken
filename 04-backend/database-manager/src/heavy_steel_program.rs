// License: Apache-2.0

use serde::Serialize;
use sqlx::PgPool;
use thiserror::Error;

pub const DEFAULT_HEAVY_STEEL_PROGRAM_ID: &str = "heavy_steel_hotel_100_rooms_q235b_bolted";

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
