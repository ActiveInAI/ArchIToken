# ArchIToken Adapter Source Map

Status: active development source map.

Companion audit: [`UPSTREAM_CAPABILITY_AUDIT.md`](./UPSTREAM_CAPABILITY_AUDIT.md). Mandatory openBIM baseline: [`OPENBIM_STANDARD_BASELINE.md`](./OPENBIM_STANDARD_BASELINE.md). Vendor BIM/GIS clean-room reference inventory: [`VENDOR_BIM_PLATFORM_REFERENCE_INVENTORY.md`](./VENDOR_BIM_PLATFORM_REFERENCE_INVENTORY.md).

This file records the upstream projects and the hard integration rule for CAD, BIM, Office, PDF, image, video, voice, and AI generation adapters.

Positioning: adapters serve ArchIToken as AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS. They connect open standards and licensed vendor ecosystems, but they must not clone or claim to replace CAD, BIM, costing, structural analysis, digital twin, or project-management products.

## Non-negotiable Runtime Rule

ArchIToken must not fabricate file bytes or fake successful parsing.

Every preview, conversion, or generation result must come from one of these routes:

1. Browser-native rendering of the original uploaded file stream.
2. A real worker derivative written to object storage.
3. A configured production service adapter.
4. An explicit failure that names the missing adapter or missing dependency.

Seed registry rows are metadata only until bound to object storage bytes. They must not be rendered through generated placeholder PDF, SVG, GLTF, Office, or media content.

## CDE/openBIM Selection Rule

CDE is part of the openBIM operating baseline, not a separate optional add-on. Speckle belongs in the CDE interoperability layer as stream/object/commit collaboration infrastructure. IFCDB-Agent is a required IFC database/agent integration target and must be routed through an isolated service or worker boundary until its license, runtime, and deployment contract are verified.

ArchIToken does not choose one engine and discard the others. The router selects by scenario: native browser runtime first when original bytes can be rendered safely, backend worker for real parsing/conversion, sidecar service for heavy or copyleft runtimes, licensed service for proprietary ecosystems, and explicit failure when no legal production route exists.

## User-Supplied GitHub Link Ledger

Every GitHub URL supplied during product discussions is recorded here before implementation decisions are made. Recording a link makes it traceable input; runtime use still requires the isolation and license policy above.

| Source | Required use in ArchIToken | Route decision |
| --- | --- | --- |
| https://github.com/LibreCAD/LibreCAD | DXF/CAD native-viewer and layer/text behavior reference | selected external process or clean-room reference |
| https://github.com/caddyserver/caddy | Gateway/reverse-proxy and production routing reference | selected deployment component candidate |
| https://github.com/openscad/openscad | Programmatic CAD generation and parametric modeling route | selected external process |
| https://github.com/CadQuery/cadquery | OCCT-backed CAD generation | selected worker dependency |
| https://github.com/Keychron/Keychron-Keyboards-Hardware-Design | Hardware CAD/design archive sample patterns | sample/reference |
| https://github.com/Adam-CAD/CADAM | Text-to-CAD and CAD app generation reference | selected external process |
| https://github.com/atopile/atopile | Electronics/hardware design generation route | selected external process candidate |
| https://github.com/LibrePCB/LibrePCB | PCB/electrical design ecosystem route | selected external process candidate |
| https://github.com/earthtojake/text-to-cad | Text-to-CAD workflow source | selected worker/source pattern |
| https://github.com/Open-Cascade-SAS/OCCT | Geometry kernel | selected native worker dependency |
| https://github.com/microsoft/maker.js | Browser/JS 2D CAD generation | selected worker/browser candidate |
| https://github.com/qcad/qcad | DXF/CAD viewer and conversion reference | selected external process candidate |
| https://github.com/YosysHQ/oss-cad-suite-build | Hardware CAD/EDA toolchain packaging reference | selected external process candidate |
| https://github.com/CadQuery/CQ-editor | CadQuery authoring UX reference | reference |
| https://github.com/pascalorg/skills | Skills/workflow packaging reference | reference |
| https://github.com/mlt131220/Astral3DEditorGoBack | 3D editor workflow reference | reference |
| https://github.com/mlt131220/Astral3D | 3D editor workflow reference | reference |
| https://github.com/peazip/PeaZip-Translations | Archive UI/i18n terminology reference | reference |
| https://github.com/peazip/PeaZip | Archive manager, package listing, search, hash, extraction policy reference | selected external process/reference |
| https://github.com/M2Team/NanaZip | Archive smart extraction/hash/modern UI reference | selected external process/reference |
| https://github.com/abhigyanpatwari/GitNexus | Left tree, top toolbar, center content, right AI/chat, knowledge-map UI and Graph RAG reference | selected UI/AI architecture reference |
| https://github.com/ether/etherpad/releases/tag/v3.1.0 | User-supplied collaborative editor release URL; verify actual upstream repo/tag before adapter work | trace input / reference, unresolved URL |
| https://github.com/ether/etherpad-lite | Etherpad real-time collaborative document editing and API pattern | reference for Office/text collaboration adapter |
| https://github.com/appflowy-io/appflowy | AppFlowy workspace/document/database UI and local-first collaboration pattern | clean-room UI reference; AGPL-family runtime code stays isolated |
| https://github.com/TriliumNext/Trilium/blob/main/docs/README-ZH_CN.md | TriliumNext Chinese docs and hierarchical knowledge tree pattern | clean-room document/archive navigation reference |
| https://github.com/ant-design/ant-design | Global React component system baseline | selected runtime dependency, MIT |
| https://github.com/ant-design/ant-design-cli/blob/main/README.zh-CN.md | Ant Design legacy CLI/dev workflow reference | developer-tool reference only |
| https://github.com/ant-design/ant-design-pro | Enterprise application layout/reference patterns | clean-room reference; ArchIToken keeps Open CDE shell |
| https://github.com/ant-design/pro-components | Dense enterprise workbench components | selected runtime dependency, MIT |
| https://github.com/ant-design/ant-design-web3 | Web3/Token UI reference | reference only; ArchIToken governance rules remain authoritative |
| https://github.com/ant-design/ant-design-mobile | Mobile UI reference | reference only until mobile runtime exists |
| https://github.com/ant-design/x | AI assistant/chat component family | selected runtime dependency, pinned to AntD 5-compatible v1 |
| https://github.com/ant-design/ant-design-mobile-rn | React Native mobile UI reference | reference only |
| https://github.com/ant-design/ant-design-icons | Icon system | selected runtime dependency, MIT |
| https://github.com/ant-design/theme-token | Theme token reference | reference only |
| https://github.com/ant-design/antd-issue-helper | Issue reproduction helper | developer-tool reference only |
| https://github.com/ant-design/ant-design-pro-cli | Ant Design Pro scaffold CLI | developer-tool reference only |
| https://github.com/ant-design/antd-style | Token-aware styling bridge | selected runtime dependency, MIT |
| https://github.com/ant-design/ant-design-colors | Color palette source | selected runtime dependency, MIT |
| https://github.com/ant-design/cssinjs-utils | CSS-in-JS utilities | selected runtime dependency, MIT |
| https://github.com/ant-design/static-style-extract | Static style extraction | selected production optimization candidate |
| https://github.com/ant-design/ant-design-charts | React chart layer above AntV | selected runtime dependency, MIT |
| https://github.com/ant-design/antd-skill | Skill-driven UI generation reference | AI/UI reference only |
| https://github.com/ant-design/doc | Ant Design documentation source | documentation reference |
| https://github.com/ant-design/ant-design-web3/blob/main/README-zh_CN.md | Ant Design Web3 Chinese README | reference only |
| https://github.com/DeeJoin/IFCDB-Agent | IFC database/agent route for openBIM CDE object graph and querying | required isolated worker/service target |
| https://github.com/DeeJoin/IFCDB-Agent/releases/tag/v1.0.9 | IFCDB-Agent pinned release input supplied for required route | required release target for integration planning |

## User-Supplied Vendor BIM/GIS Reference Ledger

The following non-GitHub inputs are recorded because they materially affect CAD/BIM/GIS viewer and backend derivative requirements. They are clean-room references only unless a licensed adapter/service is explicitly approved.

| Source | Required use in ArchIToken | Route decision |
| --- | --- | --- |
| `http://gisbimapi.glendale.top/#/W-CAD-API/Cad接口` | CAD WebGL viewer command surface: drawing load, layout switching, layers, picking, measurement, annotation | clean-room contract reference; no vendor loader/runtime import |
| `http://gisbimapi.glendale.top/#/W-API/` | BIM/GIS viewer command surface: model load, tree/properties, component operations, measure, roam, scene tools | clean-room contract reference; backend artifact manifest route |
| `http://gisbimapi.glendale.top/#/W-Adaptive-API/` | Adaptive server/client rendering pattern | backend derivative/streaming benchmark |
| `http://gisbimapi.glendale.top/#/serviceApi/BIM模型服务` | BIM model service API shape | conversion-job/model-service benchmark |
| `https://www.glendale.top/DBTableFieldDescription` | DB table and field naming reference | schema benchmark only; do not copy proprietary schema |
| `https://docs.qq.com/doc/DRlRyb1pmdHdzQWRI` | User-supplied online BIM/CAD reference document | pending manual/authenticated extraction before implementation use |
| `/home/insome/下载/基于BIM的平台开发` | Local BlackHole/Glendale/IFCDB-Agent package inventory | documented in `VENDOR_BIM_PLATFORM_REFERENCE_INVENTORY.md`; proprietary runtimes remain prohibited from core |

## Upstream Projects

| Area                    | Upstream                                                               | Use in ArchIToken                                                | Status                                            |
| ----------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| openBIM standards       | https://github.com/buildingSMART                                       | IFC, IDM, bSDD, BCF, IDS, Validate contract truth source          | selected                                          |
| openBIM IDM             | https://www.buildingsmart.org/standards/bsi-standards/information-delivery-manual/ | Information delivery process, actors, exchange requirements | selected standard contract                        |
| Autodesk ecosystem      | https://github.com/Autodesk                                            | RVT/DWG and Autodesk Platform Services integration boundary      | licensed_gated                                    |
| Trimble/Tekla ecosystem | https://github.com/TrimbleSolutionsCorporation                         | Tekla/steel model integration boundary                           | licensed_gated                                    |
| BIMserver library       | https://github.com/opensourceBIM/BuildingSMARTLibrary                  | BIMserver/openBIM reference integration                          | candidate                                         |
| Geometry kernel         | https://github.com/Open-Cascade-SAS/OCCT                               | STEP/STP/IGES/BREP geometry read, heal, mesh, and export         | selected native worker dependency                 |
| Parametric CAD          | https://github.com/CadQuery/cadquery                                   | Python CAD generation on OCCT/OCP                                | selected worker dependency                        |
| Primary Text-to-CAD     | https://github.com/KoStard/ForgeCAD                                    | Code-first CAD, agent workflow, CLI validate/render/export        | selected external process/service                 |
| Structured Text-to-CAD  | https://github.com/gumyr/build123d                                     | Local structured fallback CAD generation on OpenCascade          | selected worker dependency                        |
| CAD conversion          | https://github.com/FreeCAD/FreeCAD                                     | Headless CAD conversion through FreeCADCmd                       | selected external process                         |
| DXF native viewer       | https://github.com/LibreCAD/LibreCAD                                   | DXF layers, blocks, dimensions, and text behavior reference      | selected external process or clean-room reference |
| DXF/CAD conversion      | https://github.com/qcad/qcad                                           | DXF/DWG conversion and CAD drawing behavior reference            | selected external process candidate               |
| DWG fallback            | https://github.com/LibreDWG/libredwg                                   | DWG/DXF fallback research                                        | GPL-isolated sidecar only                         |
| Parametric CAD UI       | https://github.com/CadQuery/CQ-editor                                  | CAD authoring UX reference, not embedded wholesale               | reference                                         |
| Parametric CAD          | https://github.com/openscad/openscad                                   | Scripted CAD generation through isolated worker route            | selected external process                         |
| Browser/JS CAD          | https://github.com/microsoft/maker.js                                  | 2D CAD generation and export route candidate                     | selected worker/browser candidate                 |
| Electronics CAD         | https://github.com/atopile/atopile                                     | Hardware/electronics design generation route                     | selected external process candidate               |
| Electronics CAD         | https://github.com/LibrePCB/LibrePCB                                   | PCB design ecosystem route                                       | selected external process candidate               |
| EDA toolchain           | https://github.com/YosysHQ/oss-cad-suite-build                         | Hardware CAD/EDA toolchain packaging reference                   | selected external process candidate               |
| Browser CAD             | https://github.com/xiangechen/chili3d                                  | Browser CAD/editor reference for future module UI                | candidate                                         |
| Geometry algorithms     | https://github.com/CGAL/cgal                                           | mesh/geometry algorithms                                         | candidate, license review required                |
| CGAL Python binding     | https://github.com/CGAL/cgal-swig-bindings                             | Python-accessible CGAL route                                     | candidate, GPL/commercial license review required |
| OCCT Python binding     | https://github.com/CadQuery/OCP                                        | OCCT Python binding used by CadQuery style workers               | selected worker dependency                        |
| IFC BIMserver plugin    | https://github.com/opensourceBIM/IfcOpenShell-BIMserver-plugin         | IFC/BIMserver bridge reference                                   | candidate                                         |
| IFC LCA                 | https://github.com/IfcLCA/IfcLCA                                       | IFC material/quantity/LCA workflow reference                     | candidate, AGPL review required                   |
| IFC visual flow         | https://github.com/louistrue/ifc-flow                                  | Node-based IFC workflow reference                                | candidate                                         |
| IFC core parser         | https://github.com/IfcOpenShell/IfcOpenShell                           | IFC parsing, geometry, conversion, validation                    | selected worker dependency                        |
| IFC database/agent      | https://github.com/DeeJoin/IFCDB-Agent                                 | IFC-native database, query, object graph, and agent route for openBIM CDE | selected isolated worker/service target           |
| IFCDB-Agent release     | https://github.com/DeeJoin/IFCDB-Agent/releases/tag/v1.0.9              | Pinned release input for the required IFCDB-Agent adapter route  | required release target                           |
| Archive manager         | https://github.com/peazip/PeaZip                                       | Archive listing/search/hash/extraction policy and UX reference   | selected external process/reference               |
| Archive manager         | https://github.com/M2Team/NanaZip                                      | Smart extraction, hashing, package inspection, Windows archive UX | selected external process/reference               |
| Workbench AI UX         | https://github.com/abhigyanpatwari/GitNexus                            | Left tree/top toolbar/content/right AI-chat plus knowledge graph logic | selected UI/AI architecture reference             |
| Agent/Office workflow   | https://github.com/iOfficeAI/AionUi/blob/main/docs/readme/readme_ch.md | Office generation/editing workflow reference                     | reference                                         |
| PDF tooling             | https://github.com/Stirling-Tools/Stirling-PDF                         | PDF split/merge/OCR/conversion service adapter                   | selected service adapter                          |
| PDF/document AI         | https://github.com/docling-project/docling                             | Default permissive PDF/Office/image document structure worker    | selected worker dependency                        |
| PDF browser viewer      | https://github.com/mozilla/pdf.js                                      | Browser PDF rendering                                            | selected browser runtime                          |
| PDF rendering           | https://github.com/ArtifexSoftware/mupdf                               | PDF page rasterization through mutool                            | selected external process/commercial option       |
| OCR                     | https://github.com/PaddlePaddle/PaddleOCR                              | PDF/image OCR worker                                             | selected worker dependency                        |
| PDF-to-Markdown         | https://github.com/VikParuchuri/marker                                 | High-quality PDF extraction candidate                            | GPL-isolated sidecar only                         |
| Document parsing        | https://github.com/Unstructured-IO/unstructured                        | Broad document extraction fallback                               | selected isolated worker/service                  |
| Document conversion     | https://github.com/microsoft/markitdown                                | DOC/DOCX/XLS/XLSX/PPT/PDF/image/audio document-to-Markdown route | selected worker dependency                        |
| Excel                   | https://github.com/qax-os/excelize                                     | Spreadsheet read/write/generation route through Go sidecar       | selected sidecar candidate                        |
| Office editing          | https://github.com/dream-num/univer/blob/dev/docs/readme/zh-CN.md      | AI-native document, spreadsheet, and presentation editing core   | selected OSS editor; import/export via worker     |
| Office online editing   | https://github.com/CollaboraOnline/online                              | Self-hosted WOPI Office editor                                   | selected isolated service                         |
| Office online editing   | https://github.com/ONLYOFFICE/DocumentServer                           | Office editor fallback                                           | AGPL/commercial isolated service only             |
| Media transcode         | https://github.com/FFmpeg/FFmpeg                                       | Audio/video/image derivative worker                              | selected external process                         |
| Image CV                | https://github.com/opencv/opencv                                       | Image metadata/analysis/OCR preprocessing worker                 | selected worker dependency                        |
| Image conversion        | https://github.com/ImageMagick/ImageMagick                             | Image derivative generation                                      | selected external process                         |
| Node image pipeline     | https://github.com/lovell/sharp                                       | Next/Node image transform route                                  | selected dependency where JS-side transforms fit  |
| GIS conversion          | https://github.com/OSGeo/gdal                                          | OGR/GDAL import/export/indexing                                  | selected external process                         |
| Point cloud             | https://github.com/PDAL/PDAL                                           | LAS/LAZ/E57 metadata and processing                              | selected external process                         |
| Web GIS                 | https://github.com/maplibre/maplibre-gl-js                             | Open-source map/vector-tile viewer                               | selected browser runtime                          |
| Data visualization      | https://github.com/antvis                                              | flowchart, graph, gantt, mindmap, GIS/analytic visualization     | selected package family                           |

## Isolation Policy

The backend now keeps a runtime isolation registry in `06-workers/architoken_workers/engine_registry.py`.

| Isolation mode | Allowed use | Examples |
| --- | --- | --- |
| `in_process_library` | Permissive or reviewed libraries inside the Python worker process | Docling, OpenCV, build123d, CadQuery, IfcOpenShell library APIs |
| `external_process` | Native binaries/desktop tools invoked by a worker container | ForgeCAD CLI, FreeCADCmd, Blender, FFmpeg, ImageMagick, GDAL/OGR, PDAL, MuPDF mutool, MinerU CLI |
| `sidecar_service` | HTTP service with its own image, credentials, health checks, and data boundary | Stirling-PDF, Collabora Online, SiYuan, Speckle, Open Design |
| `licensed_service` | Official licensed runtime or vendor API required | DWG/RVT/Revit/Autodesk APS/ODA/Tekla/Rhino routes |
| `browser_runtime` | Frontend-only viewer/runtime using original uploaded bytes or worker derivatives | PDF.js, MapLibre, CesiumJS, Three.js, AntV |
| `reference_only` | Study/spec/UI reference; no runtime claims | Archived projects, organization pages, samples, duplicate projects, unscoped research inputs |

Production rule: a new adapter cannot be dispatched unless it has an isolation policy. Capability is the first selection axis, so ForgeCAD is the primary Text-to-CAD/CAD generation route. License/runtime risk controls the boundary, not whether the project is considered: unclear-license, copyleft, hosted, or desktop projects must run as an external process or isolated service and return persisted artifacts. `reference_only` must not be used merely because a strong project has license, deployment, or runtime complexity.

ForgeCAD project skill boundary: `https://github.com/KoStard/ForgeCAD/blob/mainline/skills/forgecad-project/SKILL.md` is a workflow reference for project/file/member/publish/sync operations. ArchIToken may reuse the lifecycle pattern through an adapter, but destructive operations, public publishing, visibility changes, member changes and force sync require ToolRouter authorization, approval state, immutable archive evidence and audit events. ForgeCAD outputs remain CAD/model artifacts or drafts until checked by the relevant professional and standards workflow.

## Viewer And Visualization Source Set

These are now first-class upstream records in `03-frontend/lib/adapter-source-registry.ts`. The rule is direct: use browser renderers for open uploaded bytes, use workers for derivatives, and keep licensed vendor formats behind official adapters.

| Area | Upstream | Runtime use | Status |
| --- | --- | --- | --- |
| Global UI component baseline | https://github.com/ant-design/ant-design | Buttons, forms, tables, tabs, menus, modals, drawers, notifications and token system through `ConfigProvider` | selected runtime dependency |
| Enterprise workbench components | https://github.com/ant-design/pro-components | Dense module workbench tables, forms, descriptions and operation panels | selected runtime dependency |
| Icon system | https://github.com/ant-design/ant-design-icons | Default icon family for new product UI | selected runtime dependency |
| AI assistant UI | https://github.com/ant-design/x | AI chat/assistant components; runtime pinned to AntD 5-compatible v1 | selected runtime dependency |
| Chart layer | https://github.com/ant-design/ant-design-charts | AntV-backed React charts for business analytics | selected runtime dependency |
| Token/style bridge | https://github.com/ant-design/antd-style, https://github.com/ant-design/ant-design-colors, https://github.com/ant-design/cssinjs-utils, https://github.com/ant-design/static-style-extract | Token-aware custom surfaces and future static style extraction | selected runtime/tooling dependency |
| Browser 3D core | https://github.com/mrdoob/three.js | GLB, glTF, STL, OBJ, FBX, PLY, converted IFC/CAD derivatives | selected and already wired through Three.js |
| React 3D runtime | https://github.com/pmndrs/react-three-fiber | React canvas runtime for engineering and BIM viewers | selected and already wired |
| Secondary 3D engine | https://github.com/BabylonJS/Babylon.js | Advanced scene editor/runtime candidate where Three.js is insufficient | selected candidate |
| Scene editor/export | https://github.com/BabylonJS/Editor, https://github.com/BabylonJS/Exporters, https://github.com/BabylonJS/Extensions | editor/export references behind worker boundaries | reference / external process |
| Native 3D shells | https://github.com/BabylonJS/BabylonNative, https://github.com/BabylonJS/BabylonReactNative | future desktop/mobile shell references | reference |
| 3D Tiles | https://github.com/NASA-AMMOS/3DTilesRendererJS | b3dm, i3dm, pnts, cmpt, point-cloud and city model derivatives | selected |
| GIS and terrain | https://github.com/CesiumGS/cesium | GIS, terrain, KML, GeoJSON, 3D Tiles, reality capture | selected |
| 2D canvas overlays | https://github.com/pixijs/pixijs | drawing overlays, image annotation, high-performance 2D scene layers | selected |
| Job terminal | https://github.com/xtermjs/xterm.js | worker, CNC, robot, deployment and telemetry log console | selected |
| PBR render | https://github.com/google/filament | high-quality model image/render service candidate | selected external process |
| Shader reference | https://github.com/lettier/3d-game-shaders-for-beginners | shader technique reference only | reference |
| Browser ML | https://github.com/tensorflow/tfjs | lightweight browser extraction/classification helpers | selected candidate |
| Analytics charts | https://github.com/plotly/plotly.js | engineering and operations charts where Plotly interaction is required | selected |
| AntV charts | https://github.com/antvis/G2 | cost, finance, production, and progress dashboards | selected |
| AntV graph | https://github.com/antvis/G6 | flowchart, mindmap, dependency graph, topology and process views | selected |
| AntV AI charts | https://github.com/antvis/chart-visualization-skills, https://github.com/antvis/AVA, https://github.com/antvis/Infographic | AI chart recommendation and report graphics | selected |
| IFC browser runtime | https://github.com/ThatOpen/engine_web-ifc | browser-side IFC WASM source geometry preview | selected and already wired through `web-ifc` |
| IFC UI patterns | https://github.com/ThatOpen/engine_ui-components | BIM UI composition reference | reference |
| IFC + Three.js | https://github.com/ThatOpen/web-ifc-three | IFC to Three.js viewer reference | selected |
| IFC fallback diagnostics | https://github.com/louistrue/ifc-lite | lightweight IFC checks and fallback diagnostics | selected candidate |

## Local Business Reference Inputs

The uploaded steel-structure HTML files are treated as product/domain source material, not as visual decoration. Their content maps into the 14-module workbench through module profiles, object names, lifecycle actions, and file categories.

| Local source | Applied module areas |
| --- | --- |
| `/home/insome/下载/钢结构方案深化生产一体化协同工作流(1).html` | concept design, detailed design, production manufacturing, material logistics, construction management, digital twin |
| `/home/insome/下载/重钢全球AI与Token合规商业化方案建议.html` | AI center, settings center, digital archive, finance HR, governance and approval states |
| `/home/insome/下载/重钢全链条AI业务商业化体系.html` | marketing service, planning management, quantity costing, finance HR, lifecycle and business object definitions |
| `/home/insome/下载/钢结构业务.html` | all steel structure object libraries, IFC/DWG/STEP/BOQ/approval categories, production and site handoff workflows |

## Upstream Decision Registry

Canonical runtime registry: `03-frontend/lib/adapter-source-registry.ts`.

Decision meanings:

- `selected`: can be used as a priority adapter/spec source after normal dependency review.
- `selected_external_process`: usable only behind a service/process boundary; do not vendor/link into core.
- `licensed_gated`: usable only with user-provided official license, credentials, SDK/runtime, and adapter config.
- `reference_only`: useful for archived/spec/sample/organization-level architecture study, but not a runtime dependency.
- `sample_data`: fixture source only; store attribution and license notes before adding files.
- `blocked_pending_license`: do not use until license/repo status is resolved.

| Source                                                                          | Decision                  | Runtime judgment                                                                                                                          |
| ------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| https://github.com/buildingSMART                                                | selected                  | Canonical openBIM standards organization; contract source for IFC/IDM/bSDD/BCF/IDS/Validate.                                             |
| https://github.com/buildingSMART/OpenCDE-API                                    | reference_only            | Archived and no detected license; historical OpenCDE contract reference only.                                                             |
| https://github.com/buildingSMART/IFC                                            | reference_only            | Archived schema repo with no asserted license; schema truth source, not vendored runtime code.                                            |
| https://www.buildingsmart.org/standards/bsi-standards/information-delivery-manual/ | selected               | IDM process/exchange-requirement standard; drives delivery milestones before IDS/IFC validation.                                          |
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
| https://github.com/KoStard/ForgeCAD                                             | selected_external_process | Primary capability-first Text-to-CAD route. Use through isolated ForgeCAD CLI/service; project/file/member/publish workflow follows the ForgeCAD project skill boundary and must persist artifacts plus audit evidence. |
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
| https://github.com/specklesystems/speckle-server                                | selected_external_process | Capability-priority model collaboration route through isolated Speckle Server/API service; do not vendor server code into core.            |
| https://github.com/schauh11/revit-mcp-server                                    | licensed_gated            | MIT bridge code, but real Revit runtime is proprietary and user-licensed.                                                                 |
| https://github.com/specklesystems/speckle-connectors-dui                        | reference_only            | Connector UI design reference only; production sync uses Speckle Server/API and concrete SDK/exporter routes.                             |
| https://github.com/specklesystems/speckle-sharp-sdk                             | selected                  | Apache-2.0 .NET SDK candidate for connector sidecars.                                                                                     |
| https://github.com/specklesystems/IFC-Exporter                                  | selected                  | Apache-2.0 IFC exporter candidate.                                                                                                        |
| https://github.com/specklesystems/speckle-blender                               | selected_external_process | Apache-2.0 connector plus Blender external process route.                                                                                 |
| https://github.com/specklesystems/SpeckleConWorkshop-QAQC                       | selected                  | Apache-2.0 QA/QC sample source.                                                                                                           |
| https://github.com/specklesystems/speckle-excel                                 | reference_only            | Archived; historical Excel connector only.                                                                                                |
| https://github.com/specklesystems/speckle-sketchup                              | licensed_gated            | Apache connector code, but SketchUp runtime is user-licensed.                                                                             |
| https://github.com/specklesystems/IFC-Exporter-Rhino                            | licensed_gated            | Apache connector code, gated by Rhino runtime/license.                                                                                    |
| https://github.com/specklesystems/IFC-Exporter-Grasshopper                      | licensed_gated            | Apache connector code, gated by Rhino/Grasshopper runtime/license.                                                                        |
| https://github.com/specklesystems/speckle-powerbi                               | reference_only            | PowerBI-specific route remains reference-only until a licensed enterprise BI adapter is selected.                                         |
| https://github.com/specklesystems/speckle-sharp                                 | reference_only            | Archived legacy SDK/connectors; prefer speckle-sharp-sdk.                                                                                 |
| https://github.com/ahujasid/blender-mcp                                         | selected_external_process | MIT MCP bridge; execute Blender externally.                                                                                               |
| https://github.com/earthtojake/text-to-cad                                      | selected                  | MIT CAD generation workflow source.                                                                                                       |
| https://github.com/symbiontarch/ForgeCAD-archive                                | reference_only            | Alternate ForgeCAD archive source; reference-only because KoStard/ForgeCAD is the selected primary route.                                |
| https://github.com/jtw465/forgecad-studio-suite                                 | reference_only            | Alternate ForgeCAD studio source; reference-only because KoStard/ForgeCAD is the selected primary route.                                 |
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
| PDF                   | `.pdf`, `.pdfa`                                                                                     | Browser PDF.js viewer from uploaded bytes; Docling/MinerU/MarkItDown/PaddleOCR for structure; Stirling-PDF/MuPDF/PDFium for edits/derivatives              | Docling, MinerU, Stirling, MuPDF, OCR workers wired; native deps required  |
| Images                | `.png`, `.jpg`, `.jpeg`, `.svg`, `.webp`, `.gif`, `.heic`                                           | Browser image viewer from uploaded bytes; OpenCV metadata worker; ImageMagick/FFmpeg derivatives; PaddleOCR when configured                               | OpenCV/ImageMagick/PaddleOCR workers wired; native deps required           |
| Video                 | `.mp4`, `.webm`, `.mov`, `.mkv`, `.avi`                                                             | Browser video viewer from uploaded bytes; FFmpeg transcode/reconstruction worker for derivatives                                                           | FFmpeg worker wired; native deps required                                  |
| Voice/audio           | `.wav`, `.mp3`, `.m4a`, `.flac`, `.ogg`, `.aac`                                                     | Browser audio viewer from uploaded bytes; FFmpeg transcode; ASR/TTS/generation provider routes                                                             | FFmpeg worker wired; generation provider still external                    |
| Office docs           | `.docx`, `.doc`, `.odt`, `.rtf`, `.xlsx`, `.xls`, `.xlsm`, `.xlsb`, `.ods`, `.pptx`, `.ppt`, `.odp` | Backend-native Office parsing/editing route through LibreOffice/Collabora/ONLYOFFICE/Univer/Excelize, plus Docling/MarkItDown structure extraction; PDF is only an optional derivative, never a substitute for Office support | LibreOffice, Docling, MarkItDown workers wired; online editing service pending |
| Open BIM              | `.ifc`, `.ifczip`, `.idm`, `.ids`, `.bcf`, `.bcfzip`                                                | IDM exchange manifest; IFC preview through web-ifc; IfcOpenShell worker; bSDD enrichment; IDS and buildingSMART Validate; BCF package parser               | IFC/IDM/bSDD/BCF/IDS/Validate worker routes wired; native/service deps required |
| glTF                  | `.glb`, `.gltf`                                                                                     | Three.js viewer from uploaded bytes or worker derivative                                                                                                   | upload viewer supported                                                    |
| Mesh                  | `.stl`, `.ply`, `.obj`, `.fbx`, `.3dm`, `.skp`                                                      | Three.js/STL loader or Blender/FreeCAD mesh conversion worker                                                                                              | STL upload viewer and Blender worker wired; native deps required           |
| STEP/CAD kernel       | `.step`, `.stp`, `.iges`, `.igs`, `.brep`                                                           | ForgeCAD CLI/service for generated models; Browser OCCT WASM preview through `occt-import-js`; OCCT/OCP/FreeCAD/CadQuery/build123d worker derivatives     | ForgeCAD/STEP/STP/IGES browser viewer and worker adapters wired; native deps required |
| CAD drawings          | `.dxf`, `.dwg`                                                                                      | DXF via real parser/SVG browser viewer; DWG via licensed Autodesk/ODA/LibreDWG-compatible adapter                                                          | DXF viewer wired; DWG remains licensed adapter required                    |
| Revit                 | `.rvt`, `.rfa`                                                                                      | Autodesk APS/Revit Design Automation or authorized Revit adapter                                                                                           | requires official Autodesk credentials/licensing                           |
| Point cloud / reality | `.e57`, `.las`, `.ply`, `.spz`                                                                      | PDAL metadata worker; Cesium ion/3D Tiles derivative route; browser direct rendering for supported derivatives                                             | PDAL/Cesium workers wired; token/native deps required                      |
| CNC / machine         | `.nc`                                                                                               | CNC/G-code parser worker and production routing adapter                                                                                                    | worker pending                                                             |
| Custom extensions     | project-defined only                                                                                | Must be registered with MIME, schema, parser, and viewer/generation adapter                                                                                | unknown extensions are blocked, not guessed                                |

## AI Generation Routes

| Output                    | Required real route                                                                                                   | Current status                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Image                     | configured image generation provider or local diffusion worker writing object-store bytes                             | contract exists; production provider not configured     |
| Voice / music / audio     | configured TTS/voice/music provider or local audio worker writing object-store bytes                                  | contract exists; production provider not configured     |
| Video                     | configured video model/transcode worker writing object-store bytes                                                    | contract exists; production provider not configured     |
| Drawing / floorplan / CAD | ForgeCAD primary generator plus build123d/CadQuery fallback and DXF/DWG/STEP adapters; derivative must validate layers, units, scale, and schema | ForgeCAD/build123d/CadQuery workers wired; DWG remains licensed-gated |
| BIM / model               | IfcOpenShell/OCCT/CadQuery/build123d pipeline or authorized vendor adapter; derivative must include geometry and property index | IfcOpenShell Text-to-BIM and CAD workers wired; native deps required |
| Document / PDF / PPT      | Office/PDF worker using LibreOffice, Docling, MarkItDown, Stirling-PDF, PaddleOCR, and template/schema validation      | workers wired; collaborative online editing service pending |
| Spreadsheet               | Excelize/LibreOffice/OpenXML route with schema validation                                                             | worker pending                                          |
| Gantt                     | typed schedule schema plus Mermaid/AntV export/render worker                                                          | Mermaid worker wired; AntV frontend package route selected |
| Flowchart / mindmap       | typed graph schema plus AntV/Mermaid/SVG/PDF export worker                                                            | Mermaid worker wired; AntV frontend package route selected |

## Immediate Implementation Policy

- Frontend must render original bytes only when a file is uploaded or has an object-store binding.
- Frontend must render worker derivatives only when the backend returns a real artifact URL.
- Workers must import their real dependency or raise an actionable error.
- The production profile must reject missing database, object storage, queue, telemetry, auth, and provider config.
- Development mode may show contract availability, but must not label synthetic content as real parsing or real conversion.
