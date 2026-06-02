# Phase 7 openBIM / GIS / CAD Stack Decision

## Decision

ArchIToken Phase 7 adopts an Open AEC Universal Runtime architecture with Rust/Axum/Tokio as the external API core, durable contracts for PostgreSQL/PostGIS/pgvector/PGMQ and SeaweedFS S3, and isolated workers for heavy openBIM, GIS/reality, CAD, document, OCR, media, and AI processing.

The API core remains responsible for context, RBAC, tenant/project isolation, audit, OpenAPI, smoke tests, and production strictness. Workers perform conversion and extraction through explicit job contracts and cannot directly bypass asset registry or permission checks.

## Backend Stack

| Area           | Decision                                                                    |
| -------------- | --------------------------------------------------------------------------- |
| External API   | Rust, Axum, Tokio. FastAPI is not the public core API.                      |
| Database       | PostgreSQL with PostGIS, pgvector, and PGMQ.                                |
| ORM/migration  | SeaORM and SeaORM Migrator.                                                 |
| Object storage | SeaweedFS S3 through object-store bindings.                                 |
| Workflow       | Temporal contracts for long-running conversion/runtime work.                |
| Search         | Meilisearch for lexical asset/document search.                              |
| Observability  | OpenTelemetry and Langfuse for traces, spans, and AI runtime observability. |
| OpenAPI        | utoipa/OpenAPI 3.1 contract remains the source for generated SDKs.          |

## Frontend Stack

Phase 7 introduces a Vite 8, React 19, TypeScript, TanStack Router, TanStack Query, Zustand, Tailwind CSS, and Radix UI workbench shell. The existing Next frontend remains during transition.

Viewer and map runtimes use React Three Fiber, Three.js WebGPU, CesiumJS, MapLibre GL JS, and 3d-tiles-renderer behind viewer command contracts.

## openBIM Decision

| Standard or component | Mode                  | Notes                                                                                                                                              |
| --------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| IFC / IFC4x3          | core contract         | Asset kinds, conversion jobs, model manifests, and validation outputs must support IFC semantics.                                                  |
| buildingSMART IDS     | core contract         | Validation contract for requirements and compliance checks.                                                                                        |
| buildingSMART bSDD    | core contract         | Semantic dictionary lookup and classification enrichment adapter.                                                                                  |
| BCF                   | core contract         | Issue/comment interchange adapter for model coordination.                                                                                          |
| COBie                 | core contract         | Facility handover export/import adapter.                                                                                                           |
| IfcOpenShell          | worker                | Optional worker dependency for IFC extraction and geometry processing.                                                                             |
| iTwin.js              | adapter/reference     | Optional external adapter; not a default production dependency.                                                                                    |
| Speckle               | CDE adapter           | Selected openBIM CDE interoperability layer for stream/object/commit collaboration through configured Speckle Server/API and connector boundaries. |
| IFCDB-Agent           | worker/service target | Required IFC database, query, object-graph, and agent route behind an isolated worker or sidecar service.                                          |
| ThatOpen Components   | adapter/reference     | Optional viewer/workbench reference.                                                                                                               |
| xeokit                | isolated sidecar/reference | AGPL risk blocks default core embedding, but a real xeokit route may be selected through an isolated service/sidecar with artifacts and license evidence. |

## GIS / Reality Decision

PostGIS, GDAL, PROJ, PDAL, Entwine/EPT, CesiumJS, MapLibre GL JS, and 3D Tiles form the open GIS/reality stack. E57, LAS, LAZ, PLY, OSGB adapters, 360 panorama graphs, and WebXR are represented as asset kinds, conversion operations, viewer commands, and worker contracts before production-grade native integrations are enabled.

Glendale/BlackHole-style server/client adaptive rendering, offline package, model tree, property panel, LOD, CAD layout, and GIS/BIM scene workflows are capability benchmarks only. They are tracked in `docs/VENDOR_BIM_PLATFORM_REFERENCE_INVENTORY.md`. ArchIToken may borrow the product logic through clean-room contracts, but must not copy proprietary loaders, SDKs, EXEs, schemas, WASM, or runtime packages.

## CAD Decision

OCCT, FreeCAD headless workers, CadQuery, pythonocc-core, and CGAL define the open CAD/geometry worker direction. Dynamo, pascalorg/editor, and Macad3D are reference inputs only.

Supported open format contracts include DXF, SVG, STEP, IGES, STL, OBJ, 3MF, and glTF. DXF/DWG source-file viewing uses `https://github.com/mlightcad/cad-viewer` through `@mlightcad/cad-simple-viewer` as the browser runtime. DWG parsing in that runtime depends on `@mlightcad/libredwg-web` / `https://github.com/mlightcad/libredwg-web` (GPL-3.0), so it is recorded as a browser/WASM adapter boundary and requires license/isolation approval before production distribution. ODA, LibreDWG CLI, LibreCAD/QCAD, FreeCAD and licensed vendor adapters are no longer the default DXF/DWG viewer path; they remain explicit diagnostics, conversion, validation or export adapters.

RVT/RFA, SketchUp SKP, Rhino 3DM, and unknown vendor BIM sources such as STEL route through the `licensed_bim_adapter` boundary. Production success requires real source bytes plus persisted IFC/GLB/STEP derivatives or object-store references; the gateway and workers must not claim support from placeholder manifests. SKP->IFC specifically requires a real legal SKP reader/exporter command such as `PRENGINE_SKP_TO_IFC_COMMAND` or a licensed service, and must not be satisfied by GLB viewing fallback.

The CAD/BIM/GIS viewer route is source-bound first: DXF/DWG source bytes can be opened by the registered MLightCAD browser runtime, while backend workers remain responsible for durable derivatives, property indexes, rule validation, export artifacts and audited command events. Browser rendering is allowed for original CAD bytes or persisted worker derivatives, not as a substitute for claiming unavailable conversion/export/compliance support.

## Document / AI Decision

PDF.js is not the core PDF runtime. PDFium and MuPDF remain adapter contracts, Stirling-PDF is an adapter/reference, and MinerU/PaddleOCR/MarkItDown/LibreOffice run behind document worker contracts.

The AI runtime uses a Rust provider registry, MCP registry, pgvector, Meilisearch, Langfuse, OpenTelemetry, and LangGraph-compatible workers. AI-generated actions must produce approval-gated draft commands or conversion jobs and must not directly mutate assets.

## Security and License Gates

No GPL/AGPL/LGPL/SSPL/BUSL/Commons Clause dependency may enter default production core without explicit policy review. Foundational copyleft capabilities must still be implemented through isolated external process, container, service, sidecar, IPC or licensed adapter routes when they are the strongest production path; they must not be dismissed as reference-only because of the license. xeokit stays out of core because of AGPL risk, but if selected it must run as an isolated sidecar/service with real artifacts and license evidence. Proprietary WASM/EXE/SDK/loader assets are prohibited from the default core runtime.
