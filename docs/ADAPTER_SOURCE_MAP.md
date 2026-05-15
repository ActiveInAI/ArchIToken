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
| Autodesk ecosystem      | https://github.com/Autodesk                                            | RVT/DWG and Autodesk Platform Services integration boundary      | selected, requires official credentials/licensing |
| Trimble/Tekla ecosystem | https://github.com/TrimbleSolutionsCorporation                         | Tekla/steel model integration boundary                           | selected, requires official credentials/licensing |
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

## Format Routes

| Format family         | Extensions                                                                                          | Runtime route                                                                                                          | Current local status                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| PDF                   | `.pdf`, `.pdfa`                                                                                     | Browser PDF viewer from uploaded bytes; Stirling-PDF/PDFium/MuPDF worker for edits/derivatives                         | upload preview supported; worker adapter dependency pending                |
| Images                | `.png`, `.jpg`, `.jpeg`, `.svg`, `.webp`, `.gif`, `.heic`                                           | Browser image viewer from uploaded bytes; OCR via PaddleOCR when configured                                            | upload preview supported; OCR dependency pending                           |
| Video                 | `.mp4`, `.webm`, `.mov`, `.mkv`                                                                     | Browser video viewer from uploaded bytes; transcode/reconstruction worker for derivatives                              | upload preview supported; worker pending                                   |
| Voice/audio           | `.wav`, `.mp3`, `.m4a`, `.flac`, `.ogg`, `.aac`                                                     | Browser audio viewer from uploaded bytes; ASR/TTS/generation provider routes                                           | upload preview supported; provider pending                                 |
| Office docs           | `.docx`, `.doc`, `.odt`, `.rtf`, `.xlsx`, `.xls`, `.xlsm`, `.xlsb`, `.ods`, `.pptx`, `.ppt`, `.odp` | LibreOffice headless preview to PDF; MarkItDown/Office worker for structure; Excelize sidecar for spreadsheet mutation | local LibreOffice preview enabled; production worker pending               |
| Open BIM              | `.ifc`, `.ifczip`, `.ids`, `.bcf`                                                                   | IfcOpenShell worker and buildingSMART validation routes                                                                | IFC source preview supported; worker dependency pending for IDS/BCF/IFCZIP |
| glTF                  | `.glb`, `.gltf`                                                                                     | Three.js viewer from uploaded bytes or worker derivative                                                               | upload viewer supported                                                    |
| Mesh                  | `.stl`, `.ply`, `.obj`, `.fbx`, `.3dm`, `.skp`                                                      | Three.js/STL loader or mesh conversion worker                                                                          | STL upload viewer enabled; broader mesh worker pending                     |
| STEP/CAD kernel       | `.step`, `.stp`, `.iges`, `.igs`, `.brep`                                                           | OCCT/OCP/CadQuery worker derivative to glTF/GLB/3D Tiles                                                               | dependency pending                                                         |
| CAD drawings          | `.dxf`, `.dwg`                                                                                      | DXF via real parser worker; DWG via licensed Autodesk/ODA/LibreDWG-compatible adapter                                  | dependency/licensing pending                                               |
| Revit                 | `.rvt`, `.rfa`                                                                                      | Autodesk APS/Revit Design Automation or authorized Revit adapter                                                       | requires official Autodesk credentials/licensing                           |
| Point cloud / reality | `.e57`, `.las`, `.ply`, `.spz`                                                                      | Potree/3D Tiles/Gaussian Splatting derivative worker                                                                   | browser direct rendering pending; worker required                          |
| CNC / machine         | `.nc`                                                                                               | CNC/G-code parser worker and production routing adapter                                                                | worker pending                                                             |
| Custom extensions     | project-defined only                                                                                | Must be registered with MIME, schema, parser, and viewer/generation adapter                                            | unknown extensions are blocked, not guessed                                |

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
| Flowchart / mindmap       | typed graph schema plus Mermaid/SVG/PDF export worker                                                                 | contract exists; worker pending                         |

## Immediate Implementation Policy

- Frontend must render original bytes only when a file is uploaded or has an object-store binding.
- Frontend must render worker derivatives only when the backend returns a real artifact URL.
- Workers must import their real dependency or raise an actionable error.
- The production profile must reject missing database, object storage, queue, telemetry, auth, and provider config.
- Development mode may show contract availability, but must not label synthetic content as real parsing or real conversion.
