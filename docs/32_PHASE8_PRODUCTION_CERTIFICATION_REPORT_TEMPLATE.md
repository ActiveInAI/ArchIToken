# Phase 8.2 Production Certification Report Template

Date: 2026-05-01

Use this template after a real external load run. Do not mark a release certified unless the final evidence JSON validates successfully.

## Summary

| Field | Value |
| --- | --- |
| Run ID |  |
| Environment |  |
| Git SHA |  |
| Docker image digest |  |
| K8s manifest hash |  |
| k6 script hash |  |
| Start time |  |
| End time |  |
| Final verdict | `certified` / `not_certified` / `blocked` |
| Evidence JSON path |  |

## Stage Results

| Stage | Start | End | VU | RPS | p50 | p95 | p99 | Error rate | Throughput | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| smoke |  |  |  |  |  |  |  |  |  |  |
| 1k |  |  |  |  |  |  |  |  |  |  |
| 10k |  |  |  |  |  |  |  |  |  |  |
| 25k |  |  |  |  |  |  |  |  |  |  |
| 50k |  |  |  |  |  |  |  |  |  |  |
| 100k |  |  |  |  |  |  |  |  |  |  |

## Dependency Health

| Dependency | Evidence | Result | Notes |
| --- | --- | --- | --- |
| Gateway | Prometheus, logs, K8s live state |  |  |
| Realtime Gateway | Prometheus, K8s live state |  |  |
| PostgreSQL/PgBouncer | Prometheus |  |  |
| SeaweedFS S3/object store | Prometheus |  |  |
| NATS JetStream | Prometheus, K8s live state |  |  |
| Qdrant | Prometheus, K8s live state |  |  |
| Valkey | Prometheus, K8s live state |  |  |
| Temporal/workers | Prometheus/logs |  |  |
| OpenTelemetry | Trace snapshot |  |  |
| Grafana | Dashboard snapshot |  |  |

## Gate Results

| Gate | Target | Actual | Pass/Fail |
| --- | --- | --- | --- |
| 100k achieved concurrency | >= 100,000 |  |  |
| API p95 | < 300 ms |  |  |
| API p99 | < 800 ms |  |  |
| HTTP error rate | < 0.1% |  |  |
| Realtime stability | >= 99.9% |  |  |
| Gateway restarts | 0 |  |  |
| DB pool saturation | < 80% |  |  |
| Object-store errors | 0 |  |  |
| NATS lag | bounded below threshold |  |  |
| Qdrant consistency | true |  |  |
| K8s runtime validation | no errors |  |  |
| Prometheus evidence | present |  |  |
| Grafana evidence | present |  |  |
| OTel evidence | present |  |  |

## Bottlenecks and Fixes

| Stage | Symptom | Root cause | Fix | Re-test evidence |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Go / No-Go

Decision: `go` / `no-go` / `rollback`

Required sign-offs:

- Platform owner:
- Backend owner:
- Infra/SRE owner:
- Security/license owner:
- Product owner:

## External Wording

Approved wording must match the evidence:

- If final verdict is `certified`: “ArchIToken Phase 8.2 completed an evidence-backed 100k concurrent online session certification run for commit `<sha>` in environment `<env>`.”
- If final verdict is `not_certified` or `blocked`: “ArchIToken has implemented 100k certification gates and execution tooling; certification remains pending.”

Do not use “已支持 100k 同时在线” or equivalent wording unless the final evidence JSON is certified.
