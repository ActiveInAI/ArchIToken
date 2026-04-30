//! Phase 7 asset registry contract types.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::{Result, durable_store::DurableRecordMetadata, module_pagination::ListPage};

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

#[cfg(test)]
mod tests {
    use super::{AssetKind, ConversionOperation};

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
}
