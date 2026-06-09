#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATABASE_URL="${ARCHITOKEN_DATABASE__URL:-${DATABASE_URL:-postgres://architoken:architoken_dev_only@127.0.0.1:5433/architoken}}"
export DATABASE_URL
export ARCHITOKEN_DATABASE__URL="${ARCHITOKEN_DATABASE__URL:-${DATABASE_URL}}"

trap 'printf "smoke-p0-production-gates failed at line %s\n" "${LINENO}" >&2' ERR

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        printf '%s is required for P0 production gates\n' "$1" >&2
        exit 1
    fi
}

apply_migration() {
    local migration="$1"
    printf 'Applying migration: %s\n' "${migration}"
    psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${migration}"
}

run_workers_contract_gate() {
    if [[ "${ARCHITOKEN_P0_INCLUDE_WORKERS:-1}" != "1" ]]; then
        printf 'Skipping worker contract gate because ARCHITOKEN_P0_INCLUDE_WORKERS != 1\n'
        return
    fi

    if command -v uv >/dev/null 2>&1; then
        (
            cd "${REPO_ROOT}/06-workers"
            uv run --extra test pytest tests/test_contract.py tests/test_component_bom_worker.py
        )
    else
        (
            cd "${REPO_ROOT}/06-workers"
            PYTHONPATH=. python3 -m pytest tests/test_contract.py tests/test_component_bom_worker.py
        )
    fi
}

run_bom_database_bridge_gate() {
    local mode="${ARCHITOKEN_P0_INCLUDE_BOM_DB_BRIDGE:-auto}"
    local bom_source="/home/insome/下载/应舍美居_构件物料清单.xlsx"
    local drawing_source="/home/insome/下载/重钢装配式酒店深化图纸目录.docx"

    if [[ "${mode}" == "0" ]]; then
        printf 'Skipping heavy-steel BOM database bridge gate because ARCHITOKEN_P0_INCLUDE_BOM_DB_BRIDGE=0\n'
        return
    fi

    if [[ -f "${bom_source}" && -f "${drawing_source}" ]]; then
        04-backend/scripts/smoke-heavy-steel-database-bridge.sh
        return
    fi

    if [[ "${mode}" == "1" ]]; then
        printf 'heavy-steel BOM database bridge sources are required but missing:\n- %s\n- %s\n' \
            "${bom_source}" "${drawing_source}" >&2
        exit 1
    fi

    printf 'Skipping heavy-steel BOM database bridge gate because local workbook/catalog sources are not available\n'
}

cd "${REPO_ROOT}"

require_command bash
require_command psql
require_command pg_dump
require_command pg_restore
require_command sha256sum
require_command stat

bash -n 04-backend/scripts/smoke-operations-audit-log-archive.sh
bash -n 04-backend/scripts/smoke-backup-restore-drill.sh
bash -n 04-backend/scripts/smoke-heavy-steel-database-bridge.sh
bash -n 04-backend/scripts/smoke-module-operation-runtime.sh
bash -n 04-backend/scripts/smoke-module-file-operation-runtime.sh

if [[ "${ARCHITOKEN_P0_APPLY_BASE_MIGRATIONS:-0}" == "1" ]]; then
    apply_migration 04-backend/migrations/20260419000001_initial_schema.sql
    apply_migration 04-backend/migrations/20260419000002_rls_policies.sql
    apply_migration 04-backend/migrations/20260501000001_phase7_durable_runtime.sql
    apply_migration 04-backend/migrations/20260601000001_module_registry_16.sql
fi

run_bom_database_bridge_gate
04-backend/scripts/smoke-module-operation-runtime.sh
04-backend/scripts/smoke-module-file-operation-runtime.sh
04-backend/scripts/smoke-operations-audit-log-archive.sh
04-backend/scripts/smoke-backup-restore-drill.sh
run_workers_contract_gate

if [[ "${ARCHITOKEN_P0_DIFF_CHECK:-1}" == "1" ]] && command -v git >/dev/null 2>&1; then
    git diff --check -- \
        .github/workflows/ci.yml \
        04-backend/migrations \
        04-backend/scripts \
        06-workers \
        07-deployment
fi

printf 'ArchIToken P0 production gates passed\n'
