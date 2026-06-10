# Vendor BIM/GIS Platform Reference Inventory

Status: clean-room reference inventory.

This document records the user-supplied BIM/GIS/CAD platform references and the local package inventory under `/home/insome/下载/基于BIM的平台开发`. These sources are capability benchmarks and adapter contract inputs. They are not permission to copy vendor code, import proprietary SDKs, ship EXE/WASM/loader blobs, or claim production support without a licensed adapter, security review, SBOM, benchmark, and audit evidence.

## External Reference URLs

The Glendale API documentation is a single-page app. The current web fetch confirms the API-document entry page, but does not expose the route body as plain HTML. The local PDFs and documents below are therefore the primary inspected evidence for API surface and viewer behavior.

| Source | Reference scope | ArchIToken use |
| --- | --- | --- |
| `http://gisbimapi.glendale.top/#/W-CAD-API/Cad接口` | CAD WebGL viewer API, drawing load, layout switching, layer operations, picking, measurement, annotation | Clean-room CAD viewer command contract reference |
| `http://gisbimapi.glendale.top/#/W-API/` | BIM/GIS WebGL viewer API, model loading, component operations, measurement, roaming, scene tools | Clean-room BIM/GIS viewer command contract reference |
| `https://www.glendale.top/DBTableFieldDescription` | Database table and field naming reference | Schema benchmark only; no direct schema copy |
| `https://docs.qq.com/doc/DRlRyb1pmdHdzQWRI` | User-supplied online document reference | Pending authenticated/manual extraction before implementation use |
| `http://gisbimapi.glendale.top/#/W-Adaptive-API/` | Server/client adaptive rendering API | Backend derivative and streaming route benchmark |
| `http://gisbimapi.glendale.top/#/serviceApi/BIM模型服务` | BIM model service API | Conversion-job and model-service contract benchmark |

## Open Source Viewer, Editor, And Adapter References

These GitHub projects are recorded as clean-room reference material and possible adapter candidates. Recording a project here does not mean it is bundled, redistributed, licensed for runtime use, or already production-supported by ArchIToken. GPL, AGPL, SSPL, BUSL, proprietary SDK, and SaaS-dependent code must stay behind an explicit sidecar/service boundary until license, SBOM, security, and deployment review are complete.

| Category | Project | Reference scope | ArchIToken use |
| --- | --- | --- | --- |
| Collaborative document editing | `https://github.com/ether/etherpad/releases/tag/v3.1.0` | Real-time document editing, author attribution, revision history, compact editor command surfaces | Office/text collaboration contract benchmark; adapter candidate only after license and deployment review |
| Collaborative workspace | `https://github.com/appflowy-io/appflowy` | Workspace, document/database UX, local-first/native collaboration patterns | Product and UI benchmark; AGPL-family runtime code must not enter distributed core without isolation |
| Knowledge/doc tree | `https://github.com/TriliumNext/Trilium/blob/main/docs/README-ZH_CN.md` | Hierarchical notes, document tree, knowledge base navigation | Archive/document workbench benchmark |
| Office/file preview | `https://github.com/basemetas/fileview/releases/tag/v1.5.0` | Online file preview release reference | File preview engine benchmark and adapter candidate |
| Office/file preview | `https://github.com/basemetas/fileview` | Office, PDF, OFD, CAD, image, code and professional file preview surface | File preview adapter candidate; review license and runtime shape before integration |
| Revit IFC | `https://github.com/Autodesk/revit-ifc` | Revit/Navisworks IFC export/import ecosystem | IFC/openBIM route reference; not an RVT native parser claim |
| Revit automation | `https://github.com/pyrevitlabs/pyRevit/releases/tag/v6.4.0.26100%2B0515` | Revit automation, dockable panes, parameter tools, IFC helper updates | Licensed desktop-side adapter/workflow reference |
| Revit automation | `https://github.com/bvn-architecture/RevitBatchProcessor` | Batch processing Revit files with Python/Dynamo scripts | Revit sidecar worker pattern reference |
| Code-first CAD | `https://github.com/KoStard/ForgeCAD` | JavaScript/TypeScript parametric CAD, constraints, assemblies, STEP/BREP export | Parametric CAD command model reference |
| CAD kernel | `https://github.com/Open-Cascade-SAS/OCCT` | Open CASCADE 3D CAD/CAM/CAE kernel | Geometry worker/kernel reference |
| Scripted CAD | `https://github.com/openscad/openscad` | Script-driven CSG CAD, DXF/STL/OFF workflow, CGAL dependencies | Code editor + CAD compilation workflow reference |
| Parametric CAD | `https://github.com/solvespace/solvespace` | Parametric 2D/3D CAD and constraint solving | Constraint command and sketch workflow reference |
| CAD assets | `https://github.com/Keychron/Keychron-Keyboards-Hardware-Design` | STEP, DXF, DWG, PDF hardware-design files | Test corpus and import-route benchmark, subject to source license terms |
| CAD/BIM workstation | `https://github.com/FreeCAD/FreeCAD/releases/tag/1.1.1` | FreeCAD release reference and open CAD/BIM workbench ecosystem | Sidecar conversion and authoring workflow reference |
| 2D CAD | `https://github.com/LibreCAD/LibreCAD` | DXF/DWG read and DXF/DWG/PDF/SVG conversion benchmark | Isolated desktop/worker converter reference; GPL-family code requires isolation |
| Browser 3D CAD | `https://github.com/xiangechen/chili3d` | Browser-based 3D CAD design and editing | Web CAD editing UX and command grammar benchmark |
| Parametric CAD | `https://github.com/CadQuery/cadquery/releases/tag/v2.7.0` | Python parametric CAD based on OCCT/OCP | Backend parametric-model worker candidate |
| Web CAD | `https://github.com/mxcad/mxcad` | Web CAD rendering/editing around lightweight `.mxweb` derivatives from DWG/DXF | CAD derivative viewer/editor benchmark; adapter review required |
| Web 3D CAD | `https://github.com/mxcad/mxcad3d` | OpenCASCADE-backed TypeScript/C++ 3D CAD framework, STEP/IGES/STL-style workflows | Web 3D CAD editor and kernel API benchmark; adapter review required |

## Local Package Inventory

Scanned path: `/home/insome/下载/基于BIM的平台开发`.

| Folder | Files inspected | Reference value |
| --- | --- | --- |
| `黑洞引擎/开发指南` | BlackHole Engine SDK archives, Mobile SDK, Streaming package, offline viewer manual, conversion platform manual, Revit/Tekla WormHole exporter installers and manuals, BIM sample RVT | Conversion platform workflow, offline package workflow, model tree/property/viewpoint/tool layout, dataset/version semantics, exporter-based proprietary-format ingestion benchmark |
| `葛兰岱尔` | WebGL BIM/GIS frontend API PDF, WebGL CAD frontend API PDF, DB field document, high-performance server/client adaptive rendering deployment and secondary-development documents, conversion SDK installer package, digital-twin converter installer package | BIM/GIS/CAD viewer command surface, adaptive rendering deployment pattern, DB/property-index reference, conversion service benchmark |
| `葛兰岱尔` plugin packages | AutoCAD, Revit, Navisworks Manage, Tekla Structures, Rhino, SolidWorks, CATIA v6, Bentley, NX, Creo export plugin archives | Licensed vendor-format adapter boundary; use as evidence that native RVT/DWG/Tekla/SolidWorks ingestion generally requires vendor-side exporters or licensed services |
| `葛兰岱尔` demo packages | Smart industrial park, chemical park, material park, bridge monitoring platform archives | UI/scene composition and digital-twin workflow benchmark only |
| root | `IFCDB-Agent-main.zip` | IFC/openBIM database/agent sidecar evidence; see `docs/IFCDB_AGENT_INTEGRATION.md` |

## Capability Benchmark Extracted From Local Documents

These capabilities are benchmarks for ArchIToken. They are not current support claims unless a corresponding ArchIToken adapter is configured and smoke-tested.

| Area | Observed capability pattern | ArchIToken implementation rule |
| --- | --- | --- |
| File management | Upload, folder management, conversion submission, conversion queue, update, move, rename, delete, version management, share, download | Keep asset registry/object storage as source of truth; every mutation writes audit events and respects tenant/project RBAC |
| Dataset model | Dataset, model group, single-component model, GIS data, vector data, file version as successful conversion count | Add explicit `dataset`, `model_group`, `single_component_model`, `scene`, `offline_package`, and `conversion_version` concepts to backend manifests before UI claims |
| BIM conversion | Revit configuration includes 3D view selection, rooms/areas, 2D drawing export, color mode, LOD, coordinate base, schedules, grids/levels, hidden component handling, part visibility | Implement through backend conversion-job input schema; no frontend-only flags without worker support |
| GIS/reality | OSGB, imagery/DEM/DOM/TIF, point cloud, vector, terrain/tile scheme, LOD structures, ENU/EPSG/WKT positioning | Route through GDAL/PROJ/PDAL/Cesium 3D Tiles workers; persist CRS, tile scheme, bounding volume, and LOD metadata |
| CAD drawings | DWG/DXF drawing load, model/layout space list, layout switching, layer operations, entity picking, Revit-ID linking, measurement, annotation, minimap | DXF native canvas/WebGL viewer can run from original bytes; DWG must use a licensed or isolated backend derivative, never a watermarked PDF as primary viewer |
| Model viewer | Model load/unload, model tree, property panel, component pick, locate, hide/show, color, opacity, isolate, section, offset, rotate, reset camera, snapshot, theme, background, rendering effects | Implement as `ViewerAdapter` commands over backend artifact manifests; the UI must be consistent across IFC, glTF, CAD, point cloud, and GIS |
| Viewpoints/offline | Viewpoint save/update, anchor, label, resource package load/unload/reload, offline package metadata | Persist viewpoints, annotations, and offline package manifests as first-class artifacts with audit and versioning |
| Version comparison | Compare model versions, changed components, added/removed/modified components, property change records | Requires stable element identity maps and property index diffs generated by backend workers |
| Properties/index | Object properties, model tree/group tree, geometry/property index, DB table/field reference | Use openBIM IFC GUID/Express ID, source native IDs, and ArchIToken element identity map; do not copy vendor DB schema wholesale |

## Format Coverage Benchmark

The local documents and screenshots describe a broad vendor benchmark surface:

| Family | Referenced formats | Production route in ArchIToken |
| --- | --- | --- |
| GIS | OSGB, TIF/DEM/DOM imagery, LAS/PLY/PNTS point cloud, SHP vector, b3dm, glTF/glb, GeoJSON, PNG, WMS, KML, CZML | GDAL/PROJ/PDAL/Cesium/MapLibre workers and viewers |
| 2D CAD | DWG, DXF, T3, AutoCAD 2019-2024 benchmark | DXF native parser/viewer; DWG licensed adapter or isolated compatible service |
| Revit/BIM | RVT, RFA, Revit 2014-2025 benchmark | Autodesk APS/Revit adapter or authorized Revit exporter; IFC as openBIM route |
| Steel/BIM authoring | Tekla 2016-2023 benchmark, SolidWorks 2018-2024 benchmark, Rhino 7.4 benchmark, SketchUp SKP benchmark | Licensed exporter/service adapters or open derivatives; no embedded vendor runtime |
| Open/model exchange | IFC 2x3/4/4x1/4x2/4x3, FBX, STEP/STP AP242/AP214/AP203, STL, IGES | IfcOpenShell, OCCT/OCP/CadQuery/FreeCAD/Blender workers |

## UI And Viewer Requirements Derived From The Benchmark

ArchIToken viewer pages must be working surfaces, not decorative pages:

- The viewport is the primary surface and should occupy maximum available space.
- Left tree, right properties, bottom commands, annotations, and chat/AI panels must be dockable, collapsible, resizable, and able to float without reserving dead layout space.
- CAD/BIM/GIS viewers must share one command grammar: load, unload, reset, fit, select, isolate, hide, show, color, opacity, section, measure, annotate, snapshot, export, and dispose.
- Toolbars should use compact icon buttons with tooltips, not repeated wide text bars.
- IFC/DWG/DXF/GLB/point-cloud/GIS pages should use the same chrome and behavior model, with format-specific tools added only where necessary.
- Backend derivative status must be visible: original bytes, worker derivative, sidecar service, licensed adapter, or blocked dependency.
- A viewer must not silently substitute a different primary format. PDF can be an explicit export/print route, not the default CAD/DWG viewer.

## Clean-Room And Legal Boundary

Allowed:

- Study workflow, screen layout, command vocabulary, conversion-job lifecycle, dataset/version semantics, and API shape.
- Reimplement equivalent contracts using ArchIToken backend engines and open-source projects such as IfcOpenShell, OCCT/OCP/CadQuery, FreeCAD, Blender, GDAL, PROJ, PDAL, Cesium, MapLibre, Three.js, D3, React Flow, ForgeCAD, Stirling-PDF, PaddleOCR, MinerU, MarkItDown, and IFCDB-Agent sidecars.
- Integrate a proprietary system only through an explicit licensed adapter/service boundary with configuration, health checks, audit events, and user approval.

Forbidden:

- Copying proprietary JavaScript loaders, SDK source, encrypted assets, model binaries, WASM, EXE installers, DB schemas, or compiled runtime packages into ArchIToken core.
- Treating a local vendor installer as an open-source dependency.
- Claiming DWG/RVT/Tekla/SolidWorks/native proprietary support without the required licensed adapter evidence.
- Using screenshots or documentation to synthesize fake conversion outputs.

## Backend-First Implementation Targets

The benchmark confirms that ArchIToken should not rely on frontend-only parsing for production BIM/CAD/GIS scale. Required backend routes:

1. `model_to_lightweight_scene`: source model to geometry tiles/mesh plus material and bounding metadata.
2. `model_property_index_generate`: object tree, property sets, native IDs, IFC GUID/Express IDs, and search index.
3. `element_identity_map_generate`: stable mapping across source ID, derivative ID, IFC ID, and UI selection ID.
4. `cad_to_vector_scene`: DWG/DXF to entity/layer/layout/text/dimension manifest plus renderable vector geometry.
5. `gis_to_tiles`: OSGB/TIF/LAS/PLY/SHP/GeoJSON to CRS-aware tile and metadata artifacts.
6. `offline_package_export`: package artifacts, manifests, viewpoints, annotations, and permission snapshot for offline viewing.
7. `viewer_command_audit`: every select, isolate, hide/show, color, opacity, section, measurement, annotation, and export command emits auditable records.

## Current Gap Statement

This inventory is now recorded in the repository, but recording a reference is not the same as full implementation. The current ArchIToken route must continue to expose missing native dependencies as blocked adapter states until the backend worker or licensed service produces real artifacts and smoke evidence.
