#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AGENT_DIR="${REPO_ROOT}/04-backend/database-agent-go"
TMP_DIR="${TMPDIR:-/tmp}/architoken-db-agent-go-smoke-$$"
GO_CACHE_DIR="${ARCHITOKEN_GO_CACHE_DIR:-${TMPDIR:-/tmp}/architoken-go-cache}"
ADDR="${ARCHITOKEN_DB_AGENT_SMOKE_ADDR:-127.0.0.1:18752}"

trap 'printf "smoke-database-agent-go failed at line %s\n" "${LINENO}" >&2' ERR

mkdir -p "${TMP_DIR}"
mkdir -p "${GO_CACHE_DIR}/build" "${GO_CACHE_DIR}/pkgmod"
export GOCACHE="${GOCACHE:-${GO_CACHE_DIR}/build}"
export GOMODCACHE="${GOMODCACHE:-${GO_CACHE_DIR}/pkgmod}"

for required_command in go curl python3; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    printf '%s is required for database-agent-go smoke\n' "${required_command}" >&2
    exit 1
  fi
done

server_pid=""
cleanup() {
  if [[ -n "${server_pid}" ]] && kill -0 "${server_pid}" >/dev/null 2>&1; then
    kill "${server_pid}" >/dev/null 2>&1 || true
    wait "${server_pid}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

cd "${AGENT_DIR}"

go test ./...
go run ./cmd/architoken-db-agent >"${TMP_DIR}/manifest-cli.json"

ARCHITOKEN_DB_AGENT_ADDR="${ADDR}" \
  go run ./cmd/architoken-db-agent serve >"${TMP_DIR}/server.log" 2>&1 &
server_pid="$!"

for _ in {1..40}; do
  if curl -fsS "http://${ADDR}/readyz" >"${TMP_DIR}/readyz.json" 2>/dev/null; then
    break
  fi
  if ! kill -0 "${server_pid}" >/dev/null 2>&1; then
    cat "${TMP_DIR}/server.log" >&2 || true
    exit 1
  fi
  sleep 0.25
done

curl -fsS "http://${ADDR}/manifest" >"${TMP_DIR}/manifest-http.json"
curl -fsS "http://${ADDR}/probe" >"${TMP_DIR}/probe.json"

python3 - "${TMP_DIR}" <<'PY'
import json
import pathlib
import sys

tmp_dir = pathlib.Path(sys.argv[1])
expected_engines = {
    "postgresql",
    "clickhouse",
    "valkey",
    "qdrant",
    "s3_compatible",
    "nats_jetstream",
}

ready = json.loads((tmp_dir / "readyz.json").read_text())
if ready.get("status") != "ready":
    raise SystemExit(f"readyz status mismatch: {ready!r}")
if ready.get("license") != "Apache-2.0":
    raise SystemExit(f"readyz license mismatch: {ready!r}")
if ready.get("implementation") != "go-agent":
    raise SystemExit(f"readyz implementation mismatch: {ready!r}")

manifest_cli = json.loads((tmp_dir / "manifest-cli.json").read_text())
manifest_http = json.loads((tmp_dir / "manifest-http.json").read_text())
if manifest_cli != manifest_http:
    raise SystemExit("CLI manifest and HTTP manifest differ")
if manifest_http.get("name") != "architoken-db-agent":
    raise SystemExit(f"manifest name mismatch: {manifest_http!r}")
if manifest_http.get("license") != "Apache-2.0":
    raise SystemExit(f"manifest license mismatch: {manifest_http!r}")

engines = manifest_http.get("engines") or []
engine_ids = {engine.get("id") for engine in engines}
missing = expected_engines - engine_ids
if missing:
    raise SystemExit(f"manifest missing engines: {sorted(missing)}")
for engine in engines:
    if engine.get("safety") != "read_only_default":
        raise SystemExit(f"engine is not read-only by default: {engine!r}")

probe = json.loads((tmp_dir / "probe.json").read_text())
if probe.get("status") != "ready":
    raise SystemExit(f"probe status mismatch: {probe!r}")
if probe.get("defaultSafety") != "read_only_default":
    raise SystemExit(f"probe safety mismatch: {probe!r}")
if expected_engines - set(probe.get("supportedEngines") or []):
    raise SystemExit(f"probe missing supported engines: {probe!r}")
PY

printf 'database-agent-go smoke passed for http://%s\n' "${ADDR}"
