# Phase 7 openBIM Pipeline

The openBIM worker adapters execute IFC ingestion, IFC derivatives, buildingSMART validation, IDS validation, bSDD enrichment, BCF package ingest, IDM exchange requirement ingest, and IFCDB-Agent sidecar workflows. Heavy runtimes stay out of the Rust gateway and are executed by isolated workers.

## Outputs

`ifc_ingest` produces:

- `ifc_entities.jsonl`
- `ifc_relationships.jsonl`
- `ifc_properties.jsonl`
- `ifc_spatial_tree.json`
- `geometry_manifest.json`
- `model_manifest.json`

`ifcdb_*` operations produce:

- `ifcdb_index_report.json`
- `ifcdb_query_result.json`
- `ifcdb_export_result.json` or a binary export response artifact
- `ifcdb_clash_report.json`
- `ifcdb_quantity_report.json`

## Optional Dependencies

Real IFC parsing and validation require worker image dependencies:

```bash
pip install -e ".[openbim]"
```

IFCDB-Agent requires a configured sidecar because the public v1.0.9 release is distributed as an external runtime, not a Linux library:

```bash
export IFCDB_AGENT_URL=http://ifcdb-agent:8080
export IFCDB_AGENT_VERSION=v1.0.9
```

The inspected `IFCDB-Agent-main.zip` package contains documentation only. The worker applies documented v1.0.9 behavior where possible: SQL jobs sent through the `sql` input are wrapped as `%%sql_ifc` commands, and export jobs default to CSV unless `exportFormat` is supplied.

The Rust API remains responsible for asset state, object bindings, audit, RBAC, and tenant/project isolation.
