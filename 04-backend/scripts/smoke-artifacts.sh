#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${ARCHITOKEN_API_BASE_URL:-${BASE_URL:-http://localhost:8080}}"
trap 'printf "smoke-artifacts failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    printf 'jq is required for ArchIToken smoke scripts. Install jq and retry.\n' >&2
    exit 1
  fi
}

need_jq

if [[ ! -s /tmp/architoken-smoke-artifact-id ]]; then
  "$(dirname "$0")/smoke-generation.sh"
fi

artifact_id="$(cat /tmp/architoken-smoke-artifact-id)"
job_id="$(cat /tmp/architoken-smoke-generation-job-id)"

list="$(curl -fsS "${BASE_URL}/v1/artifacts?source_job_id=${job_id}&status=approved")"
printf '%s\n' "${list}" | jq -e --arg artifact_id "${artifact_id}" '.artifacts[] | select(.id == $artifact_id and .status == "approved")' >/dev/null

artifact="$(curl -fsS "${BASE_URL}/v1/artifacts/${artifact_id}")"
printf '%s\n' "${artifact}" | jq -e '.reference.artifactId == .id' >/dev/null

versions="$(curl -fsS "${BASE_URL}/v1/artifacts/${artifact_id}/versions")"
printf '%s\n' "${versions}" | jq -e 'length >= 1 and .[0].status == "approved"' >/dev/null

metadata="$(curl -fsS "${BASE_URL}/v1/artifacts/${artifact_id}/metadata")"
printf '%s\n' "${metadata}" | jq -e '.approvalStatus == "approved" and .sourceJobId != null' >/dev/null

binding="$(curl -fsS "${BASE_URL}/v1/artifacts/${artifact_id}/storage-binding")"
printf '%s\n' "${binding}" | jq -e '.provider == "memory" and (.objectUri | startswith("memory://"))' >/dev/null

printf 'artifact smoke passed, artifact_id=%s\n' "${artifact_id}"
