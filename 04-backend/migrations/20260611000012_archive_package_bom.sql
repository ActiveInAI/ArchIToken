-- 20260611000012_archive_package_bom.sql
-- Stage BOM — Archive package (数字档案 / ABOM), the DOWNSTREAM endpoint of the chain.
-- Closes the lifecycle: IBOM(accepted) -> archive package. Only accepted (is_archivable)
-- installation items may be archived (master-doc rule: 未验收不得闭环/归档).
--
-- Governance encoded:
--   * Derivation includes ONLY accepted IBOM lines; if none are accepted it raises.
--   * `is_sealed` is true only when status='sealed'; an archive is sealable only once
--     every installation line of its source IBOM is accepted (completeness helper).
--   * Each archive item traces to its source IBOM line (and thus the whole chain).
--   * Tenant RLS + FORCE + project-scope (R4 pattern, permissive-when-unset).
-- Idempotent.

CREATE TABLE IF NOT EXISTS archive_packages (
    archive_package_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    installation_bom_id  UUID NOT NULL REFERENCES installation_boms(installation_bom_id) ON DELETE CASCADE,
    status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'sealed', 'superseded')),
    sealed_at            TIMESTAMPTZ,
    is_sealed            BOOLEAN GENERATED ALWAYS AS (status = 'sealed') STORED,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS archive_package_items (
    archive_item_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    archive_package_id   UUID NOT NULL REFERENCES archive_packages(archive_package_id) ON DELETE CASCADE,
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_ibom_line_id  UUID NOT NULL,
    component_name       TEXT NOT NULL DEFAULT '',
    unit                 TEXT NOT NULL DEFAULT '',
    quantity             NUMERIC(18, 6) NOT NULL DEFAULT 0,
    weight_kg            NUMERIC(18, 6) NOT NULL DEFAULT 0,
    evidence_ref         TEXT NOT NULL DEFAULT '',
    retention_years      INTEGER NOT NULL DEFAULT 30,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_archive_items_pkg ON archive_package_items(archive_package_id);
CREATE INDEX IF NOT EXISTS idx_archive_items_source ON archive_package_items(source_ibom_line_id);

-- RLS: tenant isolation + FORCE + project-scope (R4 pattern).
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['archive_packages', 'archive_package_items'] LOOP
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

-- Derive an archive package from an installation BOM, including ONLY accepted
-- (is_archivable) lines. Raises if nothing is accepted yet.
CREATE OR REPLACE FUNCTION bom_derive_archive_package(
    p_installation_bom_id UUID
) RETURNS UUID AS $$
DECLARE
    ib RECORD;
    accepted_count INT;
    archive_id UUID;
BEGIN
    SELECT * INTO ib FROM installation_boms WHERE installation_bom_id = p_installation_bom_id;
    IF ib IS NULL THEN
        RAISE EXCEPTION 'installation_bom % not found', p_installation_bom_id;
    END IF;

    SELECT count(*) INTO accepted_count
    FROM installation_bom_lines
    WHERE installation_bom_id = p_installation_bom_id AND is_archivable;
    IF accepted_count = 0 THEN
        RAISE EXCEPTION
            'no accepted installation lines to archive (installation_bom=%); 未验收不得归档',
            p_installation_bom_id USING ERRCODE = 'check_violation';
    END IF;

    archive_id := gen_random_uuid();
    INSERT INTO archive_packages
        (archive_package_id, tenant_id, project_id, installation_bom_id, status)
    VALUES (archive_id, ib.tenant_id, ib.project_id, p_installation_bom_id, 'draft');

    INSERT INTO archive_package_items (
        archive_package_id, tenant_id, project_id, source_ibom_line_id,
        component_name, unit, quantity, weight_kg
    )
    SELECT
        archive_id, l.tenant_id, l.project_id, l.ibom_line_id,
        l.component_name, l.unit, l.quantity, l.weight_kg
    FROM installation_bom_lines l
    WHERE l.installation_bom_id = p_installation_bom_id AND l.is_archivable;

    RETURN archive_id;
END
$$ LANGUAGE plpgsql;

-- Completeness helper: returns true when every installation line is accepted, i.e.
-- the archive can be sealed (no outstanding unaccepted items).
CREATE OR REPLACE FUNCTION bom_archive_is_complete(p_installation_bom_id UUID)
RETURNS BOOLEAN AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM installation_bom_lines
        WHERE installation_bom_id = p_installation_bom_id AND NOT is_archivable
    );
$$ LANGUAGE sql STABLE;
