# API Smoke Test Guide

## Prerequisites

```bash
jq --version
```

All smoke scripts require `jq`. If it is absent, scripts print a friendly error and exit.

Start backend:

```bash
cd 04-backend
cargo run --bin architoken-gateway
```

Default `ARCHITOKEN_API_BASE_URL` is `http://localhost:8080`. `BASE_URL` is
still accepted as a compatibility fallback.

Phase 6 smoke scripts also accept:

```bash
ARCHITOKEN_TENANT_ID=smoke-tenant
ARCHITOKEN_PROJECT_ID=smoke-project
ARCHITOKEN_ACTOR=smoke
ARCHITOKEN_ROLES=admin
```

## Scripts

```bash
cd 04-backend
./scripts/smoke-health.sh
./scripts/smoke-generation.sh
./scripts/smoke-artifacts.sh
./scripts/smoke-registries.sh
./scripts/smoke-viewer-commands.sh
./scripts/smoke-rbac.sh
./scripts/smoke-all.sh
```

Override target:

```bash
ARCHITOKEN_API_BASE_URL=http://localhost:8080 \
ARCHITOKEN_TENANT_ID=smoke-tenant \
ARCHITOKEN_PROJECT_ID=smoke-project \
ARCHITOKEN_ACTOR=smoke \
ARCHITOKEN_ROLES=admin \
./scripts/smoke-all.sh
```

## Coverage

`smoke-health.sh` checks `/healthz`, `/readyz`, and `/v1/runtime/capabilities`.

`smoke-generation.sh` runs create, plan, run, review, approve, then lists job artifacts. Expected final job status is `approved`.

`smoke-artifacts.sh` validates standalone artifact list, get, versions, metadata, and storage-binding. Expected artifact status is `approved` after the approved generation job.

`smoke-registries.sh` validates a permissive skill approval, blocked license behavior, MCP tool approval with audit required, and candidate-only vendor knowledge source behavior.

`smoke-viewer-commands.sh` creates a `set_color` viewer command against a generated artifact, marks it as `executed`, and verifies command listing.

`smoke-rbac.sh` verifies engineer create/run, auditor create denial with HTTP
403, reviewer review/approve, and cross-tenant job/artifact list isolation.

## Known Limitations

Development runtime may use `in_memory_preview`; production smoke must run with PostgreSQL, S3-compatible storage, queues, telemetry, and configured provider routes.

OpenAPI lint is expected to keep only the existing localhost development server warning. SDK generation output must go to `/tmp/architoken-sdk-ts`; generated SDK files are not committed.

Vendor adapter hints remain metadata only. No proprietary loader dependency, EXE, SDK, or production vendor route is used by smoke tests.
