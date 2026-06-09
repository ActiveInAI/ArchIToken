-- ArchIToken component BOM and heavy-steel database bridge.
--
-- This migration turns the current real source files into tenant-isolated
-- business data. It intentionally keeps professional status as
-- `professional_review_required`; the imported workbook is source evidence,
-- not a construction/manufacturing approval.

CREATE OR REPLACE FUNCTION architoken_seed_uuid(seed TEXT) RETURNS UUID AS $$
    SELECT (
        substr(md5(seed), 1, 8) || '-' ||
        substr(md5(seed), 9, 4) || '-' ||
        substr(md5(seed), 13, 4) || '-' ||
        substr(md5(seed), 17, 4) || '-' ||
        substr(md5(seed), 21, 12)
    )::uuid;
$$ LANGUAGE SQL IMMUTABLE;

SELECT set_config('app.current_tenant', '11111111-1111-4111-8111-111111111111', false);

INSERT INTO tenants (id, name, locale, region)
VALUES (
    '11111111-1111-4111-8111-111111111111',
    'ArchIToken 默认开发租户',
    'zh-CN',
    'CN'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    locale = EXCLUDED.locale,
    region = EXCLUDED.region,
    updated_at = NOW();

INSERT INTO projects (
    id,
    tenant_id,
    name,
    description,
    current_module_id,
    location,
    metadata
) VALUES (
    '5abffe50-2670-42e2-97ea-ec6ac71d8183',
    '11111111-1111-4111-8111-111111111111',
    '100间精品酒店 · Q235B 全栓接重钢装配式',
    '重钢突破样板项目。数据库真源来自本机 Word 图纸目录和 Excel 构件物料清单，所有专业结论仍需责任人复核。',
    'detailed_design',
    '待确认',
    jsonb_build_object(
        'anchorProgramId', 'heavy_steel_hotel_100_rooms_q235b_bolted',
        'sourceDrawingCatalog', '/home/insome/下载/重钢装配式酒店深化图纸目录.docx',
        'sourceBomWorkbook', '/home/insome/下载/应舍美居_构件物料清单.xlsx',
        'professionalState', 'professional_review_required'
    )
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    current_module_id = EXCLUDED.current_module_id,
    location = EXCLUDED.location,
    metadata = projects.metadata || EXCLUDED.metadata,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS module_database_operation_bindings (
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id            UUID REFERENCES projects(id) ON DELETE CASCADE,
    module_id             TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT,
    operation_surface     TEXT NOT NULL,
    relational_route      TEXT NOT NULL,
    object_route          TEXT NOT NULL,
    graph_route           TEXT NOT NULL,
    event_route           TEXT NOT NULL,
    analytics_route       TEXT NOT NULL,
    audit_route           TEXT NOT NULL,
    write_policy          TEXT NOT NULL DEFAULT 'approval_required'
                         CHECK (write_policy IN ('read_only','approval_required','system_guarded')),
    binding_state         TEXT NOT NULL DEFAULT 'active'
                         CHECK (binding_state IN ('active','blocked','review_required')),
    metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, project_id, module_id, operation_surface)
);

CREATE INDEX IF NOT EXISTS idx_module_database_operation_bindings_module
    ON module_database_operation_bindings(tenant_id, module_id, binding_state);

CREATE TABLE IF NOT EXISTS heavy_steel_project_contracts (
    contract_id           UUID PRIMARY KEY,
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    program_id            TEXT NOT NULL REFERENCES heavy_steel_programs(program_id) ON DELETE RESTRICT,
    contract_name         TEXT NOT NULL,
    room_count            INTEGER NOT NULL CHECK (room_count > 0),
    structure_system      TEXT NOT NULL,
    data_truth_state      TEXT NOT NULL DEFAULT 'source_imported'
                         CHECK (data_truth_state IN ('source_imported','professional_review_required','approved','blocked')),
    professional_state    TEXT NOT NULL DEFAULT 'professional_review_required'
                         CHECK (professional_state IN ('professional_review_required','reviewing','approved','rejected')),
    metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_heavy_steel_project_contracts_scope
    ON heavy_steel_project_contracts(tenant_id, project_id, program_id);

CREATE TABLE IF NOT EXISTS heavy_steel_package_work_items (
    work_item_id          UUID PRIMARY KEY,
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    program_id            TEXT NOT NULL REFERENCES heavy_steel_programs(program_id) ON DELETE CASCADE,
    package_mark          TEXT NOT NULL,
    package_name          TEXT NOT NULL,
    drawing_count         INTEGER NOT NULL CHECK (drawing_count >= 0),
    section_count         INTEGER NOT NULL CHECK (section_count >= 0),
    source_document_id    TEXT NOT NULL REFERENCES heavy_steel_source_documents(source_document_id) ON DELETE RESTRICT,
    source_state          TEXT NOT NULL DEFAULT 'source_mapped'
                         CHECK (source_state IN ('source_mapped','professional_review_required','approved','blocked')),
    metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, program_id, package_mark)
);

CREATE INDEX IF NOT EXISTS idx_heavy_steel_package_work_items_program
    ON heavy_steel_package_work_items(tenant_id, project_id, program_id, package_mark);

CREATE TABLE IF NOT EXISTS heavy_steel_module_work_orders (
    work_order_id         UUID PRIMARY KEY,
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    program_id            TEXT NOT NULL REFERENCES heavy_steel_programs(program_id) ON DELETE CASCADE,
    package_work_item_id  UUID NOT NULL REFERENCES heavy_steel_package_work_items(work_item_id) ON DELETE CASCADE,
    module_id             TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT,
    work_order_type       TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'professional_review_required'
                         CHECK (status IN ('draft','professional_review_required','ready_for_planning','blocked','approved')),
    source_state          TEXT NOT NULL DEFAULT 'source_mapped'
                         CHECK (source_state IN ('source_mapped','derived_from_bom','approved','blocked')),
    metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, program_id, package_work_item_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_heavy_steel_module_work_orders_module
    ON heavy_steel_module_work_orders(tenant_id, project_id, module_id, status);

CREATE TABLE IF NOT EXISTS bom_documents (
    bom_document_id       UUID PRIMARY KEY,
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module_id             TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT DEFAULT 'detailed_design',
    source_path           TEXT NOT NULL,
    source_kind           TEXT NOT NULL,
    source_title          TEXT NOT NULL,
    workbook_sheet        TEXT NOT NULL,
    workbook_dimension    TEXT NOT NULL,
    data_rows             INTEGER NOT NULL CHECK (data_rows >= 0),
    source_hash           TEXT,
    import_state          TEXT NOT NULL DEFAULT 'source_imported'
                         CHECK (import_state IN ('source_imported','professional_review_required','approved','rejected')),
    metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, source_path, workbook_sheet)
);

CREATE INDEX IF NOT EXISTS idx_bom_documents_scope
    ON bom_documents(tenant_id, project_id, module_id, import_state);

CREATE TABLE IF NOT EXISTS bom_versions (
    bom_version_id        UUID PRIMARY KEY,
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_document_id       UUID NOT NULL REFERENCES bom_documents(bom_document_id) ON DELETE CASCADE,
    version_code          TEXT NOT NULL,
    version_name          TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'professional_review_required'
                         CHECK (status IN ('draft','source_imported','professional_review_required','approved','archived','rejected')),
    line_count            INTEGER NOT NULL DEFAULT 0 CHECK (line_count >= 0),
    total_quantity        NUMERIC(18,6) NOT NULL DEFAULT 0,
    total_weight_kg       NUMERIC(18,6),
    professional_state    TEXT NOT NULL DEFAULT 'professional_review_required'
                         CHECK (professional_state IN ('professional_review_required','reviewing','approved','rejected')),
    metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, bom_document_id, version_code)
);

CREATE INDEX IF NOT EXISTS idx_bom_versions_scope
    ON bom_versions(tenant_id, project_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS bom_lines (
    bom_line_id           UUID PRIMARY KEY,
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_version_id        UUID NOT NULL REFERENCES bom_versions(bom_version_id) ON DELETE CASCADE,
    line_no               INTEGER NOT NULL CHECK (line_no > 0),
    category_name         TEXT NOT NULL,
    category_code         TEXT NOT NULL,
    component_name        TEXT NOT NULL,
    section_size          TEXT NOT NULL DEFAULT '',
    length_mm             NUMERIC(18,3),
    position_ref          TEXT NOT NULL DEFAULT '',
    material_grade        TEXT NOT NULL DEFAULT '',
    specification         TEXT NOT NULL DEFAULT '',
    drawing_no            TEXT NOT NULL DEFAULT '',
    floor_level           TEXT NOT NULL DEFAULT '',
    unit                  TEXT NOT NULL DEFAULT '',
    set_quantity          NUMERIC(18,6) NOT NULL DEFAULT 0,
    total_quantity        NUMERIC(18,6) NOT NULL DEFAULT 0,
    unit_weight_kg        NUMERIC(18,6),
    total_weight_kg       NUMERIC(18,6),
    weight_state          TEXT NOT NULL DEFAULT 'missing_in_source'
                         CHECK (weight_state IN ('provided','calculated','missing_in_source','blocked')),
    validation_state      TEXT NOT NULL DEFAULT 'professional_review_required'
                         CHECK (validation_state IN ('source_imported','professional_review_required','validated','blocked')),
    metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, bom_version_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_bom_lines_version
    ON bom_lines(tenant_id, project_id, bom_version_id, line_no);
CREATE INDEX IF NOT EXISTS idx_bom_lines_component
    ON bom_lines(tenant_id, category_code, component_name);

CREATE TABLE IF NOT EXISTS bom_line_sources (
    bom_line_source_id    UUID PRIMARY KEY,
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_line_id           UUID NOT NULL REFERENCES bom_lines(bom_line_id) ON DELETE CASCADE,
    source_path           TEXT NOT NULL,
    source_sheet          TEXT NOT NULL,
    source_row            INTEGER NOT NULL CHECK (source_row > 0),
    source_column_start   TEXT NOT NULL,
    source_column_end     TEXT NOT NULL,
    source_note           TEXT NOT NULL DEFAULT '',
    source_state          TEXT NOT NULL DEFAULT 'source_imported'
                         CHECK (source_state IN ('source_imported','professional_review_required','approved','blocked')),
    metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, bom_line_id, source_path, source_sheet, source_row)
);

CREATE INDEX IF NOT EXISTS idx_bom_line_sources_line
    ON bom_line_sources(tenant_id, project_id, bom_line_id);

CREATE TABLE IF NOT EXISTS bom_downstream_links (
    downstream_link_id    UUID PRIMARY KEY,
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bom_version_id        UUID NOT NULL REFERENCES bom_versions(bom_version_id) ON DELETE CASCADE,
    bom_line_id           UUID NOT NULL REFERENCES bom_lines(bom_line_id) ON DELETE CASCADE,
    module_id             TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT,
    target_type           TEXT NOT NULL,
    target_key            TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'blocked_until_bom_review'
                         CHECK (status IN ('blocked_until_bom_review','draft','reviewing','approved','rejected')),
    metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, bom_line_id, module_id, target_type)
);

CREATE INDEX IF NOT EXISTS idx_bom_downstream_links_module
    ON bom_downstream_links(tenant_id, project_id, module_id, status);

ALTER TABLE module_database_operation_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE heavy_steel_project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE heavy_steel_package_work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE heavy_steel_module_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_line_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_downstream_links ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    table_name TEXT;
    policy_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'module_database_operation_bindings',
        'heavy_steel_project_contracts',
        'heavy_steel_package_work_items',
        'heavy_steel_module_work_orders',
        'bom_documents',
        'bom_versions',
        'bom_lines',
        'bom_line_sources',
        'bom_downstream_links'
    ]
    LOOP
        policy_name := table_name || '_tenant_isolation';
        IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = current_schema()
              AND tablename = table_name
              AND policyname = policy_name
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I USING (tenant_id = current_tenant()) WITH CHECK (tenant_id = current_tenant())',
                policy_name,
                table_name
            );
        END IF;
    END LOOP;
END $$;

ALTER TABLE module_database_operation_bindings FORCE ROW LEVEL SECURITY;
ALTER TABLE heavy_steel_project_contracts FORCE ROW LEVEL SECURITY;
ALTER TABLE heavy_steel_package_work_items FORCE ROW LEVEL SECURITY;
ALTER TABLE heavy_steel_module_work_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE bom_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE bom_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE bom_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE bom_line_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE bom_downstream_links FORCE ROW LEVEL SECURITY;

INSERT INTO module_database_operation_bindings (
    tenant_id,
    project_id,
    module_id,
    operation_surface,
    relational_route,
    object_route,
    graph_route,
    event_route,
    analytics_route,
    audit_route,
    write_policy,
    binding_state,
    metadata
)
SELECT
    '11111111-1111-4111-8111-111111111111'::uuid,
    '5abffe50-2670-42e2-97ea-ec6ac71d8183'::uuid,
    id,
    'module_operation_write',
    'postgres://public.' || id || '_business_tables',
    'object_store_bindings/module_files',
    'data_graph_edges',
    'data_event_outbox',
    'data_analytics_events',
    'audit_events',
    CASE
        WHEN id IN ('settings_center', 'finance_management', 'human_resources') THEN 'approval_required'
        ELSE 'approval_required'
    END,
    'active',
    jsonb_build_object(
        'routeOwner', 'ArchIToken StorageRouter/DataPlane',
        'heavySteelBridge', id IN (
            'marketing_service',
            'planning_management',
            'concept_design',
            'standard_library',
            'detailed_design',
            'quantity_costing',
            'material_logistics',
            'production_manufacturing',
            'construction_management',
            'digital_twin',
            'digital_archive',
            'finance_management',
            'human_resources',
            'ai_center',
            'settings_center'
        ),
        'professionalGate', 'Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver'
    )
FROM modules
WHERE enabled = TRUE
ON CONFLICT (tenant_id, project_id, module_id, operation_surface) DO UPDATE SET
    relational_route = EXCLUDED.relational_route,
    object_route = EXCLUDED.object_route,
    graph_route = EXCLUDED.graph_route,
    event_route = EXCLUDED.event_route,
    analytics_route = EXCLUDED.analytics_route,
    audit_route = EXCLUDED.audit_route,
    write_policy = EXCLUDED.write_policy,
    binding_state = EXCLUDED.binding_state,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

INSERT INTO heavy_steel_project_contracts (
    contract_id,
    tenant_id,
    project_id,
    program_id,
    contract_name,
    room_count,
    structure_system,
    data_truth_state,
    professional_state,
    metadata
) VALUES (
    architoken_seed_uuid('heavy-steel-contract:100-room-hotel'),
    '11111111-1111-4111-8111-111111111111',
    '5abffe50-2670-42e2-97ea-ec6ac71d8183',
    'heavy_steel_hotel_100_rooms_q235b_bolted',
    '100间精品酒店重钢突破数据库闭环',
    100,
    'Q235B 全栓接重钢装配式',
    'source_imported',
    'professional_review_required',
    jsonb_build_object(
        'drawingCatalog', '/home/insome/下载/重钢装配式酒店深化图纸目录.docx',
        'bomWorkbook', '/home/insome/下载/应舍美居_构件物料清单.xlsx',
        'sourceBoundary', 'database_truth_not_professional_approval'
    )
)
ON CONFLICT (tenant_id, project_id, program_id) DO UPDATE SET
    contract_name = EXCLUDED.contract_name,
    room_count = EXCLUDED.room_count,
    structure_system = EXCLUDED.structure_system,
    data_truth_state = EXCLUDED.data_truth_state,
    professional_state = EXCLUDED.professional_state,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

INSERT INTO heavy_steel_package_work_items (
    work_item_id,
    tenant_id,
    project_id,
    program_id,
    package_mark,
    package_name,
    drawing_count,
    section_count,
    source_document_id,
    source_state,
    metadata
)
SELECT
    architoken_seed_uuid('heavy-steel-package:' || p.program_id || ':' || p.package_mark),
    '11111111-1111-4111-8111-111111111111'::uuid,
    '5abffe50-2670-42e2-97ea-ec6ac71d8183'::uuid,
    p.program_id,
    p.package_mark,
    p.package_name,
    p.drawing_count,
    COALESCE(array_length(p.section_keys, 1), 0),
    hp.source_document_id,
    'source_mapped',
    jsonb_build_object(
        'sourceTable', 'heavy_steel_drawing_packages',
        'moduleIds', p.module_ids,
        'sectionKeys', p.section_keys
    )
FROM heavy_steel_drawing_packages p
JOIN heavy_steel_programs hp ON hp.program_id = p.program_id
WHERE p.program_id = 'heavy_steel_hotel_100_rooms_q235b_bolted'
ON CONFLICT (tenant_id, project_id, program_id, package_mark) DO UPDATE SET
    package_name = EXCLUDED.package_name,
    drawing_count = EXCLUDED.drawing_count,
    section_count = EXCLUDED.section_count,
    source_document_id = EXCLUDED.source_document_id,
    source_state = EXCLUDED.source_state,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

INSERT INTO heavy_steel_module_work_orders (
    work_order_id,
    tenant_id,
    project_id,
    program_id,
    package_work_item_id,
    module_id,
    work_order_type,
    status,
    source_state,
    metadata
)
SELECT
    architoken_seed_uuid('heavy-steel-module-work:' || wi.program_id || ':' || wi.package_mark || ':' || module_id),
    wi.tenant_id,
    wi.project_id,
    wi.program_id,
    wi.work_item_id,
    module_id,
    'package_module_scope',
    'professional_review_required',
    'source_mapped',
    jsonb_build_object(
        'packageMark', wi.package_mark,
        'packageName', wi.package_name,
        'drawingCount', wi.drawing_count,
        'sectionCount', wi.section_count
    )
FROM heavy_steel_package_work_items wi
JOIN heavy_steel_drawing_packages p
  ON p.program_id = wi.program_id
 AND p.package_mark = wi.package_mark
CROSS JOIN LATERAL unnest(p.module_ids) AS module_id
WHERE wi.tenant_id = '11111111-1111-4111-8111-111111111111'
  AND wi.project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
ON CONFLICT (tenant_id, project_id, program_id, package_work_item_id, module_id) DO UPDATE SET
    work_order_type = EXCLUDED.work_order_type,
    status = EXCLUDED.status,
    source_state = EXCLUDED.source_state,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

INSERT INTO bom_documents (
    bom_document_id,
    tenant_id,
    project_id,
    module_id,
    source_path,
    source_kind,
    source_title,
    workbook_sheet,
    workbook_dimension,
    data_rows,
    import_state,
    metadata
) VALUES (
    architoken_seed_uuid('bom-document:/home/insome/下载/应舍美居_构件物料清单.xlsx:物料清单'),
    '11111111-1111-4111-8111-111111111111',
    '5abffe50-2670-42e2-97ea-ec6ac71d8183',
    'detailed_design',
    '/home/insome/下载/应舍美居_构件物料清单.xlsx',
    'xlsx',
    '应舍美居构件物料清单',
    '物料清单',
    'A1:Q26',
    14,
    'source_imported',
    jsonb_build_object(
        'hiddenCategorySheet', '类目参照',
        'categorySheetDimension', 'A1:E136',
        'sourceWorkbookVerifiedOn', '2026-06-09',
        'professionalState', 'professional_review_required'
    )
)
ON CONFLICT (tenant_id, project_id, source_path, workbook_sheet) DO UPDATE SET
    source_kind = EXCLUDED.source_kind,
    source_title = EXCLUDED.source_title,
    workbook_dimension = EXCLUDED.workbook_dimension,
    data_rows = EXCLUDED.data_rows,
    import_state = EXCLUDED.import_state,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

INSERT INTO bom_versions (
    bom_version_id,
    tenant_id,
    project_id,
    bom_document_id,
    version_code,
    version_name,
    status,
    line_count,
    total_quantity,
    total_weight_kg,
    professional_state,
    metadata
)
SELECT
    architoken_seed_uuid('bom-version:' || bom_document_id::text || ':source-v1'),
    tenant_id,
    project_id,
    bom_document_id,
    'source-v1',
    '应舍美居构件物料清单 source-v1',
    'professional_review_required',
    14,
    470,
    0,
    'professional_review_required',
    jsonb_build_object(
        'sourceTotalRow', 21,
        'sourceTotalQuantity', 470,
        'sourceTotalWeightKg', 0,
        'weightState', 'missing_in_source'
    )
FROM bom_documents
WHERE tenant_id = '11111111-1111-4111-8111-111111111111'
  AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
  AND source_path = '/home/insome/下载/应舍美居_构件物料清单.xlsx'
  AND workbook_sheet = '物料清单'
ON CONFLICT (tenant_id, project_id, bom_document_id, version_code) DO UPDATE SET
    version_name = EXCLUDED.version_name,
    status = EXCLUDED.status,
    line_count = EXCLUDED.line_count,
    total_quantity = EXCLUDED.total_quantity,
    total_weight_kg = EXCLUDED.total_weight_kg,
    professional_state = EXCLUDED.professional_state,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

WITH version_scope AS (
    SELECT bom_version_id, tenant_id, project_id
    FROM bom_versions
    WHERE tenant_id = '11111111-1111-4111-8111-111111111111'
      AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
      AND version_code = 'source-v1'
), source_rows AS (
    SELECT *
    FROM (VALUES
        (1, 6, '铜管', '30-03.70.20', 'Column_Main_H150X150X7X10_L5694_F1立柱_V0', '150X150X7X10', 5475::numeric, 'F1立柱', 'Q355D', 'H150X150X7X10_L5694', '10118058', '1', 'PCS', 4::numeric, 4::numeric, NULL::numeric, NULL::numeric),
        (2, 7, '焊接H型钢柱', '30-03.95.03.15', 'Column_Main_H200X200X8X12_L4200_F1_V0', '200X200X8X12', 4200::numeric, 'F1', 'Q355D', 'H200X200X8X12_L4200', '10118059', '1', 'PCS', 6::numeric, 6::numeric, NULL::numeric, NULL::numeric),
        (3, 8, '焊接H型钢柱', '30-03.95.03.15', 'Column_Main_H250X250X9X14_L4200_F2_V0', '250X250X9X14', 4200::numeric, 'F2', 'Q355D', 'H250X250X9X14_L4200', '10118060', '2', 'PCS', 8::numeric, 8::numeric, NULL::numeric, NULL::numeric),
        (4, 9, '目字形钢柱', '30-03.95.03.40', 'Beam_Main_H194X150X6.5X9_L6200_F1_V0', '194X150X6.5X9', 6200::numeric, 'F1', 'Q355D', 'H194X150X6.5X9_L6200', '20118061', '1', 'PCS', 12::numeric, 12::numeric, NULL::numeric, NULL::numeric),
        (5, 10, '焊接H型钢梁', '30-03.95.09.15', 'Beam_Sub_H150X100X5X7_L4500_F1_V0', '150X100X5X7', 4500::numeric, 'F1', 'Q355D', 'H150X100X5X7_L4500', '20118062', '1', 'PCS', 10::numeric, 10::numeric, NULL::numeric, NULL::numeric),
        (6, 11, '目字形钢柱', '30-03.95.03.40', 'Beam_Main_H300X150X6.5X9_L7500_F2_V0', '300X150X6.5X9', 7500::numeric, 'F2', 'Q355D', 'H300X150X6.5X9_L7500', '20118063', '1', 'PCS', 6::numeric, 6::numeric, NULL::numeric, NULL::numeric),
        (7, 12, 'C型钢檩条', '30-03.95.33.20.15', 'Purlin_Roof_C180X70X20X2.5_L6000_V0', 'C180X70X20X2.5', 6000::numeric, 'Roof', 'Q235B', 'C180x70x20x2.5_L6000', '30118064', '1', 'PCS', 30::numeric, 30::numeric, NULL::numeric, NULL::numeric),
        (8, 13, 'C型钢檩条', '30-03.95.33.20.15', 'Purlin_Wall_C180X70X20X2.5_L5500_V0', 'C180X70X20X2.5', 5500::numeric, 'Wall', 'Q235B', 'C180x70x20x2.5_L5500', '30118065', '1', 'PCS', 25::numeric, 25::numeric, NULL::numeric, NULL::numeric),
        (9, 14, '钢拉条', '30-03.95.33.30', 'Connect_TieRod_D12_L1200_F1_V0', 'D12', 1200::numeric, 'F1', 'Q235B', 'D12_L1200', '40118066', '1', 'SET', 48::numeric, 48::numeric, NULL::numeric, NULL::numeric),
        (10, 15, '钢拉条', '30-03.95.33.30', 'Connect_KneeBrace_L50X50X5_L600_F1_V0', 'L50X50X5', 600::numeric, 'F1', 'Q235B', 'L50x50x5_L600', '50118067', '1', 'SET', 32::numeric, 32::numeric, NULL::numeric, NULL::numeric),
        (11, 16, '箱型钢柱', '30-03.95.03.10', 'Column_Main_S200X200X8X12_H3600_F1_V0', 'S200X200X8X12', 3600::numeric, 'F1', 'Q355D', 'S200x200x8x12_H3600', '10118068', '1', 'PCS', 5::numeric, 5::numeric, NULL::numeric, NULL::numeric),
        (12, 17, '螺栓', '30-03.95.42.20.10', 'Fastener_HighStr_M20_L80_V0', 'M20', 80::numeric, '全楼', '10.9S', 'M20_L80', '60118069', '1', 'SET', 200::numeric, 200::numeric, NULL::numeric, NULL::numeric),
        (13, 18, '钢结构锚栓', '30-03.95.42.20.20', 'Fastener_Anchor_M24_L400_V0', 'M24', 400::numeric, 'F0', 'Q355D', 'M24_L400', '60118070', '1', 'SET', 64::numeric, 64::numeric, NULL::numeric, NULL::numeric),
        (14, 19, '镀锌钢板', '30-03.40.10.20', 'Plate_Galv_T6_L3000XW1500_F1_V0', 'T6', 3000::numeric, 'F1', '', 'T6_3000x1500', '70118071', '1', 'PCS', 20::numeric, 20::numeric, NULL::numeric, NULL::numeric)
    ) AS rows(line_no, source_row, category_name, category_code, component_name, section_size, length_mm, position_ref, material_grade, specification, drawing_no, floor_level, unit, set_quantity, total_quantity, unit_weight_kg, total_weight_kg)
), inserted AS (
    INSERT INTO bom_lines (
        bom_line_id,
        tenant_id,
        project_id,
        bom_version_id,
        line_no,
        category_name,
        category_code,
        component_name,
        section_size,
        length_mm,
        position_ref,
        material_grade,
        specification,
        drawing_no,
        floor_level,
        unit,
        set_quantity,
        total_quantity,
        unit_weight_kg,
        total_weight_kg,
        weight_state,
        validation_state,
        metadata
    )
    SELECT
        architoken_seed_uuid('bom-line:' || vs.bom_version_id::text || ':' || sr.line_no),
        vs.tenant_id,
        vs.project_id,
        vs.bom_version_id,
        sr.line_no,
        sr.category_name,
        sr.category_code,
        sr.component_name,
        sr.section_size,
        sr.length_mm,
        sr.position_ref,
        sr.material_grade,
        sr.specification,
        sr.drawing_no,
        sr.floor_level,
        sr.unit,
        sr.set_quantity,
        sr.total_quantity,
        sr.unit_weight_kg,
        sr.total_weight_kg,
        CASE WHEN sr.unit_weight_kg IS NULL OR sr.total_weight_kg IS NULL THEN 'missing_in_source' ELSE 'provided' END,
        'professional_review_required',
        jsonb_build_object(
            'sourceExcelRow', sr.source_row,
            'categoryReviewRequired', sr.category_name = '铜管' AND sr.component_name LIKE 'Column_%',
            'namingRuleSource', '/home/insome/下载/装配式钢结构建筑构件标准化命名规则V1.0.xlsx',
            'sjg157Source', '/home/insome/下载/建筑工程信息模型语义字典编码表_SJG157-2024.xlsx'
        )
    FROM version_scope vs
    CROSS JOIN source_rows sr
    ON CONFLICT (tenant_id, project_id, bom_version_id, line_no) DO UPDATE SET
        category_name = EXCLUDED.category_name,
        category_code = EXCLUDED.category_code,
        component_name = EXCLUDED.component_name,
        section_size = EXCLUDED.section_size,
        length_mm = EXCLUDED.length_mm,
        position_ref = EXCLUDED.position_ref,
        material_grade = EXCLUDED.material_grade,
        specification = EXCLUDED.specification,
        drawing_no = EXCLUDED.drawing_no,
        floor_level = EXCLUDED.floor_level,
        unit = EXCLUDED.unit,
        set_quantity = EXCLUDED.set_quantity,
        total_quantity = EXCLUDED.total_quantity,
        unit_weight_kg = EXCLUDED.unit_weight_kg,
        total_weight_kg = EXCLUDED.total_weight_kg,
        weight_state = EXCLUDED.weight_state,
        validation_state = EXCLUDED.validation_state,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING bom_line_id, tenant_id, project_id, bom_version_id, line_no
)
INSERT INTO bom_line_sources (
    bom_line_source_id,
    tenant_id,
    project_id,
    bom_line_id,
    source_path,
    source_sheet,
    source_row,
    source_column_start,
    source_column_end,
    source_note,
    source_state,
    metadata
)
SELECT
    architoken_seed_uuid('bom-line-source:' || i.bom_line_id::text),
    i.tenant_id,
    i.project_id,
    i.bom_line_id,
    '/home/insome/下载/应舍美居_构件物料清单.xlsx',
    '物料清单',
    sr.source_row,
    'A',
    'Q',
    '从真实 Excel 工作表物料清单导入；重量列为空时保持 missing_in_source，不自动伪造。',
    'source_imported',
    jsonb_build_object('excelLineNo', sr.line_no)
FROM inserted i
JOIN source_rows sr ON sr.line_no = i.line_no
ON CONFLICT (tenant_id, project_id, bom_line_id, source_path, source_sheet, source_row) DO UPDATE SET
    source_column_start = EXCLUDED.source_column_start,
    source_column_end = EXCLUDED.source_column_end,
    source_note = EXCLUDED.source_note,
    source_state = EXCLUDED.source_state,
    metadata = EXCLUDED.metadata;

INSERT INTO bom_downstream_links (
    downstream_link_id,
    tenant_id,
    project_id,
    bom_version_id,
    bom_line_id,
    module_id,
    target_type,
    target_key,
    status,
    metadata
)
SELECT
    architoken_seed_uuid('bom-downstream:' || bl.bom_line_id::text || ':' || module_id),
    bl.tenant_id,
    bl.project_id,
    bl.bom_version_id,
    bl.bom_line_id,
    module_id,
    CASE module_id
        WHEN 'quantity_costing' THEN 'boq_draft_line'
        WHEN 'material_logistics' THEN 'purchase_requirement'
        WHEN 'production_manufacturing' THEN 'manufacturing_work_order'
        WHEN 'construction_management' THEN 'site_installation_item'
        WHEN 'digital_twin' THEN 'twin_component_trace'
        WHEN 'digital_archive' THEN 'archive_evidence_item'
        ELSE 'module_trace'
    END,
    'bom:' || bl.line_no || ':' || module_id,
    'blocked_until_bom_review',
    jsonb_build_object(
        'componentName', bl.component_name,
        'totalQuantity', bl.total_quantity,
        'professionalGate', 'BOM line must be reviewed before downstream write becomes executable'
    )
FROM bom_lines bl
CROSS JOIN LATERAL unnest(ARRAY[
    'quantity_costing',
    'material_logistics',
    'production_manufacturing',
    'construction_management',
    'digital_twin',
    'digital_archive'
]) AS module_id
WHERE bl.tenant_id = '11111111-1111-4111-8111-111111111111'
  AND bl.project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
ON CONFLICT (tenant_id, project_id, bom_line_id, module_id, target_type) DO UPDATE SET
    target_key = EXCLUDED.target_key,
    status = EXCLUDED.status,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

INSERT INTO data_graph_edges (
    id,
    tenant_id,
    project_id,
    module_id,
    from_entity_type,
    from_entity_id,
    to_entity_type,
    to_entity_id,
    relationship_type,
    properties,
    source
)
SELECT
    architoken_seed_uuid('graph:program-to-bom-document:' || bd.bom_document_id::text),
    bd.tenant_id,
    bd.project_id,
    'detailed_design',
    'heavy_steel_program',
    'heavy_steel_hotel_100_rooms_q235b_bolted',
    'bom_document',
    bd.bom_document_id::text,
    'has_source_bom',
    jsonb_build_object('sourcePath', bd.source_path),
    'component_bom_database_bridge'
FROM bom_documents bd
WHERE bd.tenant_id = '11111111-1111-4111-8111-111111111111'
  AND bd.project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
ON CONFLICT (
    tenant_id, project_id, module_id, from_entity_type, from_entity_id,
    to_entity_type, to_entity_id, relationship_type
) DO UPDATE SET
    properties = EXCLUDED.properties,
    source = EXCLUDED.source,
    updated_at = NOW();

INSERT INTO data_graph_edges (
    id,
    tenant_id,
    project_id,
    module_id,
    from_entity_type,
    from_entity_id,
    to_entity_type,
    to_entity_id,
    relationship_type,
    properties,
    source
)
SELECT
    architoken_seed_uuid('graph:bom-version-to-line:' || bl.bom_line_id::text),
    bl.tenant_id,
    bl.project_id,
    'detailed_design',
    'bom_version',
    bl.bom_version_id::text,
    'bom_line',
    bl.bom_line_id::text,
    'contains_line',
    jsonb_build_object('lineNo', bl.line_no, 'componentName', bl.component_name),
    'component_bom_database_bridge'
FROM bom_lines bl
WHERE bl.tenant_id = '11111111-1111-4111-8111-111111111111'
  AND bl.project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
ON CONFLICT (
    tenant_id, project_id, module_id, from_entity_type, from_entity_id,
    to_entity_type, to_entity_id, relationship_type
) DO UPDATE SET
    properties = EXCLUDED.properties,
    source = EXCLUDED.source,
    updated_at = NOW();

INSERT INTO data_graph_edges (
    id,
    tenant_id,
    project_id,
    module_id,
    from_entity_type,
    from_entity_id,
    to_entity_type,
    to_entity_id,
    relationship_type,
    properties,
    source
)
SELECT
    architoken_seed_uuid('graph:bom-line-to-downstream:' || dl.downstream_link_id::text),
    dl.tenant_id,
    dl.project_id,
    dl.module_id,
    'bom_line',
    dl.bom_line_id::text,
    dl.target_type,
    dl.downstream_link_id::text,
    'drives_downstream_operation',
    jsonb_build_object('targetKey', dl.target_key, 'status', dl.status),
    'component_bom_database_bridge'
FROM bom_downstream_links dl
WHERE dl.tenant_id = '11111111-1111-4111-8111-111111111111'
  AND dl.project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
ON CONFLICT (
    tenant_id, project_id, module_id, from_entity_type, from_entity_id,
    to_entity_type, to_entity_id, relationship_type
) DO UPDATE SET
    properties = EXCLUDED.properties,
    source = EXCLUDED.source,
    updated_at = NOW();

INSERT INTO data_graph_edges (
    id,
    tenant_id,
    project_id,
    module_id,
    from_entity_type,
    from_entity_id,
    to_entity_type,
    to_entity_id,
    relationship_type,
    properties,
    source
)
SELECT
    architoken_seed_uuid('graph:package-to-module-work:' || wo.work_order_id::text),
    wo.tenant_id,
    wo.project_id,
    wo.module_id,
    'heavy_steel_package_work_item',
    wo.package_work_item_id::text,
    'heavy_steel_module_work_order',
    wo.work_order_id::text,
    'requires_module_work',
    jsonb_build_object('status', wo.status, 'workOrderType', wo.work_order_type),
    'component_bom_database_bridge'
FROM heavy_steel_module_work_orders wo
WHERE wo.tenant_id = '11111111-1111-4111-8111-111111111111'
  AND wo.project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
ON CONFLICT (
    tenant_id, project_id, module_id, from_entity_type, from_entity_id,
    to_entity_type, to_entity_id, relationship_type
) DO UPDATE SET
    properties = EXCLUDED.properties,
    source = EXCLUDED.source,
    updated_at = NOW();

INSERT INTO data_event_outbox (
    id,
    tenant_id,
    project_id,
    module_id,
    event_type,
    target_type,
    target_id,
    payload,
    status
)
SELECT
    architoken_seed_uuid('event:bom-document-imported:' || bd.bom_document_id::text),
    bd.tenant_id,
    bd.project_id,
    bd.module_id,
    'component_bom.document_imported',
    'bom_document',
    bd.bom_document_id::text,
    jsonb_build_object('sourcePath', bd.source_path, 'lineCount', bd.data_rows),
    'pending'
FROM bom_documents bd
WHERE bd.tenant_id = '11111111-1111-4111-8111-111111111111'
  AND bd.project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
ON CONFLICT (id) DO UPDATE SET
    payload = EXCLUDED.payload,
    status = EXCLUDED.status,
    occurred_at = NOW();

INSERT INTO data_event_outbox (
    id,
    tenant_id,
    project_id,
    module_id,
    event_type,
    target_type,
    target_id,
    payload,
    status
)
SELECT
    architoken_seed_uuid('event:bom-line-imported:' || bl.bom_line_id::text),
    bl.tenant_id,
    bl.project_id,
    'detailed_design',
    'component_bom.line_imported',
    'bom_line',
    bl.bom_line_id::text,
    jsonb_build_object('lineNo', bl.line_no, 'componentName', bl.component_name, 'totalQuantity', bl.total_quantity),
    'pending'
FROM bom_lines bl
WHERE bl.tenant_id = '11111111-1111-4111-8111-111111111111'
  AND bl.project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'
ON CONFLICT (id) DO UPDATE SET
    payload = EXCLUDED.payload,
    status = EXCLUDED.status,
    occurred_at = NOW();

INSERT INTO data_analytics_events (
    id,
    tenant_id,
    project_id,
    module_id,
    metric_name,
    metric_value,
    dimensions
) VALUES
    (
        architoken_seed_uuid('metric:component-bom-line-count:heavy-steel'),
        '11111111-1111-4111-8111-111111111111',
        '5abffe50-2670-42e2-97ea-ec6ac71d8183',
        'detailed_design',
        'component_bom.imported_lines',
        14,
        '{"source":"应舍美居_构件物料清单.xlsx","professionalState":"professional_review_required"}'::jsonb
    ),
    (
        architoken_seed_uuid('metric:component-bom-total-quantity:heavy-steel'),
        '11111111-1111-4111-8111-111111111111',
        '5abffe50-2670-42e2-97ea-ec6ac71d8183',
        'detailed_design',
        'component_bom.total_quantity',
        470,
        '{"source":"应舍美居_构件物料清单.xlsx","professionalState":"professional_review_required"}'::jsonb
    ),
    (
        architoken_seed_uuid('metric:heavy-steel-module-work-orders'),
        '11111111-1111-4111-8111-111111111111',
        '5abffe50-2670-42e2-97ea-ec6ac71d8183',
        'planning_management',
        'heavy_steel.module_work_orders',
        (SELECT COUNT(*)::double precision FROM heavy_steel_module_work_orders WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183'),
        '{"source":"heavy_steel_drawing_packages","programId":"heavy_steel_hotel_100_rooms_q235b_bolted"}'::jsonb
    )
ON CONFLICT (id) DO UPDATE SET
    metric_value = EXCLUDED.metric_value,
    dimensions = EXCLUDED.dimensions,
    occurred_at = NOW(),
    ingested_at = NOW();

INSERT INTO module_transactions (
    id,
    tenant_id,
    project_id,
    transaction_id,
    module_id,
    transaction_type,
    status,
    actor,
    related_file_ids,
    related_artifact_ids,
    created_at,
    updated_at,
    created_by
)
SELECT
    architoken_seed_uuid('module-transaction:component-bom-bridge:' || module_id),
    '11111111-1111-4111-8111-111111111111',
    '5abffe50-2670-42e2-97ea-ec6ac71d8183',
    architoken_seed_uuid('module-transaction-id:component-bom-bridge:' || module_id),
    module_id,
    'database_bridge_binding',
    'professional_review_required',
    'codex',
    jsonb_build_array('/home/insome/下载/应舍美居_构件物料清单.xlsx', '/home/insome/下载/重钢装配式酒店深化图纸目录.docx'),
    jsonb_build_array('bom_versions:source-v1', 'data_graph_edges'),
    NOW(),
    NOW(),
    'codex'
FROM (SELECT DISTINCT module_id FROM bom_downstream_links) m
ON CONFLICT (transaction_id) DO UPDATE SET
    status = EXCLUDED.status,
    related_file_ids = EXCLUDED.related_file_ids,
    related_artifact_ids = EXCLUDED.related_artifact_ids,
    updated_at = NOW();

INSERT INTO audit_events (
    id,
    tenant_id,
    project_id,
    module_id,
    actor,
    action,
    target_type,
    target_id,
    summary,
    metadata,
    created_at
) VALUES (
    architoken_seed_uuid('audit:component-bom-database-bridge:20260609'),
    '11111111-1111-4111-8111-111111111111',
    '5abffe50-2670-42e2-97ea-ec6ac71d8183',
    'settings_center',
    'codex',
    'database_bridge_migration_applied',
    'component_bom_database_bridge',
    '20260609000001_component_bom_database_bridge',
    '导入真实应舍美居构件物料清单 14 行，接通重钢图纸目录、BOM、下游模块、Graph、Event、Analytics 和 Audit。',
    jsonb_build_object(
        'migration', '20260609000001_component_bom_database_bridge.sql',
        'sourceBomWorkbook', '/home/insome/下载/应舍美居_构件物料清单.xlsx',
        'sourceDrawingCatalog', '/home/insome/下载/重钢装配式酒店深化图纸目录.docx',
        'lineCount', 14,
        'totalQuantity', 470
    ),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    summary = EXCLUDED.summary,
    metadata = EXCLUDED.metadata,
    created_at = NOW();

CREATE OR REPLACE VIEW heavy_steel_database_bridge_status AS
SELECT
    '11111111-1111-4111-8111-111111111111'::uuid AS tenant_id,
    '5abffe50-2670-42e2-97ea-ec6ac71d8183'::uuid AS project_id,
    'heavy_steel_hotel_100_rooms_q235b_bolted'::text AS program_id,
    (SELECT total_drawings FROM heavy_steel_programs WHERE program_id = 'heavy_steel_hotel_100_rooms_q235b_bolted') AS source_drawing_count,
    (SELECT COUNT(*) FROM heavy_steel_drawing_packages WHERE program_id = 'heavy_steel_hotel_100_rooms_q235b_bolted') AS source_package_count,
    (SELECT COUNT(*) FROM heavy_steel_drawing_sections WHERE program_id = 'heavy_steel_hotel_100_rooms_q235b_bolted') AS source_section_count,
    (SELECT COUNT(*) FROM module_database_operation_bindings WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS bound_module_count,
    (SELECT COUNT(*) FROM heavy_steel_package_work_items WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS package_work_item_count,
    (SELECT COUNT(*) FROM heavy_steel_module_work_orders WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS module_work_order_count,
    (SELECT COUNT(*) FROM bom_documents WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS bom_document_count,
    (SELECT COUNT(*) FROM bom_versions WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS bom_version_count,
    (SELECT COUNT(*) FROM bom_lines WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS bom_line_count,
    (SELECT COALESCE(SUM(total_quantity), 0) FROM bom_lines WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS bom_total_quantity,
    (SELECT COUNT(*) FROM bom_line_sources WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS bom_line_source_count,
    (SELECT COUNT(*) FROM bom_downstream_links WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183') AS downstream_link_count,
    (SELECT COUNT(*) FROM data_graph_edges WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183' AND source = 'component_bom_database_bridge') AS graph_edge_count,
    (SELECT COUNT(*) FROM data_event_outbox WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183' AND event_type LIKE 'component_bom.%') AS event_count,
    (SELECT COUNT(*) FROM data_analytics_events WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183' AND metric_name LIKE 'component_bom.%') AS analytics_count,
    (SELECT COUNT(*) FROM audit_events WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND project_id = '5abffe50-2670-42e2-97ea-ec6ac71d8183' AND target_type = 'component_bom_database_bridge') AS audit_count;

COMMENT ON TABLE bom_documents IS 'Component BOM source workbook records. Source files remain evidence; professional approval is separate.';
COMMENT ON TABLE bom_versions IS 'Versioned component BOM document header with review state and source totals.';
COMMENT ON TABLE bom_lines IS 'Imported component material BOM lines traced to Excel source rows.';
COMMENT ON TABLE bom_line_sources IS 'Cell-range evidence for each BOM line source row.';
COMMENT ON TABLE bom_downstream_links IS 'BOM-driven downstream operation links for costing, logistics, manufacturing, construction, twin and archive.';
COMMENT ON TABLE module_database_operation_bindings IS 'Per-module database route contract across relational/object/graph/event/analytics/audit stores.';
COMMENT ON VIEW heavy_steel_database_bridge_status IS 'One-row verification view for the heavy-steel database bridge.';
