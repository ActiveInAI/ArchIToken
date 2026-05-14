# Phase 8 Codex Execution Plan

Date: 2026-05-01

This plan turns the Phase 8 stack decision into a safe PR train. It is staged so each PR is reviewable, testable, and reversible while keeping the first-day 100k concurrent-session target visible.

## Baseline

- PR #19 merged Phase 7 Open AEC Universal Runtime.
- Rust/Axum/Tokio remains the public API core.
- Vite 8 + React 19 remains the main workbench.
- PostgreSQL/PostGIS/pgvector/PGMQ remains the system of record.
- SeaweedFS S3 remains object storage.
- Temporal remains workflow orchestration.
- Meilisearch remains lexical search.
- Phase 8 adds Qdrant, NATS JetStream, Valkey, WebSocket-first realtime, feature-gated WebTransport, FlatBuffers protocol contracts, PgBouncer, KEDA, observability, and k6 load testing.

## Non-Negotiable Production Rules

- Design for 100,000 concurrent online sessions, 30,000 authenticated active API users, 10,000 simultaneous viewer users, 2,000 heavy viewers, 1,000 realtime rooms, and 500 queued conversion / AI jobs.
- Do not proxy large files through API pods.
- Do not run conversion or AI inference synchronously in API handlers.
- Do not weaken `RuntimeContext`, RBAC, tenant/project isolation, audit, or production profile strictness.
- Do not make derived tiers the canonical owner: Qdrant, Meilisearch, Valkey, and NATS JetStream must be rebuildable or replayable from authoritative records/events.
- Do not replace PostgreSQL/PostGIS as source of truth.
- Do not make WebTransport mandatory; keep WebSocket first.
- Do not use Bincode as a public cross-language protocol.
- Do not replace the Vite/React workbench with research UI frameworks.
- Keep closed-source viewer and DWG-adjacent implementation assets out of the default core; the detailed guard list lives in the Phase 8 stack, architecture, and go-live docs.

## PR Train

| PR | Scope | Acceptance |
| --- | --- | --- |
| PR-20 | Phase 8 docs, tech radar seed update, compose/K8s/load-test baseline. | Docs define 100k launch target, SLOs, accepted/rejected stack, deploy baseline, runbooks, k6 smoke/ramp, and guardrails. |
| PR-21 | Runtime capability flags for Qdrant, NATS JetStream, Valkey, WebSocket, WebTransport, FlatBuffers, and scale contracts. | OpenAPI valid, SDK generation passes, capability smoke asserts feature flags. |
| PR-22 | Realtime contract skeleton. | WebSocket endpoint or contract boundary preserves RuntimeContext, tenant/project isolation, RBAC, audit, and event ids. |
| PR-23 | NATS JetStream event bus boundary. | In-memory/dev adapter first; production adapter boundary documented; event replay tests pass. |
| PR-24 | Valkey cache/rate-limit/session boundary. | Namespaced key strategy, TTL policy, no source-of-truth state, tests for tenant isolation. |
| PR-25 | Qdrant vector tier boundary. | Derived index contract, tenant/project payload filters, rebuild path, no canonical ownership. |
| PR-26 | FlatBuffers protocol schema. | Versioned schema, JSON fallback, compatibility tests, no Rust-only public binary protocol. |
| PR-27 | PgBouncer and PostgreSQL HA deployment contract. | Connection budgets, pool sizes, read/write split plan, failover runbook, and p95 latency gates documented and smoke-tested. |
| PR-28 | Temporal worker scale contracts and KEDA worker autoscaling. | Idempotency, cancellation, retry metadata, worker output manifests, audit transitions, and queue-driven scaling. |
| PR-29 | Observability baseline. | OpenTelemetry collector, Prometheus, Grafana, Loki, Tempo, and Langfuse correlation IDs appear in smoke traces/logs. |
| PR-30 | Phase 8 smoke/load CI hardening. | `smoke-phase8-scale.sh`, k6 smoke/ramp scripts, and guard scans run without requiring proprietary assets or real large-file uploads. |

## Required Validation Pattern

For docs/config/scripts-only PRs:

```bash
rm -f 04-backend/openapitools.json
git diff --check
python3 tools/github_tech_radar.py --seed config/tech-radar.seed.yaml --out /tmp/tech-radar-phase8.md
python3 tools/github_tech_radar.py --strict --seed config/tech-radar.seed.yaml --out /tmp/tech-radar-phase8-strict.md
bash -n 04-backend/scripts/smoke-phase8-scale.sh
bash -n 04-backend/scripts/load-phase8-100k.sh
bash -n 04-backend/scripts/smoke-phase8-production-readiness.sh
```

For backend code changes:

```bash
cd 04-backend
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
cargo build --release --bin architoken-gateway
```

For OpenAPI changes:

```bash
cd 04-backend
npx --yes @redocly/cli lint openapi.yaml
npx --yes @openapitools/openapi-generator-cli generate -i openapi.yaml -g typescript-fetch -o /tmp/architoken-sdk-ts
rm -f openapitools.json
```

For worker changes:

```bash
cd 06-workers
python3 -m pytest tests
```

For frontend changes:

```bash
cd 03-frontend-vite
bun run lint
bun run typecheck
bun run test
bun run build
```

## Smoke And Load Plan

Phase 8 smoke extends, not replaces, existing Phase 6/7 smoke. The final smoke path must cover:

- Health/readiness/runtime capabilities.
- Metadata API and tenant isolation.
- Asset presign/object binding split.
- Realtime WebSocket contract and event ack.
- NATS event stream contract.
- Valkey cache/rate-limit/session key policy.
- Qdrant vector filter/rebuild contract.
- Meilisearch lexical search contract.
- Temporal worker lifecycle.
- FlatBuffers schema compatibility.

Production stack verification must run tech radar in strict mode. `fetch_failed:*` rows are acceptable only for exploratory, non-strict research output; they are not accepted for production stack approval.

k6 load tests must keep traffic groups separate:

- `anonymous_browser`: static app and public cache paths.
- `authenticated_api`: health, capabilities, metadata list, and writes.
- `viewer_manifest`: manifest and lightweight viewer metadata paths.
- `object_presign`: presign and complete-upload control-plane calls without huge object upload.
- `conversion_enqueue`: worker enqueue path, not synchronous conversion.
- `realtime_presence`: handshake placeholder and future WebSocket presence flow.

## SLO Exit Criteria

- API 5xx below 0.1%.
- Read p95 below 300 ms and write p95 below 800 ms under target traffic mix.
- Viewer manifest p95 below 1.5 s and cached first visible frame p95 below 5 s.
- Object transfer and job enqueue success above 99.9%.
- PostgreSQL connection saturation below 80% and primary CPU below 65% sustained.
- Queue lag observable, bounded, and alerting-backed.
- Heavy operation pressure returns queue/backpressure decisions, not hard handler failures.
