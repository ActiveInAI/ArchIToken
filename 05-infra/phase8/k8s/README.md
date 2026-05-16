# Phase 8 Kubernetes Baseline

This directory contains a reviewable Kubernetes baseline for the Phase 8 100k-concurrency production-readiness track. It is intentionally simple and uses placeholder images where this repository does not yet publish production images.

## Scope

- Stateless gateway deployment, HPA, and PDB.
- Realtime gateway deployment, HPA, and PDB.
- Worker HPA placeholder for later KEDA replacement.
- PgBouncer deployment for PostgreSQL connection protection.
- Valkey, NATS JetStream, and Qdrant skeletons.
- Observability skeleton for OpenTelemetry Collector, Prometheus, Grafana, Loki, and Tempo.

## Production Notes

- PostgreSQL can be managed service or an HA operator such as CloudNativePG. Do not run a single in-cluster primary for launch.
- Object storage can be a managed S3-compatible service or a hardened SeaweedFS HA cluster. Do not route large bytes through gateway pods.
- Secrets are referenced by name only. Use External Secrets, cloud secret manager integration, or sealed secrets.
- Images are placeholders and must be replaced with immutable digests.
- KEDA should replace or augment worker HPA once real queue/workflow metrics are wired.
- Ingress/CDN/WAF are platform-specific and intentionally not hardcoded here.

## Validation

```bash
kubectl kustomize 05-infra/phase8/k8s
```
