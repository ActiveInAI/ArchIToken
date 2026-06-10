// License: Apache-2.0

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::{PgPool, Row};
use std::collections::{BTreeMap, BTreeSet};
use thiserror::Error;

const MAX_LIMIT: i64 = 100;

#[derive(Debug, Error)]
pub enum PostgresCrudError {
    #[error("invalid postgres identifier: {0}")]
    InvalidIdentifier(String),
    #[error("postgres CRUD payload is invalid: {0}")]
    InvalidPayload(String),
    #[error("postgres CRUD query failed: {0}")]
    Query(#[from] sqlx::Error),
    #[error("postgres CRUD JSON parse failed: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostgresCrudTable {
    pub schema_name: String,
    pub table_name: String,
    pub table_type: String,
    pub estimated_rows: i64,
    pub primary_key_columns: Vec<String>,
    pub columns: Vec<PostgresCrudColumn>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostgresCrudColumn {
    pub column_name: String,
    pub ordinal_position: i32,
    pub data_type: String,
    pub is_nullable: String,
    pub is_primary_key: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostgresRowsResponse {
    pub schema_name: String,
    pub table_name: String,
    pub limit: i64,
    pub offset: i64,
    pub total_rows: i64,
    pub primary_key_columns: Vec<String>,
    pub columns: Vec<PostgresCrudColumn>,
    pub rows: Vec<Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostgresMutationResponse {
    pub schema_name: String,
    pub table_name: String,
    pub affected_rows: usize,
    pub rows: Vec<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostgresRowsQuery {
    pub schema_name: String,
    pub table_name: String,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostgresCreateRowRequest {
    pub schema_name: String,
    pub table_name: String,
    pub values: Map<String, Value>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostgresUpdateRowRequest {
    pub schema_name: String,
    pub table_name: String,
    pub key: Map<String, Value>,
    pub values: Map<String, Value>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostgresDeleteRowRequest {
    pub schema_name: String,
    pub table_name: String,
    pub key: Map<String, Value>,
}

#[derive(Debug, sqlx::FromRow)]
struct RawTable {
    schema_name: String,
    table_name: String,
    table_type: String,
    estimated_rows: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct RawColumn {
    schema_name: String,
    table_name: String,
    column_name: String,
    ordinal_position: i32,
    data_type: String,
    is_nullable: String,
    is_primary_key: bool,
}

pub async fn list_postgres_crud_tables(
    pool: &PgPool,
) -> Result<Vec<PostgresCrudTable>, PostgresCrudError> {
    let tables = sqlx::query_as::<_, RawTable>(
        r#"
        SELECT
            t.table_schema AS schema_name,
            t.table_name,
            t.table_type,
            COALESCE(s.n_live_tup, 0)::int8 AS estimated_rows
        FROM information_schema.tables t
        LEFT JOIN pg_stat_user_tables s
            ON s.schemaname = t.table_schema
            AND s.relname = t.table_name
        WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY t.table_schema, t.table_name
        "#,
    )
    .fetch_all(pool)
    .await?;

    let columns = load_columns(pool).await?;
    let mut columns_by_table: BTreeMap<(String, String), Vec<PostgresCrudColumn>> = BTreeMap::new();
    for column in columns {
        columns_by_table
            .entry((column.schema_name, column.table_name))
            .or_default()
            .push(PostgresCrudColumn {
                column_name: column.column_name,
                ordinal_position: column.ordinal_position,
                data_type: column.data_type,
                is_nullable: column.is_nullable,
                is_primary_key: column.is_primary_key,
            });
    }

    Ok(tables
        .into_iter()
        .map(|table| {
            let columns = columns_by_table
                .remove(&(table.schema_name.clone(), table.table_name.clone()))
                .unwrap_or_default();
            let primary_key_columns = columns
                .iter()
                .filter(|column| column.is_primary_key)
                .map(|column| column.column_name.clone())
                .collect();
            PostgresCrudTable {
                schema_name: table.schema_name,
                table_name: table.table_name,
                table_type: table.table_type,
                estimated_rows: table.estimated_rows,
                primary_key_columns,
                columns,
            }
        })
        .collect())
}

pub async fn read_postgres_rows(
    pool: &PgPool,
    query: PostgresRowsQuery,
) -> Result<PostgresRowsResponse, PostgresCrudError> {
    validate_identifier(&query.schema_name)?;
    validate_identifier(&query.table_name)?;
    let limit = query.limit.unwrap_or(50).clamp(1, MAX_LIMIT);
    let offset = query.offset.unwrap_or(0).max(0);
    let columns = table_columns(pool, &query.schema_name, &query.table_name).await?;
    let primary_key_columns = columns
        .iter()
        .filter(|column| column.is_primary_key)
        .map(|column| column.column_name.clone())
        .collect::<Vec<_>>();

    let table = qualified_table(&query.schema_name, &query.table_name)?;
    let order_clause = if primary_key_columns.is_empty() {
        "ORDER BY 1".to_owned()
    } else {
        format!(
            "ORDER BY {}",
            primary_key_columns
                .iter()
                .map(|column| quote_identifier(column))
                .collect::<Vec<_>>()
                .join(", ")
        )
    };
    let rows_sql = format!(
        "SELECT to_jsonb(row_data)::text AS row_json FROM (SELECT * FROM {table} {order_clause} LIMIT $1 OFFSET $2) row_data"
    );
    let rows = sqlx::query(&rows_sql)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|row| {
            let text: String = row.try_get("row_json")?;
            serde_json::from_str::<Value>(&text).map_err(PostgresCrudError::from)
        })
        .collect::<Result<Vec<_>, _>>()?;

    let count_sql = format!("SELECT count(*)::int8 AS total_rows FROM {table}");
    let total_rows = sqlx::query(&count_sql)
        .fetch_one(pool)
        .await?
        .try_get::<i64, _>("total_rows")?;

    Ok(PostgresRowsResponse {
        schema_name: query.schema_name,
        table_name: query.table_name,
        limit,
        offset,
        total_rows,
        primary_key_columns,
        columns,
        rows,
    })
}

pub async fn create_postgres_row(
    pool: &PgPool,
    request: PostgresCreateRowRequest,
) -> Result<PostgresMutationResponse, PostgresCrudError> {
    validate_identifier(&request.schema_name)?;
    validate_identifier(&request.table_name)?;
    validate_payload_keys(&request.values)?;
    ensure_requested_columns(
        pool,
        &request.schema_name,
        &request.table_name,
        request.values.keys(),
    )
    .await?;

    let table = qualified_table(&request.schema_name, &request.table_name)?;
    let sql = format!(
        "WITH inserted AS (INSERT INTO {table} SELECT * FROM jsonb_populate_record(NULL::{table}, $1::jsonb) RETURNING *) SELECT to_jsonb(inserted)::text AS row_json FROM inserted"
    );
    let rows = mutation_rows(pool, &sql, vec![Value::Object(request.values)]).await?;
    Ok(PostgresMutationResponse {
        schema_name: request.schema_name,
        table_name: request.table_name,
        affected_rows: rows.len(),
        rows,
    })
}

pub async fn update_postgres_row(
    pool: &PgPool,
    request: PostgresUpdateRowRequest,
) -> Result<PostgresMutationResponse, PostgresCrudError> {
    validate_identifier(&request.schema_name)?;
    validate_identifier(&request.table_name)?;
    if request.key.is_empty() {
        return Err(PostgresCrudError::InvalidPayload(
            "update key is required".to_owned(),
        ));
    }
    if request.values.is_empty() {
        return Err(PostgresCrudError::InvalidPayload(
            "update values are required".to_owned(),
        ));
    }
    validate_payload_keys(&request.key)?;
    validate_payload_keys(&request.values)?;
    ensure_requested_columns(
        pool,
        &request.schema_name,
        &request.table_name,
        request.key.keys(),
    )
    .await?;
    ensure_requested_columns(
        pool,
        &request.schema_name,
        &request.table_name,
        request.values.keys(),
    )
    .await?;

    let table = qualified_table(&request.schema_name, &request.table_name)?;
    let set_clause = request
        .values
        .keys()
        .map(|column| {
            format!(
                "{column} = patch.{column}",
                column = quote_identifier(column)
            )
        })
        .collect::<Vec<_>>()
        .join(", ");
    let where_clause = where_clause_from_keys("target", "key_row", request.key.keys());
    let sql = format!(
        "WITH patch AS (SELECT * FROM jsonb_populate_record(NULL::{table}, $1::jsonb)), key_row AS (SELECT * FROM jsonb_populate_record(NULL::{table}, $2::jsonb)), updated AS (UPDATE {table} target SET {set_clause} FROM patch, key_row WHERE {where_clause} RETURNING target.*) SELECT to_jsonb(updated)::text AS row_json FROM updated"
    );
    let rows = mutation_rows(
        pool,
        &sql,
        vec![Value::Object(request.values), Value::Object(request.key)],
    )
    .await?;
    Ok(PostgresMutationResponse {
        schema_name: request.schema_name,
        table_name: request.table_name,
        affected_rows: rows.len(),
        rows,
    })
}

pub async fn delete_postgres_row(
    pool: &PgPool,
    request: PostgresDeleteRowRequest,
) -> Result<PostgresMutationResponse, PostgresCrudError> {
    validate_identifier(&request.schema_name)?;
    validate_identifier(&request.table_name)?;
    if request.key.is_empty() {
        return Err(PostgresCrudError::InvalidPayload(
            "delete key is required".to_owned(),
        ));
    }
    validate_payload_keys(&request.key)?;
    ensure_requested_columns(
        pool,
        &request.schema_name,
        &request.table_name,
        request.key.keys(),
    )
    .await?;

    let table = qualified_table(&request.schema_name, &request.table_name)?;
    let where_clause = where_clause_from_keys("target", "key_row", request.key.keys());
    let sql = format!(
        "WITH key_row AS (SELECT * FROM jsonb_populate_record(NULL::{table}, $1::jsonb)), deleted AS (DELETE FROM {table} target USING key_row WHERE {where_clause} RETURNING target.*) SELECT to_jsonb(deleted)::text AS row_json FROM deleted"
    );
    let rows = mutation_rows(pool, &sql, vec![Value::Object(request.key)]).await?;
    Ok(PostgresMutationResponse {
        schema_name: request.schema_name,
        table_name: request.table_name,
        affected_rows: rows.len(),
        rows,
    })
}

async fn load_columns(pool: &PgPool) -> Result<Vec<RawColumn>, PostgresCrudError> {
    Ok(sqlx::query_as::<_, RawColumn>(
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
    .await?)
}

async fn table_columns(
    pool: &PgPool,
    schema_name: &str,
    table_name: &str,
) -> Result<Vec<PostgresCrudColumn>, PostgresCrudError> {
    let columns = load_columns(pool)
        .await?
        .into_iter()
        .filter(|column| column.schema_name == schema_name && column.table_name == table_name)
        .map(|column| PostgresCrudColumn {
            column_name: column.column_name,
            ordinal_position: column.ordinal_position,
            data_type: column.data_type,
            is_nullable: column.is_nullable,
            is_primary_key: column.is_primary_key,
        })
        .collect::<Vec<_>>();
    if columns.is_empty() {
        return Err(PostgresCrudError::InvalidPayload(format!(
            "table not found or has no columns: {schema_name}.{table_name}"
        )));
    }
    Ok(columns)
}

async fn ensure_requested_columns<'a>(
    pool: &PgPool,
    schema_name: &str,
    table_name: &str,
    columns: impl Iterator<Item = &'a String>,
) -> Result<(), PostgresCrudError> {
    let known = table_columns(pool, schema_name, table_name)
        .await?
        .into_iter()
        .map(|column| column.column_name)
        .collect::<BTreeSet<_>>();
    for column in columns {
        if !known.contains(column) {
            return Err(PostgresCrudError::InvalidPayload(format!(
                "column not found: {column}"
            )));
        }
    }
    Ok(())
}

async fn mutation_rows(
    pool: &PgPool,
    sql: &str,
    values: Vec<Value>,
) -> Result<Vec<Value>, PostgresCrudError> {
    let mut query = sqlx::query(sql);
    for value in values {
        query = query.bind(value.to_string());
    }
    query
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|row| {
            let text: String = row.try_get("row_json")?;
            serde_json::from_str::<Value>(&text).map_err(PostgresCrudError::from)
        })
        .collect()
}

fn validate_payload_keys(values: &Map<String, Value>) -> Result<(), PostgresCrudError> {
    for key in values.keys() {
        validate_identifier(key)?;
    }
    Ok(())
}

fn validate_identifier(value: &str) -> Result<(), PostgresCrudError> {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return Err(PostgresCrudError::InvalidIdentifier(value.to_owned()));
    };
    if !(first == '_' || first.is_ascii_alphabetic()) {
        return Err(PostgresCrudError::InvalidIdentifier(value.to_owned()));
    }
    if chars.any(|char| !(char == '_' || char.is_ascii_alphanumeric())) {
        return Err(PostgresCrudError::InvalidIdentifier(value.to_owned()));
    }
    Ok(())
}

fn qualified_table(schema_name: &str, table_name: &str) -> Result<String, PostgresCrudError> {
    validate_identifier(schema_name)?;
    validate_identifier(table_name)?;
    Ok(format!(
        "{}.{}",
        quote_identifier(schema_name),
        quote_identifier(table_name)
    ))
}

fn quote_identifier(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

fn where_clause_from_keys<'a>(
    left_alias: &str,
    right_alias: &str,
    keys: impl Iterator<Item = &'a String>,
) -> String {
    keys.map(|column| {
        let column = quote_identifier(column);
        format!("{left_alias}.{column} IS NOT DISTINCT FROM {right_alias}.{column}")
    })
    .collect::<Vec<_>>()
    .join(" AND ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identifier_validation_rejects_unsafe_text() {
        assert!(validate_identifier("public").is_ok());
        assert!(validate_identifier("_audit_2026").is_ok());
        assert!(validate_identifier("bad-name").is_err());
        assert!(validate_identifier("users;drop").is_err());
        assert!(validate_identifier("").is_err());
    }

    #[test]
    fn where_clause_uses_null_safe_comparison() {
        let keys = ["id".to_owned(), "tenant_id".to_owned()];
        assert_eq!(
            where_clause_from_keys("target", "key_row", keys.iter()),
            "target.\"id\" IS NOT DISTINCT FROM key_row.\"id\" AND target.\"tenant_id\" IS NOT DISTINCT FROM key_row.\"tenant_id\""
        );
    }
}
