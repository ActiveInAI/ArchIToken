#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
ARCHITOKEN_API_BASE_URL="${BASE_URL}"
export ARCHITOKEN_API_BASE_URL

trap 'printf "smoke-all failed at line %s against %s\n" "${LINENO}" "${ARCHITOKEN_API_BASE_URL}" >&2' ERR

need_jq

"${SCRIPT_DIR}/smoke-health.sh"
"${SCRIPT_DIR}/smoke-generation.sh"
"${SCRIPT_DIR}/smoke-artifacts.sh"
"${SCRIPT_DIR}/smoke-registries.sh"
"${SCRIPT_DIR}/smoke-viewer-commands.sh"
"${SCRIPT_DIR}/smoke-rbac.sh"

printf 'all ArchIToken Phase 6 API smoke checks passed for %s tenant=%s project=%s\n' "${ARCHITOKEN_API_BASE_URL}" "${ARCHITOKEN_TENANT_ID}" "${ARCHITOKEN_PROJECT_ID}"
