#!/usr/bin/env bash
# BOM derivation chain gate.
#
# Locks in the multi-stage BOM chain (2026-06-11): from an APPROVED component
# bom_version, derive MTO -> PBOM (procurement), MBOM (manufacturing),
# Shipment (logistics) and IBOM (installation). Replays ALL migrations on a
# scratch database, seeds a small approved component BOM, runs every derivation
# function, and asserts the per-stage governance gates and source traceability.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_DATABASE_URL="${ARCHITOKEN_DATABASE__URL:-${DATABASE_URL:-postgres://architoken:architoken_dev_only@127.0.0.1:5433/architoken}}"
SCRATCH_DB="${ARCHITOKEN_BOM_CHAIN_DB:-architoken_bom_chain_smoke}"

trap 'printf "smoke-bom-derivation-chain failed at line %s\n" "${LINENO}" >&2' ERR

for cmd in psql python3; do
    if ! command -v "${cmd}" >/dev/null 2>&1; then
        printf '%s is required for the BOM derivation chain gate\n' "${cmd}" >&2
        exit 1
    fi
done

cd "${REPO_ROOT}"

SCRATCH_DATABASE_URL="$(python3 - "${BASE_DATABASE_URL}" "${SCRATCH_DB}" <<'PY'
import sys
from urllib.parse import urlsplit, urlunsplit
url, db = sys.argv[1], sys.argv[2]
parts = urlsplit(url)
print(urlunsplit((parts.scheme, parts.netloc, f"/{db}", parts.query, parts.fragment)))
PY
)"

printf '=== [1/3] Recreating scratch database %s ===\n' "${SCRATCH_DB}"
psql "${BASE_DATABASE_URL}" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS ${SCRATCH_DB}"
psql "${BASE_DATABASE_URL}" -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE ${SCRATCH_DB}"

printf '=== [2/3] Replaying all migrations in order ===\n'
for migration in 04-backend/migrations/*.sql; do
    psql "${SCRATCH_DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${migration}"
done

printf '=== [3/3] Seeding an approved component BOM and asserting the derivation chain ===\n'
psql "${SCRATCH_DATABASE_URL}" -v ON_ERROR_STOP=1 -q <<'SQL'
SELECT set_config('app.current_tenant', '11111111-1111-4111-8111-111111111111', false);

INSERT INTO tenants(id, name) VALUES ('11111111-1111-4111-8111-111111111111', 'BOM-chain smoke')
    ON CONFLICT DO NOTHING;
INSERT INTO projects(id, tenant_id, name)
    VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'BOM-chain smoke')
    ON CONFLICT DO NOTHING;
INSERT INTO bom_documents(bom_document_id, tenant_id, project_id, source_path, source_kind, source_title, workbook_sheet, workbook_dimension, data_rows)
    VALUES ('d0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '/smoke.xlsx', 'xlsx', 'BOM', '物料清单', 'A1:Q20', 3)
    ON CONFLICT DO NOTHING;
INSERT INTO bom_versions(bom_version_id, tenant_id, project_id, bom_document_id, version_code, version_name, status) VALUES
    ('e0000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'd0000000-0000-4000-8000-000000000001', 'V1', 'approved', 'approved'),
    ('e0000000-0000-4000-8000-00000000000b', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'd0000000-0000-4000-8000-000000000001', 'V2', 'draft', 'draft')
    ON CONFLICT DO NOTHING;
INSERT INTO bom_lines(bom_line_id, tenant_id, project_id, bom_version_id, line_no, category_name, category_code, component_name, unit, set_quantity, total_quantity, total_weight_kg, material_grade, material_grade_ref, section_size, section_profile_ref) VALUES
    (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'e0000000-0000-4000-8000-00000000000a', 1, '钢柱', '30-03.95.03.15', 'Col_A', 'PCS', 1, 10, 487.328, 'Q355D', 'Q355D', 'H200X200X8X12', 'H200X200X8X12'),
    (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'e0000000-0000-4000-8000-00000000000a', 2, '钢柱', '30-03.95.03.15', 'Col_B', 'PCS', 1, 5, 243.664, 'Q355D', 'Q355D', 'H200X200X8X12', 'H200X200X8X12'),
    (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'e0000000-0000-4000-8000-00000000000a', 3, '圆钢', '30-03.95.42.20.10', 'Bar_C', 'PCS', 1, 20, 17.756, 'Q235B', 'Q235B', 'D12', 'D12')
    ON CONFLICT DO NOTHING;

-- Upstream RBOM (demand/quote) entry.
INSERT INTO demand_boms(demand_bom_id, tenant_id, project_id, customer_ref, requirement_ref)
    VALUES ('c0000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'smoke-customer', 'REQ-SMOKE')
    ON CONFLICT DO NOTHING;
INSERT INTO demand_bom_lines(demand_bom_id, tenant_id, project_id, item_description, category_code, material_grade_ref, estimated_unit, estimated_quantity, est_unit_price_cny, confidence) VALUES
    ('c0000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '钢柱 H型', '30-03.95.03.15', 'Q355D', 't', 12, 4200, 'high'),
    ('c0000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '螺栓 10.9S', '30-03.95.42.20.10', '10.9S', '套', 500, 3.5, 'medium');

DO $$
DECLARE
    mto UUID; pbom UUID; mbom UUID; ship UUID; ibom UUID; concept UUID; plan UUID;
    c INT; gate_held BOOLEAN;
BEGIN
    -- Gate: only an approved component BOM may be derived.
    gate_held := false;
    BEGIN
        PERFORM bom_derive_material_takeoff('e0000000-0000-4000-8000-00000000000b');
    EXCEPTION WHEN check_violation THEN gate_held := true;
    END;
    IF NOT gate_held THEN
        RAISE EXCEPTION 'BOM chain smoke: draft version was derivable (approved-only gate broken)';
    END IF;

    -- MTO: aggregate by controlled grade+section (3 lines -> 2 material groups), waste 1.05.
    mto := bom_derive_material_takeoff('e0000000-0000-4000-8000-00000000000a', 1.05);
    SELECT count(*) INTO c FROM bom_material_takeoff_lines WHERE material_takeoff_id = mto;
    IF c <> 2 THEN RAISE EXCEPTION 'BOM chain smoke: expected 2 MTO lines, got %', c; END IF;
    SELECT count(*) INTO c FROM bom_material_takeoff_lines
        WHERE material_takeoff_id = mto AND material_grade_ref = 'Q355D'
          AND gross_weight_kg = 767.541600 AND source_line_count = 2;
    IF c <> 1 THEN RAISE EXCEPTION 'BOM chain smoke: Q355D MTO aggregation/weight wrong'; END IF;

    -- PBOM: nothing purchasable until a price is locked.
    pbom := bom_derive_procurement_bom(mto);
    SELECT count(*) INTO c FROM procurement_bom_lines WHERE procurement_bom_id = pbom AND is_purchasable;
    IF c <> 0 THEN RAISE EXCEPTION 'BOM chain smoke: PBOM had purchasable lines before pricing'; END IF;

    -- MBOM: per-part (3 lines), nothing releasable until process+QC defined.
    mbom := bom_derive_manufacturing_bom('e0000000-0000-4000-8000-00000000000a');
    SELECT count(*) INTO c FROM manufacturing_bom_lines WHERE manufacturing_bom_id = mbom;
    IF c <> 3 THEN RAISE EXCEPTION 'BOM chain smoke: expected 3 MBOM lines, got %', c; END IF;
    SELECT count(*) INTO c FROM manufacturing_bom_lines WHERE manufacturing_bom_id = mbom AND is_releasable;
    IF c <> 0 THEN RAISE EXCEPTION 'BOM chain smoke: MBOM had releasable lines without process/QC'; END IF;

    -- Shipment / IBOM require a released MBOM.
    gate_held := false;
    BEGIN
        PERFORM bom_derive_shipment_bom(mbom);
    EXCEPTION WHEN check_violation THEN gate_held := true;
    END;
    IF NOT gate_held THEN RAISE EXCEPTION 'BOM chain smoke: shipment derivable from draft MBOM (released-only gate broken)'; END IF;

    UPDATE manufacturing_boms SET status = 'released' WHERE manufacturing_bom_id = mbom;

    -- Shipment: nothing installable until received.
    ship := bom_derive_shipment_bom(mbom);
    SELECT count(*) INTO c FROM shipment_bom_lines WHERE shipment_bom_id = ship AND is_installable;
    IF c <> 0 THEN RAISE EXCEPTION 'BOM chain smoke: shipment had installable lines before receipt'; END IF;

    -- IBOM: nothing archivable until accepted; every line traces to its MBOM line.
    ibom := bom_derive_installation_bom(mbom);
    SELECT count(*) INTO c FROM installation_bom_lines WHERE installation_bom_id = ibom AND is_archivable;
    IF c <> 0 THEN RAISE EXCEPTION 'BOM chain smoke: IBOM had archivable lines before acceptance'; END IF;
    SELECT count(*) INTO c FROM installation_bom_lines WHERE installation_bom_id = ibom AND source_mbom_line_id IS NULL;
    IF c <> 0 THEN RAISE EXCEPTION 'BOM chain smoke: IBOM lines missing source traceability'; END IF;

    -- ABOM archive: nothing archives until accepted (未验收不得归档); then only accepted items.
    gate_held := false;
    BEGIN
        PERFORM bom_derive_archive_package(ibom);
    EXCEPTION WHEN check_violation THEN gate_held := true;
    END;
    IF NOT gate_held THEN RAISE EXCEPTION 'BOM chain smoke: archive succeeded with no accepted lines'; END IF;
    UPDATE installation_bom_lines SET acceptance_state = 'accepted' WHERE installation_bom_id = ibom;
    PERFORM bom_derive_archive_package(ibom);
    IF NOT bom_archive_is_complete(ibom) THEN
        RAISE EXCEPTION 'BOM chain smoke: archive not complete after accepting all installation lines';
    END IF;

    -- Upstream RBOM: quote rollup + customer-confirmation gate (无客户确认不得进入深化).
    IF bom_demand_quote_total('c0000000-0000-4000-8000-00000000000a') <> 52150 THEN
        RAISE EXCEPTION 'BOM chain smoke: demand quote total wrong (expected 52150)';
    END IF;
    gate_held := false;
    BEGIN
        PERFORM bom_assert_demand_ready_for_design('c0000000-0000-4000-8000-00000000000a');
    EXCEPTION WHEN check_violation THEN gate_held := true;
    END;
    IF NOT gate_held THEN
        RAISE EXCEPTION 'BOM chain smoke: unconfirmed demand entered deepening (confirmation gate broken)';
    END IF;

    -- CBOM (方案设计) + Planning (项目管理): upstream design/planning stages.
    UPDATE demand_boms SET status = 'customer_confirmed', confirmed_at = NOW()
        WHERE demand_bom_id = 'c0000000-0000-4000-8000-00000000000a';
    concept := bom_derive_concept_bom('c0000000-0000-4000-8000-00000000000a', 'Scheme A');
    SELECT count(*) INTO c FROM concept_bom_lines WHERE concept_bom_id = concept;
    IF c <> 2 THEN RAISE EXCEPTION 'BOM chain smoke: expected 2 concept lines, got %', c; END IF;
    gate_held := false;
    BEGIN
        PERFORM bom_derive_planning_bom(concept);
    EXCEPTION WHEN check_violation THEN gate_held := true;
    END;
    IF NOT gate_held THEN RAISE EXCEPTION 'BOM chain smoke: planning derivable from an unselected concept'; END IF;
    UPDATE concept_boms SET status = 'selected' WHERE concept_bom_id = concept;
    plan := bom_derive_planning_bom(concept);
    SELECT count(*) INTO c FROM planning_bom_lines WHERE planning_bom_id = plan;
    IF c <> 7 THEN RAISE EXCEPTION 'BOM chain smoke: expected 7 WBS lifecycle phases, got %', c; END IF;

    RAISE NOTICE 'BOM derivation chain gate passed (RBOM->CBOM->Planning, EBOM->MTO->PBOM, MBOM->Shipment->IBOM->Archive, gates + traceability)';
END $$;
SQL

psql "${BASE_DATABASE_URL}" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS ${SCRATCH_DB}"
printf 'ArchIToken BOM derivation chain gate passed\n'
