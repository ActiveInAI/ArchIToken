// License: Apache-2.0

pub mod http;
pub mod postgres_inventory;

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseEngineKind {
    #[serde(rename = "postgresql")]
    PostgreSql,
    #[serde(rename = "clickhouse")]
    ClickHouse,
    Valkey,
    RedisCompatible,
    MongoCompatible,
    Qdrant,
    #[serde(rename = "s3_compatible")]
    S3CompatibleObjectStore,
    #[serde(rename = "nats_jetstream")]
    NatsJetStream,
    GraphSidecar,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseCapability {
    RelationalSql,
    AnalyticsSql,
    CacheKeyspace,
    DocumentStore,
    VectorCollections,
    ObjectBuckets,
    EventStreams,
    GraphRelations,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationSafety {
    ReadOnly,
    WriteRequiresApproval,
    DestructiveRequiresBackupAndApproval,
    BlockedPendingReview,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LicenseBoundary {
    Apache2Core,
    PermissiveDependency,
    ExternalSidecarOnly,
    LicensedAdapterOnly,
    BlockedFromCore,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseEngineProfile {
    pub id: &'static str,
    pub display_name: &'static str,
    pub engine: DatabaseEngineKind,
    pub capabilities: &'static [DatabaseCapability],
    pub default_safety: OperationSafety,
    pub license_boundary: LicenseBoundary,
    pub notes: &'static [&'static str],
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseManagerManifest {
    pub name: &'static str,
    pub license: &'static str,
    pub role: &'static str,
    pub implementation: &'static str,
    pub default_operation_safety: OperationSafety,
    pub engines: Vec<DatabaseEngineProfile>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseManagerReadiness {
    pub status: &'static str,
    pub license: &'static str,
    pub implementation: &'static str,
    pub engine_count: usize,
    pub core_allowed_count: usize,
    pub blocked_count: usize,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum DatabaseManagerError {
    #[error("database engine profile not found: {0}")]
    EngineNotFound(String),
}

#[derive(Debug, Clone)]
pub struct DatabaseManagerRegistry {
    engines: BTreeMap<&'static str, DatabaseEngineProfile>,
}

impl DatabaseManagerRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            engines: BTreeMap::new(),
        };
        for profile in default_engine_profiles() {
            registry.register(profile);
        }
        registry
    }

    pub fn register(&mut self, profile: DatabaseEngineProfile) {
        self.engines.insert(profile.id, profile);
    }

    pub fn get(&self, id: &str) -> Result<&DatabaseEngineProfile, DatabaseManagerError> {
        self.engines
            .get(id)
            .ok_or_else(|| DatabaseManagerError::EngineNotFound(id.to_owned()))
    }

    pub fn list(&self) -> Vec<&DatabaseEngineProfile> {
        self.engines.values().collect()
    }

    pub fn list_core_allowed(&self) -> Vec<&DatabaseEngineProfile> {
        self.engines
            .values()
            .filter(|profile| {
                matches!(
                    profile.license_boundary,
                    LicenseBoundary::Apache2Core | LicenseBoundary::PermissiveDependency
                )
            })
            .collect()
    }

    pub fn manifest(&self) -> DatabaseManagerManifest {
        DatabaseManagerManifest {
            name: "architoken-database-manager",
            license: "Apache-2.0",
            role: "unified database inventory, policy and management control plane",
            implementation: "rust-core",
            default_operation_safety: OperationSafety::ReadOnly,
            engines: self.engines.values().cloned().collect(),
        }
    }

    pub fn readiness(&self) -> DatabaseManagerReadiness {
        DatabaseManagerReadiness {
            status: "ready",
            license: "Apache-2.0",
            implementation: "rust-core",
            engine_count: self.engines.len(),
            core_allowed_count: self.list_core_allowed().len(),
            blocked_count: self
                .engines
                .values()
                .filter(|profile| {
                    matches!(
                        profile.license_boundary,
                        LicenseBoundary::BlockedFromCore | LicenseBoundary::LicensedAdapterOnly
                    )
                })
                .count(),
        }
    }
}

impl Default for DatabaseManagerRegistry {
    fn default() -> Self {
        Self::new()
    }
}

pub fn default_engine_profiles() -> Vec<DatabaseEngineProfile> {
    vec![
        DatabaseEngineProfile {
            id: "postgresql",
            display_name: "PostgreSQL",
            engine: DatabaseEngineKind::PostgreSql,
            capabilities: &[DatabaseCapability::RelationalSql],
            default_safety: OperationSafety::ReadOnly,
            license_boundary: LicenseBoundary::PermissiveDependency,
            notes: &["Primary relational and fallback source of truth."],
        },
        DatabaseEngineProfile {
            id: "clickhouse",
            display_name: "ClickHouse",
            engine: DatabaseEngineKind::ClickHouse,
            capabilities: &[DatabaseCapability::AnalyticsSql],
            default_safety: OperationSafety::ReadOnly,
            license_boundary: LicenseBoundary::PermissiveDependency,
            notes: &["Analytics and time-series SQL inventory target."],
        },
        DatabaseEngineProfile {
            id: "valkey",
            display_name: "Valkey",
            engine: DatabaseEngineKind::Valkey,
            capabilities: &[DatabaseCapability::CacheKeyspace],
            default_safety: OperationSafety::ReadOnly,
            license_boundary: LicenseBoundary::PermissiveDependency,
            notes: &["Preferred Redis-compatible cache route."],
        },
        DatabaseEngineProfile {
            id: "mongo_compatible",
            display_name: "MongoDB-compatible",
            engine: DatabaseEngineKind::MongoCompatible,
            capabilities: &[DatabaseCapability::DocumentStore],
            default_safety: OperationSafety::ReadOnly,
            license_boundary: LicenseBoundary::ExternalSidecarOnly,
            notes: &[
                "Document inventory uses isolated connector agents until driver and license review is complete.",
            ],
        },
        DatabaseEngineProfile {
            id: "qdrant",
            display_name: "Qdrant",
            engine: DatabaseEngineKind::Qdrant,
            capabilities: &[DatabaseCapability::VectorCollections],
            default_safety: OperationSafety::ReadOnly,
            license_boundary: LicenseBoundary::PermissiveDependency,
            notes: &[
                "Vector collection inventory target; native Qdrant Web UI can remain a deep link.",
            ],
        },
        DatabaseEngineProfile {
            id: "s3_compatible",
            display_name: "S3-compatible object store",
            engine: DatabaseEngineKind::S3CompatibleObjectStore,
            capabilities: &[DatabaseCapability::ObjectBuckets],
            default_safety: OperationSafety::ReadOnly,
            license_boundary: LicenseBoundary::PermissiveDependency,
            notes: &["Object bytes remain owned by StorageRouter/ObjectStore."],
        },
        DatabaseEngineProfile {
            id: "nats_jetstream",
            display_name: "NATS JetStream",
            engine: DatabaseEngineKind::NatsJetStream,
            capabilities: &[DatabaseCapability::EventStreams],
            default_safety: OperationSafety::ReadOnly,
            license_boundary: LicenseBoundary::PermissiveDependency,
            notes: &["Event stream inventory first; stream deletion remains gated."],
        },
        DatabaseEngineProfile {
            id: "graph_sidecar",
            display_name: "External graph sidecar",
            engine: DatabaseEngineKind::GraphSidecar,
            capabilities: &[DatabaseCapability::GraphRelations],
            default_safety: OperationSafety::BlockedPendingReview,
            license_boundary: LicenseBoundary::BlockedFromCore,
            notes: &[
                "Current GraphStore remains PostgreSQL adjacency fallback until sidecar review.",
            ],
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_registry_contains_architoken_data_plane_targets() {
        let registry = DatabaseManagerRegistry::new();

        assert!(registry.get("postgresql").is_ok());
        assert!(registry.get("clickhouse").is_ok());
        assert!(registry.get("valkey").is_ok());
        assert!(registry.get("qdrant").is_ok());
        assert!(registry.get("nats_jetstream").is_ok());
    }

    #[test]
    fn destructive_or_unreviewed_engines_do_not_enter_core_allowed_list() {
        let registry = DatabaseManagerRegistry::new();
        let core_ids = registry
            .list_core_allowed()
            .into_iter()
            .map(|profile| profile.id)
            .collect::<Vec<_>>();

        assert!(core_ids.contains(&"postgresql"));
        assert!(!core_ids.contains(&"graph_sidecar"));
    }

    #[test]
    fn manifest_is_apache2_rust_core_and_read_only_by_default() {
        let registry = DatabaseManagerRegistry::new();
        let manifest = registry.manifest();

        assert_eq!(manifest.license, "Apache-2.0");
        assert_eq!(manifest.implementation, "rust-core");
        assert_eq!(manifest.default_operation_safety, OperationSafety::ReadOnly);
        assert!(
            manifest
                .engines
                .iter()
                .any(|engine| engine.id == "postgresql")
        );
    }

    #[test]
    fn public_engine_kind_names_match_registry_ids() {
        assert_eq!(
            serde_json::to_string(&DatabaseEngineKind::PostgreSql).expect("engine serializes"),
            "\"postgresql\""
        );
        assert_eq!(
            serde_json::to_string(&DatabaseEngineKind::ClickHouse).expect("engine serializes"),
            "\"clickhouse\""
        );
        assert_eq!(
            serde_json::to_string(&DatabaseEngineKind::NatsJetStream).expect("engine serializes"),
            "\"nats_jetstream\""
        );
    }

    #[test]
    fn readiness_reports_blocked_review_targets() {
        let registry = DatabaseManagerRegistry::new();
        let readiness = registry.readiness();

        assert_eq!(readiness.status, "ready");
        assert_eq!(readiness.engine_count, 8);
        assert_eq!(readiness.blocked_count, 1);
    }
}
