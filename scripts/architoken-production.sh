#!/usr/bin/env bash
# architoken-production.sh — 本机生产栈（与开发栈并行，互不干扰）
#
# 组件:
#   pgbouncer       127.0.0.1:6432  (session 模式, 低权角色 architoken_app)
#   auth-inbox      127.0.0.1:18025 (邮件 webhook 收件箱 → .runtime/auth-inbox.log)
#   gateway(prod)   0.0.0.0:18090   (ARCHITOKEN_PROFILE=production, 全套 Phase8 硬化)
#   frontend(prod)  0.0.0.0:3001    (next build 产物 .next-prod, API 指向 18090)
#
# 与开发栈的关系: 开发栈(18080/3000, dev profile)继续服务热迭代;
# 生产栈用低权数据库角色 + 强制 JWT, 共享同一 Postgres 数据。
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/04-backend"
FRONTEND_DIR="${ROOT_DIR}/03-frontend"
RUNTIME_DIR="${ROOT_DIR}/.runtime"
PID_DIR="${RUNTIME_DIR}/pids"
LOG_DIR="${RUNTIME_DIR}/logs"
ENV_FILE="${RUNTIME_DIR}/production.env"

PUBLIC_HOST="${ARCHITOKEN_PUBLIC_HOST:-192.168.1.100}"
PROD_GATEWAY_PORT=18090
PROD_FRONTEND_PORT=3001
AUTH_INBOX_PORT=18025

mkdir -p "${PID_DIR}" "${LOG_DIR}"

info() { printf '[architoken-production] %s\n' "$*"; }
die() { printf '[architoken-production] ERROR: %s\n' "$*" >&2; exit 1; }

ensure_secrets() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    info "生成生产密钥 → ${ENV_FILE}"
    local jwt_secret pepper inbox_token
    jwt_secret="$(openssl rand -hex 32)"
    pepper="$(openssl rand -hex 32)"
    inbox_token="$(openssl rand -hex 16)"
    cat > "${ENV_FILE}" <<EOF
ARCHITOKEN_PROD_JWT_SECRET=${jwt_secret}
ARCHITOKEN_PROD_PASSWORD_PEPPER=${pepper}
ARCHITOKEN_PROD_INBOX_TOKEN=${inbox_token}
EOF
    chmod 600 "${ENV_FILE}"
  fi
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  [[ -f "${RUNTIME_DIR}/app-db-password" ]] || die "缺少 ${RUNTIME_DIR}/app-db-password（先创建 architoken_app 角色）"
  APP_DB_PASSWORD="$(cat "${RUNTIME_DIR}/app-db-password")"
}

start_pgbouncer() {
  if docker ps --format '{{.Names}}' | grep -q '^architoken-pgbouncer$'; then
    info "pgbouncer 已在运行"
    return 0
  fi
  docker rm -f architoken-pgbouncer >/dev/null 2>&1 || true
  docker run -d --name architoken-pgbouncer --restart unless-stopped \
    --network host \
    -e DB_HOST=127.0.0.1 -e DB_PORT=5433 \
    -e DB_USER=architoken_app -e DB_PASSWORD="${APP_DB_PASSWORD}" \
    -e DB_NAME=architoken \
    -e POOL_MODE=session -e MAX_CLIENT_CONN=200 -e DEFAULT_POOL_SIZE=25 \
    -e LISTEN_PORT=6432 -e AUTH_TYPE=scram-sha-256 \
    edoburu/pgbouncer:latest >/dev/null
  info "pgbouncer 已启动 127.0.0.1:6432"
}

start_auth_inbox() {
  if [[ -f "${PID_DIR}/auth-inbox.pid" ]] && kill -0 "$(cat "${PID_DIR}/auth-inbox.pid")" 2>/dev/null; then
    info "auth-inbox 已在运行"
    return 0
  fi
  nohup python3 - "${AUTH_INBOX_PORT}" "${RUNTIME_DIR}/auth-inbox.log" "${ARCHITOKEN_PROD_INBOX_TOKEN}" \
    > "${LOG_DIR}/auth-inbox.log" 2>&1 <<'PYEOF' &
import http.server, json, sys, datetime
port, log_path, token = int(sys.argv[1]), sys.argv[2], sys.argv[3]
class Handler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        auth = self.headers.get("Authorization", "")
        if auth != f"Bearer {token}":
            self.send_response(401); self.end_headers(); return
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        try:
            payload = json.loads(body)
        except Exception:
            payload = {"raw": body.decode("utf-8", "replace")}
        payload["receivedAt"] = datetime.datetime.utcnow().isoformat() + "Z"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status":"sent","messageId":"inbox-local"}')
    def log_message(self, *args):
        pass
http.server.HTTPServer(("127.0.0.1", port), Handler).serve_forever()
PYEOF
  echo $! > "${PID_DIR}/auth-inbox.pid"
  info "auth-inbox 已启动 127.0.0.1:${AUTH_INBOX_PORT}（验证码落 ${RUNTIME_DIR}/auth-inbox.log）"
}

start_gateway() {
  if [[ -f "${PID_DIR}/gateway-prod.pid" ]] && kill -0 "$(cat "${PID_DIR}/gateway-prod.pid")" 2>/dev/null; then
    info "生产网关已在运行"
    return 0
  fi
  local bin="${BACKEND_DIR}/target/debug/architoken-gateway"
  [[ -x "${bin}" ]] || die "缺少网关二进制: ${bin}（先 cargo build）"
  ( cd "${BACKEND_DIR}" && nohup env \
    ARCHITOKEN_PROFILE=production \
    ARCHITOKEN_SERVER__HOST=0.0.0.0 \
    ARCHITOKEN_SERVER__PORT="${PROD_GATEWAY_PORT}" \
    ARCHITOKEN_DATABASE__URL="postgres://architoken_app:${APP_DB_PASSWORD}@127.0.0.1:6432/architoken" \
    DATABASE_URL="postgres://architoken_app:${APP_DB_PASSWORD}@127.0.0.1:6432/architoken" \
    ARCHITOKEN_DATABASE_ADMIN_URL="postgres://architoken:architoken_dev_only@127.0.0.1:5433/architoken" \
    ARCHITOKEN_DATABASE_AUTO_MIGRATE=true \
    ARCHITOKEN_CACHE__URL="redis://127.0.0.1:6381/0" \
    S3_ENDPOINT="http://127.0.0.1:8333" S3_PUBLIC_ENDPOINT="http://127.0.0.1:8333" \
    S3_ACCESS_KEY=architoken S3_SECRET_KEY=architoken-secret S3_BUCKET=architoken-assets \
    NATS_URL="nats://127.0.0.1:4222" ARCHITOKEN_EVENT__URL="nats://127.0.0.1:4222" \
    QDRANT_URL="http://127.0.0.1:6333" ARCHITOKEN_VECTOR__URL="http://127.0.0.1:6333" \
    ARCHITOKEN_VECTOR__COLLECTION="architoken_rag" ARCHITOKEN_VECTOR__PROVIDER=qdrant \
    CLICKHOUSE_URL="http://127.0.0.1:8123" ARCHITOKEN_TIMESERIES__URL="http://127.0.0.1:8123" \
    ARCHITOKEN_ANALYTICS__URL="http://127.0.0.1:8123" \
    CLICKHOUSE_DB=architoken CLICKHOUSE_USER=architoken CLICKHOUSE_PASSWORD=architoken_dev_only \
    ARCHITOKEN_OBSERVABILITY__OTLP_ENDPOINT="http://127.0.0.1:4317" \
    ARCHITOKEN_OBSERVABILITY__PROMETHEUS_PORT=19091 \
    ARCHITOKEN_AUTH__JWT_SECRET="${ARCHITOKEN_PROD_JWT_SECRET}" \
    ARCHITOKEN_AUTH__JWT_ISSUER="architoken-production" \
    ARCHITOKEN_AUTH_PASSWORD_PEPPER="${ARCHITOKEN_PROD_PASSWORD_PEPPER}" \
    ARCHITOKEN_EMAIL_PROVIDER=http \
    ARCHITOKEN_EMAIL_WEBHOOK_URL="http://127.0.0.1:${AUTH_INBOX_PORT}/deliver" \
    ARCHITOKEN_EMAIL_WEBHOOK_TOKEN="${ARCHITOKEN_PROD_INBOX_TOKEN}" \
    ARCHITOKEN_EMAIL_FROM="noreply@architoken.local" \
    ARCHITOKEN_PHASE8_MAX_REQUEST_BODY_BYTES=10485760 \
    ARCHITOKEN_PHASE8_MAX_UPLOAD_BYTES=1073741824 \
    ARCHITOKEN_PHASE8_API_RPS_LIMIT=200 \
    ARCHITOKEN_PHASE8_TENANT_RPS_LIMIT=100 \
    ARCHITOKEN_PHASE8_ACTOR_RPS_LIMIT=50 \
    ARCHITOKEN_PHASE8_MAX_CONCURRENT_UPLOADS_PER_TENANT=4 \
    ARCHITOKEN_PHASE8_MAX_CONCURRENT_CONVERSION_JOBS_PER_TENANT=4 \
    ARCHITOKEN_PHASE8_DB_POOL_MAX_CONNECTIONS=20 \
    ARCHITOKEN_PHASE8_PGBOUNCER_REQUIRED=true \
    ARCHITOKEN_PHASE8_OBJECT_STORE_REQUIRED=true \
    ARCHITOKEN_PHASE8_OTEL_REQUIRED=true \
    "${bin}" > "${LOG_DIR}/gateway-prod.log" 2>&1 & echo $! > "${PID_DIR}/gateway-prod.pid" )
  for _ in $(seq 1 40); do
    if curl -fsS -m 2 "http://127.0.0.1:${PROD_GATEWAY_PORT}/healthz" >/dev/null 2>&1; then
      info "生产网关就绪 http://${PUBLIC_HOST}:${PROD_GATEWAY_PORT}"
      return 0
    fi
    sleep 1
  done
  tail -n 20 "${LOG_DIR}/gateway-prod.log" >&2 || true
  die "生产网关启动失败"
}

build_frontend() {
  if [[ -f "${FRONTEND_DIR}/.next-prod/BUILD_ID" && "${ARCHITOKEN_PROD_REBUILD:-0}" != "1" ]]; then
    info "复用已有生产前端构建（ARCHITOKEN_PROD_REBUILD=1 可强制重建）"
    return 0
  fi
  info "构建生产前端（NEXT_DIST_DIR=.next-prod, API → :${PROD_GATEWAY_PORT}）"
  ( cd "${FRONTEND_DIR}" && env \
      NEXT_DIST_DIR=.next-prod \
      NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL="http://${PUBLIC_HOST}:${PROD_GATEWAY_PORT}" \
      npm run build ) >> "${LOG_DIR}/frontend-prod-build.log" 2>&1 \
    || die "前端构建失败，见 ${LOG_DIR}/frontend-prod-build.log"
}

start_frontend() {
  if [[ -f "${PID_DIR}/frontend-prod.pid" ]] && kill -0 "$(cat "${PID_DIR}/frontend-prod.pid")" 2>/dev/null; then
    info "生产前端已在运行"
    return 0
  fi
  ( cd "${FRONTEND_DIR}" && nohup env \
      NEXT_DIST_DIR=.next-prod \
      NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL="http://${PUBLIC_HOST}:${PROD_GATEWAY_PORT}" \
      npx next start --port "${PROD_FRONTEND_PORT}" \
      > "${LOG_DIR}/frontend-prod.log" 2>&1 & echo $! > "${PID_DIR}/frontend-prod.pid" )
  for _ in $(seq 1 30); do
    if curl -fsS -m 2 "http://127.0.0.1:${PROD_FRONTEND_PORT}/" >/dev/null 2>&1; then
      info "生产前端就绪 http://${PUBLIC_HOST}:${PROD_FRONTEND_PORT}"
      return 0
    fi
    sleep 1
  done
  die "生产前端启动失败，见 ${LOG_DIR}/frontend-prod.log"
}

stop_stack() {
  for name in frontend-prod gateway-prod auth-inbox; do
    if [[ -f "${PID_DIR}/${name}.pid" ]]; then
      kill "$(cat "${PID_DIR}/${name}.pid")" 2>/dev/null || true
      rm -f "${PID_DIR}/${name}.pid"
      info "已停止 ${name}"
    fi
  done
}

status_stack() {
  for entry in "gateway-prod:http://127.0.0.1:${PROD_GATEWAY_PORT}/healthz" \
               "frontend-prod:http://127.0.0.1:${PROD_FRONTEND_PORT}/" ; do
    local name="${entry%%:*}" url="${entry#*:}"
    if curl -fsS -m 3 "${url}" >/dev/null 2>&1; then
      info "${name} running (${url})"
    else
      info "${name} DOWN (${url})"
    fi
  done
  docker ps --format '{{.Names}} {{.Status}}' | grep pgbouncer || info "pgbouncer DOWN"
}

case "${1:-up}" in
  up)
    ensure_secrets
    start_pgbouncer
    start_auth_inbox
    start_gateway
    build_frontend
    start_frontend
    status_stack
    info "生产入口: http://${PUBLIC_HOST}:${PROD_FRONTEND_PORT}  (API: :${PROD_GATEWAY_PORT})"
    ;;
  stop) stop_stack ;;
  status) ensure_secrets >/dev/null 2>&1 || true; status_stack ;;
  *) die "usage: $0 {up|stop|status}" ;;
esac
