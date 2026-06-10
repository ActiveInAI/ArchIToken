-- License: Apache-2.0
-- Bridge module lifecycle transactions and approvals into the global module operation runtime.

CREATE OR REPLACE FUNCTION module_transaction_runtime_status(operation_status TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE operation_status
        WHEN 'draft' THEN 'requested'
        WHEN 'submitted' THEN 'requested'
        WHEN 'generating' THEN 'running'
        WHEN 'evaluating' THEN 'running'
        WHEN 'rule_checking' THEN 'running'
        WHEN 'schema_validating' THEN 'running'
        WHEN 'pending_approval' THEN 'professional_review_required'
        WHEN 'professional_review_required' THEN 'professional_review_required'
        WHEN 'approved' THEN 'completed'
        WHEN 'archived' THEN 'completed'
        WHEN 'rejected' THEN 'failed'
        WHEN 'blocked' THEN 'blocked'
        ELSE 'professional_review_required'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION module_transaction_runtime_label(operation_status TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE operation_status
        WHEN 'draft' THEN '模块事务草稿'
        WHEN 'submitted' THEN '模块事务已提交'
        WHEN 'generating' THEN '模块事务生成中'
        WHEN 'evaluating' THEN '模块事务评估中'
        WHEN 'rule_checking' THEN '模块事务规则校验中'
        WHEN 'schema_validating' THEN '模块事务 Schema 校验中'
        WHEN 'pending_approval' THEN '模块事务待审批'
        WHEN 'professional_review_required' THEN '模块事务需要专业复核'
        WHEN 'approved' THEN '模块事务已批准'
        WHEN 'archived' THEN '模块事务已归档'
        WHEN 'rejected' THEN '模块事务已驳回'
        WHEN 'blocked' THEN '模块事务已阻断'
        ELSE '模块事务状态变更'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION module_transactions_operation_runtime_side_effects()
RETURNS TRIGGER AS $$
DECLARE
    tenant_uuid UUID;
    project_uuid UUID;
    operation_status TEXT;
BEGIN
    BEGIN
        tenant_uuid := NEW.tenant_id::uuid;
        project_uuid := NEW.project_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN NEW;
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM module_database_operation_bindings b
        WHERE b.tenant_id = tenant_uuid
          AND b.project_id = project_uuid
          AND b.module_id = NEW.module_id
          AND b.operation_surface = 'module_operation_write'
          AND b.binding_state = 'active'
          AND b.write_policy <> 'read_only'
    ) THEN
        RETURN NEW;
    END IF;

    PERFORM set_config('app.current_tenant', tenant_uuid::text, true);
    operation_status := module_transaction_runtime_status(NEW.status);

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
        related_file_ids,
        related_artifact_ids,
        idempotency_key,
        request_payload,
        result_payload,
        evidence,
        professional_state,
        approval_state
    ) VALUES (
        tenant_uuid,
        project_uuid,
        NEW.module_id,
        'module_operation_write',
        'module.transaction.' || NEW.status,
        module_transaction_runtime_label(NEW.status),
        'module_lifecycle_transaction',
        operation_status,
        COALESCE(NULLIF(NEW.actor, ''), NULLIF(NEW.created_by, ''), 'module_transaction_runtime'),
        'module_transactions_table_trigger',
        'module_transaction',
        NEW.transaction_id::text,
        NEW.related_file_ids,
        NEW.related_artifact_ids,
        'module_transaction:' || NEW.transaction_id::text || ':' || NEW.status || ':' ||
            to_char(NEW.updated_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS'),
        jsonb_build_object(
            'transactionId', NEW.transaction_id,
            'moduleId', NEW.module_id,
            'transactionType', NEW.transaction_type,
            'status', NEW.status,
            'actor', NEW.actor,
            'relatedFileIds', NEW.related_file_ids,
            'relatedArtifactIds', NEW.related_artifact_ids
        ),
        jsonb_build_object(
            'acceptedBy', 'module_operation_runs',
            'sourceTable', 'module_transactions',
            'bridge', 'module_transaction_operation_runtime'
        ),
        jsonb_build_object(
            'trigger', TG_OP,
            'source', 'module_transactions_operation_runtime_side_effects',
            'transactionUpdatedAt', NEW.updated_at
        ),
        CASE
            WHEN NEW.status = 'approved' THEN 'approved'
            WHEN NEW.status = 'rejected' THEN 'rejected'
            WHEN NEW.status IN ('pending_approval', 'professional_review_required') THEN 'reviewing'
            ELSE 'professional_review_required'
        END,
        CASE
            WHEN NEW.status = 'approved' THEN 'approved'
            WHEN NEW.status = 'rejected' THEN 'rejected'
            WHEN NEW.status IN ('pending_approval', 'professional_review_required') THEN 'reviewing'
            ELSE 'approval_required'
        END
    )
    ON CONFLICT (tenant_id, project_id, module_id, idempotency_key) DO UPDATE SET
        operation_key = EXCLUDED.operation_key,
        operation_label = EXCLUDED.operation_label,
        operation_kind = EXCLUDED.operation_kind,
        status = EXCLUDED.status,
        actor = EXCLUDED.actor,
        source_surface = EXCLUDED.source_surface,
        target_type = EXCLUDED.target_type,
        target_id = EXCLUDED.target_id,
        related_file_ids = EXCLUDED.related_file_ids,
        related_artifact_ids = EXCLUDED.related_artifact_ids,
        request_payload = EXCLUDED.request_payload,
        result_payload = EXCLUDED.result_payload,
        evidence = EXCLUDED.evidence,
        professional_state = EXCLUDED.professional_state,
        approval_state = EXCLUDED.approval_state,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS module_transactions_operation_runtime_trigger ON module_transactions;
CREATE TRIGGER module_transactions_operation_runtime_trigger
AFTER INSERT OR UPDATE ON module_transactions
FOR EACH ROW EXECUTE FUNCTION module_transactions_operation_runtime_side_effects();

CREATE OR REPLACE FUNCTION module_transaction_approvals_operation_runtime_side_effects()
RETURNS TRIGGER AS $$
DECLARE
    tenant_uuid UUID;
    project_uuid UUID;
    tx_row module_transactions%ROWTYPE;
    operation_status TEXT;
BEGIN
    BEGIN
        tenant_uuid := NEW.tenant_id::uuid;
        project_uuid := NEW.project_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN NEW;
    END;

    SELECT *
    INTO tx_row
    FROM module_transactions t
    WHERE t.transaction_id = NEW.transaction_id
      AND t.tenant_id = NEW.tenant_id
      AND t.project_id = NEW.project_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM module_database_operation_bindings b
        WHERE b.tenant_id = tenant_uuid
          AND b.project_id = project_uuid
          AND b.module_id = tx_row.module_id
          AND b.operation_surface = 'module_operation_write'
          AND b.binding_state = 'active'
          AND b.write_policy <> 'read_only'
    ) THEN
        RETURN NEW;
    END IF;

    PERFORM set_config('app.current_tenant', tenant_uuid::text, true);
    operation_status := CASE WHEN NEW.decision = 'approved' THEN 'completed' ELSE 'failed' END;

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
        related_file_ids,
        related_artifact_ids,
        idempotency_key,
        request_payload,
        result_payload,
        evidence,
        professional_state,
        approval_state
    ) VALUES (
        tenant_uuid,
        project_uuid,
        tx_row.module_id,
        'module_operation_write',
        'module.transaction.approval.' || NEW.decision,
        CASE WHEN NEW.decision = 'approved' THEN '模块事务审批通过' ELSE '模块事务审批驳回' END,
        'module_lifecycle_approval',
        operation_status,
        COALESCE(NULLIF(NEW.approver, ''), NULLIF(NEW.created_by, ''), 'module_transaction_approval_runtime'),
        'module_transaction_approvals_table_trigger',
        'module_transaction_approval',
        NEW.approval_id::text,
        tx_row.related_file_ids,
        tx_row.related_artifact_ids,
        'module_transaction_approval:' || NEW.approval_id::text || ':' || NEW.decision || ':' ||
            to_char(NEW.decided_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS'),
        jsonb_build_object(
            'approvalId', NEW.approval_id,
            'transactionId', NEW.transaction_id,
            'moduleId', tx_row.module_id,
            'transactionType', tx_row.transaction_type,
            'decision', NEW.decision,
            'comment', NEW.decision_comment,
            'approver', NEW.approver
        ),
        jsonb_build_object(
            'acceptedBy', 'module_operation_runs',
            'sourceTable', 'module_transaction_approvals',
            'bridge', 'module_transaction_operation_runtime'
        ),
        jsonb_build_object(
            'trigger', TG_OP,
            'source', 'module_transaction_approvals_operation_runtime_side_effects',
            'decidedAt', NEW.decided_at
        ),
        CASE WHEN NEW.decision = 'approved' THEN 'approved' ELSE 'rejected' END,
        CASE WHEN NEW.decision = 'approved' THEN 'approved' ELSE 'rejected' END
    )
    ON CONFLICT (tenant_id, project_id, module_id, idempotency_key) DO UPDATE SET
        operation_key = EXCLUDED.operation_key,
        operation_label = EXCLUDED.operation_label,
        operation_kind = EXCLUDED.operation_kind,
        status = EXCLUDED.status,
        actor = EXCLUDED.actor,
        source_surface = EXCLUDED.source_surface,
        target_type = EXCLUDED.target_type,
        target_id = EXCLUDED.target_id,
        related_file_ids = EXCLUDED.related_file_ids,
        related_artifact_ids = EXCLUDED.related_artifact_ids,
        request_payload = EXCLUDED.request_payload,
        result_payload = EXCLUDED.result_payload,
        evidence = EXCLUDED.evidence,
        professional_state = EXCLUDED.professional_state,
        approval_state = EXCLUDED.approval_state,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS module_transaction_approvals_operation_runtime_trigger ON module_transaction_approvals;
CREATE TRIGGER module_transaction_approvals_operation_runtime_trigger
AFTER INSERT OR UPDATE ON module_transaction_approvals
FOR EACH ROW EXECUTE FUNCTION module_transaction_approvals_operation_runtime_side_effects();

WITH valid_module_transactions AS (
    SELECT
        t.*,
        t.tenant_id::uuid AS tenant_uuid,
        t.project_id::uuid AS project_uuid
    FROM module_transactions t
    WHERE t.tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND t.project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
INSERT INTO module_database_operation_bindings (
    tenant_id,
    project_id,
    module_id,
    operation_surface,
    relational_route,
    object_route,
    graph_route,
    event_route,
    analytics_route,
    audit_route,
    write_policy,
    binding_state,
    metadata
)
SELECT DISTINCT
    t.tenant_uuid AS tenant_id,
    t.project_uuid AS project_id,
    t.module_id,
    'module_operation_write',
    'postgres://public.' || t.module_id || '_business_tables',
    'object_store_bindings/module_files',
    'data_graph_edges',
    'data_event_outbox',
    'data_analytics_events',
    'audit_events',
    'approval_required',
    'active',
    jsonb_build_object(
        'routeOwner', 'ArchIToken LifecycleRouter/DataPlane',
        'source', 'module_transaction_operation_runtime_bridge',
        'bridgeReason', 'module_transactions and approvals must write through module_operation_runs',
        'professionalGate', 'Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver'
    )
FROM valid_module_transactions t
JOIN projects p ON p.id = t.project_uuid AND p.tenant_id = t.tenant_uuid
JOIN modules m ON m.id = t.module_id
WHERE m.enabled = TRUE
ON CONFLICT (tenant_id, project_id, module_id, operation_surface) DO UPDATE SET
    relational_route = EXCLUDED.relational_route,
    object_route = EXCLUDED.object_route,
    graph_route = EXCLUDED.graph_route,
    event_route = EXCLUDED.event_route,
    analytics_route = EXCLUDED.analytics_route,
    audit_route = EXCLUDED.audit_route,
    write_policy = EXCLUDED.write_policy,
    binding_state = EXCLUDED.binding_state,
    metadata = module_database_operation_bindings.metadata || EXCLUDED.metadata,
    updated_at = NOW();

UPDATE module_transactions t
SET updated_at = t.updated_at
WHERE t.tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND t.project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
      SELECT 1
      FROM module_database_operation_bindings b
      WHERE b.tenant_id = t.tenant_id::uuid
        AND b.project_id = t.project_id::uuid
        AND b.module_id = t.module_id
        AND b.operation_surface = 'module_operation_write'
        AND b.binding_state = 'active'
        AND b.write_policy <> 'read_only'
  );

UPDATE module_transaction_approvals a
SET decided_at = a.decided_at
WHERE a.tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND a.project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

CREATE OR REPLACE VIEW module_transaction_operation_runtime_status AS
WITH valid_module_transactions AS (
    SELECT
        t.*,
        t.tenant_id::uuid AS tenant_uuid,
        t.project_id::uuid AS project_uuid
    FROM module_transactions t
    WHERE t.tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND t.project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
SELECT
    t.tenant_uuid AS tenant_id,
    t.project_uuid AS project_id,
    t.module_id,
    m.zh_name AS module_zh_name,
    m.en_name AS module_en_name,
    t.transaction_id,
    t.transaction_type,
    t.status AS transaction_status,
    t.actor,
    t.related_file_ids,
    t.related_artifact_ids,
    t.created_at,
    t.updated_at,
    COALESCE(approvals.approval_count, 0)::bigint AS approval_count,
    COALESCE(ops.operation_run_count, 0)::bigint AS operation_run_count,
    ops.latest_operation_run_id,
    ops.latest_operation_key,
    ops.latest_operation_status,
    COALESCE(ops.event_count, 0)::bigint AS event_count,
    COALESCE(ops.audit_count, 0)::bigint AS audit_count,
    COALESCE(ops.graph_edge_count, 0)::bigint AS graph_edge_count,
    COALESCE(approval_ops.approval_operation_run_count, 0)::bigint AS approval_operation_run_count,
    CASE
        WHEN COALESCE(ops.operation_run_count, 0) > 0
         AND COALESCE(ops.event_count, 0) = COALESCE(ops.operation_run_count, 0)
         AND COALESCE(ops.audit_count, 0) = COALESCE(ops.operation_run_count, 0)
         AND COALESCE(ops.graph_edge_count, 0) = COALESCE(ops.operation_run_count, 0)
         AND COALESCE(approval_ops.approval_with_operation_count, 0) = COALESCE(approvals.approval_count, 0)
        THEN 'ready'
        ELSE 'blocked'
    END AS runtime_status,
    jsonb_strip_nulls(jsonb_build_object(
        'operation',
            CASE WHEN COALESCE(ops.operation_run_count, 0) > 0 THEN NULL ELSE 'transaction has no module operation runtime record' END,
        'event',
            CASE WHEN COALESCE(ops.event_count, 0) = COALESCE(ops.operation_run_count, 0) THEN NULL ELSE 'event count does not match transaction operation runs' END,
        'audit',
            CASE WHEN COALESCE(ops.audit_count, 0) = COALESCE(ops.operation_run_count, 0) THEN NULL ELSE 'audit count does not match transaction operation runs' END,
        'graph',
            CASE WHEN COALESCE(ops.graph_edge_count, 0) = COALESCE(ops.operation_run_count, 0) THEN NULL ELSE 'graph edge count does not match transaction operation runs' END,
        'approval',
            CASE WHEN COALESCE(approval_ops.approval_with_operation_count, 0) = COALESCE(approvals.approval_count, 0) THEN NULL ELSE 'not every approval row has operation runtime evidence' END
    )) AS issues
FROM valid_module_transactions t
JOIN modules m ON m.id = t.module_id
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS approval_count
    FROM module_transaction_approvals a
    WHERE a.tenant_id = t.tenant_id
      AND a.project_id = t.project_id
      AND a.transaction_id = t.transaction_id
) approvals ON true
LEFT JOIN LATERAL (
    SELECT
        COUNT(DISTINCT r.operation_run_id) AS operation_run_count,
        (ARRAY_AGG(r.operation_run_id ORDER BY r.updated_at DESC, r.operation_run_id))[1] AS latest_operation_run_id,
        (ARRAY_AGG(r.operation_key ORDER BY r.updated_at DESC, r.operation_run_id))[1] AS latest_operation_key,
        (ARRAY_AGG(r.status ORDER BY r.updated_at DESC, r.operation_run_id))[1] AS latest_operation_status,
        COUNT(DISTINCT e.id) AS event_count,
        COUNT(DISTINCT a.id) AS audit_count,
        COUNT(DISTINCT g.id) AS graph_edge_count
    FROM module_operation_runs r
    LEFT JOIN data_event_outbox e ON e.id = r.event_id
    LEFT JOIN audit_events a ON a.id = r.audit_event_id
    LEFT JOIN data_graph_edges g ON g.id = r.graph_edge_id
    WHERE r.tenant_id = t.tenant_uuid
      AND r.project_id = t.project_uuid
      AND r.module_id = t.module_id
      AND r.target_type = 'module_transaction'
      AND r.target_id = t.transaction_id::text
) ops ON true
LEFT JOIN LATERAL (
    SELECT
        COUNT(DISTINCT approval.approval_id) AS approval_with_operation_count,
        COUNT(DISTINCT r.operation_run_id) AS approval_operation_run_count
    FROM module_transaction_approvals approval
    JOIN module_operation_runs r
      ON r.tenant_id = t.tenant_uuid
     AND r.project_id = t.project_uuid
     AND r.module_id = t.module_id
     AND r.target_type = 'module_transaction_approval'
     AND r.target_id = approval.approval_id::text
    WHERE approval.tenant_id = t.tenant_id
      AND approval.project_id = t.project_id
      AND approval.transaction_id = t.transaction_id
) approval_ops ON true;

CREATE OR REPLACE VIEW module_transaction_operation_runtime_summary AS
SELECT
    tenant_id,
    project_id,
    COUNT(*)::bigint AS transaction_count,
    COUNT(*) FILTER (WHERE runtime_status = 'ready')::bigint AS ready_count,
    COUNT(*) FILTER (WHERE runtime_status = 'blocked')::bigint AS blocked_count,
    SUM(operation_run_count)::bigint AS operation_run_count,
    SUM(event_count)::bigint AS event_count,
    SUM(audit_count)::bigint AS audit_count,
    SUM(graph_edge_count)::bigint AS graph_edge_count,
    SUM(approval_count)::bigint AS approval_count,
    SUM(approval_operation_run_count)::bigint AS approval_operation_run_count
FROM module_transaction_operation_runtime_status
GROUP BY tenant_id, project_id;

COMMENT ON FUNCTION module_transactions_operation_runtime_side_effects IS 'Writes module lifecycle transaction inserts and updates into module_operation_runs, which then fans out to event, audit and graph stores.';
COMMENT ON FUNCTION module_transaction_approvals_operation_runtime_side_effects IS 'Writes module lifecycle approval decisions into module_operation_runs, which then fans out to event, audit and graph stores.';
COMMENT ON VIEW module_transaction_operation_runtime_status IS 'Per module lifecycle transaction runtime bridge status: each transaction and approval must have operation, event, audit and graph evidence.';
COMMENT ON VIEW module_transaction_operation_runtime_summary IS 'Full-count summary for module lifecycle transaction runtime readiness; do not limit this for production readiness.';
