#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${ARCHITOKEN_API_BASE_URL:-${BASE_URL:-http://localhost:8080}}"
trap 'printf "smoke-viewer-commands failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    printf 'jq is required for ArchIToken smoke scripts. Install jq and retry.\n' >&2
    exit 1
  fi
}

post_json() {
  local path="$1"
  local body="$2"
  curl -fsS -X POST "${BASE_URL}${path}" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json' \
    --data "${body}"
}

need_jq

if [[ ! -s /tmp/architoken-smoke-artifact-id ]]; then
  "$(dirname "$0")/smoke-generation.sh"
fi

artifact_id="$(cat /tmp/architoken-smoke-artifact-id)"

command="$(
  post_json '/v1/viewer/commands' "{
    \"adapter\": \"threejs\",
    \"command\": \"set_color\",
    \"artifactId\": \"${artifact_id}\",
    \"elementIds\": [\"architoken:smoke:001\"],
    \"arguments\": {\"color\":\"#ff6600\"},
    \"actor\": \"smoke-viewer\"
  }"
)"
command_id="$(printf '%s\n' "${command}" | jq -r '.id')"
printf '%s\n' "${command}" | jq -e '.status == "queued" and .auditEventId != null' >/dev/null

acked="$(
  post_json "/v1/viewer/commands/${command_id}/ack" '{
    "actor": "smoke-viewer",
    "status": "executed",
    "comment": "smoke command contract executed",
    "result": {"backendContractOnly": true}
  }'
)"
printf '%s\n' "${acked}" | jq -e '.status == "executed" and .acknowledgedBy == "smoke-viewer"' >/dev/null

curl -fsS "${BASE_URL}/v1/viewer/commands/${command_id}" | jq -e '.status == "executed"' >/dev/null
curl -fsS "${BASE_URL}/v1/viewer/commands?status=executed" | jq -e --arg command_id "${command_id}" '.commands[] | select(.id == $command_id)' >/dev/null

printf 'viewer command smoke passed, command_id=%s\n' "${command_id}"
