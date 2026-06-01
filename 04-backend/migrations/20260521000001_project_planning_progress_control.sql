-- migrations/20260521000001_project_planning_progress_control.sql
-- ArchIToken planning_management progress feedback, warning and adjustment schema.
-- Scope: online schedule authoring, task status feedback, schedule alerts and
-- controlled schedule adjustment records for Project Plan Token.

CREATE TABLE IF NOT EXISTS project_plan_progress_feedback (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES project_plan_tokens(id) ON DELETE CASCADE,
    task_id             UUID REFERENCES project_plan_tasks(id) ON DELETE SET NULL,
    reported_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reporter            TEXT NOT NULL,
    progress_percent    INTEGER NOT NULL CHECK (progress_percent BETWEEN 0 AND 100),
    actual_start        DATE,
    actual_finish       DATE,
    note                TEXT NOT NULL DEFAULT '',
    evidence_refs       JSONB NOT NULL DEFAULT '[]'::jsonb,
    status              TEXT NOT NULL DEFAULT 'submitted'
                            CHECK (status IN ('submitted','accepted','needs_review')),
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_plan_progress_feedback_plan
    ON project_plan_progress_feedback(plan_id, reported_at DESC, status);

CREATE TABLE IF NOT EXISTS project_plan_schedule_alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES project_plan_tokens(id) ON DELETE CASCADE,
    category            TEXT NOT NULL CHECK (category IN ('schedule','resource','risk','approval','task_status')),
    severity            TEXT NOT NULL CHECK (severity IN ('info','warning','high','critical')),
    title               TEXT NOT NULL,
    message             TEXT NOT NULL,
    recommendation      TEXT NOT NULL,
    task_ids            JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence_refs       JSONB NOT NULL DEFAULT '[]'::jsonb,
    resolved_at         TIMESTAMPTZ,
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_plan_schedule_alerts_plan
    ON project_plan_schedule_alerts(plan_id, severity, category, resolved_at, created_at DESC);

CREATE TABLE IF NOT EXISTS project_plan_schedule_adjustments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES project_plan_tokens(id) ON DELETE CASCADE,
    actor               TEXT NOT NULL,
    reason              TEXT NOT NULL,
    task_ids            JSONB NOT NULL DEFAULT '[]'::jsonb,
    shift_days          INTEGER NOT NULL,
    include_successors  BOOLEAN NOT NULL DEFAULT TRUE,
    status              TEXT NOT NULL DEFAULT 'applied'
                            CHECK (status IN ('draft','applied','pending_approval')),
    summary             TEXT NOT NULL,
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_plan_schedule_adjustments_plan
    ON project_plan_schedule_adjustments(plan_id, created_at DESC, status);

ALTER TABLE project_plan_progress_feedback    ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_plan_schedule_alerts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_plan_schedule_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_plan_progress_feedback_tenant ON project_plan_progress_feedback;
CREATE POLICY project_plan_progress_feedback_tenant ON project_plan_progress_feedback
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());
DROP POLICY IF EXISTS project_plan_schedule_alerts_tenant ON project_plan_schedule_alerts;
CREATE POLICY project_plan_schedule_alerts_tenant ON project_plan_schedule_alerts
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());
DROP POLICY IF EXISTS project_plan_schedule_adjustments_tenant ON project_plan_schedule_adjustments;
CREATE POLICY project_plan_schedule_adjustments_tenant ON project_plan_schedule_adjustments
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

ALTER TABLE project_plan_progress_feedback    FORCE ROW LEVEL SECURITY;
ALTER TABLE project_plan_schedule_alerts      FORCE ROW LEVEL SECURITY;
ALTER TABLE project_plan_schedule_adjustments FORCE ROW LEVEL SECURITY;
