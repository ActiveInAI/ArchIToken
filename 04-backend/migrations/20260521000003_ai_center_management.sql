-- migrations/20260521000003_ai_center_management.sql
-- ArchIToken AI center durable management schema.
-- Scope: tenant-scoped interface contracts, database bindings, and visualization panel registry.

CREATE TABLE IF NOT EXISTS ai_center_interface_contracts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id       TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT
                        DEFAULT 'ai_center'
                        CHECK (module_id = 'ai_center'),
    contract_key    TEXT NOT NULL,
    name            TEXT NOT NULL,
    method          TEXT NOT NULL CHECK (method IN ('GET','POST','PUT','PATCH','DELETE')),
    path            TEXT NOT NULL,
    boundary        TEXT NOT NULL,
    auth_policy     TEXT NOT NULL,
    data_object     TEXT NOT NULL,
    owner_role      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','configured','review','approved','disabled')),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, contract_key)
);
CREATE INDEX IF NOT EXISTS idx_ai_center_interface_contracts_scope
    ON ai_center_interface_contracts(tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_center_interface_contracts_path
    ON ai_center_interface_contracts(tenant_id, method, path);

CREATE TABLE IF NOT EXISTS ai_center_database_bindings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id           TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT
                            DEFAULT 'ai_center'
                            CHECK (module_id = 'ai_center'),
    binding_key         TEXT NOT NULL,
    name                TEXT NOT NULL,
    object_name         TEXT NOT NULL,
    storage_adapter     TEXT NOT NULL,
    lifecycle_policy    TEXT NOT NULL,
    rls_policy          TEXT NOT NULL,
    owner_role          TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','configured','review','approved','disabled')),
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, binding_key)
);
CREATE INDEX IF NOT EXISTS idx_ai_center_database_bindings_scope
    ON ai_center_database_bindings(tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_center_database_bindings_object
    ON ai_center_database_bindings(tenant_id, object_name);

CREATE TABLE IF NOT EXISTS ai_center_visualization_panels (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id           TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT
                            DEFAULT 'ai_center'
                            CHECK (module_id = 'ai_center'),
    panel_key           TEXT NOT NULL,
    name                TEXT NOT NULL,
    dataset             TEXT NOT NULL,
    view_mode           TEXT NOT NULL,
    refresh_policy      TEXT NOT NULL,
    readiness           INTEGER NOT NULL DEFAULT 0 CHECK (readiness BETWEEN 0 AND 100),
    owner_role          TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','configured','review','approved','disabled')),
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, panel_key)
);
CREATE INDEX IF NOT EXISTS idx_ai_center_visualization_panels_scope
    ON ai_center_visualization_panels(tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_center_visualization_panels_dataset
    ON ai_center_visualization_panels(tenant_id, dataset);

CREATE OR REPLACE FUNCTION current_tenant() RETURNS UUID AS $$
DECLARE
    t TEXT;
BEGIN
    BEGIN
        t := current_setting('app.current_tenant', true);
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;
    IF t IS NULL OR t = '' THEN RETURN NULL; END IF;
    RETURN t::UUID;
END
$$ LANGUAGE plpgsql STABLE;

ALTER TABLE ai_center_interface_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_center_database_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_center_visualization_panels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_center_interface_contracts_tenant
    ON ai_center_interface_contracts;
CREATE POLICY ai_center_interface_contracts_tenant
    ON ai_center_interface_contracts
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS ai_center_database_bindings_tenant
    ON ai_center_database_bindings;
CREATE POLICY ai_center_database_bindings_tenant
    ON ai_center_database_bindings
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS ai_center_visualization_panels_tenant
    ON ai_center_visualization_panels;
CREATE POLICY ai_center_visualization_panels_tenant
    ON ai_center_visualization_panels
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

ALTER TABLE ai_center_interface_contracts FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_center_database_bindings FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_center_visualization_panels FORCE ROW LEVEL SECURITY;
