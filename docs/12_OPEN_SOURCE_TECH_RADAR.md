# Phase 7 Open Source Tech Radar

Phase 7 moves ArchIToken from a runtime-contract skeleton toward an Open AEC Universal Runtime. The radar is a decision input, not an import list. Every runtime path must preserve Phase 6 `RuntimeContext`, RBAC, tenant/project isolation, audit events, OpenAPI contracts, smoke tests, license/security checks, and strict production profile behavior.

## Integration Modes

| Mode | Meaning | Runtime rule |
| --- | --- | --- |
| core | Eligible for first-party runtime contracts or supported OSS dependencies after license/security review. | Must pass SBOM, license, security, CI, and tenant/RBAC integration gates. |
| worker | Runs behind an isolated worker contract, usually for heavy conversion, parsing, indexing, or optional native dependencies. | No direct asset mutation; outputs manifests, files, traces, and audit payloads. |
| adapter | Boundary contract for external systems or optional deployments. | Default production route stays disabled until legal and security review pass. |
| reference | Architecture or UX reference only. | Do not copy code or bundle as a production dependency. |
| watch | Track capability and license posture. | Not part of default runtime. |

## Seeded Radar

The source of truth for automated metadata collection is `config/tech-radar.seed.yaml`. Run:

```bash
python tools/github_tech_radar.py --seed config/tech-radar.seed.yaml --out /tmp/tech-radar.md
```

The script uses the GitHub REST API, honors `GITHUB_TOKEN` when present, and degrades individual repositories to `fetch_failed` rows instead of failing the whole run.

## Core Candidates

| Category | Core candidates | Rationale |
| --- | --- | --- |
| openBIM | buildingSMART IDS, bSDD, IfcOpenShell | Defines IFC validation, semantic dictionary integration, and IFC processing contracts. |
| GIS / reality | CesiumJS, MapLibre GL JS, 3D Tiles Renderer, GDAL, PROJ, PDAL, Entwine | Covers geospatial visualization, coordinate systems, tiling, point clouds, and 3D Tiles. |
| CAD / geometry | OCCT, FreeCAD, CadQuery, pythonocc-core, CGAL | Provides open geometry and scripted modeling surfaces behind worker boundaries. |
| document AI | PaddleOCR, MinerU, MarkItDown | Provides OCR, PDF/document parsing, and markdown conversion candidates behind workers. |
| frontend runtime | Vite, React Three Fiber, drei, Zustand, TanStack Router, TanStack Query | Supports the Phase 7 workbench shell and asset/runtime interaction model. |
| media | FFmpeg, Shaka Player | Supports media metadata, transcode boundaries, and web playback contracts. |

## Restricted Or Reference Candidates

| Component | Decision |
| --- | --- |
| xeokit | Watch/reference only because AGPL licensing is incompatible with default core production bundling. |
| IFCDB-Agent | Watch/reference only for database-agent capability research; no production dependency by default. |
| iTwin.js, Speckle, ThatOpen Components | Adapter/reference boundaries. Integrations must be optional and respect upstream licenses, auth, and data residency. |
| Dynamo, pascalorg/editor, Macad3D | Reference only unless a later review establishes license, packaging, and runtime isolation. |
| Stirling-PDF | Adapter/reference boundary, not core PDF runtime. PDFium/MuPDF remain adapter contracts. |

## Prohibited Core Inputs

ArchIToken must not import or copy proprietary competitor code, proprietary WASM blobs, proprietary EXEs, proprietary SDKs, or proprietary loaders into the default core runtime. This explicitly includes `RealBIMWeb.wasm`, `assets.bin`, `assets1.bin`, `BlackHole3D.js`, and `OptRapid3dLoader.js`.

DWG support is a legal adapter boundary only. The core runtime may define metadata, upload, conversion-job, and audit contracts for DWG-adjacent workflows, but it must not embed a proprietary DWG implementation.

## Required Standards Coverage

The openBIM track must cover IFC, IFC4x3, IDS, bSDD, BCF, and COBie. These standards are runtime contracts first; production-grade parsers, validators, and exporters land through isolated workers and explicit license/security review.
