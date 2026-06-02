#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
source "${SCRIPT_DIR}/smoke-phase7-helpers.sh"
trap 'printf "smoke-cad failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

read -r asset_id file_id < <(create_phase7_asset_with_file "cad" "phase7-cad.dxf" "application/dxf" "dxf" "gltf" 88)
job="$(create_phase7_conversion_job "cad_extract_entities" "${asset_id}" "${file_id}" '{"cad":["dxf_extract_entities","occt_adapter"],"dwg":"licensed_external_adapter"}')"
printf '%s\n' "${job}" | jq -e '.operation == "cad_extract_entities" and (.status == "queued" or .status == "dispatched") and .input.dwg == "licensed_external_adapter"' >/dev/null

printf 'phase7 cad smoke passed, job_id=%s\n' "$(printf '%s\n' "${job}" | jq -r '.jobId')"
