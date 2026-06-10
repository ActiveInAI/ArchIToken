// License: Apache-2.0

use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const S3_INVENTORY_ENDPOINT_ENV: &str = "ARCHITOKEN_DB_MANAGER_S3_ENDPOINT";
pub const S3_INVENTORY_BUCKET_ENV: &str = "ARCHITOKEN_DB_MANAGER_S3_BUCKET";

#[derive(Debug, Error)]
pub enum S3InventoryError {
    #[error("s3 inventory source is not configured")]
    NotConfigured,
    #[error("s3 inventory request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("s3 inventory XML parse failed: {0}")]
    Xml(#[from] quick_xml::DeError),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct S3InventoryConfig {
    pub endpoint: String,
    pub bucket: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct S3Inventory {
    pub engine: &'static str,
    pub source: String,
    pub bucket: String,
    pub object_count: usize,
    pub key_count: usize,
    pub total_bytes: i64,
    pub is_truncated: bool,
    pub objects: Vec<S3ObjectSummary>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct S3ObjectSummary {
    #[serde(rename(deserialize = "Key"))]
    pub key: String,
    #[serde(rename(deserialize = "Size"))]
    pub size: i64,
    #[serde(rename(deserialize = "ETag"))]
    pub etag: Option<String>,
    #[serde(rename(deserialize = "LastModified"))]
    pub last_modified: Option<String>,
    #[serde(rename(deserialize = "StorageClass"))]
    pub storage_class: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct ListBucketResult {
    #[serde(rename = "Name")]
    name: String,
    #[serde(rename = "KeyCount", default)]
    key_count: usize,
    #[serde(rename = "IsTruncated", default)]
    is_truncated: bool,
    #[serde(rename = "Contents", default)]
    contents: Vec<S3ObjectSummary>,
}

impl S3InventoryConfig {
    pub fn from_env() -> Result<Self, S3InventoryError> {
        let endpoint = std::env::var(S3_INVENTORY_ENDPOINT_ENV)
            .or_else(|_| std::env::var("S3_ENDPOINT"))
            .map_err(|_| S3InventoryError::NotConfigured)?;
        let bucket = std::env::var(S3_INVENTORY_BUCKET_ENV)
            .or_else(|_| std::env::var("S3_BUCKET"))
            .map_err(|_| S3InventoryError::NotConfigured)?;
        Ok(Self { endpoint, bucket })
    }

    pub fn list_url(&self) -> String {
        format!(
            "{}/{bucket}?list-type=2",
            self.endpoint.trim_end_matches('/'),
            bucket = self.bucket
        )
    }
}

pub async fn load_s3_inventory(
    client: &Client,
    config: &S3InventoryConfig,
) -> Result<S3Inventory, S3InventoryError> {
    let xml = client
        .get(config.list_url())
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;
    parse_s3_inventory(&xml, redact_s3_endpoint(&config.endpoint))
}

pub fn parse_s3_inventory(xml: &str, source: String) -> Result<S3Inventory, S3InventoryError> {
    let result: ListBucketResult = quick_xml::de::from_str(xml)?;
    let total_bytes = result.contents.iter().map(|object| object.size).sum();
    Ok(S3Inventory {
        engine: "s3_compatible",
        source,
        bucket: result.name,
        object_count: result.contents.len(),
        key_count: result.key_count,
        total_bytes,
        is_truncated: result.is_truncated,
        objects: result.contents,
    })
}

pub fn redact_s3_endpoint(endpoint: &str) -> String {
    let Some((scheme, rest)) = endpoint.split_once("://") else {
        return "configured".to_owned();
    };
    let Some((_, host_and_path)) = rest.rsplit_once('@') else {
        return endpoint.trim_end_matches('/').to_owned();
    };
    format!("{scheme}://***@{}", host_and_path.trim_end_matches('/'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_s3_inventory_reads_bucket_and_objects() {
        let inventory = parse_s3_inventory(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>architoken-assets</Name>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>generation/a/lightweight_scene/one</Key>
    <ETag>&#34;abc&#34;</ETag>
    <Size>101</Size>
    <StorageClass>STANDARD</StorageClass>
    <LastModified>2026-06-03T01:25:30Z</LastModified>
  </Contents>
  <KeyCount>1</KeyCount>
</ListBucketResult>"#,
            "http://127.0.0.1:8333".to_owned(),
        )
        .expect("s3 inventory parses");

        assert_eq!(inventory.engine, "s3_compatible");
        assert_eq!(inventory.bucket, "architoken-assets");
        assert_eq!(inventory.object_count, 1);
        assert_eq!(inventory.key_count, 1);
        assert_eq!(inventory.total_bytes, 101);
        assert_eq!(
            inventory.objects[0].key,
            "generation/a/lightweight_scene/one"
        );
    }

    #[test]
    fn s3_object_summary_serializes_as_camel_case_json() {
        let object = S3ObjectSummary {
            key: "generation/a/lightweight_scene/one".to_owned(),
            size: 101,
            etag: Some("\"abc\"".to_owned()),
            last_modified: Some("2026-06-03T01:25:30Z".to_owned()),
            storage_class: Some("STANDARD".to_owned()),
        };
        let json = serde_json::to_value(object).expect("object serializes");

        assert_eq!(
            json,
            serde_json::json!({
                "key": "generation/a/lightweight_scene/one",
                "size": 101,
                "etag": "\"abc\"",
                "lastModified": "2026-06-03T01:25:30Z",
                "storageClass": "STANDARD"
            })
        );
    }

    #[test]
    fn redact_s3_endpoint_removes_credentials() {
        let redacted = redact_s3_endpoint("http://user:secret@127.0.0.1:8333/");

        assert_eq!(redacted, "http://***@127.0.0.1:8333");
        assert!(!redacted.contains("secret"));
    }
}
