-- migrations/20260519000003_project_planning_studio.sql
-- ArchIToken Project Planning Studio durable planning schema.
-- Scope: planning_management module; Project Plan Token, WBS, tasks,
-- milestones, resources, risks, RACI, diagrams, versions and approval archive.

CREATE TABLE IF NOT EXISTS project_plan_tokens (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module_id           TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT
                            DEFAULT 'planning_management'
                            CHECK (module_id = 'planning_management'),
    plan_code           TEXT NOT NULL,
    title               TEXT NOT NULL,
    baseline_name       TEXT NOT NULL,
    current_version     TEXT NOT NULL DEFAULT 'v1.0',
    approval_status     TEXT NOT NULL DEFAULT 'draft'
                            CHECK (approval_status IN ('draft','pending_approval','approved','archived','rejected')),
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, plan_code)
);
CREATE INDEX IF NOT EXISTS idx_project_plan_tokens_scope
    ON project_plan_tokens(tenant_id, project_id, approval_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS project_plan_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES project_plan_tokens(id) ON DELETE CASCADE,
    version             TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','pending_approval','approved','archived','rejected')),
    cde_file_id         TEXT,
    transaction_id      TEXT,
    summary             TEXT NOT NULL,
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (plan_id, version)
);
CREATE INDEX IF NOT EXISTS idx_project_plan_versions_plan
    ON project_plan_versions(plan_id, created_at DESC);

CREATE TABLE IF NOT EXISTS project_plan_wbs_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES project_plan_tokens(id) ON DELETE CASCADE,
    parent_id           UUID REFERENCES project_plan_wbs_items(id) ON DELETE SET NULL,
    wbs_code            TEXT NOT NULL,
    title               TEXT NOT NULL,
    owner_role          TEXT NOT NULL,
    deliverable         TEXT NOT NULL,
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (plan_id, wbs_code)
);
CREATE INDEX IF NOT EXISTS idx_project_plan_wbs_plan
    ON project_plan_wbs_items(plan_id, parent_id, wbs_code);

CREATE TABLE IF NOT EXISTS project_plan_tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES project_plan_tokens(id) ON DELETE CASCADE,
    wbs_id              UUID REFERENCES project_plan_wbs_items(id) ON DELETE SET NULL,
    task_code           TEXT NOT NULL,
    title               TEXT NOT NULL,
    owner               TEXT NOT NULL,
    planned_start       DATE NOT NULL,
    planned_finish      DATE NOT NULL,
    progress_percent    INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    status              TEXT NOT NULL DEFAULT 'todo'
                            CHECK (status IN ('todo','doing','review','done','blocked')),
    predecessor_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    resource_ref        TEXT,
    risk_ref            TEXT,
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (plan_id, task_code),
    CHECK (planned_finish >= planned_start)
);
CREATE INDEX IF NOT EXISTS idx_project_plan_tasks_plan
    ON project_plan_tasks(plan_id, status, planned_start, planned_finish);

CREATE TABLE IF NOT EXISTS project_plan_milestones (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES project_plan_tokens(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    due_date            DATE NOT NULL,
    owner               TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','ready','slipped','passed')),
    linked_task_ids     JSONB NOT NULL DEFAULT '[]'::jsonb,
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_plan_milestones_plan
    ON project_plan_milestones(plan_id, due_date, status);

CREATE TABLE IF NOT EXISTS project_plan_resources (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES project_plan_tokens(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    resource_type       TEXT NOT NULL CHECK (resource_type IN ('person','team','equipment','cash','material')),
    capacity            NUMERIC NOT NULL DEFAULT 0,
    unit                TEXT NOT NULL,
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_plan_resources_plan
    ON project_plan_resources(plan_id, resource_type);

CREATE TABLE IF NOT EXISTS project_plan_risks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES project_plan_tokens(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    probability         NUMERIC NOT NULL CHECK (probability >= 0 AND probability <= 1),
    impact              NUMERIC NOT NULL CHECK (impact >= 0 AND impact <= 1),
    level               TEXT NOT NULL CHECK (level IN ('low','medium','high','critical')),
    owner               TEXT NOT NULL,
    mitigation          TEXT NOT NULL,
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_plan_risks_plan
    ON project_plan_risks(plan_id, level, probability, impact);

CREATE TABLE IF NOT EXISTS project_plan_raci_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES project_plan_tokens(id) ON DELETE CASCADE,
    wbs_id              UUID REFERENCES project_plan_wbs_items(id) ON DELETE CASCADE,
    responsible         TEXT NOT NULL,
    accountable         TEXT NOT NULL,
    consulted           JSONB NOT NULL DEFAULT '[]'::jsonb,
    informed            JSONB NOT NULL DEFAULT '[]'::jsonb,
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_plan_raci_plan
    ON project_plan_raci_entries(plan_id, wbs_id);

CREATE TABLE IF NOT EXISTS project_plan_diagrams (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES project_plan_tokens(id) ON DELETE CASCADE,
    template_id         TEXT NOT NULL,
    title               TEXT NOT NULL,
    family              TEXT NOT NULL,
    engine              TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','pending_approval','approved','archived')),
    object_refs         JSONB NOT NULL DEFAULT '[]'::jsonb,
    cde_file_id         TEXT,
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_plan_diagrams_plan
    ON project_plan_diagrams(plan_id, family, status, updated_at DESC);

ALTER TABLE project_plan_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_plan_versions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_plan_wbs_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_plan_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_plan_milestones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_plan_resources    ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_plan_risks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_plan_raci_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_plan_diagrams     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_plan_tokens_tenant ON project_plan_tokens;
CREATE POLICY project_plan_tokens_tenant ON project_plan_tokens
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());
DROP POLICY IF EXISTS project_plan_versions_tenant ON project_plan_versions;
CREATE POLICY project_plan_versions_tenant ON project_plan_versions
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());
DROP POLICY IF EXISTS project_plan_wbs_tenant ON project_plan_wbs_items;
CREATE POLICY project_plan_wbs_tenant ON project_plan_wbs_items
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());
DROP POLICY IF EXISTS project_plan_tasks_tenant ON project_plan_tasks;
CREATE POLICY project_plan_tasks_tenant ON project_plan_tasks
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());
DROP POLICY IF EXISTS project_plan_milestones_tenant ON project_plan_milestones;
CREATE POLICY project_plan_milestones_tenant ON project_plan_milestones
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());
DROP POLICY IF EXISTS project_plan_resources_tenant ON project_plan_resources;
CREATE POLICY project_plan_resources_tenant ON project_plan_resources
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());
DROP POLICY IF EXISTS project_plan_risks_tenant ON project_plan_risks;
CREATE POLICY project_plan_risks_tenant ON project_plan_risks
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());
DROP POLICY IF EXISTS project_plan_raci_tenant ON project_plan_raci_entries;
CREATE POLICY project_plan_raci_tenant ON project_plan_raci_entries
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());
DROP POLICY IF EXISTS project_plan_diagrams_tenant ON project_plan_diagrams;
CREATE POLICY project_plan_diagrams_tenant ON project_plan_diagrams
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

ALTER TABLE project_plan_tokens       FORCE ROW LEVEL SECURITY;
ALTER TABLE project_plan_versions     FORCE ROW LEVEL SECURITY;
ALTER TABLE project_plan_wbs_items    FORCE ROW LEVEL SECURITY;
ALTER TABLE project_plan_tasks        FORCE ROW LEVEL SECURITY;
ALTER TABLE project_plan_milestones   FORCE ROW LEVEL SECURITY;
ALTER TABLE project_plan_resources    FORCE ROW LEVEL SECURITY;
ALTER TABLE project_plan_risks        FORCE ROW LEVEL SECURITY;
ALTER TABLE project_plan_raci_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE project_plan_diagrams     FORCE ROW LEVEL SECURITY;
