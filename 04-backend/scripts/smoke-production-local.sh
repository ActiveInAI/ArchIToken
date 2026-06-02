#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

API_HOST="${ARCHITOKEN_PRODUCTION_SMOKE_HOST:-127.0.0.1}"
API_PORT="${ARCHITOKEN_PRODUCTION_SMOKE_PORT:-18080}"
FIXTURE_PORT="${ARCHITOKEN_PRODUCTION_SMOKE_FIXTURE_PORT:-19081}"
PROMETHEUS_PORT="${ARCHITOKEN_PRODUCTION_SMOKE_PROMETHEUS_PORT:-19090}"
BASE_URL="http://${API_HOST}:${API_PORT}"
FIXTURE_URL="http://${API_HOST}:${FIXTURE_PORT}"
JWT_ISSUER="${ARCHITOKEN_PRODUCTION_SMOKE_JWT_ISSUER:-architoken-production-smoke}"
JWT_SECRET="${ARCHITOKEN_PRODUCTION_SMOKE_JWT_SECRET:-production-smoke-secret-with-enough-entropy}"
DATABASE_URL="${DATABASE_URL:-${ARCHITOKEN_DATABASE__URL:-postgres://architoken:architoken_dev_only@127.0.0.1:5433/architoken}}"
GATEWAY_BIN="${ARCHITOKEN_GATEWAY_BIN:-${BACKEND_DIR}/target/debug/architoken-gateway}"

fixture_pid=""
gateway_pid=""

cleanup() {
  if [[ -n "${gateway_pid}" ]]; then
    kill "${gateway_pid}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${fixture_pid}" ]]; then
    kill "${fixture_pid}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

wait_for_http() {
  local url="$1"
  local label="$2"
  for _ in $(seq 1 60); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  printf '%s did not become ready at %s\n' "${label}" "${url}" >&2
  return 1
}

if [[ ! -x "${GATEWAY_BIN}" ]]; then
  cargo build --manifest-path "${BACKEND_DIR}/Cargo.toml" -p architoken-harness-core --bin architoken-gateway
fi

rm -f /tmp/architoken-smoke-generation-job-id /tmp/architoken-smoke-artifact-id

python3 "${SCRIPT_DIR}/production-smoke-fixture.py" \
  --host "${API_HOST}" \
  --port "${FIXTURE_PORT}" \
  --public-base-url "${FIXTURE_URL}" \
  >/tmp/architoken-production-smoke-fixture.log 2>&1 &
fixture_pid="$!"
wait_for_http "${FIXTURE_URL}/healthz" "production smoke fixture"

(
  cd "${BACKEND_DIR}"
  ARCHITOKEN_PROFILE=production \
  ARCHITOKEN_SERVER__HOST="${API_HOST}" \
  ARCHITOKEN_SERVER__PORT="${API_PORT}" \
  ARCHITOKEN_AUTH__JWT_SECRET="${JWT_SECRET}" \
  ARCHITOKEN_AUTH__JWT_ISSUER="${JWT_ISSUER}" \
  ARCHITOKEN_AUTH__JWT_EXPIRY_SECS=3600 \
  ARCHITOKEN_GENERATION__PROVIDER=http_text_to_bim \
  ARCHITOKEN_GENERATION__TEXT_TO_BIM_URL="${FIXTURE_URL}/v1/generate/text-to-bim" \
  ARCHITOKEN_GENERATION__API_KEY_ENV= \
  ARCHITOKEN_GENERATION__TIMEOUT_SECS=30 \
  ARCHITOKEN_OBSERVABILITY__OTLP_ENDPOINT=http://127.0.0.1:4317 \
  ARCHITOKEN_OBSERVABILITY__SERVICE_NAME=architoken-gateway-production-smoke \
  ARCHITOKEN_OBSERVABILITY__LOG_LEVEL=info \
  ARCHITOKEN_OBSERVABILITY__PROMETHEUS_PORT="${PROMETHEUS_PORT}" \
  ARCHITOKEN_PHASE8_MAX_REQUEST_BODY_BYTES=16777216 \
  ARCHITOKEN_PHASE8_MAX_UPLOAD_BYTES=5368709120 \
  ARCHITOKEN_PHASE8_API_RPS_LIMIT=10000 \
  ARCHITOKEN_PHASE8_TENANT_RPS_LIMIT=1000 \
  ARCHITOKEN_PHASE8_ACTOR_RPS_LIMIT=100 \
  ARCHITOKEN_PHASE8_MAX_CONCURRENT_UPLOADS_PER_TENANT=32 \
  ARCHITOKEN_PHASE8_MAX_CONCURRENT_CONVERSION_JOBS_PER_TENANT=16 \
  ARCHITOKEN_PHASE8_DB_POOL_MAX_CONNECTIONS=32 \
  ARCHITOKEN_PHASE8_PGBOUNCER_REQUIRED=true \
  ARCHITOKEN_PHASE8_OBJECT_STORE_REQUIRED=true \
  ARCHITOKEN_PHASE8_OTEL_REQUIRED=true \
  ARCHITOKEN_PRODUCTION_CONTRACT_SMOKE=1 \
  DATABASE_URL="${DATABASE_URL}" \
  S3_ENDPOINT="${FIXTURE_URL}" \
  S3_ACCESS_KEY=production-smoke-access \
  S3_SECRET_KEY=production-smoke-secret \
  S3_BUCKET=architoken-assets \
  NATS_URL=nats://127.0.0.1:4222 \
  TEMPORAL_ADDRESS=127.0.0.1:7233 \
  OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4317 \
  "${GATEWAY_BIN}"
) >/tmp/architoken-production-smoke-gateway.log 2>&1 &
gateway_pid="$!"

if ! wait_for_http "${BASE_URL}/healthz" "production gateway"; then
  tail -n 120 /tmp/architoken-production-smoke-gateway.log >&2 || true
  exit 1
fi
if ! wait_for_http "${BASE_URL}/readyz" "production gateway readiness"; then
  tail -n 120 /tmp/architoken-production-smoke-gateway.log >&2 || true
  exit 1
fi

BASE_URL="${BASE_URL}" \
ARCHITOKEN_SMOKE_JWT_SECRET="${JWT_SECRET}" \
ARCHITOKEN_SMOKE_JWT_ISSUER="${JWT_ISSUER}" \
ARCHITOKEN_PRODUCTION_CONTRACT_SMOKE=1 \
"${SCRIPT_DIR}/smoke-all.sh"

printf 'local production smoke passed for %s\n' "${BASE_URL}"
