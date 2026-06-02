# IFCDB-Agent Integration Evidence

Status: active sidecar integration contract.

## Source Package

Local package inspected:

- Path: `/home/insome/下载/IFCDB-Agent-main.zip`
- SHA-256: `e69bba619705f95a60c461f9357cc6e975b9c4d2f92ed92a27aaef4848b91acc`
- Archive commit marker: `df0fe7d4e6dfcb625611c4af12d7954300455acd`
- Files:
  - `IFCDB-Agent-main/README.md`
  - `IFCDB-Agent-main/IFCDB Product Introduction.pdf`
  - `IFCDB-Agent-main/IFCDB User Manual.pdf`

The package does not contain importable backend source, Docker files, service manifests, OpenAPI files, SDKs, or Linux binaries. The public v1.0.9 release also exposes a Windows installer. ArchIToken therefore integrates IFCDB-Agent as an isolated external runtime, not as an in-process library.

## Documented Capabilities

The user manual documents these user-facing IFCDB capabilities:

- IFC model upload and multi-model import/merge.
- AI natural-language query.
- SQL query, with SQL command text prefixed by `%%sql_ifc`.
- CSV export of query results.
- Model slicing, transparency, box selection, and measurement in the desktop UI.

The README describes IFCDB as an IFC/openBIM-oriented database and AI agent for property, geometry, relationship query, dynamic component visualization, clash checking, quantity calculation, IDS checks, bSDD/CNDD constrained semantics, and PanAI skills integration.

## ArchIToken Runtime Mapping

| IFCDB capability | ArchIToken operation | Adapter |
| --- | --- | --- |
| IFC database indexing | `ifcdb_index` | `ifcdb_agent` |
| AI or SQL object query | `ifcdb_query` | `ifcdb_agent` |
| CSV/submodel/geometry export | `ifcdb_export` | `ifcdb_agent` |
| Clash check | `ifcdb_clash` | `ifcdb_agent` |
| Quantity takeoff | `ifcdb_quantity` | `ifcdb_agent` |

Production requires:

```bash
IFCDB_AGENT_URL=http://ifcdb-agent:8080
IFCDB_AGENT_VERSION=v1.0.9
```

Optional endpoint overrides:

```bash
IFCDB_AGENT_HEALTH_PATH=/health
IFCDB_AGENT_INDEX_PATH=/api/v1/ifcdb/index
IFCDB_AGENT_QUERY_PATH=/api/v1/ifcdb/query
IFCDB_AGENT_EXPORT_PATH=/api/v1/ifcdb/export
IFCDB_AGENT_CLASH_PATH=/api/v1/ifcdb/clash
IFCDB_AGENT_QUANTITY_PATH=/api/v1/ifcdb/quantity
```

## Non-Synthetic Rule

If `IFCDB_AGENT_URL` is missing, or production is not pinned to `IFCDB_AGENT_VERSION=v1.0.9`, IFCDB jobs must return `blocked`. ArchIToken must not synthesize IFCDB query, clash, export, or quantity results from documentation alone.
