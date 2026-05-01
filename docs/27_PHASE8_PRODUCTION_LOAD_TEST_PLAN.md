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
| `04-backend/scripts/load-phase8-100k.sh` | k6 wrapper for smoke, 1k, 10k, 25k, 50k, and 100k profiles. |
| `04-backend/scripts/certify-phase8-100k.sh` | Certification orchestrator that rejects missing k6 for certification and validates final evidence. |
| `04-backend/scripts/validate-phase8-load-evidence.sh` | Strict evidence validator for certified/not-certified/blocked verdicts. |
| `04-backend/scripts/smoke-phase8-realtime-readiness.sh` | Realtime endpoint readiness smoke for WebSocket/WebTransport certification. |
| `04-backend/scripts/smoke-phase8-production-readiness.sh` | CI-friendly validation for strict tech radar, compose, K8s, k6 syntax when available, and proprietary runtime guard. |
| `tools/k6/load-evidence.schema.json` | Required JSON evidence shape for certification. |

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
- API p99 below 800 ms for certification evidence.
- Viewer manifest p95 below 1.5 s.
- Presign and enqueue success above 99.9%.
- p99 must be tracked even where the hard SLO is p95.
- WebSocket/WebTransport stability at or above 99.9% for realtime certification.

## Execution Sequence

1. Run backend smoke for health, runtime capabilities, asset metadata, object presign/complete, conversion enqueue, viewer command, runtime execution list, and realtime placeholder.
2. Run k6 smoke against staging with production-like ingress, object-store endpoint, and database pool settings.
3. Run 1k profile.
4. Run 10k profile.
5. Run 25k profile.
6. Run 50k profile.
7. Run the 100k profile through external/distributed k6 or cloud load infrastructure.
8. Validate the evidence JSON.
9. Make a go/no-go decision.
10. Execute rollback if any hard gate fails.

## Commands

```bash
04-backend/scripts/smoke-phase8-scale.sh
04-backend/scripts/smoke-phase8-production-readiness.sh
04-backend/scripts/load-phase8-100k.sh smoke
04-backend/scripts/load-phase8-100k.sh 1k
04-backend/scripts/load-phase8-100k.sh 10k
04-backend/scripts/load-phase8-100k.sh 25k
04-backend/scripts/load-phase8-100k.sh 50k
```

Final 100k certification requires evidence:

```bash
export ARCHITOKEN_LOAD_PROFILE=100k
export ARCHITOKEN_LOAD_EVIDENCE=/path/to/phase8-100k-evidence.json
04-backend/scripts/certify-phase8-100k.sh 100k
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
export ARCHITOKEN_LOAD_PROFILE=10k
```

## Non-Goals

- Do not upload real huge files from k6. Object transfer scale belongs to CDN/object-store load tooling and provider metrics.
- Do not run real conversion or AI inference in request handlers.
- Do not bypass RBAC/context headers to inflate synthetic throughput.
- Do not treat local compose as proof of production HA.
- Do not treat HTTP fallback as realtime certification.
- Do not claim 100k certification without validated evidence.

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
- Evidence validator verdict and raw `tools/k6/load-evidence.schema.json` payload.
