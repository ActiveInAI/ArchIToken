# Phase 8.2 Bottleneck Fix Playbook

Date: 2026-05-01

This playbook maps failed load evidence to concrete bottleneck fixes. It is used after each smoke, 1k, 10k, 25k, 50k, and 100k stage.

## Triage Order

1. Confirm no cross-tenant/project leakage and no data loss.
2. Check API 5xx and 429 rates.
3. Check `/readyz` stability and gateway restarts.
4. Check PgBouncer saturation, PostgreSQL CPU, and slow query surfaces.
5. Check object-store presign/complete/download errors.
6. Check NATS lag and realtime dropped connections.
7. Check Qdrant consistency and vector query latency.
8. Check Valkey latency, eviction, and rate-limit key pressure.
9. Check worker queue depth, Temporal retries, and KEDA scaling.
10. Decide continue, pause, rollback, or patch.

## Bottleneck Matrix

| Symptom | Evidence source | Likely cause | Fix path |
| --- | --- | --- | --- |
| API p95 above 300 ms | k6 stage result and Prometheus gateway metrics. | DB contention, over-polling, insufficient API replicas, cache miss storm. | Add safe cache headers, reduce polling, scale Axum pods, tune PgBouncer, profile slow routes. |
| API p99 above 800 ms | k6 stage result. | Tail latency from DB locks, object-store calls in hot path, noisy workers. | Remove sync dependency from request path, add timeout/backpressure, move work to Temporal. |
| 5xx above 0.1% | k6 and gateway logs. | Crash loops, dependency timeout, exhausted pool. | Stop ramp, inspect pod restarts, raise resource limits, tune dependency timeouts. |
| 429 absent under overload | k6 and gateway metrics. | Rate-limit guard disabled or misconfigured. | Fix Phase 8 runtime config before continuing. |
| PgBouncer saturation above 80% | Prometheus db metrics. | Pool too small, query fanout, read replica not used. | Tune pool, cap API DB concurrency, route safe reads to replicas. |
| Object-store errors above 0 | Prometheus object-store metrics. | S3 gateway pressure, bucket policy, CDN/origin path failure. | Stop heavy job enqueue, validate presign, scale object gateway, inspect SeaweedFS. |
| NATS lag above threshold | Prometheus NATS metrics. | Realtime fanout overload, slow consumers, insufficient replicas. | Scale realtime consumers, reduce room broadcast frequency, tune JetStream retention. |
| Qdrant consistency false | Prometheus/Qdrant health. | Cluster not converged or vector writes lagging. | Stop certification, rebuild or resync derived vector index. |
| Valkey errors or evictions | Prometheus Valkey metrics. | Cache/session/rate-limit memory pressure. | Increase memory, shorten TTLs, shard keys, verify eviction policy. |
| Realtime dropped connections | k6 realtime and NATS metrics. | Gateway scale, ingress timeouts, NATS fanout lag. | Tune WebSocket ingress, scale realtime pods, reduce message frequency. |

## Patch Rules

- Do not patch by bypassing RuntimeContext, RBAC, tenant/project isolation, or audit.
- Do not proxy large files through API as a shortcut.
- Do not move conversion or AI inference back into request handlers.
- Do not add proprietary RealBIM, BlackHole, OptRapid, proprietary DWG SDK, or proprietary EXE/SDK/loader assets to the open-source core.
- Every bottleneck fix must be re-run from the last failed stage and recorded in a new evidence JSON.

## Stop Conditions

- Any isolation leak.
- Any data loss.
- Gateway restarts during 100k stage.
- Missing Prometheus, Grafana, or OpenTelemetry evidence.
- K8s live-state validation fails.
- Final evidence validator returns non-zero.
