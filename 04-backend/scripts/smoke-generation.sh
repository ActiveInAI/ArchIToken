#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
trap 'printf "smoke-generation failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

job="$(
  post_json '/v1/generation/jobs' '{
    "moduleId": "digital_twin",
    "mode": "model_to_lightweight_scene",
    "prompt": "Smoke create lightweight scene artifacts.",
    "actor": "smoke-generation"
  }'
)"
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
printf '%s\n' "${approved}" | jq -e '[.artifacts[] | select(.status == "approved")] | length >= 3' >/dev/null

artifacts="$(get_json "/v1/generation/jobs/${job_id}/artifacts")"
printf '%s\n' "${artifacts}" | jq -e '.artifacts | length >= 3' >/dev/null

printf '%s\n' "${job_id}" >/tmp/architoken-smoke-generation-job-id
printf '%s\n' "${artifacts}" | jq -r '.artifacts[0].id' >/tmp/architoken-smoke-artifact-id
printf 'generation smoke passed, job_id=%s\n' "${job_id}"
