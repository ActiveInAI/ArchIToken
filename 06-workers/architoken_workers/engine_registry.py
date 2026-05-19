"""Engine adapter isolation registry.

This registry is deliberately runtime-facing: every dispatchable worker adapter
must declare how it is isolated from ArchIToken core code and what upstream
project it binds to. Capability is the first selection axis; copyleft,
open-core, desktop, and licensed ecosystems stay behind process/service
boundaries instead of being silently linked into core.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class IsolationMode(StrEnum):
    """Supported runtime isolation modes for engine adapters."""

    IN_PROCESS_LIBRARY = "in_process_library"
    EXTERNAL_PROCESS = "external_process"
    SIDECAR_SERVICE = "sidecar_service"
    LICENSED_SERVICE = "licensed_service"
    BROWSER_RUNTIME = "browser_runtime"
    REFERENCE_ONLY = "reference_only"


@dataclass(frozen=True)
class EnginePolicy:
    """Runtime policy for one upstream adapter."""

    adapter: str
    upstream: str
    source_url: str
    license: str
    isolation: IsolationMode
    production_rule: str
    dependency_keys: tuple[str, ...] = ()
    copyleft_boundary_required: bool = False

    def to_json(self) -> dict[str, object]:
        """Return a JSON-safe policy payload for worker results and audits."""

        return {
            "adapter": self.adapter,
            "upstream": self.upstream,
            "sourceUrl": self.source_url,
            "license": self.license,
            "isolation": self.isolation.value,
            "productionRule": self.production_rule,
            "dependencyKeys": list(self.dependency_keys),
            "copyleftBoundaryRequired": self.copyleft_boundary_required,
        }


ENGINE_POLICIES: dict[str, EnginePolicy] = {
    "ai_provider": EnginePolicy(
        "ai_provider",
        "ArchIToken provider router",
        "internal://architoken-provider-router",
        "service contract",
        IsolationMode.SIDECAR_SERVICE,
        "Only complete through the configured provider-router service; direct provider calls stay disabled.",
        ("ARCHITOKEN_AI_PROVIDER_ROUTER_URL",),
    ),
    "archive_package": EnginePolicy(
        "archive_package",
        "PeaZip / NanaZip compatible archive worker",
        "https://github.com/peazip/PeaZip",
        "LGPL-3.0 / upstream-specific review required",
        IsolationMode.EXTERNAL_PROCESS,
        "Inspect, hash, scan, extract, and repack archives only in an isolated worker process/container; the gateway never trusts ZIP paths or extracted bytes directly.",
        ("ARCHIVE_WORKER_URL", "7z"),
        True,
    ),
    "blender": EnginePolicy(
        "blender",
        "Blender",
        "https://github.com/blender/blender",
        "GPL-3.0-or-later",
        IsolationMode.EXTERNAL_PROCESS,
        "Run Blender headless as a separate process/container and persist derivative artifacts.",
        ("BLENDER_BINARY",),
        True,
    ),
    "bcf": EnginePolicy(
        "bcf",
        "buildingSMART BCF XML/API",
        "https://github.com/buildingSMART/BCF-XML",
        "NOASSERTION",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Parse only real BCF/BCFZIP packages into topic/comment/viewpoint artifacts.",
    ),
    "bsdd": EnginePolicy(
        "bsdd",
        "buildingSMART Data Dictionary",
        "https://github.com/buildingSMART/bSDD",
        "MIT",
        IsolationMode.SIDECAR_SERVICE,
        "Enrich classifications only through the configured bSDD API route.",
        ("BSDD_API_URL",),
    ),
    "build123d": EnginePolicy(
        "build123d",
        "build123d",
        "https://github.com/gumyr/build123d",
        "Apache-2.0",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Accept only structured CAD specs; never execute arbitrary user Python.",
        ("build123d",),
    ),
    "cadquery": EnginePolicy(
        "cadquery",
        "CadQuery",
        "https://github.com/CadQuery/cadquery",
        "Apache-2.0",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Accept only structured CAD specs; never execute arbitrary user Python.",
        ("cadquery", "OCP"),
    ),
    "buildingsmart_validate": EnginePolicy(
        "buildingsmart_validate",
        "buildingSMART Validate",
        "https://github.com/buildingSMART/validate",
        "MIT",
        IsolationMode.SIDECAR_SERVICE,
        "Run local IFC syntax/schema checks and, when configured, buildingSMART Validate service/CLI checks.",
        ("ifcopenshell", "BUILDINGSMART_VALIDATE_URL", "BUILDINGSMART_VALIDATE_OPERATION_PATH", "BUILDINGSMART_VALIDATE_BINARY"),
    ),
    "cesium_ion": EnginePolicy(
        "cesium_ion",
        "Cesium ion",
        "https://github.com/CesiumGS/cesium",
        "commercial service API",
        IsolationMode.SIDECAR_SERVICE,
        "Use Cesium ion only through token-gated upload/asset APIs; self-hosted tiles remain separate artifacts.",
        ("CESIUM_ION_TOKEN",),
    ),
    "cgal": EnginePolicy(
        "cgal",
        "CGAL / pygalmesh",
        "https://github.com/CGAL/cgal",
        "GPL-3.0-or-later/commercial",
        IsolationMode.EXTERNAL_PROCESS,
        "Run mesh generation in an isolated worker image unless commercial licensing is selected.",
        ("pygalmesh",),
        True,
    ),
    "chart_spec": EnginePolicy(
        "chart_spec",
        "AntV / ECharts-compatible specs",
        "https://github.com/antvis/G2",
        "MIT",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Persist typed chart specs only; frontend rendering uses reviewed visualization packages.",
    ),
    "docling": EnginePolicy(
        "docling",
        "Docling",
        "https://github.com/docling-project/docling",
        "MIT",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Parse local worker-mounted documents and persist Markdown/JSON artifacts.",
        ("docling",),
    ),
    "dxf": EnginePolicy(
        "dxf",
        "ezdxf",
        "https://github.com/mozman/ezdxf",
        "MIT",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Parse DXF only from mounted/object-store source bytes.",
        ("ezdxf",),
    ),
    "dwg": EnginePolicy(
        "dwg",
        "Licensed DWG adapter / Autodesk APS / ODA",
        "https://github.com/LibreDWG/libredwg",
        "licensed or GPL-3.0 sidecar",
        IsolationMode.LICENSED_SERVICE,
        "DWG must go through a configured legal service boundary or isolated LibreDWG/ODA sidecar; LibreDWG is GPL and cannot be linked into core.",
        ("DWG_ADAPTER_URL", "DWG_TO_DXF_PATH", "ODA_FILE_CONVERTER_PATH", "ARCHITOKEN_LIBREDWG_BIN", "LIBREDWG_BIN_DIR"),
        True,
    ),
    "ffmpeg": EnginePolicy(
        "ffmpeg",
        "FFmpeg",
        "https://github.com/FFmpeg/FFmpeg",
        "LGPL/GPL depending on build",
        IsolationMode.EXTERNAL_PROCESS,
        "Invoke ffmpeg/ffprobe binaries in the media worker; keep codec licensing tied to the image build.",
        ("ffmpeg",),
        True,
    ),
    "forgecad": EnginePolicy(
        "forgecad",
        "ForgeCAD CLI/service",
        "https://github.com/KoStard/ForgeCAD",
        "public repo plus hosted/CLI terms",
        IsolationMode.EXTERNAL_PROCESS,
        "Primary CAD generation route. Run ForgeCAD through an isolated service or CLI process; completed jobs must return real STEP/STL/render artifacts.",
        ("FORGECAD_URL", "FORGECAD_TOKEN", "forgecad"),
    ),
    "freecad": EnginePolicy(
        "freecad",
        "FreeCAD",
        "https://github.com/FreeCAD/FreeCAD",
        "LGPL-2.1",
        IsolationMode.EXTERNAL_PROCESS,
        "Run FreeCADCmd headless outside the gateway process for CAD conversion.",
        ("FreeCADCmd",),
        True,
    ),
    "geojson": EnginePolicy(
        "geojson",
        "GeoJSON / Python stdlib",
        "https://datatracker.ietf.org/doc/html/rfc7946",
        "standard",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Parse GeoJSON into metadata only; heavy GIS conversion routes through GDAL/PostGIS.",
    ),
    "ids": EnginePolicy(
        "ids",
        "buildingSMART IDS / ifctester",
        "https://github.com/buildingSMART/IDS",
        "NOASSERTION / LGPL stack",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Validate only supplied IDS+IFC files; no synthetic pass results.",
        ("ifctester",),
    ),
    "idm": EnginePolicy(
        "idm",
        "buildingSMART Information Delivery Manual",
        "https://www.buildingsmart.org/standards/bsi-standards/information-delivery-manual/",
        "ISO 29481 / buildingSMART standard",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Register structured IDM exchange requirements or source documents without inventing machine-readable content.",
    ),
    "ifcopenshell": EnginePolicy(
        "ifcopenshell",
        "IfcOpenShell",
        "https://github.com/IfcOpenShell/IfcOpenShell",
        "LGPL-3.0 / GPL tools",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Use library APIs for IFC parsing and external IfcConvert binary for derivatives.",
        ("ifcopenshell", "IfcConvert"),
        True,
    ),
    "ifcopenshell_text_to_bim": EnginePolicy(
        "ifcopenshell_text_to_bim",
        "IfcOpenShell",
        "https://github.com/IfcOpenShell/IfcOpenShell",
        "LGPL-3.0",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Generate IFC only from structured BIM specs, not arbitrary Python.",
        ("ifcopenshell",),
        True,
    ),
    "ifcdb_agent": EnginePolicy(
        "ifcdb_agent",
        "IFCDB-Agent v1.0.9",
        "https://github.com/DeeJoin/IFCDB-Agent/releases/tag/v1.0.9",
        "NOASSERTION",
        IsolationMode.SIDECAR_SERVICE,
        "Run IFC database, object graph, and agent query workflows through a configured isolated service; do not import unreviewed runtime code into the worker process.",
        (
            "IFCDB_AGENT_URL",
            "IFCDB_AGENT_VERSION",
            "IFCDB_AGENT_INDEX_PATH",
            "IFCDB_AGENT_QUERY_PATH",
            "IFCDB_AGENT_EXPORT_PATH",
            "IFCDB_AGENT_CLASH_PATH",
            "IFCDB_AGENT_QUANTITY_PATH",
        ),
    ),
    "imagemagick": EnginePolicy(
        "imagemagick",
        "ImageMagick",
        "https://github.com/ImageMagick/ImageMagick",
        "ImageMagick license",
        IsolationMode.EXTERNAL_PROCESS,
        "Invoke magick/convert as a bounded process for image derivatives.",
        ("magick", "convert"),
    ),
    "libreoffice": EnginePolicy(
        "libreoffice",
        "LibreOffice",
        "https://github.com/LibreOffice/core",
        "MPL-2.0/LGPL/GPL",
        IsolationMode.EXTERNAL_PROCESS,
        "Run LibreOffice headless as a separate process for Office conversion.",
        ("libreoffice",),
        True,
    ),
    "licensed_bim_adapter": EnginePolicy(
        "licensed_bim_adapter",
        "Licensed BIM/CAD conversion adapter",
        "https://github.com/specklesystems/speckle-server",
        "licensed service boundary",
        IsolationMode.LICENSED_SERVICE,
        "Use only through configured Autodesk/Revit, SketchUp, Rhino, Trimble/Speckle, or enterprise adapter APIs; completed jobs must return real IFC/GLB/STEP artifacts or persisted object references.",
        (
            "LICENSED_BIM_ADAPTER_URL",
            "RVT_ADAPTER_URL",
            "AUTODESK_APS_ADAPTER_URL",
            "SKETCHUP_ADAPTER_URL",
            "RHINO_ADAPTER_URL",
        ),
    ),
    "markitdown": EnginePolicy(
        "markitdown",
        "Microsoft MarkItDown",
        "https://github.com/microsoft/markitdown",
        "MIT",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Convert local mounted files to Markdown artifacts through the Python package.",
        ("markitdown",),
    ),
    "mermaid": EnginePolicy(
        "mermaid",
        "Mermaid CLI",
        "https://github.com/mermaid-js/mermaid",
        "MIT",
        IsolationMode.EXTERNAL_PROCESS,
        "Render typed diagram text through mmdc in a worker process.",
        ("mmdc",),
    ),
    "mineru": EnginePolicy(
        "mineru",
        "MinerU",
        "https://github.com/opendatalab/MinerU",
        "AGPL-3.0",
        IsolationMode.EXTERNAL_PROCESS,
        "Run MinerU as an isolated CLI/container for complex PDF extraction.",
        ("mineru",),
        True,
    ),
    "mupdf": EnginePolicy(
        "mupdf",
        "MuPDF",
        "https://github.com/ArtifexSoftware/mupdf",
        "AGPL-3.0/commercial",
        IsolationMode.EXTERNAL_PROCESS,
        "Use mutool as a process boundary or use a commercial license.",
        ("mutool",),
        True,
    ),
    "occt": EnginePolicy(
        "occt",
        "Open CASCADE Technology",
        "https://github.com/Open-Cascade-SAS/OCCT",
        "LGPL-2.1-with-exception",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Use OCP/OCCT bindings for STEP/IGES/BREP metadata and conversion.",
        ("OCP",),
    ),
    "open_design": EnginePolicy(
        "open_design",
        "Open Design service",
        "https://github.com/nexu-io/open-design",
        "service-reviewed",
        IsolationMode.SIDECAR_SERVICE,
        "Keep Open Design behind an HTTP service adapter until dependency/licensing are fully reviewed.",
        ("OPEN_DESIGN_URL",),
    ),
    "opencv": EnginePolicy(
        "opencv",
        "OpenCV",
        "https://github.com/opencv/opencv",
        "Apache-2.0",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Use opencv-python-headless for bounded image metadata/analysis jobs.",
        ("cv2",),
    ),
    "paddleocr": EnginePolicy(
        "paddleocr",
        "PaddleOCR",
        "https://github.com/PaddlePaddle/PaddleOCR",
        "Apache-2.0",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Run OCR only on real source PDFs/images and persist extracted blocks.",
        ("paddleocr",),
    ),
    "panorama": EnginePolicy(
        "panorama",
        "ArchIToken panorama graph",
        "internal://panorama-graph",
        "internal",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Persist panorama source/graph manifests from real source files only.",
    ),
    "pdal": EnginePolicy(
        "pdal",
        "PDAL",
        "https://github.com/PDAL/PDAL",
        "BSD-3-Clause",
        IsolationMode.EXTERNAL_PROCESS,
        "Invoke pdal CLI for point-cloud metadata and tiling inputs.",
        ("pdal",),
    ),
    "pdfium": EnginePolicy(
        "pdfium",
        "PDFium sidecar",
        "https://pdfium.googlesource.com/pdfium",
        "BSD-3-Clause",
        IsolationMode.SIDECAR_SERVICE,
        "Use only through an explicitly configured PDFium service contract.",
        ("PDFIUM_ADAPTER_URL",),
    ),
    "pointcloud_tiles": EnginePolicy(
        "pointcloud_tiles",
        "PDAL + Cesium ion",
        "https://github.com/PDAL/PDAL",
        "BSD-3-Clause + service terms",
        IsolationMode.EXTERNAL_PROCESS,
        "Create point-cloud metadata locally and upload/host tiles through the configured tiling route.",
        ("pdal", "CESIUM_ION_TOKEN"),
    ),
    "postgis": EnginePolicy(
        "postgis",
        "PostGIS/GDAL",
        "https://github.com/OSGeo/gdal",
        "MIT/X-style",
        IsolationMode.EXTERNAL_PROCESS,
        "Import vector data through ogr2ogr into a configured PostGIS database.",
        ("POSTGIS_DSN", "ogr2ogr"),
    ),
    "siyuan": EnginePolicy(
        "siyuan",
        "SiYuan",
        "https://github.com/siyuan-note/siyuan",
        "AGPL-3.0",
        IsolationMode.SIDECAR_SERVICE,
        "Integrate only through an isolated SiYuan API service.",
        ("SIYUAN_API_URL",),
        True,
    ),
    "speckle": EnginePolicy(
        "speckle",
        "Speckle Server",
        "https://github.com/specklesystems/speckle-server",
        "service-reviewed",
        IsolationMode.SIDECAR_SERVICE,
        "Send data only through a configured Speckle Server/API and token.",
        ("SPECKLE_SERVER_URL", "SPECKLE_TOKEN", "specklepy"),
    ),
    "step": EnginePolicy(
        "step",
        "Open CASCADE OCP",
        "https://github.com/CadQuery/OCP",
        "Apache-2.0",
        IsolationMode.IN_PROCESS_LIBRARY,
        "Read STEP metadata through OCP from real source files.",
        ("OCP",),
    ),
    "stirling_pdf": EnginePolicy(
        "stirling_pdf",
        "Stirling PDF",
        "https://github.com/Stirling-Tools/Stirling-PDF",
        "open-core",
        IsolationMode.SIDECAR_SERVICE,
        "Run as a self-hosted PDF service and call only configured API operations.",
        ("STIRLING_PDF_URL",),
    ),
}


def policy_for_adapter(adapter: str) -> EnginePolicy | None:
    """Return the runtime policy for an adapter id."""

    return ENGINE_POLICIES.get(adapter)


def policy_manifest() -> dict[str, dict[str, object]]:
    """Return a JSON-safe manifest for readiness checks and audits."""

    return {adapter: policy.to_json() for adapter, policy in sorted(ENGINE_POLICIES.items())}
