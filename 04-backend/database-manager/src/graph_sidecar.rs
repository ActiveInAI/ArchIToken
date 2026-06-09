// License: Apache-2.0

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{PgPool, Postgres, Transaction};
use thiserror::Error;
use uuid::Uuid;

pub const GRAPH_SIDECAR_URL_ENV: &str = "ARCHITOKEN_GRAPH__URL";
pub const GRAPH_SIDECAR_POSTGRES_URL_ENV: &str = "ARCHITOKEN_GRAPH_SIDECAR_POSTGRES_URL";

const MAX_LIMIT: i64 = 500;
const DEFAULT_LIMIT: i64 = 100;

#[derive(Debug, Error)]
pub enum GraphSidecarError {
    #[error("graph sidecar URL is not configured")]
    NotConfigured,
    #[error("graph sidecar request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("graph sidecar database query failed: {0}")]
    Query(#[from] sqlx::Error),
    #[error("graph sidecar input is invalid: {0}")]
    InvalidInput(String),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphSidecarHealth {
    pub status: String,
    pub engine: String,
    pub source: String,
    pub table: String,
    pub edge_count_visible: i64,
    pub provider: String,
    pub fallback_provider: String,
    pub license: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdgeRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub project_id: Option<Uuid>,
    pub module_id: Option<String>,
    pub from_entity_type: String,
    pub from_entity_id: String,
    pub to_entity_type: String,
    pub to_entity_id: String,
    pub relationship_type: String,
    pub properties: Value,
    pub source: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNeighborsResponse {
    pub tenant_id: Uuid,
    pub project_id: Option<Uuid>,
    pub entity_type: String,
    pub entity_id: String,
    pub edge_count: usize,
    pub edges: Vec<GraphEdgeRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdgeQuery {
    pub tenant_id: String,
    pub project_id: Option<String>,
    pub module_id: Option<String>,
    pub from_entity_type: Option<String>,
    pub from_entity_id: Option<String>,
    pub to_entity_type: Option<String>,
    pub to_entity_id: Option<String>,
    pub relationship_type: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdgeInput {
    pub tenant_id: String,
    pub project_id: String,
    pub module_id: Option<String>,
    pub from_entity_type: String,
    pub from_entity_id: String,
    pub to_entity_type: String,
    pub to_entity_id: String,
    pub relationship_type: String,
    pub properties: Option<Value>,
    pub source: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNeighborsQuery {
    pub tenant_id: String,
    pub project_id: Option<String>,
    pub entity_type: String,
    pub entity_id: String,
    pub relationship_type: Option<String>,
    pub direction: Option<GraphDirection>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GraphDirection {
    Outbound,
    Inbound,
    Both,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphDeleteQuery {
    pub tenant_id: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphMutationResponse {
    pub affected_rows: u64,
    pub rows: Vec<GraphEdgeRecord>,
}

#[derive(Debug, Clone)]
pub struct GraphSidecarState {
    pool: PgPool,
    source: String,
}

impl GraphSidecarState {
    #[must_use]
    pub fn new(pool: PgPool, source: impl Into<String>) -> Self {
        Self {
            pool,
            source: source.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphSidecarApiError {
    pub code: &'static str,
    pub message: String,
}

pub fn graph_sidecar_url_from_env() -> Result<String, GraphSidecarError> {
    std::env::var(GRAPH_SIDECAR_URL_ENV)
        .map(|value| value.trim().trim_end_matches('/').to_owned())
        .ok()
        .filter(|value| !value.is_empty())
        .ok_or(GraphSidecarError::NotConfigured)
}

pub fn graph_sidecar_database_url_from_env() -> Result<String, GraphSidecarError> {
    std::env::var(GRAPH_SIDECAR_POSTGRES_URL_ENV)
        .or_else(|_| std::env::var("ARCHITOKEN_DB_MANAGER_POSTGRES_URL"))
        .or_else(|_| std::env::var("ARCHITOKEN_DATABASE__URL"))
        .or_else(|_| std::env::var("DATABASE_URL"))
        .map_err(|_| GraphSidecarError::NotConfigured)
}

pub async fn connect_graph_sidecar_pool() -> Result<GraphSidecarState, GraphSidecarError> {
    let database_url = graph_sidecar_database_url_from_env()?;
    let source = crate::postgres_inventory::redact_database_url(&database_url);
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;
    Ok(GraphSidecarState::new(pool, source))
}

pub async fn load_graph_sidecar_health(
    client: &reqwest::Client,
    base_url: &str,
) -> Result<GraphSidecarHealth, GraphSidecarError> {
    let url = format!("{}/api/graph/health", base_url.trim_end_matches('/'));
    Ok(client
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .json::<GraphSidecarHealth>()
        .await?)
}

pub fn router(state: GraphSidecarState) -> Router {
    Router::new()
        .route("/", get(root_handler))
        .route("/readyz", get(health_handler))
        .route("/healthz", get(health_handler))
        .route("/api/graph/health", get(health_handler))
        .route(
            "/api/graph/edges",
            get(list_edges_handler).post(upsert_edge_handler),
        )
        .route("/api/graph/edges/{edge_id}", delete(delete_edge_handler))
        .route("/api/graph/neighbors", get(neighbors_handler))
        .with_state(state)
}

async fn root_handler() -> impl IntoResponse {
    Json(json!({
        "status": "ready",
        "engine": "architoken_graph_sidecar",
        "license": "Apache-2.0"
    }))
}

async fn health_handler(
    State(state): State<GraphSidecarState>,
) -> Result<Json<GraphSidecarHealth>, (StatusCode, Json<GraphSidecarApiError>)> {
    graph_health(&state).await.map(Json).map_err(error_response)
}

async fn list_edges_handler(
    State(state): State<GraphSidecarState>,
    Query(query): Query<GraphEdgeQuery>,
) -> Result<Json<Vec<GraphEdgeRecord>>, (StatusCode, Json<GraphSidecarApiError>)> {
    list_edges(&state.pool, query)
        .await
        .map(Json)
        .map_err(error_response)
}

async fn upsert_edge_handler(
    State(state): State<GraphSidecarState>,
    Json(input): Json<GraphEdgeInput>,
) -> Result<Json<GraphMutationResponse>, (StatusCode, Json<GraphSidecarApiError>)> {
    upsert_edge(&state.pool, input)
        .await
        .map(Json)
        .map_err(error_response)
}

async fn delete_edge_handler(
    State(state): State<GraphSidecarState>,
    Path(edge_id): Path<String>,
    Query(query): Query<GraphDeleteQuery>,
) -> Result<Json<GraphMutationResponse>, (StatusCode, Json<GraphSidecarApiError>)> {
    delete_edge(&state.pool, &edge_id, query)
        .await
        .map(Json)
        .map_err(error_response)
}

async fn neighbors_handler(
    State(state): State<GraphSidecarState>,
    Query(query): Query<GraphNeighborsQuery>,
) -> Result<Json<GraphNeighborsResponse>, (StatusCode, Json<GraphSidecarApiError>)> {
    neighbors(&state.pool, query)
        .await
        .map(Json)
        .map_err(error_response)
}

pub async fn graph_health(
    state: &GraphSidecarState,
) -> Result<GraphSidecarHealth, GraphSidecarError> {
    sqlx::query("SELECT to_regclass('public.data_graph_edges')")
        .fetch_one(&state.pool)
        .await?;
    let edge_count_visible = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(n_live_tup, 0)::int8 FROM pg_stat_user_tables WHERE relname = 'data_graph_edges'",
    )
    .fetch_optional(&state.pool)
    .await?
    .unwrap_or_default();
    Ok(GraphSidecarHealth {
        status: "ready".to_owned(),
        engine: "graph_sidecar".to_owned(),
        source: state.source.clone(),
        table: "data_graph_edges".to_owned(),
        edge_count_visible,
        provider: "architoken_graph_sidecar".to_owned(),
        fallback_provider: "postgres_adjacency".to_owned(),
        license: "Apache-2.0".to_owned(),
    })
}

pub async fn list_edges(
    pool: &PgPool,
    query: GraphEdgeQuery,
) -> Result<Vec<GraphEdgeRecord>, GraphSidecarError> {
    let tenant_id = parse_uuid("tenantId", &query.tenant_id)?;
    let project_id = parse_optional_uuid("projectId", query.project_id.as_deref())?;
    let limit = normalized_limit(query.limit)?;
    let mut tx = begin_tenant_tx(pool, tenant_id).await?;
    let records = sqlx::query_as::<_, GraphEdgeRecord>(
        r"
        SELECT id, tenant_id, project_id, module_id, from_entity_type, from_entity_id,
               to_entity_type, to_entity_id, relationship_type, properties, source,
               created_at, updated_at
        FROM data_graph_edges
        WHERE tenant_id = $1
          AND ($2::uuid IS NULL OR project_id = $2)
          AND ($3::text IS NULL OR module_id = $3)
          AND ($4::text IS NULL OR from_entity_type = $4)
          AND ($5::text IS NULL OR from_entity_id = $5)
          AND ($6::text IS NULL OR to_entity_type = $6)
          AND ($7::text IS NULL OR to_entity_id = $7)
          AND ($8::text IS NULL OR relationship_type = $8)
        ORDER BY updated_at DESC, id
        LIMIT $9
        ",
    )
    .bind(tenant_id)
    .bind(project_id)
    .bind(normalized_optional_text(query.module_id.as_deref()))
    .bind(normalized_optional_text(query.from_entity_type.as_deref()))
    .bind(normalized_optional_text(query.from_entity_id.as_deref()))
    .bind(normalized_optional_text(query.to_entity_type.as_deref()))
    .bind(normalized_optional_text(query.to_entity_id.as_deref()))
    .bind(normalized_optional_text(query.relationship_type.as_deref()))
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(records)
}

pub async fn upsert_edge(
    pool: &PgPool,
    input: GraphEdgeInput,
) -> Result<GraphMutationResponse, GraphSidecarError> {
    validate_required("fromEntityType", &input.from_entity_type)?;
    validate_required("fromEntityId", &input.from_entity_id)?;
    validate_required("toEntityType", &input.to_entity_type)?;
    validate_required("toEntityId", &input.to_entity_id)?;
    validate_required("relationshipType", &input.relationship_type)?;
    let tenant_id = parse_uuid("tenantId", &input.tenant_id)?;
    let project_id = parse_uuid("projectId", &input.project_id)?;
    let module_id = normalized_optional_text(input.module_id.as_deref()).map(str::to_owned);
    let mut tx = begin_tenant_tx(pool, tenant_id).await?;
    let record = sqlx::query_as::<_, GraphEdgeRecord>(
        r"
        INSERT INTO data_graph_edges (
            tenant_id, project_id, module_id, from_entity_type, from_entity_id,
            to_entity_type, to_entity_id, relationship_type, properties, source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (
            tenant_id, project_id, module_id, from_entity_type, from_entity_id,
            to_entity_type, to_entity_id, relationship_type
        )
        DO UPDATE SET
            properties = EXCLUDED.properties,
            source = EXCLUDED.source,
            updated_at = NOW()
        RETURNING id, tenant_id, project_id, module_id, from_entity_type, from_entity_id,
                  to_entity_type, to_entity_id, relationship_type, properties, source,
                  created_at, updated_at
        ",
    )
    .bind(tenant_id)
    .bind(project_id)
    .bind(module_id)
    .bind(input.from_entity_type.trim())
    .bind(input.from_entity_id.trim())
    .bind(input.to_entity_type.trim())
    .bind(input.to_entity_id.trim())
    .bind(input.relationship_type.trim())
    .bind(input.properties.unwrap_or_else(|| json!({})))
    .bind(input.source.unwrap_or_else(|| "graph_sidecar".to_owned()))
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(GraphMutationResponse {
        affected_rows: 1,
        rows: vec![record],
    })
}

pub async fn delete_edge(
    pool: &PgPool,
    edge_id: &str,
    query: GraphDeleteQuery,
) -> Result<GraphMutationResponse, GraphSidecarError> {
    let edge_id = parse_uuid("edgeId", edge_id)?;
    let tenant_id = parse_uuid("tenantId", &query.tenant_id)?;
    let mut tx = begin_tenant_tx(pool, tenant_id).await?;
    let rows = sqlx::query_as::<_, GraphEdgeRecord>(
        r"
        DELETE FROM data_graph_edges
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, tenant_id, project_id, module_id, from_entity_type, from_entity_id,
                  to_entity_type, to_entity_id, relationship_type, properties, source,
                  created_at, updated_at
        ",
    )
    .bind(edge_id)
    .bind(tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(GraphMutationResponse {
        affected_rows: rows.len() as u64,
        rows,
    })
}

pub async fn neighbors(
    pool: &PgPool,
    query: GraphNeighborsQuery,
) -> Result<GraphNeighborsResponse, GraphSidecarError> {
    validate_required("entityType", &query.entity_type)?;
    validate_required("entityId", &query.entity_id)?;
    let tenant_id = parse_uuid("tenantId", &query.tenant_id)?;
    let project_id = parse_optional_uuid("projectId", query.project_id.as_deref())?;
    let limit = normalized_limit(query.limit)?;
    let direction = query.direction.unwrap_or(GraphDirection::Both);
    let mut tx = begin_tenant_tx(pool, tenant_id).await?;
    let records = sqlx::query_as::<_, GraphEdgeRecord>(
        r"
        SELECT id, tenant_id, project_id, module_id, from_entity_type, from_entity_id,
               to_entity_type, to_entity_id, relationship_type, properties, source,
               created_at, updated_at
        FROM data_graph_edges
        WHERE tenant_id = $1
          AND ($2::uuid IS NULL OR project_id = $2)
          AND ($3::text IS NULL OR relationship_type = $3)
          AND (
              ($4::text IN ('outbound', 'both') AND from_entity_type = $5 AND from_entity_id = $6)
              OR
              ($4::text IN ('inbound', 'both') AND to_entity_type = $5 AND to_entity_id = $6)
          )
        ORDER BY updated_at DESC, id
        LIMIT $7
        ",
    )
    .bind(tenant_id)
    .bind(project_id)
    .bind(normalized_optional_text(query.relationship_type.as_deref()))
    .bind(direction.as_str())
    .bind(query.entity_type.trim())
    .bind(query.entity_id.trim())
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(GraphNeighborsResponse {
        tenant_id,
        project_id,
        entity_type: query.entity_type,
        entity_id: query.entity_id,
        edge_count: records.len(),
        edges: records,
    })
}

fn error_response(err: GraphSidecarError) -> (StatusCode, Json<GraphSidecarApiError>) {
    let (status, code) = match err {
        GraphSidecarError::NotConfigured => (
            StatusCode::SERVICE_UNAVAILABLE,
            "graph_sidecar_not_configured",
        ),
        GraphSidecarError::InvalidInput(_) => (StatusCode::BAD_REQUEST, "graph_invalid_input"),
        GraphSidecarError::Request(_) => {
            (StatusCode::SERVICE_UNAVAILABLE, "graph_sidecar_unavailable")
        }
        GraphSidecarError::Query(_) => (StatusCode::INTERNAL_SERVER_ERROR, "graph_query_failed"),
    };
    (
        status,
        Json(GraphSidecarApiError {
            code,
            message: err.to_string(),
        }),
    )
}

async fn begin_tenant_tx(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<Transaction<'_, Postgres>, GraphSidecarError> {
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;
    Ok(tx)
}

fn parse_uuid(field: &str, value: &str) -> Result<Uuid, GraphSidecarError> {
    value
        .parse::<Uuid>()
        .map_err(|_| GraphSidecarError::InvalidInput(format!("{field} must be a UUID: {value}")))
}

fn parse_optional_uuid(
    field: &str,
    value: Option<&str>,
) -> Result<Option<Uuid>, GraphSidecarError> {
    value
        .and_then(|value| normalized_optional_text(Some(value)))
        .map(|value| parse_uuid(field, value))
        .transpose()
}

fn validate_required(field: &str, value: &str) -> Result<(), GraphSidecarError> {
    if value.trim().is_empty() {
        return Err(GraphSidecarError::InvalidInput(format!(
            "{field} is required"
        )));
    }
    Ok(())
}

fn normalized_limit(limit: Option<i64>) -> Result<i64, GraphSidecarError> {
    match limit.unwrap_or(DEFAULT_LIMIT) {
        value if value <= 0 => Err(GraphSidecarError::InvalidInput(
            "limit must be greater than zero".to_owned(),
        )),
        value if value > MAX_LIMIT => Ok(MAX_LIMIT),
        value => Ok(value),
    }
}

fn normalized_optional_text(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

impl GraphDirection {
    const fn as_str(self) -> &'static str {
        match self {
            Self::Outbound => "outbound",
            Self::Inbound => "inbound",
            Self::Both => "both",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{normalized_limit, parse_optional_uuid};

    #[test]
    fn normalized_limit_defaults_and_caps() {
        assert_eq!(normalized_limit(None).expect("default"), 100);
        assert_eq!(normalized_limit(Some(1)).expect("small"), 1);
        assert_eq!(normalized_limit(Some(999)).expect("capped"), 500);
        assert!(normalized_limit(Some(0)).is_err());
    }

    #[test]
    fn optional_uuid_accepts_blank() {
        assert_eq!(parse_optional_uuid("projectId", None).expect("none"), None);
        assert_eq!(
            parse_optional_uuid("projectId", Some("   ")).expect("blank"),
            None
        );
        assert!(parse_optional_uuid("projectId", Some("not-a-uuid")).is_err());
    }
}
