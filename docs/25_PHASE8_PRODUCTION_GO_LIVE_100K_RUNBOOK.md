# Phase 8 Production Go-Live 100k Runbook

Date: 2026-05-01

This runbook defines the first-day go-live baseline for 100,000 concurrent online sessions. It is a production-readiness contract, not a certification claim. The release is certified only when real external load evidence validates successfully.

## Launch Preconditions

| Area | Gate |
| --- | --- |
| API | Rust/Axum/Tokio gateway is horizontally scalable and stateless for metadata/control-plane routes. |
| Context and auth | `RuntimeContext`, RBAC, tenant/project isolation, audit, and strict production profile behavior remain enforced. |
| Database | PostgreSQL 16 HA, read replicas, PgBouncer, backups, PITR, migrations, and connection budgets are configured. |
| Object storage | SeaweedFS S3 or managed S3-compatible equivalent is deployed as the large-file path; API pods do not proxy large files. |
| Workflow | Temporal is configured for conversion, indexing, and AI-adjacent workflows; API handlers enqueue only. |
| Realtime | WebSocket is the default realtime transport; WebTransport is feature-gated. |
| Events/cache | NATS JetStream and Valkey are deployed with tenant/project key/subject namespacing. |
| Search/vector | Meilisearch and Qdrant are derived indexes with rebuild procedures. |
| Workers | KEDA or equivalent autoscaling is configured from queue/workflow pressure. |
| Observability | OpenTelemetry, Prometheus, Grafana, Loki, Tempo, and Langfuse are connected with request/correlation IDs. |
| Load testing | k6 smoke, 1k, 10k, 25k, 50k, and external 100k tests have passed against a staging environment matching production topology. |
| Evidence | `tools/k6/load-evidence.schema.json` evidence exists and passes `04-backend/scripts/validate-phase8-load-evidence.sh`. |
| Security/license | Proprietary RealBIMWeb.wasm, assets.bin, assets1.bin, BlackHole3D, OptRapid3dLoader, proprietary DWG SDK, and proprietary EXE/SDK/loader assets are absent from the default core. |

## Go / No-Go Gates

- API 5xx rate is below 0.1% during ramp.
- API read p95 is below 300 ms.
- API write p95 is below 800 ms.
- Viewer manifest p95 is below 1.5 s.
- Cached model first visible frame p95 is below 5 s.
- Object upload/download success is above 99.9%.
- Job enqueue success is above 99.9%.
- PostgreSQL connection saturation is below 80%.
- PostgreSQL primary CPU is below 65% sustained.
- Queue lag is observable and bounded.
- Heavy operations degrade to queue/backpressure, not synchronous API failures.
- No cross-tenant or cross-project records appear in API, search, vector, event, cache, or object paths.

## Traffic Ramp

| Stage | Target | Exit condition |
| --- | --- | --- |
| T-7 days | Functional smoke and k6 smoke. | No contract regressions. |
| T-6 days | 1k profile. | SLOs pass and evidence can be generated. |
| T-5 days | 10k profile. | SLOs pass for 60 minutes. |
| T-3 days | 25k profile. | SLOs pass for 2 hours; queue lag drains. |
| T-2 days | 50k profile. | SLOs pass for 4 hours; database headroom is stable. |
| T-1 day | 100k external/distributed profile. | Evidence validates as `certified`; on-call dashboards and rollback are verified. |
| Launch | Gradual production exposure. | No SLO breach, no isolation breach, no data loss. |

## Operational Checks

1. Confirm release build, image digest, migration version, and runtime capability flags.
2. Confirm PgBouncer pool configuration and PostgreSQL connection budgets.
3. Confirm object-store presign path and CDN cache behavior for manifests, tiles, media, and thumbnails.
4. Confirm Temporal namespaces, task queues, retry policies, and worker autoscaling.
5. Confirm NATS JetStream stream retention and tenant/project subject conventions.
6. Confirm Valkey key prefixes, TTLs, eviction policy, and rate-limit fail-closed/fail-open decisions.
7. Confirm Meilisearch and Qdrant indexes can be rebuilt from canonical records.
8. Confirm dashboards show request id, correlation id, tenant id, project id, actor, route, status, latency, workflow id, event id, and worker id.
9. Confirm proprietary guard scan is part of pre-merge and release checks.

## Backpressure Rules

- If API reads exceed p95, enable edge caching for safe manifests and reduce viewer metadata polling.
- If API writes exceed p95, reduce write bursts and shift writes to enqueue/idempotent workflow paths.
- If database connections approach 80%, lower API pool limits, tune PgBouncer, and shed non-critical writes.
- If database primary CPU exceeds 65% sustained, route eligible reads to replicas and pause non-critical indexing jobs.
- If object-store errors rise, stop issuing new heavy conversion jobs and keep metadata-only paths available.
- If queue lag grows, scale workers through KEDA and return clear queued/backpressure responses.
- If realtime fanout lags, reduce room-level broadcast frequency and preserve committed audit/event writes first.

## Rollback Criteria

- Any confirmed cross-tenant/project leakage.
- Any data-loss event in job enqueue, audit append, object binding, or workflow transition.
- API 5xx at or above 0.1% for two consecutive windows.
- Database primary CPU above 65% sustained after backpressure measures.
- PostgreSQL connection saturation above 80% after pool reduction.
- Queue lag unbounded or invisible.
- Realtime certification is blocked when realtime is a launch requirement.
- Load evidence is missing, incomplete, or validates as `not_certified` or `blocked`.

## Certification Commands

Run the gates in order:

```bash
04-backend/scripts/smoke-production-readiness-all.sh
04-backend/scripts/smoke-phase8-production-readiness.sh
04-backend/scripts/smoke-phase8-realtime-readiness.sh
04-backend/scripts/certify-phase8-100k.sh smoke
04-backend/scripts/certify-phase8-100k.sh 1k
04-backend/scripts/certify-phase8-100k.sh 10k
04-backend/scripts/certify-phase8-100k.sh 25k
04-backend/scripts/certify-phase8-100k.sh 50k
```

The final 100k run must be executed by external/distributed k6/cloud load infrastructure. After that run:

```bash
export ARCHITOKEN_LOAD_EVIDENCE=/path/to/phase8-100k-evidence.json
04-backend/scripts/certify-phase8-100k.sh 100k
```

If the evidence validator exits non-zero, the decision is no-go. The release must not claim 100k certification.

## Release Commands

```bash
rm -f 04-backend/openapitools.json
git diff --check
python3 tools/github_tech_radar.py --strict --seed config/tech-radar.seed.yaml --fallback-snapshot config/tech-radar.snapshot.json --max-snapshot-age-days 14 --out /tmp/tech-radar-phase8.md
bash -n 04-backend/scripts/smoke-phase8-scale.sh
bash -n 04-backend/scripts/load-phase8-100k.sh
bash -n 04-backend/scripts/certify-phase8-100k.sh
bash -n 04-backend/scripts/validate-phase8-load-evidence.sh
bash -n 04-backend/scripts/smoke-phase8-realtime-readiness.sh
```

Run functional and load validation from the environment-specific deployment pipeline:

```bash
04-backend/scripts/smoke-phase8-scale.sh
04-backend/scripts/load-phase8-100k.sh smoke
04-backend/scripts/load-phase8-100k.sh 1k
04-backend/scripts/load-phase8-100k.sh 10k
04-backend/scripts/load-phase8-100k.sh 25k
04-backend/scripts/load-phase8-100k.sh 50k
```
