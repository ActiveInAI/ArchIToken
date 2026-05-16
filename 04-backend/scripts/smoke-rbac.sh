#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
trap 'printf "smoke-rbac failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

post_as() {
  local tenant="$1"
  local project="$2"
  local actor="$3"
  local roles="$4"
  local path="$5"
  local body="$6"
  mapfile -t args < <(context_args_for "${tenant}" "${project}" "${actor}" "${roles}")
  curl -fsS -X POST "${BASE_URL}${path}" "${args[@]}" "${json_headers[@]}" --data "${body}"
}

get_as() {
  local tenant="$1"
  local project="$2"
  local actor="$3"
  local roles="$4"
  local path="$5"
  mapfile -t args < <(context_args_for "${tenant}" "${project}" "${actor}" "${roles}")
  curl -fsS "${BASE_URL}${path}" "${args[@]}" -H 'Accept: application/json'
}

status_post_as() {
  local tenant="$1"
  local project="$2"
  local actor="$3"
  local roles="$4"
  local path="$5"
  local body="$6"
  local output="$7"
  mapfile -t args < <(context_args_for "${tenant}" "${project}" "${actor}" "${roles}")
  curl -sS -o "${output}" -w '%{http_code}' -X POST "${BASE_URL}${path}" \
    "${args[@]}" \
    "${json_headers[@]}" \
    --data "${body}"
}

tenant_a="${ARCHITOKEN_RBAC_TENANT_A:-33333333-3333-4333-8333-333333333333}"
tenant_b="${ARCHITOKEN_RBAC_TENANT_B:-44444444-4444-4444-8444-444444444444}"
project="${ARCHITOKEN_RBAC_PROJECT_ID:-55555555-5555-4555-8555-555555555555}"
runtime_profile="$(curl -fsS "${BASE_URL}/readyz" | jq -r '.runtimeProfile')"
rbac_generation_mode="model_to_lightweight_scene"
rbac_artifact_min=3
if [[ "${runtime_profile}" == "production" ]]; then
  rbac_generation_mode="text_to_bim"
  rbac_artifact_min=1
fi

engineer_body="$(
  jq -nc \
    --arg mode "${rbac_generation_mode}" \
    '{moduleId:"digital_twin", mode:$mode, prompt:"RBAC smoke engineer creates and runs.", actor:"rbac-engineer"}'
)"
engineer_job="$(
  post_as "${tenant_a}" "${project}" "rbac-engineer" "engineer" '/v1/generation/jobs' "${engineer_body}"
)"
job_id="$(printf '%s\n' "${engineer_job}" | jq -r '.id')"
printf '%s\n' "${engineer_job}" | jq -e --arg tenant "${tenant_a}" --arg project "${project}" '.context.tenantId == $tenant and .context.projectId == $project' >/dev/null

auditor_status="$(
  status_post_as "${tenant_a}" "${project}" "rbac-auditor" "auditor" '/v1/generation/jobs' '{
    "moduleId": "digital_twin",
    "mode": "text_to_bim",
    "prompt": "auditor must not create",
    "actor": "rbac-auditor"
  }' /tmp/architoken-smoke-rbac-auditor-create.json
)"
test "${auditor_status}" = "403"
jq -e '.code == 403 and (.error | contains("permission"))' /tmp/architoken-smoke-rbac-auditor-create.json >/dev/null

post_as "${tenant_a}" "${project}" "rbac-engineer" "engineer" "/v1/generation/jobs/${job_id}/plan" '{"actor":"rbac-engineer","comment":"rbac plan"}' | jq -e '.status == "planned"' >/dev/null
post_as "${tenant_a}" "${project}" "rbac-engineer" "engineer" "/v1/generation/jobs/${job_id}/run" '{"actor":"rbac-engineer","comment":"rbac run"}' | jq -e '.status == "pending_review"' >/dev/null

post_as "${tenant_a}" "${project}" "rbac-reviewer" "reviewer" "/v1/generation/jobs/${job_id}/review" '{
  "reviewer": "rbac-reviewer",
  "decision": "approved",
  "comment": "rbac review approved"
}' | jq -e '.status == "pending_approval"' >/dev/null

approved="$(
  post_as "${tenant_a}" "${project}" "rbac-reviewer" "reviewer" "/v1/generation/jobs/${job_id}/approve" '{"actor":"rbac-reviewer","comment":"rbac approve"}'
)"
printf '%s\n' "${approved}" | jq -e --argjson artifact_min "${rbac_artifact_min}" '.status == "approved" and ([.artifacts[] | select(.status == "approved")] | length >= $artifact_min)' >/dev/null
artifact_id="$(printf '%s\n' "${approved}" | jq -r '.artifacts[0].id')"

get_as "${tenant_b}" "${project}" "rbac-auditor-b" "auditor" '/v1/generation/jobs' | jq -e --arg job_id "${job_id}" '[.jobs[] | select(.id == $job_id)] | length == 0' >/dev/null
get_as "${tenant_b}" "${project}" "rbac-auditor-b" "auditor" "/v1/artifacts?source_job_id=${job_id}" | jq -e '.artifacts | length == 0' >/dev/null

cross_get_status="$(
  mapfile -t args < <(context_args_for "${tenant_b}" "${project}" "rbac-auditor-b" "auditor")
  curl -sS -o /tmp/architoken-smoke-rbac-cross-artifact.json -w '%{http_code}' \
    "${BASE_URL}/v1/artifacts/${artifact_id}" \
    "${args[@]}" \
    -H 'Accept: application/json'
)"
test "${cross_get_status}" = "403"
jq -e '.code == 403' /tmp/architoken-smoke-rbac-cross-artifact.json >/dev/null

printf 'rbac smoke passed, job_id=%s artifact_id=%s\n' "${job_id}" "${artifact_id}"
