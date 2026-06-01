#!/usr/bin/env bash
set -euo pipefail

trap 'printf "smoke-data-services failed at line %s\n" "${LINENO}" >&2' ERR

required="${ARCHITOKEN_DATA_SERVICES_REQUIRED:-0}"

truthy() {
  case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

skip_or_fail() {
  local label="$1"
  local reason="$2"
  if truthy "${required}"; then
    printf '%s missing: %s\n' "${label}" "${reason}" >&2
    exit 1
  fi
  printf '%s skipped: %s\n' "${label}" "${reason}"
}

first_env() {
  local key
  for key in "$@"; do
    local value="${!key:-}"
    if [[ -n "${value//[[:space:]]/}" ]]; then
      printf '%s' "${value}"
      return 0
    fi
  done
  return 1
}

url_host=""
url_port=""
url_path=""
url_user=""
url_password=""

parse_url() {
  local url="$1"
  local default_port="$2"
  local rest authority hostport auth

  if [[ "${url}" != *"://"* ]]; then
    printf 'invalid URL without scheme: %s\n' "${url}" >&2
    return 1
  fi

  rest="${url#*://}"
  authority="${rest%%/*}"
  if [[ "${rest}" == "${authority}" ]]; then
    url_path=""
  else
    url_path="${rest#*/}"
    url_path="${url_path%%\?*}"
    url_path="${url_path%%#*}"
  fi

  auth=""
  hostport="${authority}"
  if [[ "${authority}" == *"@"* ]]; then
    auth="${authority%@*}"
    hostport="${authority#*@}"
  fi

  url_user=""
  url_password=""
  if [[ -n "${auth}" ]]; then
    if [[ "${auth}" == *":"* ]]; then
      url_user="${auth%%:*}"
      url_password="${auth#*:}"
    else
      url_password="${auth}"
    fi
  fi

  if [[ "${hostport}" == *":"* ]]; then
    url_host="${hostport%%:*}"
    url_port="${hostport##*:}"
  else
    url_host="${hostport}"
    url_port="${default_port}"
  fi

  if [[ -z "${url_host}" || -z "${url_port}" ]]; then
    printf 'invalid URL authority: %s\n' "${url}" >&2
    return 1
  fi
}

resp_command() {
  printf '*%s\r\n' "$#"
  local arg
  for arg in "$@"; do
    printf '$%s\r\n%s\r\n' "${#arg}" "${arg}"
  done
}

read_resp_line() {
  local line
  IFS= read -r -u 3 line
  printf '%s' "${line%$'\r'}"
}

valkey_call() {
  resp_command "$@" >&3
  read_resp_line
}

expect_valkey_ok() {
  local command="$1"
  local reply="$2"
  if [[ "${reply}" == "+OK" || "${reply}" == "+PONG" || "${reply}" == :* ]]; then
    return 0
  fi
  printf 'Valkey %s unexpected reply: %s\n' "${command}" "${reply}" >&2
  return 1
}

smoke_valkey() {
  local cache_url="${ARCHITOKEN_CACHE__URL:-${VALKEY_URL:-${REDIS_URL:-redis://127.0.0.1:6381/0}}}"
  local key value reply header
  parse_url "${cache_url}" 6379

  exec 3<>"/dev/tcp/${url_host}/${url_port}"
  if [[ -n "${url_password}" ]]; then
    if [[ -n "${url_user}" ]]; then
      expect_valkey_ok "AUTH" "$(valkey_call AUTH "${url_user}" "${url_password}")"
    else
      expect_valkey_ok "AUTH" "$(valkey_call AUTH "${url_password}")"
    fi
  fi
  if [[ -n "${url_path}" ]]; then
    expect_valkey_ok "SELECT" "$(valkey_call SELECT "${url_path}")"
  fi

  expect_valkey_ok "PING" "$(valkey_call PING)"
  key="architoken:smoke:data-services:$$:$(date +%s)"
  value="ok-${key}"
  expect_valkey_ok "SET" "$(valkey_call SET "${key}" "${value}" EX 60)"
  resp_command GET "${key}" >&3
  header="$(read_resp_line)"
  if [[ "${header}" != "\$${#value}" ]]; then
    printf 'Valkey GET unexpected bulk header: %s\n' "${header}" >&2
    return 1
  fi
  reply="$(read_resp_line)"
  if [[ "${reply}" != "${value}" ]]; then
    printf 'Valkey GET unexpected value: %s\n' "${reply}" >&2
    return 1
  fi
  expect_valkey_ok "DEL" "$(valkey_call DEL "${key}")"
  exec 3>&-
  exec 3<&-
  printf 'valkey smoke passed for %s:%s\n' "${url_host}" "${url_port}"
}

http_status_smoke() {
  local label="$1"
  local url="$2"
  local status
  status="$(curl -sS -o /dev/null -w '%{http_code}' "${url}" || true)"
  if [[ "${status}" =~ ^[0-9][0-9][0-9]$ && "${status}" != "000" && "${status}" -lt 500 ]]; then
    printf '%s smoke passed for %s status=%s\n' "${label}" "${url}" "${status}"
    return 0
  fi
  printf '%s smoke failed for %s status=%s\n' "${label}" "${url}" "${status}" >&2
  return 1
}

http_success_smoke() {
  local label="$1"
  local url="$2"
  curl -fsS "${url}" >/dev/null
  printf '%s smoke passed for %s\n' "${label}" "${url}"
}

smoke_s3() {
  local endpoint="${S3_ENDPOINT:-}"
  if [[ -z "${endpoint//[[:space:]]/}" ]]; then
    skip_or_fail "s3-object-store" "S3_ENDPOINT is not configured"
    return 0
  fi
  for key in S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET; do
    if [[ -z "${!key:-}" ]]; then
      printf 's3-object-store missing: %s is required when S3_ENDPOINT is set\n' "${key}" >&2
      return 1
    fi
  done
  http_status_smoke "s3-object-store" "${endpoint%/}/"
}

smoke_qdrant() {
  local endpoint
  if ! endpoint="$(first_env ARCHITOKEN_VECTOR__URL QDRANT_URL)"; then
    skip_or_fail "qdrant" "ARCHITOKEN_VECTOR__URL or QDRANT_URL is not configured"
    return 0
  fi
  http_success_smoke "qdrant" "${endpoint%/}/healthz" \
    || http_success_smoke "qdrant" "${endpoint%/}/readyz"
  local collection="architoken_smoke_$$"
  curl -fsS -X PUT "${endpoint%/}/collections/${collection}" \
    -H 'Content-Type: application/json' \
    --data '{"vectors":{"size":4,"distance":"Cosine"}}' >/dev/null
  curl -fsS -X PUT "${endpoint%/}/collections/${collection}/points?wait=true" \
    -H 'Content-Type: application/json' \
    --data '{"points":[{"id":1,"vector":[0.1,0.2,0.3,0.4],"payload":{"smoke":true,"source":"architoken-data-services"}}]}' >/dev/null
  local retrieved
  retrieved="$(curl -fsS -X POST "${endpoint%/}/collections/${collection}/points" \
    -H 'Content-Type: application/json' \
    --data '{"ids":[1],"with_payload":true,"with_vector":false}')"
  if [[ "${retrieved}" != *'"source":"architoken-data-services"'* ]]; then
    curl -fsS -X DELETE "${endpoint%/}/collections/${collection}" >/dev/null || true
    printf 'qdrant smoke failed: inserted point was not retrieved\n' >&2
    return 1
  fi
  curl -fsS -X DELETE "${endpoint%/}/collections/${collection}" >/dev/null
  printf 'qdrant write/read smoke passed for collection=%s\n' "${collection}"
}

smoke_nats() {
  local nats_url monitor_url
  if ! nats_url="$(first_env NATS_URL ARCHITOKEN_EVENT__URL)"; then
    skip_or_fail "nats" "NATS_URL or ARCHITOKEN_EVENT__URL is not configured"
    return 0
  fi
  if monitor_url="$(first_env NATS_MONITOR_URL ARCHITOKEN_NATS_MONITOR_URL)"; then
    http_success_smoke "nats" "${monitor_url%/}/healthz"
    return 0
  fi
  parse_url "${nats_url}" 4222
  http_success_smoke "nats" "http://${url_host}:8222/healthz"
  exec 4<>"/dev/tcp/${url_host}/${url_port}"
  local info payload connect line
  IFS= read -r -u 4 info
  if [[ "${info}" != INFO* ]]; then
    printf 'nats smoke failed: expected INFO line, got %s\n' "${info}" >&2
    return 1
  fi
  connect='{"verbose":false,"pedantic":false,"name":"architoken-data-services-smoke"'
  if [[ -n "${url_password}" ]]; then
    if [[ -n "${url_user}" ]]; then
      connect="${connect},\"user\":\"${url_user}\",\"pass\":\"${url_password}\""
    else
      connect="${connect},\"auth_token\":\"${url_password}\""
    fi
  fi
  connect="${connect}}"
  payload='{"smoke":true,"source":"architoken-data-services"}'
  printf 'CONNECT %s\r\nPUB architoken.smoke.data_services %s\r\n%s\r\nPING\r\n' \
    "${connect}" "${#payload}" "${payload}" >&4
  for _ in $(seq 1 5); do
    IFS= read -r -u 4 line
    line="${line%$'\r'}"
    if [[ "${line}" == "PONG" ]]; then
      exec 4>&-
      exec 4<&-
      printf 'nats publish smoke passed for %s:%s\n' "${url_host}" "${url_port}"
      return 0
    fi
  done
  printf 'nats smoke failed: PONG not received after publish\n' >&2
  return 1
}

smoke_clickhouse() {
  local endpoint
  if ! endpoint="$(first_env ARCHITOKEN_TIMESERIES__URL ARCHITOKEN_TIME_SERIES__URL ARCHITOKEN_ANALYTICS__URL CLICKHOUSE_URL)"; then
    skip_or_fail "clickhouse" "time-series or analytics external URL is not configured"
    return 0
  fi
  local body
  body="$(curl -fsS "${endpoint%/}/ping")"
  if [[ "${body}" != "Ok." ]]; then
    printf 'clickhouse smoke failed: unexpected /ping response %s\n' "${body}" >&2
    return 1
  fi
  printf 'clickhouse smoke passed for %s\n' "${endpoint%/}/ping"
  local database="${CLICKHOUSE_DB:-architoken}"
  local table="smoke_data_services_$$"
  local auth_args=()
  if [[ -n "${CLICKHOUSE_USER:-}" ]]; then
    auth_args=(-u "${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD:-}")
  fi
  curl -fsS "${auth_args[@]}" --data-binary "CREATE DATABASE IF NOT EXISTS ${database}" "${endpoint%/}/" >/dev/null
  curl -fsS "${auth_args[@]}" --data-binary "CREATE TABLE IF NOT EXISTS ${database}.${table} (id UInt64, value String) ENGINE=Memory" "${endpoint%/}/" >/dev/null
  curl -fsS "${auth_args[@]}" --data-binary "INSERT INTO ${database}.${table} FORMAT Values (1, 'ok')" "${endpoint%/}/" >/dev/null
  local value
  value="$(curl -fsS "${auth_args[@]}" --data-binary "SELECT value FROM ${database}.${table} WHERE id = 1 FORMAT TabSeparatedRaw" "${endpoint%/}/")"
  curl -fsS "${auth_args[@]}" --data-binary "DROP TABLE IF EXISTS ${database}.${table}" "${endpoint%/}/" >/dev/null
  if [[ "${value}" != "ok" ]]; then
    printf 'clickhouse smoke failed: expected ok, got %s\n' "${value}" >&2
    return 1
  fi
  printf 'clickhouse write/read smoke passed for table=%s.%s\n' "${database}" "${table}"
}

smoke_external_graph() {
  local endpoint
  if ! endpoint="$(first_env ARCHITOKEN_GRAPH__URL)"; then
    skip_or_fail "external-graph" "ARCHITOKEN_GRAPH__URL is not configured"
    return 0
  fi
  http_status_smoke "external-graph" "${endpoint%/}/"
}

smoke_valkey
smoke_s3
smoke_qdrant
smoke_nats
smoke_clickhouse
smoke_external_graph

printf 'data service smoke completed\n'
