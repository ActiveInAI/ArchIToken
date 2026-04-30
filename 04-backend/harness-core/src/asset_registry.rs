//! Phase 7 asset registry contract types and in-memory preview service.

use std::{collections::HashMap, sync::Arc};

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::{
    durable_store::DurableRecordMetadata,
    error::{HarnessError, Result},
    module_audit::{AuditEventInput, AuditEventKind, ModuleAuditService},
    module_pagination::{ListPage, PageInfo, paginate},
    runtime_context::{PermissionGuard, RequestContext, RuntimePermission, assert_runtime_scope},
};

const ASSET_AUDIT_MODULE_ID: &str = "digital_twin";
const DEFAULT_BUCKET: &str = "architoken-assets";

/// Universal asset kinds supported by Phase 7.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetKind {
    /// IFC/openBIM model.
    Ifc,
    /// CAD source or derivative.
    Cad,
    /// PDF document.
    Pdf,
    /// Office document.
    Office,
    /// Raster image.
    Image,
    /// Video media.
    Video,
    /// Audio media.
    Audio,
    /// Point cloud asset.
    PointCloud,
    /// 360 panorama asset.
    Panorama,
    /// GIS layer asset.
    GisLayer,
    /// Gantt chart asset.
    Gantt,
    /// Flow diagram asset.
    FlowDiagram,
    /// Generic 3D model.
    Model3d,
    /// Unknown or not yet classified asset.
    Unknown,
}

impl AssetKind {
    /// All Phase 7 asset kinds.
    pub const ALL: [Self; 14] = [
        Self::Ifc,
        Self::Cad,
        Self::Pdf,
        Self::Office,
        Self::Image,
        Self::Video,
        Self::Audio,
        Self::PointCloud,
        Self::Panorama,
        Self::GisLayer,
        Self::Gantt,
        Self::FlowDiagram,
        Self::Model3d,
        Self::Unknown,
    ];
}

/// Asset lifecycle state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetStatus {
    /// Draft metadata.
    Draft,
    /// Upload is pending.
    Uploading,
    /// Asset is available.
    Ready,
    /// Asset is approved.
    Approved,
    /// Asset is rejected.
    Rejected,
    /// Asset is archived.
    Archived,
}

/// Durable asset record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetRecord {
    /// Common database metadata.
    pub metadata: DurableRecordMetadata,
    /// Stable external asset id.
    pub asset_id: Uuid,
    /// Asset kind.
    pub kind: AssetKind,
    /// Display name.
    pub name: String,
    /// Lifecycle status.
    pub status: AssetStatus,
    /// Original file format, when known.
    pub source_format: Option<String>,
    /// Canonical normalized format, when known.
    pub canonical_format: Option<String>,
    /// Extensible metadata.
    pub payload: Value,
}

/// Durable asset version record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetVersionRecord {
    /// Common database metadata.
    pub metadata: DurableRecordMetadata,
    /// Parent asset id.
    pub asset_id: Uuid,
    /// Monotonic asset version.
    pub version: u32,
    /// Version status.
    pub status: AssetStatus,
    /// Version metadata.
    pub payload: Value,
}

/// Durable asset file record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetFileRecord {
    /// Common database metadata.
    pub metadata: DurableRecordMetadata,
    /// Parent asset id.
    pub asset_id: Uuid,
    /// Parent version id.
    pub asset_version_id: Uuid,
    /// File role.
    pub role: String,
    /// File format.
    pub format: String,
    /// File metadata.
    pub payload: Value,
}

/// Object-store binding for one asset file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObjectStoreBindingRecord {
    /// Common database metadata.
    pub metadata: DurableRecordMetadata,
    /// Parent asset id.
    pub asset_id: Uuid,
    /// Parent file id.
    pub asset_file_id: Uuid,
    /// Object bucket.
    pub bucket: String,
    /// Object key.
    pub key: String,
    /// Object size in bytes.
    pub size_bytes: u64,
    /// Object content type.
    pub content_type: String,
    /// SHA-256 checksum, when known.
    pub checksum_sha256: Option<String>,
    /// Storage class.
    pub storage_class: String,
}

/// Conversion operation kinds planned for Phase 7.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConversionOperation {
    /// IFC ingestion.
    IfcIngest,
    /// IFC to glTF binary.
    IfcToGlb,
    /// IFC to 3D Tiles.
    #[serde(rename = "ifc_to_3dtiles")]
    IfcTo3dtiles,
    /// CAD conversion.
    CadConvert,
    /// CAD entity extraction.
    CadExtractEntities,
    /// PDF parse.
    PdfParse,
    /// OCR.
    Ocr,
    /// Office conversion.
    OfficeConvert,
    /// GIS tile generation.
    GisTile,
    /// Point cloud tiling.
    PointcloudTile,
    /// Panorama ingestion.
    PanoramaIngest,
    /// Media transcode.
    MediaTranscode,
    /// Gantt generation.
    GanttGenerate,
    /// Flow generation.
    FlowGenerate,
}

impl ConversionOperation {
    /// All Phase 7 conversion operation kinds.
    pub const ALL: [Self; 14] = [
        Self::IfcIngest,
        Self::IfcToGlb,
        Self::IfcTo3dtiles,
        Self::CadConvert,
        Self::CadExtractEntities,
        Self::PdfParse,
        Self::Ocr,
        Self::OfficeConvert,
        Self::GisTile,
        Self::PointcloudTile,
        Self::PanoramaIngest,
        Self::MediaTranscode,
        Self::GanttGenerate,
        Self::FlowGenerate,
    ];
}

/// Durable conversion job record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionJobRecord {
    /// Common database metadata.
    pub metadata: DurableRecordMetadata,
    /// Stable external job id.
    pub job_id: Uuid,
    /// Conversion operation.
    pub operation: ConversionOperation,
    /// Source asset id.
    pub source_asset_id: Uuid,
    /// Source file id.
    pub source_file_id: Uuid,
    /// Job status.
    pub status: String,
    /// Input payload.
    pub input: Value,
    /// Output payload.
    pub output: Value,
    /// Error payload.
    pub error: Value,
    /// Start timestamp.
    pub started_at: Option<DateTime<Utc>>,
    /// Finish timestamp.
    pub finished_at: Option<DateTime<Utc>>,
}

/// Query shape for listing conversion jobs.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConversionJobQuery {
    /// Optional operation filter.
    pub operation: Option<ConversionOperation>,
    /// Optional status filter.
    pub status: Option<String>,
    /// Optional page size.
    pub limit: Option<usize>,
    /// Optional numeric cursor.
    pub cursor: Option<String>,
}

/// Request body for creating a conversion job.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateConversionJobRequest {
    /// Conversion operation.
    pub operation: ConversionOperation,
    /// Source asset id.
    pub source_asset_id: Uuid,
    /// Source file id.
    pub source_file_id: Uuid,
    /// Input payload.
    #[serde(default)]
    pub input: Value,
    /// Optional actor fallback for legacy clients.
    pub actor: Option<String>,
}

/// Request body for conversion job actions.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionJobActionRequest {
    /// Optional actor fallback for legacy clients.
    pub actor: Option<String>,
    /// Optional cancellation reason.
    pub reason: Option<String>,
}

/// Conversion job list response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionJobListResponse {
    /// Total items in this page.
    pub total: usize,
    /// Conversion jobs.
    pub jobs: Vec<ConversionJobRecord>,
    /// Pagination metadata.
    pub page_info: PageInfo,
}

/// Asset registry durable store boundary.
pub trait AssetRegistryStore: Send + Sync {
    /// Put or replace an asset.
    ///
    /// # Errors
    /// Returns a harness error when the adapter rejects the record.
    fn put_asset(&self, record: AssetRecord) -> Result<AssetRecord>;

    /// List assets by tenant/project with deterministic pagination.
    ///
    /// # Errors
    /// Returns a harness error for invalid pagination.
    fn list_assets(
        &self,
        tenant_id: &str,
        project_id: &str,
        limit: Option<usize>,
        cursor: Option<&str>,
    ) -> Result<ListPage<AssetRecord>>;

    /// Put or replace an object binding.
    ///
    /// # Errors
    /// Returns a harness error when the adapter rejects the binding.
    fn put_object_binding(
        &self,
        record: ObjectStoreBindingRecord,
    ) -> Result<ObjectStoreBindingRecord>;
}

/// Query shape for listing assets.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetListQuery {
    /// Optional asset kind filter.
    pub kind: Option<AssetKind>,
    /// Optional asset status filter.
    pub status: Option<AssetStatus>,
    /// Optional page size.
    pub limit: Option<usize>,
    /// Optional numeric cursor.
    pub cursor: Option<String>,
}

/// Request body for creating an asset.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAssetRequest {
    /// Asset kind.
    pub kind: AssetKind,
    /// Display name.
    pub name: String,
    /// Original source format.
    pub source_format: Option<String>,
    /// Canonical normalized format.
    pub canonical_format: Option<String>,
    /// Extensible metadata.
    #[serde(default)]
    pub metadata: Value,
    /// Optional actor fallback for legacy clients.
    pub actor: Option<String>,
}

/// Request body for creating an asset version.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAssetVersionRequest {
    /// Version status.
    pub status: Option<AssetStatus>,
    /// Version metadata.
    #[serde(default)]
    pub metadata: Value,
    /// Optional actor fallback for legacy clients.
    pub actor: Option<String>,
}

/// Asset list response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetListResponse {
    /// Total items in this page.
    pub total: usize,
    /// Asset records.
    pub assets: Vec<AssetRecord>,
    /// Pagination metadata.
    pub page_info: PageInfo,
}

/// Request body for upload URL preparation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresignUploadRequest {
    /// Client file name.
    pub file_name: String,
    /// Content type.
    pub content_type: String,
    /// Optional declared size.
    pub size_bytes: Option<u64>,
    /// Optional checksum.
    pub checksum_sha256: Option<String>,
    /// Optional actor fallback for legacy clients.
    pub actor: Option<String>,
}

/// Upload URL preparation response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresignUploadResponse {
    /// Parent asset id.
    pub asset_id: Uuid,
    /// Reserved file id for completion.
    pub file_id: Uuid,
    /// HTTP method the client should use.
    pub method: String,
    /// Upload URL. In preview this is a deterministic local S3 boundary URL.
    pub upload_url: String,
    /// Required request headers.
    pub headers: HashMap<String, String>,
    /// Expiration timestamp.
    pub expires_at: DateTime<Utc>,
}

/// Request body for completing an upload.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteUploadRequest {
    /// File id returned by presign.
    pub file_id: Uuid,
    /// Object bucket.
    pub bucket: Option<String>,
    /// Object key.
    pub key: String,
    /// Size in bytes.
    pub size_bytes: u64,
    /// Content type.
    pub content_type: String,
    /// Optional checksum.
    pub checksum_sha256: Option<String>,
    /// Storage class.
    pub storage_class: Option<String>,
    /// File role.
    pub role: Option<String>,
    /// File format.
    pub format: Option<String>,
    /// Optional actor fallback for legacy clients.
    pub actor: Option<String>,
}

/// Upload completion response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteUploadResponse {
    /// File record.
    pub file: AssetFileRecord,
    /// Object-store binding.
    pub binding: ObjectStoreBindingRecord,
}

/// Download URL response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetFileDownloadResponse {
    /// Parent asset id.
    pub asset_id: Uuid,
    /// File id.
    pub file_id: Uuid,
    /// Preview download URL.
    pub download_url: String,
    /// Object-store binding.
    pub binding: ObjectStoreBindingRecord,
}

#[derive(Debug, Default)]
struct AssetRegistryState {
    assets: HashMap<Uuid, AssetRecord>,
    versions: HashMap<Uuid, Vec<AssetVersionRecord>>,
    files: HashMap<Uuid, Vec<AssetFileRecord>>,
    bindings: HashMap<Uuid, ObjectStoreBindingRecord>,
    conversion_jobs: HashMap<Uuid, ConversionJobRecord>,
}

/// In-memory Phase 7 asset registry preview service.
#[derive(Debug, Clone)]
pub struct AssetRegistryService {
    state: Arc<RwLock<AssetRegistryState>>,
    audit: Arc<ModuleAuditService>,
}

impl AssetRegistryService {
    /// Create an empty asset registry.
    #[must_use]
    pub fn new(audit: Arc<ModuleAuditService>) -> Self {
        Self {
            state: Arc::new(RwLock::new(AssetRegistryState::default())),
            audit,
        }
    }

    /// Create an asset in the caller scope.
    ///
    /// # Errors
    /// Returns permission or validation errors.
    pub fn create_asset_with_context(
        &self,
        context: &RequestContext,
        req: CreateAssetRequest,
    ) -> Result<AssetRecord> {
        PermissionGuard::ensure(context, RuntimePermission::AssetWrite)?;
        validate_name("name", &req.name)?;
        let now = Utc::now();
        let asset_id = Uuid::new_v4();
        let metadata = DurableRecordMetadata {
            id: asset_id,
            tenant_id: context.tenant_id.clone(),
            project_id: Some(context.project_id.clone()),
            created_at: now,
            updated_at: now,
            created_by: Some(context.actor.clone()),
        };
        let asset = AssetRecord {
            metadata: metadata.clone(),
            asset_id,
            kind: req.kind,
            name: req.name,
            status: AssetStatus::Draft,
            source_format: req.source_format,
            canonical_format: req.canonical_format,
            payload: with_context(req.metadata, context),
        };
        let version = AssetVersionRecord {
            metadata: DurableRecordMetadata {
                id: Uuid::new_v4(),
                ..metadata
            },
            asset_id,
            version: 1,
            status: AssetStatus::Draft,
            payload: with_context(serde_json::json!({ "initial": true }), context),
        };
        {
            let mut state = self.state.write();
            state.assets.insert(asset_id, asset.clone());
            state.versions.insert(asset_id, vec![version]);
        }
        self.audit_asset(
            context,
            AuditEventKind::AssetCreated,
            asset_id,
            "asset created",
        );
        Ok(asset)
    }

    /// List assets visible to the caller.
    ///
    /// # Errors
    /// Returns permission or pagination errors.
    pub fn list_assets_with_context(
        &self,
        context: &RequestContext,
        query: &AssetListQuery,
    ) -> Result<ListPage<AssetRecord>> {
        PermissionGuard::ensure(context, RuntimePermission::AssetRead)?;
        let mut items: Vec<AssetRecord> = self
            .state
            .read()
            .assets
            .values()
            .filter(|asset| asset.metadata.tenant_id == context.tenant_id)
            .filter(|asset| {
                asset.metadata.project_id.as_deref() == Some(context.project_id.as_str())
            })
            .filter(|asset| query.kind.is_none_or(|kind| asset.kind == kind))
            .filter(|asset| query.status.is_none_or(|status| asset.status == status))
            .cloned()
            .collect();
        items.sort_by_key(|asset| (asset.metadata.created_at, asset.asset_id));
        paginate(&items, query.limit, query.cursor.as_deref())
    }

    /// Read one asset.
    ///
    /// # Errors
    /// Returns permission, scope, or not-found errors.
    pub fn get_asset_with_context(
        &self,
        context: &RequestContext,
        asset_id: Uuid,
    ) -> Result<AssetRecord> {
        PermissionGuard::ensure(context, RuntimePermission::AssetRead)?;
        let asset = self
            .state
            .read()
            .assets
            .get(&asset_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("asset_id={asset_id}")))?;
        assert_asset_scope(context, &asset)?;
        Ok(asset)
    }

    /// Create an asset version.
    ///
    /// # Errors
    /// Returns permission, scope, not-found, or validation errors.
    pub fn create_version_with_context(
        &self,
        context: &RequestContext,
        asset_id: Uuid,
        req: CreateAssetVersionRequest,
    ) -> Result<AssetVersionRecord> {
        PermissionGuard::ensure(context, RuntimePermission::AssetWrite)?;
        let asset = self.get_asset_unscoped(asset_id)?;
        assert_asset_scope(context, &asset)?;
        let mut state = self.state.write();
        let versions = state.versions.entry(asset_id).or_default();
        let next = u32::try_from(versions.len())
            .unwrap_or(u32::MAX)
            .saturating_add(1);
        let version = AssetVersionRecord {
            metadata: DurableRecordMetadata::new(
                context.tenant_id.clone(),
                Some(context.project_id.clone()),
                Some(context.actor.clone()),
            ),
            asset_id,
            version: next,
            status: req.status.unwrap_or(AssetStatus::Draft),
            payload: with_context(req.metadata, context),
        };
        versions.push(version.clone());
        drop(state);
        self.audit_asset(
            context,
            AuditEventKind::AssetVersionCreated,
            asset_id,
            "asset version created",
        );
        Ok(version)
    }

    /// List versions for one asset.
    ///
    /// # Errors
    /// Returns permission, scope, or not-found errors.
    pub fn list_versions_with_context(
        &self,
        context: &RequestContext,
        asset_id: Uuid,
    ) -> Result<Vec<AssetVersionRecord>> {
        PermissionGuard::ensure(context, RuntimePermission::AssetRead)?;
        let asset = self.get_asset_unscoped(asset_id)?;
        assert_asset_scope(context, &asset)?;
        Ok(self
            .state
            .read()
            .versions
            .get(&asset_id)
            .cloned()
            .unwrap_or_default())
    }

    /// Prepare an upload URL.
    ///
    /// # Errors
    /// Returns permission, scope, or validation errors.
    pub fn presign_upload_with_context(
        &self,
        context: &RequestContext,
        asset_id: Uuid,
        req: PresignUploadRequest,
    ) -> Result<PresignUploadResponse> {
        PermissionGuard::ensure(context, RuntimePermission::AssetWrite)?;
        validate_name("file_name", &req.file_name)?;
        validate_name("content_type", &req.content_type)?;
        let asset = self.get_asset_unscoped(asset_id)?;
        assert_asset_scope(context, &asset)?;
        let file_id = Uuid::new_v4();
        let key = format!(
            "{}/{}/{asset_id}/{file_id}/{}",
            context.tenant_id,
            context.project_id,
            sanitize_key_segment(&req.file_name)
        );
        let headers = HashMap::from([("content-type".to_owned(), req.content_type)]);
        Ok(PresignUploadResponse {
            asset_id,
            file_id,
            method: "PUT".to_owned(),
            upload_url: format!("http://localhost:8333/{DEFAULT_BUCKET}/{key}"),
            headers,
            expires_at: Utc::now() + chrono::Duration::minutes(15),
        })
    }

    /// Complete upload metadata and object-store binding.
    ///
    /// # Errors
    /// Returns permission, scope, not-found, or validation errors.
    pub fn complete_upload_with_context(
        &self,
        context: &RequestContext,
        asset_id: Uuid,
        req: CompleteUploadRequest,
    ) -> Result<CompleteUploadResponse> {
        PermissionGuard::ensure(context, RuntimePermission::AssetWrite)?;
        validate_name("key", &req.key)?;
        validate_name("content_type", &req.content_type)?;
        let asset = self.get_asset_unscoped(asset_id)?;
        assert_asset_scope(context, &asset)?;
        let asset_version_id = self
            .state
            .read()
            .versions
            .get(&asset_id)
            .and_then(|versions| versions.last())
            .map(|version| version.metadata.id)
            .ok_or_else(|| HarnessError::NotFound(format!("asset versions for {asset_id}")))?;
        let file = AssetFileRecord {
            metadata: DurableRecordMetadata::new(
                context.tenant_id.clone(),
                Some(context.project_id.clone()),
                Some(context.actor.clone()),
            ),
            asset_id,
            asset_version_id,
            role: req.role.unwrap_or_else(|| "source".to_owned()),
            format: req.format.unwrap_or_else(|| "unknown".to_owned()),
            payload: with_context(serde_json::json!({ "completed": true }), context),
        };
        let binding = ObjectStoreBindingRecord {
            metadata: DurableRecordMetadata::new(
                context.tenant_id.clone(),
                Some(context.project_id.clone()),
                Some(context.actor.clone()),
            ),
            asset_id,
            asset_file_id: req.file_id,
            bucket: req.bucket.unwrap_or_else(|| DEFAULT_BUCKET.to_owned()),
            key: req.key,
            size_bytes: req.size_bytes,
            content_type: req.content_type,
            checksum_sha256: req.checksum_sha256,
            storage_class: req.storage_class.unwrap_or_else(|| "standard".to_owned()),
        };
        let file = AssetFileRecord {
            metadata: DurableRecordMetadata {
                id: req.file_id,
                ..file.metadata
            },
            ..file
        };
        {
            let mut state = self.state.write();
            // Phase 7 does not yet persist presign reservations. Until the
            // durable reservation table lands, a completed file id must be
            // globally unused so callers cannot overwrite an existing binding.
            let file_id_already_completed = state.bindings.contains_key(&req.file_id)
                || state
                    .files
                    .values()
                    .any(|files| files.iter().any(|file| file.metadata.id == req.file_id));
            if file_id_already_completed {
                return Err(HarnessError::InvalidInput(format!(
                    "file_id={} is already completed",
                    req.file_id
                )));
            }
            state.files.entry(asset_id).or_default().push(file.clone());
            state.bindings.insert(req.file_id, binding.clone());
        }
        self.audit_asset(
            context,
            AuditEventKind::AssetFileCompleted,
            asset_id,
            "asset file completed",
        );
        Ok(CompleteUploadResponse { file, binding })
    }

    /// Prepare a download URL for one asset file.
    ///
    /// # Errors
    /// Returns permission, scope, or not-found errors.
    pub fn download_file_with_context(
        &self,
        context: &RequestContext,
        asset_id: Uuid,
        file_id: Uuid,
    ) -> Result<AssetFileDownloadResponse> {
        PermissionGuard::ensure(context, RuntimePermission::AssetRead)?;
        let asset = self.get_asset_unscoped(asset_id)?;
        assert_asset_scope(context, &asset)?;
        let binding = {
            let state = self.state.read();
            let binding = state
                .bindings
                .get(&file_id)
                .cloned()
                .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
            if binding.asset_id != asset_id {
                return Err(HarnessError::NotFound(format!("file_id={file_id}")));
            }
            let file_belongs_to_asset = state.files.get(&asset_id).is_some_and(|files| {
                files
                    .iter()
                    .any(|file| file.asset_id == asset_id && file.metadata.id == file_id)
            });
            if !file_belongs_to_asset {
                return Err(HarnessError::NotFound(format!("file_id={file_id}")));
            }
            drop(state);
            binding
        };
        assert_runtime_scope(
            context,
            &binding.metadata.tenant_id,
            binding.metadata.project_id.as_deref().unwrap_or_default(),
        )?;
        self.audit_asset(
            context,
            AuditEventKind::AssetFileDownloadRequested,
            asset_id,
            "asset file download requested",
        );
        Ok(AssetFileDownloadResponse {
            asset_id,
            file_id,
            download_url: format!("http://localhost:8333/{}/{}", binding.bucket, binding.key),
            binding,
        })
    }

    /// Create a conversion job.
    ///
    /// # Errors
    /// Returns permission, scope, not-found, or validation errors.
    pub fn create_conversion_job_with_context(
        &self,
        context: &RequestContext,
        req: CreateConversionJobRequest,
    ) -> Result<ConversionJobRecord> {
        PermissionGuard::ensure(context, RuntimePermission::ConversionRun)?;
        let asset = self.get_asset_unscoped(req.source_asset_id)?;
        assert_asset_scope(context, &asset)?;
        self.get_file_unscoped(req.source_asset_id, req.source_file_id)?;
        let job_id = Uuid::new_v4();
        let job = ConversionJobRecord {
            metadata: DurableRecordMetadata::new(
                context.tenant_id.clone(),
                Some(context.project_id.clone()),
                Some(context.actor.clone()),
            ),
            job_id,
            operation: req.operation,
            source_asset_id: req.source_asset_id,
            source_file_id: req.source_file_id,
            status: "queued".to_owned(),
            input: with_context(req.input, context),
            output: serde_json::json!({}),
            error: serde_json::json!({}),
            started_at: None,
            finished_at: None,
        };
        self.state
            .write()
            .conversion_jobs
            .insert(job_id, job.clone());
        self.audit_asset(
            context,
            AuditEventKind::ConversionJobCreated,
            req.source_asset_id,
            "conversion job created",
        );
        Ok(job)
    }

    /// List conversion jobs visible to the caller.
    ///
    /// # Errors
    /// Returns permission or pagination errors.
    pub fn list_conversion_jobs_with_context(
        &self,
        context: &RequestContext,
        query: &ConversionJobQuery,
    ) -> Result<ListPage<ConversionJobRecord>> {
        PermissionGuard::ensure(context, RuntimePermission::AssetRead)?;
        let mut items: Vec<ConversionJobRecord> = self
            .state
            .read()
            .conversion_jobs
            .values()
            .filter(|job| job.metadata.tenant_id == context.tenant_id)
            .filter(|job| job.metadata.project_id.as_deref() == Some(context.project_id.as_str()))
            .filter(|job| {
                query
                    .operation
                    .is_none_or(|operation| job.operation == operation)
            })
            .filter(|job| {
                query
                    .status
                    .as_ref()
                    .is_none_or(|status| &job.status == status)
            })
            .cloned()
            .collect();
        items.sort_by_key(|job| (job.metadata.created_at, job.job_id));
        paginate(&items, query.limit, query.cursor.as_deref())
    }

    /// Read one conversion job.
    ///
    /// # Errors
    /// Returns permission, scope, or not-found errors.
    pub fn get_conversion_job_with_context(
        &self,
        context: &RequestContext,
        job_id: Uuid,
    ) -> Result<ConversionJobRecord> {
        PermissionGuard::ensure(context, RuntimePermission::AssetRead)?;
        let job = self.get_conversion_job_unscoped(job_id)?;
        assert_job_scope(context, &job)?;
        Ok(job)
    }

    /// Cancel one conversion job.
    ///
    /// # Errors
    /// Returns permission, scope, not-found, or invalid-state errors.
    pub fn cancel_conversion_job_with_context(
        &self,
        context: &RequestContext,
        job_id: Uuid,
        req: ConversionJobActionRequest,
    ) -> Result<ConversionJobRecord> {
        PermissionGuard::ensure(context, RuntimePermission::ConversionRun)?;
        let mut job = self.get_conversion_job_unscoped(job_id)?;
        assert_job_scope(context, &job)?;
        if matches!(job.status.as_str(), "completed" | "failed" | "cancelled") {
            return Err(HarnessError::InvalidInput(format!(
                "conversion job {job_id} is terminal"
            )));
        }
        "cancelled".clone_into(&mut job.status);
        job.finished_at = Some(Utc::now());
        job.error = with_context(
            serde_json::json!({ "reason": req.reason.unwrap_or_else(|| "cancelled".to_owned()) }),
            context,
        );
        job.metadata.updated_at = Utc::now();
        self.state
            .write()
            .conversion_jobs
            .insert(job_id, job.clone());
        self.audit_asset(
            context,
            AuditEventKind::ConversionJobCancelled,
            job.source_asset_id,
            "conversion job cancelled",
        );
        Ok(job)
    }

    fn get_asset_unscoped(&self, asset_id: Uuid) -> Result<AssetRecord> {
        self.state
            .read()
            .assets
            .get(&asset_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("asset_id={asset_id}")))
    }

    fn get_file_unscoped(&self, asset_id: Uuid, file_id: Uuid) -> Result<AssetFileRecord> {
        self.state
            .read()
            .files
            .get(&asset_id)
            .and_then(|files| {
                files
                    .iter()
                    .find(|file| file.metadata.id == file_id)
                    .cloned()
            })
            .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))
    }

    fn get_conversion_job_unscoped(&self, job_id: Uuid) -> Result<ConversionJobRecord> {
        self.state
            .read()
            .conversion_jobs
            .get(&job_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("job_id={job_id}")))
    }

    fn audit_asset(
        &self,
        context: &RequestContext,
        action: AuditEventKind,
        asset_id: Uuid,
        summary: &str,
    ) {
        let _ = self.audit.append(AuditEventInput {
            module_id: ASSET_AUDIT_MODULE_ID.to_owned(),
            actor: context.actor.clone(),
            action,
            target_type: "asset".to_owned(),
            target_id: asset_id.to_string(),
            summary: summary.to_owned(),
            metadata: serde_json::json!({
                "context": context.audit_json(),
                "assetId": asset_id,
            }),
        });
    }
}

fn assert_asset_scope(context: &RequestContext, asset: &AssetRecord) -> Result<()> {
    assert_runtime_scope(
        context,
        &asset.metadata.tenant_id,
        asset.metadata.project_id.as_deref().unwrap_or_default(),
    )
}

fn assert_job_scope(context: &RequestContext, job: &ConversionJobRecord) -> Result<()> {
    assert_runtime_scope(
        context,
        &job.metadata.tenant_id,
        job.metadata.project_id.as_deref().unwrap_or_default(),
    )
}

fn validate_name(field: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() {
        return Err(HarnessError::InvalidInput(format!("{field} is required")));
    }
    Ok(())
}

fn with_context(mut payload: Value, context: &RequestContext) -> Value {
    if let Some(object) = payload.as_object_mut() {
        object.insert("context".to_owned(), context.audit_json());
        return payload;
    }
    serde_json::json!({
        "value": payload,
        "context": context.audit_json(),
    })
}

fn sanitize_key_segment(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_') {
                ch
            } else {
                '_'
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::{
        AssetKind, AssetListQuery, AssetRegistryService, CompleteUploadRequest,
        ConversionJobActionRequest, ConversionJobQuery, ConversionOperation, CreateAssetRequest,
        CreateConversionJobRequest, PresignUploadRequest,
    };
    use crate::{
        module_audit::{AuditEventKind, AuditEventQuery, ModuleAuditService},
        runtime_context::{RequestContext, RequestContextInput, RuntimeProfile},
    };

    #[test]
    fn phase7_asset_kind_contract_contains_required_kinds() {
        assert_eq!(AssetKind::ALL.len(), 14);
        assert!(AssetKind::ALL.contains(&AssetKind::Ifc));
        assert!(AssetKind::ALL.contains(&AssetKind::PointCloud));
        assert!(AssetKind::ALL.contains(&AssetKind::Panorama));
    }

    #[test]
    fn conversion_operation_serializes_snake_case() {
        let value = serde_json::to_value(ConversionOperation::IfcTo3dtiles)
            .expect("operation should serialize");
        assert_eq!(value, serde_json::json!("ifc_to_3dtiles"));
    }

    #[test]
    fn asset_registry_enforces_scope_and_records_audit() {
        let audit = Arc::new(ModuleAuditService::new());
        let service = AssetRegistryService::new(Arc::clone(&audit));
        let context = test_context("tenant-a", "project-a", "engineer", "engineer");
        let asset = service
            .create_asset_with_context(
                &context,
                CreateAssetRequest {
                    kind: AssetKind::Ifc,
                    name: "sample.ifc".to_owned(),
                    source_format: Some("ifc".to_owned()),
                    canonical_format: Some("ifc4x3".to_owned()),
                    metadata: serde_json::json!({ "discipline": "architecture" }),
                    actor: None,
                },
            )
            .expect("engineer can create asset");

        let page = service
            .list_assets_with_context(&context, &AssetListQuery::default())
            .expect("engineer can list");
        assert_eq!(page.items.len(), 1);

        let other_tenant = test_context("tenant-b", "project-a", "auditor", "auditor");
        let hidden = service
            .list_assets_with_context(&other_tenant, &AssetListQuery::default())
            .expect("auditor can list own scope");
        assert!(hidden.items.is_empty());
        assert!(
            service
                .get_asset_with_context(&other_tenant, asset.asset_id)
                .is_err()
        );

        let events = audit
            .list(&AuditEventQuery {
                target_type: Some("asset".to_owned()),
                target_id: Some(asset.asset_id.to_string()),
                ..AuditEventQuery::default()
            })
            .expect("audit list should work");
        assert_eq!(events.items.len(), 1);
    }

    #[test]
    fn upload_contract_completes_binding_and_download_url() {
        let audit = Arc::new(ModuleAuditService::new());
        let service = AssetRegistryService::new(audit);
        let context = test_context("tenant-a", "project-a", "engineer", "engineer");
        let asset = service
            .create_asset_with_context(
                &context,
                CreateAssetRequest {
                    kind: AssetKind::PointCloud,
                    name: "scan.laz".to_owned(),
                    source_format: Some("laz".to_owned()),
                    canonical_format: None,
                    metadata: serde_json::json!({}),
                    actor: None,
                },
            )
            .expect("asset create");
        let presign = service
            .presign_upload_with_context(
                &context,
                asset.asset_id,
                PresignUploadRequest {
                    file_name: "scan.laz".to_owned(),
                    content_type: "application/octet-stream".to_owned(),
                    size_bytes: Some(42),
                    checksum_sha256: None,
                    actor: None,
                },
            )
            .expect("presign");
        let completed = service
            .complete_upload_with_context(
                &context,
                asset.asset_id,
                CompleteUploadRequest {
                    file_id: presign.file_id,
                    bucket: None,
                    key: "tenant-a/project-a/scan.laz".to_owned(),
                    size_bytes: 42,
                    content_type: "application/octet-stream".to_owned(),
                    checksum_sha256: Some("sha".to_owned()),
                    storage_class: None,
                    role: Some("source".to_owned()),
                    format: Some("laz".to_owned()),
                    actor: None,
                },
            )
            .expect("complete");
        let download = service
            .download_file_with_context(&context, asset.asset_id, completed.file.metadata.id)
            .expect("download");
        assert!(
            download
                .download_url
                .contains("tenant-a/project-a/scan.laz")
        );

        let job = service
            .create_conversion_job_with_context(
                &context,
                CreateConversionJobRequest {
                    operation: ConversionOperation::PointcloudTile,
                    source_asset_id: asset.asset_id,
                    source_file_id: completed.file.metadata.id,
                    input: serde_json::json!({ "target": "3dtiles" }),
                    actor: None,
                },
            )
            .expect("conversion job");
        assert_eq!(job.status, "queued");

        let jobs = service
            .list_conversion_jobs_with_context(&context, &ConversionJobQuery::default())
            .expect("list jobs");
        assert_eq!(jobs.items.len(), 1);

        let cancelled = service
            .cancel_conversion_job_with_context(
                &context,
                job.job_id,
                ConversionJobActionRequest {
                    actor: None,
                    reason: Some("smoke".to_owned()),
                },
            )
            .expect("cancel job");
        assert_eq!(cancelled.status, "cancelled");
    }

    #[test]
    fn download_rejects_file_from_different_asset_without_wrong_audit() {
        let audit = Arc::new(ModuleAuditService::new());
        let service = AssetRegistryService::new(audit.clone());
        let context = test_context("tenant-a", "project-a", "engineer", "engineer");
        let asset_a = create_test_asset(&service, &context, "asset-a.ifc");
        let asset_b = create_test_asset(&service, &context, "asset-b.ifc");
        let file_b = complete_test_upload(
            &service,
            &context,
            asset_b.asset_id,
            "tenant-a/project-a/asset-b.ifc",
            None,
        );

        let result =
            service.download_file_with_context(&context, asset_a.asset_id, file_b.file.metadata.id);

        assert!(result.is_err());
        assert_eq!(result.expect_err("download must fail").http_status(), 404);

        let wrong_asset_events = audit
            .list(&AuditEventQuery {
                target_type: Some("asset".to_owned()),
                target_id: Some(asset_a.asset_id.to_string()),
                limit: Some(10),
                ..AuditEventQuery::default()
            })
            .expect("audit list should work");
        assert!(
            wrong_asset_events
                .items
                .iter()
                .all(|event| event.action != AuditEventKind::AssetFileDownloadRequested),
            "failed cross-asset download must not audit success on route asset"
        );
    }

    #[test]
    fn complete_upload_rejects_duplicate_file_id_without_overwriting_binding() {
        let audit = Arc::new(ModuleAuditService::new());
        let service = AssetRegistryService::new(audit);
        let context = test_context("tenant-a", "project-a", "engineer", "engineer");
        let asset = create_test_asset(&service, &context, "scan.laz");
        let first = complete_test_upload(
            &service,
            &context,
            asset.asset_id,
            "tenant-a/project-a/scan-first.laz",
            None,
        );

        let duplicate = service.complete_upload_with_context(
            &context,
            asset.asset_id,
            CompleteUploadRequest {
                file_id: first.file.metadata.id,
                bucket: None,
                key: "tenant-a/project-a/scan-overwrite.laz".to_owned(),
                size_bytes: 99,
                content_type: "application/octet-stream".to_owned(),
                checksum_sha256: Some("sha-overwrite".to_owned()),
                storage_class: None,
                role: Some("source".to_owned()),
                format: Some("laz".to_owned()),
                actor: None,
            },
        );

        assert!(duplicate.is_err());
        assert_eq!(
            duplicate
                .expect_err("duplicate complete fails")
                .http_status(),
            400
        );

        let download = service
            .download_file_with_context(&context, asset.asset_id, first.file.metadata.id)
            .expect("original binding remains downloadable");
        assert!(download.download_url.contains("scan-first.laz"));
        assert_eq!(download.binding.size_bytes, 42);
        assert_eq!(download.binding.checksum_sha256.as_deref(), Some("sha"));
    }

    fn create_test_asset(
        service: &AssetRegistryService,
        context: &RequestContext,
        name: &str,
    ) -> super::AssetRecord {
        service
            .create_asset_with_context(
                context,
                CreateAssetRequest {
                    kind: AssetKind::PointCloud,
                    name: name.to_owned(),
                    source_format: Some("laz".to_owned()),
                    canonical_format: None,
                    metadata: serde_json::json!({}),
                    actor: None,
                },
            )
            .expect("asset create")
    }

    fn complete_test_upload(
        service: &AssetRegistryService,
        context: &RequestContext,
        asset_id: uuid::Uuid,
        key: &str,
        file_id: Option<uuid::Uuid>,
    ) -> super::CompleteUploadResponse {
        let presign = service
            .presign_upload_with_context(
                context,
                asset_id,
                PresignUploadRequest {
                    file_name: key.rsplit('/').next().unwrap_or(key).to_owned(),
                    content_type: "application/octet-stream".to_owned(),
                    size_bytes: Some(42),
                    checksum_sha256: None,
                    actor: None,
                },
            )
            .expect("presign");
        service
            .complete_upload_with_context(
                context,
                asset_id,
                CompleteUploadRequest {
                    file_id: file_id.unwrap_or(presign.file_id),
                    bucket: None,
                    key: key.to_owned(),
                    size_bytes: 42,
                    content_type: "application/octet-stream".to_owned(),
                    checksum_sha256: Some("sha".to_owned()),
                    storage_class: None,
                    role: Some("source".to_owned()),
                    format: Some("laz".to_owned()),
                    actor: None,
                },
            )
            .expect("complete")
    }

    fn test_context(tenant_id: &str, project_id: &str, actor: &str, role: &str) -> RequestContext {
        RequestContext::from_input(
            RequestContextInput {
                tenant_id: Some(tenant_id.to_owned()),
                project_id: Some(project_id.to_owned()),
                actor: Some(actor.to_owned()),
                roles: Some(vec![role.to_owned()]),
                ..RequestContextInput::default()
            },
            RuntimeProfile::Production,
        )
        .expect("context")
    }
}
