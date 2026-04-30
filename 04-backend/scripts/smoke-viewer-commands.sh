#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
trap 'printf "smoke-viewer-commands failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

if [[ ! -s /tmp/architoken-smoke-artifact-id ]]; then
  "${SCRIPT_DIR}/smoke-generation.sh"
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

get_json "/v1/viewer/commands/${command_id}" | jq -e '.status == "executed"' >/dev/null
get_json '/v1/viewer/commands?status=executed' | jq -e --arg command_id "${command_id}" '.commands[] | select(.id == $command_id)' >/dev/null

printf 'viewer command smoke passed, command_id=%s\n' "${command_id}"
