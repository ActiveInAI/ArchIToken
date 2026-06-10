#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/04-backend"
AGENT_DIR="${BACKEND_DIR}/agent-orchestrator"
FRONTEND_DIR="${ROOT_DIR}/03-frontend"
DATA_COMPOSE="${ROOT_DIR}/05-infra/docker/compose.data.yml"
SIDECAR_COMPOSE="${ROOT_DIR}/05-infra/docker/docker-compose.yml"
RUNTIME_DIR="${ROOT_DIR}/.runtime"
PID_DIR="${RUNTIME_DIR}/pids"
LOG_DIR="${RUNTIME_DIR}/logs"

PUBLIC_HOST="${ARCHITOKEN_PUBLIC_HOST:-192.168.1.100}"
GATEWAY_HOST="${ARCHITOKEN_GATEWAY_HOST:-0.0.0.0}"
GATEWAY_PORT="${ARCHITOKEN_GATEWAY_PORT:-18080}"
GATEWAY_PROMETHEUS_PORT="${ARCHITOKEN_GATEWAY_PROMETHEUS_PORT:-19090}"
DB_MANAGER_HOST="${ARCHITOKEN_DB_MANAGER_HOST:-127.0.0.1}"
DB_MANAGER_PORT="${ARCHITOKEN_DB_MANAGER_PORT:-8751}"
AGENT_HOST="${ARCHITOKEN_AGENT_HOST:-0.0.0.0}"
AGENT_PORT="${ARCHITOKEN_AGENT_PORT:-7001}"
FRONTEND_HOST="${ARCHITOKEN_FRONTEND_HOST:-0.0.0.0}"
FRONTEND_PORT="${ARCHITOKEN_FRONTEND_PORT:-3000}"
DATABASE_URL="${ARCHITOKEN_DATABASE_URL:-postgres://architoken:architoken_dev_only@127.0.0.1:5433/architoken}"
VALKEY_URL="${ARCHITOKEN_VALKEY_URL:-redis://127.0.0.1:6381/0}"
S3_ENDPOINT="${ARCHITOKEN_S3_ENDPOINT:-http://127.0.0.1:8333}"
S3_BUCKET="${ARCHITOKEN_S3_BUCKET:-architoken-assets}"
NATS_URL="${ARCHITOKEN_NATS_URL:-nats://127.0.0.1:4222}"
NATS_MONITOR_URL="${ARCHITOKEN_NATS_MONITOR_URL:-http://127.0.0.1:8222}"
QDRANT_URL="${ARCHITOKEN_QDRANT_URL:-http://127.0.0.1:6333}"
QDRANT_COLLECTION="${ARCHITOKEN_QDRANT_COLLECTION:-architoken_rag}"
CLICKHOUSE_URL="${ARCHITOKEN_CLICKHOUSE_URL:-http://127.0.0.1:8123}"
CLICKHOUSE_DB="${ARCHITOKEN_CLICKHOUSE_DB:-architoken}"
CLICKHOUSE_USER="${ARCHITOKEN_CLICKHOUSE_USER:-architoken}"
CLICKHOUSE_PASSWORD="${ARCHITOKEN_CLICKHOUSE_PASSWORD:-architoken_dev_only}"
OTLP_ENDPOINT="${ARCHITOKEN_OTLP_ENDPOINT:-http://127.0.0.1:4317}"
SIDECAR_PROFILES="${ARCHITOKEN_SIDECAR_PROFILES:-office,pdf,native-workbench}"
SKIP_UPDATE="${ARCHITOKEN_SKIP_UPDATE:-0}"
SKIP_BUILD="${ARCHITOKEN_SKIP_BUILD:-0}"
SKIP_DEPS="${ARCHITOKEN_SKIP_DEPS:-0}"

mkdir -p "${PID_DIR}" "${LOG_DIR}"

usage() {
  cat <<'USAGE'
Usage:
  scripts/architoken-local.sh up        Update, build, and start the local full stack
  scripts/architoken-local.sh core      Start only data + gateway + agent + frontend
  scripts/architoken-local.sh update    Pull latest code and refresh dependencies
  scripts/architoken-local.sh restart   Stop local app processes, then run up
  scripts/architoken-local.sh stop      Stop local app processes
  scripts/architoken-local.sh down      Stop local app processes and docker data/sidecars
  scripts/architoken-local.sh status    Show process, container, and health status
  scripts/architoken-local.sh logs      Tail gateway, database manager, agent, and frontend logs
  scripts/architoken-local.sh smoke     Run backend smoke checks against the gateway

Useful env overrides:
  ARCHITOKEN_PUBLIC_HOST=192.168.1.100
  ARCHITOKEN_GATEWAY_PORT=18080
  ARCHITOKEN_DB_MANAGER_PORT=8751
  ARCHITOKEN_FRONTEND_PORT=3000
  ARCHITOKEN_SKIP_UPDATE=1
  ARCHITOKEN_SKIP_BUILD=1
  ARCHITOKEN_SKIP_DEPS=1
  ARCHITOKEN_SIDECAR_PROFILES=office,pdf,native-workbench
USAGE
}

info() {
  printf '[architoken-local] %s\n' "$*"
}

die() {
  printf '[architoken-local] ERROR: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

pid_file() {
  printf '%s/%s.pid' "${PID_DIR}" "$1"
}

log_file() {
  printf '%s/%s.log' "${LOG_DIR}" "$1"
}

pid_running() {
  local pid="$1"
  [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1
}

pid_from_file() {
  local file
  file="$(pid_file "$1")"
  [[ -f "${file}" ]] && cat "${file}" || true
}

port_pid() {
  local port="$1"
  local output=""
  output="$(ss -H -tlnp "sport = :${port}" 2>/dev/null || true)"
  if [[ "${output}" =~ pid=([0-9]+) ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  port_pid_from_proc "${port}"
}

port_pid_from_proc() {
  local port="$1"
  local port_hex
  printf -v port_hex '%04X' "${port}"

  local table sl local_addr remote_addr state txrx trtm retrnsmt uid timeout inode rest
  for table in /proc/net/tcp /proc/net/tcp6; do
    [[ -r "${table}" ]] || continue
    while read -r sl local_addr remote_addr state txrx trtm retrnsmt uid timeout inode rest; do
      [[ "${sl}" == "sl" ]] && continue
      [[ "${state}" == "0A" ]] || continue
      [[ "${local_addr##*:}" == "${port_hex}" ]] || continue
      pid_from_socket_inode "${inode}" && return 0
    done <"${table}"
  done
}

pid_from_socket_inode() {
  local inode="$1"
  local fd target pid
  for fd in /proc/[0-9]*/fd/*; do
    target="$(readlink "${fd}" 2>/dev/null || true)"
    [[ "${target}" == "socket:[${inode}]" ]] || continue
    pid="${fd#/proc/}"
    printf '%s\n' "${pid%%/*}"
    return 0
  done
  return 1
}

pid_cwd() {
  local pid="$1"
  pwdx "${pid}" 2>/dev/null | sed 's/^[^:]*: //' || true
}

service_url() {
  case "$1" in
    gateway) printf 'http://127.0.0.1:%s/healthz' "${GATEWAY_PORT}" ;;
    db-manager) printf 'http://127.0.0.1:%s/readyz' "${DB_MANAGER_PORT}" ;;
    agent) printf 'http://127.0.0.1:%s/healthz' "${AGENT_PORT}" ;;
    frontend) printf 'http://127.0.0.1:%s' "${FRONTEND_PORT}" ;;
    *) return 1 ;;
  esac
}

wait_for_http() {
  local name="$1"
  local url="$2"
  local attempts="${3:-90}"

  for _ in $(seq 1 "${attempts}"); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      info "${name} ready: ${url}"
      return 0
    fi
    sleep 1
  done

  info "${name} did not become ready: ${url}"
  return 1
}

adopt_or_check_port() {
  local name="$1"
  local port="$2"
  local expected_cwd="$3"
  local pid
  pid="$(port_pid "${port}")"

  if [[ -z "${pid}" ]]; then
    return 0
  fi

  local cwd
  cwd="$(pid_cwd "${pid}")"
  if [[ "${cwd}" == "${expected_cwd}"* ]]; then
    printf '%s\n' "${pid}" >"$(pid_file "${name}")"
    info "${name} already running on port ${port}, adopted pid ${pid}"
    return 1
  fi

  die "port ${port} is already used by pid ${pid} at ${cwd:-unknown}; stop it or change ${name} port"
}

stop_pid_file() {
  local name="$1"
  local file pid
  file="$(pid_file "${name}")"
  pid="$(pid_from_file "${name}")"

  if ! pid_running "${pid}"; then
    rm -f "${file}"
    return 0
  fi

  info "stopping ${name} pid ${pid}"
  kill "${pid}" >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do
    if ! pid_running "${pid}"; then
      rm -f "${file}"
      return 0
    fi
    sleep 1
  done
  kill -TERM "-${pid}" >/dev/null 2>&1 || true
  kill -KILL "${pid}" >/dev/null 2>&1 || true
  rm -f "${file}"
}

start_background() {
  local name="$1"
  local cwd="$2"
  shift 2
  local pid
  pid="$(pid_from_file "${name}")"

  if pid_running "${pid}"; then
    info "${name} already running with pid ${pid}"
    return 0
  fi

  info "starting ${name}; log: $(log_file "${name}")"
  (
    cd "${cwd}"
    setsid "$@" >"$(log_file "${name}")" 2>&1 &
    printf '%s\n' "$!" >"$(pid_file "${name}")"
  )
}

update_repo() {
  if [[ "${SKIP_UPDATE}" == "1" ]]; then
    info "update skipped by ARCHITOKEN_SKIP_UPDATE=1"
    return 0
  fi

  if ! git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    info "not a git checkout; update skipped"
    return 0
  fi

  local upstream
  upstream="$(git -C "${ROOT_DIR}" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
  if [[ -z "${upstream}" ]]; then
    info "no upstream branch configured; update skipped"
    return 0
  fi

  info "updating ${upstream} with --ff-only --autostash"
  if ! git -C "${ROOT_DIR}" pull --ff-only --autostash; then
    info "git update failed; continuing with the current checkout"
  fi
}

install_deps() {
  if [[ "${SKIP_DEPS}" == "1" ]]; then
    info "dependency refresh skipped by ARCHITOKEN_SKIP_DEPS=1"
    return 0
  fi

  need_cmd bun
  need_cmd uv

  if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
    info "installing frontend dependencies"
    (cd "${FRONTEND_DIR}" && bun install)
  fi

  if [[ ! -x "${AGENT_DIR}/.venv/bin/architoken-agent" ]]; then
    info "syncing agent virtualenv"
    (cd "${AGENT_DIR}" && uv sync)
  fi
}

build_backend() {
  if [[ "${SKIP_BUILD}" == "1" ]]; then
    info "backend build skipped by ARCHITOKEN_SKIP_BUILD=1"
    return 0
  fi

  need_cmd cargo
  info "building Rust gateway"
  cargo build \
    --manifest-path "${BACKEND_DIR}/Cargo.toml" \
    -p architoken-harness-core \
    --bin architoken-gateway
  info "building Rust database manager"
  cargo build \
    --manifest-path "${BACKEND_DIR}/Cargo.toml" \
    -p architoken-database-manager \
    --bin architoken-db-manager
}

start_data() {
  need_cmd docker
  info "starting docker data services"
  docker compose -f "${DATA_COMPOSE}" --profile split-data up -d
}

start_sidecars() {
  need_cmd docker

  if [[ -z "${SIDECAR_PROFILES}" || "${SIDECAR_PROFILES}" == "none" ]]; then
    info "sidecars skipped"
    return 0
  fi

  local compose_cmd services profiles profile
  compose_cmd=(docker compose -f "${SIDECAR_COMPOSE}")
  services=()

  IFS=',' read -r -a profiles <<<"${SIDECAR_PROFILES}"
  for profile in "${profiles[@]}"; do
    profile="$(printf '%s' "${profile}" | xargs)"
    [[ -z "${profile}" ]] && continue
    compose_cmd+=(--profile "${profile}")
    case "${profile}" in
      office)
        services+=(collabora-online onlyoffice-documentserver)
        ;;
      pdf)
        services+=(stirling-pdf)
        ;;
      native-workbench)
        services+=(engineering-native-workbench)
        ;;
      code-editor)
        services+=(code-server)
        ;;
      *)
        info "unknown sidecar profile ignored: ${profile}"
        ;;
    esac
  done

  if [[ "${#services[@]}" -eq 0 ]]; then
    info "no sidecar services selected"
    return 0
  fi

  info "starting sidecars: ${services[*]}"
  "${compose_cmd[@]}" up -d "${services[@]}"
}

start_gateway() {
  local bin="${BACKEND_DIR}/target/debug/architoken-gateway"
  [[ -x "${bin}" ]] || build_backend
  adopt_or_check_port gateway "${GATEWAY_PORT}" "${BACKEND_DIR}" || return 0

  start_background gateway "${BACKEND_DIR}" env \
    ARCHITOKEN_PROFILE=development \
    ARCHITOKEN_SERVER__HOST="${GATEWAY_HOST}" \
    ARCHITOKEN_SERVER__PORT="${GATEWAY_PORT}" \
    ARCHITOKEN_DATABASE__URL="${DATABASE_URL}" \
    DATABASE_URL="${DATABASE_URL}" \
    ARCHITOKEN_DATABASE_AUTO_MIGRATE=true \
    ARCHITOKEN_CACHE__URL="${VALKEY_URL}" \
    S3_ENDPOINT="${S3_ENDPOINT}" \
    S3_PUBLIC_ENDPOINT="${S3_ENDPOINT}" \
    S3_ACCESS_KEY=architoken \
    S3_SECRET_KEY=architoken-secret \
    S3_BUCKET="${S3_BUCKET}" \
    NATS_URL="${NATS_URL}" \
    ARCHITOKEN_EVENT__URL="${NATS_URL}" \
    QDRANT_URL="${QDRANT_URL}" \
    ARCHITOKEN_VECTOR__URL="${QDRANT_URL}" \
    QDRANT_COLLECTION="${QDRANT_COLLECTION}" \
    ARCHITOKEN_VECTOR__COLLECTION="${QDRANT_COLLECTION}" \
    ARCHITOKEN_VECTOR__PROVIDER=qdrant \
    CLICKHOUSE_URL="${CLICKHOUSE_URL}" \
    ARCHITOKEN_TIMESERIES__URL="${CLICKHOUSE_URL}" \
    ARCHITOKEN_ANALYTICS__URL="${CLICKHOUSE_URL}" \
    CLICKHOUSE_DB="${CLICKHOUSE_DB}" \
    CLICKHOUSE_USER="${CLICKHOUSE_USER}" \
    CLICKHOUSE_PASSWORD="${CLICKHOUSE_PASSWORD}" \
    TEMPORAL_ADDRESS="${ARCHITOKEN_TEMPORAL_ADDRESS:-127.0.0.1:7233}" \
    ARCHITOKEN_AGENT_ORCHESTRATOR_URL="http://127.0.0.1:${AGENT_PORT}" \
    ARCHITOKEN_GENERATION__PROVIDER="${ARCHITOKEN_GENERATION_PROVIDER:-local_deterministic}" \
    ARCHITOKEN_OBSERVABILITY__OTLP_ENDPOINT="${OTLP_ENDPOINT}" \
    OTEL_EXPORTER_OTLP_ENDPOINT="${OTLP_ENDPOINT}" \
    ARCHITOKEN_OBSERVABILITY__PROMETHEUS_PORT="${GATEWAY_PROMETHEUS_PORT}" \
    ARCHITOKEN_AUTH__JWT_SECRET="${ARCHITOKEN_AUTH_JWT_SECRET:-development-only-not-for-production}" \
    ARCHITOKEN_AUTH__JWT_ISSUER="${ARCHITOKEN_AUTH_JWT_ISSUER:-architoken-local-dev}" \
    "${bin}"

  wait_for_http gateway "$(service_url gateway)" 120 || {
    tail -n 120 "$(log_file gateway)" >&2 || true
    return 1
  }
}

start_database_manager() {
  local bin="${BACKEND_DIR}/target/debug/architoken-db-manager"
  [[ -x "${bin}" ]] || build_backend
  adopt_or_check_port db-manager "${DB_MANAGER_PORT}" "${BACKEND_DIR}" || return 0

  start_background db-manager "${BACKEND_DIR}" env \
    ARCHITOKEN_DB_MANAGER_ADDR="${DB_MANAGER_HOST}:${DB_MANAGER_PORT}" \
    ARCHITOKEN_DB_MANAGER_POSTGRES_URL="${DATABASE_URL}" \
    ARCHITOKEN_DB_MANAGER_CLICKHOUSE_URL="${CLICKHOUSE_URL}" \
    CLICKHOUSE_DB="${CLICKHOUSE_DB}" \
    CLICKHOUSE_USER="${CLICKHOUSE_USER}" \
    CLICKHOUSE_PASSWORD="${CLICKHOUSE_PASSWORD}" \
    ARCHITOKEN_DB_MANAGER_VALKEY_URL="${VALKEY_URL}" \
    ARCHITOKEN_DB_MANAGER_QDRANT_URL="${QDRANT_URL}" \
    ARCHITOKEN_DB_MANAGER_NATS_MONITOR_URL="${NATS_MONITOR_URL}" \
    ARCHITOKEN_DB_MANAGER_S3_ENDPOINT="${S3_ENDPOINT}" \
    ARCHITOKEN_DB_MANAGER_S3_BUCKET="${S3_BUCKET}" \
    "${bin}"

  wait_for_http db-manager "$(service_url db-manager)" 60 || {
    tail -n 120 "$(log_file db-manager)" >&2 || true
    return 1
  }
}

start_agent() {
  local bin="${AGENT_DIR}/.venv/bin/architoken-agent"
  [[ -x "${bin}" ]] || install_deps
  adopt_or_check_port agent "${AGENT_PORT}" "${AGENT_DIR}" || return 0

  start_background agent "${AGENT_DIR}" env \
    ARCHITOKEN_HOST="${AGENT_HOST}" \
    ARCHITOKEN_PORT="${AGENT_PORT}" \
    ARCHITOKEN_GATEWAY_URL="http://127.0.0.1:${GATEWAY_PORT}" \
    ARCHITOKEN_POSTGRES_URL="postgresql://architoken:architoken_dev_only@127.0.0.1:5433/architoken" \
    ARCHITOKEN_VALKEY_URL="${VALKEY_URL}" \
    QDRANT_URL="${QDRANT_URL}" \
    CLICKHOUSE_URL="${CLICKHOUSE_URL}" \
    ARCHITOKEN_OTLP_ENDPOINT="${OTLP_ENDPOINT}" \
    ARCHITOKEN_OLLAMA_URL="${ARCHITOKEN_OLLAMA_URL:-http://127.0.0.1:11434/v1}" \
    "${bin}"

  wait_for_http agent "$(service_url agent)" 60 || {
    tail -n 120 "$(log_file agent)" >&2 || true
    return 1
  }
}

start_frontend() {
  local next_bin="${FRONTEND_DIR}/node_modules/.bin/next"
  [[ -x "${next_bin}" ]] || install_deps
  adopt_or_check_port frontend "${FRONTEND_PORT}" "${FRONTEND_DIR}" || return 0

  start_background frontend "${FRONTEND_DIR}" env \
    NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL="http://${PUBLIC_HOST}:${GATEWAY_PORT}" \
    NEXT_PUBLIC_API_URL="http://${PUBLIC_HOST}:${GATEWAY_PORT}" \
    ARCHITOKEN_API_BASE_URL="http://127.0.0.1:${GATEWAY_PORT}" \
    ARCHITOKEN_DB_MANAGER_BASE_URL="http://127.0.0.1:${DB_MANAGER_PORT}" \
    ARCHITOKEN_PUBLIC_BASE_URL="http://${PUBLIC_HOST}:${FRONTEND_PORT}" \
    NEXT_PUBLIC_AGENT_URL="http://${PUBLIC_HOST}:${AGENT_PORT}" \
    ARCHITOKEN_ENGINEERING_NATIVE_WORKBENCH_PUBLIC_URL="http://${PUBLIC_HOST}:6090" \
    ARCHITOKEN_ENGINEERING_NATIVE_WORKBENCH_API_URL="http://127.0.0.1:6091" \
    COLLABORA_ONLINE_URL="http://${PUBLIC_HOST}:9980" \
    "${next_bin}" dev --turbopack --hostname "${FRONTEND_HOST}" --port "${FRONTEND_PORT}"

  wait_for_http frontend "$(service_url frontend)" 120 || {
    tail -n 120 "$(log_file frontend)" >&2 || true
    return 1
  }
}

up() {
  local include_sidecars="${1:-1}"
  update_repo
  start_data
  install_deps
  build_backend
  if [[ "${include_sidecars}" == "1" ]]; then
    start_sidecars
  fi
  start_gateway
  start_database_manager
  start_agent
  start_frontend
  status
}

stop_apps() {
  stop_pid_file frontend
  stop_pid_file agent
  stop_pid_file db-manager
  stop_pid_file gateway
}

down_all() {
  stop_apps
  info "stopping docker sidecars"
  docker compose -f "${SIDECAR_COMPOSE}" --profile office --profile pdf --profile native-workbench --profile code-editor down || true
  info "stopping docker data services"
  docker compose -f "${DATA_COMPOSE}" --profile split-data down || true
}

status_line() {
  local name="$1"
  local port="$2"
  local url="$3"
  local pid
  pid="$(pid_from_file "${name}")"
  if ! pid_running "${pid}"; then
    pid="$(port_pid "${port}")"
  fi

  if [[ -n "${pid}" ]] && pid_running "${pid}"; then
    if curl -fsS "${url}" >/dev/null 2>&1; then
      printf '%-10s running pid=%-8s url=%s\n' "${name}" "${pid}" "${url}"
    else
      printf '%-10s running pid=%-8s url=%s not-ready\n' "${name}" "${pid}" "${url}"
    fi
  else
    printf '%-10s stopped url=%s\n' "${name}" "${url}"
  fi
}

status() {
  info "application services"
  status_line gateway "${GATEWAY_PORT}" "$(service_url gateway)"
  status_line db-manager "${DB_MANAGER_PORT}" "$(service_url db-manager)"
  status_line agent "${AGENT_PORT}" "$(service_url agent)"
  status_line frontend "${FRONTEND_PORT}" "http://${PUBLIC_HOST}:${FRONTEND_PORT}"

  info "docker data services"
  if ! docker compose -f "${DATA_COMPOSE}" --profile split-data ps 2>/dev/null; then
    info "docker data status unavailable from this shell"
  fi

  info "main URLs"
  printf 'frontend: http://%s:%s\n' "${PUBLIC_HOST}" "${FRONTEND_PORT}"
  printf 'gateway:  http://%s:%s\n' "${PUBLIC_HOST}" "${GATEWAY_PORT}"
  printf 'database: http://%s:%s/app/database-manager\n' "${PUBLIC_HOST}" "${FRONTEND_PORT}"
  printf 'db api:   http://127.0.0.1:%s/api/database-manager/inventory\n' "${DB_MANAGER_PORT}"
  printf 'agent:    http://%s:%s\n' "${PUBLIC_HOST}" "${AGENT_PORT}"
}

logs() {
  local target="${1:-all}"
  case "${target}" in
    all)
      tail -n 80 -F "$(log_file gateway)" "$(log_file db-manager)" "$(log_file agent)" "$(log_file frontend)"
      ;;
    gateway|db-manager|agent|frontend)
      tail -n 120 -F "$(log_file "${target}")"
      ;;
    data)
      docker compose -f "${DATA_COMPOSE}" --profile split-data logs -f --tail=120
      ;;
    sidecars)
      docker compose -f "${SIDECAR_COMPOSE}" --profile office --profile pdf --profile native-workbench logs -f --tail=120
      ;;
    *)
      die "unknown log target: ${target}"
      ;;
  esac
}

smoke() {
  wait_for_http gateway "$(service_url gateway)" 10
  wait_for_http db-manager "$(service_url db-manager)" 10
  (
    cd "${BACKEND_DIR}"
    BASE_URL="http://127.0.0.1:${GATEWAY_PORT}" \
    ARCHITOKEN_API_BASE_URL="http://127.0.0.1:${GATEWAY_PORT}" \
    ARCHITOKEN_SMOKE_JWT_SECRET="${ARCHITOKEN_AUTH_JWT_SECRET:-development-only-not-for-production}" \
    ARCHITOKEN_SMOKE_JWT_ISSUER="${ARCHITOKEN_AUTH_JWT_ISSUER:-architoken-local-dev}" \
    QDRANT_URL="${QDRANT_URL}" \
    CLICKHOUSE_URL="${CLICKHOUSE_URL}" \
    CLICKHOUSE_DB="${CLICKHOUSE_DB}" \
    CLICKHOUSE_USER="${CLICKHOUSE_USER}" \
    CLICKHOUSE_PASSWORD="${CLICKHOUSE_PASSWORD}" \
    ./scripts/smoke-health.sh
  )
  curl -fsS "http://127.0.0.1:${DB_MANAGER_PORT}/api/database-manager/inventory" >/dev/null
}

main() {
  local cmd="${1:-up}"
  shift || true

  case "${cmd}" in
    up|start)
      up 1
      ;;
    core)
      SIDECAR_PROFILES=none up 0
      ;;
    update)
      update_repo
      install_deps
      build_backend
      ;;
    restart)
      stop_apps
      up 1
      ;;
    stop)
      stop_apps
      ;;
    down)
      down_all
      ;;
    status)
      status
      ;;
    logs)
      logs "${1:-all}"
      ;;
    smoke)
      smoke
      ;;
    help|-h|--help)
      usage
      ;;
    *)
      usage
      die "unknown command: ${cmd}"
      ;;
  esac
}

main "$@"
