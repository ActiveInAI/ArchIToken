// License: Apache-2.0

use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const QDRANT_INVENTORY_URL_ENV: &str = "ARCHITOKEN_DB_MANAGER_QDRANT_URL";

#[derive(Debug, Error)]
pub enum QdrantInventoryError {
    #[error("qdrant inventory source is not configured")]
    NotConfigured,
    #[error("qdrant inventory request failed: {0}")]
    Request(#[from] reqwest::Error),
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QdrantInventory {
    pub engine: &'static str,
    pub source: String,
    pub status: String,
    pub collection_count: usize,
    pub query_time_seconds: f64,
    pub collections: Vec<QdrantCollection>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QdrantCollection {
    pub name: String,
}

#[derive(Debug, Deserialize)]
struct QdrantCollectionsResponse {
    result: QdrantCollectionsResult,
    status: String,
    time: f64,
}

#[derive(Debug, Deserialize)]
struct QdrantCollectionsResult {
    collections: Vec<QdrantCollection>,
}

pub async fn load_qdrant_inventory(
    client: &Client,
    base_url: &str,
) -> Result<QdrantInventory, QdrantInventoryError> {
    let endpoint = format!("{}/collections", base_url.trim_end_matches('/'));
    let response = client
        .get(endpoint)
        .send()
        .await?
        .error_for_status()?
        .json::<QdrantCollectionsResponse>()
        .await?;
    Ok(QdrantInventory {
        engine: "qdrant",
        source: redact_qdrant_url(base_url),
        status: response.status,
        collection_count: response.result.collections.len(),
        query_time_seconds: response.time,
        collections: response.result.collections,
    })
}

pub fn qdrant_url_from_env() -> Result<String, QdrantInventoryError> {
    std::env::var(QDRANT_INVENTORY_URL_ENV)
        .or_else(|_| std::env::var("QDRANT_URL"))
        .or_else(|_| std::env::var("ARCHITOKEN_VECTOR__URL"))
        .map_err(|_| QdrantInventoryError::NotConfigured)
}

pub fn redact_qdrant_url(url: &str) -> String {
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
    fn qdrant_collection_contract_deserializes() {
        let collection: QdrantCollection =
            serde_json::from_str(r#"{"name":"project_vectors"}"#).expect("collection parses");

        assert_eq!(collection.name, "project_vectors");
    }

    #[test]
    fn redact_qdrant_url_removes_credentials() {
        let redacted = redact_qdrant_url("http://user:secret@127.0.0.1:6333/");

        assert_eq!(redacted, "http://***@127.0.0.1:6333");
        assert!(!redacted.contains("secret"));
    }
}
