//! `SeaweedFS` S3 object-store adapter boundary.

use serde::{Deserialize, Serialize};

use crate::{
    error::{HarnessError, Result},
    storage_router::{ObjectData, ObjectPutRequest, ObjectStat, ObjectStore},
};

/// S3-compatible object store configuration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct S3ObjectStoreConfig {
    /// S3 endpoint URL.
    pub endpoint: String,
    /// Access key id.
    pub access_key: String,
    /// Secret access key.
    pub secret_key: String,
    /// Default bucket.
    pub bucket: String,
}

/// S3-compatible object-store boundary.
#[derive(Debug, Clone)]
pub struct S3ObjectStore {
    config: S3ObjectStoreConfig,
}

impl S3ObjectStore {
    /// Create an S3 object-store boundary.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when required config is missing.
    pub fn new(config: S3ObjectStoreConfig) -> Result<Self> {
        for (field, value) in [
            ("endpoint", config.endpoint.as_str()),
            ("access_key", config.access_key.as_str()),
            ("secret_key", config.secret_key.as_str()),
            ("bucket", config.bucket.as_str()),
        ] {
            if value.trim().is_empty() {
                return Err(HarnessError::InvalidInput(format!(
                    "S3 object store {field} is required"
                )));
            }
        }
        Ok(Self { config })
    }

    /// Read the configured bucket.
    #[must_use]
    pub fn bucket(&self) -> &str {
        &self.config.bucket
    }
}

impl ObjectStore for S3ObjectStore {
    fn put_object(&self, _req: ObjectPutRequest) -> Result<ObjectStat> {
        Err(HarnessError::InvalidInput(
            "S3 object store execution is a Phase 7 boundary; wire an SDK adapter before use"
                .to_owned(),
        ))
    }

    fn get_object(&self, _key: &str) -> Result<ObjectData> {
        Err(HarnessError::InvalidInput(
            "S3 object store execution is a Phase 7 boundary; wire an SDK adapter before use"
                .to_owned(),
        ))
    }

    fn stat_object(&self, _key: &str) -> Result<ObjectStat> {
        Err(HarnessError::InvalidInput(
            "S3 object store execution is a Phase 7 boundary; wire an SDK adapter before use"
                .to_owned(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::{S3ObjectStore, S3ObjectStoreConfig};

    #[test]
    fn s3_config_requires_bucket() {
        let err = S3ObjectStore::new(S3ObjectStoreConfig {
            endpoint: "http://localhost:8333".to_owned(),
            access_key: "key".to_owned(),
            secret_key: "secret".to_owned(),
            bucket: String::new(),
        })
        .expect_err("empty bucket should fail");
        assert_eq!(err.http_status(), 400);
    }
}
