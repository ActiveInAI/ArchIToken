// License: Apache-2.0

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

pub const CLICKHOUSE_INVENTORY_URL_ENV: &str = "ARCHITOKEN_DB_MANAGER_CLICKHOUSE_URL";

const INVENTORY_SQL: &str = r#"
SELECT
    database,
    name,
    engine,
    total_rows,
    total_bytes
FROM system.tables
WHERE database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')
ORDER BY database, name
FORMAT JSONEachRow
"#;

#[derive(Debug, Error)]
pub enum ClickHouseInventoryError {
    #[error("clickhouse inventory source is not configured")]
    NotConfigured,
    #[error("clickhouse inventory request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("clickhouse inventory row parse failed: {0}")]
    RowParse(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClickHouseConfig {
    pub base_url: String,
    pub user: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClickHouseInventory {
    pub engine: &'static str,
    pub source: String,
    pub table_count: usize,
    pub total_rows: i64,
    pub total_bytes: i64,
    pub tables: Vec<ClickHouseTable>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClickHouseTable {
    pub database: String,
    pub name: String,
    pub engine: String,
    pub total_rows: i64,
    pub total_bytes: i64,
}

#[derive(Debug, Deserialize)]
struct RawClickHouseTable {
    database: String,
    name: String,
    engine: String,
    total_rows: Value,
    total_bytes: Value,
}

impl ClickHouseConfig {
    pub fn from_env() -> Result<Self, ClickHouseInventoryError> {
        let base_url = std::env::var(CLICKHOUSE_INVENTORY_URL_ENV)
            .or_else(|_| std::env::var("CLICKHOUSE_URL"))
            .or_else(|_| std::env::var("ARCHITOKEN_TIMESERIES__URL"))
            .or_else(|_| std::env::var("ARCHITOKEN_TIME_SERIES__URL"))
            .or_else(|_| std::env::var("ARCHITOKEN_ANALYTICS__URL"))
            .map_err(|_| ClickHouseInventoryError::NotConfigured)?;
        let user = std::env::var("CLICKHOUSE_USER")
            .ok()
            .filter(|value| !value.trim().is_empty());
        let password = std::env::var("CLICKHOUSE_PASSWORD")
            .ok()
            .filter(|value| !value.trim().is_empty());
        Ok(Self {
            base_url,
            user,
            password,
        })
    }

    pub fn redacted_source(&self) -> String {
        redact_clickhouse_url(&self.base_url)
    }
}

pub async fn load_clickhouse_inventory(
    client: &Client,
    config: &ClickHouseConfig,
) -> Result<ClickHouseInventory, ClickHouseInventoryError> {
    let mut request = client.post(&config.base_url).body(INVENTORY_SQL);
    if let Some(user) = config.user.as_deref() {
        request = request.basic_auth(user, config.password.as_deref());
    }
    let body = request.send().await?.error_for_status()?.text().await?;
    parse_clickhouse_inventory(&body, config.redacted_source())
}

pub fn parse_clickhouse_inventory(
    body: &str,
    source: String,
) -> Result<ClickHouseInventory, ClickHouseInventoryError> {
    let mut tables = Vec::new();
    for line in body.lines().filter(|line| !line.trim().is_empty()) {
        let raw: RawClickHouseTable = serde_json::from_str(line)
            .map_err(|err| ClickHouseInventoryError::RowParse(err.to_string()))?;
        tables.push(ClickHouseTable {
            database: raw.database,
            name: raw.name,
            engine: raw.engine,
            total_rows: value_to_i64("total_rows", raw.total_rows)?,
            total_bytes: value_to_i64("total_bytes", raw.total_bytes)?,
        });
    }
    let total_rows = tables.iter().map(|table| table.total_rows).sum();
    let total_bytes = tables.iter().map(|table| table.total_bytes).sum();
    Ok(ClickHouseInventory {
        engine: "clickhouse",
        source,
        table_count: tables.len(),
        total_rows,
        total_bytes,
        tables,
    })
}

pub fn redact_clickhouse_url(database_url: &str) -> String {
    let Some((scheme, rest)) = database_url.split_once("://") else {
        return "configured".to_owned();
    };
    let Some((_, host_and_path)) = rest.rsplit_once('@') else {
        return database_url.trim_end_matches('/').to_owned();
    };
    format!("{scheme}://***@{}", host_and_path.trim_end_matches('/'))
}

fn value_to_i64(field: &'static str, value: Value) -> Result<i64, ClickHouseInventoryError> {
    match value {
        Value::Null => Ok(0),
        Value::Number(number) => number
            .as_i64()
            .ok_or_else(|| ClickHouseInventoryError::RowParse(format!("{field} is not an i64"))),
        Value::String(text) => text
            .parse::<i64>()
            .map_err(|err| ClickHouseInventoryError::RowParse(format!("{field}: {err}"))),
        other => Err(ClickHouseInventoryError::RowParse(format!(
            "{field} has unsupported JSON type {other}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_clickhouse_inventory_accepts_json_each_row_numbers_as_strings() {
        let inventory = parse_clickhouse_inventory(
            r#"{"database":"architoken","name":"data_analytics_events","engine":"MergeTree","total_rows":"4","total_bytes":"1404"}
{"database":"architoken","name":"data_timeseries_points","engine":"MergeTree","total_rows":"5","total_bytes":"1644"}"#,
            "http://127.0.0.1:8123".to_owned(),
        )
        .expect("inventory parses");

        assert_eq!(inventory.engine, "clickhouse");
        assert_eq!(inventory.table_count, 2);
        assert_eq!(inventory.total_rows, 9);
        assert_eq!(inventory.total_bytes, 3048);
    }

    #[test]
    fn redact_clickhouse_url_removes_credentials() {
        let redacted = redact_clickhouse_url("http://user:secret@127.0.0.1:8123/");

        assert_eq!(redacted, "http://***@127.0.0.1:8123");
        assert!(!redacted.contains("secret"));
        assert!(!redacted.contains("user:"));
    }
}
