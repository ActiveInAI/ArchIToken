# Phase 4 Runtime Readiness Report

## Scope

This Phase 4 implementation turns the backend skeleton into a local runtime surface for frontend and third-party integration:

- Local gateway starts without checked-in secrets through a development-only fallback config.
- Runtime capabilities are discoverable at `GET /v1/runtime/capabilities`.
- Standalone artifact APIs expose references, versions, metadata, and storage bindings.
- Viewer commands are backend-owned auditable contracts.
- Registry hardening covers skill licenses, MCP audit/scope/limit invariants, and knowledge source candidate route safety.
- Frontend has fetch-based adapters and `/app/dev/api-lab`.
- Smoke scripts cover health, generation, artifacts, registries, and viewer commands.

## Start Commands

Backend:

```bash
cd 04-backend
cargo run --bin architoken-gateway
```

Frontend:

```bash
cd 03-frontend
NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL=http://localhost:8080 bun run dev
```

## New API Surface

Runtime:

- `GET /v1/runtime/capabilities`
- Schemas: `RuntimeCapabilities`, `RuntimeRegistryCapabilities`, `RuntimeStorageCapabilities`, `RuntimeViewerCapabilities`, `RuntimeGenerationCapabilities`

Artifacts:

- `GET /v1/artifacts`
- `GET /v1/artifacts/{artifact_id}`
- `GET /v1/artifacts/{artifact_id}/versions`
- `GET /v1/artifacts/{artifact_id}/metadata`
- `GET /v1/artifacts/{artifact_id}/storage-binding`

Viewer commands:

- `POST /v1/viewer/commands`
- `GET /v1/viewer/commands`
- `GET /v1/viewer/commands/{command_id}`
- `POST /v1/viewer/commands/{command_id}/ack`
- Schemas: `ViewerAdapterCommand`, `ViewerCommandStatus`, `ViewerCommandCreateRequest`, `ViewerCommandAckRequest`, `ViewerCommandListResponse`

## State Machine Invariants

Generation preserves Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver. Generator and evaluator ids remain distinct. Pending review and pending approval rejection reject the linked lifecycle transaction. Approval approves linked lifecycle transaction and generated artifacts. Terminal generation jobs cannot be rejected again.

Artifact status is mirrored across `Artifact`, `ArtifactRef`, `ArtifactMetadata.approvalStatus`, and the latest `ArtifactVersion`.

Viewer commands append audit events on create and acknowledgement. Unknown artifact ids are rejected. `vendor_optrapid3d` is accepted only as candidate/evaluation metadata and cannot request production route enablement.

## Registry Invariants

Permissive commercial skill licenses are allowed: MIT, Apache-2.0, BSD. Forbidden production licenses are blocked: GPL, AGPL, LGPL, SSPL, BUSL, Commons Clause, and proprietary EULA.

MCP tools require tenant scope, project scope, operations, bounded timeout/rate limit, and `auditPolicy.auditRequired=true` before approval.

Disabled knowledge sources cannot ingest. Candidate vendor knowledge sources may record a mock ingest job but remain `candidate_only`, `productionEnabled=false`, and `defaultRoute=disabled`. GitHub Trending sources require an explicit scheduled network job policy and no fake ranking.

## OpenAPI And SDK

OpenAPI warning count changed from 21 to 1. The remaining warning is the documented local development server URL `http://localhost:8080`.

`typescript-fetch` SDK generation succeeds into `/tmp/architoken-sdk-ts` and includes `RuntimeApi`, `GenerationApi`, `ArtifactsApi`, `ViewerCommandsApi`, `SkillsApi`, `McpToolsApi`, and `KnowledgeSourcesApi`.

## Known Limitations

The runtime is `in_memory_preview`; it does not persist real bytes, add DB migrations, call real commercial model APIs, or enable proprietary vendor routes.

Phase 6 extends this runtime with `RequestContext`, `PermissionGuard`, durable
store trait boundaries, and tenant/project isolation while keeping the same
mock/in-memory persistence boundary. Production database migrations should bind
behind the store traits, not bypass service contracts.

Open formats remain first: IFC, glTF, GLB, 3D Tiles, point cloud, SPZ, JSON, SQLite, DuckDB, and Parquet.

No proprietary loader dependency is introduced. Do not import `OptRapid3dLoader.js`, proprietary JS packages, EXEs, or SDKs without legal, commercial, security, SBOM, benchmark, and explicit approval.
