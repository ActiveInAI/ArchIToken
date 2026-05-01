# Phase 8 Infra Deployment Baseline

Date: 2026-05-01

This document describes the reviewable infrastructure skeleton added for Phase 8 production readiness. It is a baseline for deployment planning, not a replacement for environment-specific HA design.

## Local Scale Compose

`docker-compose.phase8-scale.yml` provides a local integration stack for wiring checks:

- PostgreSQL 16 with existing extension init.
- PgBouncer.
- SeaweedFS master, volume, filer, and S3 gateway.
- Valkey.
- NATS with JetStream enabled.
- Qdrant.
- Temporal.
- Meilisearch.
- OpenTelemetry Collector.
- Prometheus.
- Grafana.

Local compose is not production HA. It exists to validate service discovery, environment variables, smoke scripts, and developer workflows.

## Kubernetes Baseline

`infra/k8s/phase8/` contains a simple Kustomize baseline:

- Namespace.
- Gateway deployment, HPA, and PDB.
- Realtime gateway deployment, HPA, and PDB.
- Worker HPA skeleton.
- PgBouncer deployment.
- Valkey skeleton.
- NATS JetStream skeleton.
- Qdrant skeleton.
- Observability skeleton for OpenTelemetry Collector, Prometheus, Grafana, Loki, and Tempo.

The manifests use placeholder images where this repository does not publish production images. They include resource requests/limits, probes where a service exposes health endpoints, and HPA targets where meaningful.

`tools/validate_phase8_k8s.py` enforces the reviewable baseline. It fails when API or realtime workloads are missing HPA/PDB, when workloads lack probes or resource requests/limits, when services do not match workload ports, or when multi-replica NATS/Qdrant StatefulSets lack cluster wiring.

## Production Replacement Points

| Component | Local/skeleton baseline | Production option |
| --- | --- | --- |
| PostgreSQL | Compose service or external URL. | Managed PostgreSQL HA or CloudNativePG/operator-managed HA cluster. |
| Object storage | SeaweedFS S3 compose cluster. | SeaweedFS HA cluster or managed S3-compatible object storage. |
| Ingress | Not bundled in the K8s skeleton. | Envoy Gateway or cloud ingress with WAF/CDN integration. |
| Secrets | Referenced by name only. | External Secrets, cloud secret manager, or sealed secrets. |
| Workers | HPA target skeleton. | KEDA ScaledObjects from Temporal/NATS/queue lag. |
| Observability | Basic collector and services. | Managed Prometheus/Grafana/Loki/Tempo or hardened in-cluster stack. |

## Required Production Controls

- No hardcoded production secrets in manifests.
- API and realtime deployments must have readiness/liveness probes.
- API and realtime deployments must have PDBs.
- CPU and memory requests/limits must be set before launch.
- PgBouncer must protect PostgreSQL from pod-count connection multiplication.
- CDN/object-store paths must carry large bytes; API pods must not.
- Tenant/project scoping must appear in database, cache, event, vector, search, object, and audit paths.
- Derived systems must have rebuild/replay procedures.
- Production gateway pods must provide explicit Phase 8 scale config: request/body limits, upload limits, global/tenant/actor RPS limits, per-tenant upload/job concurrency, DB pool max, and required PgBouncer/object-store/telemetry flags.
- Production gateway pods must provide durable dependency endpoints for database, object storage, queue/workflow, and telemetry; development-only memory/object fallback is not a launch configuration.
- Multi-replica NATS JetStream and Qdrant deployments must include headless services and cluster/bootstrap wiring; a multi-replica StatefulSet without clustering is invalid.
- Realtime gateway production manifests must include `NATS_URL`, `VALKEY_URL`, and telemetry endpoint configuration.
- Gateway readiness must expose runtime profile, database mode, object-store mode, rate-limit state, request body limit, tenant context policy, and build/git SHA.

## Deployment Readiness Checks

```bash
docker compose -f docker-compose.phase8-scale.yml config
kubectl kustomize infra/k8s/phase8
python3 tools/validate_phase8_k8s.py --path infra/k8s/phase8
bash -n 04-backend/scripts/smoke-phase8-scale.sh
bash -n 04-backend/scripts/load-phase8-100k.sh
bash -n 04-backend/scripts/smoke-phase8-production-readiness.sh
python3 -m unittest tools/test_validate_phase8_k8s.py
04-backend/scripts/smoke-phase8-production-readiness.sh
```

If `kubectl` is unavailable in a local environment, validate the manifests in CI with the cluster toolchain used by the deployment platform.
