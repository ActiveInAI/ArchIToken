# API Smoke Test Guide

## Prerequisites

```bash
jq --version
```

All smoke scripts require `jq`. If it is absent, scripts print a friendly error and exit.

Start backend:

```bash
cd 04-backend
cargo run --bin insomeos-gateway
```

Default `BASE_URL` is `http://localhost:8080`.

## Scripts

```bash
cd 04-backend
./scripts/smoke-health.sh
./scripts/smoke-generation.sh
./scripts/smoke-artifacts.sh
./scripts/smoke-registries.sh
./scripts/smoke-viewer-commands.sh
./scripts/smoke-all.sh
```

Override target:

```bash
BASE_URL=http://localhost:8080 ./scripts/smoke-all.sh
```

## Coverage

`smoke-health.sh` checks `/healthz`, `/readyz`, and `/v1/runtime/capabilities`.

`smoke-generation.sh` runs create, plan, run, review, approve, then lists job artifacts. Expected final job status is `approved`.

`smoke-artifacts.sh` validates standalone artifact list, get, versions, metadata, and storage-binding. Expected artifact status is `approved` after the approved generation job.

`smoke-registries.sh` validates a permissive skill approval, blocked license behavior, MCP tool approval with audit required, and candidate-only vendor knowledge source behavior.

`smoke-viewer-commands.sh` creates a `set_color` viewer command against a generated artifact, acknowledges it as `executed`, and verifies command listing.

## Known Limitations

The runtime is `in_memory_preview`. It does not persist real artifact bytes, does not call commercial model APIs, and does not enable proprietary vendor routes.

Vendor adapter hints remain metadata only. No proprietary loader dependency, EXE, SDK, or production vendor route is used by smoke tests.
