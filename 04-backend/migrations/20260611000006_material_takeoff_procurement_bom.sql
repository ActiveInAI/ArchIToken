-- 20260611000006_material_takeoff_procurement_bom.sql
-- Stage-BOM derivation (real source -> derived consumers, per the architecture):
-- MTO (material takeoff / 材料提量) and PBOM (procurement BOM / 采购 BOM) are NOT
-- copies of the component BOM. They are DERIVED from an APPROVED component bom_version,
-- aggregated by the R5 controlled material grade + section profile, and remain
-- traceable to their source version/lines.
--
-- Governance encoded:
--   * Derivation requires status='approved' (downstream consumes approved only).
--   * Procurement lines carry the price-evidence state machine; `is_purchasable`
--     is true only for supplier_quote/locked (no SKU/quote evidence => not purchasable).
--   * Tenant RLS + FORCE + project-scope (R4 pattern: permissive when project unset).
-- Idempotent.

-- ===========================================================================
-- MTO — material takeoff
-- ===========================================================================
CREATE TABLE IF NOT EXISTS bom_material_takeoffs (
    material_takeoff_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_version_id      UUID NOT NULL REFERENCES bom_versions(bom_version_id) ON DELETE CASCADE,
    waste_factor        NUMERIC(8, 4) NOT NULL DEFAULT 1.00 CHECK (waste_factor >= 1.0),
    status              TEXT NOT NULL DEFAULT 'derived'
                        CHECK (status IN ('derived', 'reviewed', 'superseded')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bom_material_takeoff_lines (
    mto_line_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_takeoff_id UUID NOT NULL REFERENCES bom_material_takeoffs(material_takeoff_id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    material_grade_ref  TEXT REFERENCES bom_material_grades(grade_code) ON DELETE SET NULL,
    material_grade_text TEXT,
    section_profile_ref TEXT REFERENCES bom_section_profiles(profile_key) ON DELETE SET NULL,
    section_text        TEXT,
    unit                TEXT NOT NULL DEFAULT '',
    net_quantity        NUMERIC(18, 6) NOT NULL DEFAULT 0,
    net_weight_kg       NUMERIC(18, 6) NOT NULL DEFAULT 0,
    waste_factor        NUMERIC(8, 4) NOT NULL DEFAULT 1.00,
    gross_quantity      NUMERIC(18, 6) NOT NULL DEFAULT 0,
    gross_weight_kg     NUMERIC(18, 6) NOT NULL DEFAULT 0,
    source_bom_version_id UUID NOT NULL,
    source_line_count   INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mto_lines_takeoff ON bom_material_takeoff_lines(material_takeoff_id);
CREATE INDEX IF NOT EXISTS idx_mto_lines_grade ON bom_material_takeoff_lines(tenant_id, project_id, material_grade_ref);

-- ===========================================================================
-- PBOM — procurement BOM
-- ===========================================================================
CREATE TABLE IF NOT EXISTS procurement_boms (
    procurement_bom_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    material_takeoff_id UUID NOT NULL REFERENCES bom_material_takeoffs(material_takeoff_id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'comparing', 'approved', 'issued')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procurement_bom_lines (
    pbom_line_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procurement_bom_id  UUID NOT NULL REFERENCES procurement_boms(procurement_bom_id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    material_grade_ref  TEXT REFERENCES bom_material_grades(grade_code) ON DELETE SET NULL,
    material_grade_text TEXT,
    section_profile_ref TEXT REFERENCES bom_section_profiles(profile_key) ON DELETE SET NULL,
    section_text        TEXT,
    unit                TEXT NOT NULL DEFAULT '',
    required_quantity   NUMERIC(18, 6) NOT NULL DEFAULT 0,
    required_weight_kg  NUMERIC(18, 6) NOT NULL DEFAULT 0,
    supplier_ref        TEXT NOT NULL DEFAULT '',
    lead_time_days      INTEGER,
    price_state         TEXT NOT NULL DEFAULT 'budget_placeholder'
                        CHECK (price_state IN (
                            'budget_placeholder', 'user_input', 'pending_jd_lock',
                            'supplier_quote', 'locked', 'expired'
                        )),
    locked_unit_price_cny NUMERIC(18, 4),
    price_evidence_ref  UUID,
    -- Audit rule: not purchasable until a supplier quote / locked SKU price exists.
    is_purchasable      BOOLEAN GENERATED ALWAYS AS (price_state IN ('supplier_quote', 'locked')) STORED,
    source_mto_line_id  UUID NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pbom_lines_bom ON procurement_bom_lines(procurement_bom_id);
CREATE INDEX IF NOT EXISTS idx_pbom_lines_purchasable ON procurement_bom_lines(tenant_id, project_id, is_purchasable);

-- ===========================================================================
-- RLS: tenant isolation + FORCE + project-scope (R4 pattern, permissive-when-unset)
-- ===========================================================================
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'bom_material_takeoffs',
        'bom_material_takeoff_lines',
        'procurement_boms',
        'procurement_bom_lines'
    ] LOOP
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

-- ===========================================================================
-- Derivation functions (executable "材料提量" and "采购 BOM" generation)
-- ===========================================================================

-- Derive an MTO from an APPROVED component bom_version, aggregating by the
-- controlled material grade + section profile (R5). Returns the new MTO id.
CREATE OR REPLACE FUNCTION bom_derive_material_takeoff(
    p_bom_version_id UUID,
    p_waste_factor NUMERIC DEFAULT 1.00
) RETURNS UUID AS $$
DECLARE
    v RECORD;
    mto_id UUID;
BEGIN
    SELECT * INTO v FROM bom_versions WHERE bom_version_id = p_bom_version_id;
    IF v IS NULL THEN
        RAISE EXCEPTION 'bom_version % not found', p_bom_version_id;
    END IF;
    IF v.status <> 'approved' THEN
        RAISE EXCEPTION
            'material takeoff requires an approved bom_version (status=%); downstream consumes approved only',
            v.status USING ERRCODE = 'check_violation';
    END IF;

    mto_id := gen_random_uuid();
    INSERT INTO bom_material_takeoffs
        (material_takeoff_id, tenant_id, project_id, bom_version_id, waste_factor, status)
    VALUES (mto_id, v.tenant_id, v.project_id, p_bom_version_id, p_waste_factor, 'derived');

    INSERT INTO bom_material_takeoff_lines (
        material_takeoff_id, tenant_id, project_id,
        material_grade_ref, material_grade_text, section_profile_ref, section_text, unit,
        net_quantity, net_weight_kg, waste_factor, gross_quantity, gross_weight_kg,
        source_bom_version_id, source_line_count
    )
    SELECT
        mto_id, v.tenant_id, v.project_id,
        bl.material_grade_ref, NULLIF(bl.material_grade, ''),
        bl.section_profile_ref, NULLIF(bl.section_size, ''), bl.unit,
        SUM(bl.total_quantity),
        COALESCE(SUM(bl.total_weight_kg), 0),
        p_waste_factor,
        SUM(bl.total_quantity) * p_waste_factor,
        COALESCE(SUM(bl.total_weight_kg), 0) * p_waste_factor,
        p_bom_version_id,
        COUNT(*)
    FROM bom_lines bl
    WHERE bl.bom_version_id = p_bom_version_id
    GROUP BY
        bl.material_grade_ref, NULLIF(bl.material_grade, ''),
        bl.section_profile_ref, NULLIF(bl.section_size, ''), bl.unit;

    RETURN mto_id;
END
$$ LANGUAGE plpgsql;

-- Derive a draft PBOM from an MTO; every procurement line starts as
-- budget_placeholder (not purchasable until a quote/locked price is attached).
CREATE OR REPLACE FUNCTION bom_derive_procurement_bom(
    p_material_takeoff_id UUID
) RETURNS UUID AS $$
DECLARE
    m RECORD;
    pbom_id UUID;
BEGIN
    SELECT * INTO m FROM bom_material_takeoffs WHERE material_takeoff_id = p_material_takeoff_id;
    IF m IS NULL THEN
        RAISE EXCEPTION 'material_takeoff % not found', p_material_takeoff_id;
    END IF;

    pbom_id := gen_random_uuid();
    INSERT INTO procurement_boms
        (procurement_bom_id, tenant_id, project_id, material_takeoff_id, status)
    VALUES (pbom_id, m.tenant_id, m.project_id, p_material_takeoff_id, 'draft');

    INSERT INTO procurement_bom_lines (
        procurement_bom_id, tenant_id, project_id,
        material_grade_ref, material_grade_text, section_profile_ref, section_text, unit,
        required_quantity, required_weight_kg, price_state, source_mto_line_id
    )
    SELECT
        pbom_id, l.tenant_id, l.project_id,
        l.material_grade_ref, l.material_grade_text, l.section_profile_ref, l.section_text, l.unit,
        l.gross_quantity, l.gross_weight_kg, 'budget_placeholder', l.mto_line_id
    FROM bom_material_takeoff_lines l
    WHERE l.material_takeoff_id = p_material_takeoff_id;

    RETURN pbom_id;
END
$$ LANGUAGE plpgsql;
