-- 20260611000010_demand_quote_bom.sql
-- Stage BOM — RBOM / Demand BOM (客服报价 / 需求 BOM), the UPSTREAM entry of the chain.
-- Unlike the downstream stages it is NOT derived from the component BOM; it is
-- captured from a customer requirement and FEEDS the chain:
--   RBOM(customer-confirmed) -> concept/deepening -> component BOM (EBOM) -> ...
--
-- Governance encoded:
--   * Per-line estimated total is a generated column (quantity * unit price).
--   * `is_ready_for_design` is true only when status='customer_confirmed'
--     (master-doc rule: 无客户确认不得进入深化).
--   * A quote total helper and an assert-ready gate make the rule executable.
--   * Tenant RLS + FORCE + project-scope (R4 pattern, permissive-when-unset).
-- Idempotent.

CREATE TABLE IF NOT EXISTS demand_boms (
    demand_bom_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    customer_ref         TEXT NOT NULL DEFAULT '',
    requirement_ref      TEXT NOT NULL DEFAULT '',
    status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'customer_confirmed', 'superseded')),
    confirmed_at         TIMESTAMPTZ,
    -- Master-doc gate: a demand/quote may only flow into deepening once the
    -- customer has confirmed it.
    is_ready_for_design  BOOLEAN GENERATED ALWAYS AS (status = 'customer_confirmed') STORED,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demand_bom_lines (
    demand_line_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demand_bom_id        UUID NOT NULL REFERENCES demand_boms(demand_bom_id) ON DELETE CASCADE,
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    item_description     TEXT NOT NULL,
    category_code        TEXT NOT NULL DEFAULT '',
    material_grade_ref   TEXT REFERENCES bom_material_grades(grade_code) ON DELETE SET NULL,
    estimated_unit       TEXT NOT NULL DEFAULT '',
    estimated_quantity   NUMERIC(18, 6) NOT NULL DEFAULT 0,
    est_unit_price_cny   NUMERIC(18, 4) NOT NULL DEFAULT 0,
    est_total_cny        NUMERIC(20, 4) GENERATED ALWAYS AS (estimated_quantity * est_unit_price_cny) STORED,
    confidence           TEXT NOT NULL DEFAULT 'medium'
                         CHECK (confidence IN ('low', 'medium', 'high')),
    source_requirement_ref TEXT NOT NULL DEFAULT '',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_demand_lines_bom ON demand_bom_lines(demand_bom_id);

-- RLS: tenant isolation + FORCE + project-scope (R4 pattern).
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['demand_boms', 'demand_bom_lines'] LOOP
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

-- Quote total for a demand BOM (sum of estimated line totals).
CREATE OR REPLACE FUNCTION bom_demand_quote_total(p_demand_bom_id UUID)
RETURNS NUMERIC AS $$
    SELECT COALESCE(SUM(est_total_cny), 0)
    FROM demand_bom_lines
    WHERE demand_bom_id = p_demand_bom_id;
$$ LANGUAGE sql STABLE;

-- Gate: raise unless the demand BOM is customer-confirmed (callers invoke this
-- before promoting a demand into deepening/component BOM).
CREATE OR REPLACE FUNCTION bom_assert_demand_ready_for_design(p_demand_bom_id UUID)
RETURNS VOID AS $$
DECLARE
    d RECORD;
BEGIN
    SELECT * INTO d FROM demand_boms WHERE demand_bom_id = p_demand_bom_id;
    IF d IS NULL THEN
        RAISE EXCEPTION 'demand_bom % not found', p_demand_bom_id;
    END IF;
    IF d.status <> 'customer_confirmed' THEN
        RAISE EXCEPTION
            'demand BOM % is not customer-confirmed (status=%); cannot enter deepening',
            p_demand_bom_id, d.status USING ERRCODE = 'check_violation';
    END IF;
END
$$ LANGUAGE plpgsql;
