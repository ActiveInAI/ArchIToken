#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

MODE="${1:-smoke}"
API_BASE_URL="${ARCHITOKEN_API_BASE_URL:-${BASE_URL:-http://localhost:8080}}"
FRONTEND_BASE_URL="${ARCHITOKEN_FRONTEND_BASE_URL:-http://localhost:5173}"
WS_BASE_URL="${ARCHITOKEN_WS_BASE_URL:-ws://localhost:8082}"

if ! command -v k6 >/dev/null 2>&1; then
  printf 'k6 is required for Phase 8 load tests. Install k6 and retry.\n' >&2
  exit 1
fi

export ARCHITOKEN_API_BASE_URL="${API_BASE_URL}"
export ARCHITOKEN_FRONTEND_BASE_URL="${FRONTEND_BASE_URL}"
export ARCHITOKEN_WS_BASE_URL="${WS_BASE_URL}"
export ARCHITOKEN_TENANT_ID="${ARCHITOKEN_TENANT_ID:-phase8-load-tenant}"
export ARCHITOKEN_PROJECT_ID="${ARCHITOKEN_PROJECT_ID:-phase8-load-project}"
export ARCHITOKEN_ACTOR="${ARCHITOKEN_ACTOR:-phase8-load-runner}"
export ARCHITOKEN_ROLES="${ARCHITOKEN_ROLES:-admin}"

case "${MODE}" in
  smoke)
    k6 run "${REPO_ROOT}/tools/k6/phase8_100k_smoke.js"
    ;;
  ramp)
    export PHASE8_RAMP_MAX_VUS="${PHASE8_RAMP_MAX_VUS:-1000}"
    export PHASE8_RATE_SCALE="${PHASE8_RATE_SCALE:-1}"
    k6 run "${REPO_ROOT}/tools/k6/phase8_100k_ramp.js"
    ;;
  *)
    printf 'usage: %s [smoke|ramp]\n' "$0" >&2
    exit 2
    ;;
esac
