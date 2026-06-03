// License: Apache-2.0

use crate::{
    clickhouse_inventory::{ClickHouseConfig, load_clickhouse_inventory},
    nats_inventory::{load_nats_inventory, nats_monitor_url_from_env},
    postgres_inventory::{database_url_from_env, load_postgres_inventory, redact_database_url},
    qdrant_inventory::{load_qdrant_inventory, qdrant_url_from_env},
    s3_inventory::{S3InventoryConfig, load_s3_inventory},
    valkey_inventory::{load_valkey_inventory, valkey_url_from_env},
};
use serde::Serialize;
use serde_json::{Value, json};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseInventoryStatus {
    Live,
    NotConfigured,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseInventoryItem {
    pub engine: &'static str,
    pub status: DatabaseInventoryStatus,
    pub source: Option<String>,
    pub summary: Value,
    pub data: Option<Value>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseManagerInventory {
    pub generated_at_unix_ms: u128,
    pub status: &'static str,
    pub item_count: usize,
    pub live_count: usize,
    pub unavailable_count: usize,
    pub items: Vec<DatabaseInventoryItem>,
}

pub async fn load_database_manager_inventory() -> DatabaseManagerInventory {
    let (postgres, clickhouse, valkey, qdrant, nats_jetstream, s3_compatible) = tokio::join!(
        load_postgres_item(),
        load_clickhouse_item(),
        load_valkey_item(),
        load_qdrant_item(),
        load_nats_item(),
        load_s3_item()
    );
    let items = vec![
        postgres,
        clickhouse,
        valkey,
        qdrant,
        nats_jetstream,
        s3_compatible,
    ];
    let live_count = items
        .iter()
        .filter(|item| item.status == DatabaseInventoryStatus::Live)
        .count();
    let unavailable_count = items
        .iter()
        .filter(|item| item.status == DatabaseInventoryStatus::Unavailable)
        .count();
    DatabaseManagerInventory {
        generated_at_unix_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or_default(),
        status: if unavailable_count == 0 {
            "ready"
        } else {
            "degraded"
        },
        item_count: items.len(),
        live_count,
        unavailable_count,
        items,
    }
}

async fn load_postgres_item() -> DatabaseInventoryItem {
    let database_url = match database_url_from_env() {
        Ok(value) => value,
        Err(err) => return not_configured("postgresql", err.to_string()),
    };
    let source = redact_database_url(&database_url);
    let pool = match sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await
    {
        Ok(value) => value,
        Err(err) => return unavailable("postgresql", Some(source), err.to_string()),
    };
    match load_postgres_inventory(&pool, source.clone()).await {
        Ok(inventory) => live(
            "postgresql",
            Some(source),
            json!({
                "tables": inventory.table_count,
                "columns": inventory.column_count,
                "indexes": inventory.index_count,
            }),
            inventory,
        ),
        Err(err) => unavailable("postgresql", Some(source), err.to_string()),
    }
}

async fn load_clickhouse_item() -> DatabaseInventoryItem {
    let config = match ClickHouseConfig::from_env() {
        Ok(value) => value,
        Err(err) => return not_configured("clickhouse", err.to_string()),
    };
    let source = config.redacted_source();
    let client = reqwest::Client::new();
    match load_clickhouse_inventory(&client, &config).await {
        Ok(inventory) => live(
            "clickhouse",
            Some(source),
            json!({
                "tables": inventory.table_count,
                "rows": inventory.total_rows,
                "bytes": inventory.total_bytes,
            }),
            inventory,
        ),
        Err(err) => unavailable("clickhouse", Some(source), err.to_string()),
    }
}

async fn load_valkey_item() -> DatabaseInventoryItem {
    let url = match valkey_url_from_env() {
        Ok(value) => value,
        Err(err) => return not_configured("valkey", err.to_string()),
    };
    match load_valkey_inventory(&url).await {
        Ok(inventory) => live(
            "valkey",
            Some(inventory.source.clone()),
            json!({
                "keys": inventory.total_keys,
                "databases": inventory.databases.len(),
            }),
            inventory,
        ),
        Err(err) => unavailable("valkey", None, err.to_string()),
    }
}

async fn load_qdrant_item() -> DatabaseInventoryItem {
    let url = match qdrant_url_from_env() {
        Ok(value) => value,
        Err(err) => return not_configured("qdrant", err.to_string()),
    };
    let client = reqwest::Client::new();
    match load_qdrant_inventory(&client, &url).await {
        Ok(inventory) => live(
            "qdrant",
            Some(inventory.source.clone()),
            json!({
                "collections": inventory.collection_count,
                "status": inventory.status,
            }),
            inventory,
        ),
        Err(err) => unavailable("qdrant", Some(url), err.to_string()),
    }
}

async fn load_nats_item() -> DatabaseInventoryItem {
    let url = match nats_monitor_url_from_env() {
        Ok(value) => value,
        Err(err) => return not_configured("nats_jetstream", err.to_string()),
    };
    let client = reqwest::Client::new();
    match load_nats_inventory(&client, &url).await {
        Ok(inventory) => live(
            "nats_jetstream",
            Some(inventory.source.clone()),
            json!({
                "streams": inventory.streams,
                "consumers": inventory.consumers,
                "messages": inventory.messages,
                "bytes": inventory.bytes,
            }),
            inventory,
        ),
        Err(err) => unavailable("nats_jetstream", Some(url), err.to_string()),
    }
}

async fn load_s3_item() -> DatabaseInventoryItem {
    let config = match S3InventoryConfig::from_env() {
        Ok(value) => value,
        Err(err) => return not_configured("s3_compatible", err.to_string()),
    };
    let client = reqwest::Client::new();
    match load_s3_inventory(&client, &config).await {
        Ok(inventory) => live(
            "s3_compatible",
            Some(inventory.source.clone()),
            json!({
                "bucket": inventory.bucket,
                "objects": inventory.object_count,
                "bytes": inventory.total_bytes,
                "truncated": inventory.is_truncated,
            }),
            inventory,
        ),
        Err(err) => unavailable("s3_compatible", Some(config.endpoint), err.to_string()),
    }
}

fn live<T: Serialize>(
    engine: &'static str,
    source: Option<String>,
    summary: Value,
    data: T,
) -> DatabaseInventoryItem {
    DatabaseInventoryItem {
        engine,
        status: DatabaseInventoryStatus::Live,
        source,
        summary,
        data: Some(serde_json::to_value(data).unwrap_or_else(|_| json!({}))),
        error: None,
    }
}

fn not_configured(engine: &'static str, message: String) -> DatabaseInventoryItem {
    DatabaseInventoryItem {
        engine,
        status: DatabaseInventoryStatus::NotConfigured,
        source: None,
        summary: json!({}),
        data: None,
        error: Some(message),
    }
}

fn unavailable(
    engine: &'static str,
    source: Option<String>,
    message: String,
) -> DatabaseInventoryItem {
    DatabaseInventoryItem {
        engine,
        status: DatabaseInventoryStatus::Unavailable,
        source,
        summary: json!({}),
        data: None,
        error: Some(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn not_configured_item_keeps_engine_and_error() {
        let item = not_configured("postgresql", "missing env".to_owned());

        assert_eq!(item.engine, "postgresql");
        assert_eq!(item.status, DatabaseInventoryStatus::NotConfigured);
        assert_eq!(item.error.as_deref(), Some("missing env"));
    }

    #[test]
    fn live_item_serializes_summary_and_data() {
        let item = live(
            "valkey",
            Some("redis://127.0.0.1:6381".to_owned()),
            json!({ "keys": 0 }),
            json!({ "engine": "valkey", "totalKeys": 0 }),
        );

        assert_eq!(item.status, DatabaseInventoryStatus::Live);
        assert_eq!(item.summary["keys"], 0);
        assert_eq!(item.data.expect("data exists")["engine"], "valkey");
    }
}
