#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATABASE_URL="${ARCHITOKEN_DATABASE__URL:-${DATABASE_URL:-postgres://architoken:architoken_dev_only@127.0.0.1:5433/architoken}}"
MIGRATION_REL="04-backend/migrations/20260609000001_component_bom_database_bridge.sql"
MIGRATION="${REPO_ROOT}/${MIGRATION_REL}"
TENANT_ID="11111111-1111-4111-8111-111111111111"
PROJECT_ID="5abffe50-2670-42e2-97ea-ec6ac71d8183"

trap 'printf "smoke-heavy-steel-database-bridge failed at line %s\n" "${LINENO}" >&2' ERR

if ! command -v psql >/dev/null 2>&1; then
    printf 'psql is required for heavy-steel database bridge smoke\n' >&2
    exit 1
fi

if [[ ! -f "${MIGRATION}" ]]; then
    printf 'migration not found: %s\n' "${MIGRATION}" >&2
    exit 1
fi

if [[ ! -f "/home/insome/下载/应舍美居_构件物料清单.xlsx" ]]; then
    printf 'source BOM workbook not found: /home/insome/下载/应舍美居_构件物料清单.xlsx\n' >&2
    exit 1
fi

if [[ ! -f "/home/insome/下载/重钢装配式酒店深化图纸目录.docx" ]]; then
    printf 'source drawing catalog not found: /home/insome/下载/重钢装配式酒店深化图纸目录.docx\n' >&2
    exit 1
fi

cd "${REPO_ROOT}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${MIGRATION_REL}" >/dev/null

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 \
    -v tenant_id="${TENANT_ID}" \
    -v project_id="${PROJECT_ID}" <<'SQL'
SELECT set_config('app.current_tenant', :'tenant_id', false);

DO $$
DECLARE
    status_row heavy_steel_database_bridge_status%ROWTYPE;
    wrong_tenant_count BIGINT;
    current_role_bypasses_rls BOOLEAN;
    rls_guard_count BIGINT;
BEGIN
    SELECT * INTO status_row FROM heavy_steel_database_bridge_status;

    IF status_row.source_drawing_count <> 198 THEN
        RAISE EXCEPTION 'expected 198 source drawings, got %', status_row.source_drawing_count;
    END IF;
    IF status_row.source_package_count <> 8 THEN
        RAISE EXCEPTION 'expected 8 source packages, got %', status_row.source_package_count;
    END IF;
    IF status_row.source_section_count <> 33 THEN
        RAISE EXCEPTION 'expected 33 source sections, got %', status_row.source_section_count;
    END IF;
    IF status_row.bound_module_count < 16 THEN
        RAISE EXCEPTION 'expected at least 16 module database bindings, got %', status_row.bound_module_count;
    END IF;
    IF status_row.package_work_item_count <> 8 THEN
        RAISE EXCEPTION 'expected 8 package work items, got %', status_row.package_work_item_count;
    END IF;
    IF status_row.bom_document_count <> 1 THEN
        RAISE EXCEPTION 'expected 1 BOM document, got %', status_row.bom_document_count;
    END IF;
    IF status_row.bom_version_count <> 1 THEN
        RAISE EXCEPTION 'expected 1 BOM version, got %', status_row.bom_version_count;
    END IF;
    IF status_row.bom_line_count <> 14 THEN
        RAISE EXCEPTION 'expected 14 imported BOM lines, got %', status_row.bom_line_count;
    END IF;
    IF status_row.bom_total_quantity <> 470 THEN
        RAISE EXCEPTION 'expected BOM total quantity 470, got %', status_row.bom_total_quantity;
    END IF;
    IF status_row.bom_line_source_count <> 14 THEN
        RAISE EXCEPTION 'expected 14 BOM source rows, got %', status_row.bom_line_source_count;
    END IF;
    IF status_row.downstream_link_count <> 84 THEN
        RAISE EXCEPTION 'expected 84 downstream links, got %', status_row.downstream_link_count;
    END IF;
    IF status_row.graph_edge_count < 100 THEN
        RAISE EXCEPTION 'expected at least 100 graph edges for the bridge, got %', status_row.graph_edge_count;
    END IF;
    IF status_row.event_count <> 15 THEN
        RAISE EXCEPTION 'expected 15 component BOM events, got %', status_row.event_count;
    END IF;
    IF status_row.analytics_count <> 2 THEN
        RAISE EXCEPTION 'expected 2 component BOM analytics metrics, got %', status_row.analytics_count;
    END IF;
    IF status_row.audit_count <> 1 THEN
        RAISE EXCEPTION 'expected 1 audit event, got %', status_row.audit_count;
    END IF;

    SELECT rolbypassrls OR rolsuper INTO current_role_bypasses_rls
    FROM pg_roles
    WHERE rolname = current_user;

    IF current_role_bypasses_rls THEN
        SELECT COUNT(*) INTO rls_guard_count
        FROM pg_class c
        JOIN pg_policies p ON p.tablename = c.relname
        WHERE c.relname IN (
            'module_database_operation_bindings',
            'heavy_steel_project_contracts',
            'heavy_steel_package_work_items',
            'heavy_steel_module_work_orders',
            'bom_documents',
            'bom_versions',
            'bom_lines',
            'bom_line_sources',
            'bom_downstream_links'
        )
          AND c.relrowsecurity
          AND c.relforcerowsecurity
          AND p.qual = '(tenant_id = current_tenant())'
          AND p.with_check = '(tenant_id = current_tenant())';

        IF rls_guard_count <> 9 THEN
            RAISE EXCEPTION 'expected 9 RLS guarded bridge tables, got %', rls_guard_count;
        END IF;
    ELSE
        PERFORM set_config('app.current_tenant', '00000000-0000-4000-8000-000000000000', false);
        SELECT COUNT(*) INTO wrong_tenant_count FROM bom_lines;
        IF wrong_tenant_count <> 0 THEN
            RAISE EXCEPTION 'RLS failed: wrong tenant can see % bom_lines', wrong_tenant_count;
        END IF;
    END IF;
END $$;

SELECT set_config('app.current_tenant', :'tenant_id', false);

SELECT
    source_drawing_count,
    source_package_count,
    source_section_count,
    bound_module_count,
    package_work_item_count,
    module_work_order_count,
    bom_line_count,
    bom_total_quantity,
    downstream_link_count,
    graph_edge_count,
    event_count,
    analytics_count,
    audit_count
FROM heavy_steel_database_bridge_status;

SELECT line_no, category_name, category_code, component_name, total_quantity, weight_state, validation_state
FROM bom_lines
WHERE tenant_id = :'tenant_id'
  AND project_id = :'project_id'
ORDER BY line_no
LIMIT 5;
SQL

printf 'heavy-steel database bridge smoke passed\n'
printf 'migration: %s\n' "${MIGRATION}"
printf 'source BOM: /home/insome/下载/应舍美居_构件物料清单.xlsx\n'
printf 'source drawings: /home/insome/下载/重钢装配式酒店深化图纸目录.docx\n'
