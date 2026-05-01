#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
trap 'printf "smoke-phase8-realtime-readiness failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

ready="$(curl -fsS "${BASE_URL}/readyz")"
printf '%s\n' "${ready}" | jq -e '.status == "ready" and (.runtimeProfile | type == "string")' >/dev/null

if [[ -z "${ARCHITOKEN_REALTIME_WS_URL:-}" ]]; then
  printf 'verdict=blocked reason=realtime_endpoint_not_configured\n' >&2
  exit 2
fi

if ! command -v k6 >/dev/null 2>&1; then
  if [[ "${ARCHITOKEN_REALTIME_ALLOW_HTTP_FALLBACK:-0}" = "1" ]]; then
    printf 'verdict=blocked reason=k6_missing_http_fallback_readyz_ok\n' >&2
    exit 2
  fi
  printf 'verdict=blocked reason=k6_required_for_realtime_handshake\n' >&2
  exit 2
fi

ARCHITOKEN_ENABLE_REALTIME_WS=1 \
ARCHITOKEN_REALTIME_REQUIRED=1 \
ARCHITOKEN_WS_BASE_URL="${ARCHITOKEN_REALTIME_WS_URL}" \
k6 run --vus 1 --duration 5s tools/k6/phase8_100k_smoke.js

printf 'verdict=realtime_ready url=%s\n' "${ARCHITOKEN_REALTIME_WS_URL}"
