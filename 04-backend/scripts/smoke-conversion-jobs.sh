#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
source "${SCRIPT_DIR}/smoke-phase7-helpers.sh"
trap 'printf "smoke-conversion-jobs failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

read -r asset_id file_id < <(create_phase7_asset_with_file "ifc" "phase7-conversion.ifc" "model/ifc" "ifc" "ifc4x3" 64)
job="$(create_phase7_conversion_job "ifc_ingest" "${asset_id}" "${file_id}" '{"worker":"contract"}')"
job_id="$(printf '%s\n' "${job}" | jq -r '.jobId')"
job_status="$(printf '%s\n' "${job}" | jq -r '.status')"
case "${job_status}" in
  queued|dispatched) ;;
  *)
    printf 'unexpected conversion job status=%s\n' "${job_status}" >&2
    exit 1
    ;;
esac
printf '%s\n' "${job}" | jq -e --arg asset_id "${asset_id}" --arg file_id "${file_id}" '.operation == "ifc_ingest" and .sourceAssetId == $asset_id and .sourceFileId == $file_id' >/dev/null

listed="$(get_json "/v1/conversion-jobs?operation=ifc_ingest&status=${job_status}")"
printf '%s\n' "${listed}" | jq -e --arg job_id "${job_id}" '.jobs[] | select(.jobId == $job_id)' >/dev/null

fetched="$(get_json "/v1/conversion-jobs/${job_id}")"
printf '%s\n' "${fetched}" | jq -e --arg job_id "${job_id}" --arg job_status "${job_status}" '.jobId == $job_id and .status == $job_status' >/dev/null

cancelled="$(post_json "/v1/conversion-jobs/${job_id}/cancel" '{"reason":"phase7 smoke complete"}')"
printf '%s\n' "${cancelled}" | jq -e '.status == "cancelled" and .error.reason == "phase7 smoke complete"' >/dev/null

printf 'phase7 conversion job smoke passed, job_id=%s\n' "${job_id}"
