// License: Apache-2.0

use serde::Serialize;
use sqlx::PgPool;
use std::collections::BTreeMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PostgresSchemaError {
    #[error("postgres schema graph query failed: {0}")]
    Query(#[from] sqlx::Error),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostgresSchemaGraph {
    pub engine: &'static str,
    pub source: String,
    pub table_count: usize,
    pub view_count: usize,
    pub column_count: usize,
    pub foreign_key_count: usize,
    pub total_bytes: i64,
    pub estimated_rows: i64,
    pub tables: Vec<PostgresSchemaTable>,
    pub foreign_keys: Vec<PostgresForeignKey>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostgresSchemaTable {
    pub schema_name: String,
    pub table_name: String,
    pub table_type: String,
    pub family: String,
    pub estimated_rows: i64,
    pub total_bytes: i64,
    pub primary_key_columns: Vec<String>,
    pub columns: Vec<PostgresSchemaColumn>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostgresSchemaColumn {
    pub column_name: String,
    pub ordinal_position: i32,
    pub data_type: String,
    pub is_nullable: String,
    pub is_primary_key: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PostgresForeignKey {
    pub constraint_name: String,
    pub source_schema: String,
    pub source_table: String,
    pub source_column: String,
    pub target_schema: String,
    pub target_table: String,
    pub target_column: String,
    pub ordinal_position: i32,
    pub update_rule: String,
    pub delete_rule: String,
}

#[derive(Debug, sqlx::FromRow)]
struct RawSchemaTable {
    schema_name: String,
    table_name: String,
    table_type: String,
    estimated_rows: i64,
    total_bytes: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct RawSchemaColumn {
    schema_name: String,
    table_name: String,
    column_name: String,
    ordinal_position: i32,
    data_type: String,
    is_nullable: String,
    is_primary_key: bool,
}

pub async fn load_postgres_schema_graph(
    pool: &PgPool,
    source: impl Into<String>,
) -> Result<PostgresSchemaGraph, PostgresSchemaError> {
    let raw_tables = sqlx::query_as::<_, RawSchemaTable>(
        r#"
        SELECT
            t.table_schema AS schema_name,
            t.table_name,
            t.table_type,
            COALESCE(s.n_live_tup, 0)::int8 AS estimated_rows,
            COALESCE(pg_total_relation_size(c.oid), 0)::int8 AS total_bytes
        FROM information_schema.tables t
        LEFT JOIN pg_namespace n
            ON n.nspname = t.table_schema
        LEFT JOIN pg_class c
            ON c.relnamespace = n.oid
            AND c.relname = t.table_name
        LEFT JOIN pg_stat_user_tables s
            ON s.schemaname = t.table_schema
            AND s.relname = t.table_name
        WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY t.table_schema, t.table_name
        "#,
    )
    .fetch_all(pool)
    .await?;

    let raw_columns = sqlx::query_as::<_, RawSchemaColumn>(
        r#"
        SELECT
            c.table_schema AS schema_name,
            c.table_name,
            c.column_name,
            c.ordinal_position::int4 AS ordinal_position,
            c.data_type,
            c.is_nullable,
            EXISTS (
                SELECT 1
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                    AND tc.table_name = kcu.table_name
                WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND kcu.table_schema = c.table_schema
                    AND kcu.table_name = c.table_name
                    AND kcu.column_name = c.column_name
            ) AS is_primary_key
        FROM information_schema.columns c
        WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY c.table_schema, c.table_name, c.ordinal_position
        "#,
    )
    .fetch_all(pool)
    .await?;

    let foreign_keys = sqlx::query_as::<_, PostgresForeignKey>(
        r#"
        SELECT
            con.conname AS constraint_name,
            source_ns.nspname AS source_schema,
            source_table.relname AS source_table,
            source_attr.attname AS source_column,
            target_ns.nspname AS target_schema,
            target_table.relname AS target_table,
            target_attr.attname AS target_column,
            key_columns.ordinality::int4 AS ordinal_position,
            CASE con.confupdtype
                WHEN 'a' THEN 'NO ACTION'
                WHEN 'r' THEN 'RESTRICT'
                WHEN 'c' THEN 'CASCADE'
                WHEN 'n' THEN 'SET NULL'
                WHEN 'd' THEN 'SET DEFAULT'
                ELSE 'UNKNOWN'
            END AS update_rule,
            CASE con.confdeltype
                WHEN 'a' THEN 'NO ACTION'
                WHEN 'r' THEN 'RESTRICT'
                WHEN 'c' THEN 'CASCADE'
                WHEN 'n' THEN 'SET NULL'
                WHEN 'd' THEN 'SET DEFAULT'
                ELSE 'UNKNOWN'
            END AS delete_rule
        FROM pg_constraint con
        JOIN pg_class source_table
            ON source_table.oid = con.conrelid
        JOIN pg_namespace source_ns
            ON source_ns.oid = source_table.relnamespace
        JOIN pg_class target_table
            ON target_table.oid = con.confrelid
        JOIN pg_namespace target_ns
            ON target_ns.oid = target_table.relnamespace
        JOIN unnest(con.conkey, con.confkey) WITH ORDINALITY
            AS key_columns(source_attnum, target_attnum, ordinality)
            ON true
        JOIN pg_attribute source_attr
            ON source_attr.attrelid = con.conrelid
            AND source_attr.attnum = key_columns.source_attnum
        JOIN pg_attribute target_attr
            ON target_attr.attrelid = con.confrelid
            AND target_attr.attnum = key_columns.target_attnum
        WHERE con.contype = 'f'
            AND source_ns.nspname NOT IN ('pg_catalog', 'information_schema')
            AND target_ns.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY source_ns.nspname, source_table.relname, con.conname, key_columns.ordinality
        "#,
    )
    .fetch_all(pool)
    .await?;

    let column_count = raw_columns.len();
    let mut columns_by_table: BTreeMap<(String, String), Vec<PostgresSchemaColumn>> =
        BTreeMap::new();
    for column in raw_columns {
        columns_by_table
            .entry((column.schema_name, column.table_name))
            .or_default()
            .push(PostgresSchemaColumn {
                column_name: column.column_name,
                ordinal_position: column.ordinal_position,
                data_type: column.data_type,
                is_nullable: column.is_nullable,
                is_primary_key: column.is_primary_key,
            });
    }

    let mut table_count = 0usize;
    let mut view_count = 0usize;
    let mut total_bytes = 0i64;
    let mut estimated_rows = 0i64;
    let mut tables = Vec::with_capacity(raw_tables.len());
    for table in raw_tables {
        if table.table_type == "VIEW" {
            view_count += 1;
        } else {
            table_count += 1;
        }
        total_bytes += table.total_bytes;
        estimated_rows += table.estimated_rows;
        let columns = columns_by_table
            .remove(&(table.schema_name.clone(), table.table_name.clone()))
            .unwrap_or_default();
        let primary_key_columns = columns
            .iter()
            .filter(|column| column.is_primary_key)
            .map(|column| column.column_name.clone())
            .collect();
        tables.push(PostgresSchemaTable {
            family: classify_table_family(&table.table_name).to_owned(),
            schema_name: table.schema_name,
            table_name: table.table_name,
            table_type: table.table_type,
            estimated_rows: table.estimated_rows,
            total_bytes: table.total_bytes,
            primary_key_columns,
            columns,
        });
    }

    Ok(PostgresSchemaGraph {
        engine: "postgresql",
        source: source.into(),
        table_count,
        view_count,
        column_count,
        foreign_key_count: foreign_keys.len(),
        total_bytes,
        estimated_rows,
        tables,
        foreign_keys,
    })
}

fn classify_table_family(table_name: &str) -> &'static str {
    if table_name.starts_with("auth_") {
        "auth"
    } else if table_name.starts_with("iam_") {
        "iam"
    } else if table_name.starts_with("cost_") || table_name == "boq_items" {
        "cost"
    } else if table_name.starts_with("project_plan_") || table_name == "projects" {
        "planning"
    } else if table_name.starts_with("semantic_")
        || table_name.starts_with("project_semantic_")
        || table_name.starts_with("compliance_")
    {
        "standards_semantic"
    } else if table_name.starts_with("data_") {
        "data_plane"
    } else if table_name.starts_with("asset")
        || table_name.starts_with("object_")
        || table_name.starts_with("conversion_")
        || table_name.starts_with("bim_")
        || table_name.starts_with("module_")
        || table_name == "modules"
    {
        "cde_asset_module"
    } else if table_name.starts_with("ai_center_")
        || table_name.starts_with("agent_")
        || table_name.starts_with("rag_")
        || table_name.starts_with("runtime_")
    {
        "ai_runtime"
    } else {
        "other"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn table_family_classification_matches_platform_groups() {
        assert_eq!(classify_table_family("auth_accounts"), "auth");
        assert_eq!(classify_table_family("iam_roles"), "iam");
        assert_eq!(classify_table_family("cost_projects"), "cost");
        assert_eq!(classify_table_family("project_plan_tasks"), "planning");
        assert_eq!(
            classify_table_family("semantic_dictionary_categories"),
            "standards_semantic"
        );
        assert_eq!(classify_table_family("data_graph_edges"), "data_plane");
        assert_eq!(classify_table_family("asset_versions"), "cde_asset_module");
        assert_eq!(classify_table_family("agent_invocations"), "ai_runtime");
    }
}
