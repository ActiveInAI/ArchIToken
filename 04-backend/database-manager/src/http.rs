// License: Apache-2.0

use crate::{
    DatabaseEngineProfile, DatabaseManagerManifest, DatabaseManagerRegistry,
    clickhouse_inventory::{
        ClickHouseConfig, ClickHouseInventory, ClickHouseInventoryError, load_clickhouse_inventory,
    },
    postgres_inventory::{
        PostgresInventory, PostgresInventoryError, database_url_from_env, load_postgres_inventory,
        redact_database_url,
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
