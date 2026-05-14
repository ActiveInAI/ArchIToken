# Phase 6 Durable Store + RBAC Handoff

Date: 2026-04-30

## Scope

This handoff is retained as historical RBAC coverage. The current runtime uses
the same context and permission contracts while production profile requires real
database, object storage, queue/workflow, telemetry, auth, and provider
configuration before startup.

## Runtime Boundaries

- `RequestContext` carries `tenantId`, `projectId`, `actor`, `roles`,
  `requestId`, and `correlationId`.
- Gateway handlers accept `X-Tenant-Id`, `X-Project-Id`, `X-Actor`, `X-Roles`,
  `X-Request-Id`, and `X-Correlation-Id`.
- Development profile may fall back to a dev context; production-like profiles
  reject weak tenant/project/actor/role fallback.
- `PermissionGuard` provides the role policy: `admin` has all
  permissions, `engineer` can create/run/write/viewer-create, `reviewer` can
  review/approve/read, and `auditor` is read-only.
- Store traits define adapter contracts for `ObjectStore`,
  `TransactionStore`, `EventStore`, `RegistryStore`, `ArtifactStore`,
  `ViewerCommandStore`, and `KnowledgeSourceStore`.

## Production Store Requirements

Production adapters must preserve `HarnessResult` errors, deterministic
pagination, `createdAt`/`updatedAt`/`version`, owner, tenant/project isolation,
and audit/context metadata.

## Local Run

Backend:

```bash
cd 04-backend
cargo run --bin architoken-gateway
```

Frontend API Lab:

```bash
cd 03-frontend
NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL=http://localhost:8080 bun run dev
```

Open `/app/dev/api-lab`. The dev lab lets callers enter tenant id, project id,
actor, and comma-separated roles. All requests go through the shared
`backend-api` client and carry context headers.

## Third-party / Agent Calls

Third-party frontends and AI agents should call the same REST endpoints with the
context headers above. Do not bypass the backend client in frontend code. A
minimal generation request uses an `engineer` role for create/plan/run and a
`reviewer` or `admin` role for review/approve.

## Smoke

```bash
cd 04-backend
ARCHITOKEN_API_BASE_URL=http://localhost:8080 \
ARCHITOKEN_TENANT_ID=smoke-tenant \
ARCHITOKEN_PROJECT_ID=smoke-project \
ARCHITOKEN_ACTOR=smoke \
ARCHITOKEN_ROLES=admin \
./scripts/smoke-all.sh
```

`smoke-all.sh` runs health, runtime capabilities, generation lifecycle,
artifacts, registries, viewer commands, and RBAC/cross-tenant isolation checks.

## OpenAPI

`openapi.yaml` remains OpenAPI 3.1 and includes context header parameters, 403
responses, `RequestContext`, `PermissionDecision`, and
`RuntimeStoreCapabilities`. The expected Redocly warning count remains one
localhost development server warning.

## Proprietary Boundary

`vendor_optrapid3d` remains candidate-only metadata. `OptRapid3dLoader.js`,
Glendale URLs, proprietary EXEs, proprietary SDKs, and paid/proprietary JS
packages must not enter default production routes or the repository.
