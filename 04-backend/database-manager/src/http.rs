// License: Apache-2.0

use crate::{
    DatabaseEngineProfile, DatabaseManagerManifest, DatabaseManagerRegistry,
    clickhouse_inventory::{
        ClickHouseConfig, ClickHouseInventory, ClickHouseInventoryError, load_clickhouse_inventory,
    },
    graph_sidecar::{
        GraphSidecarError, GraphSidecarHealth, graph_sidecar_url_from_env,
        load_graph_sidecar_health,
    },
    heavy_steel_program::{
        HeavySteelDatabaseBridge, HeavySteelModuleOperationRequest, HeavySteelModuleOperationRun,
        HeavySteelProgramCatalog, HeavySteelProgramError, create_heavy_steel_module_operation,
        load_heavy_steel_database_bridge, load_heavy_steel_program_catalog,
    },
    inventory::{DatabaseManagerInventory, load_database_manager_inventory},
    nats_inventory::{
        NatsInventory, NatsInventoryError, load_nats_inventory, nats_monitor_url_from_env,
    },
    postgres_crud::{
        PostgresCreateRowRequest, PostgresCrudError, PostgresCrudTable, PostgresDeleteRowRequest,
        PostgresMutationResponse, PostgresRowsQuery, PostgresRowsResponse,
        PostgresUpdateRowRequest, create_postgres_row, delete_postgres_row,
        list_postgres_crud_tables, read_postgres_rows, update_postgres_row,
    },
    postgres_inventory::{
        PostgresInventory, PostgresInventoryError, database_url_from_env, load_postgres_inventory,
        redact_database_url,
    },
    postgres_schema::{PostgresSchemaError, PostgresSchemaGraph, load_postgres_schema_graph},
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
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
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
        .route(
            "/api/database-manager/inventory",
            get(database_manager_inventory_handler),
        )
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
            "/api/database-manager/postgresql/crud/tables",
            get(postgres_crud_tables_handler),
        )
        .route(
            "/api/database-manager/postgresql/schema/graph",
            get(postgres_schema_graph_handler),
        )
        .route(
            "/api/database-manager/postgresql/crud/rows",
            get(postgres_rows_handler)
                .post(postgres_create_row_handler)
                .patch(postgres_update_row_handler)
                .delete(postgres_delete_row_handler),
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
        .route(
            "/api/database-manager/graph-sidecar/health",
            get(graph_sidecar_health_handler),
        )
        .route(
            "/api/database-manager/business/heavy-steel/program",
            get(heavy_steel_program_handler),
        )
        .route(
            "/api/database-manager/business/heavy-steel/database-bridge",
            get(heavy_steel_database_bridge_handler),
        )
        .route(
            "/api/database-manager/business/heavy-steel/module-operations",
            post(heavy_steel_module_operation_handler),
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

async fn database_manager_inventory_handler() -> Json<DatabaseManagerInventory> {
    Json(load_database_manager_inventory().await)
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
    let (pool, source) = postgres_pool()
        .await
        .map_err(postgres_inventory_error_response)?;
    let inventory = load_postgres_inventory(&pool, source)
        .await
        .map_err(postgres_inventory_error_response)?;
    Ok(Json(inventory))
}

async fn postgres_pool() -> Result<(sqlx::PgPool, String), PostgresInventoryError> {
    let database_url = database_url_from_env()?;
    let source = redact_database_url(&database_url);
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await
        .map_err(PostgresInventoryError::Query)?;
    Ok((pool, source))
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

async fn postgres_crud_tables_handler()
-> Result<Json<Vec<PostgresCrudTable>>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let (pool, _) = postgres_pool()
        .await
        .map_err(postgres_inventory_error_response)?;
    let tables = list_postgres_crud_tables(&pool)
        .await
        .map_err(postgres_crud_error_response)?;
    Ok(Json(tables))
}

async fn postgres_schema_graph_handler()
-> Result<Json<PostgresSchemaGraph>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let (pool, source) = postgres_pool()
        .await
        .map_err(postgres_inventory_error_response)?;
    let graph = load_postgres_schema_graph(&pool, source)
        .await
        .map_err(postgres_schema_error_response)?;
    Ok(Json(graph))
}

async fn postgres_rows_handler(
    Query(query): Query<PostgresRowsQuery>,
) -> Result<Json<PostgresRowsResponse>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let (pool, _) = postgres_pool()
        .await
        .map_err(postgres_inventory_error_response)?;
    let rows = read_postgres_rows(&pool, query)
        .await
        .map_err(postgres_crud_error_response)?;
    Ok(Json(rows))
}

async fn postgres_create_row_handler(
    Json(request): Json<PostgresCreateRowRequest>,
) -> Result<Json<PostgresMutationResponse>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let (pool, _) = postgres_pool()
        .await
        .map_err(postgres_inventory_error_response)?;
    let response = create_postgres_row(&pool, request)
        .await
        .map_err(postgres_crud_error_response)?;
    Ok(Json(response))
}

async fn postgres_update_row_handler(
    Json(request): Json<PostgresUpdateRowRequest>,
) -> Result<Json<PostgresMutationResponse>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let (pool, _) = postgres_pool()
        .await
        .map_err(postgres_inventory_error_response)?;
    let response = update_postgres_row(&pool, request)
        .await
        .map_err(postgres_crud_error_response)?;
    Ok(Json(response))
}

async fn postgres_delete_row_handler(
    Json(request): Json<PostgresDeleteRowRequest>,
) -> Result<Json<PostgresMutationResponse>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let (pool, _) = postgres_pool()
        .await
        .map_err(postgres_inventory_error_response)?;
    let response = delete_postgres_row(&pool, request)
        .await
        .map_err(postgres_crud_error_response)?;
    Ok(Json(response))
}

fn postgres_crud_error_response(
    err: PostgresCrudError,
) -> (StatusCode, Json<DatabaseManagerApiError>) {
    let code = match err {
        PostgresCrudError::InvalidIdentifier(_) => "postgres_crud_invalid_identifier",
        PostgresCrudError::InvalidPayload(_) => "postgres_crud_invalid_payload",
        PostgresCrudError::Query(_) => "postgres_crud_query_failed",
        PostgresCrudError::Json(_) => "postgres_crud_json_failed",
    };
    let status = match err {
        PostgresCrudError::InvalidIdentifier(_) | PostgresCrudError::InvalidPayload(_) => {
            StatusCode::BAD_REQUEST
        }
        PostgresCrudError::Query(_) | PostgresCrudError::Json(_) => {
            StatusCode::INTERNAL_SERVER_ERROR
        }
    };
    (
        status,
        Json(DatabaseManagerApiError {
            code,
            message: err.to_string(),
        }),
    )
}

fn postgres_schema_error_response(
    err: PostgresSchemaError,
) -> (StatusCode, Json<DatabaseManagerApiError>) {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(DatabaseManagerApiError {
            code: "postgres_schema_graph_unavailable",
            message: err.to_string(),
        }),
    )
}

async fn heavy_steel_program_handler()
-> Result<Json<HeavySteelProgramCatalog>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let (pool, source) = postgres_pool()
        .await
        .map_err(postgres_inventory_error_response)?;
    let catalog = load_heavy_steel_program_catalog(&pool, source)
        .await
        .map_err(heavy_steel_program_error_response)?;
    Ok(Json(catalog))
}

async fn heavy_steel_database_bridge_handler()
-> Result<Json<HeavySteelDatabaseBridge>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let (pool, source) = postgres_pool()
        .await
        .map_err(postgres_inventory_error_response)?;
    let bridge = load_heavy_steel_database_bridge(&pool, source)
        .await
        .map_err(heavy_steel_program_error_response)?;
    Ok(Json(bridge))
}

async fn heavy_steel_module_operation_handler(
    Json(request): Json<HeavySteelModuleOperationRequest>,
) -> Result<Json<HeavySteelModuleOperationRun>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let (pool, _) = postgres_pool()
        .await
        .map_err(postgres_inventory_error_response)?;
    let run = create_heavy_steel_module_operation(&pool, request)
        .await
        .map_err(heavy_steel_program_error_response)?;
    Ok(Json(run))
}

async fn graph_sidecar_health_handler()
-> Result<Json<GraphSidecarHealth>, (StatusCode, Json<DatabaseManagerApiError>)> {
    let url = graph_sidecar_url_from_env().map_err(graph_sidecar_error_response)?;
    let client = reqwest::Client::new();
    let health = load_graph_sidecar_health(&client, &url)
        .await
        .map_err(graph_sidecar_error_response)?;
    Ok(Json(health))
}

fn graph_sidecar_error_response(
    err: GraphSidecarError,
) -> (StatusCode, Json<DatabaseManagerApiError>) {
    let code = match err {
        GraphSidecarError::NotConfigured => "graph_sidecar_not_configured",
        GraphSidecarError::Request(_) => "graph_sidecar_unavailable",
        GraphSidecarError::Query(_) => "graph_sidecar_query_failed",
        GraphSidecarError::InvalidInput(_) => "graph_sidecar_invalid_input",
    };
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(DatabaseManagerApiError {
            code,
            message: err.to_string(),
        }),
    )
}

fn heavy_steel_program_error_response(
    err: HeavySteelProgramError,
) -> (StatusCode, Json<DatabaseManagerApiError>) {
    let (status, code) = match &err {
        HeavySteelProgramError::InvalidInput(_) => {
            (StatusCode::BAD_REQUEST, "heavy_steel_program_invalid_input")
        }
        HeavySteelProgramError::Query(_) => (
            StatusCode::SERVICE_UNAVAILABLE,
            "heavy_steel_program_unavailable",
        ),
    };
    (
        status,
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
