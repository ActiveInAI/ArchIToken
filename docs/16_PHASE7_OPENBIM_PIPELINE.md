# Phase 7 openBIM Pipeline

The openBIM worker adapters execute IFC ingestion, IFC derivatives, buildingSMART validation, IDS validation, bSDD enrichment, BCF package ingest, IDM exchange requirement ingest, and IFCDB-Agent sidecar workflows. Heavy runtimes stay out of the Rust gateway and are executed by isolated workers.

## Outputs

`ifc_ingest` produces:

- `ifc_entities.jsonl`
- `ifc_relationships.jsonl`
- `ifc_properties.jsonl`
- `ifc_quantities.jsonl`
- `ifc_classifications.jsonl`
- `ifc_properties_index.json`
- `ifc_spatial_tree.json`
- `geometry_manifest.json`
- `ifc_derivative_manifest.json`
- `bim_semantics_manifest.json`
- `model_manifest.json`

`bim_semantics_manifest.json` is the machine-readable BIM semantic ledger. It marks IFC source/schema, entity graph, relationships, spatial structure, property sets, quantity sets, classification links, geometry expression, and derivative cache as IFC-ingest evidence. It also blocks any buildingSMART openBIM review until linked IDS, buildingSMART Validate, bSDD or approved dictionary mapping, BCF/issue closure, IDM, and approval/audit artifacts are present; final compliance claims still require Approver review.

## Gateway Read Model

The Gateway exposes the latest IFC semantic readiness record for an asset through:

- `GET /v1/bim/models/{asset_id}/semantics`
- `GET /v1/bim/models/{asset_id}/openbim-readiness`

Both routes read the latest `ifc_ingest` conversion job for the asset, then aggregate every conversion job for that asset that contributes required openBIM evidence. The response returns `readinessStatus`, `semanticLayers`, `requiredEvidence`, `openBimClaim`, `missingEvidence`, `failedEvidence`, and persisted worker `artifacts`.

If the asset has no IFC ingest job, the response stays at `ifc_ingest_required`; if the latest ingest job failed or is still running before publishing `bim_semantics_manifest.json`, the response surfaces that conversion state, for example `ifc_ingest_failed` or `ifc_ingest_running`. A completed job without `bim_semantics_manifest.json` stays at `semantic_manifest_missing`.

When IFC semantic extraction is present, the Gateway recomputes `openBimClaim` from the latest evidence jobs:

- `idsValidation` from `ids_validation_report.json`
- `buildingSmartValidate` from `buildingsmart_validate_report.json`
- `bsddClassification` from `bsdd_classification_report.json`
- `bcfIssueClosure` from `bcf_manifest.json`
- `idmExchangeRequirements` from `idm_manifest.json`
- `approvalAuditChain` from `approval_audit_chain.json`

Missing evidence keeps the response at `blocked_pending_required_evidence`; failed or non-executable evidence keeps it at `blocked_failed_required_evidence`; only complete non-failing evidence can move to `ready_for_openbim_review`. These routes are evidence read models only: they do not authorize a buildingSMART openBIM claim without Approver review and audit closure.

`openbim_validate` uses the buildingSMART Validate adapter by default. If the job input includes `idsPath`, `ids_path`, `idsObjectKey`, `ids_object_key`, `validator: "ids"`, or `standard: "ids"`, the Gateway dispatches the same operation to the IDS adapter so the required `ids_validation_report.json` can be produced without introducing a separate operation enum.

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
