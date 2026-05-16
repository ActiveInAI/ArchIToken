# Phase 7 Worker Contract

Phase 7 workers are isolated execution adapters for conversion, extraction, indexing, document parsing, OCR, media processing, and AI-adjacent runtime work. The Rust/Axum API remains the public core. Workers do not own authentication, authorization, tenant/project isolation, or durable state.

## Runtime Rules

- Every worker input carries `tenant_id`, `project_id`, `actor`, `job_id`, `source_asset_id`, `source_file_id`, and an operation id.
- Workers must validate required context fields before doing work.
- Workers return manifests and artifact descriptors; they do not directly mutate assets.
- The Rust API persists job state, object bindings, audit events, and approval decisions.
- Real heavy dependencies such as IfcOpenShell, GDAL, PDAL, FreeCAD, LibreOffice, OCR engines, or LangGraph are optional worker extras, not core API dependencies.
- Proprietary WASM, EXE, SDK, loader, DWG implementation, or closed competitor code is prohibited from the default production route.

## Operations

The initial operation contract is:

- `ifc_ingest`
- `ifc_to_glb`
- `ifc_to_3dtiles`
- `openbim_validate`
- `bcf_ingest`
- `idm_ingest`
- `bsdd_enrich`
- `ifcdb_index`
- `ifcdb_query`
- `ifcdb_export`
- `ifcdb_clash`
- `ifcdb_quantity`
- `cad_convert`
- `cad_extract_entities`
- `pdf_parse`
- `ocr`
- `office_convert`
- `gis_tile`
- `pointcloud_tile`
- `panorama_ingest`
- `media_transcode`
- `image_generate`
- `audio_generate`
- `video_generate`
- `drawing_generate`
- `model_generate`
- `bim_generate`
- `document_generate`
- `table_generate`
- `gantt_generate`
- `flow_generate`
- `mindmap_generate`

## Execution Boundary

Temporal can schedule workers later, but this PR only defines the contract. The API creates conversion jobs, workers consume job payloads, and outputs return through the API for persistence and audit.

`ifcdb_*` operations are executable only through the `ifcdb_agent` sidecar adapter. Production requires `IFCDB_AGENT_URL` and `IFCDB_AGENT_VERSION=v1.0.9`; missing configuration returns `blocked` instead of synthetic query, clash, export, or quantity results.
