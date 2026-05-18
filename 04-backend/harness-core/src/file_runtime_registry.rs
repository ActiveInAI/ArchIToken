//! Backend-native file runtime registry.
//!
//! This registry maps source file extensions to the conversion operation and
//! isolated worker adapter that should handle the real bytes. It is deliberately
//! data-driven so new formats can be added without spreading extension checks
//! through gateway business logic.

use serde::Serialize;

use crate::asset_registry::{AssetKind, ConversionOperation};

/// Production readiness route for one source format.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum FileProductionRoute {
    /// In-process/open worker support exists for the source format.
    Ready,
    /// An open or local worker adapter must be installed/configured.
    AdapterRequired,
    /// The route must execute through an external process/container boundary.
    ExternalProcessRequired,
    /// The route requires a user-provided commercial/vendor license boundary.
    LicensedAdapterRequired,
}

/// One backend file runtime route.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRuntimeRoute {
    /// Lower-case extension without the leading dot.
    pub extension: &'static str,
    /// Canonical format id used in assets and artifacts.
    pub canonical_format: &'static str,
    /// Runtime family for UI/client grouping.
    pub family: &'static str,
    /// Phase 7 asset kind.
    pub asset_kind: AssetKind,
    /// Default conversion operation for this source format.
    pub operation: ConversionOperation,
    /// Default worker adapter id.
    pub default_adapter: &'static str,
    /// Production route state.
    pub production_route: FileProductionRoute,
    /// Semantic truth for engineering workflows.
    pub semantic_truth: &'static str,
    /// Applicable standards or contract anchors.
    pub standards: &'static [&'static str],
    /// Upstream open-source/service projects or vendor routes.
    pub upstream_projects: &'static [&'static str],
    /// Whether the worker must receive real source bytes before claiming work.
    pub source_required: bool,
    /// Short implementation note.
    pub note: &'static str,
}

/// User-requested high-priority backend source extensions.
pub const REQUESTED_ENGINE_EXTENSIONS: &[&str] = &[
    "dxf", "dwg", "rvt", "stel", "stl", "iges", "igs", "ifc", "skp", "3dm", "usd", "gltf", "glb",
    "obj", "fbx", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "mp3", "wav", "m4a", "flac", "mp4",
    "mkv", "mov", "avi", "jpg", "jpeg", "png", "webp", "gif", "pdf",
];

/// Return the canonical backend file runtime registry.
#[must_use]
#[allow(clippy::too_many_lines)]
pub fn list_file_runtime_routes() -> Vec<FileRuntimeRoute> {
    vec![
        route(
            "ifc",
            "ifc",
            "openbim",
            AssetKind::Ifc,
            ConversionOperation::IfcIngest,
            "ifcopenshell",
            FileProductionRoute::AdapterRequired,
            "buildingSMART IFC is the BIM semantic source of truth.",
            &[
                "IFC",
                "IDS",
                "bSDD",
                "BCF",
                "buildingSMART Validate",
                "OpenCDE",
            ],
            &["IfcOpenShell", "buildingSMART Validate", "IFCDB-Agent"],
            "IfcOpenShell worker emits IFC entity, relationship, property, spatial tree, geometry, and model manifests.",
        ),
        route(
            "dxf",
            "dxf",
            "cad",
            AssetKind::Cad,
            ConversionOperation::CadExtractEntities,
            "dxf",
            FileProductionRoute::Ready,
            "DXF is an input drawing source; BIM semantics still normalize through IFC/openBIM when needed.",
            &["DXF", "IFC mapping plan when converted to BIM"],
            &["ezdxf", "dxf-rs"],
            "DXF entity extraction is open-worker capable; publication still needs audit and approval.",
        ),
        route(
            "dwg",
            "dwg",
            "cad",
            AssetKind::Cad,
            ConversionOperation::CadConvert,
            "dwg",
            FileProductionRoute::LicensedAdapterRequired,
            "DWG is a proprietary source adapter, not the platform semantic truth.",
            &[
                "DWG adapter contract",
                "IFC mapping plan when converted to BIM",
            ],
            &["Autodesk APS", "ODA", "LibreDWG sidecar"],
            "DWG must use a licensed service/sidecar; GPL DWG code cannot link into the Rust gateway.",
        ),
        route(
            "rvt",
            "rvt",
            "vendor_bim",
            AssetKind::Ifc,
            ConversionOperation::CadConvert,
            "licensed_bim_adapter",
            FileProductionRoute::LicensedAdapterRequired,
            "RVT is accepted only as a vendor source that must export/bridge to IFC/openBIM.",
            &["IFC export", "IDS", "bSDD", "BCF"],
            &["Autodesk APS", "Revit IFC Exporter", "Speckle"],
            "Requires configured Autodesk/Revit or enterprise adapter; no direct RVT parser is embedded.",
        ),
        route(
            "rfa",
            "rfa",
            "vendor_bim",
            AssetKind::Ifc,
            ConversionOperation::CadConvert,
            "licensed_bim_adapter",
            FileProductionRoute::LicensedAdapterRequired,
            "RFA is accepted only through a vendor adapter and normalized to openBIM artifacts.",
            &["IFC export", "bSDD"],
            &["Autodesk APS", "Revit IFC Exporter"],
            "Family content stays license-gated and cannot become a core runtime dependency.",
        ),
        route(
            "skp",
            "skp",
            "vendor_bim",
            AssetKind::Model3d,
            ConversionOperation::CadConvert,
            "licensed_bim_adapter",
            FileProductionRoute::LicensedAdapterRequired,
            "SketchUp is a vendor model source; IFC/glTF derivatives are worker artifacts.",
            &["IFC mapping plan", "glTF derivative contract"],
            &["SketchUp adapter", "Speckle"],
            "Requires configured SketchUp/Speckle/enterprise adapter.",
        ),
        route(
            "3dm",
            "3dm",
            "vendor_bim",
            AssetKind::Model3d,
            ConversionOperation::CadConvert,
            "licensed_bim_adapter",
            FileProductionRoute::LicensedAdapterRequired,
            "Rhino 3DM is a source adapter; IFC/glTF/STEP derivatives are worker artifacts.",
            &["IFC mapping plan", "STEP/glTF derivative contract"],
            &["Rhino Compute", "Speckle Rhino", "OpenNURBS service"],
            "Requires configured Rhino/Speckle/enterprise adapter.",
        ),
        route(
            "step",
            "step",
            "cad",
            AssetKind::Cad,
            ConversionOperation::CadConvert,
            "occt",
            FileProductionRoute::AdapterRequired,
            "STEP is an open CAD exchange source, not BIM semantics by itself.",
            &["ISO 10303 STEP", "IFC mapping plan when converted to BIM"],
            &["Open CASCADE", "FreeCAD", "CadQuery OCP"],
            "OCCT/OCP handles metadata and BREP derivatives; FreeCAD can be selected for alternate exports.",
        ),
        route(
            "stp",
            "step",
            "cad",
            AssetKind::Cad,
            ConversionOperation::CadConvert,
            "occt",
            FileProductionRoute::AdapterRequired,
            "STP is a STEP alias.",
            &["ISO 10303 STEP"],
            &["Open CASCADE", "FreeCAD", "CadQuery OCP"],
            "Routes to the same OCCT worker path as .step.",
        ),
        route(
            "iges",
            "iges",
            "cad",
            AssetKind::Cad,
            ConversionOperation::CadConvert,
            "occt",
            FileProductionRoute::AdapterRequired,
            "IGES is an open CAD exchange source, not BIM semantics by itself.",
            &["IGES", "IFC mapping plan when converted to BIM"],
            &["Open CASCADE", "FreeCAD", "CadQuery OCP"],
            "OCCT/OCP reads IGES and emits metadata/BREP derivatives.",
        ),
        route(
            "igs",
            "iges",
            "cad",
            AssetKind::Cad,
            ConversionOperation::CadConvert,
            "occt",
            FileProductionRoute::AdapterRequired,
            "IGS is an IGES alias.",
            &["IGES"],
            &["Open CASCADE", "FreeCAD", "CadQuery OCP"],
            "Routes to the same OCCT worker path as .iges.",
        ),
        route(
            "stl",
            "stl",
            "mesh",
            AssetKind::Model3d,
            ConversionOperation::CadConvert,
            "blender",
            FileProductionRoute::ExternalProcessRequired,
            "STL is mesh geometry only; it does not carry BIM semantics.",
            &["STL", "glTF derivative contract"],
            &["Blender", "FreeCAD"],
            "Blender external process converts inspectable mesh derivatives such as GLB.",
        ),
        route(
            "stel",
            "stel_unverified",
            "cad",
            AssetKind::Unknown,
            ConversionOperation::CadConvert,
            "licensed_bim_adapter",
            FileProductionRoute::LicensedAdapterRequired,
            "STEL is not a recognized openBIM/CAD baseline extension in the current truth set.",
            &["project-supplied adapter contract required"],
            &["licensed enterprise adapter"],
            "Mapped explicitly so uploads fail closed with an adapter requirement instead of being misread as STL/STEP.",
        ),
        route(
            "obj",
            "obj",
            "mesh",
            AssetKind::Model3d,
            ConversionOperation::CadConvert,
            "blender",
            FileProductionRoute::ExternalProcessRequired,
            "OBJ is a mesh source; BIM semantics require IFC/openBIM mapping.",
            &["OBJ", "glTF derivative contract"],
            &["Blender"],
            "Blender external process normalizes OBJ to GLB derivatives.",
        ),
        route(
            "fbx",
            "fbx",
            "mesh",
            AssetKind::Model3d,
            ConversionOperation::CadConvert,
            "blender",
            FileProductionRoute::ExternalProcessRequired,
            "FBX is a scene/mesh source; BIM semantics require IFC/openBIM mapping.",
            &["FBX", "glTF derivative contract"],
            &["Blender"],
            "Blender external process normalizes FBX to GLB derivatives.",
        ),
        route(
            "gltf",
            "gltf",
            "mesh",
            AssetKind::Model3d,
            ConversionOperation::CadConvert,
            "blender",
            FileProductionRoute::ExternalProcessRequired,
            "glTF is an open runtime/derivative format, not the BIM semantic truth.",
            &["glTF 2.0", "IFC source binding when BIM-derived"],
            &["Blender", "Khronos glTF"],
            "Blender can validate/normalize glTF and emit GLB derivatives.",
        ),
        route(
            "glb",
            "glb",
            "mesh",
            AssetKind::Model3d,
            ConversionOperation::CadConvert,
            "blender",
            FileProductionRoute::ExternalProcessRequired,
            "GLB is a binary glTF runtime/derivative format.",
            &["glTF 2.0", "IFC source binding when BIM-derived"],
            &["Blender", "Khronos glTF"],
            "GLB remains tied to its source asset and audit trail.",
        ),
        route(
            "usd",
            "usd",
            "scene",
            AssetKind::Model3d,
            ConversionOperation::CadConvert,
            "blender",
            FileProductionRoute::ExternalProcessRequired,
            "USD is a scene exchange source; BIM semantics require IFC/openBIM mapping.",
            &["OpenUSD", "glTF derivative contract"],
            &["Blender", "OpenUSD"],
            "Blender USD import path is external-process only.",
        ),
        route(
            "usda",
            "usd",
            "scene",
            AssetKind::Model3d,
            ConversionOperation::CadConvert,
            "blender",
            FileProductionRoute::ExternalProcessRequired,
            "USDA is a textual USD alias.",
            &["OpenUSD"],
            &["Blender", "OpenUSD"],
            "Routes to the same external Blender path as .usd.",
        ),
        route(
            "usdc",
            "usd",
            "scene",
            AssetKind::Model3d,
            ConversionOperation::CadConvert,
            "blender",
            FileProductionRoute::ExternalProcessRequired,
            "USDC is a binary USD alias.",
            &["OpenUSD"],
            &["Blender", "OpenUSD"],
            "Routes to the same external Blender path as .usd.",
        ),
        route(
            "usdz",
            "usd",
            "scene",
            AssetKind::Model3d,
            ConversionOperation::CadConvert,
            "blender",
            FileProductionRoute::ExternalProcessRequired,
            "USDZ is a packaged USD alias.",
            &["OpenUSD"],
            &["Blender", "OpenUSD"],
            "Routes to the same external Blender path as .usd.",
        ),
        office("docx", "word"),
        office("doc", "word"),
        office("xlsx", "spreadsheet"),
        office("xls", "spreadsheet"),
        office("pptx", "presentation"),
        office("ppt", "presentation"),
        media("mp3", AssetKind::Audio, "audio", "ffmpeg"),
        media("wav", AssetKind::Audio, "audio", "ffmpeg"),
        media("m4a", AssetKind::Audio, "audio", "ffmpeg"),
        media("flac", AssetKind::Audio, "audio", "ffmpeg"),
        media("mp4", AssetKind::Video, "video", "ffmpeg"),
        media("mkv", AssetKind::Video, "video", "ffmpeg"),
        media("mov", AssetKind::Video, "video", "ffmpeg"),
        media("avi", AssetKind::Video, "video", "ffmpeg"),
        media("jpg", AssetKind::Image, "image", "paddleocr"),
        media("jpeg", AssetKind::Image, "image", "paddleocr"),
        media("png", AssetKind::Image, "image", "paddleocr"),
        media("webp", AssetKind::Image, "image", "paddleocr"),
        media("gif", AssetKind::Image, "image", "paddleocr"),
        route(
            "pdf",
            "pdf",
            "document",
            AssetKind::Pdf,
            ConversionOperation::PdfParse,
            "docling",
            FileProductionRoute::AdapterRequired,
            "PDF is a document/source record; AI extraction cannot replace the signed source.",
            &["PDF/PDF-A policy", "project document control"],
            &["Docling", "MarkItDown", "PDFium", "MuPDF"],
            "Docling is the default parse route; PDFium/MuPDF remain sidecar options.",
        ),
    ]
}

/// Find one route by extension or by a filename.
#[must_use]
pub fn route_for_extension(value: &str) -> Option<FileRuntimeRoute> {
    let ext = normalize_extension(value)?;
    list_file_runtime_routes()
        .into_iter()
        .find(|route| route.extension == ext.as_str())
}

/// Find one route by file name.
#[must_use]
pub fn route_for_file_name(file_name: &str) -> Option<FileRuntimeRoute> {
    file_name
        .rsplit_once('.')
        .and_then(|(_, ext)| route_for_extension(ext))
}

/// Select the default adapter for a conversion job and source file name.
#[must_use]
pub fn default_adapter_for_conversion_source(
    operation: ConversionOperation,
    file_name: &str,
) -> Option<&'static str> {
    let route = route_for_file_name(file_name)?;
    if route.operation == operation || compatible_operation(operation, route.operation) {
        return Some(route.default_adapter);
    }
    None
}

/// Return true when all requested extensions have an explicit route.
#[must_use]
pub fn requested_extensions_are_mapped() -> bool {
    REQUESTED_ENGINE_EXTENSIONS
        .iter()
        .all(|extension| route_for_extension(extension).is_some())
}

const fn compatible_operation(requested: ConversionOperation, routed: ConversionOperation) -> bool {
    matches!(
        (requested, routed),
        (
            ConversionOperation::CadConvert,
            ConversionOperation::CadExtractEntities
        ) | (
            ConversionOperation::CadExtractEntities,
            ConversionOperation::CadConvert
        )
    )
}

#[allow(clippy::too_many_arguments)]
const fn route(
    extension: &'static str,
    canonical_format: &'static str,
    family: &'static str,
    asset_kind: AssetKind,
    operation: ConversionOperation,
    default_adapter: &'static str,
    production_route: FileProductionRoute,
    semantic_truth: &'static str,
    standards: &'static [&'static str],
    upstream_projects: &'static [&'static str],
    note: &'static str,
) -> FileRuntimeRoute {
    FileRuntimeRoute {
        extension,
        canonical_format,
        family,
        asset_kind,
        operation,
        default_adapter,
        production_route,
        semantic_truth,
        standards,
        upstream_projects,
        source_required: true,
        note,
    }
}

const fn office(extension: &'static str, family: &'static str) -> FileRuntimeRoute {
    route(
        extension,
        extension,
        family,
        AssetKind::Office,
        ConversionOperation::OfficeConvert,
        "libreoffice",
        FileProductionRoute::ExternalProcessRequired,
        "Office files are source records; conversion derivatives cannot replace native originals.",
        &[
            "project document control",
            "OOXML/legacy Office source binding",
        ],
        &["LibreOffice", "MarkItDown"],
        "LibreOffice headless binds the native source and exports only explicit derivatives.",
    )
}

const fn media(
    extension: &'static str,
    asset_kind: AssetKind,
    family: &'static str,
    adapter: &'static str,
) -> FileRuntimeRoute {
    let operation = if matches!(asset_kind, AssetKind::Image) {
        ConversionOperation::Ocr
    } else {
        ConversionOperation::MediaTranscode
    };
    route(
        extension,
        extension,
        family,
        asset_kind,
        operation,
        adapter,
        FileProductionRoute::ExternalProcessRequired,
        "Media files are evidence/source records; derivatives preserve source binding and audit.",
        &["project evidence control", "object-store artifact binding"],
        &["FFmpeg", "ImageMagick", "PaddleOCR"],
        "Media routes produce thumbnails, transcodes, OCR, or waveform derivatives from real bytes.",
    )
}

fn normalize_extension(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_start_matches('.').to_ascii_lowercase();
    (!trimmed.is_empty()).then_some(trimmed)
}

#[cfg(test)]
mod tests {
    use super::{
        FileProductionRoute, REQUESTED_ENGINE_EXTENSIONS, default_adapter_for_conversion_source,
        requested_extensions_are_mapped, route_for_extension,
    };
    use crate::asset_registry::ConversionOperation;

    #[test]
    fn registry_covers_requested_priority_extensions() {
        assert!(requested_extensions_are_mapped());
        for extension in REQUESTED_ENGINE_EXTENSIONS {
            assert!(
                route_for_extension(extension).is_some(),
                "missing route for {extension}"
            );
        }
    }

    #[test]
    fn registry_covers_user_requested_native_and_lightweight_formats() {
        let user_requested_extensions = [
            "dxf", "dwg", "rvt", "stel", "stl", "iges", "igs", "ifc", "skp", "3dm", "usd", "gltf",
            "glb", "obj", "fbx", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "mp3", "wav", "m4a",
            "flac", "mp4", "mkv", "mov", "avi", "jpg", "jpeg", "png", "webp", "gif", "pdf",
        ];

        for extension in user_requested_extensions {
            let route = route_for_extension(extension)
                .unwrap_or_else(|| panic!("missing runtime route for {extension}"));
            assert!(
                route.source_required,
                "route for {extension} must bind real source bytes"
            );
            assert!(
                !route.default_adapter.is_empty(),
                "route for {extension} must declare an adapter boundary"
            );
        }
    }

    #[test]
    fn private_formats_fail_closed_to_licensed_adapters() {
        for extension in ["dwg", "rvt", "skp", "3dm", "stel"] {
            let route = route_for_extension(extension).expect("route must exist");
            assert_eq!(
                route.production_route,
                FileProductionRoute::LicensedAdapterRequired
            );
            assert!(!route.default_adapter.is_empty());
        }
    }

    #[test]
    fn openbim_and_open_geometry_routes_pick_expected_adapters() {
        assert_eq!(
            default_adapter_for_conversion_source(ConversionOperation::IfcIngest, "model.ifc"),
            Some("ifcopenshell")
        );
        assert_eq!(
            default_adapter_for_conversion_source(ConversionOperation::CadConvert, "part.iges"),
            Some("occt")
        );
        assert_eq!(
            default_adapter_for_conversion_source(ConversionOperation::CadConvert, "scene.usd"),
            Some("blender")
        );
        assert_eq!(
            default_adapter_for_conversion_source(
                ConversionOperation::OfficeConvert,
                "report.docx"
            ),
            Some("libreoffice")
        );
    }
}
