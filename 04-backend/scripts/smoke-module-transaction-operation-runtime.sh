#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATABASE_URL="${ARCHITOKEN_DATABASE__URL:-${DATABASE_URL:-postgres://architoken:architoken_dev_only@127.0.0.1:5433/architoken}}"
PHASE7_MIGRATION_REL="04-backend/migrations/20260501000001_phase7_durable_runtime.sql"
SPLIT_MIGRATION_REL="04-backend/migrations/20260601000002_data_plane_progressive_split.sql"
HEAVY_STEEL_TRUTH_MIGRATION_REL="04-backend/migrations/20260608000001_heavy_steel_program_truth.sql"
BRIDGE_MIGRATION_REL="04-backend/migrations/20260609000001_component_bom_database_bridge.sql"
HEAVY_STEEL_RUNTIME_MIGRATION_REL="04-backend/migrations/20260609000002_heavy_steel_module_operation_runtime.sql"
MODULE_RUNTIME_MIGRATION_REL="04-backend/migrations/20260609000003_module_operation_runtime.sql"
MODULE_RUNTIME_INTEGRITY_MIGRATION_REL="04-backend/migrations/20260609000005_module_operation_runtime_integrity.sql"
MODULE_FILE_RUNTIME_MIGRATION_REL="04-backend/migrations/20260609000007_module_file_operation_runtime_bridge.sql"
MODULE_TRANSACTION_RUNTIME_MIGRATION_REL="04-backend/migrations/20260609000008_module_transaction_operation_runtime_bridge.sql"
MODULE_RUNTIME_SUMMARY_MIGRATION_REL="04-backend/migrations/20260609000009_module_operation_runtime_summary.sql"
TENANT_ID="11111111-1111-4111-8111-111111111111"
PROJECT_ID="5abffe50-2670-42e2-97ea-ec6ac71d8183"
SMOKE_ROW_ID="00000000-0000-4000-8000-000000000801"
SMOKE_TRANSACTION_ID="00000000-0000-4000-8000-000000000802"
SMOKE_APPROVAL_ROW_ID="00000000-0000-4000-8000-000000000803"
SMOKE_APPROVAL_ID="00000000-0000-4000-8000-000000000804"

trap 'printf "smoke-module-transaction-operation-runtime failed at line %s\n" "${LINENO}" >&2' ERR

if ! command -v psql >/dev/null 2>&1; then
    printf 'psql is required for module transaction operation runtime smoke\n' >&2
    exit 1
fi

for migration in \
    "${PHASE7_MIGRATION_REL}" \
    "${SPLIT_MIGRATION_REL}" \
    "${HEAVY_STEEL_TRUTH_MIGRATION_REL}" \
    "${BRIDGE_MIGRATION_REL}" \
    "${HEAVY_STEEL_RUNTIME_MIGRATION_REL}" \
    "${MODULE_RUNTIME_MIGRATION_REL}" \
    "${MODULE_RUNTIME_INTEGRITY_MIGRATION_REL}" \
    "${MODULE_FILE_RUNTIME_MIGRATION_REL}" \
    "${MODULE_TRANSACTION_RUNTIME_MIGRATION_REL}" \
    "${MODULE_RUNTIME_SUMMARY_MIGRATION_REL}"
do
    if [[ ! -f "${REPO_ROOT}/${migration}" ]]; then
        printf 'migration not found: %s\n' "${REPO_ROOT}/${migration}" >&2
        exit 1
    fi
done

cd "${REPO_ROOT}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${PHASE7_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${SPLIT_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -c 'DROP VIEW IF EXISTS heavy_steel_database_bridge_status'
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${HEAVY_STEEL_TRUTH_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${BRIDGE_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${HEAVY_STEEL_RUNTIME_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${MODULE_RUNTIME_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${MODULE_RUNTIME_INTEGRITY_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${MODULE_FILE_RUNTIME_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${MODULE_TRANSACTION_RUNTIME_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${MODULE_RUNTIME_SUMMARY_MIGRATION_REL}"

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 \
    -v tenant_id="${TENANT_ID}" \
    -v project_id="${PROJECT_ID}" \
    -v smoke_row_id="${SMOKE_ROW_ID}" \
    -v smoke_transaction_id="${SMOKE_TRANSACTION_ID}" \
    -v smoke_approval_row_id="${SMOKE_APPROVAL_ROW_ID}" \
    -v smoke_approval_id="${SMOKE_APPROVAL_ID}" <<'SQL'
SELECT set_config('app.current_tenant', :'tenant_id', false);

DO $$
DECLARE
    smoke_transaction_id UUID := '00000000-0000-4000-8000-000000000802';
    smoke_approval_id UUID := '00000000-0000-4000-8000-000000000804';
    transaction_count BIGINT;
    ready_count BIGINT;
    blocked_count BIGINT;
    operation_count BIGINT;
    runtime_event_count BIGINT;
    runtime_audit_count BIGINT;
    runtime_graph_count BIGINT;
    approval_count BIGINT;
    approval_operation_count BIGINT;
    runtime_bridge_status TEXT;
    blocked_integrity_count BIGINT;
BEGIN
    INSERT INTO module_transactions (
        id,
        tenant_id,
        project_id,
        transaction_id,
        module_id,
        transaction_type,
        status,
        actor,
        related_file_ids,
        related_artifact_ids,
        created_at,
        updated_at,
        created_by
    ) VALUES (
        '00000000-0000-4000-8000-000000000801',
        '11111111-1111-4111-8111-111111111111',
        '5abffe50-2670-42e2-97ea-ec6ac71d8183',
        smoke_transaction_id,
        'standard_library',
        'database_runtime_smoke',
        'draft',
        'smoke-module-transaction-operation-runtime',
        '[]'::jsonb,
        '[]'::jsonb,
        NOW() - INTERVAL '2 seconds',
        NOW() - INTERVAL '2 seconds',
        'smoke-module-transaction-operation-runtime'
    )
    ON CONFLICT (transaction_id) DO UPDATE SET
        module_id = EXCLUDED.module_id,
        transaction_type = EXCLUDED.transaction_type,
        status = 'draft',
        actor = EXCLUDED.actor,
        related_file_ids = EXCLUDED.related_file_ids,
        related_artifact_ids = EXCLUDED.related_artifact_ids,
        updated_at = NOW() - INTERVAL '2 seconds',
        created_by = EXCLUDED.created_by;

    UPDATE module_transactions
    SET
        status = 'pending_approval',
        actor = 'smoke-module-transaction-operation-runtime',
        updated_at = NOW() - INTERVAL '1 second'
    WHERE transaction_id = smoke_transaction_id;

    INSERT INTO module_transaction_approvals (
        id,
        tenant_id,
        project_id,
        approval_id,
        transaction_id,
        approver,
        decision,
        decision_comment,
        decided_at,
        created_by
    ) VALUES (
        '00000000-0000-4000-8000-000000000803',
        '11111111-1111-4111-8111-111111111111',
        '5abffe50-2670-42e2-97ea-ec6ac71d8183',
        smoke_approval_id,
        smoke_transaction_id,
        'smoke-approver',
        'approved',
        'module transaction runtime smoke approval',
        NOW(),
        'smoke-module-transaction-operation-runtime'
    )
    ON CONFLICT (approval_id) DO UPDATE SET
        approver = EXCLUDED.approver,
        decision = EXCLUDED.decision,
        decision_comment = EXCLUDED.decision_comment,
        created_by = EXCLUDED.created_by;

    UPDATE module_transactions
    SET
        status = 'approved',
        actor = 'smoke-approver',
        updated_at = NOW()
    WHERE transaction_id = smoke_transaction_id;

    SELECT
        s.operation_run_count,
        s.event_count,
        s.audit_count,
        s.graph_edge_count,
        s.approval_count,
        s.approval_operation_run_count,
        s.runtime_status
    INTO
        operation_count,
        runtime_event_count,
        runtime_audit_count,
        runtime_graph_count,
        approval_count,
        approval_operation_count,
        runtime_bridge_status
    FROM module_transaction_operation_runtime_status s
    WHERE s.transaction_id = smoke_transaction_id;

    IF operation_count IS NULL OR operation_count < 1 THEN
        RAISE EXCEPTION 'expected transaction operation runtime rows for %, got %', smoke_transaction_id, operation_count;
    END IF;
    IF runtime_event_count <> operation_count THEN
        RAISE EXCEPTION 'expected % transaction operation events, got %', operation_count, runtime_event_count;
    END IF;
    IF runtime_audit_count <> operation_count THEN
        RAISE EXCEPTION 'expected % transaction operation audits, got %', operation_count, runtime_audit_count;
    END IF;
    IF runtime_graph_count <> operation_count THEN
        RAISE EXCEPTION 'expected % transaction operation graph edges, got %', operation_count, runtime_graph_count;
    END IF;
    IF approval_count <> 1 THEN
        RAISE EXCEPTION 'expected one approval row, got %', approval_count;
    END IF;
    IF approval_operation_count < approval_count THEN
        RAISE EXCEPTION 'expected approval operation evidence for %, got %', approval_count, approval_operation_count;
    END IF;
    IF runtime_bridge_status <> 'ready' THEN
        RAISE EXCEPTION 'expected transaction runtime ready, got %', runtime_bridge_status;
    END IF;

    SELECT COUNT(*) INTO blocked_integrity_count
    FROM module_operation_runtime_integrity
    WHERE tenant_id = '11111111-1111-4111-8111-111111111111'
      AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
      AND target_type IN ('module_transaction', 'module_transaction_approval')
      AND target_id IN (smoke_transaction_id::text, smoke_approval_id::text)
      AND integrity_status <> 'ready';

    IF blocked_integrity_count <> 0 THEN
        RAISE EXCEPTION 'expected zero blocked transaction integrity rows, got %', blocked_integrity_count;
    END IF;

    SELECT
        s.transaction_count,
        s.ready_count,
        s.blocked_count,
        s.operation_run_count,
        s.approval_count,
        s.approval_operation_run_count
    INTO
        transaction_count,
        ready_count,
        blocked_count,
        operation_count,
        approval_count,
        approval_operation_count
    FROM module_transaction_operation_runtime_summary s
    WHERE s.tenant_id = '11111111-1111-4111-8111-111111111111'
      AND s.project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183';

    IF transaction_count < 1 THEN
        RAISE EXCEPTION 'expected at least one transaction in summary, got %', transaction_count;
    END IF;
    IF blocked_count <> 0 THEN
        RAISE EXCEPTION 'expected zero blocked transaction runtime rows across project, got %', blocked_count;
    END IF;
    IF ready_count <> transaction_count THEN
        RAISE EXCEPTION 'expected all transactions ready, got ready % of %', ready_count, transaction_count;
    END IF;
    IF approval_operation_count < approval_count THEN
        RAISE EXCEPTION 'expected approval operation coverage, approvals %, operations %', approval_count, approval_operation_count;
    END IF;
END $$;

SELECT
    transaction_id,
    module_id,
    transaction_type,
    transaction_status,
    approval_count,
    operation_run_count,
    event_count,
    audit_count,
    graph_edge_count,
    approval_operation_run_count,
    runtime_status
FROM module_transaction_operation_runtime_status
WHERE transaction_id = :'smoke_transaction_id'::uuid;
SQL

printf 'smoke-module-transaction-operation-runtime: ok\n'
