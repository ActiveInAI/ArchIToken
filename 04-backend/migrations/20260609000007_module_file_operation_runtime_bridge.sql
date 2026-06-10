-- License: Apache-2.0
-- Bridge CDE module file operations into the global module operation runtime.

CREATE OR REPLACE FUNCTION module_files_operation_runtime_side_effects()
RETURNS TRIGGER AS $$
DECLARE
    tenant_uuid UUID;
    project_uuid UUID;
    operation_key TEXT;
    operation_label TEXT;
    operation_status TEXT;
    operation_actor TEXT;
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

    operation_key := CASE
        WHEN TG_OP = 'INSERT' THEN 'cde.file.created'
        WHEN NEW.status = 'soft_deleted' THEN 'cde.file.soft_deleted'
        WHEN NEW.status = 'archived' THEN 'cde.file.archived'
        ELSE 'cde.file.updated'
    END;
    operation_label := CASE
        WHEN TG_OP = 'INSERT' THEN 'CDE 文件创建'
        WHEN NEW.status = 'soft_deleted' THEN 'CDE 文件移入回收站'
        WHEN NEW.status = 'archived' THEN 'CDE 文件归档'
        ELSE 'CDE 文件更新'
    END;
    operation_status := 'completed';
    operation_actor := COALESCE(NULLIF(NEW.created_by, ''), NULLIF(NEW.owner, ''), 'module_file_runtime');

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
        idempotency_key,
        request_payload,
        result_payload,
        evidence
    ) VALUES (
        tenant_uuid,
        project_uuid,
        NEW.module_id,
        'module_operation_write',
        operation_key,
        operation_label,
        'cde_file_operation',
        operation_status,
        operation_actor,
        'module_files_table_trigger',
        'module_file',
        NEW.file_id::text,
        jsonb_build_array(NEW.file_id::text),
        'module_file:' || NEW.file_id::text || ':' || lower(TG_OP) || ':' ||
            to_char(
                CASE WHEN TG_OP = 'INSERT' THEN NEW.created_at ELSE NEW.updated_at END
                    AT TIME ZONE 'UTC',
                'YYYYMMDDHH24MISSUS'
            ),
        jsonb_build_object(
            'fileId', NEW.file_id,
            'moduleId', NEW.module_id,
            'name', NEW.name,
            'kind', NEW.kind,
            'status', NEW.status,
            'validationStatus', NEW.validation_status,
            'version', NEW.version,
            'sizeBytes', NEW.size_bytes,
            'mimeType', NEW.mime_type,
            'checksum', NEW.checksum,
            'parentId', NEW.parent_id
        ),
        jsonb_build_object(
            'acceptedBy', 'module_operation_runs',
            'sourceTable', 'module_files',
            'bridge', 'module_file_operation_runtime'
        ),
        jsonb_build_object(
            'trigger', TG_OP,
            'source', 'module_files_operation_runtime_side_effects',
            'fileUpdatedAt', NEW.updated_at
        )
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
        request_payload = EXCLUDED.request_payload,
        result_payload = EXCLUDED.result_payload,
        evidence = EXCLUDED.evidence,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS module_files_operation_runtime_trigger ON module_files;
CREATE TRIGGER module_files_operation_runtime_trigger
AFTER INSERT OR UPDATE ON module_files
FOR EACH ROW EXECUTE FUNCTION module_files_operation_runtime_side_effects();

WITH valid_module_files AS (
    SELECT
        f.*,
        f.tenant_id::uuid AS tenant_uuid,
        f.project_id::uuid AS project_uuid
    FROM module_files f
    WHERE f.tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND f.project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
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
    f.tenant_uuid AS tenant_id,
    f.project_uuid AS project_id,
    f.module_id,
    'module_operation_write',
    'postgres://public.' || f.module_id || '_business_tables',
    'object_store_bindings/module_files',
    'data_graph_edges',
    'data_event_outbox',
    'data_analytics_events',
    'audit_events',
    'approval_required',
    'active',
    jsonb_build_object(
        'routeOwner', 'ArchIToken StorageRouter/DataPlane',
        'source', 'module_file_operation_runtime_bridge',
        'bridgeReason', 'existing module_files must write through module_operation_runs',
        'professionalGate', 'Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver'
    )
FROM valid_module_files f
JOIN projects p ON p.id = f.project_uuid AND p.tenant_id = f.tenant_uuid
JOIN modules m ON m.id = f.module_id
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

UPDATE module_files f
SET updated_at = f.updated_at
WHERE f.tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND f.project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
      SELECT 1
      FROM module_database_operation_bindings b
      WHERE b.tenant_id = f.tenant_id::uuid
        AND b.project_id = f.project_id::uuid
        AND b.module_id = f.module_id
        AND b.operation_surface = 'module_operation_write'
        AND b.binding_state = 'active'
        AND b.write_policy <> 'read_only'
  );

CREATE OR REPLACE VIEW module_file_operation_runtime_status AS
WITH valid_module_files AS (
    SELECT
        f.*,
        f.tenant_id::uuid AS tenant_uuid,
        f.project_id::uuid AS project_uuid
    FROM module_files f
    WHERE f.tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND f.project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
SELECT
    f.tenant_uuid AS tenant_id,
    f.project_uuid AS project_id,
    f.module_id,
    m.zh_name AS module_zh_name,
    m.en_name AS module_en_name,
    f.file_id,
    f.parent_id,
    f.name,
    f.kind,
    f.status AS file_status,
    f.validation_status,
    f.version,
    f.owner,
    f.size_bytes,
    f.mime_type,
    f.checksum,
    f.created_at,
    f.updated_at,
    COALESCE(ops.operation_run_count, 0)::bigint AS operation_run_count,
    ops.latest_operation_run_id,
    ops.latest_operation_key,
    ops.latest_operation_status,
    COALESCE(ops.event_count, 0)::bigint AS event_count,
    COALESCE(ops.audit_count, 0)::bigint AS audit_count,
    COALESCE(ops.graph_edge_count, 0)::bigint AS graph_edge_count,
    CASE
        WHEN COALESCE(ops.operation_run_count, 0) > 0
         AND COALESCE(ops.event_count, 0) = COALESCE(ops.operation_run_count, 0)
         AND COALESCE(ops.audit_count, 0) = COALESCE(ops.operation_run_count, 0)
         AND COALESCE(ops.graph_edge_count, 0) = COALESCE(ops.operation_run_count, 0)
        THEN 'ready'
        ELSE 'blocked'
    END AS runtime_status,
    jsonb_strip_nulls(jsonb_build_object(
        'operation',
            CASE WHEN COALESCE(ops.operation_run_count, 0) > 0 THEN NULL ELSE 'file has no module operation runtime record' END,
        'event',
            CASE WHEN COALESCE(ops.event_count, 0) = COALESCE(ops.operation_run_count, 0) THEN NULL ELSE 'event count does not match file operation runs' END,
        'audit',
            CASE WHEN COALESCE(ops.audit_count, 0) = COALESCE(ops.operation_run_count, 0) THEN NULL ELSE 'audit count does not match file operation runs' END,
        'graph',
            CASE WHEN COALESCE(ops.graph_edge_count, 0) = COALESCE(ops.operation_run_count, 0) THEN NULL ELSE 'graph edge count does not match file operation runs' END
    )) AS issues
FROM valid_module_files f
JOIN modules m ON m.id = f.module_id
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
    WHERE r.tenant_id = f.tenant_uuid
      AND r.project_id = f.project_uuid
      AND r.module_id = f.module_id
      AND r.target_type = 'module_file'
      AND r.target_id = f.file_id::text
) ops ON true;

COMMENT ON FUNCTION module_files_operation_runtime_side_effects IS 'Writes CDE module file inserts and updates into module_operation_runs, which then fans out to event, audit and graph stores.';
COMMENT ON VIEW module_file_operation_runtime_status IS 'Per CDE module file runtime bridge status: each file should have module operation, event, audit and graph evidence.';
