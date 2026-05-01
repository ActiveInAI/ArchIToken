# Phase 8 k6 Load Tests

These scripts model the first-day 100k concurrent-session traffic split without uploading huge files or running synchronous conversion/AI work through API handlers.

## Scripts

- `phase8_100k_smoke.js`: low-volume functional traffic split smoke.
- `phase8_100k_ramp.js`: staged ramp profile for production-like load validation.

## Environment

```bash
export ARCHITOKEN_API_BASE_URL=http://localhost:8080
export ARCHITOKEN_FRONTEND_BASE_URL=http://localhost:5173
export ARCHITOKEN_WS_BASE_URL=ws://localhost:8082
export ARCHITOKEN_TENANT_ID=load-tenant
export ARCHITOKEN_PROJECT_ID=load-project
export ARCHITOKEN_ACTOR=load-runner
export ARCHITOKEN_ROLES=admin
export PHASE8_RAMP_MAX_VUS=100000
```

## Scenarios

- `anonymous_browser`: static app and health/capability paths.
- `authenticated_api`: metadata list/write paths.
- `viewer_manifest`: asset/viewer metadata paths.
- `object_presign`: presign and complete-upload control-plane path only.
- `conversion_enqueue`: enqueue worker jobs only.
- `realtime_presence`: WebSocket handshake placeholder.

## Rules

- Do not upload real huge files from these scripts.
- Do not rely on synchronous conversion or AI inference.
- Keep tenant/project/actor context headers on authenticated calls.
- Use CDN/object-store tooling separately for large object transfer throughput.
