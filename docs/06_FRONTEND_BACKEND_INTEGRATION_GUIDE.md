# Frontend Backend Integration Guide

## Local Runtime

Backend:

```bash
cd 04-backend
cargo run --bin insomeos-gateway
```

The gateway uses the checked-in development fallback when no config files are present. Production-like profiles still require explicit config.

Frontend:

```bash
cd 03-frontend
NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL=http://localhost:8080 bun run dev
```

Default API base URL is `http://localhost:8080` when `NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL` is not set.

Dev integration page:

```text
http://localhost:3000/app/dev/api-lab
```

The page can load runtime capabilities, create and approve a generation job, list standalone artifacts, and submit plus acknowledge a viewer command.

## Runtime Capabilities

```bash
curl -fsS http://localhost:8080/v1/runtime/capabilities | jq
```

Expected values include `localImplementationMode: "in_memory_preview"`, active module ids, generation modes, artifact kinds/statuses, geometry/property formats, viewer hints, viewer command kinds, registry availability, and storage provider `memory`.

## Generation Sequence

```bash
JOB_ID="$(
  curl -fsS -X POST http://localhost:8080/v1/generation/jobs \
    -H 'Content-Type: application/json' \
    --data '{"moduleId":"digital_twin","mode":"model_to_lightweight_scene","prompt":"Create a local preview lightweight scene.","actor":"dev"}' |
    jq -r '.id'
)"

curl -fsS -X POST "http://localhost:8080/v1/generation/jobs/${JOB_ID}/plan" \
  -H 'Content-Type: application/json' \
  --data '{"actor":"dev","comment":"plan"}' | jq '.status'

curl -fsS -X POST "http://localhost:8080/v1/generation/jobs/${JOB_ID}/run" \
  -H 'Content-Type: application/json' \
  --data '{"actor":"dev","comment":"run"}' | jq '.status'

curl -fsS -X POST "http://localhost:8080/v1/generation/jobs/${JOB_ID}/review" \
  -H 'Content-Type: application/json' \
  --data '{"reviewer":"dev","decision":"approved","comment":"accepted"}' | jq '.status'

curl -fsS -X POST "http://localhost:8080/v1/generation/jobs/${JOB_ID}/approve" \
  -H 'Content-Type: application/json' \
  --data '{"actor":"dev","comment":"approve"}' | jq '.status'
```

Expected statuses: `planned`, `pending_review`, `pending_approval`, `approved`.

## Artifact Sequence

```bash
curl -fsS "http://localhost:8080/v1/artifacts?source_job_id=${JOB_ID}" | jq
ARTIFACT_ID="$(curl -fsS "http://localhost:8080/v1/artifacts?source_job_id=${JOB_ID}" | jq -r '.artifacts[0].id')"
curl -fsS "http://localhost:8080/v1/artifacts/${ARTIFACT_ID}" | jq
curl -fsS "http://localhost:8080/v1/artifacts/${ARTIFACT_ID}/versions" | jq
curl -fsS "http://localhost:8080/v1/artifacts/${ARTIFACT_ID}/metadata" | jq
curl -fsS "http://localhost:8080/v1/artifacts/${ARTIFACT_ID}/storage-binding" | jq
```

Approved jobs produce approved generated artifacts. Current storage bindings are `memory://` metadata only.

## Viewer Command Sequence

```bash
COMMAND_ID="$(
  curl -fsS -X POST http://localhost:8080/v1/viewer/commands \
    -H 'Content-Type: application/json' \
    --data "{\"adapter\":\"threejs\",\"command\":\"set_color\",\"artifactId\":\"${ARTIFACT_ID}\",\"elementIds\":[\"architoken:demo:001\"],\"arguments\":{\"color\":\"#ff6600\"},\"actor\":\"dev\"}" |
    jq -r '.id'
)"

curl -fsS -X POST "http://localhost:8080/v1/viewer/commands/${COMMAND_ID}/ack" \
  -H 'Content-Type: application/json' \
  --data '{"actor":"dev","status":"executed","comment":"contract acknowledged","result":{"backendContractOnly":true}}' | jq
```

Expected status transitions: `queued` to `executed`, with audit event ids present.

## Registry Sequence

Use `/v1/skills`, `/v1/mcp-tools`, and `/v1/knowledge-sources`. Production approval requires commercial-safe skill licenses, MCP audit policy, and non-vendor knowledge routes. Candidate vendor sources remain `candidate_only`, `productionEnabled=false`, and `defaultRoute=disabled`.

## Policy

Open formats are first-class: IFC, glTF, GLB, 3D Tiles, point cloud, SPZ, JSON, SQLite, DuckDB, Parquet. Vendor formats such as `vendor_opt`, `vendor_db`, and `vendor_optrapid3d` are candidate-only until legal, commercial, security, SBOM, and benchmark approval is complete.

No `OptRapid3dLoader.js`, EXE, proprietary SDK, or proprietary JS package is required by this integration page.
