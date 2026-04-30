#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHITOKEN_API_BASE_URL="${ARCHITOKEN_API_BASE_URL:-${BASE_URL:-http://localhost:8080}}"
export ARCHITOKEN_API_BASE_URL

trap 'printf "smoke-all failed at line %s against %s\n" "${LINENO}" "${ARCHITOKEN_API_BASE_URL}" >&2' ERR

need_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    printf 'jq is required for ArchIToken smoke scripts. Install jq and retry.\n' >&2
    exit 1
  fi
}

need_jq

"${SCRIPT_DIR}/smoke-health.sh"
"${SCRIPT_DIR}/smoke-generation.sh"
"${SCRIPT_DIR}/smoke-artifacts.sh"
"${SCRIPT_DIR}/smoke-registries.sh"
"${SCRIPT_DIR}/smoke-viewer-commands.sh"

printf 'all ArchIToken Phase 5 API smoke checks passed for %s\n' "${ARCHITOKEN_API_BASE_URL}"
