#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

FINAL_EVIDENCE="${ARCHITOKEN_FINAL_EVIDENCE:-${ARCHITOKEN_LOAD_EVIDENCE:-}}"
OUT_DIR="${ARCHITOKEN_EVIDENCE_DIR:-}"

if [[ -n "${FINAL_EVIDENCE}" && -f "${FINAL_EVIDENCE}" ]]; then
  ARCHITOKEN_TARGET_CONCURRENCY=100000 \
    04-backend/scripts/validate-phase8-load-evidence.sh "${FINAL_EVIDENCE}"
  printf 'verdict=certified evidence=%s\n' "${FINAL_EVIDENCE}"
  exit 0
fi

if [[ -z "${OUT_DIR}" ]]; then
  printf 'verdict=blocked reason=missing_ARCHITOKEN_FINAL_EVIDENCE_or_ARCHITOKEN_EVIDENCE_DIR\n' >&2
  exit 2
fi

required_vars=(
  ARCHITOKEN_RUN_ID
  ARCHITOKEN_ENVIRONMENT
  ARCHITOKEN_PROMETHEUS_SNAPSHOT
  ARCHITOKEN_RUNTIME_CLUSTER_SNAPSHOT
  ARCHITOKEN_DOCKER_IMAGE_DIGEST
  ARCHITOKEN_GRAFANA_SNAPSHOT
  ARCHITOKEN_OTEL_SNAPSHOT
)

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    printf 'verdict=blocked reason=missing_%s\n' "${var}" >&2
    exit 2
  fi
done

for stage in smoke 1k 10k 25k 50k 100k; do
  if [[ ! -f "${OUT_DIR}/${stage}-k6-summary.json" ]]; then
    printf 'verdict=blocked reason=missing_k6_summary stage=%s path=%s\n' "${stage}" "${OUT_DIR}/${stage}-k6-summary.json" >&2
    exit 2
  fi
  if [[ ! -f "${OUT_DIR}/${stage}-stage-meta.json" ]]; then
    printf 'verdict=blocked reason=missing_stage_metadata stage=%s path=%s\n' "${stage}" "${OUT_DIR}/${stage}-stage-meta.json" >&2
    exit 2
  fi
done

if [[ -z "${ARCHITOKEN_K8S_MANIFEST_HASH:-}" && -z "${ARCHITOKEN_K8S_MANIFEST_FILE:-}" ]]; then
  printf 'verdict=blocked reason=missing_k8s_manifest_hash_or_file\n' >&2
  exit 2
fi

FINAL_EVIDENCE="${FINAL_EVIDENCE:-${OUT_DIR}/phase8-final-load-evidence.json}"
merge_args=(
  --run-id "${ARCHITOKEN_RUN_ID}"
  --environment "${ARCHITOKEN_ENVIRONMENT}"
  --prometheus-snapshot "${ARCHITOKEN_PROMETHEUS_SNAPSHOT}"
  --runtime-cluster "${ARCHITOKEN_RUNTIME_CLUSTER_SNAPSHOT}"
  --docker-image-digest "${ARCHITOKEN_DOCKER_IMAGE_DIGEST}"
  --grafana-snapshot "${ARCHITOKEN_GRAFANA_SNAPSHOT}"
  --otel-snapshot "${ARCHITOKEN_OTEL_SNAPSHOT}"
  --out "${FINAL_EVIDENCE}"
)

for stage in smoke 1k 10k 25k 50k 100k; do
  merge_args+=(--stage "${stage}=${OUT_DIR}/${stage}-k6-summary.json")
  merge_args+=(--stage-meta "${stage}=${OUT_DIR}/${stage}-stage-meta.json")
done

if [[ -n "${ARCHITOKEN_K8S_MANIFEST_HASH:-}" ]]; then
  merge_args+=(--k8s-manifest-hash "${ARCHITOKEN_K8S_MANIFEST_HASH}")
else
  merge_args+=(--k8s-manifest "${ARCHITOKEN_K8S_MANIFEST_FILE}")
fi

if [[ -n "${ARCHITOKEN_K6_SCRIPT_HASH:-}" ]]; then
  merge_args+=(--k6-script-hash "${ARCHITOKEN_K6_SCRIPT_HASH}")
fi

if [[ -n "${ARCHITOKEN_CERT_GIT_SHA:-}" ]]; then
  merge_args+=(--git-sha "${ARCHITOKEN_CERT_GIT_SHA}")
fi

python3 tools/phase8_merge_load_evidence.py "${merge_args[@]}"
ARCHITOKEN_TARGET_CONCURRENCY=100000 \
  04-backend/scripts/validate-phase8-load-evidence.sh "${FINAL_EVIDENCE}"
printf 'verdict=certified evidence=%s\n' "${FINAL_EVIDENCE}"
