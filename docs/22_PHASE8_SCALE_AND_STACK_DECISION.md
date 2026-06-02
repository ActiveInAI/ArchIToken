# Phase 8 Scale And Stack Decision

Date: 2026-05-01

This document records the Phase 8 scale and stack decision after the Phase 7 Open AEC Universal Runtime merge in PR #19. It upgrades the docs-only Phase 8 branch into a first-day production-readiness baseline without replacing the Phase 6/7 guardrails: `RuntimeContext`, RBAC, tenant/project isolation, audit, OpenAPI contracts, smoke tests, license/security checks, and production profile strict behavior remain mandatory.

## First-Day Launch Definition

Phase 8 defines "100k concurrency" as the following launch target, not as a vague marketing number:

| Dimension | Required baseline |
| --- | --- |
| Concurrent online sessions | 100,000 concurrent browser, agent, and viewer sessions. |
| Authenticated active API users | 30,000 active authenticated users issuing metadata/control-plane calls. |
| Simultaneous viewer users | 10,000 users with viewer surfaces open. |
| Heavy active viewers | 2,000 concurrent BIM/CAD/GIS/PDF heavy viewers. |
| Realtime collaboration rooms | 1,000 concurrent rooms with presence and command fanout. |
| Queued conversion / AI jobs | 500 concurrently queued or running worker jobs. |
| Large file path | No direct large-file proxy through API pods. |
| Heavy compute path | No direct synchronous conversion or AI inference from API request handlers. |
| Data safety | No data loss across job enqueue, audit append, object binding, or workflow transition. |
| Isolation safety | No cross-tenant or cross-project leakage in API, cache, events, search, vector, or object paths. |

## Production SLO Gates

| SLO | Phase 8 gate |
| --- | --- |
| API 5xx rate | Less than 0.1%. |
| API read latency | p95 below 300 ms for cacheable/simple metadata reads. |
| API write latency | p95 below 800 ms for metadata writes and enqueue operations. |
| Viewer manifest latency | p95 below 1.5 s. |
| Cached model first visible frame | p95 below 5 s for cached assets and prepared tiles/manifests. |
| Object transfer success | Upload/download success above 99.9%. |
| Job enqueue success | Above 99.9%. |
| PostgreSQL connection saturation | Below 80%. |
| PostgreSQL primary CPU | Below 65% sustained. |
| Queue lag | Observable, bounded, alerting-backed. |
| Heavy operation degradation | Queue/backpressure instead of synchronous API failure. |

## Accepted Production Stack

| Area | Phase 8 decision | Role |
| --- | --- | --- |
| Public API core | Rust, Axum, Tokio | External API, auth/context adapter, OpenAPI, audit, tenancy, RBAC, and orchestration control plane. |
| Main frontend workbench | Vite 8, React 19, TypeScript, TanStack Router, TanStack Query, Zustand, Tailwind CSS, Radix UI | Primary web workbench for assets, runtime, AI, openBIM, CAD, GIS, documents, gantt, flow, and admin surfaces. |
| Viewer stack | Three.js WebGPU, React Three Fiber, 3d-tiles-renderer, CesiumJS, MapLibre GL JS | BIM/CAD/GIS/reality viewer composition, 3D Tiles, map layers, point clouds, panorama bridges, and WebGPU-first rendering where supported. |
| System of record | PostgreSQL 16 HA, PostGIS, pgvector, PGMQ | Durable tenant/project metadata, assets, jobs, audit, spatial records, transactional vector adjacency, and queue adapter. |
| Connection pooling | PgBouncer | Protect PostgreSQL from connection storms and keep primary connection saturation below the SLO gate. |
| ORM and migration | SeaORM, SeaORM Migrator | Rust-owned schema and migration adapter. |
| Object storage | SeaweedFS S3 cluster | Asset binaries, tiles, point clouds, media, document outputs, worker manifests, and large immutable artifacts. |
| Edge/object delivery | CDN/WAF | Static frontend, object/tile delivery, WAF rules, edge caching, and origin shielding. |
| Workflow engine | Temporal | Long-running conversion, indexing, import/export, AI-adjacent orchestration, retry, cancellation, and saga boundaries. |
| Worker autoscaling | KEDA | Queue/workflow-driven worker scale-out for conversion, indexing, and AI-adjacent workloads. |
| Lexical search | Meilisearch | Fast lexical and faceted search over assets, documents, metadata, and registry records. |
| Production vector scale tier | Qdrant | High-scale vector retrieval tier for embeddings and semantic search. It is not the system of record. |
| Realtime event bus | NATS JetStream | Collaboration, viewer command fanout, runtime event fanout, worker notifications, and durable replayable event streams. |
| Cache and ephemeral state | Valkey | Cache, rate limits, sessions, locks, presence, ephemeral collaboration state, and short-lived coordination. |
| Realtime transport | WebSocket first; WebTransport feature-gated | WebSocket is the default cross-browser realtime path. WebTransport is an opt-in performance track. |
| Binary realtime/viewer protocol | FlatBuffers | Cross-language binary protocol for viewer/realtime messages where JSON becomes too expensive. |
| Observability | OpenTelemetry, Prometheus, Grafana, Loki, Tempo, Langfuse | Metrics, logs, traces, request correlation, runtime audit correlation, and AI trace observability. |
| Load testing | k6 distributed load tests | Smoke, ramp, soak, spike, and first-day traffic split validation. |

## Not Primary Or Rejected Stack

| Candidate | Decision | Reason |
| --- | --- | --- |
| SurrealDB | Do not use as primary database. | It does not replace PostgreSQL/PostGIS for relational integrity, spatial maturity, HA operations, SQL ecosystem, backups, migrations, and system-of-record auditability. |
| Dioxus / Leptos | Native/WASM research only. | They can inform future native/WASM experiments but do not replace the Vite 8 + React 19 workbench. |
| Vello / Piet | 2D vector/editor research only. | Useful for editor research, not the primary BIM/CAD/PDF renderer path. |
| WGPU | Lower-level renderer track. | Keep as a graphics foundation candidate, but do not replace the main viewer with Bevy. |
| Bevy | Not the main viewer shell. | ECS/game-engine architecture is not the default web AEC workbench contract. |
| Bincode | Not a public cross-language protocol. | It is Rust-specific and version-sensitive; FlatBuffers is preferred for stable multi-language binary contracts. |
| Docx-rs / Lopdf | Not primary Office/PDF pipeline. | They can be helper libraries in isolated cases, but primary document processing remains worker/adapter based around PDFium, MuPDF, LibreOffice, OCR, MinerU, MarkItDown, and explicit contracts. |
| Proprietary RealBIMWeb.wasm, assets.bin, assets1.bin, BlackHole3D, OptRapid3dLoader, proprietary DWG SDK, proprietary EXE/SDK/loader | Prohibited from default core. | Closed assets and proprietary SDKs cannot enter the production core route. |

DXF/DWG source viewing runs through MLightCAD `@mlightcad/cad-simple-viewer`; DWG parsing carries the recorded `@mlightcad/libredwg-web` GPL-3.0 browser/WASM boundary. ArchIToken may define asset metadata, conversion job, audit, and viewer-command contracts for DWG-adjacent workflows, but the default runtime must not embed a proprietary DWG implementation. Licensed external adapters remain conversion/export/diagnostic routes.

## Why PostgreSQL/PostGIS Remains The System Of Record

PostgreSQL remains the durable source of truth because ArchIToken needs transactional metadata, tenant/project isolation, audit records, workflow/job state, RBAC-visible registry records, foreign keys, migrations, backups, read replicas, and mature operational tooling. PostGIS is the mature spatial system for geometry indexes, projections, spatial predicates, and GIS metadata. pgvector and PGMQ provide in-database vector and queue boundaries for the control plane.

SurrealDB can be watched for future experiments, but it does not replace PostgreSQL/PostGIS for the production system-of-record role. Phase 8 optimizes scale by adding specialized tiers around PostgreSQL rather than replacing it.

## Why Qdrant Is Added

Qdrant is added as a production vector scale tier because high-volume semantic retrieval needs independent vector indexing, payload filtering, shard/replica scaling, and operational isolation from OLTP writes. PostgreSQL plus pgvector remains useful for transactional vector adjacency and small/medium workloads, but Qdrant becomes the scale-out retrieval tier.

Qdrant does not own canonical asset metadata, tenant records, audit records, job state, or object bindings. PostgreSQL remains the authority; Qdrant indexes derived vectors and can be rebuilt.

## Why Dioxus And Leptos Do Not Replace Vite/React

Vite 8 + React 19 stays the main workbench because Phase 7 already established the React shell, TanStack routing/query patterns, Zustand state, Radix interaction components, and integration path for React Three Fiber, CesiumJS, MapLibre GL JS, and 3D Tiles. Replacing this shell would add migration risk without improving the immediate 100k-concurrency bottlenecks.

Dioxus and Leptos remain research tracks for native/WASM and high-performance UI experiments. They must not fragment the primary frontend contract until there is a measured reason, a migration plan, and compatibility with the viewer/runtime integrations.

## Why WebTransport Is Feature-Gated

WebSocket is the default realtime transport because it is widely supported, easier to operate through ingress, and sufficient for collaboration events, viewer command fanout, presence, and runtime notifications.

WebTransport is feature-gated because browser, proxy, QUIC, observability, load balancing, and enterprise network support still need controlled rollout. It is not a replacement for S3, CDN, HTTP downloads, or tile/object transfer. Large files, tiles, media, point clouds, and worker outputs continue to move through SeaweedFS S3 and CDN-backed HTTP paths.

## Realtime And Binary Protocol Decision

JSON remains the default API contract through OpenAPI. FlatBuffers is introduced only for binary realtime/viewer messages where message volume, latency, or payload size requires it. FlatBuffers schemas must be versioned, cross-language, and backward-compatible before production use.

Bincode is explicitly not the public protocol because it is Rust-centric and not a stable cross-language contract.

## Acceptance Gates

- No change may bypass `RuntimeContext`, RBAC, tenant/project isolation, or audit.
- PostgreSQL/PostGIS remains the authoritative system of record.
- Qdrant, Meilisearch, Valkey, and NATS JetStream indexes/state must be rebuildable or replayable from authoritative data/events.
- SeaweedFS S3 remains the binary object adapter; WebTransport must not become file/object transfer infrastructure.
- WebTransport must be feature-gated behind config and runtime capability discovery.
- FlatBuffers protocol changes require schema versioning and compatibility tests.
- No proprietary guard-list item may enter the default core route.
- Smoke tests must cover health, capabilities, assets, conversion jobs, realtime event contract, worker contract, vector/search indexing contract, cache/rate-limit contract, and tenant isolation.
- k6 smoke/ramp tests must exercise anonymous browser, authenticated API, viewer manifest, object presign, conversion enqueue, and realtime presence traffic groups.

## Production Stack Verification

`tools/github_tech_radar.py --strict` is required for production stack approval. In strict mode, any `fetch_failed:*` row is a failed verification, even when non-strict best-effort mode can still generate a Markdown table for research use. A Phase 8 production approval must use a GitHub token or authenticated `gh` CLI session when public unauthenticated API limits would otherwise hide repository metadata.
