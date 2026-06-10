// License: Apache-2.0

use serde::Serialize;
use sqlx::PgPool;
use thiserror::Error;

pub const POSTGRES_INVENTORY_URL_ENV: &str = "ARCHITOKEN_DB_MANAGER_POSTGRES_URL";

#[derive(Debug, Error)]
pub enum PostgresInventoryError {
    #[error("postgres inventory source is not configured")]
    NotConfigured,
    #[error("postgres inventory query failed: {0}")]
    Query(#[from] sqlx::Error),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostgresInventory {
    pub engine: &'static str,
    pub source: String,
    pub table_count: usize,
    pub column_count: usize,
    pub index_count: usize,
    pub tables: Vec<PostgresTable>,
    pub columns: Vec<PostgresColumn>,
    pub indexes: Vec<PostgresIndex>,
    pub table_sizes: Vec<PostgresTableSize>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PostgresTable {
    pub schema_name: String,
    pub table_name: String,
    pub table_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PostgresColumn {
    pub schema_name: String,
    pub table_name: String,
    pub column_name: String,
    pub ordinal_position: i32,
    pub data_type: String,
    pub is_nullable: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PostgresIndex {
    pub schema_name: String,
    pub table_name: String,
    pub index_name: String,
    pub index_definition: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PostgresTableSize {
    pub schema_name: String,
    pub table_name: String,
    pub estimated_rows: i64,
    pub total_bytes: i64,
}

pub async fn load_postgres_inventory(
    pool: &PgPool,
    source: impl Into<String>,
) -> Result<PostgresInventory, PostgresInventoryError> {
    let tables = sqlx::query_as::<_, PostgresTable>(
        r#"
        SELECT
            table_schema AS schema_name,
            table_name,
            table_type
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_schema, table_name
        "#,
    )
    .fetch_all(pool)
    .await?;

    let columns = sqlx::query_as::<_, PostgresColumn>(
        r#"
        SELECT
            table_schema AS schema_name,
            table_name,
            column_name,
            ordinal_position::int4 AS ordinal_position,
            data_type,
            is_nullable
        FROM information_schema.columns
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_schema, table_name, ordinal_position
        "#,
    )
    .fetch_all(pool)
    .await?;

    let indexes = sqlx::query_as::<_, PostgresIndex>(
        r#"
        SELECT
            schemaname AS schema_name,
            tablename AS table_name,
            indexname AS index_name,
            indexdef AS index_definition
        FROM pg_indexes
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY schemaname, tablename, indexname
        "#,
    )
    .fetch_all(pool)
    .await?;

    let table_sizes = sqlx::query_as::<_, PostgresTableSize>(
        r#"
        SELECT
            schemaname AS schema_name,
            relname AS table_name,
            n_live_tup::int8 AS estimated_rows,
            pg_total_relation_size(relid)::int8 AS total_bytes
        FROM pg_stat_user_tables
        ORDER BY schemaname, relname
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(PostgresInventory {
        engine: "postgresql",
        source: source.into(),
        table_count: tables.len(),
        column_count: columns.len(),
        index_count: indexes.len(),
        tables,
        columns,
        indexes,
        table_sizes,
    })
}

pub fn database_url_from_env() -> Result<String, PostgresInventoryError> {
    std::env::var(POSTGRES_INVENTORY_URL_ENV)
        .or_else(|_| std::env::var("DATABASE_URL"))
        .map_err(|_| PostgresInventoryError::NotConfigured)
}

pub fn redact_database_url(database_url: &str) -> String {
    let Some((scheme, rest)) = database_url.split_once("://") else {
        return "configured".to_owned();
    };
    let Some((_, host_and_path)) = rest.rsplit_once('@') else {
        return format!("{scheme}://configured");
    };
    format!("{scheme}://***@{host_and_path}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redact_database_url_removes_credentials() {
        let redacted = redact_database_url("postgres://user:secret@127.0.0.1:5433/architoken");

        assert_eq!(redacted, "postgres://***@127.0.0.1:5433/architoken");
        assert!(!redacted.contains("secret"));
        assert!(!redacted.contains("user:"));
    }

    #[test]
    fn redact_database_url_without_credentials_still_hides_raw_value() {
        assert_eq!(
            redact_database_url("postgres://127.0.0.1:5433/architoken"),
            "postgres://configured"
        );
    }
}
