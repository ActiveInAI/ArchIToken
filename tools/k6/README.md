# Phase 8 k6 Load Tests

These scripts model the first-day 100k concurrent-session traffic split without uploading huge files or running synchronous conversion/AI work through API handlers.

## Scripts

- `phase8_100k_smoke.js`: low-volume functional traffic split smoke.
- `phase8_100k_ramp.js`: staged profile for smoke, 1k, 10k, 25k, 50k, and 100k production-like load validation.
- `load-evidence.schema.json`: JSON evidence contract required for 100k certification.
- `04-backend/scripts/load-phase8-100k.sh smoke`: smoke target wrapper.
- `04-backend/scripts/load-phase8-100k.sh 1k`: 1k profile wrapper.
- `04-backend/scripts/load-phase8-100k.sh 10k`: 10k profile wrapper.
- `04-backend/scripts/load-phase8-100k.sh 25k`: 25k profile wrapper.
- `04-backend/scripts/load-phase8-100k.sh 50k`: 50k profile wrapper.
- `04-backend/scripts/certify-phase8-100k.sh 100k`: validates external 100k evidence.
- `04-backend/scripts/phase8-run-smoke.sh` through `phase8-run-100k.sh`: Phase 8.2 execution wrappers that emit k6 summary and stage metadata.
- `04-backend/scripts/phase8-certify-from-evidence.sh`: merges or validates final Phase 8.2 evidence.
- `tools/phase8_collect_prometheus_snapshot.py`: collects Prometheus metrics for gateway, realtime, db, object store, NATS, Qdrant, and Valkey.
- `tools/phase8_merge_load_evidence.py`: merges k6 summaries, Prometheus, live K8s state, and immutable build metadata.
- `tools/phase8_validate_runtime_cluster.py`: validates live Kubernetes state with `kubectl`; YAML validation alone is not certification evidence.

## Environment

```bash
export ARCHITOKEN_API_BASE_URL=http://localhost:8080
export ARCHITOKEN_FRONTEND_BASE_URL=http://localhost:5173
export ARCHITOKEN_WS_BASE_URL=ws://localhost:8082
export ARCHITOKEN_TENANT_ID=load-tenant
export ARCHITOKEN_PROJECT_ID=load-project
export ARCHITOKEN_ACTOR=load-runner
export ARCHITOKEN_ROLES=admin
export ARCHITOKEN_LOAD_PROFILE=10k
```

## Scenarios

- `anonymous_browser`: static app and health/capability paths.
- `authenticated_api`: metadata list/write paths.
- `viewer_manifest`: asset/viewer metadata paths.
- `object_presign`: presign and complete-upload control-plane path only.
- `conversion_enqueue`: enqueue worker jobs only.
- `realtime_presence`: WebSocket handshake placeholder.

## Profiles

| Profile | Target |
| --- | --- |
| `smoke` | Local or CI smoke; accepts low volume and validates route shape. |
| `1k` | First controlled staging ramp. |
| `10k` | First production-like API/object/control-plane ramp. |
| `25k` | Mid-ramp capacity gate. |
| `50k` | Pre-certification pressure gate. |
| `100k` | External/distributed load only; certification requires validated evidence. |

## Rules

- Do not upload real huge files from these scripts.
- Do not rely on synchronous conversion or AI inference.
- Keep tenant/project/actor context headers on authenticated calls.
- Use CDN/object-store tooling separately for large object transfer throughput.
- Do not claim realtime certification when only the HTTP fallback path was exercised.
- Do not claim 100k certification without evidence accepted by `04-backend/scripts/validate-phase8-load-evidence.sh`.
- Do not use “already supports 100k concurrent online users” wording unless the final Phase 8.2 evidence JSON validates as `certified`.

## Gates

- `http_req_failed < 0.1%`.
- health/readiness p95 below 100 ms.
- metadata API p95 below 300 ms.
- write/enqueue/presign p95 below 800 ms.
- API p99 below 800 ms in the certification evidence.
- Realtime stability at or above 99.9% when realtime endpoint certification is required.
