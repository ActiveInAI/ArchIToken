# Phase 8.1 Real 100k Load Certification

Date: 2026-05-01

This document defines the evidence-based certification process for ArchIToken first-day 100,000 concurrent online sessions. It is not a planning claim: the platform is **not certified** until a real external k6/cloud/distributed load run produces validated evidence that passes the gates below.

## Certification Target

| Gate | Required evidence |
| --- | --- |
| Connected users | Target is 100,000 concurrent connected users; achieved concurrency must be at least 100,000. |
| API p95 latency | Metadata/control-plane API p95 must be below 300 ms. |
| API p99 latency | Metadata/control-plane API p99 must be below 800 ms. |
| Error rate | `http_req_failed` must be below 0.1%. |
| Realtime stability | WebSocket first; WebTransport remains feature-gated. Stability must be at least 99.9% connected minus dropped connections over connected sessions. If no realtime endpoint exists, status is blocked. |
| Readiness stability | `/readyz` must stay healthy and include runtime profile, database mode, object-store mode, rate-limit state, request body limit, tenant context policy, and build/git SHA. |
| Rate-limit behavior | Excess traffic must return structured 429 responses instead of unbounded queueing or gateway crashes. |
| Object store | Presign, complete-upload, and download smoke must pass; API pods must not proxy large files. |
| Core dependencies | PostgreSQL/PgBouncer, SeaweedFS S3, NATS JetStream, Qdrant, Valkey, Temporal, and telemetry endpoints must be configured and observable. |
| Rollback | Rollback criteria and responsible owners must be set before the 100k run. |

## Status Model

| Status | Meaning |
| --- | --- |
| `certified` | A real external load run reached target concurrency, passed all thresholds, and produced complete evidence validated by `04-backend/scripts/validate-phase8-load-evidence.sh`. |
| `not_certified` | Evidence exists but missed one or more gates. The release cannot claim 100k readiness. |
| `blocked` | Required evidence, tooling, realtime endpoint, dependency health, or deployment topology is missing. The release cannot claim 100k readiness. |

## Evidence Contract

Evidence must conform to `tools/k6/load-evidence.schema.json` and be validated by:

```bash
ARCHITOKEN_TARGET_CONCURRENCY=100000 \
  04-backend/scripts/validate-phase8-load-evidence.sh /path/to/load-evidence.json
```

The required JSON fields are:

- `run_id`, `git_sha`, `environment`, `start_time`, `end_time`, `duration`.
- `target_concurrency`, `achieved_concurrency`, `checks_passed`, `verdict`.
- `thresholds`, `p50`, `p95`, `p99`, `http_req_failed`.
- `ws_connected`, `dropped_connections`, `gateway_restarts`.
- `db_pool_saturation`, `object_store_errors`, `nats_lag`, `qdrant_consistency`.

The validator rejects incomplete evidence, failed evidence, mismatched target concurrency, missing realtime evidence, failed Qdrant consistency, excessive gateway restarts, excessive database saturation, object-store errors, and NATS lag above threshold.

## Certification Sequence

1. Run production-readiness smoke: `04-backend/scripts/smoke-phase8-production-readiness.sh`.
2. Run realtime readiness smoke: `04-backend/scripts/smoke-phase8-realtime-readiness.sh`.
3. Run k6 smoke: `04-backend/scripts/certify-phase8-100k.sh smoke`.
4. Run 1k profile: `04-backend/scripts/certify-phase8-100k.sh 1k`.
5. Run 10k profile: `04-backend/scripts/certify-phase8-100k.sh 10k`.
6. Run 25k profile: `04-backend/scripts/certify-phase8-100k.sh 25k`.
7. Run 50k profile: `04-backend/scripts/certify-phase8-100k.sh 50k`.
8. Run 100k through external/distributed k6 or cloud load infrastructure.
9. Validate evidence: `ARCHITOKEN_LOAD_EVIDENCE=/path/to/evidence.json 04-backend/scripts/certify-phase8-100k.sh 100k`.
10. Make a go/no-go decision.
11. Execute rollback if any hard gate fails or if evidence is blocked.

Local development machines must not be used to claim 100k certification. The 100k runner defaults to external evidence validation and blocks local execution unless `ARCHITOKEN_ALLOW_LOCAL_100K=1` is explicitly set for dedicated load workers.

## Rollback Criteria

- Any confirmed cross-tenant or cross-project leakage.
- Any data loss in job enqueue, object binding, audit append, realtime event replay, or workflow state.
- API 5xx at or above 0.1%.
- API p95 or p99 above certification thresholds after mitigation.
- PostgreSQL connection saturation above 80% or primary CPU above 65% sustained.
- Gateway restarts during the certification window.
- Object-store errors above the configured threshold.
- NATS lag unbounded or unobservable.
- Qdrant consistency check fails.
- Realtime endpoint unavailable when realtime certification is required.

## Proprietary Boundary

The certification path must not import proprietary RealBIMWeb.wasm, assets.bin, assets1.bin, BlackHole3D, OptRapid3dLoader, proprietary DWG SDK, or proprietary EXE/SDK/loader assets into the default core. Proprietary engines remain legal adapter boundaries only and cannot be part of the open-source runtime certification path.
