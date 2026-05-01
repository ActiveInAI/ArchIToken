# Phase 8.2 Real Load Execution Evidence

Date: 2026-05-01

Phase 8.2 converts the Phase 8.1 certification gates from PR #21 into an external execution evidence workflow. PR #21 added gates; it did not prove real 100,000 concurrent online sessions. A certification claim requires a final evidence JSON produced from real k6 summaries, live Prometheus metrics, live Kubernetes status, Git metadata, manifest hash, image digest, and script hash.

## Required Evidence Inputs

| Input | Required source |
| --- | --- |
| k6 stage summaries | `phase8-run-smoke.sh`, `phase8-run-1k.sh`, `phase8-run-10k.sh`, `phase8-run-25k.sh`, `phase8-run-50k.sh`, `phase8-run-100k.sh`. |
| Stage metadata | Start time, end time, and target VU emitted beside every k6 summary. |
| Prometheus snapshot | `tools/phase8_collect_prometheus_snapshot.py` against the production/staging Prometheus endpoint. |
| Kubernetes live state | `tools/phase8_validate_runtime_cluster.py` against the actual cluster; YAML-only validation is not enough. |
| Grafana evidence | Dashboard export or snapshot file covering the run window. |
| OpenTelemetry evidence | Trace export or collector snapshot covering the run window. |
| Git SHA | Exact commit under test. |
| K8s manifest hash | Hash of the rendered manifest applied to the cluster. |
| Docker image digest | Immutable image digest deployed for gateway/realtime/worker images. |
| k6 script hash | Hash of `tools/k6/phase8_100k_ramp.js` or the approved load script used. |

## Execution Sequence

```bash
export ARCHITOKEN_LOAD_RUN_ID=phase8-real-$(date -u +%Y%m%dT%H%M%SZ)
export ARCHITOKEN_EVIDENCE_DIR=/tmp/architoken-phase8-evidence/${ARCHITOKEN_LOAD_RUN_ID}

04-backend/scripts/phase8-run-smoke.sh
04-backend/scripts/phase8-run-1k.sh
04-backend/scripts/phase8-run-10k.sh
04-backend/scripts/phase8-run-25k.sh
04-backend/scripts/phase8-run-50k.sh
ARCHITOKEN_ALLOW_LOCAL_100K=1 04-backend/scripts/phase8-run-100k.sh
```

`ARCHITOKEN_ALLOW_LOCAL_100K=1` must only be set on dedicated external/distributed load workers. It is a guard against accidentally treating a developer machine as a certification environment.

Collect evidence after the 100k run:

```bash
python3 tools/phase8_collect_prometheus_snapshot.py \
  --prometheus-url "${ARCHITOKEN_PROMETHEUS_URL}" \
  --out "${ARCHITOKEN_EVIDENCE_DIR}/prometheus-snapshot.json"

python3 tools/phase8_validate_runtime_cluster.py \
  --namespace "${ARCHITOKEN_K8S_NAMESPACE:-architoken-phase8}" \
  --out "${ARCHITOKEN_EVIDENCE_DIR}/runtime-cluster.json"
```

Merge and certify:

```bash
export ARCHITOKEN_RUN_ID="${ARCHITOKEN_LOAD_RUN_ID}"
export ARCHITOKEN_ENVIRONMENT=production-like-staging
export ARCHITOKEN_PROMETHEUS_SNAPSHOT="${ARCHITOKEN_EVIDENCE_DIR}/prometheus-snapshot.json"
export ARCHITOKEN_RUNTIME_CLUSTER_SNAPSHOT="${ARCHITOKEN_EVIDENCE_DIR}/runtime-cluster.json"
export ARCHITOKEN_GRAFANA_SNAPSHOT=/path/to/grafana-snapshot.json
export ARCHITOKEN_OTEL_SNAPSHOT=/path/to/otel-trace-snapshot.json
export ARCHITOKEN_DOCKER_IMAGE_DIGEST=sha256:...
export ARCHITOKEN_K8S_MANIFEST_FILE=/tmp/phase8-kustomize.yaml
04-backend/scripts/phase8-certify-from-evidence.sh
```

## Final Evidence JSON

The final JSON must pass `04-backend/scripts/validate-phase8-load-evidence.sh` and include:

- `stage_results` for `smoke`, `1k`, `10k`, `25k`, `50k`, and `100k`.
- For each stage: start time, end time, VU, RPS, p50/p95/p99, error rate, throughput, resource metrics, dependency status.
- `git_sha`, `k8s_manifest_hash`, `docker_image_digest`, and `k6_script_hash`.
- Prometheus, Grafana, and OpenTelemetry evidence presence.
- Live runtime cluster validation with no errors.

If any evidence input is missing, stale, or inconsistent, the status is `blocked` or `not_certified`.

## External Statement Rule

Without a real final evidence JSON, external wording must be limited to “Phase 8.1 certification gates are implemented” or “100k certification is pending execution.” Do not say “100k is certified,” “100k passed,” or “already supports 100k concurrent online users.”
