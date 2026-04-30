//! Viewer adapter command schema.
//!
//! This module defines backend-owned command contracts for frontend and
//! third-party viewers. It does not implement a frontend viewer and does not
//! import proprietary viewer loaders.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::storage_router::ViewerAdapterHint;

/// Viewer command supported by the `ViewerAdapter` contract.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ViewerCommandKind {
    /// Load an artifact into the viewer.
    LoadArtifact,
    /// Unload an artifact from the viewer.
    UnloadArtifact,
    /// Pick one element or screen location.
    Pick,
    /// Set element color.
    SetColor,
    /// Set element visibility.
    SetVisible,
    /// Set element opacity.
    SetOpacity,
    /// Isolate elements.
    Isolate,
    /// Clear isolation state.
    ClearIsolation,
    /// Offset elements.
    Offset,
    /// Clear element offset.
    ClearOffset,
    /// Rotate elements.
    Rotate,
    /// Clear element rotation.
    ClearRotate,
    /// Zoom to artifact or elements.
    ZoomTo,
    /// Capture a viewer snapshot.
    Snapshot,
    /// Export viewer image.
    ExportImage,
    /// Dispose viewer resources.
    Dispose,
}

/// Auditable viewer command payload.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewerAdapterCommand {
    /// Command id.
    pub id: Uuid,
    /// Viewer adapter hint.
    pub adapter: ViewerAdapterHint,
    /// Command kind.
    pub command: ViewerCommandKind,
    /// Optional artifact id.
    pub artifact_id: Option<Uuid>,
    /// Element ids targeted by the command.
    pub element_ids: Vec<String>,
    /// Command arguments such as color, opacity, transform, camera, or image format.
    pub arguments: serde_json::Value,
    /// Audit event id that records this viewer command.
    pub audit_event_id: Option<Uuid>,
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;

    use crate::storage_router::ViewerAdapterHint;

    use super::{ViewerAdapterCommand, ViewerCommandKind};

    #[test]
    fn viewer_adapter_command_schema_serializes() {
        let command = ViewerAdapterCommand {
            id: Uuid::new_v4(),
            adapter: ViewerAdapterHint::ThreeJs,
            command: ViewerCommandKind::SetColor,
            artifact_id: Some(Uuid::new_v4()),
            element_ids: vec!["architoken:wall:001".to_owned()],
            arguments: json!({ "color": "#ff6600" }),
            audit_event_id: Some(Uuid::new_v4()),
        };

        let encoded = serde_json::to_string(&command).expect("command serializes");
        let decoded: ViewerAdapterCommand =
            serde_json::from_str(&encoded).expect("command deserializes");
        assert_eq!(decoded.command, ViewerCommandKind::SetColor);
        assert_eq!(decoded.adapter, ViewerAdapterHint::ThreeJs);
        assert_eq!(decoded.element_ids, vec!["architoken:wall:001"]);
    }
}
