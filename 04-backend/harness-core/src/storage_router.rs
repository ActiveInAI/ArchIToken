//! `StorageRouter` capability traits and in-memory preview adapters.
//!
//! These contracts are intentionally synchronous to match the current
//! in-memory module services. Production adapters can later wrap cloud object
//! storage, databases, vector indexes, graph stores, and analytics systems
//! without changing API handlers.

use std::{collections::HashMap, sync::Arc};

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::{HarnessError, Result},
    module_pagination::{ListPage, paginate},
};

/// Artifact lifecycle status persisted across generation, file, and archive flows.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ArtifactStatus {
    /// Preview artifact, not valid for production use.
    Preview,
    /// Draft artifact awaiting review or approval.
    Draft,
    /// Approved artifact available to downstream module workflows.
    Approved,
    /// Archived artifact retained for history and compliance.
    Archived,
    /// Rejected artifact retained for audit and debug.
    Rejected,
    /// Blocked artifact that cannot proceed until an issue is resolved.
    Blocked,
}

impl ArtifactStatus {
    /// All artifact lifecycle statuses exposed through runtime capabilities.
    pub const ALL: [Self; 6] = [
        Self::Preview,
        Self::Draft,
        Self::Approved,
        Self::Archived,
        Self::Rejected,
        Self::Blocked,
    ];
}

/// Artifact role in the model lightweighting and viewer pipeline.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ArtifactRole {
    /// Geometry artifact such as IFC, glTF, 3D Tiles, point cloud, or vendor geometry.
    GeometryArtifact,
    /// Property index artifact such as JSON, `SQLite`, `DuckDB`, Parquet, or vendor DB.
    PropertyIndexArtifact,
    /// Element identity map between source ids and `ArchIToken` element ids.
    ElementIdentityMap,
    /// Scene tile artifact for streaming viewers.
    SceneTileArtifact,
    /// Level-of-detail artifact.
    LodArtifact,
    /// Source artifact preserved for traceability.
    SourceArtifact,
    /// Preview artifact for unapproved viewer workflows.
    PreviewArtifact,
}

/// Geometry payload format supported by artifact metadata.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GeometryFormat {
    /// IFC model.
    Ifc,
    /// Binary glTF model.
    Glb,
    /// glTF model.
    Gltf,
    /// OGC 3D Tiles.
    #[serde(rename = "3dtiles")]
    Tiles3d,
    /// Point cloud payload.
    #[serde(rename = "pointcloud")]
    PointCloud,
    /// SPZ Gaussian splat payload.
    Spz,
    /// Proprietary vendor geometry candidate format.
    VendorOpt,
}

impl GeometryFormat {
    /// All supported geometry formats, including disabled vendor candidates.
    pub const ALL: [Self; 7] = [
        Self::Ifc,
        Self::Glb,
        Self::Gltf,
        Self::Tiles3d,
        Self::PointCloud,
        Self::Spz,
        Self::VendorOpt,
    ];
}

/// Property index payload format supported by artifact metadata.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PropertyIndexFormat {
    /// JSON property index.
    Json,
    /// `SQLite` property index.
    Sqlite,
    /// `DuckDB` property index.
    #[serde(rename = "duckdb")]
    DuckDb,
    /// Parquet property index.
    Parquet,
    /// Proprietary vendor property DB candidate format.
    VendorDb,
}

impl PropertyIndexFormat {
    /// All supported property index formats, including disabled vendor candidates.
    pub const ALL: [Self; 5] = [
        Self::Json,
        Self::Sqlite,
        Self::DuckDb,
        Self::Parquet,
        Self::VendorDb,
    ];
}

/// Element id namespace used by model identity maps.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ElementIdNamespace {
    /// IFC GUID.
    IfcGuid,
    /// Revit element id.
    RevitElementId,
    /// Proprietary vendor feature id.
    VendorFeatureId,
    /// `ArchIToken` canonical element id.
    ArchitokenElementId,
}

/// Viewer adapter hint for frontend and third-party viewers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ViewerAdapterHint {
    /// Three.js viewer adapter.
    #[serde(rename = "threejs")]
    ThreeJs,
    /// WebGPU viewer adapter.
    #[serde(rename = "webgpu")]
    WebGpu,
    /// React Three Fiber viewer adapter.
    R3f,
    /// 3D Tiles viewer adapter.
    #[serde(rename = "3dtiles")]
    Tiles3d,
    /// IFC viewer adapter.
    Ifc,
    /// Gaussian splat viewer adapter.
    GaussianSplat,
    /// Proprietary OptRapid3d-compatible candidate adapter.
    VendorOptrapid3d,
}

impl ViewerAdapterHint {
    /// All viewer adapter hints advertised to clients.
    pub const ALL: [Self; 7] = [
        Self::ThreeJs,
        Self::WebGpu,
        Self::R3f,
        Self::Tiles3d,
        Self::Ifc,
        Self::GaussianSplat,
        Self::VendorOptrapid3d,
    ];
}

/// Stable artifact reference used by API clients and registry services.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactRef {
    /// Artifact id.
    pub artifact_id: Uuid,
    /// Artifact kind such as `bim`, `cad`, or `digital_twin`.
    pub artifact_kind: String,
    /// Active module id after alias normalization.
    pub module_id: String,
    /// Current artifact status.
    pub status: ArtifactStatus,
    /// Human-readable artifact name.
    pub name: String,
}

/// Object or module-file binding for an artifact.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactStorageBinding {
    /// Artifact role for this storage binding.
    pub artifact_role: ArtifactRole,
    /// Storage provider id. Current preview uses `memory`.
    pub provider: String,
    /// Object key prepared for future `ObjectStore` replacement.
    pub object_key: String,
    /// Object URI. Current preview uses `memory://`.
    pub object_uri: String,
    /// Optional module file id when the artifact has been materialized as a `ModuleFileNode`.
    pub module_file_id: Option<Uuid>,
    /// Stable file reference for frontend and third-party callers.
    pub file_reference: String,
}

/// Shared durable-store metadata carried by in-memory records today.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreRecordMetadata {
    /// Record owner display name or user id.
    pub owner: String,
    /// Tenant id used for hard isolation.
    pub tenant_id: String,
    /// Project id used for hard isolation.
    pub project_id: String,
    /// Monotonic record version.
    pub version: u32,
    /// Request id that produced this record.
    pub request_id: String,
    /// Correlation id for multi-call workflows.
    pub correlation_id: String,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

impl StoreRecordMetadata {
    /// Build version-1 metadata for an in-memory record.
    #[must_use]
    pub fn new(
        owner: String,
        tenant_id: String,
        project_id: String,
        request_id: String,
        correlation_id: String,
    ) -> Self {
        let now = Utc::now();
        Self {
            owner,
            tenant_id,
            project_id,
            version: 1,
            request_id,
            correlation_id,
            created_at: now,
            updated_at: now,
        }
    }
}

impl Default for StoreRecordMetadata {
    fn default() -> Self {
        Self::new(
            "dev-actor".to_owned(),
            "dev-tenant".to_owned(),
            "dev-project".to_owned(),
            "dev-request".to_owned(),
            "dev-correlation".to_owned(),
        )
    }
}

/// Artifact metadata persisted independently from binary content.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactMetadata {
    /// Artifact role in the model lightweighting pipeline.
    pub artifact_role: ArtifactRole,
    /// Geometry payload format when this artifact carries geometry.
    pub geometry_format: Option<GeometryFormat>,
    /// Property index payload format when this artifact carries property data.
    pub property_index_format: Option<PropertyIndexFormat>,
    /// Element identity namespace for pick/property lookup mapping.
    pub element_id_namespace: Option<ElementIdNamespace>,
    /// Viewer adapter hint for frontend and third-party callers.
    pub viewer_adapter_hint: Option<ViewerAdapterHint>,
    /// Source model id for derived lightweight artifacts.
    pub source_model_id: Option<String>,
    /// Artifact schema reference.
    pub schema_ref: String,
    /// Checksum placeholder for current preview adapters.
    pub checksum: Option<String>,
    /// MIME type.
    pub mime_type: String,
    /// Size in bytes.
    pub size_bytes: u64,
    /// Owner display name or user id.
    pub owner: String,
    /// Tenant id used for artifact isolation.
    pub tenant_id: String,
    /// Project id used for artifact isolation.
    pub project_id: String,
    /// Monotonic artifact metadata version.
    pub version: u32,
    /// Request id that produced this metadata.
    pub request_id: String,
    /// Correlation id for the generation workflow.
    pub correlation_id: String,
    /// Source generation job id.
    pub source_job_id: Option<Uuid>,
    /// Generation job id that created this artifact.
    pub created_by_job_id: Option<Uuid>,
    /// Approval status mirrored from lifecycle state.
    pub approval_status: ArtifactStatus,
    /// Audit event id associated with artifact creation or update.
    pub audit_event_id: Option<Uuid>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// One artifact version record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactVersion {
    /// Version id.
    pub id: Uuid,
    /// Artifact id.
    pub artifact_id: Uuid,
    /// Monotonic version number.
    pub version: u32,
    /// Status at this version.
    pub status: ArtifactStatus,
    /// Storage binding at this version.
    pub storage: ArtifactStorageBinding,
    /// Metadata at this version.
    pub metadata: ArtifactMetadata,
}

/// Request to put an object in an `ObjectStore` adapter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObjectPutRequest {
    /// Object key.
    pub key: String,
    /// Object bytes.
    pub bytes: Vec<u8>,
    /// MIME type.
    pub content_type: String,
    /// Owner display name or user id.
    pub owner: String,
}

/// Object bytes returned by `ObjectStore`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObjectData {
    /// Object key.
    pub key: String,
    /// Object bytes.
    pub bytes: Vec<u8>,
    /// MIME type.
    pub content_type: String,
    /// Object stat.
    pub stat: ObjectStat,
}

/// Object metadata returned by `ObjectStore`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObjectStat {
    /// Object key.
    pub key: String,
    /// Object URI.
    pub uri: String,
    /// Size in bytes.
    pub size_bytes: u64,
    /// Checksum placeholder.
    pub checksum: String,
    /// MIME type.
    pub content_type: String,
    /// Owner display name or user id.
    pub owner: String,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
struct StoredObject {
    bytes: Vec<u8>,
    stat: ObjectStat,
}

/// Object storage capability.
pub trait ObjectStore: Send + Sync {
    /// Put or replace an object.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] for an empty key.
    fn put_object(&self, req: ObjectPutRequest) -> Result<ObjectStat>;

    /// Read object bytes.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the key is unknown.
    fn get_object(&self, key: &str) -> Result<ObjectData>;

    /// Read object metadata.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the key is unknown.
    fn stat_object(&self, key: &str) -> Result<ObjectStat>;
}

/// Durable artifact persistence capability.
pub trait ArtifactStore<Record>: Send + Sync {
    /// Put or replace one artifact record.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when an adapter rejects the record.
    fn put_artifact(&self, record: Record) -> Result<Record>;

    /// Get one artifact record by id.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the artifact is unknown.
    fn get_artifact(&self, id: Uuid) -> Result<Record>;

    /// List artifact records with deterministic pagination.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] for an invalid cursor.
    fn list_artifacts(
        &self,
        tenant_id: &str,
        project_id: &str,
        limit: Option<usize>,
        cursor: Option<&str>,
    ) -> Result<ListPage<Record>>;
}

/// Durable viewer-command persistence capability.
pub trait ViewerCommandStore<Record>: Send + Sync {
    /// Put or replace one viewer command.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when an adapter rejects the record.
    fn put_viewer_command(&self, record: Record) -> Result<Record>;

    /// Get one viewer command by id.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the command is unknown.
    fn get_viewer_command(&self, id: Uuid) -> Result<Record>;

    /// List viewer commands with deterministic pagination.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] for an invalid cursor.
    fn list_viewer_commands(
        &self,
        tenant_id: &str,
        project_id: &str,
        limit: Option<usize>,
        cursor: Option<&str>,
    ) -> Result<ListPage<Record>>;
}

/// Durable registry persistence capability shared by skills and MCP tools.
pub trait RegistryStore<Record>: Send + Sync {
    /// Put or replace one registry record.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when an adapter rejects the record.
    fn put_registry_record(&self, id: &str, record: Record) -> Result<Record>;

    /// Get one registry record.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the record is unknown.
    fn get_registry_record(&self, id: &str) -> Result<Record>;

    /// List registry records with deterministic pagination.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] for an invalid cursor.
    fn list_registry_records(
        &self,
        tenant_id: &str,
        project_id: &str,
        limit: Option<usize>,
        cursor: Option<&str>,
    ) -> Result<ListPage<Record>>;
}

/// Durable knowledge-source persistence capability.
pub trait KnowledgeSourceStore<Record>: Send + Sync {
    /// Put or replace one knowledge source.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when an adapter rejects the record.
    fn put_knowledge_source(&self, id: &str, record: Record) -> Result<Record>;

    /// Get one knowledge source.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the source is unknown.
    fn get_knowledge_source(&self, id: &str) -> Result<Record>;

    /// List knowledge sources with deterministic pagination.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] for an invalid cursor.
    fn list_knowledge_sources(
        &self,
        tenant_id: &str,
        project_id: &str,
        limit: Option<usize>,
        cursor: Option<&str>,
    ) -> Result<ListPage<Record>>;
}

/// In-memory `ObjectStore` preview adapter.
#[derive(Debug, Clone, Default)]
pub struct InMemoryObjectStore {
    objects: Arc<RwLock<HashMap<String, StoredObject>>>,
}

impl InMemoryObjectStore {
    /// Create an empty in-memory object store.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }
}

impl ObjectStore for InMemoryObjectStore {
    fn put_object(&self, req: ObjectPutRequest) -> Result<ObjectStat> {
        if req.key.trim().is_empty() {
            return Err(HarnessError::InvalidInput(
                "object key is required".to_owned(),
            ));
        }
        let now = Utc::now();
        let checksum = format!("memory-checksum-{}-{}", req.key, req.bytes.len());
        let stat = ObjectStat {
            key: req.key.clone(),
            uri: format!("memory://{}", req.key),
            size_bytes: req.bytes.len() as u64,
            checksum,
            content_type: req.content_type,
            owner: req.owner,
            created_at: now,
            updated_at: now,
        };
        self.objects.write().insert(
            req.key,
            StoredObject {
                bytes: req.bytes,
                stat: stat.clone(),
            },
        );
        Ok(stat)
    }

    fn get_object(&self, key: &str) -> Result<ObjectData> {
        let stored = self
            .objects
            .read()
            .get(key)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("object_key={key}")))?;
        Ok(ObjectData {
            key: key.to_owned(),
            bytes: stored.bytes,
            content_type: stored.stat.content_type.clone(),
            stat: stored.stat,
        })
    }

    fn stat_object(&self, key: &str) -> Result<ObjectStat> {
        self.objects
            .read()
            .get(key)
            .map(|stored| stored.stat.clone())
            .ok_or_else(|| HarnessError::NotFound(format!("object_key={key}")))
    }
}

/// Generic transaction record for preview transaction stores.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageTransactionRecord {
    /// Transaction id.
    pub id: Uuid,
    /// Shared durable-store metadata.
    pub store_metadata: StoreRecordMetadata,
    /// Transaction type.
    pub transaction_type: String,
    /// Transaction status.
    pub status: String,
    /// Structured payload.
    pub payload: serde_json::Value,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Transaction persistence capability.
pub trait TransactionStore: Send + Sync {
    /// Put or replace a transaction record.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when an adapter rejects the record.
    fn put_transaction(&self, record: StorageTransactionRecord)
    -> Result<StorageTransactionRecord>;

    /// Get a transaction record.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the id is unknown.
    fn get_transaction(&self, id: Uuid) -> Result<StorageTransactionRecord>;

    /// List transaction records.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] for an invalid cursor.
    fn list_transactions(
        &self,
        limit: Option<usize>,
        cursor: Option<&str>,
    ) -> Result<ListPage<StorageTransactionRecord>>;
}

/// In-memory `TransactionStore` preview adapter.
#[derive(Debug, Clone, Default)]
pub struct InMemoryTransactionStore {
    transactions: Arc<RwLock<HashMap<Uuid, StorageTransactionRecord>>>,
}

impl InMemoryTransactionStore {
    /// Create an empty in-memory transaction store.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }
}

impl TransactionStore for InMemoryTransactionStore {
    fn put_transaction(
        &self,
        record: StorageTransactionRecord,
    ) -> Result<StorageTransactionRecord> {
        self.transactions.write().insert(record.id, record.clone());
        Ok(record)
    }

    fn get_transaction(&self, id: Uuid) -> Result<StorageTransactionRecord> {
        self.transactions
            .read()
            .get(&id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("transaction_id={id}")))
    }

    fn list_transactions(
        &self,
        limit: Option<usize>,
        cursor: Option<&str>,
    ) -> Result<ListPage<StorageTransactionRecord>> {
        let mut items: Vec<StorageTransactionRecord> =
            self.transactions.read().values().cloned().collect();
        items.sort_by(|left, right| {
            left.store_metadata
                .created_at
                .cmp(&right.store_metadata.created_at)
                .then_with(|| left.id.as_bytes().cmp(right.id.as_bytes()))
        });
        paginate(&items, limit, cursor)
    }
}

/// Generic event record for preview event stores.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageEventRecord {
    /// Event id.
    pub id: Uuid,
    /// Shared durable-store metadata.
    pub store_metadata: StoreRecordMetadata,
    /// Event kind.
    pub event_type: String,
    /// Target type.
    pub target_type: String,
    /// Target id.
    pub target_id: String,
    /// Structured event payload.
    pub payload: serde_json::Value,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// Event persistence capability.
pub trait EventStore: Send + Sync {
    /// Append an event.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when an adapter rejects the event.
    fn append_event(&self, record: StorageEventRecord) -> Result<StorageEventRecord>;

    /// List events.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] for an invalid cursor.
    fn list_events(
        &self,
        limit: Option<usize>,
        cursor: Option<&str>,
    ) -> Result<ListPage<StorageEventRecord>>;
}

/// In-memory `EventStore` preview adapter.
#[derive(Debug, Clone, Default)]
pub struct InMemoryEventStore {
    events: Arc<RwLock<Vec<StorageEventRecord>>>,
}

impl InMemoryEventStore {
    /// Create an empty in-memory event store.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }
}

impl EventStore for InMemoryEventStore {
    fn append_event(&self, record: StorageEventRecord) -> Result<StorageEventRecord> {
        self.events.write().push(record.clone());
        Ok(record)
    }

    fn list_events(
        &self,
        limit: Option<usize>,
        cursor: Option<&str>,
    ) -> Result<ListPage<StorageEventRecord>> {
        let mut items = self.events.read().clone();
        items.sort_by(|left, right| {
            left.store_metadata
                .created_at
                .cmp(&right.store_metadata.created_at)
                .then_with(|| left.id.as_bytes().cmp(right.id.as_bytes()))
        });
        paginate(&items, limit, cursor)
    }
}

/// Vector search capability reserved for production RAG adapters.
pub trait VectorStore: Send + Sync {
    /// Upsert a vector payload by id.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when an adapter rejects the vector payload.
    fn upsert_vector(&self, id: &str, payload: serde_json::Value) -> Result<()>;
}

/// Graph relationship capability reserved for production knowledge graph adapters.
pub trait GraphStore: Send + Sync {
    /// Upsert an edge between two entities.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when an adapter rejects the edge.
    fn upsert_edge(&self, from: &str, to: &str, label: &str) -> Result<()>;
}

/// Time-series capability reserved for `IoT` and digital twin adapters.
pub trait TimeSeriesStore: Send + Sync {
    /// Write one time-series point.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when an adapter rejects the point.
    fn write_point(&self, series: &str, timestamp: DateTime<Utc>, value: f64) -> Result<()>;
}

/// Cache capability reserved for ephemeral workflow and UI adapter state.
pub trait CacheStore: Send + Sync {
    /// Put one cache value.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when an adapter rejects the cache entry.
    fn put_cache(&self, key: &str, value: serde_json::Value) -> Result<()>;
}

/// Analytics capability reserved for aggregate operational views.
pub trait AnalyticsStore: Send + Sync {
    /// Record one analytics event.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when an adapter rejects the metric.
    fn record_metric(&self, name: &str, value: f64, tags: serde_json::Value) -> Result<()>;
}

#[cfg(test)]
mod tests {
    use chrono::Utc;
    use serde_json::json;
    use uuid::Uuid;

    use super::{
        ArtifactMetadata, ArtifactRole, ArtifactStatus, ElementIdNamespace, EventStore,
        GeometryFormat, InMemoryEventStore, InMemoryObjectStore, InMemoryTransactionStore,
        ObjectPutRequest, ObjectStore, PropertyIndexFormat, StorageEventRecord,
        StorageTransactionRecord, StoreRecordMetadata, TransactionStore, ViewerAdapterHint,
    };

    #[test]
    fn in_memory_object_store_put_get_stat() {
        let store = InMemoryObjectStore::new();
        let stat = store
            .put_object(ObjectPutRequest {
                key: "generation/job/artifact.ifc".to_owned(),
                bytes: b"IFC".to_vec(),
                content_type: "model/ifc".to_owned(),
                owner: "tester".to_owned(),
            })
            .expect("put should work");
        assert_eq!(stat.size_bytes, 3);
        assert_eq!(stat.uri, "memory://generation/job/artifact.ifc");

        let data = store
            .get_object("generation/job/artifact.ifc")
            .expect("get should work");
        assert_eq!(data.bytes, b"IFC".to_vec());

        let stat = store
            .stat_object("generation/job/artifact.ifc")
            .expect("stat should work");
        assert_eq!(stat.content_type, "model/ifc");
    }

    #[test]
    fn in_memory_transaction_and_event_stores_page_records() {
        let transactions = InMemoryTransactionStore::new();
        let id = Uuid::new_v4();
        let now = Utc::now();
        let older_metadata = StoreRecordMetadata {
            created_at: now,
            updated_at: now,
            ..Default::default()
        };
        let newer_created_at = now + chrono::Duration::seconds(1);
        let newer_metadata = StoreRecordMetadata {
            created_at: newer_created_at,
            updated_at: newer_created_at,
            ..Default::default()
        };
        transactions
            .put_transaction(StorageTransactionRecord {
                id,
                store_metadata: older_metadata.clone(),
                transaction_type: "generation".to_owned(),
                status: "draft".to_owned(),
                payload: json!({ "mode": "cad_to_bim" }),
                created_at: now,
                updated_at: now,
            })
            .expect("put transaction should work");
        let newer_id = Uuid::new_v4();
        transactions
            .put_transaction(StorageTransactionRecord {
                id: newer_id,
                store_metadata: newer_metadata.clone(),
                transaction_type: "generation".to_owned(),
                status: "planned".to_owned(),
                payload: json!({ "mode": "text_to_bim" }),
                created_at: newer_metadata.created_at,
                updated_at: newer_metadata.updated_at,
            })
            .expect("put second transaction should work");
        assert_eq!(
            transactions
                .get_transaction(id)
                .expect("transaction exists")
                .status,
            "draft"
        );
        assert_eq!(
            transactions
                .list_transactions(Some(10), None)
                .expect("list transactions")
                .items
                .len(),
            2
        );
        assert_eq!(
            transactions
                .list_transactions(Some(10), None)
                .expect("list transactions")
                .items[0]
                .id,
            id
        );

        let events = InMemoryEventStore::new();
        events
            .append_event(StorageEventRecord {
                id: Uuid::new_v4(),
                store_metadata: newer_metadata,
                event_type: "generation_stage_completed".to_owned(),
                target_type: "generation_job".to_owned(),
                target_id: id.to_string(),
                payload: json!({ "stage": "planner" }),
                created_at: now,
            })
            .expect("append event should work");
        let first_event_id = Uuid::new_v4();
        events
            .append_event(StorageEventRecord {
                id: first_event_id,
                store_metadata: older_metadata,
                event_type: "generation_job_created".to_owned(),
                target_type: "generation_job".to_owned(),
                target_id: id.to_string(),
                payload: json!({ "stage": "queued" }),
                created_at: now,
            })
            .expect("append older event should work");
        assert_eq!(
            events
                .list_events(Some(10), None)
                .expect("list events")
                .items
                .len(),
            2
        );
        assert_eq!(
            events
                .list_events(Some(10), None)
                .expect("list events")
                .items[0]
                .id,
            first_event_id
        );
    }

    #[test]
    fn artifact_metadata_accepts_open_and_vendor_candidate_formats() {
        let metadata = ArtifactMetadata {
            artifact_role: ArtifactRole::GeometryArtifact,
            geometry_format: Some(GeometryFormat::Tiles3d),
            property_index_format: Some(PropertyIndexFormat::Parquet),
            element_id_namespace: Some(ElementIdNamespace::ArchitokenElementId),
            viewer_adapter_hint: Some(ViewerAdapterHint::Tiles3d),
            source_model_id: Some("source-model".to_owned()),
            schema_ref: "artifact.3dtiles.schema.v1".to_owned(),
            checksum: Some("checksum".to_owned()),
            mime_type: "application/vnd.3dtiles+json".to_owned(),
            size_bytes: 128,
            owner: "tester".to_owned(),
            tenant_id: "dev-tenant".to_owned(),
            project_id: "dev-project".to_owned(),
            version: 1,
            request_id: "dev-request".to_owned(),
            correlation_id: "dev-correlation".to_owned(),
            source_job_id: None,
            created_by_job_id: None,
            approval_status: ArtifactStatus::Preview,
            audit_event_id: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        assert_eq!(metadata.geometry_format, Some(GeometryFormat::Tiles3d));

        let vendor_metadata = ArtifactMetadata {
            geometry_format: Some(GeometryFormat::VendorOpt),
            property_index_format: Some(PropertyIndexFormat::VendorDb),
            viewer_adapter_hint: Some(ViewerAdapterHint::VendorOptrapid3d),
            ..metadata
        };
        assert_eq!(
            vendor_metadata.geometry_format,
            Some(GeometryFormat::VendorOpt)
        );
        assert_eq!(
            vendor_metadata.property_index_format,
            Some(PropertyIndexFormat::VendorDb)
        );
    }
}
