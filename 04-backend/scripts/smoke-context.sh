#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${ARCHITOKEN_API_BASE_URL:-${BASE_URL:-http://localhost:8080}}"
ARCHITOKEN_TENANT_ID="${ARCHITOKEN_TENANT_ID:-11111111-1111-4111-8111-111111111111}"
ARCHITOKEN_PROJECT_ID="${ARCHITOKEN_PROJECT_ID:-22222222-2222-4222-8222-222222222222}"
ARCHITOKEN_ACTOR="${ARCHITOKEN_ACTOR:-smoke}"
ARCHITOKEN_ROLES="${ARCHITOKEN_ROLES:-admin}"
ARCHITOKEN_SMOKE_JWT_ISSUER="${ARCHITOKEN_SMOKE_JWT_ISSUER:-${ARCHITOKEN_AUTH__JWT_ISSUER:-${ARCHITOKEN_AUTH_JWT_ISSUER:-architoken-local-dev}}}"
ARCHITOKEN_SMOKE_JWT_SECRET="${ARCHITOKEN_SMOKE_JWT_SECRET:-${ARCHITOKEN_AUTH__JWT_SECRET:-${ARCHITOKEN_AUTH_JWT_SECRET:-}}}"
ARCHITOKEN_SMOKE_JWT_TTL="${ARCHITOKEN_SMOKE_JWT_TTL:-3600}"

export BASE_URL ARCHITOKEN_TENANT_ID ARCHITOKEN_PROJECT_ID ARCHITOKEN_ACTOR ARCHITOKEN_ROLES

runtime_roles_to_jwt_roles() {
  local roles="$1"
  local mapped=()
  IFS=',' read -r -a parts <<<"${roles}"
  for role in "${parts[@]}"; do
    role="$(printf '%s' "${role}" | tr '[:upper:]' '[:lower:]' | xargs)"
    case "${role}" in
      admin) mapped+=("admin") ;;
      auditor) mapped+=("auditor") ;;
      reviewer|supervisor) mapped+=("supervisor") ;;
      engineer|designer) mapped+=("designer") ;;
      owner) mapped+=("owner") ;;
      constructor) mapped+=("constructor") ;;
      cost_consultant|cost-consultant) mapped+=("cost_consultant") ;;
    esac
  done
  if [[ "${#mapped[@]}" -eq 0 ]]; then
    mapped=("auditor")
  fi
  local IFS=','
  printf '%s' "${mapped[*]}"
}

auth_token_for() {
  local tenant="$1"
  local actor="$2"
  local runtime_roles="$3"
  if [[ -n "${ARCHITOKEN_SMOKE_BEARER_TOKEN:-}" ]]; then
    printf '%s' "${ARCHITOKEN_SMOKE_BEARER_TOKEN}"
    return 0
  fi
  if [[ -z "${ARCHITOKEN_SMOKE_JWT_SECRET}" ]]; then
    return 0
  fi
  python3 "${SCRIPT_DIR}/smoke-jwt.py" \
    --secret "${ARCHITOKEN_SMOKE_JWT_SECRET}" \
    --issuer "${ARCHITOKEN_SMOKE_JWT_ISSUER}" \
    --tenant-id "${tenant}" \
    --subject "${actor}" \
    --roles "$(runtime_roles_to_jwt_roles "${runtime_roles}")" \
    --ttl "${ARCHITOKEN_SMOKE_JWT_TTL}"
}

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
    "-H" "X-Request-Id: smoke-${actor}" \
    "-H" "X-Correlation-Id: smoke-phase6"
  local token
  token="$(auth_token_for "${tenant}" "${actor}" "${roles}")"
  if [[ -n "${token}" ]]; then
    printf '%s\n' "-H" "Authorization: Bearer ${token}"
  fi
}

mapfile -t context_headers < <(context_args_for "${ARCHITOKEN_TENANT_ID}" "${ARCHITOKEN_PROJECT_ID}" "${ARCHITOKEN_ACTOR}" "${ARCHITOKEN_ROLES}")

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
