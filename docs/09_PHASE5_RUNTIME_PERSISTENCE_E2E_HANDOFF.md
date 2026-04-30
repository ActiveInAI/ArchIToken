# Phase 5 Runtime Persistence E2E Handoff

## Scope

Phase 5 closes the engineering loop around the Phase 4 runtime API: stable
contract tests, smokeable end-to-end flows, frontend API Lab integration, and a
replaceable persistence boundary.

This phase remains mock/in-memory/dev-only. It does not call real model
providers, add database migrations, crawl external sources, or persist
production object bytes. Current artifact storage bindings use `memory://`
metadata and are designed to be replaced later behind `ObjectStore` and
`StorageRouter` without changing API callers.

## Start Backend

```bash
cd 04-backend
cargo run --bin insomeos-gateway
```

The gateway serves `http://localhost:8080` by default in local development.

## Start Frontend

```bash
cd 03-frontend
NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL=http://localhost:8080 bun run dev
```

Open:

```text
http://localhost:3000/app/dev/api-lab
```

The API Lab shows backend base URL, runtime capability status, generation job
id/status, first artifact id, viewer command id/status, and an error panel. It
uses the checked-in backend API fetch clients and does not import a generated
SDK.

## Smoke

```bash
cd 04-backend
ARCHITOKEN_API_BASE_URL=http://localhost:8080 ./scripts/smoke-all.sh
```

`smoke-all.sh` checks `jq`, then runs health, runtime capabilities, generation
lifecycle, artifacts, registries, and viewer commands. Failures print the smoke
script name, line, and target base URL.

## OpenAPI And SDK

Validation target:

```bash
cd 04-backend
npx --yes @redocly/cli@2.30.0 lint openapi.yaml
npx --yes @openapitools/openapi-generator-cli@2.23.0 generate \
  -i openapi.yaml \
  -g typescript-fetch \
  -o /tmp/architoken-sdk-ts
```

Expected OpenAPI warning count is 1: the existing localhost development server
URL warning. SDK output must stay in `/tmp/architoken-sdk-ts`; do not commit
generated SDK output or `04-backend/openapitools.json`.

## Policy Boundary

Do not add `OptRapid3dLoader.js`, proprietary EXEs, proprietary SDKs, or
proprietary JS packages to the repo. Vendor formats and `vendor_optrapid3d`
remain candidate-only metadata until legal, commercial, security, SBOM,
benchmark, and explicit approval gates are complete.
