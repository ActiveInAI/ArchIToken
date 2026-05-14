# Phase 7 openBIM Pipeline

The openBIM worker adapter defines manifest contracts for IFC ingestion, IDS validation, and bSDD enrichment. It does not require a large sample IFC and does not import IfcOpenShell by default.

## Outputs

`ifc_ingest` produces:

- `ifc_entities.jsonl`
- `ifc_relationships.jsonl`
- `ifc_properties.jsonl`
- `ifc_spatial_tree.json`
- `geometry_manifest.json`
- `model_manifest.json`

## Optional Dependencies

Real IFC parsing can be added later as an optional worker extra:

```bash
pip install -e ".[openbim]"
```

The Rust API remains responsible for asset state, object bindings, audit, RBAC, and tenant/project isolation.
