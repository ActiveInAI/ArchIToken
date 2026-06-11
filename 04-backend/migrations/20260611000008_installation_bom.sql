-- 20260611000008_installation_bom.sql
-- Stage BOM — IBOM (installation BOM / 施工安装 BOM), derived per fabrication part
-- from a RELEASED manufacturing BOM (installation consumes manufactured parts).
--
-- Governance encoded:
--   * Derivation gated on the source MBOM being status='released'.
--   * Each install line is traceable to its source MBOM line (and thus to the
--     component bom_line and approved bom_version above it).
--   * `is_archivable` is true only when acceptance_state='accepted'
--     (master-doc rule: 未验收不得闭环/归档).
--   * Tenant RLS + FORCE + project-scope (R4 pattern, permissive-when-unset).
-- Idempotent.

CREATE TABLE IF NOT EXISTS installation_boms (
    installation_bom_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    manufacturing_bom_id UUID NOT NULL REFERENCES manufacturing_boms(manufacturing_bom_id) ON DELETE CASCADE,
    status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'in_progress', 'completed')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS installation_bom_lines (
    ibom_line_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_bom_id  UUID NOT NULL REFERENCES installation_boms(installation_bom_id) ON DELETE CASCADE,
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_mbom_line_id  UUID NOT NULL,
    component_name       TEXT NOT NULL DEFAULT '',
    unit                 TEXT NOT NULL DEFAULT '',
    quantity             NUMERIC(18, 6) NOT NULL DEFAULT 0,
    weight_kg            NUMERIC(18, 6) NOT NULL DEFAULT 0,
    install_zone         TEXT NOT NULL DEFAULT '',
    install_sequence     INTEGER,
    installation_state   TEXT NOT NULL DEFAULT 'pending'
                         CHECK (installation_state IN ('pending', 'installing', 'installed', 'rectifying')),
    acceptance_state     TEXT NOT NULL DEFAULT 'pending'
                         CHECK (acceptance_state IN ('pending', 'accepted', 'rejected')),
    -- Master-doc gate: an installed item can only be archived once accepted.
    is_archivable        BOOLEAN GENERATED ALWAYS AS (acceptance_state = 'accepted') STORED,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ibom_lines_bom ON installation_bom_lines(installation_bom_id);
CREATE INDEX IF NOT EXISTS idx_ibom_lines_archivable
    ON installation_bom_lines(tenant_id, project_id, is_archivable);
CREATE INDEX IF NOT EXISTS idx_ibom_lines_source ON installation_bom_lines(source_mbom_line_id);

-- RLS: tenant isolation + FORCE + project-scope (R4 pattern).
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['installation_boms', 'installation_bom_lines'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant', t);
        EXECUTE format(
            'CREATE POLICY %I ON %I USING (tenant_id = current_tenant()) '
            || 'WITH CHECK (tenant_id = current_tenant())', t || '_tenant', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_project_scope', t);
        EXECUTE format(
            'CREATE POLICY %I ON %I AS RESTRICTIVE '
            || 'USING (current_project() IS NULL OR project_id = current_project()) '
            || 'WITH CHECK (current_project() IS NULL OR project_id = current_project())',
            t || '_project_scope', t);
    END LOOP;
END
$$;

-- Derive an installation BOM from a RELEASED manufacturing BOM.
CREATE OR REPLACE FUNCTION bom_derive_installation_bom(
    p_manufacturing_bom_id UUID
) RETURNS UUID AS $$
DECLARE
    m RECORD;
    ibom_id UUID;
BEGIN
    SELECT * INTO m FROM manufacturing_boms WHERE manufacturing_bom_id = p_manufacturing_bom_id;
    IF m IS NULL THEN
        RAISE EXCEPTION 'manufacturing_bom % not found', p_manufacturing_bom_id;
    END IF;
    IF m.status <> 'released' THEN
        RAISE EXCEPTION
            'installation BOM requires a released manufacturing_bom (status=%); installation consumes released parts only',
            m.status USING ERRCODE = 'check_violation';
    END IF;

    ibom_id := gen_random_uuid();
    INSERT INTO installation_boms
        (installation_bom_id, tenant_id, project_id, manufacturing_bom_id, status)
    VALUES (ibom_id, m.tenant_id, m.project_id, p_manufacturing_bom_id, 'draft');

    INSERT INTO installation_bom_lines (
        installation_bom_id, tenant_id, project_id, source_mbom_line_id,
        component_name, unit, quantity, weight_kg
    )
    SELECT
        ibom_id, l.tenant_id, l.project_id, l.mbom_line_id,
        l.component_name, l.unit, l.quantity, l.weight_kg
    FROM manufacturing_bom_lines l
    WHERE l.manufacturing_bom_id = p_manufacturing_bom_id;

    RETURN ibom_id;
END
$$ LANGUAGE plpgsql;
