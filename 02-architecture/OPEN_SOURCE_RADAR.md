# ArchIToken Open Source Radar

Status: Draft for architecture review
Date: 2026-04-24
Scope: AEC, openBIM, CAD kernel, WebGPU digital twin, SCADA/IoT, PDF ingestion, multimodal model generation

This radar records projects that ArchIToken can study, integrate, wrap behind services, or keep as reference-only material. It is not a dependency approval list. Every repository still needs license, security, build, and data-flow review before entering production.

## 1. Method

The first pass used GitHub API snapshots and topic searches on 2026-04-24.

Heat score is a local heuristic from:

- Recent `pushed_at` activity.
- Stars and forks.
- Open issue pressure.
- Domain fit for ArchIToken.
- License risk is tracked separately and does not increase score.

Bands:

- Adopt: safe candidate for direct prototype after normal review.
- Evaluate: promising, but needs technical proof or license review.
- Reference only: useful architecture or UX reference; do not vendor code into core.
- Watch: track, but not enough evidence for immediate work.

## 2. Core Heatmap

| Project | Heat | Stars | License | Main value | ArchIToken stance |
| --- | ---: | ---: | --- | --- | --- |
| [Stirling-Tools/Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) | 75 | 77757 | NOASSERTION | PDF split, merge, OCR-adjacent workflow, document operations | Evaluate as isolated PDF service |
| [ThatOpen/engine_components](https://github.com/ThatOpen/engine_components) | 75 | 643 | MIT | BIM UI/components and app composition patterns | Adopt for UX/API reference |
| [xiangechen/chili3d](https://github.com/xiangechen/chili3d) | 75 | 4511 | AGPL-3.0 | Browser CAD editing, Web CAD product patterns | Reference only unless isolated |
| [ThatOpen/engine_web-ifc](https://github.com/ThatOpen/engine_web-ifc) | 74 | 944 | MPL-2.0 | IFC read/write in JS/WASM at native speed | Adopt candidate for web IFC layer |
| [Open-Cascade-SAS/OCCT](https://github.com/Open-Cascade-SAS/OCCT) | 74 | 2375 | LGPL-2.1 | B-rep CAD kernel, STEP/IGES-class geometry foundation | Evaluate behind native adapter |
| [CGAL/cgal](https://github.com/CGAL/cgal) | 73 | 5861 | NOASSERTION | Computational geometry, meshes, point clouds, triangulation | Evaluate with package license review |
| [FreeCAD/FreeCAD](https://github.com/FreeCAD/FreeCAD) | 73 | 30556 | LGPL-2.1 | Workbench architecture, OCCT application patterns | Evaluate/reference; avoid embedding UI |
| [CadQuery/cadquery](https://github.com/CadQuery/cadquery) | 73 | 5005 | NOASSERTION | Python parametric CAD DSL | Evaluate for scriptable model generation |
| [BIMCoderLiang/LNLib](https://github.com/BIMCoderLiang/LNLib) | 72 | 299 | LGPL-2.1 | NURBS algorithms and surface modelling | Evaluate behind geometry service |
| [buildingSMART/IDS](https://github.com/buildingSMART/IDS) | 71 | 292 | NOASSERTION | Information Delivery Specification source of truth | Adopt as standard reference |
| [SCADA-LTS/Scada-LTS](https://github.com/SCADA-LTS/Scada-LTS) | 71 | 941 | GPL-2.0 | SCADA patterns, Modbus, telemetry UI, alarms | Reference only or external service |
| [IfcOpenShell/IfcOpenShell](https://github.com/IfcOpenShell/IfcOpenShell) | 67 | 2459 | LGPL-3.0 | IFC parsing, geometry, Blender/Bonsai ecosystem | Evaluate behind process adapter |

## 3. Domain Map

### 3.1 IFC and openBIM

Use these to define ArchIToken model ingestion, validation, issue workflow, and property completeness checks.

| Repository | Role |
| --- | --- |
| [ThatOpen/engine_web-ifc](https://github.com/ThatOpen/engine_web-ifc) | Browser IFC read/write and WASM parser path. Good match for Next.js/WebGPU workbench. |
| [ThatOpen/engine_components](https://github.com/ThatOpen/engine_components) | Componentized BIM app patterns. Useful for panels, property grids, fragments, and viewer UI. |
| [buildingSMART/IDS](https://github.com/buildingSMART/IDS) | IDS schema and rule examples. Use as source for machine-checkable exchange requirements. |
| [buildingSMART/bSDD](https://github.com/buildingSMART/bSDD) | Data dictionary and classification strategy. Use for object/property naming and standards mapping. |
| [buildingSMART/validate](https://github.com/buildingSMART/validate) | IFC validation service patterns. Use for validation queue and audit reports. |
| [buildingSMART/IDS-Audit-tool](https://github.com/buildingSMART/IDS-Audit-tool) | IDS validity audit. Use for pre-commit and CI validation inspiration. |
| [IfcOpenShell/IfcOpenShell](https://github.com/IfcOpenShell/IfcOpenShell) | Mature IFC library and geometry engine. Best fit as server-side process or service, not browser core. |
| [opensourceBIM/BIMsurfer](https://github.com/opensourceBIM/BIMsurfer) | MIT WebGL IFC viewer reference. Good fallback/reference for viewer controls. |

Decision:

- Web client path: ThatOpen/Web-IFC first.
- Server validation path: buildingSMART IDS + validation concepts first.
- Heavy IFC geometry path: IfcOpenShell as sidecar service candidate.

### 3.2 Geometry Kernel and Editable CAD

Use these for text/image/PDF/video/drawing to editable model pipelines.

| Repository | Role |
| --- | --- |
| [Open-Cascade-SAS/OCCT](https://github.com/Open-Cascade-SAS/OCCT) | Primary CAD kernel reference for B-rep, topology, STEP/IGES-class exchange. |
| [FreeCAD/FreeCAD](https://github.com/FreeCAD/FreeCAD) | Workbench/plugin architecture, document object model, parametric editing, OCCT usage patterns. |
| [CadQuery/cadquery](https://github.com/CadQuery/cadquery) | Python DSL for generated parametric models. Strong fit for AI-generated editable geometry. |
| [CadQuery/OCP](https://github.com/CadQuery/OCP) | Python OCCT bindings. Candidate for sandboxed geometry generation service. |
| [CadQuery/CQ-editor](https://github.com/CadQuery/CQ-editor) | Editor UX reference for generated CAD scripts. |
| [CGAL/cgal](https://github.com/CGAL/cgal) | Mesh, point cloud, triangulation, geometry repair, boolean and computational geometry algorithms. |
| [BIMCoderLiang/LNLib](https://github.com/BIMCoderLiang/LNLib) | NURBS curves and surfaces; useful for roof, shell, facade, and free-form geometry. |
| [xiangechen/chili3d](https://github.com/xiangechen/chili3d) | Browser CAD UX reference; AGPL means reference-only unless isolated and reviewed. |

Decision:

- Parametric generation route: natural language or drawing to CadQuery script, then validate and export.
- Native exact geometry route: OCCT/CadQuery/OCP sidecar behind API.
- Mesh and point cloud route: CGAL-style algorithms for repair, sampling, triangulation, and alignment.
- Browser editing route: learn from chili3d, but do not copy or vendor AGPL code into the core frontend.

### 3.3 WebGPU Digital Twin and Gaussian Splatting

Use these for the digital twin station and construction evidence model.

| Repository | Role |
| --- | --- |
| [pascalorg/editor](https://github.com/pascalorg/editor) | WebGPU/R3F building editor with editable site/building/level/node hierarchy. |
| [playcanvas/supersplat](https://github.com/playcanvas/supersplat) | Gaussian Splat editing and optimization; strong reference for point-cloud replacement workflows. |
| [Scthe/gaussian-splatting-webgpu](https://github.com/Scthe/gaussian-splatting-webgpu) | WebGPU 3D Gaussian Splatting renderer reference. |
| [Visionary-Laboratory/visionary](https://github.com/Visionary-Laboratory/visionary) | WebGPU-powered Gaussian Splatting/world-model direction. |
| [LTplus-AG/ifc-lite](https://github.com/LTplus-AG/ifc-lite) | Browser-native IFC viewer with WebGPU and Rust/WASM parser. Watch closely. |
| [xyzbety/IFCFlux](https://github.com/xyzbety/IFCFlux) | Lightweight WebGPU IFC engine and rule checks. Early but aligned. |

Decision:

- Digital twin editor: Pascal-style editable hierarchy first.
- Evidence reality capture: Gaussian Splatting first for point clouds, 360 images, drone video, and site scans.
- BIM semantics: IFC/IDS/BCF remain the source for geometry-property completeness, even when splats provide visual fidelity.

### 3.4 SCADA, IoT, and Operations

Use these for digital twin operation, alarm, and time-series concepts.

| Repository | Role |
| --- | --- |
| [SCADA-LTS/Scada-LTS](https://github.com/SCADA-LTS/Scada-LTS) | SCADA UI, alarms, data points, Modbus, events, and operations workflows. |
| [SCADA-LTS/ModbusPal](https://github.com/SCADA-LTS/ModbusPal) | Modbus simulation reference for local test rigs. |

Decision:

- Because GPL is viral for combined distribution, SCADA-LTS is reference-only by default.
- If needed, integrate through protocol-level interoperability, not shared code.
- ArchIToken should implement its own telemetry model over open protocols such as MQTT, OPC UA, Modbus gateways, and time-series storage.

### 3.5 PDF and Document Ingestion

Use these for contracts, standards, drawings, submittals, and archive packages.

| Repository | Role |
| --- | --- |
| [Stirling-Tools/Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) | High-activity PDF operation suite. Strong reference for PDF workflows. |
| [rudi-q/leed_pdf_viewer](https://github.com/rudi-q/leed_pdf_viewer) | PDF annotation UX; AGPL means reference-only unless isolated. |

Decision:

- Treat PDF tooling as an isolated document service.
- Core pipeline must output structured artifacts: clauses, tables, drawing sheets, signatures, attachments, and audit events.
- For AI model generation, PDF is an input to extraction and validation, not just a file preview.

## 4. License Boundary Rules

| License | Default stance |
| --- | --- |
| MIT / Apache-2.0 / BSD / ISC / Zlib | Adopt candidate after normal security and maintenance review. |
| MPL-2.0 | Acceptable with file-level compliance; keep notices and modified files clear. |
| LGPL-2.1 / LGPL-3.0 | Prefer dynamic linking, process adapter, or sidecar service. Avoid static embedding into closed/distribution-sensitive binaries. |
| GPL-2.0 / GPL-3.0 / AGPL-3.0 | Reference-only by default. If required, isolate as separately deployed service and obtain explicit legal approval. |
| NOASSERTION | Must inspect repository license files and package-level license before dependency approval. |

This matters immediately for:

- Reference-only: `xiangechen/chili3d`, `SCADA-LTS/Scada-LTS`, `xeokit/xeokit-bim-viewer`.
- Boundary required: `IfcOpenShell/IfcOpenShell`, `Open-Cascade-SAS/OCCT`, `FreeCAD/FreeCAD`, `BIMCoderLiang/LNLib`.
- Easier adoption: `ThatOpen/engine_components`, `buildingSMART/bSDD`, `buildingSMART/validate`, `CadQuery/OCP`, `CadQuery/CQ-editor`, `playcanvas/supersplat`, `opensourceBIM/BIMsurfer`.

## 5. ArchIToken Implementation Tracks

### Track A. IFC and IDS Workbench

Goal: make every generated or uploaded model machine-checkable.

Inputs:

- IFC, OpenUSD/USDZ, 3D Tiles, glTF/GLB fallback, STEP, CAD drawings, PDF drawing sets.
- IDS requirements, bSDD classifications, local project standards.

Outputs:

- Geometry completeness report.
- Property completeness report.
- BCF issue package.
- Model-to-BOQ export.

Reference stack:

- ThatOpen Web-IFC for browser IFC parsing.
- buildingSMART IDS and validation patterns for exchange requirements.
- IfcOpenShell sidecar for heavy geometry conversion and server checks.

### Track B. Editable Geometry Kernel

Goal: generation results must be editable, not just visual.

Inputs:

- Text prompt, image, CAD/PDF drawing, video, point cloud, splat.

Outputs:

- Parametric CadQuery script.
- OCCT-backed B-rep.
- IFC/glTF/USD/3D Tiles export.
- BOQ/BOM generated from validated geometry.

Reference stack:

- OCCT for exact CAD.
- CadQuery/OCP for Python generation.
- FreeCAD for workbench and parametric document patterns.
- CGAL and LNLib for mesh, point cloud, NURBS, and geometry repair algorithms.

### Track C. WebGPU Digital Twin

Goal: field reality and design intent live in one editable scene.

Inputs:

- BIM/IFC.
- 360 images, drone video, phone video, LiDAR, point cloud.
- IoT and SCADA time-series.

Outputs:

- WebGPU twin scene.
- Gaussian Splat reality layer.
- BIM semantic layer.
- Issue, work order, and operation state overlay.

Reference stack:

- Pascal Editor for editable building hierarchy.
- SuperSplat and WebGPU 3DGS renderers for reality capture.
- ThatOpen/IFC viewers for model semantics.

### Track D. PDF and Archive Intelligence

Goal: contracts, standards, drawings, and enterprise publicity assets become structured data.

Inputs:

- Contract PDFs, standard manuals, drawings, submittals, photos, videos.

Outputs:

- Clause graph.
- Drawing sheet index.
- Signature/approval trail.
- Knowledge base chunks with source coordinates.
- Archive Token and audit package.

Reference stack:

- Stirling-PDF workflow patterns.
- OCR/table extraction tools selected later.
- LangGraph/Langfuse trace for AI extraction governance.

## 6. Next Research Queries

Run these regularly as GitHub heatmap searches:

- `bim ifc webgpu`
- `gaussian splatting webgpu`
- `openbim ifc viewer`
- `cad kernel geometry occt`
- `digital twin construction bim`
- `pdf tools open source`
- `3d reconstruction construction site gaussian splatting`
- `ifc ids bcf validator`
- `cadquery opencascade web`

## 7. Immediate Backlog

1. Add ADR: WebGPU digital twin editor uses Pascal-style editable scene graph.
2. Add ADR: Gaussian Splatting is the default field reality layer for point cloud, 360, drone, and video reconstruction.
3. Add ADR: Generated geometry must produce editable parametric nodes plus exportable IFC/OpenUSD/USDZ/3D Tiles, with glTF/GLB only as audited fallback.
4. Build a small `ifc-webgpu-spike` branch using Web-IFC or ifc-lite for browser-side IFC loading.
5. Build a `cadquery-sidecar-spike` for text-to-parametric-model generation and BOQ extraction.
6. Build a `pdf-archive-spike` that extracts contract clauses and drawing sheets into Archive Token records.
7. Add license gate entries for GPL/AGPL/LGPL/MPL projects before any direct dependency is introduced.

## 8. Source Snapshot

Primary repositories named by AIA:

- <https://github.com/ThatOpen/engine_web-ifc>
- <https://github.com/ThatOpen>
- <https://github.com/SCADA-LTS>
- <https://github.com/buildingSMART>
- <https://github.com/IfcOpenShell>
- <https://github.com/CGAL>
- <https://github.com/BIMCoderLiang>
- <https://github.com/Open-Cascade-SAS/OCCT>
- <https://github.com/FreeCAD>
- <https://github.com/CadQuery>
- <https://github.com/xiangechen/chili3d>
- <https://github.com/Stirling-Tools/Stirling-PDF>

Additional heatmap hits:

- <https://github.com/playcanvas/supersplat>
- <https://github.com/Visionary-Laboratory/visionary>
- <https://github.com/LTplus-AG/ifc-lite>
- <https://github.com/thingraph/bim-viewer>
- <https://github.com/xeokit/xeokit-bim-viewer>
- <https://github.com/opensourceBIM/BIMsurfer>
- <https://github.com/xyzbety/IFCFlux>
- <https://github.com/bitbybit-dev/bitbybit-occt>

Standards references:

- buildingSMART openBIM: <https://www.buildingsmart.org/about/openbim/>
- buildingSMART IDS: <https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/>
- ISO 19650-1: <https://www.iso.org/standard/68078.html>
- PMI PMBOK: <https://www.pmi.org/pmbok-guide-standards/foundational/pmbok>
- IPMA ICB4: <https://ipma.world/ipma-standards-development-programme/icb4/>
- Australia NCC: <https://ncc.abcb.gov.au/>
- EU AI Act: <https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai>
