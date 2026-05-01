# Phase 8 PR #22 Post-Merge Certification Hotfix

Date: 2026-05-01

PR #22 was merged to add Phase 8.2 real load execution evidence tooling. PR #22 did **not** claim real 100,000 concurrent-user certification. It added the execution/evidence path needed to collect and validate real external load-test evidence.

Three post-merge defects were found in the certification evidence pipeline:

1. `tools/phase8_merge_load_evidence.py` used stage metadata as the effective VU source in some cases. That made `target_vus` capable of inflating achieved concurrency.
2. `tools/phase8_collect_prometheus_snapshot.py` did not query `realtime.dropped_connections` or `gateway.restarts`, and the merger defaulted missing critical metrics to zero.
3. `tools/phase8_validate_runtime_cluster.py` treated every non-ready pod as certification failure, including completed migration or maintenance Job/CronJob pods unrelated to the live runtime.

This hotfix makes the certification pipeline fail-closed and source-of-truth correct.

## Certification Truth Sources

| Evidence field | Source of truth |
| --- | --- |
| Stage observed VU | k6 summary metric `metrics.vus_max.values.max`. |
| Stage observed VU fallback 1 | k6 summary metric `metrics.vus_max.values.value` when `max` is absent. |
| Stage observed VU fallback 2 | k6 summary metric `metrics.vus.values.max` when `vus_max` is absent. |
| Stage target VU | Stage metadata `target_vus`; informational only. |
| Achieved concurrency | Maximum observed VU across all stage results. |
| Dropped realtime connections | Prometheus metric `realtime.dropped_connections`; required. |
| Gateway restarts | Prometheus metric `gateway.restarts`; required. |
| Runtime readiness | Live `kubectl` state for gateway, realtime-gateway, NATS, Qdrant, Valkey, PgBouncer, and Phase 8 workers where present. |

Metadata `target_vus` must never be used as achieved concurrency. If k6 observed VU metrics are missing, certification fails. If observed VUs are below the required stage target, certification fails.

## Critical Metrics

The merger requires these Prometheus metrics and does not default missing values:

- `realtime.ws_connected`
- `realtime.dropped_connections`
- `gateway.restarts`
- `db.pool_saturation`
- `object_store.errors`
- `nats.lag`
- `qdrant.consistency`

Present zero values pass only because Prometheus observed the metric with value `0`. Missing metrics are not equivalent to zero. Non-zero values are evaluated against certification thresholds.

## Runtime Cluster Scope

Runtime cluster validation checks certification workloads only:

- Gateway.
- Realtime gateway.
- NATS.
- Qdrant.
- Valkey.
- PgBouncer.
- Phase 8 workers where present.

Terminal `Succeeded` pods owned by completed Job/CronJob workloads, such as migration or maintenance jobs, are ignored. Required workload pods that are not `Running` and container-ready still fail certification.

## Certification Wording

This hotfix does not certify 100k traffic. External wording must remain limited to certification tooling/gates unless a real final evidence JSON validates as `certified`.
