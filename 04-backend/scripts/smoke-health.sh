#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
trap 'printf "smoke-health failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

health="$(curl -fsS "${BASE_URL}/healthz")"
ready="$(curl -fsS "${BASE_URL}/readyz")"
capabilities="$(get_json '/v1/runtime/capabilities')"

test "${health}" = "ok"
printf '%s\n' "${ready}" | jq -e '.status == "ready" and (.runtimeProfile | type == "string") and (.databaseConfigured | type == "boolean")' >/dev/null
runtime_profile="$(printf '%s\n' "${ready}" | jq -r '.runtimeProfile')"
if [[ "${runtime_profile}" == "production" ]]; then
  printf '%s\n' "${capabilities}" | jq -e '.storage.productionReady == true and .storeCapabilities.inMemoryOnly == false' >/dev/null
else
  printf '%s\n' "${capabilities}" | jq -e '.localImplementationMode == "in_memory_preview"' >/dev/null
fi
printf '%s\n' "${capabilities}" | jq -e '.storeCapabilities.artifactStore == true and .storeCapabilities.deterministicPagination == true' >/dev/null
printf 'health smoke passed for %s\n' "${BASE_URL}"
