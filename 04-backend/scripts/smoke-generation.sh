#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
trap 'printf "smoke-generation failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

runtime_profile="$(curl -fsS "${BASE_URL}/readyz" | jq -r '.runtimeProfile')"
generation_mode="model_to_lightweight_scene"
artifact_min=3
generation_prompt="Smoke create lightweight scene artifacts."
if [[ "${runtime_profile}" == "production" ]]; then
  generation_mode="text_to_bim"
  artifact_min=1
  generation_prompt="Smoke create IFC4x3 BIM artifacts through the configured production TextToBim provider."
fi

job_payload="$(
  jq -nc \
    --arg mode "${generation_mode}" \
    --arg prompt "${generation_prompt}" \
    '{moduleId:"digital_twin", mode:$mode, prompt:$prompt, actor:"smoke-generation"}'
)"
job="$(post_json '/v1/generation/jobs' "${job_payload}")"
job_id="$(printf '%s\n' "${job}" | jq -r '.id')"
printf '%s\n' "${job}" | jq -e --arg tenant "${ARCHITOKEN_TENANT_ID}" --arg project "${ARCHITOKEN_PROJECT_ID}" '.context.tenantId == $tenant and .context.projectId == $project' >/dev/null

planned="$(post_json "/v1/generation/jobs/${job_id}/plan" '{"actor":"smoke-generation","comment":"smoke plan"}')"
printf '%s\n' "${planned}" | jq -e '.status == "planned"' >/dev/null

run="$(post_json "/v1/generation/jobs/${job_id}/run" '{"actor":"smoke-generation","comment":"smoke run"}')"
printf '%s\n' "${run}" | jq -e '.status == "pending_review"' >/dev/null

reviewed="$(
  post_json "/v1/generation/jobs/${job_id}/review" '{
    "reviewer": "smoke-generation",
    "decision": "approved",
    "comment": "smoke review approved"
  }'
)"
printf '%s\n' "${reviewed}" | jq -e '.status == "pending_approval"' >/dev/null

approved="$(post_json "/v1/generation/jobs/${job_id}/approve" '{"actor":"smoke-generation","comment":"smoke approve"}')"
printf '%s\n' "${approved}" | jq -e '.status == "approved"' >/dev/null
printf '%s\n' "${approved}" | jq -e --argjson artifact_min "${artifact_min}" '[.artifacts[] | select(.status == "approved")] | length >= $artifact_min' >/dev/null

artifacts="$(get_json "/v1/generation/jobs/${job_id}/artifacts")"
printf '%s\n' "${artifacts}" | jq -e --argjson artifact_min "${artifact_min}" '.artifacts | length >= $artifact_min' >/dev/null

printf '%s\n' "${job_id}" >/tmp/architoken-smoke-generation-job-id
printf '%s\n' "${artifacts}" | jq -r '.artifacts[0].id' >/tmp/architoken-smoke-artifact-id
printf 'generation smoke passed, job_id=%s\n' "${job_id}"
