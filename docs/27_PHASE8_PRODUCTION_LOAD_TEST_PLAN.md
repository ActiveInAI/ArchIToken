# Phase 8 Production Load Test Plan

Date: 2026-05-01

This plan defines how Phase 8 validates the first-day 100k concurrent-session target with k6 and existing smoke scripts.

## Test Assets

| File | Purpose |
| --- | --- |
| `tools/k6/phase8_100k_smoke.js` | Low-volume traffic split smoke for API, asset, presign, conversion, viewer, and realtime placeholder paths. |
| `tools/k6/phase8_100k_ramp.js` | Staged ramp profile for first-day traffic shape. |
| `tools/k6/README.md` | Environment variables, scenario model, and execution notes. |
| `04-backend/scripts/smoke-phase8-scale.sh` | Functional scale-contract smoke without large object uploads. |
| `04-backend/scripts/load-phase8-100k.sh` | k6 wrapper for smoke/ramp execution. |
| `04-backend/scripts/smoke-phase8-production-readiness.sh` | CI-friendly validation for strict tech radar, compose, K8s, k6 syntax when available, and proprietary runtime guard. |

## Scenario Groups

| Scenario | Intent |
| --- | --- |
| `anonymous_browser` | Static app hit and health/capability checks through edge/API paths. |
| `authenticated_api` | Authenticated metadata reads/writes using context headers. |
| `viewer_manifest` | Viewer manifest and asset list traffic without triggering conversion. |
| `object_presign` | Presign and complete-upload control-plane calls without uploading large files. |
| `conversion_enqueue` | Queue conversion/AI-adjacent work without synchronous processing. |
| `realtime_presence` | Realtime handshake placeholder for WebSocket-first collaboration. |

## Thresholds

- `http_req_failed` below 0.1% for ramp tests.
- API read p95 below 300 ms for read-heavy requests.
- API write p95 below 800 ms for write/enqueue requests.
- Viewer manifest p95 below 1.5 s.
- Presign and enqueue success above 99.9%.
- p99 must be tracked even where the hard SLO is p95.

## Execution Sequence

1. Run backend smoke for health, runtime capabilities, asset metadata, object presign/complete, conversion enqueue, viewer command, runtime execution list, and realtime placeholder.
2. Run k6 smoke against staging with production-like ingress, object-store endpoint, and database pool settings.
3. Run k6 ramp at 10%, 25%, 50%, and 100% target mix.
4. Run a soak period at the highest approved level.
5. Verify dashboards for API errors, latency, database saturation, queue lag, object-store success, worker throughput, realtime fanout, and isolation alerts.

## Commands

```bash
04-backend/scripts/smoke-phase8-scale.sh
04-backend/scripts/smoke-phase8-production-readiness.sh
04-backend/scripts/load-phase8-100k.sh smoke
04-backend/scripts/load-phase8-100k.sh ramp
```

Useful environment variables:

```bash
export ARCHITOKEN_API_BASE_URL=https://api.example.invalid
export ARCHITOKEN_FRONTEND_BASE_URL=https://app.example.invalid
export ARCHITOKEN_WS_BASE_URL=wss://realtime.example.invalid
export ARCHITOKEN_TENANT_ID=load-tenant
export ARCHITOKEN_PROJECT_ID=load-project
export ARCHITOKEN_ACTOR=load-runner
export ARCHITOKEN_ROLES=admin
export PHASE8_RAMP_MAX_VUS=100000
```

## Non-Goals

- Do not upload real huge files from k6. Object transfer scale belongs to CDN/object-store load tooling and provider metrics.
- Do not run real conversion or AI inference in request handlers.
- Do not bypass RBAC/context headers to inflate synthetic throughput.
- Do not treat local compose as proof of production HA.

## Exit Report

Every load-test report must include:

- Git SHA and deployment image digests.
- Environment and topology.
- k6 script, parameters, and scenario weights.
- SLO pass/fail table.
- API error breakdown by route and status code.
- PgBouncer and PostgreSQL connection/CPU graphs.
- Queue lag and worker throughput.
- Object-store success and latency.
- Realtime room/fanout metrics.
- Isolation and guard scan results.
