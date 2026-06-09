-- License: Apache-2.0
-- ArchIToken global module operation runtime integrity view.

CREATE OR REPLACE VIEW module_operation_runtime_integrity AS
WITH operation_integrity AS (
    SELECT
        r.tenant_id,
        r.project_id,
        r.module_id,
        m.zh_name AS module_zh_name,
        m.en_name AS module_en_name,
        r.operation_run_id,
        r.operation_key,
        r.operation_label,
        r.operation_kind,
        r.status,
        r.actor,
        r.source_surface,
        r.target_type,
        r.target_id,
        r.professional_state,
        r.approval_state,
        r.event_id,
        r.audit_event_id,
        r.graph_edge_id,
        r.created_at,
        r.updated_at,
        b.binding_state,
        b.write_policy,
        (b.module_id IS NOT NULL
            AND b.binding_state = 'active'
            AND b.write_policy <> 'read_only') AS binding_ready,
        (e.id IS NOT NULL
            AND e.target_type = 'module_operation_run'
            AND e.target_id = r.operation_run_id::text
            AND e.event_type = 'module_operation.' || r.status) AS event_ready,
        (a.id IS NOT NULL
            AND a.target_type = 'module_operation_run'
            AND a.target_id = r.operation_run_id::text
            AND a.action = 'module_operation_' || r.status) AS audit_ready,
        (g.id IS NOT NULL
            AND g.to_entity_type = 'module_operation_run'
            AND g.to_entity_id = r.operation_run_id::text
            AND g.relationship_type = 'triggers_module_operation'
            AND g.source = 'module_operation_runtime'
            AND g.properties->>'status' = r.status) AS graph_ready
    FROM module_operation_runs r
    JOIN modules m ON m.id = r.module_id
    LEFT JOIN module_database_operation_bindings b
      ON b.tenant_id = r.tenant_id
     AND b.project_id = r.project_id
     AND b.module_id = r.module_id
     AND b.operation_surface = r.operation_surface
    LEFT JOIN data_event_outbox e ON e.id = r.event_id
    LEFT JOIN audit_events a ON a.id = r.audit_event_id
    LEFT JOIN data_graph_edges g ON g.id = r.graph_edge_id
)
SELECT
    tenant_id,
    project_id,
    module_id,
    module_zh_name,
    module_en_name,
    operation_run_id,
    operation_key,
    operation_label,
    operation_kind,
    status,
    actor,
    source_surface,
    target_type,
    target_id,
    professional_state,
    approval_state,
    event_id,
    audit_event_id,
    graph_edge_id,
    created_at,
    updated_at,
    binding_state,
    write_policy,
    binding_ready,
    event_ready,
    audit_ready,
    graph_ready,
    CASE
        WHEN binding_ready AND event_ready AND audit_ready AND graph_ready THEN 'ready'
        ELSE 'blocked'
    END AS integrity_status,
    jsonb_strip_nulls(jsonb_build_object(
        'binding',
            CASE WHEN binding_ready THEN NULL ELSE 'module operation binding is not active writable' END,
        'event',
            CASE WHEN event_ready THEN NULL ELSE 'event outbox row is missing or status does not match operation status' END,
        'audit',
            CASE WHEN audit_ready THEN NULL ELSE 'audit row is missing or action does not match operation status' END,
        'graph',
            CASE WHEN graph_ready THEN NULL ELSE 'graph edge is missing or status does not match operation status' END
    )) AS issues
FROM operation_integrity;

COMMENT ON VIEW module_operation_runtime_integrity IS 'Per operation-run production integrity view: active binding, event outbox, audit event and graph edge must all exist and match the current operation status.';
