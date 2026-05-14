# Phase 7 Competitor Capability Matrix

This matrix compares target capability surfaces against ARES, LumenBIM, IFCDB, RealBIM, BlackHole, and OptRapid. It is not permission to copy code, assets, loaders, SDKs, WASM, or executable binaries.

| Capability | ARES | LumenBIM | IFCDB | RealBIM | BlackHole | OptRapid | ArchIToken Phase 7 stance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AI command orchestration | CAD-centric automation reference | BIM workflow reference | Agent/database research reference | Viewer workflow reference | 3D/runtime reference | AI optimization reference | Core approval-gated AI runtime; AI drafts commands and cannot directly mutate assets. |
| Office/PDF/OCR | Reference only | Reference only | Limited | Reference only | Not core | Reference only | Worker contracts for MinerU, PaddleOCR, MarkItDown, LibreOffice, PDFium/MuPDF/Stirling adapters. |
| CAD geometry | Strong CAD reference | BIM/CAD bridge reference | Data extraction reference | Viewer import reference | 3D runtime reference | Optimization reference | OCCT/FreeCAD/CadQuery/pythonocc/CGAL worker adapters; DWG only through licensed external adapter. |
| BIM/openBIM | Partial | Strong | Strong IFC/database focus | Viewer-oriented | Viewer-oriented | Reference | IFC, IFC4x3, IDS, bSDD, BCF, COBie contracts; IfcOpenShell worker candidate. |
| GIS/reality capture | Limited | BIM GIS reference | Limited | Viewer reference | 3D scene reference | Limited | PostGIS, GDAL, PROJ, PDAL, Entwine/EPT, CesiumJS, MapLibre, 3D Tiles, E57/LAS/LAZ/PLY contracts. |
| 360 panorama / WebXR | Limited | Reference | Limited | Viewer reference | Viewer reference | Limited | Panorama graph, camera sync, WebXR adapter, no proprietary renderer dependency. |
| Gantt / flow diagrams | Reference | Construction workflow reference | Limited | Limited | Limited | Limited | Asset kind and conversion/runtime command contracts; UI shell in Phase 7 workbench. |
| AIGC generation/view/edit/import/export | Reference | Reference | Agent reference | Viewer import/export reference | 3D runtime reference | Optimization reference | Runtime executions, conversion jobs, asset registry, viewer commands, audit, tenant/RBAC guard. |
| Database/object store | Unknown | Unknown | Strong database focus | Unknown | Unknown | Unknown | PostgreSQL/PostGIS/pgvector/PGMQ, object bindings, SeaweedFS S3, durable store contracts. |
| Search/vector/observability | Unknown | Unknown | Research reference | Unknown | Unknown | Unknown | Meilisearch, pgvector, OpenTelemetry, Langfuse contracts. |

## Competitive Boundaries

ARES, LumenBIM, IFCDB, RealBIM, BlackHole, and OptRapid are capability benchmarks only. ArchIToken implements open contracts and clean-room integration boundaries.

Prohibited default-core inputs:

- `RealBIMWeb.wasm`
- `assets.bin`
- `assets1.bin`
- `BlackHole3D.js`
- `OptRapid3dLoader.js`
- Proprietary EXEs, SDKs, loaders, and closed-source runtime blobs

## Default Route Policy

Any adapter that depends on proprietary technology, restrictive licenses, hosted accounts, or vendor-specific execution must default to candidate/reference mode. It cannot be enabled for production routing without legal, security, SBOM, benchmark, tenant isolation, RBAC, and audit review.

## Phase 6 Guard Preservation

Every Phase 7 route remains subject to:

- `RuntimeContext` parsing and propagation
- tenant/project isolation
- RBAC permission decisions
- audit event emission
- OpenAPI response contracts
- production profile rejection of weak context fallback
- smoke tests for API contracts
- license/security CI gates
