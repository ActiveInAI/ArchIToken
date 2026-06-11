-- 20260611000011_concept_planning_bom.sql
-- Stage BOMs — CBOM (方案设计 / concept BOM) and Planning BOM (项目管理), the
-- remaining upstream stages between RBOM (demand) and EBOM (component BOM):
--   RBOM(confirmed) -> CBOM(selected) -> Planning(baselined) + deepening -> EBOM -> ...
--
-- Governance encoded:
--   * CBOM derives only from a customer-confirmed demand BOM; `is_ready_for_deepening`
--     is true only when status='selected'.
--   * Planning derives only from a SELECTED concept; `is_baselined` true only when
--     status='baselined' (a baseline then changes via change order, by convention).
--   * Tenant RLS + FORCE + project-scope (R4 pattern, permissive-when-unset).
-- Idempotent.

-- ===========================================================================
-- CBOM — concept / scheme design BOM
-- ===========================================================================
CREATE TABLE IF NOT EXISTS concept_boms (
    concept_bom_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    demand_bom_id         UUID NOT NULL REFERENCES demand_boms(demand_bom_id) ON DELETE CASCADE,
    variant_name          TEXT NOT NULL DEFAULT '',
    status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'selected', 'superseded')),
    is_ready_for_deepening BOOLEAN GENERATED ALWAYS AS (status = 'selected') STORED,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS concept_bom_lines (
    concept_line_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_bom_id        UUID NOT NULL REFERENCES concept_boms(concept_bom_id) ON DELETE CASCADE,
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    element_type          TEXT NOT NULL DEFAULT '',
    category_code         TEXT NOT NULL DEFAULT '',
    material_grade_ref    TEXT REFERENCES bom_material_grades(grade_code) ON DELETE SET NULL,
    est_unit              TEXT NOT NULL DEFAULT '',
    est_quantity          NUMERIC(18, 6) NOT NULL DEFAULT 0,
    est_weight_kg         NUMERIC(18, 6) NOT NULL DEFAULT 0,
    source_demand_line_ref UUID,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_concept_lines_bom ON concept_bom_lines(concept_bom_id);

-- ===========================================================================
-- Planning BOM — project WBS skeleton (mirrors the BOM lifecycle phases)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS planning_boms (
    planning_bom_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    concept_bom_id        UUID NOT NULL REFERENCES concept_boms(concept_bom_id) ON DELETE CASCADE,
    status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'baselined', 'superseded')),
    baselined_at          TIMESTAMPTZ,
    is_baselined          BOOLEAN GENERATED ALWAYS AS (status = 'baselined') STORED,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planning_bom_lines (
    planning_line_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    planning_bom_id       UUID NOT NULL REFERENCES planning_boms(planning_bom_id) ON DELETE CASCADE,
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    wbs_code              TEXT NOT NULL,
    work_package          TEXT NOT NULL,
    phase                 TEXT NOT NULL
                          CHECK (phase IN (
                              'deepening', 'costing', 'procurement', 'manufacturing',
                              'shipment', 'installation', 'acceptance'
                          )),
    sequence_no           INTEGER NOT NULL DEFAULT 0,
    est_duration_days     INTEGER NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_planning_lines_bom ON planning_bom_lines(planning_bom_id);

-- RLS: tenant isolation + FORCE + project-scope (R4 pattern).
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['concept_boms', 'concept_bom_lines', 'planning_boms', 'planning_bom_lines'] LOOP
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

-- Derive a concept BOM from a customer-confirmed demand BOM.
CREATE OR REPLACE FUNCTION bom_derive_concept_bom(
    p_demand_bom_id UUID,
    p_variant_name TEXT DEFAULT 'Scheme A'
) RETURNS UUID AS $$
DECLARE
    d RECORD;
    concept_id UUID;
BEGIN
    SELECT * INTO d FROM demand_boms WHERE demand_bom_id = p_demand_bom_id;
    IF d IS NULL THEN
        RAISE EXCEPTION 'demand_bom % not found', p_demand_bom_id;
    END IF;
    IF d.status <> 'customer_confirmed' THEN
        RAISE EXCEPTION
            'concept BOM requires a customer-confirmed demand (status=%); 无客户确认不得进入深化',
            d.status USING ERRCODE = 'check_violation';
    END IF;

    concept_id := gen_random_uuid();
    INSERT INTO concept_boms
        (concept_bom_id, tenant_id, project_id, demand_bom_id, variant_name, status)
    VALUES (concept_id, d.tenant_id, d.project_id, p_demand_bom_id, p_variant_name, 'draft');

    INSERT INTO concept_bom_lines (
        concept_bom_id, tenant_id, project_id,
        element_type, category_code, material_grade_ref, est_unit, est_quantity, source_demand_line_ref
    )
    SELECT
        concept_id, l.tenant_id, l.project_id,
        l.item_description, l.category_code, l.material_grade_ref, l.estimated_unit,
        l.estimated_quantity, l.demand_line_id
    FROM demand_bom_lines l
    WHERE l.demand_bom_id = p_demand_bom_id;

    RETURN concept_id;
END
$$ LANGUAGE plpgsql;

-- Derive a project planning BOM (standard lifecycle WBS) from a SELECTED concept.
CREATE OR REPLACE FUNCTION bom_derive_planning_bom(
    p_concept_bom_id UUID
) RETURNS UUID AS $$
DECLARE
    c RECORD;
    planning_id UUID;
BEGIN
    SELECT * INTO c FROM concept_boms WHERE concept_bom_id = p_concept_bom_id;
    IF c IS NULL THEN
        RAISE EXCEPTION 'concept_bom % not found', p_concept_bom_id;
    END IF;
    IF c.status <> 'selected' THEN
        RAISE EXCEPTION
            'planning BOM requires a selected concept (status=%); only the selected scheme is planned',
            c.status USING ERRCODE = 'check_violation';
    END IF;

    planning_id := gen_random_uuid();
    INSERT INTO planning_boms
        (planning_bom_id, tenant_id, project_id, concept_bom_id, status)
    VALUES (planning_id, c.tenant_id, c.project_id, p_concept_bom_id, 'draft');

    INSERT INTO planning_bom_lines
        (planning_bom_id, tenant_id, project_id, wbs_code, work_package, phase, sequence_no, est_duration_days)
    SELECT planning_id, c.tenant_id, c.project_id, w.wbs_code, w.work_package, w.phase, w.seq, w.days
    FROM (VALUES
        ('1.1', '深化设计',  'deepening',     1, 15),
        ('1.2', '计量造价',  'costing',       2, 7),
        ('1.3', '材料采购',  'procurement',   3, 20),
        ('1.4', '生产制造',  'manufacturing', 4, 30),
        ('1.5', '物流运输',  'shipment',      5, 7),
        ('1.6', '现场安装',  'installation',  6, 25),
        ('1.7', '验收归档',  'acceptance',    7, 5)
    ) AS w(wbs_code, work_package, phase, seq, days);

    RETURN planning_id;
END
$$ LANGUAGE plpgsql;
