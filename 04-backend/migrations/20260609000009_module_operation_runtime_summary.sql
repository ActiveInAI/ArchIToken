-- License: Apache-2.0
-- Fast, exact summaries for production database readiness.

CREATE OR REPLACE VIEW module_operation_runtime_status AS
SELECT
    b.tenant_id,
    b.project_id,
    b.module_id,
    m.zh_name AS module_zh_name,
    m.en_name AS module_en_name,
    b.operation_surface,
    b.write_policy,
    b.binding_state,
    b.relational_route,
    b.object_route,
    b.graph_route,
    b.event_route,
    b.analytics_route,
    b.audit_route,
    COUNT(DISTINCT r.operation_run_id)::bigint AS operation_run_count,
    COUNT(DISTINCT e.id)::bigint AS event_count,
    COUNT(DISTINCT a.id)::bigint AS audit_count,
    COUNT(DISTINCT g.id)::bigint AS graph_edge_count,
    MAX(r.updated_at) AS last_operation_at
FROM module_database_operation_bindings b
JOIN modules m ON m.id = b.module_id
LEFT JOIN module_operation_runs r
  ON r.tenant_id = b.tenant_id
 AND r.project_id = b.project_id
 AND r.module_id = b.module_id
 AND r.operation_surface = b.operation_surface
LEFT JOIN data_event_outbox e
  ON e.id = r.event_id
 AND e.target_type = 'module_operation_run'
 AND e.target_id = r.operation_run_id::text
 AND e.event_type = 'module_operation.' || r.status
LEFT JOIN audit_events a
  ON a.id = r.audit_event_id
 AND a.target_type = 'module_operation_run'
 AND a.target_id = r.operation_run_id::text
 AND a.action = 'module_operation_' || r.status
LEFT JOIN data_graph_edges g
  ON g.id = r.graph_edge_id
 AND g.to_entity_type = 'module_operation_run'
 AND g.to_entity_id = r.operation_run_id::text
 AND g.relationship_type = 'triggers_module_operation'
 AND g.source = 'module_operation_runtime'
 AND g.properties->>'status' = r.status
WHERE b.operation_surface = 'module_operation_write'
GROUP BY
    b.tenant_id,
    b.project_id,
    b.module_id,
    m.zh_name,
    m.en_name,
    b.operation_surface,
    b.write_policy,
    b.binding_state,
    b.relational_route,
    b.object_route,
    b.graph_route,
    b.event_route,
    b.analytics_route,
    b.audit_route;

CREATE OR REPLACE VIEW module_operation_runtime_summary AS
WITH binding_summary AS (
    SELECT
        b.tenant_id,
        b.project_id,
        b.module_id,
        b.operation_surface,
        b.binding_state,
        b.write_policy,
        COUNT(r.operation_run_id)::bigint AS operation_run_count
    FROM module_database_operation_bindings b
    LEFT JOIN module_operation_runs r
      ON r.tenant_id = b.tenant_id
     AND r.project_id = b.project_id
     AND r.module_id = b.module_id
     AND r.operation_surface = b.operation_surface
    WHERE b.operation_surface = 'module_operation_write'
    GROUP BY
        b.tenant_id,
        b.project_id,
        b.module_id,
        b.operation_surface,
        b.binding_state,
        b.write_policy
),
run_summary AS (
    SELECT
        r.tenant_id,
        r.project_id,
        r.module_id,
        r.operation_surface,
        COUNT(*)::bigint AS operation_run_count,
        COUNT(*) FILTER (
            WHERE e.id IS NOT NULL
              AND e.target_type = 'module_operation_run'
              AND e.target_id = r.operation_run_id::text
              AND e.event_type = 'module_operation.' || r.status
        )::bigint AS event_count,
        COUNT(*) FILTER (
            WHERE a.id IS NOT NULL
              AND a.target_type = 'module_operation_run'
              AND a.target_id = r.operation_run_id::text
              AND a.action = 'module_operation_' || r.status
        )::bigint AS audit_count,
        COUNT(*) FILTER (
            WHERE g.id IS NOT NULL
              AND g.to_entity_type = 'module_operation_run'
              AND g.to_entity_id = r.operation_run_id::text
              AND g.relationship_type = 'triggers_module_operation'
              AND g.source = 'module_operation_runtime'
              AND g.properties->>'status' = r.status
        )::bigint AS graph_edge_count,
        COUNT(*) FILTER (
            WHERE b.binding_state = 'active'
              AND b.write_policy <> 'read_only'
              AND e.id IS NOT NULL
              AND e.target_type = 'module_operation_run'
              AND e.target_id = r.operation_run_id::text
              AND e.event_type = 'module_operation.' || r.status
              AND a.id IS NOT NULL
              AND a.target_type = 'module_operation_run'
              AND a.target_id = r.operation_run_id::text
              AND a.action = 'module_operation_' || r.status
              AND g.id IS NOT NULL
              AND g.to_entity_type = 'module_operation_run'
              AND g.to_entity_id = r.operation_run_id::text
              AND g.relationship_type = 'triggers_module_operation'
              AND g.source = 'module_operation_runtime'
              AND g.properties->>'status' = r.status
        )::bigint AS integrity_ready_count,
        COUNT(*) FILTER (
            WHERE NOT (
                b.binding_state = 'active'
                AND b.write_policy <> 'read_only'
                AND e.id IS NOT NULL
                AND e.target_type = 'module_operation_run'
                AND e.target_id = r.operation_run_id::text
                AND e.event_type = 'module_operation.' || r.status
                AND a.id IS NOT NULL
                AND a.target_type = 'module_operation_run'
                AND a.target_id = r.operation_run_id::text
                AND a.action = 'module_operation_' || r.status
                AND g.id IS NOT NULL
                AND g.to_entity_type = 'module_operation_run'
                AND g.to_entity_id = r.operation_run_id::text
                AND g.relationship_type = 'triggers_module_operation'
                AND g.source = 'module_operation_runtime'
                AND g.properties->>'status' = r.status
            )
        )::bigint AS integrity_blocked_count
    FROM module_operation_runs r
    JOIN module_database_operation_bindings b
      ON b.tenant_id = r.tenant_id
     AND b.project_id = r.project_id
     AND b.module_id = r.module_id
     AND b.operation_surface = r.operation_surface
    LEFT JOIN data_event_outbox e ON e.id = r.event_id
    LEFT JOIN audit_events a ON a.id = r.audit_event_id
    LEFT JOIN data_graph_edges g ON g.id = r.graph_edge_id
    GROUP BY
        r.tenant_id,
        r.project_id,
        r.module_id,
        r.operation_surface
)
SELECT
    b.tenant_id,
    b.project_id,
    b.module_id,
    b.operation_surface,
    CASE
        WHEN b.binding_state = 'active' AND b.write_policy <> 'read_only'
        THEN 1::bigint ELSE 0::bigint
    END AS active_binding_count,
    COALESCE(r.operation_run_count, 0)::bigint AS operation_run_count,
    COALESCE(r.event_count, 0)::bigint AS event_count,
    COALESCE(r.audit_count, 0)::bigint AS audit_count,
    COALESCE(r.graph_edge_count, 0)::bigint AS graph_edge_count,
    CASE
        WHEN b.binding_state = 'active'
         AND b.write_policy <> 'read_only'
         AND b.operation_run_count = 0
        THEN 1::bigint ELSE 0::bigint
    END AS missing_operation_run_count,
    COALESCE(r.integrity_ready_count, 0)::bigint AS integrity_ready_count,
    COALESCE(r.integrity_blocked_count, 0)::bigint AS integrity_blocked_count
FROM binding_summary b
LEFT JOIN run_summary r
  ON r.tenant_id = b.tenant_id
 AND r.project_id = b.project_id
 AND r.module_id = b.module_id
 AND r.operation_surface = b.operation_surface;

COMMENT ON VIEW module_operation_runtime_status IS 'Per-module verification view for global module operation DataPlane bindings using exact operation-run side-effect IDs.';
COMMENT ON VIEW module_operation_runtime_summary IS 'Per binding fast summary for production readiness: active route coverage, operation runs, event, audit and graph integrity.';
