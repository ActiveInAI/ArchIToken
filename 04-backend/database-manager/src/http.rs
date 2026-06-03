// License: Apache-2.0

use crate::{
    DatabaseEngineProfile, DatabaseManagerManifest, DatabaseManagerRegistry,
    clickhouse_inventory::{
        ClickHouseConfig, ClickHouseInventory, ClickHouseInventoryError, load_clickhouse_inventory,
    },
    nats_inventory::{
        NatsInventory, NatsInventoryError, load_nats_inventory, nats_monitor_url_from_env,
    },
    postgres_inventory::{
        PostgresInventory, PostgresInventoryError, database_url_from_env, load_postgres_inventory,
        redact_database_url,
    },
    qdrant_inventory::{
        QdrantInventory, QdrantInventoryError, load_qdrant_inventory, qdrant_url_from_env,
    },
    s3_inventory::{S3Inventory, S3InventoryConfig, S3InventoryError, load_s3_inventory},
    valkey_inventory::{
        ValkeyInventory, ValkeyInventoryError, load_valkey_inventory, valkey_url_from_env,
    },
};
use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
};
use serde::Serialize;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct DatabaseManagerState {
    registry: Arc<DatabaseManagerRegistry>,
}

impl DatabaseManagerState {
    pub fn new(registry: DatabaseManagerRegistry) -> Self {
        Self {
            registry: Arc::new(registry),
        }
    }
}

impl Default for DatabaseManagerState {
    fn default() -> Self {
        Self::new(DatabaseManagerRegistry::new())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseManagerApiError {
    pub code: &'static str,
    pub message: String,
}

pub fn router() -> Router {
    Router::new()
        .route("/readyz", get(readyz_handler))
        .route("/api/database-manager/readyz", get(readyz_handler))
        .route("/api/database-manager/manifest", get(manifest_handler))
        .route("/api/database-manager/engines", get(engines_handler))
        .route(
            "/api/database-manager/engines/{engine_id}",
            get(engine_handler),
        )
        .route(
            "/api/database-manager/postgresql/inventory",
            get(postgres_inventory_handler),
        )
        .route(
            "/api/database-manager/clickhouse/inventory",
            get(clickhouse_inventory_handler),
        )
        .route(
            "/api/database-manager/valkey/inventory",
            get(valkey_inventory_handler),
        )
        .route(
            "/api/database-manager/qdrant/inventory",
            get(qdrant_inventory_handler),
        )
        .route(
            "/api/database-manager/nats-jetstream/inventory",
            get(nats_inventory_handler),
        )
        .route(
            "/api/database-manager/s3/inventory",
            get(s3_inventory_handler),
        )
        .with_state(DatabaseManagerState::default())
}

async fn readyz_handler(State(state): State<DatabaseManagerState>) -> impl IntoResponse {
    Json(state.registry.readiness())
}

async fn manifest_handler(
    State(state): State<DatabaseManagerState>,
) -> Json<DatabaseManagerManifest> {
    Json(state.registry.manifest())
}

async fn engines_handler(
    State(state): State<DatabaseManagerState>,
) -> Json<Vec<DatabaseEngineProfile>> {
    Json(state.registry.list().into_iter().cloned().collect())
}

async fn engine_handler(
    State(state): State<DatabaseManagerState>,
    Path(engine_id): Path<String>,
) -> Result<Json<DatabaseEngineProfile>, (StatusCode, Json<DatabaseManagerApiError>)> {
    state
        .registry
        .get(&engine_id)
        .cloned()
        .map(Json)
        .map_err(|err| {
            (
                StatusCode::NOT_FOUND,
                Json(DatabaseManagerApiError {
                    code: "database_engine_not_found",
                    message: err.to_string(),
                }),
            )
        })
}

async fn postgres_inventory_handler()
-> Result<Json<PostgresInventory>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let database_url = database_url_from_env().map_err(postgres_inventory_error_response)?;
    let source = redact_database_url(&database_url);
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await
        .map_err(|err| postgres_inventory_error_response(PostgresInventoryError::Query(err)))?;
    let inventory = load_postgres_inventory(&pool, source)
        .await
        .map_err(postgres_inventory_error_response)?;
    Ok(Json(inventory))
}

fn postgres_inventory_error_response(
    err: PostgresInventoryError,
) -> (StatusCode, Json<DatabaseManagerApiError>) {
    let code = match err {
        PostgresInventoryError::NotConfigured => "postgres_inventory_not_configured",
        PostgresInventoryError::Query(_) => "postgres_inventory_unavailable",
    };
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(DatabaseManagerApiError {
            code,
            message: err.to_string(),
        }),
    )
}

async fn clickhouse_inventory_handler()
-> Result<Json<ClickHouseInventory>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let config = ClickHouseConfig::from_env().map_err(clickhouse_inventory_error_response)?;
    let client = reqwest::Client::new();
    let inventory = load_clickhouse_inventory(&client, &config)
        .await
        .map_err(clickhouse_inventory_error_response)?;
    Ok(Json(inventory))
}

fn clickhouse_inventory_error_response(
    err: ClickHouseInventoryError,
) -> (StatusCode, Json<DatabaseManagerApiError>) {
    let code = match err {
        ClickHouseInventoryError::NotConfigured => "clickhouse_inventory_not_configured",
        ClickHouseInventoryError::Request(_) => "clickhouse_inventory_unavailable",
        ClickHouseInventoryError::RowParse(_) => "clickhouse_inventory_parse_failed",
    };
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(DatabaseManagerApiError {
            code,
            message: err.to_string(),
        }),
    )
}

async fn valkey_inventory_handler()
-> Result<Json<ValkeyInventory>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let url = valkey_url_from_env().map_err(valkey_inventory_error_response)?;
    let inventory = load_valkey_inventory(&url)
        .await
        .map_err(valkey_inventory_error_response)?;
    Ok(Json(inventory))
}

fn valkey_inventory_error_response(
    err: ValkeyInventoryError,
) -> (StatusCode, Json<DatabaseManagerApiError>) {
    let code = match err {
        ValkeyInventoryError::NotConfigured => "valkey_inventory_not_configured",
        ValkeyInventoryError::Query(_) => "valkey_inventory_unavailable",
        ValkeyInventoryError::Parse(_) => "valkey_inventory_parse_failed",
    };
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(DatabaseManagerApiError {
            code,
            message: err.to_string(),
        }),
    )
}

async fn qdrant_inventory_handler()
-> Result<Json<QdrantInventory>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let url = qdrant_url_from_env().map_err(qdrant_inventory_error_response)?;
    let client = reqwest::Client::new();
    let inventory = load_qdrant_inventory(&client, &url)
        .await
        .map_err(qdrant_inventory_error_response)?;
    Ok(Json(inventory))
}

fn qdrant_inventory_error_response(
    err: QdrantInventoryError,
) -> (StatusCode, Json<DatabaseManagerApiError>) {
    let code = match err {
        QdrantInventoryError::NotConfigured => "qdrant_inventory_not_configured",
        QdrantInventoryError::Request(_) => "qdrant_inventory_unavailable",
    };
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(DatabaseManagerApiError {
            code,
            message: err.to_string(),
        }),
    )
}

async fn nats_inventory_handler()
-> Result<Json<NatsInventory>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let url = nats_monitor_url_from_env().map_err(nats_inventory_error_response)?;
    let client = reqwest::Client::new();
    let inventory = load_nats_inventory(&client, &url)
        .await
        .map_err(nats_inventory_error_response)?;
    Ok(Json(inventory))
}

fn nats_inventory_error_response(
    err: NatsInventoryError,
) -> (StatusCode, Json<DatabaseManagerApiError>) {
    let code = match err {
        NatsInventoryError::NotConfigured => "nats_inventory_not_configured",
        NatsInventoryError::Request(_) => "nats_inventory_unavailable",
    };
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(DatabaseManagerApiError {
            code,
            message: err.to_string(),
        }),
    )
}

async fn s3_inventory_handler()
-> Result<Json<S3Inventory>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let config = S3InventoryConfig::from_env().map_err(s3_inventory_error_response)?;
    let client = reqwest::Client::new();
    let inventory = load_s3_inventory(&client, &config)
        .await
        .map_err(s3_inventory_error_response)?;
    Ok(Json(inventory))
}

fn s3_inventory_error_response(
    err: S3InventoryError,
) -> (StatusCode, Json<DatabaseManagerApiError>) {
    let code = match err {
        S3InventoryError::NotConfigured => "s3_inventory_not_configured",
        S3InventoryError::Request(_) => "s3_inventory_unavailable",
        S3InventoryError::Xml(_) => "s3_inventory_parse_failed",
    };
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(DatabaseManagerApiError {
            code,
            message: err.to_string(),
        }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_state_uses_apache2_manifest() {
        let state = DatabaseManagerState::default();
        let manifest = state.registry.manifest();

        assert_eq!(manifest.license, "Apache-2.0");
        assert_eq!(manifest.implementation, "rust-core");
    }

    #[test]
    fn router_exposes_database_manager_api() {
        let _router = router();
    }
}
