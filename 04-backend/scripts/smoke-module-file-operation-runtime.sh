#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATABASE_URL="${ARCHITOKEN_DATABASE__URL:-${DATABASE_URL:-postgres://architoken:architoken_dev_only@127.0.0.1:5433/architoken}}"
PHASE7_MIGRATION_REL="04-backend/migrations/20260501000001_phase7_durable_runtime.sql"
SPLIT_MIGRATION_REL="04-backend/migrations/20260601000002_data_plane_progressive_split.sql"
BRIDGE_MIGRATION_REL="04-backend/migrations/20260609000001_component_bom_database_bridge.sql"
HEAVY_STEEL_RUNTIME_MIGRATION_REL="04-backend/migrations/20260609000002_heavy_steel_module_operation_runtime.sql"
MODULE_RUNTIME_MIGRATION_REL="04-backend/migrations/20260609000003_module_operation_runtime.sql"
MODULE_RUNTIME_INTEGRITY_MIGRATION_REL="04-backend/migrations/20260609000005_module_operation_runtime_integrity.sql"
MODULE_FILE_RUNTIME_MIGRATION_REL="04-backend/migrations/20260609000007_module_file_operation_runtime_bridge.sql"
TENANT_ID="11111111-1111-4111-8111-111111111111"
PROJECT_ID="5abffe50-2670-42e2-97ea-ec6ac71d8183"
SMOKE_ROW_ID="00000000-0000-4000-8000-000000000701"
SMOKE_FILE_ID="00000000-0000-4000-8000-000000000702"

trap 'printf "smoke-module-file-operation-runtime failed at line %s\n" "${LINENO}" >&2' ERR

if ! command -v psql >/dev/null 2>&1; then
    printf 'psql is required for module file operation runtime smoke\n' >&2
    exit 1
fi

for migration in \
    "${PHASE7_MIGRATION_REL}" \
    "${SPLIT_MIGRATION_REL}" \
    "${BRIDGE_MIGRATION_REL}" \
    "${HEAVY_STEEL_RUNTIME_MIGRATION_REL}" \
    "${MODULE_RUNTIME_MIGRATION_REL}" \
    "${MODULE_RUNTIME_INTEGRITY_MIGRATION_REL}" \
    "${MODULE_FILE_RUNTIME_MIGRATION_REL}"
do
    if [[ ! -f "${REPO_ROOT}/${migration}" ]]; then
        printf 'migration not found: %s\n' "${REPO_ROOT}/${migration}" >&2
        exit 1
    fi
done

cd "${REPO_ROOT}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${PHASE7_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${SPLIT_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c 'DROP VIEW IF EXISTS heavy_steel_database_bridge_status'
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${BRIDGE_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${HEAVY_STEEL_RUNTIME_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${MODULE_RUNTIME_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${MODULE_RUNTIME_INTEGRITY_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${MODULE_FILE_RUNTIME_MIGRATION_REL}"

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 \
    -v tenant_id="${TENANT_ID}" \
    -v project_id="${PROJECT_ID}" \
    -v smoke_row_id="${SMOKE_ROW_ID}" \
    -v smoke_file_id="${SMOKE_FILE_ID}" <<'SQL'
SELECT set_config('app.current_tenant', :'tenant_id', false);

DO $$
DECLARE
    smoke_file_id UUID := '00000000-0000-4000-8000-000000000702';
    operation_count BIGINT;
    runtime_event_count BIGINT;
    runtime_audit_count BIGINT;
    runtime_graph_count BIGINT;
    blocked_file_count BIGINT;
    blocked_integrity_count BIGINT;
    runtime_latest_operation_key TEXT;
    runtime_bridge_status TEXT;
BEGIN
    INSERT INTO module_files (
        id,
        tenant_id,
        project_id,
        file_id,
        module_id,
        parent_id,
        name,
        kind,
        status,
        validation_status,
        validation_summary,
        size_bytes,
        mime_type,
        checksum,
        version,
        owner,
        tags,
        content,
        created_at,
        updated_at,
        created_by
    ) VALUES (
        '00000000-0000-4000-8000-000000000701',
        '11111111-1111-4111-8111-111111111111',
        '5abffe50-2670-42e2-97ea-ec6ac71d8183',
        smoke_file_id,
        'standard_library',
        NULL,
        'module-file-runtime-smoke.ifc',
        'file',
        'active',
        'pending_validation',
        'runtime bridge smoke seed',
        2048,
        'application/octet-stream',
        'sha256:module-file-runtime-smoke',
        1,
        'smoke-module-file-operation-runtime',
        '["smoke","database-runtime"]'::jsonb,
        '',
        NOW() - INTERVAL '1 second',
        NOW() - INTERVAL '1 second',
        'smoke-module-file-operation-runtime'
    )
    ON CONFLICT (file_id) DO UPDATE SET
        name = EXCLUDED.name,
        module_id = EXCLUDED.module_id,
        kind = EXCLUDED.kind,
        status = 'active',
        validation_status = 'pending_validation',
        validation_summary = 'runtime bridge smoke update',
        size_bytes = EXCLUDED.size_bytes,
        mime_type = EXCLUDED.mime_type,
        checksum = EXCLUDED.checksum,
        version = module_files.version + 1,
        owner = EXCLUDED.owner,
        tags = EXCLUDED.tags,
        updated_at = NOW(),
        created_by = EXCLUDED.created_by;

    UPDATE module_files
    SET
        validation_status = 'professional_review_required',
        validation_summary = 'runtime bridge smoke validation transition',
        version = version + 1,
        updated_at = NOW()
    WHERE file_id = smoke_file_id;

    SELECT
        operation_run_count,
        event_count,
        audit_count,
        graph_edge_count,
        latest_operation_key,
        runtime_status
    INTO
        operation_count,
        runtime_event_count,
        runtime_audit_count,
        runtime_graph_count,
        runtime_latest_operation_key,
        runtime_bridge_status
    FROM module_file_operation_runtime_status
    WHERE file_id = smoke_file_id;

    IF operation_count IS NULL OR operation_count < 1 THEN
        RAISE EXCEPTION 'expected module file operation runtime rows for %, got %', smoke_file_id, operation_count;
    END IF;
    IF runtime_event_count <> operation_count THEN
        RAISE EXCEPTION 'expected % file operation events, got %', operation_count, runtime_event_count;
    END IF;
    IF runtime_audit_count <> operation_count THEN
        RAISE EXCEPTION 'expected % file operation audits, got %', operation_count, runtime_audit_count;
    END IF;
    IF runtime_graph_count <> operation_count THEN
        RAISE EXCEPTION 'expected % file operation graph edges, got %', operation_count, runtime_graph_count;
    END IF;
    IF runtime_bridge_status <> 'ready' THEN
        RAISE EXCEPTION 'expected file runtime ready, got % latest operation %', runtime_bridge_status, runtime_latest_operation_key;
    END IF;

    SELECT COUNT(*) INTO blocked_integrity_count
    FROM module_operation_runtime_integrity
    WHERE tenant_id = '11111111-1111-4111-8111-111111111111'
      AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
      AND target_type = 'module_file'
      AND target_id = smoke_file_id::text
      AND integrity_status <> 'ready';

    IF blocked_integrity_count <> 0 THEN
        RAISE EXCEPTION 'expected zero blocked file operation integrity rows, got %', blocked_integrity_count;
    END IF;

    SELECT COUNT(*) INTO blocked_file_count
    FROM module_file_operation_runtime_status
    WHERE tenant_id = '11111111-1111-4111-8111-111111111111'
      AND runtime_status <> 'ready';

    IF blocked_file_count <> 0 THEN
        RAISE EXCEPTION 'expected zero blocked module file runtime rows across tenant, got %', blocked_file_count;
    END IF;
END $$;

SELECT
    file_id,
    module_id,
    name,
    file_status,
    validation_status,
    operation_run_count,
    event_count,
    audit_count,
    graph_edge_count,
    latest_operation_key,
    runtime_status
FROM module_file_operation_runtime_status
WHERE file_id = :'smoke_file_id'::uuid;
SQL

printf 'smoke-module-file-operation-runtime: ok\n'
