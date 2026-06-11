-- 20260611000009_shipment_bom.sql
-- Stage BOM — Shipment BOM (物流运输 BOM), derived per part from a RELEASED
-- manufacturing BOM. Sits between fabrication (MBOM) and installation (IBOM):
-- MBOM(fabricated) -> Shipment(dispatch/transit/receive) -> IBOM(install).
--
-- Governance encoded:
--   * Derivation gated on the source MBOM being status='released'.
--   * Each shipment line traces to its source MBOM line.
--   * `is_installable` is true only when dispatch_state='received'
--     (master-doc rule: 未签收不得安装 — an item must be received on site before install).
--   * Tenant RLS + FORCE + project-scope (R4 pattern, permissive-when-unset).
-- Idempotent.

CREATE TABLE IF NOT EXISTS shipment_boms (
    shipment_bom_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    manufacturing_bom_id UUID NOT NULL REFERENCES manufacturing_boms(manufacturing_bom_id) ON DELETE CASCADE,
    status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'dispatched', 'delivered')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipment_bom_lines (
    shipment_line_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_bom_id      UUID NOT NULL REFERENCES shipment_boms(shipment_bom_id) ON DELETE CASCADE,
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_mbom_line_id  UUID NOT NULL,
    component_name       TEXT NOT NULL DEFAULT '',
    unit                 TEXT NOT NULL DEFAULT '',
    quantity             NUMERIC(18, 6) NOT NULL DEFAULT 0,
    weight_kg            NUMERIC(18, 6) NOT NULL DEFAULT 0,
    dispatch_batch       TEXT NOT NULL DEFAULT '',
    carrier_ref          TEXT NOT NULL DEFAULT '',
    dispatch_state       TEXT NOT NULL DEFAULT 'pending'
                         CHECK (dispatch_state IN ('pending', 'dispatched', 'in_transit', 'received', 'rejected')),
    received_quantity    NUMERIC(18, 6) NOT NULL DEFAULT 0,
    -- Master-doc gate: an item is installable only once received on site.
    is_installable       BOOLEAN GENERATED ALWAYS AS (dispatch_state = 'received') STORED,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shipment_lines_bom ON shipment_bom_lines(shipment_bom_id);
CREATE INDEX IF NOT EXISTS idx_shipment_lines_installable
    ON shipment_bom_lines(tenant_id, project_id, is_installable);
CREATE INDEX IF NOT EXISTS idx_shipment_lines_source ON shipment_bom_lines(source_mbom_line_id);

-- RLS: tenant isolation + FORCE + project-scope (R4 pattern).
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['shipment_boms', 'shipment_bom_lines'] LOOP
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

-- Derive a shipment BOM from a RELEASED manufacturing BOM.
CREATE OR REPLACE FUNCTION bom_derive_shipment_bom(
    p_manufacturing_bom_id UUID
) RETURNS UUID AS $$
DECLARE
    m RECORD;
    shipment_id UUID;
BEGIN
    SELECT * INTO m FROM manufacturing_boms WHERE manufacturing_bom_id = p_manufacturing_bom_id;
    IF m IS NULL THEN
        RAISE EXCEPTION 'manufacturing_bom % not found', p_manufacturing_bom_id;
    END IF;
    IF m.status <> 'released' THEN
        RAISE EXCEPTION
            'shipment BOM requires a released manufacturing_bom (status=%); only released parts ship',
            m.status USING ERRCODE = 'check_violation';
    END IF;

    shipment_id := gen_random_uuid();
    INSERT INTO shipment_boms
        (shipment_bom_id, tenant_id, project_id, manufacturing_bom_id, status)
    VALUES (shipment_id, m.tenant_id, m.project_id, p_manufacturing_bom_id, 'draft');

    INSERT INTO shipment_bom_lines (
        shipment_bom_id, tenant_id, project_id, source_mbom_line_id,
        component_name, unit, quantity, weight_kg
    )
    SELECT
        shipment_id, l.tenant_id, l.project_id, l.mbom_line_id,
        l.component_name, l.unit, l.quantity, l.weight_kg
    FROM manufacturing_bom_lines l
    WHERE l.manufacturing_bom_id = p_manufacturing_bom_id;

    RETURN shipment_id;
END
$$ LANGUAGE plpgsql;
