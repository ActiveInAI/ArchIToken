-- ArchIToken heavy-steel module operation runtime.
--
-- This migration adds the production-facing database write surface for the
-- heavy-steel breakthrough chain. Module actions are not UI-only events:
-- every accepted operation is tenant-isolated, idempotent, audited, emitted
-- to the event outbox and connected into the graph store.

SELECT set_config('app.current_tenant', '11111111-1111-4111-8111-111111111111', false);

CREATE TABLE IF NOT EXISTS heavy_steel_module_operation_runs (
    operation_run_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module_id            TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT,
    operation_surface    TEXT NOT NULL DEFAULT 'module_operation_write',
    operation_key        TEXT NOT NULL CHECK (
        length(operation_key) BETWEEN 3 AND 128
        AND operation_key ~ '^[a-z0-9_.:-]+$'
    ),
    operation_label      TEXT NOT NULL CHECK (length(operation_label) BETWEEN 1 AND 200),
    operation_kind       TEXT NOT NULL DEFAULT 'module_business_operation' CHECK (
        operation_kind IN (
            'module_business_operation',
            'bom_to_boq',
            'bom_to_procurement',
            'bom_to_work_order',
            'bom_to_construction_task',
            'bom_to_archive',
            'professional_review',
            'database_maintenance'
        )
    ),
    status               TEXT NOT NULL DEFAULT 'requested' CHECK (
        status IN (
            'requested',
            'running',
            'blocked',
            'completed',
            'failed',
            'cancelled',
            'professional_review_required'
        )
    ),
    actor                TEXT NOT NULL CHECK (length(actor) BETWEEN 1 AND 160),
    source_surface       TEXT NOT NULL DEFAULT 'database_manager_api',
    target_type          TEXT NOT NULL DEFAULT 'heavy_steel_project',
    target_id            TEXT NOT NULL,
    bom_version_id       UUID REFERENCES bom_versions(bom_version_id) ON DELETE SET NULL,
    bom_line_id          UUID REFERENCES bom_lines(bom_line_id) ON DELETE SET NULL,
    downstream_link_id   UUID REFERENCES bom_downstream_links(downstream_link_id) ON DELETE SET NULL,
    idempotency_key      TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 200),
    request_payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence             JSONB NOT NULL DEFAULT '{}'::jsonb,
    professional_state   TEXT NOT NULL DEFAULT 'professional_review_required' CHECK (
        professional_state IN ('professional_review_required','reviewing','approved','rejected')
    ),
    event_id             UUID UNIQUE,
    audit_event_id       UUID UNIQUE,
    graph_edge_id        UUID UNIQUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (tenant_id, project_id, module_id, operation_surface)
        REFERENCES module_database_operation_bindings(tenant_id, project_id, module_id, operation_surface)
        ON DELETE RESTRICT,
    UNIQUE (tenant_id, project_id, module_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_heavy_steel_module_operation_runs_scope
    ON heavy_steel_module_operation_runs(tenant_id, project_id, module_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_heavy_steel_module_operation_runs_bom_line
    ON heavy_steel_module_operation_runs(tenant_id, project_id, bom_line_id, module_id);
CREATE INDEX IF NOT EXISTS idx_heavy_steel_module_operation_runs_payload
    ON heavy_steel_module_operation_runs USING gin (request_payload);

ALTER TABLE heavy_steel_module_operation_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = current_schema()
          AND tablename = 'heavy_steel_module_operation_runs'
          AND policyname = 'heavy_steel_module_operation_runs_tenant_isolation'
    ) THEN
        CREATE POLICY heavy_steel_module_operation_runs_tenant_isolation
            ON heavy_steel_module_operation_runs
            USING (tenant_id = current_tenant())
            WITH CHECK (tenant_id = current_tenant());
    END IF;
END $$;

ALTER TABLE heavy_steel_module_operation_runs FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION heavy_steel_module_operation_runs_prepare()
RETURNS TRIGGER AS $$
BEGIN
    NEW.operation_run_id := COALESCE(NEW.operation_run_id, gen_random_uuid());
    NEW.event_id := COALESCE(NEW.event_id, gen_random_uuid());
    NEW.audit_event_id := COALESCE(NEW.audit_event_id, gen_random_uuid());
    NEW.graph_edge_id := COALESCE(NEW.graph_edge_id, gen_random_uuid());
    NEW.updated_at := NOW();
    IF TG_OP = 'INSERT' THEN
        NEW.created_at := COALESCE(NEW.created_at, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS heavy_steel_module_operation_runs_prepare_trigger
    ON heavy_steel_module_operation_runs;
CREATE TRIGGER heavy_steel_module_operation_runs_prepare_trigger
BEFORE INSERT OR UPDATE ON heavy_steel_module_operation_runs
FOR EACH ROW EXECUTE FUNCTION heavy_steel_module_operation_runs_prepare();

CREATE OR REPLACE FUNCTION heavy_steel_module_operation_runs_side_effects()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO data_event_outbox (
        id,
        tenant_id,
        project_id,
        module_id,
        event_type,
        target_type,
        target_id,
        payload,
        status
    ) VALUES (
        NEW.event_id,
        NEW.tenant_id,
        NEW.project_id,
        NEW.module_id,
        'heavy_steel.module_operation.' || NEW.status,
        'heavy_steel_module_operation_run',
        NEW.operation_run_id::text,
        jsonb_build_object(
            'operationRunId', NEW.operation_run_id,
            'operationKey', NEW.operation_key,
            'operationKind', NEW.operation_kind,
            'operationLabel', NEW.operation_label,
            'moduleId', NEW.module_id,
            'actor', NEW.actor,
            'targetType', NEW.target_type,
            'targetId', NEW.target_id,
            'bomVersionId', NEW.bom_version_id,
            'bomLineId', NEW.bom_line_id,
            'downstreamLinkId', NEW.downstream_link_id,
            'professionalState', NEW.professional_state,
            'requestPayload', NEW.request_payload,
            'evidence', NEW.evidence
        ),
        'pending'
    )
    ON CONFLICT (id) DO UPDATE SET
        event_type = EXCLUDED.event_type,
        payload = EXCLUDED.payload,
        status = 'pending',
        occurred_at = NOW();

    INSERT INTO audit_events (
        id,
        tenant_id,
        project_id,
        module_id,
        actor,
        action,
        target_type,
        target_id,
        summary,
        metadata,
        created_at
    ) VALUES (
        NEW.audit_event_id,
        NEW.tenant_id::text,
        NEW.project_id::text,
        NEW.module_id,
        NEW.actor,
        'heavy_steel_module_operation_' || NEW.status,
        'heavy_steel_module_operation_run',
        NEW.operation_run_id::text,
        '重钢模块数据库操作已写入统一 DataPlane，并生成事件、审计和图关系。',
        jsonb_build_object(
            'operationRunId', NEW.operation_run_id,
            'operationKey', NEW.operation_key,
            'operationKind', NEW.operation_kind,
            'operationLabel', NEW.operation_label,
            'sourceSurface', NEW.source_surface,
            'targetType', NEW.target_type,
            'targetId', NEW.target_id,
            'bomVersionId', NEW.bom_version_id,
            'bomLineId', NEW.bom_line_id,
            'downstreamLinkId', NEW.downstream_link_id,
            'professionalState', NEW.professional_state,
            'idempotencyKey', NEW.idempotency_key
        ),
        NOW()
    )
    -- audit_events is append-only (20260611000001): re-firing this side-effect
    -- trigger must not rewrite the original audit row.
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO data_graph_edges (
        id,
        tenant_id,
        project_id,
        module_id,
        from_entity_type,
        from_entity_id,
        to_entity_type,
        to_entity_id,
        relationship_type,
        properties,
        source
    ) VALUES (
        NEW.graph_edge_id,
        NEW.tenant_id,
        NEW.project_id,
        NEW.module_id,
        NEW.target_type,
        NEW.target_id,
        'heavy_steel_module_operation_run',
        NEW.operation_run_id::text,
        'triggers_module_database_operation',
        jsonb_build_object(
            'operationKey', NEW.operation_key,
            'operationKind', NEW.operation_kind,
            'status', NEW.status,
            'actor', NEW.actor,
            'bomLineId', NEW.bom_line_id,
            'downstreamLinkId', NEW.downstream_link_id,
            'professionalState', NEW.professional_state
        ),
        'heavy_steel_module_operation_runtime'
    )
    ON CONFLICT (
        tenant_id, project_id, module_id, from_entity_type, from_entity_id,
        to_entity_type, to_entity_id, relationship_type
    ) DO UPDATE SET
        properties = EXCLUDED.properties,
        source = EXCLUDED.source,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS heavy_steel_module_operation_runs_side_effects_trigger
    ON heavy_steel_module_operation_runs;
CREATE TRIGGER heavy_steel_module_operation_runs_side_effects_trigger
AFTER INSERT OR UPDATE ON heavy_steel_module_operation_runs
FOR EACH ROW EXECUTE FUNCTION heavy_steel_module_operation_runs_side_effects();

CREATE OR REPLACE VIEW heavy_steel_database_bridge_status AS
SELECT
    '11111111-1111-4111-8111-111111111111'::uuid AS tenant_id,
    '5abffe50-2670-42e2-97ea-ec6ac71d8183'::uuid AS project_id,
    'heavy_steel_hotel_100_rooms_q235b_bolted'::text AS program_id,
    (SELECT total_drawings FROM heavy_steel_programs WHERE program_id = 'heavy_steel_hotel_100_rooms_q235b_bolted') AS source_drawing_count,
    (SELECT COUNT(*) FROM heavy_steel_drawing_packages WHERE program_id = 'heavy_steel_hotel_100_rooms_q235b_bolted') AS source_package_count,
    (SELECT COUNT(*) FROM heavy_steel_drawing_sections WHERE program_id = 'heavy_steel_hotel_100_rooms_q235b_bolted') AS source_section_count,
    (SELECT COUNT(*) FROM module_database_operation_bindings WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS bound_module_count,
    (SELECT COUNT(*) FROM heavy_steel_package_work_items WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS package_work_item_count,
    (SELECT COUNT(*) FROM heavy_steel_module_work_orders WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS module_work_order_count,
    (SELECT COUNT(*) FROM bom_documents WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS bom_document_count,
    (SELECT COUNT(*) FROM bom_versions WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS bom_version_count,
    (SELECT COUNT(*) FROM bom_lines WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS bom_line_count,
    (SELECT COALESCE(SUM(total_quantity), 0) FROM bom_lines WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS bom_total_quantity,
    (SELECT COUNT(*) FROM bom_line_sources WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS bom_line_source_count,
    (SELECT COUNT(*) FROM bom_downstream_links WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS downstream_link_count,
    (SELECT COUNT(*) FROM data_graph_edges WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183' AND source IN ('component_bom_database_bridge', 'heavy_steel_module_operation_runtime')) AS graph_edge_count,
    (SELECT COUNT(*) FROM data_event_outbox WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183' AND event_type LIKE 'component_bom.%') AS event_count,
    (SELECT COUNT(*) FROM data_analytics_events WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183' AND metric_name LIKE 'component_bom.%') AS analytics_count,
    (SELECT COUNT(*) FROM audit_events WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183' AND target_type = 'component_bom_database_bridge') AS audit_count,
    (SELECT COUNT(*) FROM heavy_steel_module_operation_runs WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS module_operation_run_count,
    (SELECT COUNT(*) FROM data_event_outbox WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183' AND event_type LIKE 'heavy_steel.module_operation.%') AS module_operation_event_count,
    (SELECT COUNT(*) FROM audit_events WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183' AND target_type = 'heavy_steel_module_operation_run') AS module_operation_audit_count;

COMMENT ON TABLE heavy_steel_module_operation_runs IS 'Tenant-isolated, idempotent module operation runtime for the heavy-steel BOM-to-downstream production chain.';
COMMENT ON VIEW heavy_steel_database_bridge_status IS 'One-row verification view for the heavy-steel database bridge and module operation runtime.';
