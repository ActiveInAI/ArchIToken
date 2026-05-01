# Phase 8 100k Concurrency Architecture

Date: 2026-05-01

This document defines the target scale architecture for first-day stable operation at 100,000 concurrent online sessions. The architecture splits traffic by workload instead of forcing every byte and every heavy operation through the Rust API core.

## Explicit 100k Model

| Workload | First-day baseline |
| --- | --- |
| Online sessions | 100,000 concurrent online sessions. |
| Active authenticated API users | 30,000 users issuing metadata/control-plane calls. |
| Simultaneous viewer users | 10,000 viewer sessions. |
| Heavy viewers | 2,000 active BIM/CAD/GIS/PDF viewers using prepared manifests, tiles, pages, or streamed scene data. |
| Realtime rooms | 1,000 collaboration rooms with presence, viewer commands, annotations, and runtime notifications. |
| Queued jobs | 500 concurrent queued or running conversion / AI jobs. |

The core rule is simple: API pods own metadata, context, authorization, audit, and enqueue decisions. They do not proxy large files and they do not synchronously run conversion or AI inference.

## Traffic Split

| Traffic class | Expected load shape | Primary path | State owner |
| --- | --- | --- | --- |
| API metadata | Many small requests for assets, jobs, registries, permissions, audit, search setup, and runtime control. | CDN/edge for static app, Envoy/Ingress, Axum pods, PgBouncer, PostgreSQL HA/read replicas. | PostgreSQL/PostGIS. |
| Object transfer | Large upload/download for IFC, CAD, PDF, media, point clouds, tiles, manifests, and worker output. | Presigned SeaweedFS S3 URLs behind CDN/object gateway. | SeaweedFS S3 for bytes; PostgreSQL stores bindings. |
| Viewer tiles | High fanout static/semi-static GLB, 3D Tiles, point-cloud tiles, panorama media, thumbnails, PDF page assets. | CDN, SeaweedFS S3, tile manifests, cache headers, viewer command metadata through API. | SeaweedFS S3 for bytes; PostgreSQL for manifests/bindings; CDN cache for delivery. |
| Realtime collaboration | Long-lived presence, annotations, viewer commands, cursor/camera sync, runtime notifications. | WebSocket first through Envoy/Ingress to realtime Axum/NATS bridge; WebTransport feature-gated. | NATS JetStream for durable event streams; Valkey for presence/ephemeral state; PostgreSQL for committed records. |
| Conversion workers | Burst and long-running jobs for openBIM, CAD, GIS, documents, media, point clouds, AI-adjacent work. | Temporal workflows, KEDA-scaled worker pools, SeaweedFS S3 inputs/outputs, NATS notifications. | Temporal for workflow state; PostgreSQL for job records/audit; SeaweedFS S3 for files. |
| AI inference | Bursty provider calls, embedding generation, retrieval, planning, approval-gated actions. | Rust provider registry, worker/provider adapters, Langfuse/OpenTelemetry, Meilisearch, Qdrant, PostgreSQL. | PostgreSQL for canonical state/audit; Qdrant/Meilisearch for derived indexes. |

## Scale Architecture

```text
Users / Agents / Viewers
  |
  | HTTPS, WebSocket, feature-gated WebTransport
  v
CDN / WAF / Edge cache
  |
  v
Envoy or cloud ingress
  |
  +--> Axum API pods
  |      |
  |      +--> PgBouncer --> PostgreSQL 16 HA primary + read replicas
  |      +--> SeaweedFS S3 presign/object binding
  |      +--> Meilisearch lexical index
  |      +--> Qdrant vector index
  |      +--> Valkey cache/rate-limit/session/presence
  |      +--> NATS JetStream event bus
  |      +--> Temporal workflow frontend
  |
  +--> Realtime gateway pods
         |
         +--> NATS JetStream streams
         +--> Valkey presence/ephemeral state

KEDA-scaled Temporal workers
  |
  +--> openBIM / CAD / GIS / document / media / AI worker pools
  +--> SeaweedFS S3 inputs and outputs
  +--> PostgreSQL job/audit updates through API or store boundary

Observability
  |
  +--> OpenTelemetry collector
  +--> Prometheus metrics
  +--> Loki logs
  +--> Tempo traces
  +--> Grafana dashboards
  +--> Langfuse for AI traces
```

## Component Roles

| Component | Scale role |
| --- | --- |
| CDN/WAF | Serves static frontend, viewer tiles, media, thumbnails, public cacheable manifests, WAF rules, and origin shielding. |
| Envoy/Ingress | TLS termination, routing, WebSocket upgrade, optional QUIC/WebTransport track, request limits, retries, and trace propagation. |
| Axum pods | Stateless API control plane. Scale horizontally; do not proxy large object bytes through API pods. |
| PgBouncer | Connection pooling to protect PostgreSQL from 100k-session connection storms. |
| PostgreSQL HA/read replicas | Source of truth for tenants, projects, assets, jobs, registry, audit, and object bindings. Read replicas handle read-heavy metadata traffic. |
| SeaweedFS S3 cluster | Binary object storage for source files, converted artifacts, tiles, manifests, point clouds, media, and worker outputs. |
| Meilisearch | Fast lexical and faceted search. Rebuildable from PostgreSQL and object-derived document text. |
| Qdrant | Production vector scale tier for semantic retrieval. Rebuildable from PostgreSQL assets and embedding jobs. |
| NATS JetStream | Realtime events, collaboration fanout, durable replay streams, worker notifications, and viewer command propagation. |
| Temporal | Durable workflow orchestration, retries, cancellation, schedules, and worker fleet control. |
| KEDA | Scales workers from queue/workflow/event pressure instead of overprovisioning. |
| Valkey | Cache, rate limits, sessions, presence, ephemeral locks, and short-lived collaboration state. |
| Workers | Isolated openBIM/CAD/GIS/document/media/AI execution. Workers do not own auth, tenant isolation, or canonical state. |
| Observability | OpenTelemetry, Prometheus, Grafana, Loki, Tempo, and Langfuse correlate request ids, tenant/project context, workflow ids, event ids, and AI traces. |

## 100k Design Rules

- API pods handle metadata/control plane only; large bytes flow through CDN/S3.
- Every long-running or heavy operation becomes a Temporal workflow or worker job.
- Realtime traffic goes through WebSocket first and NATS JetStream fanout, not polling.
- Valkey stores ephemeral state only; it must not become source of truth.
- Qdrant and Meilisearch are derived indexes; rebuild procedures are mandatory.
- PostgreSQL writes must be protected by PgBouncer, queueing, idempotency, and backpressure.
- Viewer tile delivery must be cache-first with immutable object keys where possible.
- WebTransport is optional and feature-gated; it must not replace HTTP/S3 object transfer.
- Tenant/project identifiers must be present in database predicates, cache keys, event subjects, search filters, vector payload filters, object keys, and audit payloads.

## Acceptance Gates

| Gate | Required proof |
| --- | --- |
| Metadata API scale | Axum pods remain stateless; PgBouncer is configured; read-heavy routes can use replicas later. |
| Object transfer split | Upload/download flows use presign/object binding; API pods do not stream large files. |
| Realtime contract | WebSocket smoke covers connect, tenant/project context, publish, receive, ack, and audit/event correlation. |
| Event durability | NATS JetStream stream names, subject conventions, retention, replay, and tenant scoping are documented and tested. |
| Cache safety | Valkey keys are namespaced by tenant/project; cache misses fall back to source of truth. |
| Vector safety | Qdrant payload filters include tenant/project; rebuild from canonical records is documented. |
| Workflow safety | Temporal workflows are idempotent and emit audit/status transitions. |
| Binary protocol safety | FlatBuffers schemas are versioned and compatibility-tested. |
| Connection safety | PostgreSQL connection saturation remains below 80%; PgBouncer and API pool sizes are load-tested. |
| Backpressure safety | Heavy operations degrade to queue/backpressure responses instead of hard API failures. |
| Security/license | Proprietary guard list is checked before merge. |

## Real Certification Process

The architecture is designed for 100,000 concurrent online sessions, but it is not certified until external load evidence passes `tools/k6/load-evidence.schema.json` and `04-backend/scripts/validate-phase8-load-evidence.sh`.

The certification sequence is:

1. `04-backend/scripts/smoke-phase8-production-readiness.sh`.
2. `04-backend/scripts/certify-phase8-100k.sh smoke`.
3. `04-backend/scripts/certify-phase8-100k.sh 1k`.
4. `04-backend/scripts/certify-phase8-100k.sh 10k`.
5. `04-backend/scripts/certify-phase8-100k.sh 25k`.
6. `04-backend/scripts/certify-phase8-100k.sh 50k`.
7. External/distributed `ARCHITOKEN_LOAD_PROFILE=100k` execution.
8. Evidence validation with `ARCHITOKEN_LOAD_EVIDENCE=/path/to/evidence.json 04-backend/scripts/certify-phase8-100k.sh 100k`.
9. Go/no-go decision.
10. Rollback decision if any hard gate fails.

If realtime endpoints are not deployed, realtime certification is `blocked`; HTTP fallback may exercise API paths but cannot certify collaboration stability.

## Smoke-Test Plan

- `04-backend/scripts/smoke-phase8-scale.sh`: health, runtime capabilities, asset metadata, presign, complete upload, conversion enqueue, viewer command enqueue/list, runtime execution list, and realtime placeholder.
- `04-backend/scripts/load-phase8-100k.sh`: k6 smoke, 1k, 10k, 25k, 50k, and 100k profile wrapper with environment-controlled targets.
- `04-backend/scripts/certify-phase8-100k.sh`: certification orchestrator that fails non-zero on missing evidence, missing k6 for certification, or failed gates.
- `04-backend/scripts/validate-phase8-load-evidence.sh`: strict evidence validator for certified/not-certified/blocked status.
- `04-backend/scripts/smoke-phase8-realtime-readiness.sh`: realtime readiness gate; blocks certification if no WebSocket/WebTransport endpoint is available.
- `tools/k6/phase8_100k_smoke.js`: low-volume scenario coverage for the complete traffic split.
- `tools/k6/phase8_100k_ramp.js`: staged load profile for anonymous browser, authenticated API, viewer manifest, object presign, conversion enqueue, and realtime presence.
- Existing Phase 6/7 smoke remains required for RBAC, tenant/project isolation, registry, artifact, viewer-command, generation, asset, and conversion contracts.

## Proprietary Guard List

The default core must not import or package proprietary RealBIMWeb.wasm, assets.bin, assets1.bin, BlackHole3D, OptRapid3dLoader, proprietary DWG SDK, or proprietary EXE/SDK/loader assets. DWG remains a legal adapter boundary only.
