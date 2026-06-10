-- License: Apache-2.0
-- Production-facing database maturity and heavy-steel end-to-end readiness gates.
--
-- These views are intentionally derived from real DataPlane tables, trigger
-- side effects and drill evidence. They are not UI summary fixtures.

CREATE OR REPLACE VIEW database_ops_maturity_readiness AS
WITH tenant_scope AS (
    SELECT id AS tenant_id FROM tenants
),
module_runtime AS (
    SELECT
        tenant_id,
        SUM(active_binding_count)::bigint AS active_module_binding_count,
        SUM(operation_run_count)::bigint AS module_operation_run_count,
        SUM(event_count)::bigint AS module_operation_event_count,
        SUM(audit_count)::bigint AS module_operation_audit_count,
        SUM(graph_edge_count)::bigint AS module_operation_graph_edge_count,
        SUM(missing_operation_run_count)::bigint AS missing_operation_run_count,
        SUM(integrity_ready_count)::bigint AS integrity_ready_count,
        SUM(integrity_blocked_count)::bigint AS integrity_blocked_count
    FROM module_operation_runtime_summary
    GROUP BY tenant_id
),
file_runtime AS (
    SELECT
        tenant_id,
        COUNT(*)::bigint AS module_file_count,
        COUNT(*) FILTER (WHERE runtime_status = 'ready')::bigint AS module_file_ready_count,
        COUNT(*) FILTER (WHERE runtime_status = 'blocked')::bigint AS module_file_blocked_count,
        COALESCE(SUM(operation_run_count), 0)::bigint AS module_file_operation_run_count,
        COALESCE(SUM(event_count), 0)::bigint AS module_file_event_count,
        COALESCE(SUM(audit_count), 0)::bigint AS module_file_audit_count,
        COALESCE(SUM(graph_edge_count), 0)::bigint AS module_file_graph_edge_count
    FROM module_file_operation_runtime_status
    GROUP BY tenant_id
),
transaction_runtime AS (
    SELECT
        tenant_id,
        SUM(transaction_count)::bigint AS module_transaction_count,
        SUM(ready_count)::bigint AS module_transaction_ready_count,
        SUM(blocked_count)::bigint AS module_transaction_blocked_count,
        SUM(operation_run_count)::bigint AS module_transaction_operation_run_count,
        SUM(event_count)::bigint AS module_transaction_event_count,
        SUM(audit_count)::bigint AS module_transaction_audit_count,
        SUM(graph_edge_count)::bigint AS module_transaction_graph_edge_count,
        SUM(approval_count)::bigint AS module_transaction_approval_count,
        SUM(approval_operation_run_count)::bigint AS module_transaction_approval_operation_run_count
    FROM module_transaction_operation_runtime_summary
    GROUP BY tenant_id
)
SELECT
    t.tenant_id,
    COALESCE(o.bastion_session_count, 0)::bigint AS bastion_session_count,
    COALESCE(o.command_event_count, 0)::bigint AS command_event_count,
    COALESCE(o.archive_batch_count, 0)::bigint AS archive_batch_count,
    COALESCE(o.missing_recording_count, 0)::bigint AS missing_recording_count,
    COALESCE(o.pending_archive_count, 0)::bigint AS pending_archive_count,
    COALESCE(o.p0_gate_state, 'blocked_no_audit_archive')::text AS audit_archive_gate_state,
    COALESCE(b.active_policy_count, 0)::bigint AS active_backup_policy_count,
    COALESCE(b.successful_backup_count, 0)::bigint AS successful_backup_count,
    COALESCE(b.passed_restore_drill_count, 0)::bigint AS passed_restore_drill_count,
    b.last_successful_backup_at,
    b.last_passed_restore_drill_at,
    COALESCE(b.p0_gate_state, 'blocked_no_backup_restore_drill')::text AS backup_restore_gate_state,
    COALESCE(m.active_module_binding_count, 0)::bigint AS active_module_binding_count,
    COALESCE(m.module_operation_run_count, 0)::bigint AS module_operation_run_count,
    COALESCE(m.module_operation_event_count, 0)::bigint AS module_operation_event_count,
    COALESCE(m.module_operation_audit_count, 0)::bigint AS module_operation_audit_count,
    COALESCE(m.module_operation_graph_edge_count, 0)::bigint AS module_operation_graph_edge_count,
    COALESCE(m.missing_operation_run_count, 0)::bigint AS missing_operation_run_count,
    COALESCE(m.integrity_ready_count, 0)::bigint AS integrity_ready_count,
    COALESCE(m.integrity_blocked_count, 0)::bigint AS integrity_blocked_count,
    COALESCE(f.module_file_count, 0)::bigint AS module_file_count,
    COALESCE(f.module_file_ready_count, 0)::bigint AS module_file_ready_count,
    COALESCE(f.module_file_blocked_count, 0)::bigint AS module_file_blocked_count,
    COALESCE(f.module_file_operation_run_count, 0)::bigint AS module_file_operation_run_count,
    COALESCE(f.module_file_event_count, 0)::bigint AS module_file_event_count,
    COALESCE(f.module_file_audit_count, 0)::bigint AS module_file_audit_count,
    COALESCE(f.module_file_graph_edge_count, 0)::bigint AS module_file_graph_edge_count,
    COALESCE(tx.module_transaction_count, 0)::bigint AS module_transaction_count,
    COALESCE(tx.module_transaction_ready_count, 0)::bigint AS module_transaction_ready_count,
    COALESCE(tx.module_transaction_blocked_count, 0)::bigint AS module_transaction_blocked_count,
    COALESCE(tx.module_transaction_operation_run_count, 0)::bigint AS module_transaction_operation_run_count,
    COALESCE(tx.module_transaction_event_count, 0)::bigint AS module_transaction_event_count,
    COALESCE(tx.module_transaction_audit_count, 0)::bigint AS module_transaction_audit_count,
    COALESCE(tx.module_transaction_graph_edge_count, 0)::bigint AS module_transaction_graph_edge_count,
    COALESCE(tx.module_transaction_approval_count, 0)::bigint AS module_transaction_approval_count,
    COALESCE(tx.module_transaction_approval_operation_run_count, 0)::bigint AS module_transaction_approval_operation_run_count,
    CASE
        WHEN COALESCE(o.p0_gate_state, 'blocked_no_audit_archive') <> 'passed'
            THEN COALESCE(o.p0_gate_state, 'blocked_no_audit_archive')
        WHEN COALESCE(b.p0_gate_state, 'blocked_no_backup_restore_drill') <> 'passed'
            THEN COALESCE(b.p0_gate_state, 'blocked_no_backup_restore_drill')
        WHEN COALESCE(m.active_module_binding_count, 0) = 0
            THEN 'blocked_no_module_operation_bindings'
        WHEN COALESCE(m.module_operation_run_count, 0) = 0
            THEN 'blocked_no_module_operation_runs'
        WHEN COALESCE(m.missing_operation_run_count, 0) > 0
            THEN 'blocked_missing_module_operation_runs'
        WHEN COALESCE(m.integrity_blocked_count, 0) > 0
            THEN 'blocked_module_operation_integrity'
        WHEN COALESCE(m.module_operation_event_count, 0) <> COALESCE(m.module_operation_run_count, 0)
          OR COALESCE(m.module_operation_audit_count, 0) <> COALESCE(m.module_operation_run_count, 0)
          OR COALESCE(m.module_operation_graph_edge_count, 0) <> COALESCE(m.module_operation_run_count, 0)
            THEN 'blocked_module_operation_side_effects'
        WHEN COALESCE(f.module_file_count, 0) = 0
            THEN 'blocked_no_module_files'
        WHEN COALESCE(f.module_file_blocked_count, 0) > 0
          OR COALESCE(f.module_file_ready_count, 0) <> COALESCE(f.module_file_count, 0)
            THEN 'blocked_module_file_runtime'
        WHEN COALESCE(tx.module_transaction_count, 0) = 0
            THEN 'blocked_no_module_transactions'
        WHEN COALESCE(tx.module_transaction_blocked_count, 0) > 0
          OR COALESCE(tx.module_transaction_ready_count, 0) <> COALESCE(tx.module_transaction_count, 0)
            THEN 'blocked_module_transaction_runtime'
        WHEN COALESCE(tx.module_transaction_approval_operation_run_count, 0) < COALESCE(tx.module_transaction_approval_count, 0)
            THEN 'blocked_module_transaction_approvals'
        ELSE 'passed'
    END AS p0_gate_state,
    CASE
        WHEN COALESCE(o.p0_gate_state, 'blocked_no_audit_archive') = 'passed'
         AND COALESCE(b.p0_gate_state, 'blocked_no_backup_restore_drill') = 'passed'
         AND COALESCE(m.active_module_binding_count, 0) > 0
         AND COALESCE(m.module_operation_run_count, 0) > 0
         AND COALESCE(m.missing_operation_run_count, 0) = 0
         AND COALESCE(m.integrity_blocked_count, 0) = 0
         AND COALESCE(f.module_file_count, 0) > 0
         AND COALESCE(f.module_file_ready_count, 0) = COALESCE(f.module_file_count, 0)
         AND COALESCE(tx.module_transaction_count, 0) > 0
         AND COALESCE(tx.module_transaction_ready_count, 0) = COALESCE(tx.module_transaction_count, 0)
        THEN 'alpha_p0_integrated'
        ELSE 'blocked'
    END AS maturity_level,
    jsonb_strip_nulls(jsonb_build_object(
        'auditArchive',
            CASE WHEN COALESCE(o.p0_gate_state, 'blocked_no_audit_archive') = 'passed'
                THEN NULL ELSE COALESCE(o.p0_gate_state, 'blocked_no_audit_archive') END,
        'backupRestore',
            CASE WHEN COALESCE(b.p0_gate_state, 'blocked_no_backup_restore_drill') = 'passed'
                THEN NULL ELSE COALESCE(b.p0_gate_state, 'blocked_no_backup_restore_drill') END,
        'moduleOperationBindings',
            CASE WHEN COALESCE(m.active_module_binding_count, 0) > 0
                THEN NULL ELSE 'no active module operation bindings' END,
        'moduleOperationIntegrity',
            CASE WHEN COALESCE(m.integrity_blocked_count, 0) = 0
                THEN NULL ELSE 'module operation event/audit/graph integrity has blocked rows' END,
        'moduleFiles',
            CASE WHEN COALESCE(f.module_file_count, 0) > 0
                  AND COALESCE(f.module_file_ready_count, 0) = COALESCE(f.module_file_count, 0)
                  AND COALESCE(f.module_file_blocked_count, 0) = 0
                THEN NULL ELSE 'module files are not fully bridged into operation runtime' END,
        'moduleTransactions',
            CASE WHEN COALESCE(tx.module_transaction_count, 0) > 0
                  AND COALESCE(tx.module_transaction_ready_count, 0) = COALESCE(tx.module_transaction_count, 0)
                  AND COALESCE(tx.module_transaction_blocked_count, 0) = 0
                THEN NULL ELSE 'module transactions are not fully bridged into operation runtime' END
    )) AS issues
FROM tenant_scope t
LEFT JOIN operations_audit_log_archive_readiness o ON o.tenant_id = t.tenant_id
LEFT JOIN backup_restore_p0_readiness b ON b.tenant_id = t.tenant_id
LEFT JOIN module_runtime m ON m.tenant_id = t.tenant_id
LEFT JOIN file_runtime f ON f.tenant_id = t.tenant_id
LEFT JOIN transaction_runtime tx ON tx.tenant_id = t.tenant_id;

CREATE OR REPLACE VIEW heavy_steel_end_to_end_readiness AS
WITH module_runtime AS (
    SELECT
        tenant_id,
        project_id,
        SUM(active_binding_count)::bigint AS active_module_binding_count,
        SUM(operation_run_count)::bigint AS module_operation_run_count,
        SUM(event_count)::bigint AS module_operation_event_count,
        SUM(audit_count)::bigint AS module_operation_audit_count,
        SUM(graph_edge_count)::bigint AS module_operation_graph_edge_count,
        SUM(missing_operation_run_count)::bigint AS missing_operation_run_count,
        SUM(integrity_ready_count)::bigint AS integrity_ready_count,
        SUM(integrity_blocked_count)::bigint AS integrity_blocked_count
    FROM module_operation_runtime_summary
    GROUP BY tenant_id, project_id
),
file_runtime AS (
    SELECT
        tenant_id,
        project_id,
        COUNT(*)::bigint AS module_file_count,
        COUNT(*) FILTER (WHERE runtime_status = 'ready')::bigint AS module_file_ready_count,
        COUNT(*) FILTER (WHERE runtime_status = 'blocked')::bigint AS module_file_blocked_count,
        COALESCE(SUM(operation_run_count), 0)::bigint AS module_file_operation_run_count,
        COALESCE(SUM(event_count), 0)::bigint AS module_file_event_count,
        COALESCE(SUM(audit_count), 0)::bigint AS module_file_audit_count,
        COALESCE(SUM(graph_edge_count), 0)::bigint AS module_file_graph_edge_count
    FROM module_file_operation_runtime_status
    GROUP BY tenant_id, project_id
),
transaction_runtime AS (
    SELECT
        tenant_id,
        project_id,
        SUM(transaction_count)::bigint AS module_transaction_count,
        SUM(ready_count)::bigint AS module_transaction_ready_count,
        SUM(blocked_count)::bigint AS module_transaction_blocked_count,
        SUM(operation_run_count)::bigint AS module_transaction_operation_run_count,
        SUM(event_count)::bigint AS module_transaction_event_count,
        SUM(audit_count)::bigint AS module_transaction_audit_count,
        SUM(graph_edge_count)::bigint AS module_transaction_graph_edge_count,
        SUM(approval_count)::bigint AS module_transaction_approval_count,
        SUM(approval_operation_run_count)::bigint AS module_transaction_approval_operation_run_count
    FROM module_transaction_operation_runtime_summary
    GROUP BY tenant_id, project_id
),
heavy_steel_operation_integrity AS (
    SELECT
        r.tenant_id,
        r.project_id,
        COUNT(*)::bigint AS heavy_steel_operation_run_count,
        COUNT(*) FILTER (
            WHERE e.id IS NOT NULL
              AND e.target_type = 'heavy_steel_module_operation_run'
              AND e.target_id = r.operation_run_id::text
              AND e.event_type = 'heavy_steel.module_operation.' || r.status
        )::bigint AS heavy_steel_event_count,
        COUNT(*) FILTER (
            WHERE a.id IS NOT NULL
              AND a.target_type = 'heavy_steel_module_operation_run'
              AND a.target_id = r.operation_run_id::text
              AND a.action = 'heavy_steel_module_operation_' || r.status
        )::bigint AS heavy_steel_audit_count,
        COUNT(*) FILTER (
            WHERE g.id IS NOT NULL
              AND g.to_entity_type = 'heavy_steel_module_operation_run'
              AND g.to_entity_id = r.operation_run_id::text
              AND g.relationship_type = 'triggers_module_database_operation'
              AND g.source = 'heavy_steel_module_operation_runtime'
        )::bigint AS heavy_steel_graph_edge_count
    FROM heavy_steel_module_operation_runs r
    LEFT JOIN data_event_outbox e ON e.id = r.event_id
    LEFT JOIN audit_events a ON a.id = r.audit_event_id
    LEFT JOIN data_graph_edges g ON g.id = r.graph_edge_id
    GROUP BY r.tenant_id, r.project_id
)
SELECT
    b.tenant_id,
    b.project_id,
    b.program_id,
    b.source_drawing_count::bigint,
    b.source_package_count::bigint,
    b.source_section_count::bigint,
    b.bound_module_count::bigint,
    b.package_work_item_count::bigint,
    b.module_work_order_count::bigint,
    b.bom_document_count::bigint,
    b.bom_version_count::bigint,
    b.bom_line_count::bigint,
    b.bom_total_quantity::numeric,
    b.bom_line_source_count::bigint,
    b.downstream_link_count::bigint,
    b.graph_edge_count::bigint AS bridge_graph_edge_count,
    b.event_count::bigint AS bridge_event_count,
    b.analytics_count::bigint AS bridge_analytics_count,
    b.audit_count::bigint AS bridge_audit_count,
    COALESCE(f.module_file_count, 0)::bigint AS module_file_count,
    COALESCE(f.module_file_ready_count, 0)::bigint AS module_file_ready_count,
    COALESCE(f.module_file_blocked_count, 0)::bigint AS module_file_blocked_count,
    COALESCE(f.module_file_operation_run_count, 0)::bigint AS module_file_operation_run_count,
    COALESCE(f.module_file_event_count, 0)::bigint AS module_file_event_count,
    COALESCE(f.module_file_audit_count, 0)::bigint AS module_file_audit_count,
    COALESCE(f.module_file_graph_edge_count, 0)::bigint AS module_file_graph_edge_count,
    COALESCE(tx.module_transaction_count, 0)::bigint AS module_transaction_count,
    COALESCE(tx.module_transaction_ready_count, 0)::bigint AS module_transaction_ready_count,
    COALESCE(tx.module_transaction_blocked_count, 0)::bigint AS module_transaction_blocked_count,
    COALESCE(tx.module_transaction_operation_run_count, 0)::bigint AS module_transaction_operation_run_count,
    COALESCE(tx.module_transaction_event_count, 0)::bigint AS module_transaction_event_count,
    COALESCE(tx.module_transaction_audit_count, 0)::bigint AS module_transaction_audit_count,
    COALESCE(tx.module_transaction_graph_edge_count, 0)::bigint AS module_transaction_graph_edge_count,
    COALESCE(tx.module_transaction_approval_count, 0)::bigint AS module_transaction_approval_count,
    COALESCE(tx.module_transaction_approval_operation_run_count, 0)::bigint AS module_transaction_approval_operation_run_count,
    COALESCE(m.active_module_binding_count, 0)::bigint AS active_module_binding_count,
    COALESCE(m.module_operation_run_count, 0)::bigint AS module_operation_run_count,
    COALESCE(m.module_operation_event_count, 0)::bigint AS module_operation_event_count,
    COALESCE(m.module_operation_audit_count, 0)::bigint AS module_operation_audit_count,
    COALESCE(m.module_operation_graph_edge_count, 0)::bigint AS module_operation_graph_edge_count,
    COALESCE(m.missing_operation_run_count, 0)::bigint AS missing_operation_run_count,
    COALESCE(m.integrity_ready_count, 0)::bigint AS integrity_ready_count,
    COALESCE(m.integrity_blocked_count, 0)::bigint AS integrity_blocked_count,
    COALESCE(h.heavy_steel_operation_run_count, 0)::bigint AS heavy_steel_operation_run_count,
    COALESCE(h.heavy_steel_event_count, 0)::bigint AS heavy_steel_event_count,
    COALESCE(h.heavy_steel_audit_count, 0)::bigint AS heavy_steel_audit_count,
    COALESCE(h.heavy_steel_graph_edge_count, 0)::bigint AS heavy_steel_graph_edge_count,
    COALESCE(o.audit_archive_gate_state, 'blocked_no_audit_archive')::text AS audit_archive_gate_state,
    COALESCE(o.backup_restore_gate_state, 'blocked_no_backup_restore_drill')::text AS backup_restore_gate_state,
    COALESCE(o.p0_gate_state, 'blocked_database_ops_maturity')::text AS ops_maturity_gate_state,
    CASE
        WHEN COALESCE(o.p0_gate_state, 'blocked_database_ops_maturity') <> 'passed'
            THEN COALESCE(o.p0_gate_state, 'blocked_database_ops_maturity')
        WHEN b.source_drawing_count IS NULL OR b.source_drawing_count <= 0
            THEN 'blocked_no_source_drawings'
        WHEN b.source_package_count <= 0 OR b.source_section_count <= 0
            THEN 'blocked_no_source_package_or_section'
        WHEN b.package_work_item_count < b.source_package_count
            THEN 'blocked_package_work_items_not_mapped'
        WHEN b.bound_module_count <= 0
            THEN 'blocked_no_module_bindings'
        WHEN b.module_work_order_count < b.bound_module_count
            THEN 'blocked_module_work_orders_not_mapped'
        WHEN b.bom_document_count <= 0 OR b.bom_version_count <= 0 OR b.bom_line_count <= 0
            THEN 'blocked_no_bom_source'
        WHEN b.bom_line_source_count < b.bom_line_count
            THEN 'blocked_bom_line_source_trace_missing'
        WHEN b.downstream_link_count < b.bom_line_count
            THEN 'blocked_bom_downstream_links_missing'
        WHEN COALESCE(f.module_file_count, 0) = 0
            THEN 'blocked_no_cde_files'
        WHEN COALESCE(f.module_file_blocked_count, 0) > 0
          OR COALESCE(f.module_file_ready_count, 0) <> COALESCE(f.module_file_count, 0)
            THEN 'blocked_cde_file_runtime'
        WHEN COALESCE(tx.module_transaction_count, 0) = 0
            THEN 'blocked_no_module_transactions'
        WHEN COALESCE(tx.module_transaction_blocked_count, 0) > 0
          OR COALESCE(tx.module_transaction_ready_count, 0) <> COALESCE(tx.module_transaction_count, 0)
            THEN 'blocked_module_transaction_runtime'
        WHEN COALESCE(m.active_module_binding_count, 0) < b.bound_module_count
            THEN 'blocked_global_module_bindings_below_heavy_steel_bindings'
        WHEN COALESCE(m.integrity_blocked_count, 0) > 0
          OR COALESCE(m.missing_operation_run_count, 0) > 0
            THEN 'blocked_global_module_operation_integrity'
        WHEN COALESCE(h.heavy_steel_operation_run_count, 0) = 0
            THEN 'blocked_no_heavy_steel_module_operations'
        WHEN COALESCE(h.heavy_steel_event_count, 0) <> COALESCE(h.heavy_steel_operation_run_count, 0)
          OR COALESCE(h.heavy_steel_audit_count, 0) <> COALESCE(h.heavy_steel_operation_run_count, 0)
          OR COALESCE(h.heavy_steel_graph_edge_count, 0) <> COALESCE(h.heavy_steel_operation_run_count, 0)
            THEN 'blocked_heavy_steel_operation_side_effects'
        ELSE 'passed'
    END AS p0_gate_state,
    jsonb_strip_nulls(jsonb_build_object(
        'sourceDrawings',
            CASE WHEN b.source_drawing_count > 0 THEN NULL ELSE 'no source drawing catalog' END,
        'packageMapping',
            CASE WHEN b.package_work_item_count >= b.source_package_count THEN NULL ELSE 'not every drawing package has a work item' END,
        'moduleWorkOrders',
            CASE WHEN b.module_work_order_count >= b.bound_module_count THEN NULL ELSE 'module work orders do not cover all bound modules' END,
        'bom',
            CASE WHEN b.bom_document_count > 0 AND b.bom_version_count > 0 AND b.bom_line_count > 0 THEN NULL ELSE 'no BOM source document/version/lines' END,
        'bomLineSource',
            CASE WHEN b.bom_line_source_count >= b.bom_line_count THEN NULL ELSE 'some BOM lines do not trace back to workbook rows' END,
        'downstreamLinks',
            CASE WHEN b.downstream_link_count >= b.bom_line_count THEN NULL ELSE 'BOM lines are not linked downstream' END,
        'cdeFiles',
            CASE WHEN COALESCE(f.module_file_count, 0) > 0
                  AND COALESCE(f.module_file_ready_count, 0) = COALESCE(f.module_file_count, 0)
                  AND COALESCE(f.module_file_blocked_count, 0) = 0
                THEN NULL ELSE 'CDE files are not fully operation-runtime ready' END,
        'moduleTransactions',
            CASE WHEN COALESCE(tx.module_transaction_count, 0) > 0
                  AND COALESCE(tx.module_transaction_ready_count, 0) = COALESCE(tx.module_transaction_count, 0)
                  AND COALESCE(tx.module_transaction_blocked_count, 0) = 0
                THEN NULL ELSE 'module transactions are not fully operation-runtime ready' END,
        'heavySteelOperations',
            CASE WHEN COALESCE(h.heavy_steel_operation_run_count, 0) > 0
                  AND COALESCE(h.heavy_steel_event_count, 0) = COALESCE(h.heavy_steel_operation_run_count, 0)
                  AND COALESCE(h.heavy_steel_audit_count, 0) = COALESCE(h.heavy_steel_operation_run_count, 0)
                  AND COALESCE(h.heavy_steel_graph_edge_count, 0) = COALESCE(h.heavy_steel_operation_run_count, 0)
                THEN NULL ELSE 'heavy-steel operations do not have exact event/audit/graph side effects' END,
        'opsMaturity',
            CASE WHEN COALESCE(o.p0_gate_state, 'blocked_database_ops_maturity') = 'passed'
                THEN NULL ELSE COALESCE(o.p0_gate_state, 'blocked_database_ops_maturity') END
    )) AS issues
FROM heavy_steel_database_bridge_status b
LEFT JOIN module_runtime m
  ON m.tenant_id = b.tenant_id
 AND m.project_id = b.project_id
LEFT JOIN file_runtime f
  ON f.tenant_id = b.tenant_id
 AND f.project_id = b.project_id
LEFT JOIN transaction_runtime tx
  ON tx.tenant_id = b.tenant_id
 AND tx.project_id = b.project_id
LEFT JOIN heavy_steel_operation_integrity h
  ON h.tenant_id = b.tenant_id
 AND h.project_id = b.project_id
LEFT JOIN database_ops_maturity_readiness o
  ON o.tenant_id = b.tenant_id;

-- Replace the broad CTE version above with project-scoped lateral probes. This
-- keeps readiness cheap when module operation and transaction tables are large.
CREATE OR REPLACE VIEW heavy_steel_end_to_end_readiness AS
SELECT
    b.tenant_id,
    b.project_id,
    b.program_id,
    b.source_drawing_count::bigint,
    b.source_package_count::bigint,
    b.source_section_count::bigint,
    b.bound_module_count::bigint,
    b.package_work_item_count::bigint,
    b.module_work_order_count::bigint,
    b.bom_document_count::bigint,
    b.bom_version_count::bigint,
    b.bom_line_count::bigint,
    b.bom_total_quantity::numeric,
    b.bom_line_source_count::bigint,
    b.downstream_link_count::bigint,
    b.graph_edge_count::bigint AS bridge_graph_edge_count,
    b.event_count::bigint AS bridge_event_count,
    b.analytics_count::bigint AS bridge_analytics_count,
    b.audit_count::bigint AS bridge_audit_count,
    COALESCE(f.module_file_count, 0)::bigint AS module_file_count,
    COALESCE(f.module_file_ready_count, 0)::bigint AS module_file_ready_count,
    COALESCE(f.module_file_blocked_count, 0)::bigint AS module_file_blocked_count,
    COALESCE(f.module_file_operation_run_count, 0)::bigint AS module_file_operation_run_count,
    COALESCE(f.module_file_event_count, 0)::bigint AS module_file_event_count,
    COALESCE(f.module_file_audit_count, 0)::bigint AS module_file_audit_count,
    COALESCE(f.module_file_graph_edge_count, 0)::bigint AS module_file_graph_edge_count,
    COALESCE(tx.module_transaction_count, 0)::bigint AS module_transaction_count,
    COALESCE(tx.module_transaction_ready_count, 0)::bigint AS module_transaction_ready_count,
    COALESCE(tx.module_transaction_blocked_count, 0)::bigint AS module_transaction_blocked_count,
    COALESCE(tx.module_transaction_operation_run_count, 0)::bigint AS module_transaction_operation_run_count,
    COALESCE(tx.module_transaction_event_count, 0)::bigint AS module_transaction_event_count,
    COALESCE(tx.module_transaction_audit_count, 0)::bigint AS module_transaction_audit_count,
    COALESCE(tx.module_transaction_graph_edge_count, 0)::bigint AS module_transaction_graph_edge_count,
    COALESCE(tx.module_transaction_approval_count, 0)::bigint AS module_transaction_approval_count,
    COALESCE(tx.module_transaction_approval_operation_run_count, 0)::bigint AS module_transaction_approval_operation_run_count,
    COALESCE(m.active_module_binding_count, 0)::bigint AS active_module_binding_count,
    COALESCE(m.module_operation_run_count, 0)::bigint AS module_operation_run_count,
    COALESCE(m.module_operation_event_count, 0)::bigint AS module_operation_event_count,
    COALESCE(m.module_operation_audit_count, 0)::bigint AS module_operation_audit_count,
    COALESCE(m.module_operation_graph_edge_count, 0)::bigint AS module_operation_graph_edge_count,
    COALESCE(m.missing_operation_run_count, 0)::bigint AS missing_operation_run_count,
    COALESCE(m.integrity_ready_count, 0)::bigint AS integrity_ready_count,
    COALESCE(m.integrity_blocked_count, 0)::bigint AS integrity_blocked_count,
    COALESCE(h.heavy_steel_operation_run_count, 0)::bigint AS heavy_steel_operation_run_count,
    COALESCE(h.heavy_steel_event_count, 0)::bigint AS heavy_steel_event_count,
    COALESCE(h.heavy_steel_audit_count, 0)::bigint AS heavy_steel_audit_count,
    COALESCE(h.heavy_steel_graph_edge_count, 0)::bigint AS heavy_steel_graph_edge_count,
    COALESCE(o.audit_archive_gate_state, 'blocked_no_audit_archive')::text AS audit_archive_gate_state,
    COALESCE(o.backup_restore_gate_state, 'blocked_no_backup_restore_drill')::text AS backup_restore_gate_state,
    COALESCE(o.p0_gate_state, 'blocked_database_ops_maturity')::text AS ops_maturity_gate_state,
    CASE
        WHEN COALESCE(o.p0_gate_state, 'blocked_database_ops_maturity') <> 'passed'
            THEN COALESCE(o.p0_gate_state, 'blocked_database_ops_maturity')
        WHEN b.source_drawing_count IS NULL OR b.source_drawing_count <= 0
            THEN 'blocked_no_source_drawings'
        WHEN b.source_package_count <= 0 OR b.source_section_count <= 0
            THEN 'blocked_no_source_package_or_section'
        WHEN b.package_work_item_count < b.source_package_count
            THEN 'blocked_package_work_items_not_mapped'
        WHEN b.bound_module_count <= 0
            THEN 'blocked_no_module_bindings'
        WHEN b.module_work_order_count < b.bound_module_count
            THEN 'blocked_module_work_orders_not_mapped'
        WHEN b.bom_document_count <= 0 OR b.bom_version_count <= 0 OR b.bom_line_count <= 0
            THEN 'blocked_no_bom_source'
        WHEN b.bom_line_source_count < b.bom_line_count
            THEN 'blocked_bom_line_source_trace_missing'
        WHEN b.downstream_link_count < b.bom_line_count
            THEN 'blocked_bom_downstream_links_missing'
        WHEN COALESCE(f.module_file_count, 0) = 0
            THEN 'blocked_no_cde_files'
        WHEN COALESCE(f.module_file_blocked_count, 0) > 0
          OR COALESCE(f.module_file_ready_count, 0) <> COALESCE(f.module_file_count, 0)
            THEN 'blocked_cde_file_runtime'
        WHEN COALESCE(tx.module_transaction_count, 0) = 0
            THEN 'blocked_no_module_transactions'
        WHEN COALESCE(tx.module_transaction_blocked_count, 0) > 0
          OR COALESCE(tx.module_transaction_ready_count, 0) <> COALESCE(tx.module_transaction_count, 0)
            THEN 'blocked_module_transaction_runtime'
        WHEN COALESCE(m.active_module_binding_count, 0) < b.bound_module_count
            THEN 'blocked_global_module_bindings_below_heavy_steel_bindings'
        WHEN COALESCE(m.integrity_blocked_count, 0) > 0
          OR COALESCE(m.missing_operation_run_count, 0) > 0
            THEN 'blocked_global_module_operation_integrity'
        WHEN COALESCE(h.heavy_steel_operation_run_count, 0) = 0
            THEN 'blocked_no_heavy_steel_module_operations'
        WHEN COALESCE(h.heavy_steel_event_count, 0) <> COALESCE(h.heavy_steel_operation_run_count, 0)
          OR COALESCE(h.heavy_steel_audit_count, 0) <> COALESCE(h.heavy_steel_operation_run_count, 0)
          OR COALESCE(h.heavy_steel_graph_edge_count, 0) <> COALESCE(h.heavy_steel_operation_run_count, 0)
            THEN 'blocked_heavy_steel_operation_side_effects'
        ELSE 'passed'
    END AS p0_gate_state,
    jsonb_strip_nulls(jsonb_build_object(
        'sourceDrawings',
            CASE WHEN b.source_drawing_count > 0 THEN NULL ELSE 'no source drawing catalog' END,
        'packageMapping',
            CASE WHEN b.package_work_item_count >= b.source_package_count THEN NULL ELSE 'not every drawing package has a work item' END,
        'moduleWorkOrders',
            CASE WHEN b.module_work_order_count >= b.bound_module_count THEN NULL ELSE 'module work orders do not cover all bound modules' END,
        'bom',
            CASE WHEN b.bom_document_count > 0 AND b.bom_version_count > 0 AND b.bom_line_count > 0 THEN NULL ELSE 'no BOM source document/version/lines' END,
        'bomLineSource',
            CASE WHEN b.bom_line_source_count >= b.bom_line_count THEN NULL ELSE 'some BOM lines do not trace back to workbook rows' END,
        'downstreamLinks',
            CASE WHEN b.downstream_link_count >= b.bom_line_count THEN NULL ELSE 'BOM lines are not linked downstream' END,
        'cdeFiles',
            CASE WHEN COALESCE(f.module_file_count, 0) > 0
                  AND COALESCE(f.module_file_ready_count, 0) = COALESCE(f.module_file_count, 0)
                  AND COALESCE(f.module_file_blocked_count, 0) = 0
                THEN NULL ELSE 'CDE files are not fully operation-runtime ready' END,
        'moduleTransactions',
            CASE WHEN COALESCE(tx.module_transaction_count, 0) > 0
                  AND COALESCE(tx.module_transaction_ready_count, 0) = COALESCE(tx.module_transaction_count, 0)
                  AND COALESCE(tx.module_transaction_blocked_count, 0) = 0
                THEN NULL ELSE 'module transactions are not fully operation-runtime ready' END,
        'heavySteelOperations',
            CASE WHEN COALESCE(h.heavy_steel_operation_run_count, 0) > 0
                  AND COALESCE(h.heavy_steel_event_count, 0) = COALESCE(h.heavy_steel_operation_run_count, 0)
                  AND COALESCE(h.heavy_steel_audit_count, 0) = COALESCE(h.heavy_steel_operation_run_count, 0)
                  AND COALESCE(h.heavy_steel_graph_edge_count, 0) = COALESCE(h.heavy_steel_operation_run_count, 0)
                THEN NULL ELSE 'heavy-steel operations do not have exact event/audit/graph side effects' END,
        'opsMaturity',
            CASE WHEN COALESCE(o.p0_gate_state, 'blocked_database_ops_maturity') = 'passed'
                THEN NULL ELSE COALESCE(o.p0_gate_state, 'blocked_database_ops_maturity') END
    )) AS issues
FROM heavy_steel_database_bridge_status b
LEFT JOIN LATERAL (
    SELECT
        SUM(active_binding_count)::bigint AS active_module_binding_count,
        SUM(operation_run_count)::bigint AS module_operation_run_count,
        SUM(event_count)::bigint AS module_operation_event_count,
        SUM(audit_count)::bigint AS module_operation_audit_count,
        SUM(graph_edge_count)::bigint AS module_operation_graph_edge_count,
        SUM(missing_operation_run_count)::bigint AS missing_operation_run_count,
        SUM(integrity_ready_count)::bigint AS integrity_ready_count,
        SUM(integrity_blocked_count)::bigint AS integrity_blocked_count
    FROM module_operation_runtime_summary s
    WHERE s.tenant_id = b.tenant_id
      AND s.project_id = b.project_id
) m ON true
LEFT JOIN LATERAL (
    SELECT
        COUNT(*)::bigint AS module_file_count,
        COUNT(*) FILTER (WHERE runtime_status = 'ready')::bigint AS module_file_ready_count,
        COUNT(*) FILTER (WHERE runtime_status = 'blocked')::bigint AS module_file_blocked_count,
        COALESCE(SUM(operation_run_count), 0)::bigint AS module_file_operation_run_count,
        COALESCE(SUM(event_count), 0)::bigint AS module_file_event_count,
        COALESCE(SUM(audit_count), 0)::bigint AS module_file_audit_count,
        COALESCE(SUM(graph_edge_count), 0)::bigint AS module_file_graph_edge_count
    FROM module_file_operation_runtime_status s
    WHERE s.tenant_id = b.tenant_id
      AND s.project_id = b.project_id
) f ON true
LEFT JOIN LATERAL (
    SELECT
        COUNT(*)::bigint AS module_transaction_count,
        COUNT(*) FILTER (WHERE runtime_status = 'ready')::bigint AS module_transaction_ready_count,
        COUNT(*) FILTER (WHERE runtime_status = 'blocked')::bigint AS module_transaction_blocked_count,
        COALESCE(SUM(operation_run_count), 0)::bigint AS module_transaction_operation_run_count,
        COALESCE(SUM(event_count), 0)::bigint AS module_transaction_event_count,
        COALESCE(SUM(audit_count), 0)::bigint AS module_transaction_audit_count,
        COALESCE(SUM(graph_edge_count), 0)::bigint AS module_transaction_graph_edge_count,
        COALESCE(SUM(approval_count), 0)::bigint AS module_transaction_approval_count,
        COALESCE(SUM(approval_operation_run_count), 0)::bigint AS module_transaction_approval_operation_run_count
    FROM module_transaction_operation_runtime_status s
    WHERE s.tenant_id = b.tenant_id
      AND s.project_id = b.project_id
) tx ON true
LEFT JOIN LATERAL (
    SELECT
        COUNT(*)::bigint AS heavy_steel_operation_run_count,
        COUNT(*) FILTER (
            WHERE e.id IS NOT NULL
              AND e.target_type = 'heavy_steel_module_operation_run'
              AND e.target_id = r.operation_run_id::text
              AND e.event_type = 'heavy_steel.module_operation.' || r.status
        )::bigint AS heavy_steel_event_count,
        COUNT(*) FILTER (
            WHERE a.id IS NOT NULL
              AND a.target_type = 'heavy_steel_module_operation_run'
              AND a.target_id = r.operation_run_id::text
              AND a.action = 'heavy_steel_module_operation_' || r.status
        )::bigint AS heavy_steel_audit_count,
        COUNT(*) FILTER (
            WHERE g.id IS NOT NULL
              AND g.to_entity_type = 'heavy_steel_module_operation_run'
              AND g.to_entity_id = r.operation_run_id::text
              AND g.relationship_type = 'triggers_module_database_operation'
              AND g.source = 'heavy_steel_module_operation_runtime'
        )::bigint AS heavy_steel_graph_edge_count
    FROM heavy_steel_module_operation_runs r
    LEFT JOIN data_event_outbox e ON e.id = r.event_id
    LEFT JOIN audit_events a ON a.id = r.audit_event_id
    LEFT JOIN data_graph_edges g ON g.id = r.graph_edge_id
    WHERE r.tenant_id = b.tenant_id
      AND r.project_id = b.project_id
) h ON true
LEFT JOIN database_ops_maturity_readiness o
  ON o.tenant_id = b.tenant_id;

-- Replace the broad tenant aggregation with tenant-scoped probes for the same
-- reason as the heavy-steel view: readiness must remain cheap on large runtimes.
CREATE OR REPLACE VIEW database_ops_maturity_readiness AS
SELECT
    t.id AS tenant_id,
    COALESCE(o.bastion_session_count, 0)::bigint AS bastion_session_count,
    COALESCE(o.command_event_count, 0)::bigint AS command_event_count,
    COALESCE(o.archive_batch_count, 0)::bigint AS archive_batch_count,
    COALESCE(o.missing_recording_count, 0)::bigint AS missing_recording_count,
    COALESCE(o.pending_archive_count, 0)::bigint AS pending_archive_count,
    COALESCE(o.p0_gate_state, 'blocked_no_audit_archive')::text AS audit_archive_gate_state,
    COALESCE(b.active_policy_count, 0)::bigint AS active_backup_policy_count,
    COALESCE(b.successful_backup_count, 0)::bigint AS successful_backup_count,
    COALESCE(b.passed_restore_drill_count, 0)::bigint AS passed_restore_drill_count,
    b.last_successful_backup_at,
    b.last_passed_restore_drill_at,
    COALESCE(b.p0_gate_state, 'blocked_no_backup_restore_drill')::text AS backup_restore_gate_state,
    COALESCE(m.active_module_binding_count, 0)::bigint AS active_module_binding_count,
    COALESCE(m.module_operation_run_count, 0)::bigint AS module_operation_run_count,
    COALESCE(m.module_operation_event_count, 0)::bigint AS module_operation_event_count,
    COALESCE(m.module_operation_audit_count, 0)::bigint AS module_operation_audit_count,
    COALESCE(m.module_operation_graph_edge_count, 0)::bigint AS module_operation_graph_edge_count,
    COALESCE(m.missing_operation_run_count, 0)::bigint AS missing_operation_run_count,
    COALESCE(m.integrity_ready_count, 0)::bigint AS integrity_ready_count,
    COALESCE(m.integrity_blocked_count, 0)::bigint AS integrity_blocked_count,
    COALESCE(f.module_file_count, 0)::bigint AS module_file_count,
    COALESCE(f.module_file_ready_count, 0)::bigint AS module_file_ready_count,
    COALESCE(f.module_file_blocked_count, 0)::bigint AS module_file_blocked_count,
    COALESCE(f.module_file_operation_run_count, 0)::bigint AS module_file_operation_run_count,
    COALESCE(f.module_file_event_count, 0)::bigint AS module_file_event_count,
    COALESCE(f.module_file_audit_count, 0)::bigint AS module_file_audit_count,
    COALESCE(f.module_file_graph_edge_count, 0)::bigint AS module_file_graph_edge_count,
    COALESCE(tx.module_transaction_count, 0)::bigint AS module_transaction_count,
    COALESCE(tx.module_transaction_ready_count, 0)::bigint AS module_transaction_ready_count,
    COALESCE(tx.module_transaction_blocked_count, 0)::bigint AS module_transaction_blocked_count,
    COALESCE(tx.module_transaction_operation_run_count, 0)::bigint AS module_transaction_operation_run_count,
    COALESCE(tx.module_transaction_event_count, 0)::bigint AS module_transaction_event_count,
    COALESCE(tx.module_transaction_audit_count, 0)::bigint AS module_transaction_audit_count,
    COALESCE(tx.module_transaction_graph_edge_count, 0)::bigint AS module_transaction_graph_edge_count,
    COALESCE(tx.module_transaction_approval_count, 0)::bigint AS module_transaction_approval_count,
    COALESCE(tx.module_transaction_approval_operation_run_count, 0)::bigint AS module_transaction_approval_operation_run_count,
    CASE
        WHEN COALESCE(o.p0_gate_state, 'blocked_no_audit_archive') <> 'passed'
            THEN COALESCE(o.p0_gate_state, 'blocked_no_audit_archive')
        WHEN COALESCE(b.p0_gate_state, 'blocked_no_backup_restore_drill') <> 'passed'
            THEN COALESCE(b.p0_gate_state, 'blocked_no_backup_restore_drill')
        WHEN COALESCE(m.active_module_binding_count, 0) = 0
            THEN 'blocked_no_module_operation_bindings'
        WHEN COALESCE(m.module_operation_run_count, 0) = 0
            THEN 'blocked_no_module_operation_runs'
        WHEN COALESCE(m.missing_operation_run_count, 0) > 0
            THEN 'blocked_missing_module_operation_runs'
        WHEN COALESCE(m.integrity_blocked_count, 0) > 0
            THEN 'blocked_module_operation_integrity'
        WHEN COALESCE(m.module_operation_event_count, 0) <> COALESCE(m.module_operation_run_count, 0)
          OR COALESCE(m.module_operation_audit_count, 0) <> COALESCE(m.module_operation_run_count, 0)
          OR COALESCE(m.module_operation_graph_edge_count, 0) <> COALESCE(m.module_operation_run_count, 0)
            THEN 'blocked_module_operation_side_effects'
        WHEN COALESCE(f.module_file_count, 0) = 0
            THEN 'blocked_no_module_files'
        WHEN COALESCE(f.module_file_blocked_count, 0) > 0
          OR COALESCE(f.module_file_ready_count, 0) <> COALESCE(f.module_file_count, 0)
            THEN 'blocked_module_file_runtime'
        WHEN COALESCE(tx.module_transaction_count, 0) = 0
            THEN 'blocked_no_module_transactions'
        WHEN COALESCE(tx.module_transaction_blocked_count, 0) > 0
          OR COALESCE(tx.module_transaction_ready_count, 0) <> COALESCE(tx.module_transaction_count, 0)
            THEN 'blocked_module_transaction_runtime'
        WHEN COALESCE(tx.module_transaction_approval_operation_run_count, 0) < COALESCE(tx.module_transaction_approval_count, 0)
            THEN 'blocked_module_transaction_approvals'
        ELSE 'passed'
    END AS p0_gate_state,
    CASE
        WHEN COALESCE(o.p0_gate_state, 'blocked_no_audit_archive') = 'passed'
         AND COALESCE(b.p0_gate_state, 'blocked_no_backup_restore_drill') = 'passed'
         AND COALESCE(m.active_module_binding_count, 0) > 0
         AND COALESCE(m.module_operation_run_count, 0) > 0
         AND COALESCE(m.missing_operation_run_count, 0) = 0
         AND COALESCE(m.integrity_blocked_count, 0) = 0
         AND COALESCE(f.module_file_count, 0) > 0
         AND COALESCE(f.module_file_ready_count, 0) = COALESCE(f.module_file_count, 0)
         AND COALESCE(tx.module_transaction_count, 0) > 0
         AND COALESCE(tx.module_transaction_ready_count, 0) = COALESCE(tx.module_transaction_count, 0)
        THEN 'alpha_p0_integrated'
        ELSE 'blocked'
    END AS maturity_level,
    jsonb_strip_nulls(jsonb_build_object(
        'auditArchive',
            CASE WHEN COALESCE(o.p0_gate_state, 'blocked_no_audit_archive') = 'passed'
                THEN NULL ELSE COALESCE(o.p0_gate_state, 'blocked_no_audit_archive') END,
        'backupRestore',
            CASE WHEN COALESCE(b.p0_gate_state, 'blocked_no_backup_restore_drill') = 'passed'
                THEN NULL ELSE COALESCE(b.p0_gate_state, 'blocked_no_backup_restore_drill') END,
        'moduleOperationBindings',
            CASE WHEN COALESCE(m.active_module_binding_count, 0) > 0
                THEN NULL ELSE 'no active module operation bindings' END,
        'moduleOperationIntegrity',
            CASE WHEN COALESCE(m.integrity_blocked_count, 0) = 0
                THEN NULL ELSE 'module operation event/audit/graph integrity has blocked rows' END,
        'moduleFiles',
            CASE WHEN COALESCE(f.module_file_count, 0) > 0
                  AND COALESCE(f.module_file_ready_count, 0) = COALESCE(f.module_file_count, 0)
                  AND COALESCE(f.module_file_blocked_count, 0) = 0
                THEN NULL ELSE 'module files are not fully bridged into operation runtime' END,
        'moduleTransactions',
            CASE WHEN COALESCE(tx.module_transaction_count, 0) > 0
                  AND COALESCE(tx.module_transaction_ready_count, 0) = COALESCE(tx.module_transaction_count, 0)
                  AND COALESCE(tx.module_transaction_blocked_count, 0) = 0
                THEN NULL ELSE 'module transactions are not fully bridged into operation runtime' END
    )) AS issues
FROM tenants t
LEFT JOIN operations_audit_log_archive_readiness o ON o.tenant_id = t.id
LEFT JOIN backup_restore_p0_readiness b ON b.tenant_id = t.id
LEFT JOIN LATERAL (
    SELECT
        SUM(active_binding_count)::bigint AS active_module_binding_count,
        SUM(operation_run_count)::bigint AS module_operation_run_count,
        SUM(event_count)::bigint AS module_operation_event_count,
        SUM(audit_count)::bigint AS module_operation_audit_count,
        SUM(graph_edge_count)::bigint AS module_operation_graph_edge_count,
        SUM(missing_operation_run_count)::bigint AS missing_operation_run_count,
        SUM(integrity_ready_count)::bigint AS integrity_ready_count,
        SUM(integrity_blocked_count)::bigint AS integrity_blocked_count
    FROM module_operation_runtime_summary s
    WHERE s.tenant_id = t.id
) m ON true
LEFT JOIN LATERAL (
    SELECT
        COUNT(*)::bigint AS module_file_count,
        COUNT(*) FILTER (WHERE runtime_status = 'ready')::bigint AS module_file_ready_count,
        COUNT(*) FILTER (WHERE runtime_status = 'blocked')::bigint AS module_file_blocked_count,
        COALESCE(SUM(operation_run_count), 0)::bigint AS module_file_operation_run_count,
        COALESCE(SUM(event_count), 0)::bigint AS module_file_event_count,
        COALESCE(SUM(audit_count), 0)::bigint AS module_file_audit_count,
        COALESCE(SUM(graph_edge_count), 0)::bigint AS module_file_graph_edge_count
    FROM module_file_operation_runtime_status s
    WHERE s.tenant_id = t.id
) f ON true
LEFT JOIN LATERAL (
    SELECT
        COUNT(*)::bigint AS module_transaction_count,
        COUNT(*) FILTER (WHERE runtime_status = 'ready')::bigint AS module_transaction_ready_count,
        COUNT(*) FILTER (WHERE runtime_status = 'blocked')::bigint AS module_transaction_blocked_count,
        COALESCE(SUM(operation_run_count), 0)::bigint AS module_transaction_operation_run_count,
        COALESCE(SUM(event_count), 0)::bigint AS module_transaction_event_count,
        COALESCE(SUM(audit_count), 0)::bigint AS module_transaction_audit_count,
        COALESCE(SUM(graph_edge_count), 0)::bigint AS module_transaction_graph_edge_count,
        COALESCE(SUM(approval_count), 0)::bigint AS module_transaction_approval_count,
        COALESCE(SUM(approval_operation_run_count), 0)::bigint AS module_transaction_approval_operation_run_count
    FROM module_transaction_operation_runtime_status s
    WHERE s.tenant_id = t.id
) tx ON true;

COMMENT ON VIEW database_ops_maturity_readiness IS
    'Unified P0 database operations maturity gate: bastion audit archive, backup/restore drill, module operation integrity, file runtime and transaction runtime.';
COMMENT ON VIEW heavy_steel_end_to_end_readiness IS
    'Heavy-steel breakthrough readiness gate from source drawings through CDE, BOM, downstream module work, transactions, event, audit and graph side effects.';
