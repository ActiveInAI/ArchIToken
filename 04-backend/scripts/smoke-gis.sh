#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
source "${SCRIPT_DIR}/smoke-phase7-helpers.sh"
trap 'printf "smoke-gis failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

read -r asset_id file_id < <(create_phase7_asset_with_file "gis_layer" "phase7-layer.geojson" "application/geo+json" "geojson" "3dtiles" 77)
job="$(create_phase7_conversion_job "gis_tile" "${asset_id}" "${file_id}" '{"gis":["postgis_index","tileset_manifest"],"networkPolicy":"scheduled_explicit"}')"
printf '%s\n' "${job}" | jq -e '.operation == "gis_tile" and (.status == "queued" or .status == "dispatched") and .input.networkPolicy == "scheduled_explicit"' >/dev/null

printf 'phase7 gis smoke passed, job_id=%s\n' "$(printf '%s\n' "${job}" | jq -r '.jobId')"
