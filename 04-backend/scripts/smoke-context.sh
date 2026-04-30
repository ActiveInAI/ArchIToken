#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${ARCHITOKEN_API_BASE_URL:-${BASE_URL:-http://localhost:8080}}"
ARCHITOKEN_TENANT_ID="${ARCHITOKEN_TENANT_ID:-smoke-tenant}"
ARCHITOKEN_PROJECT_ID="${ARCHITOKEN_PROJECT_ID:-smoke-project}"
ARCHITOKEN_ACTOR="${ARCHITOKEN_ACTOR:-smoke}"
ARCHITOKEN_ROLES="${ARCHITOKEN_ROLES:-admin}"

export BASE_URL ARCHITOKEN_TENANT_ID ARCHITOKEN_PROJECT_ID ARCHITOKEN_ACTOR ARCHITOKEN_ROLES

context_headers=(
  -H "X-Tenant-Id: ${ARCHITOKEN_TENANT_ID}"
  -H "X-Project-Id: ${ARCHITOKEN_PROJECT_ID}"
  -H "X-Actor: ${ARCHITOKEN_ACTOR}"
  -H "X-Roles: ${ARCHITOKEN_ROLES}"
  -H "X-Request-Id: smoke-${ARCHITOKEN_ACTOR}"
  -H "X-Correlation-Id: smoke-phase6"
)

json_headers=(
  -H 'Content-Type: application/json'
  -H 'Accept: application/json'
)

need_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    printf 'jq is required for ArchIToken smoke scripts. Install jq and retry.\n' >&2
    exit 1
  fi
}

get_json() {
  local path="$1"
  curl -fsS "${BASE_URL}${path}" "${context_headers[@]}" -H 'Accept: application/json'
}

post_json() {
  local path="$1"
  local body="$2"
  curl -fsS -X POST "${BASE_URL}${path}" \
    "${context_headers[@]}" \
    "${json_headers[@]}" \
    --data "${body}"
}
