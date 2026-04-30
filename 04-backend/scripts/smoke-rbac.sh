#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
trap 'printf "smoke-rbac failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

context_args_for() {
  local tenant="$1"
  local project="$2"
  local actor="$3"
  local roles="$4"
  printf '%s\n' \
    "-H" "X-Tenant-Id: ${tenant}" \
    "-H" "X-Project-Id: ${project}" \
    "-H" "X-Actor: ${actor}" \
    "-H" "X-Roles: ${roles}" \
    "-H" "X-Request-Id: smoke-rbac-${actor}" \
    "-H" "X-Correlation-Id: smoke-rbac"
}

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

tenant_a="${ARCHITOKEN_TENANT_ID}-rbac-a"
tenant_b="${ARCHITOKEN_TENANT_ID}-rbac-b"
project="${ARCHITOKEN_PROJECT_ID}-rbac"

engineer_job="$(
  post_as "${tenant_a}" "${project}" "rbac-engineer" "engineer" '/v1/generation/jobs' '{
    "moduleId": "digital_twin",
    "mode": "model_to_lightweight_scene",
    "prompt": "RBAC smoke engineer creates and runs.",
    "actor": "rbac-engineer"
  }'
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
printf '%s\n' "${approved}" | jq -e '.status == "approved" and ([.artifacts[] | select(.status == "approved")] | length >= 3)' >/dev/null
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
