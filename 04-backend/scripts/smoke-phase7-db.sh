#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
trap 'printf "smoke-phase7-db failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

capabilities="$(get_json '/v1/runtime/capabilities')"
printf '%s\n' "${capabilities}" | jq -e '.storeCapabilities.seaOrmMigrations == true' >/dev/null
printf '%s\n' "${capabilities}" | jq -e '.storeCapabilities.seaweedfsS3 == true and .storage.s3ObjectBindings == true' >/dev/null
printf '%s\n' "${capabilities}" | jq -e '.localImplementationMode == "in_memory_preview" or .localImplementationMode == "durable_postgres"' >/dev/null
printf '%s\n' "${capabilities}" | jq -e '.storeCapabilities.objectStore == true and .storeCapabilities.artifactStore == true and .storeCapabilities.eventStore == true' >/dev/null

printf 'phase7 db adapter smoke passed for %s mode=%s\n' "${BASE_URL}" "$(printf '%s\n' "${capabilities}" | jq -r '.localImplementationMode')"
