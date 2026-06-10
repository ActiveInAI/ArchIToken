#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATABASE_URL="${ARCHITOKEN_DATABASE__URL:-${DATABASE_URL:-postgres://architoken:architoken_dev_only@127.0.0.1:5433/architoken}}"
MIGRATION_REL="04-backend/migrations/20260610000001_database_ops_maturity_and_heavy_steel_e2e.sql"
TENANT_ID="${ARCHITOKEN_SMOKE_TENANT_ID:-11111111-1111-4111-8111-111111111111}"
PROJECT_ID="${ARCHITOKEN_SMOKE_PROJECT_ID:-5abffe50-2670-42e2-97ea-ec6ac71d8183}"
PROGRAM_ID="${ARCHITOKEN_SMOKE_PROGRAM_ID:-heavy_steel_hotel_100_rooms_q235b_bolted}"
RUN_UPSTREAM_SMOKES="${ARCHITOKEN_SMOKE_RUN_UPSTREAM:-1}"

trap 'printf "smoke-heavy-steel-end-to-end-readiness failed at line %s\n" "${LINENO}" >&2' ERR

if ! command -v psql >/dev/null 2>&1; then
    printf 'psql is required for heavy-steel end-to-end readiness smoke\n' >&2
    exit 1
fi

if [[ ! -f "${REPO_ROOT}/${MIGRATION_REL}" ]]; then
    printf 'migration not found: %s\n' "${REPO_ROOT}/${MIGRATION_REL}" >&2
    exit 1
fi

cd "${REPO_ROOT}"

if [[ "${RUN_UPSTREAM_SMOKES}" == "1" ]]; then
    psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -c 'DROP VIEW IF EXISTS heavy_steel_end_to_end_readiness'
    04-backend/scripts/smoke-heavy-steel-database-bridge.sh
    04-backend/scripts/smoke-module-operation-runtime.sh
    04-backend/scripts/smoke-module-file-operation-runtime.sh
    04-backend/scripts/smoke-module-transaction-operation-runtime.sh
    04-backend/scripts/smoke-operations-audit-log-archive.sh
    04-backend/scripts/smoke-backup-restore-drill.sh
fi

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${MIGRATION_REL}"

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 \
    -v tenant_id="${TENANT_ID}" \
    -v project_id="${PROJECT_ID}" \
    -v program_id="${PROGRAM_ID}" <<'SQL'
SELECT set_config('app.current_tenant', :'tenant_id', false);
SELECT set_config('app.current_project', :'project_id', false);
SELECT set_config('app.current_program', :'program_id', false);

DO $$
DECLARE
    ops_row database_ops_maturity_readiness%ROWTYPE;
    heavy_row heavy_steel_end_to_end_readiness%ROWTYPE;
    tenant_uuid UUID := current_setting('app.current_tenant')::uuid;
    project_uuid UUID := current_setting('app.current_project')::uuid;
    program_key TEXT := current_setting('app.current_program');
BEGIN
    SELECT *
    INTO ops_row
    FROM database_ops_maturity_readiness
    WHERE tenant_id = tenant_uuid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'database_ops_maturity_readiness returned no row for tenant %', tenant_uuid;
    END IF;

    IF ops_row.p0_gate_state <> 'passed' THEN
        RAISE EXCEPTION 'database ops maturity gate expected passed, got %, issues=%',
            ops_row.p0_gate_state,
            ops_row.issues;
    END IF;
    IF ops_row.maturity_level <> 'alpha_p0_integrated' THEN
        RAISE EXCEPTION 'database ops maturity level expected alpha_p0_integrated, got %',
            ops_row.maturity_level;
    END IF;
    IF ops_row.audit_archive_gate_state <> 'passed' THEN
        RAISE EXCEPTION 'audit archive gate expected passed, got %', ops_row.audit_archive_gate_state;
    END IF;
    IF ops_row.backup_restore_gate_state <> 'passed' THEN
        RAISE EXCEPTION 'backup restore gate expected passed, got %', ops_row.backup_restore_gate_state;
    END IF;
    IF ops_row.active_backup_policy_count < 4 THEN
        RAISE EXCEPTION 'expected at least 4 active backup policies, got %', ops_row.active_backup_policy_count;
    END IF;
    IF ops_row.successful_backup_count < 1 OR ops_row.passed_restore_drill_count < 1 THEN
        RAISE EXCEPTION 'expected successful backup and restore drill, got backup=% restore=%',
            ops_row.successful_backup_count,
            ops_row.passed_restore_drill_count;
    END IF;
    IF ops_row.active_module_binding_count < 16 THEN
        RAISE EXCEPTION 'expected at least 16 active module bindings, got %', ops_row.active_module_binding_count;
    END IF;
    IF ops_row.module_operation_run_count <= 0 THEN
        RAISE EXCEPTION 'expected module operation runs, got %', ops_row.module_operation_run_count;
    END IF;
    IF ops_row.integrity_blocked_count <> 0 THEN
        RAISE EXCEPTION 'expected no module operation integrity blockers, got %', ops_row.integrity_blocked_count;
    END IF;
    IF ops_row.module_file_count <= 0 OR ops_row.module_file_ready_count <> ops_row.module_file_count THEN
        RAISE EXCEPTION 'module file runtime not ready: count=% ready=% blocked=%',
            ops_row.module_file_count,
            ops_row.module_file_ready_count,
            ops_row.module_file_blocked_count;
    END IF;
    IF ops_row.module_transaction_count <= 0 OR ops_row.module_transaction_ready_count <> ops_row.module_transaction_count THEN
        RAISE EXCEPTION 'module transaction runtime not ready: count=% ready=% blocked=%',
            ops_row.module_transaction_count,
            ops_row.module_transaction_ready_count,
            ops_row.module_transaction_blocked_count;
    END IF;

    SELECT *
    INTO heavy_row
    FROM heavy_steel_end_to_end_readiness
    WHERE tenant_id = tenant_uuid
      AND project_id = project_uuid
      AND program_id = program_key;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'heavy_steel_end_to_end_readiness returned no row for program %', program_key;
    END IF;

    IF heavy_row.p0_gate_state <> 'passed' THEN
        RAISE EXCEPTION 'heavy steel end-to-end gate expected passed, got %, issues=%',
            heavy_row.p0_gate_state,
            heavy_row.issues;
    END IF;
    IF heavy_row.source_drawing_count <> 198 THEN
        RAISE EXCEPTION 'expected 198 source drawings, got %', heavy_row.source_drawing_count;
    END IF;
    IF heavy_row.source_package_count <> 8 THEN
        RAISE EXCEPTION 'expected 8 source packages, got %', heavy_row.source_package_count;
    END IF;
    IF heavy_row.source_section_count <> 33 THEN
        RAISE EXCEPTION 'expected 33 source sections, got %', heavy_row.source_section_count;
    END IF;
    IF heavy_row.bound_module_count < 16 THEN
        RAISE EXCEPTION 'expected at least 16 bound modules, got %', heavy_row.bound_module_count;
    END IF;
    IF heavy_row.module_work_order_count < heavy_row.bound_module_count THEN
        RAISE EXCEPTION 'module work orders do not cover bound modules: work_orders=% bound=%',
            heavy_row.module_work_order_count,
            heavy_row.bound_module_count;
    END IF;
    IF heavy_row.bom_line_count <> 14 OR heavy_row.bom_line_source_count <> 14 THEN
        RAISE EXCEPTION 'expected 14 BOM lines and sources, got lines=% sources=%',
            heavy_row.bom_line_count,
            heavy_row.bom_line_source_count;
    END IF;
    IF heavy_row.downstream_link_count <> 84 THEN
        RAISE EXCEPTION 'expected 84 downstream links, got %', heavy_row.downstream_link_count;
    END IF;
    IF heavy_row.module_file_count <= 0 OR heavy_row.module_file_ready_count <> heavy_row.module_file_count THEN
        RAISE EXCEPTION 'heavy steel CDE file runtime not ready: files=% ready=% blocked=%',
            heavy_row.module_file_count,
            heavy_row.module_file_ready_count,
            heavy_row.module_file_blocked_count;
    END IF;
    IF heavy_row.module_transaction_count <= 0 OR heavy_row.module_transaction_ready_count <> heavy_row.module_transaction_count THEN
        RAISE EXCEPTION 'heavy steel module transaction runtime not ready: tx=% ready=% blocked=%',
            heavy_row.module_transaction_count,
            heavy_row.module_transaction_ready_count,
            heavy_row.module_transaction_blocked_count;
    END IF;
    IF heavy_row.heavy_steel_operation_run_count <= 0 THEN
        RAISE EXCEPTION 'expected heavy steel operation runs, got %', heavy_row.heavy_steel_operation_run_count;
    END IF;
    IF heavy_row.heavy_steel_event_count <> heavy_row.heavy_steel_operation_run_count
       OR heavy_row.heavy_steel_audit_count <> heavy_row.heavy_steel_operation_run_count
       OR heavy_row.heavy_steel_graph_edge_count <> heavy_row.heavy_steel_operation_run_count THEN
        RAISE EXCEPTION 'heavy steel side effects not exact: runs=% events=% audits=% graph=%',
            heavy_row.heavy_steel_operation_run_count,
            heavy_row.heavy_steel_event_count,
            heavy_row.heavy_steel_audit_count,
            heavy_row.heavy_steel_graph_edge_count;
    END IF;
    IF heavy_row.issues <> '{}'::jsonb THEN
        RAISE EXCEPTION 'expected empty heavy steel readiness issues, got %', heavy_row.issues;
    END IF;
END $$;
SQL

printf 'heavy-steel end-to-end readiness smoke passed: tenant=%s project=%s program=%s\n' \
    "${TENANT_ID}" "${PROJECT_ID}" "${PROGRAM_ID}"
