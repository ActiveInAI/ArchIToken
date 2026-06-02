//! Postgres trunk implementation for progressive `StorageRouter` data-plane stores.
//!
//! These functions are the first landing point for split-capability storage:
//! business code can write through `GraphStore`, `TimeSeriesStore`, `EventStore` and
//! `AnalyticsStore` shaped APIs while Postgres remains the trunk fallback. Later
//! physical stores can replace these functions behind the same capability
//! boundary.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::{
    error::{HarnessError, Result},
    module_registry::normalize_module_id,
    runtime_context::RequestContext,
};

const DEFAULT_PAGE_LIMIT: i64 = 100;
const MAX_PAGE_LIMIT: i64 = 500;
const DEFAULT_CLICKHOUSE_DATABASE: &str = "architoken";

/// Runtime binding for one data-plane capability.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DataPlaneBindingRecord {
    /// Capability key such as `vector_store`.
    pub capability: String,
    /// Current provider selected for this capability.
    pub current_provider: String,
    /// Fallback provider retained during progressive split.
    pub fallback_provider: String,
    /// Split phase assigned to this capability.
    pub split_phase: String,
    /// Environment variables used by the external provider.
    pub external_url_env: Vec<String>,
    /// Whether this capability is enabled.
    pub enabled: bool,
    /// Additional routing metadata.
    pub metadata: Value,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Graph edge write input.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataGraphEdgeInput {
    /// Optional module id; aliases are canonicalized through Module Registry.
    pub module_id: Option<String>,
    /// Source entity type.
    pub from_entity_type: String,
    /// Source entity id.
    pub from_entity_id: String,
    /// Target entity type.
    pub to_entity_type: String,
    /// Target entity id.
    pub to_entity_id: String,
    /// Relationship type.
    pub relationship_type: String,
    /// Edge properties.
    pub properties: Option<Value>,
    /// Source adapter or workflow id.
    pub source: Option<String>,
}

/// Graph edge query input.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataGraphEdgeQuery {
    /// Optional module id filter.
    pub module_id: Option<String>,
    /// Optional source entity type.
    pub from_entity_type: Option<String>,
    /// Optional source entity id.
    pub from_entity_id: Option<String>,
    /// Optional relationship type.
    pub relationship_type: Option<String>,
    /// Maximum rows to return.
    pub limit: Option<i64>,
}

/// Stored graph edge record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DataGraphEdgeRecord {
    /// Row id.
    pub id: Uuid,
    /// Tenant id.
    pub tenant_id: Uuid,
    /// Project id.
    pub project_id: Option<Uuid>,
    /// Module id.
    pub module_id: Option<String>,
    /// Source entity type.
    pub from_entity_type: String,
    /// Source entity id.
    pub from_entity_id: String,
    /// Target entity type.
    pub to_entity_type: String,
    /// Target entity id.
    pub to_entity_id: String,
    /// Relationship type.
    pub relationship_type: String,
    /// Edge properties.
    pub properties: Value,
    /// Source adapter or workflow id.
    pub source: String,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Time-series point write input.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataTimeSeriesPointInput {
    /// Optional module id; aliases are canonicalized through Module Registry.
    pub module_id: Option<String>,
    /// Series key.
    pub series_key: String,
    /// Observation timestamp. Defaults to now.
    pub observed_at: Option<DateTime<Utc>>,
    /// Numeric value.
    pub value_numeric: Option<f64>,
    /// Text value for state-like observations.
    pub value_text: Option<String>,
    /// Unit label.
    pub unit: Option<String>,
    /// Quality marker such as `raw`, `validated`, or `estimated`.
    pub quality: Option<String>,
    /// Additional attributes.
    pub attributes: Option<Value>,
}

/// Time-series query input.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataTimeSeriesPointQuery {
    /// Optional module id filter.
    pub module_id: Option<String>,
    /// Optional series key filter.
    pub series_key: Option<String>,
    /// Maximum rows to return.
    pub limit: Option<i64>,
}

/// Stored time-series point.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DataTimeSeriesPointRecord {
    /// Row id.
    pub id: Uuid,
    /// Tenant id.
    pub tenant_id: Uuid,
    /// Project id.
    pub project_id: Option<Uuid>,
    /// Module id.
    pub module_id: Option<String>,
    /// Series key.
    pub series_key: String,
    /// Observation timestamp.
    pub observed_at: DateTime<Utc>,
    /// Numeric value.
    pub value_numeric: Option<f64>,
    /// Text value.
    pub value_text: Option<String>,
    /// Unit label.
    pub unit: Option<String>,
    /// Quality marker.
    pub quality: String,
    /// Additional attributes.
    pub attributes: Value,
    /// Ingest timestamp.
    pub ingested_at: DateTime<Utc>,
}

/// Event outbox write input.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataEventOutboxInput {
    /// Optional module id; aliases are canonicalized through Module Registry.
    pub module_id: Option<String>,
    /// Event type.
    pub event_type: String,
    /// Target type.
    pub target_type: String,
    /// Target id.
    pub target_id: String,
    /// Event payload.
    pub payload: Option<Value>,
}

/// Event outbox query input.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataEventOutboxQuery {
    /// Optional event status filter.
    pub status: Option<String>,
    /// Optional module id filter.
    pub module_id: Option<String>,
    /// Maximum rows to return.
    pub limit: Option<i64>,
}

/// Stored event outbox record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DataEventOutboxRecord {
    /// Row id.
    pub id: Uuid,
    /// Tenant id.
    pub tenant_id: Uuid,
    /// Project id.
    pub project_id: Option<Uuid>,
    /// Module id.
    pub module_id: Option<String>,
    /// Event type.
    pub event_type: String,
    /// Target type.
    pub target_type: String,
    /// Target id.
    pub target_id: String,
    /// Event payload.
    pub payload: Value,
    /// Dispatch status.
    pub status: String,
    /// Publish attempt count.
    pub attempt_count: i32,
    /// Occurrence timestamp.
    pub occurred_at: DateTime<Utc>,
    /// Publish timestamp.
    pub published_at: Option<DateTime<Utc>>,
    /// Last publish error.
    pub last_error: Option<String>,
}

/// Analytics event write input.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataAnalyticsEventInput {
    /// Optional module id; aliases are canonicalized through Module Registry.
    pub module_id: Option<String>,
    /// Metric/event name.
    pub metric_name: String,
    /// Optional metric value.
    pub metric_value: Option<f64>,
    /// Event dimensions.
    pub dimensions: Option<Value>,
    /// Occurrence timestamp. Defaults to now.
    pub occurred_at: Option<DateTime<Utc>>,
}

/// Analytics query input.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataAnalyticsEventQuery {
    /// Optional metric name filter.
    pub metric_name: Option<String>,
    /// Optional module id filter.
    pub module_id: Option<String>,
    /// Maximum rows to return.
    pub limit: Option<i64>,
}

/// Stored analytics event.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DataAnalyticsEventRecord {
    /// Row id.
    pub id: Uuid,
    /// Tenant id.
    pub tenant_id: Uuid,
    /// Project id.
    pub project_id: Option<Uuid>,
    /// Module id.
    pub module_id: Option<String>,
    /// Metric/event name.
    pub metric_name: String,
    /// Optional metric value.
    pub metric_value: Option<f64>,
    /// Event dimensions.
    pub dimensions: Value,
    /// Occurrence timestamp.
    pub occurred_at: DateTime<Utc>,
    /// Ingest timestamp.
    pub ingested_at: DateTime<Utc>,
}

/// List configured data-plane capability bindings.
///
/// # Errors
/// Returns a database error when the query fails.
pub async fn list_data_plane_bindings(pool: &PgPool) -> Result<Vec<DataPlaneBindingRecord>> {
    let mut bindings = sqlx::query_as::<_, DataPlaneBindingRecord>(
        r"
        SELECT capability, current_provider, fallback_provider, split_phase,
               external_url_env, enabled, metadata, created_at, updated_at
        FROM data_plane_bindings
        WHERE enabled = TRUE
        ORDER BY capability
        ",
    )
    .fetch_all(pool)
    .await?;
    apply_runtime_data_plane_bindings(&mut bindings)?;
    Ok(bindings)
}

/// Upsert a graph edge in the Postgres trunk graph store.
///
/// # Errors
/// Returns validation or database errors.
pub async fn upsert_graph_edge(
    pool: &PgPool,
    context: &RequestContext,
    input: DataGraphEdgeInput,
) -> Result<DataGraphEdgeRecord> {
    validate_required("from_entity_type", &input.from_entity_type)?;
    validate_required("from_entity_id", &input.from_entity_id)?;
    validate_required("to_entity_type", &input.to_entity_type)?;
    validate_required("to_entity_id", &input.to_entity_id)?;
    validate_required("relationship_type", &input.relationship_type)?;
    let tenant_id = parse_uuid("tenant_id", &context.tenant_id)?;
    let project_id = Some(parse_uuid("project_id", &context.project_id)?);
    let module_id = normalize_optional_module_id(input.module_id.as_deref())?;
    let mut tx = begin_tenant_tx(pool, tenant_id).await?;
    let record = sqlx::query_as::<_, DataGraphEdgeRecord>(
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
    .bind(input.source.unwrap_or_else(|| "architoken".to_owned()))
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(record)
}

/// List graph edges from the Postgres trunk graph store.
///
/// # Errors
/// Returns validation or database errors.
pub async fn list_graph_edges(
    pool: &PgPool,
    context: &RequestContext,
    query: &DataGraphEdgeQuery,
) -> Result<Vec<DataGraphEdgeRecord>> {
    let tenant_id = parse_uuid("tenant_id", &context.tenant_id)?;
    let project_id = Some(parse_uuid("project_id", &context.project_id)?);
    let module_id = normalize_optional_module_id(query.module_id.as_deref())?;
    let limit = normalized_limit(query.limit)?;
    let mut tx = begin_tenant_tx(pool, tenant_id).await?;
    let records = sqlx::query_as::<_, DataGraphEdgeRecord>(
        r"
        SELECT id, tenant_id, project_id, module_id, from_entity_type, from_entity_id,
               to_entity_type, to_entity_id, relationship_type, properties, source,
               created_at, updated_at
        FROM data_graph_edges
        WHERE tenant_id = $1
          AND project_id = $2
          AND ($3::text IS NULL OR module_id = $3)
          AND ($4::text IS NULL OR from_entity_type = $4)
          AND ($5::text IS NULL OR from_entity_id = $5)
          AND ($6::text IS NULL OR relationship_type = $6)
        ORDER BY updated_at DESC, id
        LIMIT $7
        ",
    )
    .bind(tenant_id)
    .bind(project_id)
    .bind(module_id)
    .bind(query.from_entity_type.as_deref())
    .bind(query.from_entity_id.as_deref())
    .bind(query.relationship_type.as_deref())
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(records)
}

/// Write a time-series point in the Postgres trunk time-series store.
///
/// # Errors
/// Returns validation or database errors.
pub async fn write_time_series_point(
    pool: &PgPool,
    context: &RequestContext,
    input: DataTimeSeriesPointInput,
) -> Result<DataTimeSeriesPointRecord> {
    validate_required("series_key", &input.series_key)?;
    if input.value_numeric.is_none() && input.value_text.is_none() {
        return Err(HarnessError::InvalidInput(
            "value_numeric or value_text is required".to_owned(),
        ));
    }
    let tenant_id = parse_uuid("tenant_id", &context.tenant_id)?;
    let project_id = Some(parse_uuid("project_id", &context.project_id)?);
    let module_id = normalize_optional_module_id(input.module_id.as_deref())?;
    let record = DataTimeSeriesPointRecord {
        id: Uuid::new_v4(),
        tenant_id,
        project_id,
        module_id,
        series_key: input.series_key.trim().to_owned(),
        observed_at: input.observed_at.unwrap_or_else(Utc::now),
        value_numeric: input.value_numeric,
        value_text: input.value_text,
        unit: input.unit,
        quality: input.quality.unwrap_or_else(|| "raw".to_owned()),
        attributes: input.attributes.unwrap_or_else(|| json!({})),
        ingested_at: Utc::now(),
    };
    if let Some(config) = ClickHouseConfig::from_env(&[
        "ARCHITOKEN_TIMESERIES__URL",
        "ARCHITOKEN_TIME_SERIES__URL",
        "CLICKHOUSE_URL",
    ])? {
        ensure_clickhouse_time_series_schema(&config).await?;
        clickhouse_insert_time_series_point(&config, &record).await?;
    }
    let mut tx = begin_tenant_tx(pool, tenant_id).await?;
    sqlx::query(
        r"
        INSERT INTO data_timeseries_points (
            id, tenant_id, project_id, module_id, series_key, observed_at, value_numeric,
            value_text, unit, quality, attributes, ingested_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ",
    )
    .bind(record.id)
    .bind(tenant_id)
    .bind(project_id)
    .bind(record.module_id.as_deref())
    .bind(&record.series_key)
    .bind(record.observed_at)
    .bind(record.value_numeric)
    .bind(record.value_text.as_deref())
    .bind(record.unit.as_deref())
    .bind(&record.quality)
    .bind(&record.attributes)
    .bind(record.ingested_at)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(record)
}

/// List time-series points from the Postgres trunk time-series store.
///
/// # Errors
/// Returns validation or database errors.
pub async fn list_time_series_points(
    pool: &PgPool,
    context: &RequestContext,
    query: &DataTimeSeriesPointQuery,
) -> Result<Vec<DataTimeSeriesPointRecord>> {
    let tenant_id = parse_uuid("tenant_id", &context.tenant_id)?;
    let project_id = Some(parse_uuid("project_id", &context.project_id)?);
    let module_id = normalize_optional_module_id(query.module_id.as_deref())?;
    let limit = normalized_limit(query.limit)?;
    if let Some(config) = ClickHouseConfig::from_env(&[
        "ARCHITOKEN_TIMESERIES__URL",
        "ARCHITOKEN_TIME_SERIES__URL",
        "CLICKHOUSE_URL",
    ])? {
        ensure_clickhouse_time_series_schema(&config).await?;
        return clickhouse_list_time_series_points(
            &config,
            tenant_id,
            project_id,
            module_id.as_deref(),
            query.series_key.as_deref(),
            limit,
        )
        .await;
    }
    let mut tx = begin_tenant_tx(pool, tenant_id).await?;
    let records = sqlx::query_as::<_, DataTimeSeriesPointRecord>(
        r"
        SELECT id, tenant_id, project_id, module_id, series_key, observed_at,
               value_numeric, value_text, unit, quality, attributes, ingested_at
        FROM data_timeseries_points
        WHERE tenant_id = $1
          AND project_id = $2
          AND ($3::text IS NULL OR module_id = $3)
          AND ($4::text IS NULL OR series_key = $4)
        ORDER BY observed_at DESC, id
        LIMIT $5
        ",
    )
    .bind(tenant_id)
    .bind(project_id)
    .bind(module_id)
    .bind(query.series_key.as_deref())
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(records)
}

/// Append one event into the Postgres outbox.
///
/// # Errors
/// Returns validation or database errors.
pub async fn append_event_outbox(
    pool: &PgPool,
    context: &RequestContext,
    input: DataEventOutboxInput,
) -> Result<DataEventOutboxRecord> {
    validate_required("event_type", &input.event_type)?;
    validate_required("target_type", &input.target_type)?;
    validate_required("target_id", &input.target_id)?;
    let tenant_id = parse_uuid("tenant_id", &context.tenant_id)?;
    let project_id = Some(parse_uuid("project_id", &context.project_id)?);
    let module_id = normalize_optional_module_id(input.module_id.as_deref())?;
    let mut tx = begin_tenant_tx(pool, tenant_id).await?;
    let record = sqlx::query_as::<_, DataEventOutboxRecord>(
        r"
        INSERT INTO data_event_outbox (
            tenant_id, project_id, module_id, event_type, target_type, target_id, payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, tenant_id, project_id, module_id, event_type, target_type,
                  target_id, payload, status, attempt_count, occurred_at, published_at,
                  last_error
        ",
    )
    .bind(tenant_id)
    .bind(project_id)
    .bind(module_id)
    .bind(input.event_type.trim())
    .bind(input.target_type.trim())
    .bind(input.target_id.trim())
    .bind(input.payload.unwrap_or_else(|| json!({})))
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(record)
}

/// List event outbox rows.
///
/// # Errors
/// Returns validation or database errors.
pub async fn list_event_outbox(
    pool: &PgPool,
    context: &RequestContext,
    query: &DataEventOutboxQuery,
) -> Result<Vec<DataEventOutboxRecord>> {
    let tenant_id = parse_uuid("tenant_id", &context.tenant_id)?;
    let project_id = Some(parse_uuid("project_id", &context.project_id)?);
    let module_id = normalize_optional_module_id(query.module_id.as_deref())?;
    let limit = normalized_limit(query.limit)?;
    let mut tx = begin_tenant_tx(pool, tenant_id).await?;
    let records = sqlx::query_as::<_, DataEventOutboxRecord>(
        r"
        SELECT id, tenant_id, project_id, module_id, event_type, target_type,
               target_id, payload, status, attempt_count, occurred_at, published_at,
               last_error
        FROM data_event_outbox
        WHERE tenant_id = $1
          AND project_id = $2
          AND ($3::text IS NULL OR module_id = $3)
          AND ($4::text IS NULL OR status = $4)
        ORDER BY occurred_at DESC, id
        LIMIT $5
        ",
    )
    .bind(tenant_id)
    .bind(project_id)
    .bind(module_id)
    .bind(query.status.as_deref())
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(records)
}

/// Record one analytics event in the Postgres analytics trunk.
///
/// # Errors
/// Returns validation or database errors.
pub async fn record_analytics_event(
    pool: &PgPool,
    context: &RequestContext,
    input: DataAnalyticsEventInput,
) -> Result<DataAnalyticsEventRecord> {
    validate_required("metric_name", &input.metric_name)?;
    let tenant_id = parse_uuid("tenant_id", &context.tenant_id)?;
    let project_id = Some(parse_uuid("project_id", &context.project_id)?);
    let module_id = normalize_optional_module_id(input.module_id.as_deref())?;
    let record = DataAnalyticsEventRecord {
        id: Uuid::new_v4(),
        tenant_id,
        project_id,
        module_id,
        metric_name: input.metric_name.trim().to_owned(),
        metric_value: input.metric_value,
        dimensions: input.dimensions.unwrap_or_else(|| json!({})),
        occurred_at: input.occurred_at.unwrap_or_else(Utc::now),
        ingested_at: Utc::now(),
    };
    if let Some(config) =
        ClickHouseConfig::from_env(&["ARCHITOKEN_ANALYTICS__URL", "CLICKHOUSE_URL"])?
    {
        ensure_clickhouse_analytics_schema(&config).await?;
        clickhouse_insert_analytics_event(&config, &record).await?;
    }
    let mut tx = begin_tenant_tx(pool, tenant_id).await?;
    sqlx::query(
        r"
        INSERT INTO data_analytics_events (
            id, tenant_id, project_id, module_id, metric_name, metric_value,
            dimensions, occurred_at, ingested_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ",
    )
    .bind(record.id)
    .bind(tenant_id)
    .bind(project_id)
    .bind(record.module_id.as_deref())
    .bind(&record.metric_name)
    .bind(record.metric_value)
    .bind(&record.dimensions)
    .bind(record.occurred_at)
    .bind(record.ingested_at)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(record)
}

/// List analytics events from the Postgres analytics trunk.
///
/// # Errors
/// Returns validation or database errors.
pub async fn list_analytics_events(
    pool: &PgPool,
    context: &RequestContext,
    query: &DataAnalyticsEventQuery,
) -> Result<Vec<DataAnalyticsEventRecord>> {
    let tenant_id = parse_uuid("tenant_id", &context.tenant_id)?;
    let project_id = Some(parse_uuid("project_id", &context.project_id)?);
    let module_id = normalize_optional_module_id(query.module_id.as_deref())?;
    let limit = normalized_limit(query.limit)?;
    if let Some(config) =
        ClickHouseConfig::from_env(&["ARCHITOKEN_ANALYTICS__URL", "CLICKHOUSE_URL"])?
    {
        ensure_clickhouse_analytics_schema(&config).await?;
        return clickhouse_list_analytics_events(
            &config,
            tenant_id,
            project_id,
            module_id.as_deref(),
            query.metric_name.as_deref(),
            limit,
        )
        .await;
    }
    let mut tx = begin_tenant_tx(pool, tenant_id).await?;
    let records = sqlx::query_as::<_, DataAnalyticsEventRecord>(
        r"
        SELECT id, tenant_id, project_id, module_id, metric_name, metric_value,
               dimensions, occurred_at, ingested_at
        FROM data_analytics_events
        WHERE tenant_id = $1
          AND project_id = $2
          AND ($3::text IS NULL OR module_id = $3)
          AND ($4::text IS NULL OR metric_name = $4)
        ORDER BY occurred_at DESC, id
        LIMIT $5
        ",
    )
    .bind(tenant_id)
    .bind(project_id)
    .bind(module_id)
    .bind(query.metric_name.as_deref())
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(records)
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ClickHouseConfig {
    endpoint: String,
    database: String,
    user: Option<String>,
    password: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClickHouseTimeSeriesRow {
    id: String,
    tenant_id: String,
    project_id: Option<String>,
    module_id: Option<String>,
    series_key: String,
    observed_at_ms: String,
    value_numeric: Option<f64>,
    value_text: Option<String>,
    unit: Option<String>,
    quality: String,
    attributes: String,
    ingested_at_ms: String,
}

#[derive(Debug, Deserialize)]
struct ClickHouseAnalyticsRow {
    id: String,
    tenant_id: String,
    project_id: Option<String>,
    module_id: Option<String>,
    metric_name: String,
    metric_value: Option<f64>,
    dimensions: String,
    occurred_at_ms: String,
    ingested_at_ms: String,
}

impl ClickHouseConfig {
    fn from_env(keys: &[&str]) -> Result<Option<Self>> {
        let Some(endpoint) = first_env(keys) else {
            return Ok(None);
        };
        let trimmed = endpoint.trim().trim_end_matches('/').to_owned();
        let url = reqwest::Url::parse(&trimmed).map_err(|err| {
            HarnessError::InvalidInput(format!("invalid ClickHouse endpoint {trimmed:?}: {err}"))
        })?;
        if !matches!(url.scheme(), "http" | "https") {
            return Err(HarnessError::InvalidInput(format!(
                "ClickHouse endpoint must use http or https: {trimmed:?}"
            )));
        }
        let database = std::env::var("CLICKHOUSE_DB")
            .unwrap_or_else(|_| DEFAULT_CLICKHOUSE_DATABASE.to_owned());
        validate_clickhouse_identifier("CLICKHOUSE_DB", &database)?;
        Ok(Some(Self {
            endpoint: trimmed,
            database,
            user: std::env::var("CLICKHOUSE_USER")
                .ok()
                .filter(|value| !value.trim().is_empty()),
            password: std::env::var("CLICKHOUSE_PASSWORD")
                .ok()
                .filter(|value| !value.trim().is_empty()),
        }))
    }
}

fn apply_runtime_data_plane_bindings(bindings: &mut [DataPlaneBindingRecord]) -> Result<()> {
    let time_series_clickhouse = ClickHouseConfig::from_env(&[
        "ARCHITOKEN_TIMESERIES__URL",
        "ARCHITOKEN_TIME_SERIES__URL",
        "CLICKHOUSE_URL",
    ])?
    .is_some();
    let analytics_clickhouse =
        ClickHouseConfig::from_env(&["ARCHITOKEN_ANALYTICS__URL", "CLICKHOUSE_URL"])?.is_some();

    for binding in bindings {
        match binding.capability.as_str() {
            "time_series_store" if time_series_clickhouse => {
                "clickhouse".clone_into(&mut binding.current_provider);
                "postgres_partitioned".clone_into(&mut binding.fallback_provider);
                binding.metadata = merge_binding_metadata(
                    &binding.metadata,
                    json!({
                        "externalized": true,
                        "adapter": "clickhouse_http",
                        "canonicalFallback": "postgres_partitioned"
                    }),
                );
            }
            "analytics_store" if analytics_clickhouse => {
                "clickhouse".clone_into(&mut binding.current_provider);
                "postgres_materialized_views".clone_into(&mut binding.fallback_provider);
                binding.metadata = merge_binding_metadata(
                    &binding.metadata,
                    json!({
                        "externalized": true,
                        "adapter": "clickhouse_http",
                        "canonicalFallback": "postgres_materialized_views"
                    }),
                );
            }
            "graph_store" => {
                "postgres_adjacency".clone_into(&mut binding.current_provider);
                "postgres_adjacency".clone_into(&mut binding.fallback_provider);
                binding.metadata = merge_binding_metadata(
                    &binding.metadata,
                    json!({
                        "externalized": false,
                        "adapter": "postgres_adjacency",
                        "externalizationBlockedBy": "reviewed graph sidecar not configured"
                    }),
                );
            }
            _ => {}
        }
    }
    Ok(())
}

fn merge_binding_metadata(current: &Value, overlay: Value) -> Value {
    let mut merged = current.as_object().cloned().unwrap_or_default();
    if let Value::Object(overlay) = overlay {
        for (key, value) in overlay {
            merged.insert(key, value);
        }
    }
    Value::Object(merged)
}

async fn ensure_clickhouse_time_series_schema(config: &ClickHouseConfig) -> Result<()> {
    ensure_clickhouse_database(config).await?;
    clickhouse_execute(
        config,
        &format!(
            r"
            CREATE TABLE IF NOT EXISTS `{}`.`data_timeseries_points` (
                id String,
                tenant_id String,
                project_id Nullable(String),
                module_id Nullable(String),
                series_key String,
                observed_at_ms Int64,
                value_numeric Nullable(Float64),
                value_text Nullable(String),
                unit Nullable(String),
                quality String,
                attributes String,
                ingested_at_ms Int64
            )
            ENGINE = MergeTree
            ORDER BY (tenant_id, ifNull(project_id, ''), series_key, observed_at_ms, id)
            ",
            config.database
        ),
    )
    .await?;
    Ok(())
}

async fn ensure_clickhouse_analytics_schema(config: &ClickHouseConfig) -> Result<()> {
    ensure_clickhouse_database(config).await?;
    clickhouse_execute(
        config,
        &format!(
            r"
            CREATE TABLE IF NOT EXISTS `{}`.`data_analytics_events` (
                id String,
                tenant_id String,
                project_id Nullable(String),
                module_id Nullable(String),
                metric_name String,
                metric_value Nullable(Float64),
                dimensions String,
                occurred_at_ms Int64,
                ingested_at_ms Int64
            )
            ENGINE = MergeTree
            ORDER BY (tenant_id, ifNull(project_id, ''), metric_name, occurred_at_ms, id)
            ",
            config.database
        ),
    )
    .await?;
    Ok(())
}

async fn ensure_clickhouse_database(config: &ClickHouseConfig) -> Result<()> {
    clickhouse_execute(
        config,
        &format!("CREATE DATABASE IF NOT EXISTS `{}`", config.database),
    )
    .await?;
    Ok(())
}

async fn clickhouse_insert_time_series_point(
    config: &ClickHouseConfig,
    record: &DataTimeSeriesPointRecord,
) -> Result<()> {
    let row = json!({
        "id": record.id.to_string(),
        "tenant_id": record.tenant_id.to_string(),
        "project_id": record.project_id.map(|value| value.to_string()),
        "module_id": record.module_id.as_deref(),
        "series_key": record.series_key.as_str(),
        "observed_at_ms": record.observed_at.timestamp_millis(),
        "value_numeric": record.value_numeric,
        "value_text": record.value_text.as_deref(),
        "unit": record.unit.as_deref(),
        "quality": record.quality.as_str(),
        "attributes": serde_json::to_string(&record.attributes)?,
        "ingested_at_ms": record.ingested_at.timestamp_millis(),
    });
    clickhouse_execute(
        config,
        &format!(
            "INSERT INTO `{}`.`data_timeseries_points` FORMAT JSONEachRow\n{}\n",
            config.database, row
        ),
    )
    .await?;
    Ok(())
}

async fn clickhouse_insert_analytics_event(
    config: &ClickHouseConfig,
    record: &DataAnalyticsEventRecord,
) -> Result<()> {
    let row = json!({
        "id": record.id.to_string(),
        "tenant_id": record.tenant_id.to_string(),
        "project_id": record.project_id.map(|value| value.to_string()),
        "module_id": record.module_id.as_deref(),
        "metric_name": record.metric_name.as_str(),
        "metric_value": record.metric_value,
        "dimensions": serde_json::to_string(&record.dimensions)?,
        "occurred_at_ms": record.occurred_at.timestamp_millis(),
        "ingested_at_ms": record.ingested_at.timestamp_millis(),
    });
    clickhouse_execute(
        config,
        &format!(
            "INSERT INTO `{}`.`data_analytics_events` FORMAT JSONEachRow\n{}\n",
            config.database, row
        ),
    )
    .await?;
    Ok(())
}

async fn clickhouse_list_time_series_points(
    config: &ClickHouseConfig,
    tenant_id: Uuid,
    project_id: Option<Uuid>,
    module_id: Option<&str>,
    series_key: Option<&str>,
    limit: i64,
) -> Result<Vec<DataTimeSeriesPointRecord>> {
    let mut predicates = vec![
        format!("tenant_id = {}", clickhouse_quote(&tenant_id.to_string())),
        format!(
            "project_id = {}",
            clickhouse_quote(
                &project_id
                    .map(|value| value.to_string())
                    .unwrap_or_default()
            )
        ),
    ];
    if let Some(module_id) = module_id {
        predicates.push(format!("module_id = {}", clickhouse_quote(module_id)));
    }
    if let Some(series_key) = series_key {
        predicates.push(format!("series_key = {}", clickhouse_quote(series_key)));
    }
    let sql = format!(
        r"
        SELECT id, tenant_id, project_id, module_id, series_key, observed_at_ms,
               value_numeric, value_text, unit, quality, attributes, ingested_at_ms
        FROM `{}`.`data_timeseries_points`
        WHERE {}
        ORDER BY observed_at_ms DESC, id
        LIMIT {}
        FORMAT JSONEachRow
        ",
        config.database,
        predicates.join(" AND "),
        limit
    );
    let body = clickhouse_execute(config, &sql).await?;
    body.lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            let row: ClickHouseTimeSeriesRow = serde_json::from_str(line)?;
            Ok(DataTimeSeriesPointRecord {
                id: parse_clickhouse_uuid("id", &row.id)?,
                tenant_id: parse_clickhouse_uuid("tenant_id", &row.tenant_id)?,
                project_id: row
                    .project_id
                    .as_deref()
                    .filter(|value| !value.is_empty())
                    .map(|value| parse_clickhouse_uuid("project_id", value))
                    .transpose()?,
                module_id: row.module_id,
                series_key: row.series_key,
                observed_at: clickhouse_datetime_from_ms("observed_at_ms", &row.observed_at_ms)?,
                value_numeric: row.value_numeric,
                value_text: row.value_text,
                unit: row.unit,
                quality: row.quality,
                attributes: serde_json::from_str(&row.attributes)?,
                ingested_at: clickhouse_datetime_from_ms("ingested_at_ms", &row.ingested_at_ms)?,
            })
        })
        .collect()
}

async fn clickhouse_list_analytics_events(
    config: &ClickHouseConfig,
    tenant_id: Uuid,
    project_id: Option<Uuid>,
    module_id: Option<&str>,
    metric_name: Option<&str>,
    limit: i64,
) -> Result<Vec<DataAnalyticsEventRecord>> {
    let mut predicates = vec![
        format!("tenant_id = {}", clickhouse_quote(&tenant_id.to_string())),
        format!(
            "project_id = {}",
            clickhouse_quote(
                &project_id
                    .map(|value| value.to_string())
                    .unwrap_or_default()
            )
        ),
    ];
    if let Some(module_id) = module_id {
        predicates.push(format!("module_id = {}", clickhouse_quote(module_id)));
    }
    if let Some(metric_name) = metric_name {
        predicates.push(format!("metric_name = {}", clickhouse_quote(metric_name)));
    }
    let sql = format!(
        r"
        SELECT id, tenant_id, project_id, module_id, metric_name, metric_value,
               dimensions, occurred_at_ms, ingested_at_ms
        FROM `{}`.`data_analytics_events`
        WHERE {}
        ORDER BY occurred_at_ms DESC, id
        LIMIT {}
        FORMAT JSONEachRow
        ",
        config.database,
        predicates.join(" AND "),
        limit
    );
    let body = clickhouse_execute(config, &sql).await?;
    body.lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            let row: ClickHouseAnalyticsRow = serde_json::from_str(line)?;
            Ok(DataAnalyticsEventRecord {
                id: parse_clickhouse_uuid("id", &row.id)?,
                tenant_id: parse_clickhouse_uuid("tenant_id", &row.tenant_id)?,
                project_id: row
                    .project_id
                    .as_deref()
                    .filter(|value| !value.is_empty())
                    .map(|value| parse_clickhouse_uuid("project_id", value))
                    .transpose()?,
                module_id: row.module_id,
                metric_name: row.metric_name,
                metric_value: row.metric_value,
                dimensions: serde_json::from_str(&row.dimensions)?,
                occurred_at: clickhouse_datetime_from_ms("occurred_at_ms", &row.occurred_at_ms)?,
                ingested_at: clickhouse_datetime_from_ms("ingested_at_ms", &row.ingested_at_ms)?,
            })
        })
        .collect()
}

async fn clickhouse_execute(config: &ClickHouseConfig, sql: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let mut request = client.post(&config.endpoint).body(sql.to_owned());
    if let Some(user) = &config.user {
        request = request.basic_auth(user, config.password.as_deref());
    }
    let response = request.send().await?;
    let status = response.status();
    let body = response.text().await?;
    if !status.is_success() {
        return Err(HarnessError::Upstream(format!(
            "ClickHouse query failed status={} body={}",
            status.as_u16(),
            body.trim()
        )));
    }
    Ok(body)
}

fn first_env(keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        std::env::var(key)
            .ok()
            .filter(|value| !value.trim().is_empty())
    })
}

fn validate_clickhouse_identifier(field: &str, value: &str) -> Result<()> {
    if value
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_')
    {
        return Ok(());
    }
    Err(HarnessError::InvalidInput(format!(
        "{field} must contain only ASCII letters, digits or underscore"
    )))
}

fn clickhouse_quote(value: &str) -> String {
    format!("'{}'", value.replace('\\', "\\\\").replace('\'', "\\'"))
}

fn clickhouse_datetime_from_ms(field: &str, value: &str) -> Result<DateTime<Utc>> {
    let millis = value.parse::<i64>().map_err(|_| {
        HarnessError::InvalidInput(format!("invalid ClickHouse timestamp {field}: {value}"))
    })?;
    DateTime::<Utc>::from_timestamp_millis(millis).ok_or_else(|| {
        HarnessError::InvalidInput(format!("invalid ClickHouse timestamp {field}: {value}"))
    })
}

fn parse_clickhouse_uuid(field: &str, value: &str) -> Result<Uuid> {
    value.parse::<Uuid>().map_err(|_| {
        HarnessError::InvalidInput(format!("invalid ClickHouse UUID {field}: {value}"))
    })
}

async fn begin_tenant_tx(pool: &PgPool, tenant_id: Uuid) -> Result<Transaction<'_, Postgres>> {
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;
    Ok(tx)
}

fn normalize_optional_module_id(module_id: Option<&str>) -> Result<Option<String>> {
    module_id
        .map(|value| {
            normalize_module_id(value)
                .map(|normalized| normalized.as_str().to_owned())
                .ok_or_else(|| HarnessError::InvalidInput(format!("unknown module_id: {value}")))
        })
        .transpose()
}

fn parse_uuid(field: &str, value: &str) -> Result<Uuid> {
    value.parse::<Uuid>().map_err(|_| {
        HarnessError::InvalidInput(format!(
            "{field} must be a UUID for data-plane stores: {value}"
        ))
    })
}

fn validate_required(field: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() {
        return Err(HarnessError::InvalidInput(format!("{field} is required")));
    }
    Ok(())
}

fn normalized_limit(limit: Option<i64>) -> Result<i64> {
    match limit.unwrap_or(DEFAULT_PAGE_LIMIT) {
        value if value <= 0 => Err(HarnessError::InvalidInput(
            "limit must be greater than zero".to_owned(),
        )),
        value if value > MAX_PAGE_LIMIT => Ok(MAX_PAGE_LIMIT),
        value => Ok(value),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        DataPlaneBindingRecord, apply_runtime_data_plane_bindings, clickhouse_quote,
        normalize_optional_module_id, normalized_limit,
    };
    use chrono::Utc;
    use serde_json::json;

    #[test]
    fn normalized_limit_defaults_and_caps() {
        assert_eq!(normalized_limit(None).expect("default limit"), 100);
        assert_eq!(normalized_limit(Some(1)).expect("small limit"), 1);
        assert_eq!(normalized_limit(Some(999)).expect("capped limit"), 500);
        assert!(normalized_limit(Some(0)).is_err());
    }

    #[test]
    fn module_id_aliases_normalize_for_data_plane_records() {
        assert_eq!(
            normalize_optional_module_id(Some("finance_hr")).expect("alias normalizes"),
            Some("finance_management".to_owned())
        );
        assert!(normalize_optional_module_id(Some("unknown")).is_err());
        assert_eq!(normalize_optional_module_id(None).expect("none ok"), None);
    }

    #[test]
    fn data_plane_bindings_report_clickhouse_when_configured() {
        temp_env::with_vars(
            [
                ("CLICKHOUSE_URL", Some("http://127.0.0.1:8123")),
                ("CLICKHOUSE_DB", Some("architoken")),
            ],
            || {
                let now = Utc::now();
                let mut bindings = vec![
                    DataPlaneBindingRecord {
                        capability: "time_series_store".to_owned(),
                        current_provider: "postgres_partitioned".to_owned(),
                        fallback_provider: "postgres_partitioned".to_owned(),
                        split_phase: "phase_3_time_series_split".to_owned(),
                        external_url_env: vec!["CLICKHOUSE_URL".to_owned()],
                        enabled: true,
                        metadata: json!({"rule":"test"}),
                        created_at: now,
                        updated_at: now,
                    },
                    DataPlaneBindingRecord {
                        capability: "analytics_store".to_owned(),
                        current_provider: "postgres_materialized_views".to_owned(),
                        fallback_provider: "postgres_materialized_views".to_owned(),
                        split_phase: "phase_6_analytics_split".to_owned(),
                        external_url_env: vec!["CLICKHOUSE_URL".to_owned()],
                        enabled: true,
                        metadata: json!({"rule":"test"}),
                        created_at: now,
                        updated_at: now,
                    },
                    DataPlaneBindingRecord {
                        capability: "graph_store".to_owned(),
                        current_provider: "external_graph".to_owned(),
                        fallback_provider: "postgres_adjacency".to_owned(),
                        split_phase: "phase_4_graph_split".to_owned(),
                        external_url_env: vec!["ARCHITOKEN_GRAPH__URL".to_owned()],
                        enabled: true,
                        metadata: json!({}),
                        created_at: now,
                        updated_at: now,
                    },
                ];

                apply_runtime_data_plane_bindings(&mut bindings).expect("bindings apply");

                assert_eq!(bindings[0].current_provider, "clickhouse");
                assert_eq!(bindings[0].fallback_provider, "postgres_partitioned");
                assert_eq!(bindings[1].current_provider, "clickhouse");
                assert_eq!(bindings[1].fallback_provider, "postgres_materialized_views");
                assert_eq!(bindings[2].current_provider, "postgres_adjacency");
                assert_eq!(
                    bindings[2].metadata["externalizationBlockedBy"],
                    json!("reviewed graph sidecar not configured")
                );
            },
        );
    }

    #[test]
    fn clickhouse_quote_escapes_string_literals() {
        assert_eq!(clickhouse_quote("sensor'\\x"), "'sensor\\'\\\\x'");
    }
}
