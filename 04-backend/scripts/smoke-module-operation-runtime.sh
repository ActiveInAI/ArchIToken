#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATABASE_URL="${ARCHITOKEN_DATABASE__URL:-${DATABASE_URL:-postgres://architoken:architoken_dev_only@127.0.0.1:5433/architoken}}"
SPLIT_MIGRATION_REL="04-backend/migrations/20260601000002_data_plane_progressive_split.sql"
BRIDGE_MIGRATION_REL="04-backend/migrations/20260609000001_component_bom_database_bridge.sql"
HEAVY_STEEL_RUNTIME_MIGRATION_REL="04-backend/migrations/20260609000002_heavy_steel_module_operation_runtime.sql"
MODULE_RUNTIME_MIGRATION_REL="04-backend/migrations/20260609000003_module_operation_runtime.sql"
MODULE_RUNTIME_INTEGRITY_MIGRATION_REL="04-backend/migrations/20260609000005_module_operation_runtime_integrity.sql"
TENANT_ID="11111111-1111-4111-8111-111111111111"
PROJECT_ID="5abffe50-2670-42e2-97ea-ec6ac71d8183"

trap 'printf "smoke-module-operation-runtime failed at line %s\n" "${LINENO}" >&2' ERR

if ! command -v psql >/dev/null 2>&1; then
    printf 'psql is required for module operation runtime smoke\n' >&2
    exit 1
fi

for migration in \
    "${SPLIT_MIGRATION_REL}" \
    "${BRIDGE_MIGRATION_REL}" \
    "${HEAVY_STEEL_RUNTIME_MIGRATION_REL}" \
    "${MODULE_RUNTIME_MIGRATION_REL}" \
    "${MODULE_RUNTIME_INTEGRITY_MIGRATION_REL}"
do
    if [[ ! -f "${REPO_ROOT}/${migration}" ]]; then
        printf 'migration not found: %s\n' "${REPO_ROOT}/${migration}" >&2
        exit 1
    fi
done

cd "${REPO_ROOT}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${SPLIT_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c 'DROP VIEW IF EXISTS heavy_steel_database_bridge_status'
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${BRIDGE_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${HEAVY_STEEL_RUNTIME_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${MODULE_RUNTIME_MIGRATION_REL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${MODULE_RUNTIME_INTEGRITY_MIGRATION_REL}"

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 \
    -v tenant_id="${TENANT_ID}" \
    -v project_id="${PROJECT_ID}" <<'SQL'
SELECT set_config('app.current_tenant', :'tenant_id', false);

DO $$
DECLARE
    expected_binding_count BIGINT;
    run_count BIGINT;
    event_count BIGINT;
    audit_count BIGINT;
    graph_count BIGINT;
    status_count BIGINT;
    missing_status_count BIGINT;
    current_role_bypasses_rls BOOLEAN;
    rls_guard_count BIGINT;
    wrong_tenant_count BIGINT;
    lifecycle_run_id UUID;
    lifecycle_event_type TEXT;
    lifecycle_audit_action TEXT;
    lifecycle_graph_status TEXT;
    blocked_integrity_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO expected_binding_count
    FROM module_database_operation_bindings
    WHERE tenant_id = '11111111-1111-4111-8111-111111111111'
      AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
      AND operation_surface = 'module_operation_write'
      AND binding_state = 'active'
      AND write_policy <> 'read_only';

    IF expected_binding_count < 16 THEN
        RAISE EXCEPTION 'expected at least 16 active writable module bindings, got %', expected_binding_count;
    END IF;

    INSERT INTO module_operation_runs (
        tenant_id,
        project_id,
        module_id,
        operation_surface,
        operation_key,
        operation_label,
        operation_kind,
        status,
        actor,
        source_surface,
        target_type,
        target_id,
        idempotency_key,
        request_payload,
        result_payload,
        evidence
    )
    SELECT
        b.tenant_id,
        b.project_id,
        b.module_id,
        b.operation_surface,
        'runtime.smoke_write',
        '统一模块运行时烟测写入',
        'module_business_operation',
        'completed',
        'smoke-module-operation-runtime',
        'database_smoke',
        'module',
        b.module_id,
        'smoke:global_module_operation:' || b.module_id,
        jsonb_build_object(
            'moduleId', b.module_id,
            'moduleZhName', m.zh_name,
            'operationSurface', b.operation_surface,
            'relationalRoute', b.relational_route,
            'objectRoute', b.object_route,
            'graphRoute', b.graph_route,
            'eventRoute', b.event_route,
            'analyticsRoute', b.analytics_route,
            'auditRoute', b.audit_route
        ),
        jsonb_build_object(
            'acceptedBy', 'module_operation_runs',
            'eventOutbox', 'data_event_outbox',
            'auditStore', 'audit_events',
            'graphStore', 'data_graph_edges'
        ),
        jsonb_build_object(
            'smoke', true,
            'source', '04-backend/scripts/smoke-module-operation-runtime.sh',
            'graphSidecarExpected', true
        )
    FROM module_database_operation_bindings b
    JOIN modules m ON m.id = b.module_id
    WHERE b.tenant_id = '11111111-1111-4111-8111-111111111111'
      AND b.project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
      AND b.operation_surface = 'module_operation_write'
      AND b.binding_state = 'active'
      AND b.write_policy <> 'read_only'
    ON CONFLICT (tenant_id, project_id, module_id, idempotency_key) DO UPDATE SET
        operation_label = EXCLUDED.operation_label,
        operation_kind = EXCLUDED.operation_kind,
        status = EXCLUDED.status,
        actor = EXCLUDED.actor,
        source_surface = EXCLUDED.source_surface,
        target_type = EXCLUDED.target_type,
        target_id = EXCLUDED.target_id,
        request_payload = EXCLUDED.request_payload,
        result_payload = EXCLUDED.result_payload,
        evidence = EXCLUDED.evidence,
        updated_at = NOW();

    SELECT COUNT(*) INTO run_count
    FROM module_operation_runs
    WHERE tenant_id = '11111111-1111-4111-8111-111111111111'
      AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
      AND idempotency_key LIKE 'smoke:global_module_operation:%';

    IF run_count <> expected_binding_count THEN
        RAISE EXCEPTION 'expected % module operation runs, got %', expected_binding_count, run_count;
    END IF;

    SELECT COUNT(*) INTO event_count
    FROM data_event_outbox e
    JOIN module_operation_runs r ON r.operation_run_id::text = e.target_id
    WHERE r.tenant_id = '11111111-1111-4111-8111-111111111111'
      AND r.project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
      AND r.idempotency_key LIKE 'smoke:global_module_operation:%'
      AND e.target_type = 'module_operation_run'
      AND e.event_type = 'module_operation.completed';

    SELECT COUNT(*) INTO audit_count
    FROM audit_events a
    JOIN module_operation_runs r ON r.operation_run_id::text = a.target_id
    WHERE r.tenant_id = '11111111-1111-4111-8111-111111111111'
      AND r.project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
      AND r.idempotency_key LIKE 'smoke:global_module_operation:%'
      AND a.target_type = 'module_operation_run'
      AND a.action = 'module_operation_completed';

    SELECT COUNT(*) INTO graph_count
    FROM data_graph_edges g
    JOIN module_operation_runs r ON r.operation_run_id::text = g.to_entity_id
    WHERE r.tenant_id = '11111111-1111-4111-8111-111111111111'
      AND r.project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
      AND r.idempotency_key LIKE 'smoke:global_module_operation:%'
      AND g.to_entity_type = 'module_operation_run'
      AND g.relationship_type = 'triggers_module_operation'
      AND g.source = 'module_operation_runtime';

    IF event_count <> run_count THEN
        RAISE EXCEPTION 'expected % module operation events, got %', run_count, event_count;
    END IF;
    IF audit_count <> run_count THEN
        RAISE EXCEPTION 'expected % module operation audits, got %', run_count, audit_count;
    END IF;
    IF graph_count <> run_count THEN
        RAISE EXCEPTION 'expected % module operation graph edges, got %', run_count, graph_count;
    END IF;

    INSERT INTO module_operation_runs (
        tenant_id,
        project_id,
        module_id,
        operation_surface,
        operation_key,
        operation_label,
        operation_kind,
        status,
        actor,
        source_surface,
        target_type,
        target_id,
        idempotency_key,
        request_payload,
        result_payload,
        evidence
    )
    SELECT
        b.tenant_id,
        b.project_id,
        b.module_id,
        b.operation_surface,
        'runtime.smoke_lifecycle',
        '统一模块运行时生命周期烟测',
        'module_business_operation',
        'requested',
        'smoke-module-operation-runtime',
        'database_smoke',
        'module',
        b.module_id,
        'smoke:global_module_operation_lifecycle:standard_library',
        jsonb_build_object('moduleId', b.module_id, 'transition', 'requested'),
        jsonb_build_object('acceptedBy', 'module_operation_runs'),
        jsonb_build_object('lifecycleSmoke', true, 'transition', 'requested')
    FROM module_database_operation_bindings b
    WHERE b.tenant_id = '11111111-1111-4111-8111-111111111111'
      AND b.project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
      AND b.module_id = 'standard_library'
      AND b.operation_surface = 'module_operation_write'
      AND b.binding_state = 'active'
      AND b.write_policy <> 'read_only'
    ON CONFLICT (tenant_id, project_id, module_id, idempotency_key) DO UPDATE SET
        status = EXCLUDED.status,
        actor = EXCLUDED.actor,
        request_payload = EXCLUDED.request_payload,
        result_payload = EXCLUDED.result_payload,
        evidence = EXCLUDED.evidence,
        updated_at = NOW()
    RETURNING operation_run_id INTO lifecycle_run_id;

    IF lifecycle_run_id IS NULL THEN
        RAISE EXCEPTION 'standard_library lifecycle operation was not inserted';
    END IF;

    UPDATE module_operation_runs
    SET
        status = 'running',
        result_payload = result_payload || jsonb_build_object('phase', 'running'),
        evidence = evidence || jsonb_build_object('runningAt', NOW())
    WHERE operation_run_id = lifecycle_run_id;

    UPDATE module_operation_runs
    SET
        status = 'completed',
        result_payload = result_payload || jsonb_build_object('phase', 'completed', 'completed', true),
        evidence = evidence || jsonb_build_object('completedAt', NOW())
    WHERE operation_run_id = lifecycle_run_id;

    SELECT e.event_type, a.action, g.properties->>'status'
      INTO lifecycle_event_type, lifecycle_audit_action, lifecycle_graph_status
    FROM module_operation_runs r
    LEFT JOIN data_event_outbox e ON e.id = r.event_id
    LEFT JOIN audit_events a ON a.id = r.audit_event_id
    LEFT JOIN data_graph_edges g ON g.id = r.graph_edge_id
    WHERE r.operation_run_id = lifecycle_run_id;

    IF lifecycle_event_type <> 'module_operation.completed' THEN
        RAISE EXCEPTION 'expected lifecycle event completed, got %', lifecycle_event_type;
    END IF;
    IF lifecycle_audit_action <> 'module_operation_completed' THEN
        RAISE EXCEPTION 'expected lifecycle audit completed, got %', lifecycle_audit_action;
    END IF;
    IF lifecycle_graph_status <> 'completed' THEN
        RAISE EXCEPTION 'expected lifecycle graph status completed, got %', lifecycle_graph_status;
    END IF;

    SELECT COUNT(*) INTO blocked_integrity_count
    FROM module_operation_runtime_integrity
    WHERE tenant_id = '11111111-1111-4111-8111-111111111111'
      AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
      AND integrity_status <> 'ready';

    IF blocked_integrity_count <> 0 THEN
        RAISE EXCEPTION 'expected zero blocked module operation integrity rows, got %', blocked_integrity_count;
    END IF;

    SELECT COUNT(*) INTO status_count
    FROM module_operation_runtime_status
    WHERE tenant_id = '11111111-1111-4111-8111-111111111111'
      AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
      AND binding_state = 'active';

    SELECT COUNT(*) INTO missing_status_count
    FROM module_operation_runtime_status
    WHERE tenant_id = '11111111-1111-4111-8111-111111111111'
      AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
      AND binding_state = 'active'
      AND operation_run_count < 1;

    IF status_count <> expected_binding_count THEN
        RAISE EXCEPTION 'expected % runtime status rows, got %', expected_binding_count, status_count;
    END IF;
    IF missing_status_count <> 0 THEN
        RAISE EXCEPTION 'expected every module binding to have at least one operation run, missing %', missing_status_count;
    END IF;

    SELECT rolbypassrls OR rolsuper INTO current_role_bypasses_rls
    FROM pg_roles
    WHERE rolname = current_user;

    IF current_role_bypasses_rls THEN
        SELECT COUNT(*) INTO rls_guard_count
        FROM pg_class c
        JOIN pg_policies p ON p.tablename = c.relname
        WHERE c.relname = 'module_operation_runs'
          AND c.relrowsecurity
          AND c.relforcerowsecurity
          AND p.qual = '(tenant_id = current_tenant())'
          AND p.with_check = '(tenant_id = current_tenant())';

        IF rls_guard_count <> 1 THEN
            RAISE EXCEPTION 'expected module_operation_runs RLS guard, got %', rls_guard_count;
        END IF;
    ELSE
        PERFORM set_config('app.current_tenant', '00000000-0000-4000-8000-000000000000', false);
        SELECT COUNT(*) INTO wrong_tenant_count FROM module_operation_runs;
        IF wrong_tenant_count <> 0 THEN
            RAISE EXCEPTION 'RLS failed: wrong tenant can see % module_operation_runs', wrong_tenant_count;
        END IF;
        PERFORM set_config('app.current_tenant', '11111111-1111-4111-8111-111111111111', false);
    END IF;
END $$;

SELECT set_config('app.current_tenant', :'tenant_id', false);

SELECT
    COUNT(*) FILTER (WHERE binding_state = 'active') AS active_module_bindings,
    SUM(operation_run_count) AS operation_runs,
    SUM(event_count) AS events,
    SUM(audit_count) AS audits,
    SUM(graph_edge_count) AS graph_edges
FROM module_operation_runtime_status
WHERE tenant_id = :'tenant_id'::uuid
  AND project_id = :'project_id'::uuid;

SELECT
    integrity_status,
    COUNT(*) AS operation_runs
FROM module_operation_runtime_integrity
WHERE tenant_id = :'tenant_id'::uuid
  AND project_id = :'project_id'::uuid
GROUP BY integrity_status
ORDER BY integrity_status;

SELECT
    module_id,
    module_zh_name,
    operation_run_count,
    event_count,
    audit_count,
    graph_edge_count,
    last_operation_at
FROM module_operation_runtime_status
WHERE tenant_id = :'tenant_id'::uuid
  AND project_id = :'project_id'::uuid
ORDER BY module_id;
SQL
