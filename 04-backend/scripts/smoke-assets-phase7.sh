#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
trap 'printf "smoke-assets-phase7 failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

gateway_pid=""
if ! curl -fsS "${BASE_URL}/healthz" >/dev/null 2>&1; then
  if [[ ! -x "${SCRIPT_DIR}/../target/release/architoken-gateway" ]]; then
    printf 'backend is not running and release gateway is missing; run cargo build --release --bin architoken-gateway first\n' >&2
    exit 1
  fi
  "${SCRIPT_DIR}/../target/release/architoken-gateway" >/tmp/architoken-phase7-assets-gateway.log 2>&1 &
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

asset="$(
  post_json "/v1/assets" '{
    "kind": "ifc",
    "name": "phase7-smoke.ifc",
    "sourceFormat": "ifc",
    "canonicalFormat": "ifc4x3",
    "metadata": { "smoke": true }
  }'
)"
asset_id="$(printf '%s\n' "${asset}" | jq -r '.assetId')"
printf '%s\n' "${asset}" | jq -e --arg tenant "${ARCHITOKEN_TENANT_ID}" --arg project "${ARCHITOKEN_PROJECT_ID}" '.kind == "ifc" and .metadata.tenantId == $tenant and .metadata.projectId == $project' >/dev/null

list="$(get_json "/v1/assets?kind=ifc")"
printf '%s\n' "${list}" | jq -e --arg asset_id "${asset_id}" '.assets[] | select(.assetId == $asset_id and .kind == "ifc")' >/dev/null

version="$(
  post_json "/v1/assets/${asset_id}/versions" '{
    "status": "ready",
    "metadata": { "stage": "smoke" }
  }'
)"
printf '%s\n' "${version}" | jq -e --arg asset_id "${asset_id}" '.assetId == $asset_id and .version == 2 and .status == "ready"' >/dev/null

versions="$(get_json "/v1/assets/${asset_id}/versions")"
printf '%s\n' "${versions}" | jq -e 'length == 2' >/dev/null

presign="$(
  post_json "/v1/assets/${asset_id}/files/presign-upload" '{
    "fileName": "phase7-smoke.ifc",
    "contentType": "model/ifc",
    "sizeBytes": 42
  }'
)"
file_id="$(printf '%s\n' "${presign}" | jq -r '.fileId')"
printf '%s\n' "${presign}" | jq -e '.method == "PUT" and (.uploadUrl | contains("phase7-smoke.ifc"))' >/dev/null

complete="$(
  post_json "/v1/assets/${asset_id}/files/complete-upload" "{
    \"fileId\": \"${file_id}\",
    \"key\": \"${ARCHITOKEN_TENANT_ID}/${ARCHITOKEN_PROJECT_ID}/${asset_id}/${file_id}/phase7-smoke.ifc\",
    \"sizeBytes\": 42,
    \"contentType\": \"model/ifc\",
    \"checksumSha256\": \"smoke-sha\",
    \"role\": \"source\",
    \"format\": \"ifc\"
  }"
)"
printf '%s\n' "${complete}" | jq -e --arg file_id "${file_id}" '.file.metadata.id == $file_id and .binding.assetFileId == $file_id and .binding.bucket == "architoken-assets"' >/dev/null

download="$(get_json "/v1/assets/${asset_id}/files/${file_id}/download")"
printf '%s\n' "${download}" | jq -e --arg file_id "${file_id}" '.fileId == $file_id and (.downloadUrl | contains("phase7-smoke.ifc"))' >/dev/null

printf 'phase7 asset smoke passed, asset_id=%s file_id=%s\n' "${asset_id}" "${file_id}"
