#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

NAMESPACE="${ARCHITOKEN_PHASE8_NAMESPACE:-architoken-phase8}"
REQUEST_TIMEOUT="${ARCHITOKEN_K8S_REQUEST_TIMEOUT:-5s}"
COMMAND_TIMEOUT_SECONDS="${ARCHITOKEN_K8S_COMMAND_TIMEOUT_SECONDS:-15}"
KUSTOMIZE_OUT="${ARCHITOKEN_K8S_KUSTOMIZE_OUT:-/tmp/phase8-kustomize.yaml}"
RUNTIME_OUT="${ARCHITOKEN_K8S_RUNTIME_OUT:-/tmp/phase8-runtime-cluster.json}"

trap 'printf "smoke-phase8-k8s-cluster failed at line %s\n" "${LINENO}" >&2' ERR

kubectl kustomize 05-infra/phase8/k8s >"${KUSTOMIZE_OUT}"
python3 tools/validate_phase8_k8s.py --path 05-infra/phase8/k8s >/dev/null

context="$(kubectl config current-context 2>/dev/null || true)"
if [[ -z "${context}" ]]; then
  context="unknown"
fi

readyz_log="/tmp/phase8-k8s-readyz.log"
if ! kubectl --request-timeout="${REQUEST_TIMEOUT}" get --raw=/readyz >"${readyz_log}" 2>&1; then
  printf 'phase8 k8s live cluster check failed: Kubernetes API is unreachable for context %s\n' "${context}" >&2
  printf 'expected production control-plane: Spark-A https://192.168.100.1:6443; see 05-infra/k8s-cluster/CLUSTER.md\n' >&2
  sed -n '1,8p' "${readyz_log}" >&2
  exit 2
fi

kubectl --request-timeout="${REQUEST_TIMEOUT}" get nodes -o wide
kubectl --request-timeout="${REQUEST_TIMEOUT}" get pods -n "${NAMESPACE}" -o wide
python3 tools/phase8_validate_runtime_cluster.py \
  --namespace "${NAMESPACE}" \
  --request-timeout "${REQUEST_TIMEOUT}" \
  --command-timeout-seconds "${COMMAND_TIMEOUT_SECONDS}" \
  --out "${RUNTIME_OUT}"

printf 'phase8 k8s live cluster smoke passed context=%s namespace=%s evidence=%s\n' \
  "${context}" "${NAMESPACE}" "${RUNTIME_OUT}"
