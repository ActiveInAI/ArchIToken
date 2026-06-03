// License: Apache-2.0

use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const NATS_INVENTORY_URL_ENV: &str = "ARCHITOKEN_DB_MANAGER_NATS_MONITOR_URL";

#[derive(Debug, Error)]
pub enum NatsInventoryError {
    #[error("nats monitor source is not configured")]
    NotConfigured,
    #[error("nats inventory request failed: {0}")]
    Request(#[from] reqwest::Error),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NatsInventory {
    pub engine: &'static str,
    pub source: String,
    pub server_id: String,
    pub accounts: u64,
    pub streams: u64,
    pub consumers: u64,
    pub messages: u64,
    pub bytes: u64,
}

#[derive(Debug, Deserialize)]
struct NatsJszResponse {
    server_id: String,
    accounts: u64,
    streams: u64,
    consumers: u64,
    messages: u64,
    bytes: u64,
}

pub async fn load_nats_inventory(
    client: &Client,
    base_url: &str,
) -> Result<NatsInventory, NatsInventoryError> {
    let endpoint = format!(
        "{}/jsz?streams=true&consumers=true",
        base_url.trim_end_matches('/')
    );
    let response = client
        .get(endpoint)
        .send()
        .await?
        .error_for_status()?
        .json::<NatsJszResponse>()
        .await?;
    Ok(NatsInventory {
        engine: "nats_jetstream",
        source: redact_nats_url(base_url),
        server_id: response.server_id,
        accounts: response.accounts,
        streams: response.streams,
        consumers: response.consumers,
        messages: response.messages,
        bytes: response.bytes,
    })
}

pub fn nats_monitor_url_from_env() -> Result<String, NatsInventoryError> {
    std::env::var(NATS_INVENTORY_URL_ENV)
        .or_else(|_| std::env::var("NATS_MONITOR_URL"))
        .or_else(|_| std::env::var("ARCHITOKEN_EVENTS__MONITOR_URL"))
        .map_err(|_| NatsInventoryError::NotConfigured)
}

pub fn redact_nats_url(url: &str) -> String {
    let Some((scheme, rest)) = url.split_once("://") else {
        return "configured".to_owned();
    };
    let Some((_, host_and_path)) = rest.rsplit_once('@') else {
        return url.trim_end_matches('/').to_owned();
    };
    format!("{scheme}://***@{}", host_and_path.trim_end_matches('/'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nats_jsz_contract_deserializes() {
        let response: NatsJszResponse = serde_json::from_str(
            r#"{"server_id":"NATS","accounts":1,"streams":2,"consumers":3,"messages":4,"bytes":5}"#,
        )
        .expect("jsz response parses");

        assert_eq!(response.streams, 2);
        assert_eq!(response.consumers, 3);
    }

    #[test]
    fn redact_nats_url_removes_credentials() {
        let redacted = redact_nats_url("http://user:secret@127.0.0.1:8222/");

        assert_eq!(redacted, "http://***@127.0.0.1:8222");
        assert!(!redacted.contains("secret"));
    }
}
