#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
trap 'printf "smoke-artifacts failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

if [[ ! -s /tmp/architoken-smoke-artifact-id ]]; then
  "${SCRIPT_DIR}/smoke-generation.sh"
fi

artifact_id="$(cat /tmp/architoken-smoke-artifact-id)"
job_id="$(cat /tmp/architoken-smoke-generation-job-id)"

list="$(get_json "/v1/artifacts?source_job_id=${job_id}&status=approved")"
printf '%s\n' "${list}" | jq -e --arg artifact_id "${artifact_id}" '.artifacts[] | select(.id == $artifact_id and .status == "approved")' >/dev/null

artifact="$(get_json "/v1/artifacts/${artifact_id}")"
printf '%s\n' "${artifact}" | jq -e '.reference.artifactId == .id' >/dev/null

versions="$(get_json "/v1/artifacts/${artifact_id}/versions")"
printf '%s\n' "${versions}" | jq -e 'length >= 1 and .[0].status == "approved"' >/dev/null

metadata="$(get_json "/v1/artifacts/${artifact_id}/metadata")"
printf '%s\n' "${metadata}" | jq -e --arg tenant "${ARCHITOKEN_TENANT_ID}" --arg project "${ARCHITOKEN_PROJECT_ID}" '.approvalStatus == "approved" and .sourceJobId != null and .tenantId == $tenant and .projectId == $project' >/dev/null

binding="$(get_json "/v1/artifacts/${artifact_id}/storage-binding")"
printf '%s\n' "${binding}" | jq -e '.provider == "memory" and (.objectUri | startswith("memory://"))' >/dev/null

printf 'artifact smoke passed, artifact_id=%s\n' "${artifact_id}"
