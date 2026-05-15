# openBIM Standard Baseline

Status: mandatory architecture baseline.

ArchIToken CAD/BIM/CIM/GIS data flows are based on the buildingSMART openBIM standard system. Vendor formats and proprietary runtimes are adapters; they are not the semantic source of truth.

## Standard Stack

| Standard | Role in ArchIToken | Runtime route |
| --- | --- | --- |
| IFC | Object, geometry, spatial, property, material, relationship, and classification model truth. | IfcOpenShell ingestion, IfcConvert derivatives, web-ifc browser preview. |
| IDM | Process, actor, milestone, information exchange, deliverable, and information requirement truth. | `idm` worker registers structured `idmSpec` or source document manifests. |
| bSDD | Dictionary, classification, property, terminology, URI, and multilingual semantic mapping truth. | `bsdd` worker calls buildingSMART bSDD API through `BSDD_API_URL`. |
| BCF | Issue, clash, comment, viewpoint, assignee, due date, and resolution package truth. | `bcf` worker parses real BCF/BCFZIP packages into topics, comments, and viewpoints. |
| IDS | Machine-checkable information requirement truth for IFC deliveries. | `ids` worker validates IFC against IDS through ifctester. |
| buildingSMART Validate | IFC syntax, schema, normative checks, implementer agreement checks, and validation report truth. | `buildingsmart_validate` worker runs local IfcOpenShell checks and optional official validate service/CLI. |
| OpenCDE / Foundation API / BCF API / Dictionaries API | Collaboration and data-exchange API contract references. | Gateway/service adapters; concrete implementation must keep tenant, RBAC, audit, and object-store boundaries. |

## Required Flow

1. IDM defines who exchanges what information, when, and for what purpose.
2. IDS turns relevant information requirements into machine-checkable rules.
3. IFC carries the model entities, geometry, relationships, properties, and classification links.
4. bSDD provides dictionary URIs and semantic normalization for object/property/classification terms.
5. buildingSMART Validate checks IFC syntax/schema and normative conformance.
6. BCF records issues, clashes, viewpoints, comments, responsibility, and closure evidence.
7. The gateway persists every worker result as object-store artifacts and audit events.

## Non-Negotiable Rules

- Do not use RVT, DWG, DGN, SKP, 3DM, Tekla, Navisworks, or other vendor formats as the platform semantic truth.
- Do not claim openBIM validation from a manifest-only or source-less job.
- Do not generate BIM output without an IFC/IDS/bSDD/IDM/BCF mapping plan.
- Do not close model issues without BCF-compatible evidence or an explicitly mapped issue record.
- Do not treat bSDD text labels as enough; store URI/source metadata where available.
- Do not mark a model release approved without validation artifacts and audit linkage.

## Runtime Evidence

| Evidence | Required artifact |
| --- | --- |
| IFC ingest | `ifc_entities.jsonl`, `ifc_relationships.jsonl`, `ifc_properties.jsonl`, `ifc_spatial_tree.json`, `model_manifest.json` |
| IDS validation | `ids_validation_report.json` |
| buildingSMART validation | `buildingsmart_validate_report.json` |
| bSDD enrichment | `bsdd_classification_report.json` or worker output with source URL/query |
| BCF package | `bcf_manifest.json`, `bcf_topics.jsonl`, `bcf_comments.jsonl`, `bcf_viewpoints.jsonl` |
| IDM exchange requirements | `idm_manifest.json` |

## Implementation References

- Worker dispatch: `06-workers/architoken_workers/worker_cli.py`
- Runtime isolation: `06-workers/architoken_workers/engine_registry.py`
- Source registry: `03-frontend/lib/adapter-source-registry.ts`
- File type registry: `03-frontend/lib/file-type-registry.ts`
- Architecture constitution: `02-architecture/CONSTITUTION.md`
