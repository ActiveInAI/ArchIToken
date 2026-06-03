// License: Apache-2.0

use serde::Serialize;
use thiserror::Error;

pub const VALKEY_INVENTORY_URL_ENV: &str = "ARCHITOKEN_DB_MANAGER_VALKEY_URL";

#[derive(Debug, Error)]
pub enum ValkeyInventoryError {
    #[error("valkey inventory source is not configured")]
    NotConfigured,
    #[error("valkey inventory query failed: {0}")]
    Query(#[from] redis::RedisError),
    #[error("valkey inventory parse failed: {0}")]
    Parse(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValkeyInventory {
    pub engine: &'static str,
    pub source: String,
    pub total_keys: i64,
    pub databases: Vec<ValkeyDatabase>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValkeyDatabase {
    pub database: String,
    pub keys: i64,
    pub expires: i64,
    pub avg_ttl: i64,
}

pub async fn load_valkey_inventory(url: &str) -> Result<ValkeyInventory, ValkeyInventoryError> {
    let client = redis::Client::open(url)?;
    let mut connection = client.get_multiplexed_async_connection().await?;
    let info: String = redis::cmd("INFO")
        .arg("keyspace")
        .query_async(&mut connection)
        .await?;
    let total_keys: i64 = redis::cmd("DBSIZE").query_async(&mut connection).await?;
    Ok(ValkeyInventory {
        engine: "valkey",
        source: redact_valkey_url(url),
        total_keys,
        databases: parse_valkey_keyspace_info(&info)?,
    })
}

pub fn valkey_url_from_env() -> Result<String, ValkeyInventoryError> {
    std::env::var(VALKEY_INVENTORY_URL_ENV)
        .or_else(|_| std::env::var("ARCHITOKEN_CACHE__URL"))
        .or_else(|_| std::env::var("VALKEY_URL"))
        .or_else(|_| std::env::var("REDIS_URL"))
        .map_err(|_| ValkeyInventoryError::NotConfigured)
}

pub fn parse_valkey_keyspace_info(info: &str) -> Result<Vec<ValkeyDatabase>, ValkeyInventoryError> {
    let mut databases = Vec::new();
    for line in info.lines().map(str::trim) {
        if !line.starts_with("db") {
            continue;
        }
        let Some((database, metrics)) = line.split_once(':') else {
            return Err(ValkeyInventoryError::Parse(format!(
                "missing keyspace separator in {line}"
            )));
        };
        let mut keys = 0;
        let mut expires = 0;
        let mut avg_ttl = 0;
        for metric in metrics.split(',') {
            let Some((name, value)) = metric.split_once('=') else {
                continue;
            };
            let parsed = value
                .parse::<i64>()
                .map_err(|err| ValkeyInventoryError::Parse(format!("{database}.{name}: {err}")))?;
            match name {
                "keys" => keys = parsed,
                "expires" => expires = parsed,
                "avg_ttl" => avg_ttl = parsed,
                _ => {}
            }
        }
        databases.push(ValkeyDatabase {
            database: database.to_owned(),
            keys,
            expires,
            avg_ttl,
        });
    }
    Ok(databases)
}

pub fn redact_valkey_url(url: &str) -> String {
    let Some((scheme, rest)) = url.split_once("://") else {
        return "configured".to_owned();
    };
    let Some((_, host_and_path)) = rest.rsplit_once('@') else {
        return url.to_owned();
    };
    format!("{scheme}://***@{host_and_path}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valkey_keyspace_info_reads_db_metrics() {
        let databases =
            parse_valkey_keyspace_info("# Keyspace\r\ndb0:keys=12,expires=2,avg_ttl=1000\r\n")
                .expect("keyspace parses");

        assert_eq!(
            databases,
            vec![ValkeyDatabase {
                database: "db0".to_owned(),
                keys: 12,
                expires: 2,
                avg_ttl: 1000
            }]
        );
    }

    #[test]
    fn redact_valkey_url_removes_credentials() {
        let redacted = redact_valkey_url("redis://:secret@127.0.0.1:6381/0");

        assert_eq!(redacted, "redis://***@127.0.0.1:6381/0");
        assert!(!redacted.contains("secret"));
    }
}
