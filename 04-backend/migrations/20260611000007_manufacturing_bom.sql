-- 20260611000007_manufacturing_bom.sql
-- Stage BOM — MBOM (manufacturing BOM / 制造 BOM), derived per-part from an APPROVED
-- component bom_version (manufacturing is per fabrication item, NOT aggregated like MTO).
-- Complements the program-specific heavy_steel_module_work_orders with a general,
-- component-BOM-driven manufacturing line set.
--
-- Governance encoded:
--   * Derivation gated on status='approved' (downstream consumes approved only).
--   * `is_releasable` is true only when a process route AND a QC rule are defined
--     (master-doc rule: 工艺/质检规则缺失不得排产).
--   * Tenant RLS + FORCE + project-scope (R4 pattern, permissive-when-unset).
--   * Each fabrication line is traceable to its source component bom_line.
-- Idempotent.

CREATE TABLE IF NOT EXISTS manufacturing_boms (
    manufacturing_bom_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_version_id       UUID NOT NULL REFERENCES bom_versions(bom_version_id) ON DELETE CASCADE,
    status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'released', 'superseded')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manufacturing_bom_lines (
    mbom_line_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturing_bom_id UUID NOT NULL REFERENCES manufacturing_boms(manufacturing_bom_id) ON DELETE CASCADE,
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_bom_line_id   UUID NOT NULL,
    component_name       TEXT NOT NULL DEFAULT '',
    material_grade_ref   TEXT REFERENCES bom_material_grades(grade_code) ON DELETE SET NULL,
    section_profile_ref  TEXT REFERENCES bom_section_profiles(profile_key) ON DELETE SET NULL,
    unit                 TEXT NOT NULL DEFAULT '',
    quantity             NUMERIC(18, 6) NOT NULL DEFAULT 0,
    weight_kg            NUMERIC(18, 6) NOT NULL DEFAULT 0,
    process_route        TEXT NOT NULL DEFAULT '',
    qc_rule              TEXT NOT NULL DEFAULT '',
    fabrication_state    TEXT NOT NULL DEFAULT 'planned'
                         CHECK (fabrication_state IN (
                             'planned', 'cutting', 'welding', 'coating', 'qc', 'packed', 'dispatched'
                         )),
    -- Master-doc gate: cannot be released to production without a process route and QC rule.
    is_releasable        BOOLEAN GENERATED ALWAYS AS (process_route <> '' AND qc_rule <> '') STORED,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mbom_lines_bom ON manufacturing_bom_lines(manufacturing_bom_id);
CREATE INDEX IF NOT EXISTS idx_mbom_lines_releasable
    ON manufacturing_bom_lines(tenant_id, project_id, is_releasable);
CREATE INDEX IF NOT EXISTS idx_mbom_lines_source ON manufacturing_bom_lines(source_bom_line_id);

-- RLS: tenant isolation + FORCE + project-scope (R4 pattern).
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['manufacturing_boms', 'manufacturing_bom_lines'] LOOP
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

-- Derive a per-part MBOM from an APPROVED component bom_version.
CREATE OR REPLACE FUNCTION bom_derive_manufacturing_bom(
    p_bom_version_id UUID
) RETURNS UUID AS $$
DECLARE
    v RECORD;
    mbom_id UUID;
BEGIN
    SELECT * INTO v FROM bom_versions WHERE bom_version_id = p_bom_version_id;
    IF v IS NULL THEN
        RAISE EXCEPTION 'bom_version % not found', p_bom_version_id;
    END IF;
    IF v.status <> 'approved' THEN
        RAISE EXCEPTION
            'manufacturing BOM requires an approved bom_version (status=%); downstream consumes approved only',
            v.status USING ERRCODE = 'check_violation';
    END IF;

    mbom_id := gen_random_uuid();
    INSERT INTO manufacturing_boms
        (manufacturing_bom_id, tenant_id, project_id, bom_version_id, status)
    VALUES (mbom_id, v.tenant_id, v.project_id, p_bom_version_id, 'draft');

    INSERT INTO manufacturing_bom_lines (
        manufacturing_bom_id, tenant_id, project_id, source_bom_line_id,
        component_name, material_grade_ref, section_profile_ref, unit, quantity, weight_kg
    )
    SELECT
        mbom_id, bl.tenant_id, bl.project_id, bl.bom_line_id,
        bl.component_name, bl.material_grade_ref, bl.section_profile_ref,
        bl.unit, bl.total_quantity, COALESCE(bl.total_weight_kg, 0)
    FROM bom_lines bl
    WHERE bl.bom_version_id = p_bom_version_id;

    RETURN mbom_id;
END
$$ LANGUAGE plpgsql;
