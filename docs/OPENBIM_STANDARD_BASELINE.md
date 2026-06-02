# openBIM Standard Baseline

Status: mandatory architecture baseline.

ArchIToken CAD/BIM/CIM/GIS data flows are based on the buildingSMART openBIM standard system. Vendor formats and proprietary runtimes are adapters; they are not the semantic source of truth.

## Standard Stack

| Standard | Role in ArchIToken | Runtime route |
| --- | --- | --- |
| IFC | Object, geometry, spatial, property, material, relationship, and classification model truth. | IfcOpenShell ingestion, IfcConvert derivatives, web-ifc browser preview. |
| IDM | Process, actor, milestone, information exchange, deliverable, and information requirement truth. | `idm` worker registers structured `idmSpec` or source document manifests. |
| bSDD | Dictionary, classification, property, terminology, URI, and multilingual semantic mapping truth. | `bsdd` worker calls buildingSMART bSDD API through `BSDD_API_URL`. |
| SJG 157-2024 | Shenzhen building engineering BIM semantic dictionary for building, space, element, and system category codes, IFC mappings, and `szbd:` RDF identifiers. | `standard_library` PostgreSQL semantic dictionary tables plus `/v1/semantic-dictionaries/sjg157` Gateway APIs. |
| BCF | Issue, clash, comment, viewpoint, assignee, due date, and resolution package truth. | `bcf` worker parses real BCF/BCFZIP packages into topics, comments, and viewpoints. |
| IDS | Machine-checkable information requirement truth for IFC deliveries. | `ids` worker validates IFC against IDS through ifctester. |
| buildingSMART Validate | IFC syntax, schema, normative checks, implementer agreement checks, and validation report truth. | `buildingsmart_validate` worker runs local IfcOpenShell checks and optional official validate service/CLI. |
| OpenCDE / Foundation API / BCF API / Dictionaries API | Collaboration and data-exchange API contract references. | Gateway/service adapters; concrete implementation must keep tenant, RBAC, audit, and object-store boundaries. |
| IFCDB-Agent | IFC object graph database, SQL/natural-language query, dynamic submodel export, clash, and quantity route. | `ifcdb_agent` worker calls DeeJoin/IFCDB-Agent v1.0.9 through `IFCDB_AGENT_URL` sidecar endpoints. |

## Required Flow

1. IDM defines who exchanges what information, when, and for what purpose.
2. IDS turns relevant information requirements into machine-checkable rules.
3. IFC carries the model entities, geometry, relationships, properties, and classification links.
4. bSDD provides dictionary URIs and semantic normalization for object/property/classification terms.
5. SJG 157 provides Shenzhen-specific building engineering model-unit category codes and `szbd:` semantic identifiers where the project jurisdiction requires them.
6. buildingSMART Validate checks IFC syntax/schema and normative conformance.
7. BCF records issues, clashes, viewpoints, comments, responsibility, and closure evidence.
8. IFCDB-Agent indexes IFC object graphs for SQL/natural-language query, export, clash, and quantity workflows when the v1.0.9 sidecar is configured.
9. The gateway persists every worker result as object-store artifacts and audit events.

## Non-Negotiable Rules

- Do not use RVT, DWG, DGN, SKP, 3DM, Tekla, Navisworks, or other vendor formats as the platform semantic truth.
- Do not claim openBIM validation from a manifest-only or source-less job.
- Do not generate BIM output without an IFC/IDS/bSDD/IDM/BCF mapping plan.
- Do not close model issues without BCF-compatible evidence or an explicitly mapped issue record.
- Do not treat bSDD text labels as enough; store URI/source metadata where available.
- Do not mark a model release approved without validation artifacts and audit linkage.
- Do not claim buildingSMART openBIM readiness from IFC ingest alone. IFC semantic extraction is necessary evidence, but `bim_semantics_manifest.json` must link IDS, buildingSMART Validate, bSDD or approved dictionary mapping, BCF/issue closure, IDM, and approval/audit evidence before the claim can move to Approver review.
- Do not treat a required evidence artifact as sufficient when its worker output is failed or non-executable; the Gateway read model must expose it as failed evidence, not ready evidence.
- Do not claim IFCDB-Agent support unless `IFCDB_AGENT_URL` and `IFCDB_AGENT_VERSION=v1.0.9` are configured and smoke evidence covers index/query/export/clash/quantity.

## Runtime Evidence

| Evidence | Required artifact |
| --- | --- |
| IFC ingest and BIM semantic extraction | `ifc_entities.jsonl`, `ifc_relationships.jsonl`, `ifc_properties.jsonl`, `ifc_quantities.jsonl`, `ifc_classifications.jsonl`, `ifc_spatial_tree.json`, `geometry_manifest.json`, `ifc_derivative_manifest.json`, `bim_semantics_manifest.json`, `model_manifest.json` |
| IDS validation | `ids_validation_report.json` |
| buildingSMART validation | `buildingsmart_validate_report.json` |
| bSDD enrichment | `bsdd_classification_report.json` or worker output with source URL/query |
| SJG 157 dictionary import | PostgreSQL rows in `semantic_dictionary_categories` loaded by `04-backend/scripts/import-sjg157-semantic-dictionary.py` from an authorized PDF, including source SHA-256 and `source_line` traceability |
| BCF package | `bcf_manifest.json`, `bcf_topics.jsonl`, `bcf_comments.jsonl`, `bcf_viewpoints.jsonl` |
| IDM exchange requirements | `idm_manifest.json` |
| Approval and audit chain | gateway approval/version/audit artifacts linked through `bim_semantics_manifest.json` |
| IFCDB-Agent | `ifcdb_index_report.json`, `ifcdb_query_result.json`, `ifcdb_export_result.json`, `ifcdb_clash_report.json`, `ifcdb_quantity_report.json` or binary export response artifacts |

## Implementation References

- Gateway BIM semantic readiness API: `04-backend/harness-core/src/bin/gateway.rs`
- Gateway evidence aggregation: latest `ifc_ingest` plus latest required IDS, Validate, bSDD, BCF, IDM, and approval/audit artifacts for the same asset.
- Worker dispatch: `06-workers/architoken_workers/worker_cli.py`
- Runtime isolation: `06-workers/architoken_workers/engine_registry.py`
- IFCDB-Agent evidence: `docs/IFCDB_AGENT_INTEGRATION.md`
- Source registry: `03-frontend/lib/adapter-source-registry.ts`
- File type registry: `03-frontend/lib/file-type-registry.ts`
- Architecture constitution: `02-architecture/CONSTITUTION.md`
