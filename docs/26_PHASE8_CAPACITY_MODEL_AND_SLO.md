# Phase 8 Capacity Model And SLO

Date: 2026-05-01

This document turns the first-day 100k concurrency goal into capacity assumptions and measurable SLO gates.

## Capacity Model

| Dimension | Baseline |
| --- | --- |
| Online sessions | 100,000 concurrent sessions. |
| Authenticated active API users | 30,000 active users. |
| Simultaneous viewer users | 10,000 users. |
| Heavy viewers | 2,000 BIM/CAD/GIS/PDF heavy viewers. |
| Realtime rooms | 1,000 rooms. |
| Queued conversion / AI jobs | 500 concurrent queued or running jobs. |

## Traffic Budget

| Traffic group | API role | Non-API path |
| --- | --- | --- |
| Anonymous browser | Static app bootstrap, health probes, capability discovery. | CDN serves static assets. |
| Authenticated API | Metadata reads/writes, asset records, job enqueue, audit-visible operations. | None for large bytes. |
| Viewer manifest | Manifest lookup, permission checks, signed object references. | CDN/S3 serves tiles, model chunks, media, and pages. |
| Object presign | Create presign and complete-upload records only. | Client uploads/downloads via S3/CDN path. |
| Conversion enqueue | Enqueue/cancel/list workflow metadata. | Temporal workers process files outside the API request. |
| Realtime presence | Auth/context handshake and room routing. | WebSocket fanout through NATS JetStream and Valkey presence. |

## SLO Gates

| Metric | Gate | Primary telemetry |
| --- | --- | --- |
| API 5xx | Less than 0.1%. | Gateway route metrics and logs. |
| API read p95 | Less than 300 ms. | OpenTelemetry spans and Prometheus histograms. |
| API write p95 | Less than 800 ms. | OpenTelemetry spans and Prometheus histograms. |
| Viewer manifest p95 | Less than 1.5 s. | Gateway route histograms and k6 viewer scenario. |
| Cached first visible frame p95 | Less than 5 s. | Frontend RUM and k6 browser-adjacent timing when available. |
| Object success | Above 99.9%. | CDN/S3 metrics and presign/complete audit. |
| Job enqueue success | Above 99.9%. | Conversion enqueue route metrics and Temporal workflow creation metrics. |
| PostgreSQL connection saturation | Below 80%. | PgBouncer and PostgreSQL metrics. |
| PostgreSQL primary CPU | Below 65% sustained. | Database metrics. |
| Queue lag | Observable and bounded. | Temporal, NATS, PGMQ, and worker metrics. |

## Resource Headroom Rules

- API pods must remain stateless and scale horizontally from CPU, memory, request rate, and latency signals.
- PgBouncer pool sizes must be lower than PostgreSQL safe connection limits, not equal to pod count multiplied by max pool size.
- PostgreSQL read replicas must absorb eligible read-heavy metadata traffic before the primary crosses sustained CPU gates.
- SeaweedFS S3 and CDN carry large object traffic; gateway pod egress should not scale with large file size.
- KEDA scales worker pools from queue/workflow pressure and must not scale workers beyond database/object-store safe write rates.
- Valkey memory must be sized for ephemeral state only; no canonical data may require Valkey for recovery.
- NATS JetStream retention must be sized for replay and outage windows, not infinite history.
- Qdrant and Meilisearch must be rebuildable from PostgreSQL and object-derived worker outputs.

## Backpressure Contract

Heavy operations must degrade predictably:

- New conversion or AI jobs return queue/backpressure responses when worker capacity is saturated.
- Presign/create metadata calls remain available while large object transfer happens outside API pods.
- Viewer manifests should return cached or prepared data, not trigger synchronous conversion.
- Realtime rooms may reduce broadcast frequency under pressure but must not lose committed audit/event records.
- Derived indexing may lag, but canonical PostgreSQL records must remain durable and queryable.

## Isolation SLO

The effective target for tenant/project leakage is zero. The following paths must include tenant/project scoping:

- SQL predicates and indexes.
- Object keys and object-store bindings.
- Valkey keys.
- NATS subjects and stream filters.
- Meilisearch filters.
- Qdrant payload filters.
- Temporal workflow IDs or search attributes.
- Audit events and OpenTelemetry attributes.

Any confirmed isolation leak is a launch-blocking incident, independent of latency or availability metrics.
