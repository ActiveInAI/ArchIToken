# ArchIToken Adapter Source Map

Status: active development source map.

This file records the upstream projects and the hard integration rule for CAD, BIM, Office, PDF, image, video, voice, and AI generation adapters.

## Non-negotiable Runtime Rule

ArchIToken must not fabricate file bytes or fake successful parsing.

Every preview, conversion, or generation result must come from one of these routes:

1. Browser-native rendering of the original uploaded file stream.
2. A real worker derivative written to object storage.
3. A configured production service adapter.
4. An explicit failure that names the missing adapter or missing dependency.

Seed registry rows are metadata only until bound to object storage bytes. They must not be rendered through generated placeholder PDF, SVG, GLTF, Office, or media content.

## Upstream Projects

| Area                    | Upstream                                                               | Use in ArchIToken                                                | Status                                            |
| ----------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| openBIM standards       | https://github.com/buildingSMART                                       | IFC, IDS, BCF, bSDD contract truth source                        | selected                                          |
| Autodesk ecosystem      | https://github.com/Autodesk                                            | RVT/DWG and Autodesk Platform Services integration boundary      | licensed_gated                                    |
| Trimble/Tekla ecosystem | https://github.com/TrimbleSolutionsCorporation                         | Tekla/steel model integration boundary                           | licensed_gated                                    |
| BIMserver library       | https://github.com/opensourceBIM/BuildingSMARTLibrary                  | BIMserver/openBIM reference integration                          | candidate                                         |
| Geometry kernel         | https://github.com/Open-Cascade-SAS/OCCT                               | STEP/STP/IGES/BREP geometry read, heal, mesh, and export         | selected native worker dependency                 |
| Parametric CAD          | https://github.com/CadQuery/cadquery                                   | Python CAD generation on OCCT/OCP                                | selected worker dependency                        |
| Parametric CAD UI       | https://github.com/CadQuery/CQ-editor                                  | CAD authoring UX reference, not embedded wholesale               | reference                                         |
| Browser CAD             | https://github.com/xiangechen/chili3d                                  | Browser CAD/editor reference for future module UI                | candidate                                         |
| Geometry algorithms     | https://github.com/CGAL/cgal                                           | mesh/geometry algorithms                                         | candidate, license review required                |
| CGAL Python binding     | https://github.com/CGAL/cgal-swig-bindings                             | Python-accessible CGAL route                                     | candidate, GPL/commercial license review required |
| OCCT Python binding     | https://github.com/CadQuery/OCP                                        | OCCT Python binding used by CadQuery style workers               | selected worker dependency                        |
| IFC BIMserver plugin    | https://github.com/opensourceBIM/IfcOpenShell-BIMserver-plugin         | IFC/BIMserver bridge reference                                   | candidate                                         |
| IFC LCA                 | https://github.com/IfcLCA/IfcLCA                                       | IFC material/quantity/LCA workflow reference                     | candidate, AGPL review required                   |
| IFC visual flow         | https://github.com/louistrue/ifc-flow                                  | Node-based IFC workflow reference                                | candidate                                         |
| IFC core parser         | https://github.com/IfcOpenShell/IfcOpenShell                           | IFC parsing, geometry, conversion, validation                    | selected worker dependency                        |
| IFC database/agent      | https://github.com/DeeJoin/IFCDB-Agent                                 | IFC-native database and agent reference                          | candidate                                         |
| Agent/Office workflow   | https://github.com/iOfficeAI/AionUi/blob/main/docs/readme/readme_ch.md | Office generation/editing workflow reference                     | reference                                         |
| PDF tooling             | https://github.com/Stirling-Tools/Stirling-PDF                         | PDF split/merge/OCR/conversion service adapter                   | selected service adapter                          |
| OCR                     | https://github.com/PaddlePaddle/PaddleOCR                              | PDF/image OCR worker                                             | selected worker dependency                        |
| Document conversion     | https://github.com/microsoft/markitdown                                | DOC/DOCX/XLS/XLSX/PPT/PDF/image/audio document-to-Markdown route | selected worker dependency                        |
| Excel                   | https://github.com/qax-os/excelize                                     | Spreadsheet read/write/generation route through Go sidecar       | selected sidecar candidate                        |
| Office editing          | https://github.com/dream-num/univer/blob/dev/docs/readme/zh-CN.md      | AI-native document, spreadsheet, and presentation editing core   | selected OSS editor; import/export via worker     |
| Data visualization      | https://github.com/antvis                                              | flowchart, graph, gantt, mindmap, GIS/analytic visualization     | selected package family                           |

## Upstream Decision Registry

Canonical runtime registry: `03-frontend/lib/adapter-source-registry.ts`.

Decision meanings:

- `selected`: can be used as a priority adapter/spec source after normal dependency review.
- `selected_external_process`: usable only behind a service/process boundary; do not vendor/link into core.
- `licensed_gated`: usable only with user-provided official license, credentials, SDK/runtime, and adapter config.
- `reference_only`: useful for architecture/UI/spec study, but not a runtime dependency.
- `sample_data`: fixture source only; store attribution and license notes before adding files.
- `blocked_pending_license`: do not use until license/repo status is resolved.

| Source                                                                          | Decision                  | Runtime judgment                                                                                                                          |
| ------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| https://github.com/buildingSMART                                                | selected                  | Canonical openBIM standards organization; contract source for IFC/IDS/BCF/bSDD.                                                           |
| https://github.com/buildingSMART/OpenCDE-API                                    | reference_only            | Archived and no detected license; historical OpenCDE contract reference only.                                                             |
| https://github.com/buildingSMART/IFC                                            | reference_only            | Archived schema repo with no asserted license; schema truth source, not vendored runtime code.                                            |
| https://github.com/buildingSMART/bSDD                                           | selected                  | MIT; use for classification API/schema contracts.                                                                                         |
| https://github.com/buildingSMART/IDS                                            | selected                  | Active IDS standard; validate through schema/audit adapters, avoid copying unlicensed assets.                                             |
| https://github.com/buildingSMART/BCF-API                                        | selected                  | Active BCF API contract for issue collaboration.                                                                                          |
| https://github.com/buildingSMART/BCF-XML                                        | selected                  | Active BCF XML contract for file exchange and validation.                                                                                 |
| https://github.com/buildingSMART/IFC4.x-development                             | reference_only            | Active IFC4.3 workstream; track schema changes, not runtime dependency.                                                                   |
| https://github.com/buildingSMART/IFC4.3.x-sample-models                         | sample_data               | Test fixtures only after attribution/license note.                                                                                        |
| https://github.com/buildingSMART/Sample-Test-Files                              | sample_data               | Compatibility fixtures only; no production dependency.                                                                                    |
| https://github.com/buildingSMART/IFC5-development                               | reference_only            | Future IFC5 tracking only; no production compatibility claim.                                                                             |
| https://github.com/buildingSMART/validate                                       | selected                  | MIT validation service; priority IFC validation adapter.                                                                                  |
| https://github.com/buildingSMART/IDS-Audit-tool                                 | selected                  | MIT IDS audit tool; priority IDS validation adapter.                                                                                      |
| https://github.com/buildingSMART/ifc-gherkin-rules                              | selected                  | MIT rules; usable for CI-style IFC validation.                                                                                            |
| https://github.com/buildingSMART/IFC4.x-IF                                      | reference_only            | Implementers Forum reference.                                                                                                             |
| https://github.com/buildingSMART/foundation-API                                 | reference_only            | Shared API elements for BCF/OpenCDE-style routes.                                                                                         |
| https://github.com/ThatOpen                                                     | reference_only            | Organization-level URL; select concrete repos before dependency use.                                                                      |
| https://github.com/Autodesk                                                     | licensed_gated            | RVT/RFA/DWG/APS/Revit/AutoCAD routes require official Autodesk terms and credentials.                                                     |
| https://github.com/TrimbleSolutionsCorporation                                  | licensed_gated            | Tekla/Trimble routes require official runtime, license, and partner/API terms.                                                            |
| https://github.com/mcneel                                                       | licensed_gated            | Rhino/Grasshopper/3DM routes require compatible SDK/runtime licensing.                                                                    |
| https://github.com/KoStard/ForgeCAD                                             | reference_only            | No detected license; study only until license is explicit.                                                                                |
| https://github.com/pascalorg/editor                                             | selected                  | MIT browser architectural editor candidate.                                                                                               |
| https://github.com/blender/blender                                              | selected_external_process | Blender is usable as an external process/service for model/render/video jobs; do not link GPL core code.                                  |
| https://github.com/DynamoDS/DynamoText                                          | licensed_gated            | Dynamo/Revit runtime dependency; gated by Autodesk/Dynamo installation and license.                                                       |
| https://github.com/DynamoDS                                                     | licensed_gated            | Organization-level Dynamo ecosystem; use only through licensed runtime routes.                                                            |
| https://github.com/datadrivenconstruction/OpenConstructionERP                   | selected_external_process | AGPL-declared ERP reference; external service/API boundary only.                                                                          |
| https://github.com/frappe/erpnext                                               | selected_external_process | GPL-3.0 ERP; integrate as external service/API, not vendored core code.                                                                   |
| https://github.com/specklesystems                                               | reference_only            | Organization-level source; use concrete Apache-2.0 SDK/exporter repos below.                                                              |
| https://github.com/specklesystems/speckle_automate_python_example               | selected                  | Apache-2.0 automation template for workers.                                                                                               |
| https://github.com/specklesystems/speckle-automate-qa_qc_workshop               | selected                  | Apache-2.0 QA/QC workflow reference.                                                                                                      |
| https://github.com/specklesystems/speckle-automate-checker                      | selected                  | Apache-2.0 model checker source.                                                                                                          |
| https://github.com/specklesystems/speckle-server                                | reference_only            | No detected SPDX license from GitHub API; review before runtime use.                                                                      |
| https://github.com/schauh11/revit-mcp-server                                    | licensed_gated            | MIT bridge code, but real Revit runtime is proprietary and user-licensed.                                                                 |
| https://github.com/specklesystems/speckle-connectors-dui                        | reference_only            | No detected license; UI reference only.                                                                                                   |
| https://github.com/specklesystems/speckle-sharp-sdk                             | selected                  | Apache-2.0 .NET SDK candidate for connector sidecars.                                                                                     |
| https://github.com/specklesystems/IFC-Exporter                                  | selected                  | Apache-2.0 IFC exporter candidate.                                                                                                        |
| https://github.com/specklesystems/speckle-blender                               | selected_external_process | Apache-2.0 connector plus Blender external process route.                                                                                 |
| https://github.com/specklesystems/SpeckleConWorkshop-QAQC                       | selected                  | Apache-2.0 QA/QC sample source.                                                                                                           |
| https://github.com/specklesystems/speckle-excel                                 | reference_only            | Archived; historical Excel connector only.                                                                                                |
| https://github.com/specklesystems/speckle-sketchup                              | licensed_gated            | Apache connector code, but SketchUp runtime is user-licensed.                                                                             |
| https://github.com/specklesystems/IFC-Exporter-Rhino                            | licensed_gated            | Apache connector code, gated by Rhino runtime/license.                                                                                    |
| https://github.com/specklesystems/IFC-Exporter-Grasshopper                      | licensed_gated            | Apache connector code, gated by Rhino/Grasshopper runtime/license.                                                                        |
| https://github.com/specklesystems/speckle-powerbi                               | reference_only            | No detected license; PowerBI route remains reference-only.                                                                                |
| https://github.com/specklesystems/speckle-sharp                                 | reference_only            | Archived legacy SDK/connectors; prefer speckle-sharp-sdk.                                                                                 |
| https://github.com/ahujasid/blender-mcp                                         | selected_external_process | MIT MCP bridge; execute Blender externally.                                                                                               |
| https://github.com/earthtojake/text-to-cad                                      | selected                  | MIT CAD generation workflow source.                                                                                                       |
| https://github.com/symbiontarch/ForgeCAD-archive                                | reference_only            | No detected license; reference only.                                                                                                      |
| https://github.com/jtw465/forgecad-studio-suite                                 | reference_only            | No detected license; reference only.                                                                                                      |
| https://github.com/leoyang1984/forgecad-design-skill-plugin                     | reference_only            | MIT plugin reference; no production route until API contract is reviewed.                                                                 |
| https://github.com/BIM-Tools                                                    | reference_only            | Organization-level source; select concrete repos before implementation.                                                                   |
| https://github.com/helenkwok/openbim-mcp                                        | selected                  | MIT MCP bridge candidate for openBIM automation.                                                                                          |
| https://github.com/aspen-cloud/triplit                                          | selected_external_process | AGPL-3.0 sync database; external service only unless copyleft obligations are accepted.                                                   |
| https://github.com/Adam-CAD/CADAM                                               | selected_external_process | GPL-3.0 text-to-CAD app; external process/service only.                                                                                   |
| https://github.com/KittyCAD/text-to-cad-ui                                      | reference_only            | Archived MIT UI for Zoo/KittyCAD API; reference unless current API route is selected.                                                     |
| https://github.com/ctriddell/revit-text-to-braille                              | licensed_gated            | MIT Dynamo workflow, but Revit/Dynamo runtime is licensed.                                                                                |
| https://github.com/antvis                                                       | selected                  | Organization-level visualization stack; use concrete MIT packages such as G2/G6/L7 for graph, flow, map, gantt, and analytic views.       |
| https://github.com/dream-num                                                    | reference_only            | Organization-level productivity source; select concrete Apache-2.0 Univer packages before runtime claims.                                 |
| https://github.com/dream-num/univer/blob/dev/docs/readme/zh-CN.md               | selected                  | Apache-2.0 Univer editing core for documents, spreadsheets, and presentations; import/export/print stay behind explicit service adapters. |
| https://developer.tekla.com/documentation/get-started-tekla-structures-open-api | licensed_gated            | Official docs require a Tekla Structures license for Tekla Open API development.                                                          |
| https://www.tekla.com/solutions/design-interoperability/open-api                | licensed_gated            | Official overview lists Tekla API families; implementation requires official API/runtime terms.                                           |

## Format Routes

| Format family         | Extensions                                                                                          | Runtime route                                                                                                                                              | Current local status                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| PDF                   | `.pdf`, `.pdfa`                                                                                     | Browser PDF viewer from uploaded bytes; Stirling-PDF/PDFium/MuPDF worker for edits/derivatives                                                             | upload preview supported; worker adapter dependency pending                |
| Images                | `.png`, `.jpg`, `.jpeg`, `.svg`, `.webp`, `.gif`, `.heic`                                           | Browser image viewer from uploaded bytes; OCR via PaddleOCR when configured                                                                                | upload preview supported; OCR dependency pending                           |
| Video                 | `.mp4`, `.webm`, `.mov`, `.mkv`                                                                     | Browser video viewer from uploaded bytes; transcode/reconstruction worker for derivatives                                                                  | upload preview supported; worker pending                                   |
| Voice/audio           | `.wav`, `.mp3`, `.m4a`, `.flac`, `.ogg`, `.aac`                                                     | Browser audio viewer from uploaded bytes; ASR/TTS/generation provider routes                                                                               | upload preview supported; provider pending                                 |
| Office docs           | `.docx`, `.doc`, `.odt`, `.rtf`, `.xlsx`, `.xls`, `.xlsm`, `.xlsb`, `.ods`, `.pptx`, `.ppt`, `.odp` | LibreOffice headless preview to PDF; MarkItDown/Office worker for structure; Excelize sidecar and Univer editing service for spreadsheet/document mutation | local LibreOffice preview enabled; production worker pending               |
| Open BIM              | `.ifc`, `.ifczip`, `.ids`, `.bcf`                                                                   | IfcOpenShell worker and buildingSMART validation routes                                                                                                    | IFC source preview supported; worker dependency pending for IDS/BCF/IFCZIP |
| glTF                  | `.glb`, `.gltf`                                                                                     | Three.js viewer from uploaded bytes or worker derivative                                                                                                   | upload viewer supported                                                    |
| Mesh                  | `.stl`, `.ply`, `.obj`, `.fbx`, `.3dm`, `.skp`                                                      | Three.js/STL loader or mesh conversion worker                                                                                                              | STL upload viewer enabled; broader mesh worker pending                     |
| STEP/CAD kernel       | `.step`, `.stp`, `.iges`, `.igs`, `.brep`                                                           | OCCT/OCP/CadQuery worker derivative to glTF/GLB/3D Tiles                                                                                                   | dependency pending                                                         |
| CAD drawings          | `.dxf`, `.dwg`                                                                                      | DXF via real parser worker; DWG via licensed Autodesk/ODA/LibreDWG-compatible adapter                                                                      | dependency/licensing pending                                               |
| Revit                 | `.rvt`, `.rfa`                                                                                      | Autodesk APS/Revit Design Automation or authorized Revit adapter                                                                                           | requires official Autodesk credentials/licensing                           |
| Point cloud / reality | `.e57`, `.las`, `.ply`, `.spz`                                                                      | Potree/3D Tiles/Gaussian Splatting derivative worker                                                                                                       | browser direct rendering pending; worker required                          |
| CNC / machine         | `.nc`                                                                                               | CNC/G-code parser worker and production routing adapter                                                                                                    | worker pending                                                             |
| Custom extensions     | project-defined only                                                                                | Must be registered with MIME, schema, parser, and viewer/generation adapter                                                                                | unknown extensions are blocked, not guessed                                |

## AI Generation Routes

| Output                    | Required real route                                                                                                   | Current status                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Image                     | configured image generation provider or local diffusion worker writing object-store bytes                             | contract exists; production provider not configured     |
| Voice / music / audio     | configured TTS/voice/music provider or local audio worker writing object-store bytes                                  | contract exists; production provider not configured     |
| Video                     | configured video model/transcode worker writing object-store bytes                                                    | contract exists; production provider not configured     |
| Drawing / floorplan / CAD | CAD generator plus DXF/DWG/STEP adapter; derivative must validate layers, units, scale, and schema                    | contract exists; adapter pending                        |
| BIM / model               | IfcOpenShell/OCCT/CadQuery pipeline or authorized vendor adapter; derivative must include geometry and property index | contract exists; adapter pending                        |
| Document / PDF / PPT      | Office/PDF worker using LibreOffice, MarkItDown, Stirling-PDF, and template/schema validation                         | local Office preview enabled; generation worker pending |
| Spreadsheet               | Excelize/LibreOffice/OpenXML route with schema validation                                                             | worker pending                                          |
| Gantt                     | typed schedule schema plus export/render worker                                                                       | contract exists; worker pending                         |
| Flowchart / mindmap       | typed graph schema plus AntV/Mermaid/SVG/PDF export worker                                                            | contract exists; worker pending                         |

## Immediate Implementation Policy

- Frontend must render original bytes only when a file is uploaded or has an object-store binding.
- Frontend must render worker derivatives only when the backend returns a real artifact URL.
- Workers must import their real dependency or raise an actionable error.
- The production profile must reject missing database, object storage, queue, telemetry, auth, and provider config.
- Development mode may show contract availability, but must not label synthetic content as real parsing or real conversion.
