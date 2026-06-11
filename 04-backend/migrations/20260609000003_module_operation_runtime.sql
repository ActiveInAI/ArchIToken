-- ArchIToken global module operation runtime.
--
-- This migration promotes module operations from per-feature write paths into
-- a shared production-facing DataPlane surface for all registered modules.
-- Every accepted module operation is tenant-isolated, idempotent, audited,
-- emitted to the event outbox and connected into the graph store.

SELECT set_config('app.current_tenant', '11111111-1111-4111-8111-111111111111', false);

CREATE TABLE IF NOT EXISTS module_operation_runs (
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
        length(operation_kind) BETWEEN 3 AND 128
        AND operation_kind ~ '^[a-z0-9_.:-]+$'
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
    target_type          TEXT NOT NULL DEFAULT 'module',
    target_id            TEXT NOT NULL,
    related_file_ids     JSONB NOT NULL DEFAULT '[]'::jsonb,
    related_artifact_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    idempotency_key      TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 200),
    request_payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence             JSONB NOT NULL DEFAULT '{}'::jsonb,
    professional_state   TEXT NOT NULL DEFAULT 'professional_review_required' CHECK (
        professional_state IN ('professional_review_required','reviewing','approved','rejected')
    ),
    approval_state       TEXT NOT NULL DEFAULT 'approval_required' CHECK (
        approval_state IN ('approval_required','reviewing','approved','rejected','not_required')
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

CREATE INDEX IF NOT EXISTS idx_module_operation_runs_scope
    ON module_operation_runs(tenant_id, project_id, module_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_module_operation_runs_target
    ON module_operation_runs(tenant_id, project_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_module_operation_runs_payload
    ON module_operation_runs USING gin (request_payload);
CREATE INDEX IF NOT EXISTS idx_module_operation_runs_evidence
    ON module_operation_runs USING gin (evidence);

ALTER TABLE module_operation_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = current_schema()
          AND tablename = 'module_operation_runs'
          AND policyname = 'module_operation_runs_tenant_isolation'
    ) THEN
        CREATE POLICY module_operation_runs_tenant_isolation
            ON module_operation_runs
            USING (tenant_id = current_tenant())
            WITH CHECK (tenant_id = current_tenant());
    END IF;
END $$;

ALTER TABLE module_operation_runs FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION module_operation_runs_prepare()
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

DROP TRIGGER IF EXISTS module_operation_runs_prepare_trigger
    ON module_operation_runs;
CREATE TRIGGER module_operation_runs_prepare_trigger
BEFORE INSERT OR UPDATE ON module_operation_runs
FOR EACH ROW EXECUTE FUNCTION module_operation_runs_prepare();

CREATE OR REPLACE FUNCTION module_operation_runs_side_effects()
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
        'module_operation.' || NEW.status,
        'module_operation_run',
        NEW.operation_run_id::text,
        jsonb_build_object(
            'operationRunId', NEW.operation_run_id,
            'operationKey', NEW.operation_key,
            'operationKind', NEW.operation_kind,
            'operationLabel', NEW.operation_label,
            'moduleId', NEW.module_id,
            'actor', NEW.actor,
            'sourceSurface', NEW.source_surface,
            'targetType', NEW.target_type,
            'targetId', NEW.target_id,
            'relatedFileIds', NEW.related_file_ids,
            'relatedArtifactIds', NEW.related_artifact_ids,
            'professionalState', NEW.professional_state,
            'approvalState', NEW.approval_state,
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
        'module_operation_' || NEW.status,
        'module_operation_run',
        NEW.operation_run_id::text,
        '模块操作已写入统一 DataPlane，并生成事件、审计和图关系。',
        jsonb_build_object(
            'operationRunId', NEW.operation_run_id,
            'operationKey', NEW.operation_key,
            'operationKind', NEW.operation_kind,
            'operationLabel', NEW.operation_label,
            'sourceSurface', NEW.source_surface,
            'targetType', NEW.target_type,
            'targetId', NEW.target_id,
            'relatedFileIds', NEW.related_file_ids,
            'relatedArtifactIds', NEW.related_artifact_ids,
            'professionalState', NEW.professional_state,
            'approvalState', NEW.approval_state,
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
        'module_operation_run',
        NEW.operation_run_id::text,
        'triggers_module_operation',
        jsonb_build_object(
            'operationKey', NEW.operation_key,
            'operationKind', NEW.operation_kind,
            'operationLabel', NEW.operation_label,
            'status', NEW.status,
            'actor', NEW.actor,
            'sourceSurface', NEW.source_surface,
            'professionalState', NEW.professional_state,
            'approvalState', NEW.approval_state
        ),
        'module_operation_runtime'
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

DROP TRIGGER IF EXISTS module_operation_runs_side_effects_trigger
    ON module_operation_runs;
CREATE TRIGGER module_operation_runs_side_effects_trigger
AFTER INSERT OR UPDATE ON module_operation_runs
FOR EACH ROW EXECUTE FUNCTION module_operation_runs_side_effects();

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
  ON e.tenant_id = b.tenant_id
 AND e.project_id = b.project_id
 AND e.module_id = b.module_id
 AND e.target_type = 'module_operation_run'
LEFT JOIN audit_events a
  ON a.tenant_id = b.tenant_id::text
 AND a.project_id = b.project_id::text
 AND a.module_id = b.module_id
 AND a.target_type = 'module_operation_run'
LEFT JOIN data_graph_edges g
  ON g.tenant_id = b.tenant_id
 AND g.project_id = b.project_id
 AND g.module_id = b.module_id
 AND g.to_entity_type = 'module_operation_run'
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

COMMENT ON TABLE module_operation_runs IS 'Tenant-isolated, idempotent global module operation runtime for all registered ArchIToken modules.';
COMMENT ON VIEW module_operation_runtime_status IS 'Per-module verification view for global module operation DataPlane bindings, writes, events, audits and graph edges.';
