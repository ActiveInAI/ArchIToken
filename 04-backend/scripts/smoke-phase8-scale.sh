#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
source "${SCRIPT_DIR}/smoke-phase7-helpers.sh"
trap 'printf "smoke-phase8-scale failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

gateway_pid=""
if ! curl -fsS "${BASE_URL}/healthz" >/dev/null 2>&1; then
  if [[ ! -x "${SCRIPT_DIR}/../target/release/architoken-gateway" ]]; then
    printf 'backend is not running and release gateway is missing; run cargo build --release --bin architoken-gateway first\n' >&2
    exit 1
  fi
  "${SCRIPT_DIR}/../target/release/architoken-gateway" >/tmp/architoken-phase8-scale-gateway.log 2>&1 &
  gateway_pid="$!"
  for _ in $(seq 1 30); do
    if curl -fsS "${BASE_URL}/healthz" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

cleanup() {
  if [[ -n "${gateway_pid}" ]]; then
    kill "${gateway_pid}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

health="$(curl -fsS "${BASE_URL}/healthz")"
ready="$(curl -fsS "${BASE_URL}/readyz")"
test "${health}" = "ok"
printf '%s\n' "${ready}" | jq -e '
  .status == "ready"
  and (.runtimeProfile | type == "string")
  and (.databaseMode | type == "string")
  and (.objectStoreMode | type == "string")
  and (.rateLimitEnabled | type == "boolean")
  and (.maxRequestBodyBytes | type == "number")
  and (.tenantContextPolicy | type == "string")
  and (.buildGitSha | type == "string")
  and (.databaseConfigured | type == "boolean")
  and (.objectStoreConfigured | type == "boolean")
  and (.queueConfigured | type == "boolean")
  and (.telemetryConfigured | type == "boolean")
' >/dev/null

capabilities="$(get_json '/v1/runtime/capabilities')"
printf '%s\n' "${capabilities}" | jq -e '
  .storeCapabilities.artifactStore == true
  and .storeCapabilities.deterministicPagination == true
  and .storage.s3ObjectBindings == true
  and (.generation.assetKindsPhase7 | index("ifc"))
  and (.generation.conversionOperations | index("ifc_ingest"))
' >/dev/null

read -r asset_id file_id < <(create_phase7_asset_with_file "ifc" "phase8-scale-smoke.ifc" "model/ifc" "ifc" "ifc4x3" 128)

assets="$(get_json '/v1/assets?kind=ifc&limit=20')"
printf '%s\n' "${assets}" | jq -e --arg asset_id "${asset_id}" '
  .assets | map(select(.assetId == $asset_id and .kind == "ifc")) | length == 1
' >/dev/null

download="$(get_json "/v1/assets/${asset_id}/files/${file_id}/download")"
printf '%s\n' "${download}" | jq -e --arg file_id "${file_id}" '
  .fileId == $file_id and (.downloadUrl | type == "string") and (.downloadUrl | length > 0)
' >/dev/null

job="$(create_phase7_conversion_job "ifc_ingest" "${asset_id}" "${file_id}" '{"phase8ScaleSmoke":true}')"
job_id="$(printf '%s\n' "${job}" | jq -r '.jobId')"
printf '%s\n' "${job}" | jq -e --arg job_id "${job_id}" --arg asset_id "${asset_id}" --arg file_id "${file_id}" '
  .jobId == $job_id and .sourceAssetId == $asset_id and .sourceFileId == $file_id and .status == "queued"
' >/dev/null

runtime_executions="$(get_json '/v1/runtime/executions')"
printf '%s\n' "${runtime_executions}" | jq -e 'type == "object" and (.executions | type == "array")' >/dev/null

viewer_commands="$(get_json '/v1/viewer/commands?limit=20')"
printf '%s\n' "${viewer_commands}" | jq -e 'type == "object" and (.commands | type == "array")' >/dev/null

if [[ -n "${ARCHITOKEN_REALTIME_WS_URL:-}" ]]; then
  printf 'realtime smoke placeholder configured for %s; WebSocket handshake validation belongs to k6 phase8 scripts\n' "${ARCHITOKEN_REALTIME_WS_URL}"
else
  printf 'realtime smoke placeholder skipped; set ARCHITOKEN_REALTIME_WS_URL to enable external WebSocket validation\n'
fi

printf 'phase8 scale smoke passed for %s tenant=%s project=%s asset_id=%s file_id=%s job_id=%s\n' \
  "${BASE_URL}" "${ARCHITOKEN_TENANT_ID}" "${ARCHITOKEN_PROJECT_ID}" "${asset_id}" "${file_id}" "${job_id}"
