//! External generation engine protocol.
//!
//! This module defines JSON contracts for external AIGC engineering engines.
//! Large BIM/CAD/scene files are transferred by `downloadUrl` or referenced by
//! `objectUri`; binary engineering files must not be embedded as Base64 JSON.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Request sent to an external `TextToBim` engine.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextToBimEngineRequest {
    /// Generation job id.
    pub job_id: Uuid,
    /// Tenant id.
    pub tenant_id: String,
    /// Project id.
    pub project_id: String,
    /// Actor.
    pub actor: String,
    /// User prompt.
    pub prompt: String,
    /// Structured generation constraints.
    pub constraints: serde_json::Value,
    /// Requested output formats.
    pub output_formats: Vec<String>,
}

/// Response returned by an external `TextToBim` engine.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextToBimEngineResponse {
    /// Engine id.
    pub engine: String,
    /// Model or generator id.
    pub model: String,
    /// Human-readable summary.
    pub summary: String,
    /// Number of actual model/generator calls performed by the engine.
    pub model_calls: u32,
    /// Produced artifacts.
    pub artifacts: Vec<TextToBimEngineArtifact>,
}

/// Artifact metadata returned by an external `TextToBim` engine.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextToBimEngineArtifact {
    /// Artifact kind, for example `bim`.
    pub kind: String,
    /// Geometry format, for example `ifc`.
    pub geometry_format: String,
    /// MIME type, for example `model/ifc`.
    pub mime_type: String,
    /// Optional filename.
    pub filename: Option<String>,
    /// Development path: gateway downloads raw binary bytes from this URL.
    pub download_url: Option<String>,
    /// Production path: engine already wrote to object storage.
    pub object_uri: Option<String>,
    /// Optional size from the engine.
    pub size_bytes: Option<u64>,
    /// Optional checksum from the engine.
    pub checksum: Option<String>,
    /// Optional schema ref.
    pub schema_ref: Option<String>,
    /// Optional viewer adapter hint.
    pub viewer_adapter_hint: Option<String>,
}
