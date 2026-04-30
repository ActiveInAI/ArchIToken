#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/smoke-context.sh"
trap 'printf "smoke-phase7-all failed at line %s against %s\n" "${LINENO}" "${BASE_URL}" >&2' ERR

need_jq

"${SCRIPT_DIR}/smoke-phase7-db.sh"
"${SCRIPT_DIR}/smoke-assets-phase7.sh"
"${SCRIPT_DIR}/smoke-conversion-jobs.sh"
"${SCRIPT_DIR}/smoke-openbim.sh"
"${SCRIPT_DIR}/smoke-documents.sh"
"${SCRIPT_DIR}/smoke-gis.sh"
"${SCRIPT_DIR}/smoke-cad.sh"

printf 'all ArchIToken Phase 7 smoke checks passed for %s tenant=%s project=%s\n' "${BASE_URL}" "${ARCHITOKEN_TENANT_ID}" "${ARCHITOKEN_PROJECT_ID}"
