-- Heavy-steel hotel program truth tables.
-- Source-mapped business facts from the Word catalog are stored in PostgreSQL
-- so module UI and database manager views can prove where 198/33/8 come from.

CREATE TABLE IF NOT EXISTS heavy_steel_source_documents (
    source_document_id TEXT PRIMARY KEY,
    source_path        TEXT NOT NULL UNIQUE,
    source_kind        TEXT NOT NULL,
    title              TEXT NOT NULL,
    provenance_state   TEXT NOT NULL DEFAULT 'source_mapped'
                        CHECK (provenance_state IN ('source_mapped', 'review_required', 'approved_source', 'rejected')),
    extracted_to       TEXT[] NOT NULL DEFAULT '{}'::text[],
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS heavy_steel_programs (
    program_id          TEXT PRIMARY KEY,
    source_document_id  TEXT NOT NULL REFERENCES heavy_steel_source_documents(source_document_id) ON DELETE RESTRICT,
    project_title       TEXT NOT NULL,
    structure_system    TEXT NOT NULL,
    precision_rule      TEXT NOT NULL,
    modular_rule        TEXT NOT NULL,
    delivery_window     TEXT NOT NULL,
    total_drawings      INTEGER NOT NULL CHECK (total_drawings > 0),
    package_count       INTEGER NOT NULL CHECK (package_count > 0),
    section_count       INTEGER NOT NULL CHECK (section_count > 0),
    phase_counts        JSONB NOT NULL DEFAULT '{}'::jsonb,
    priority_counts     JSONB NOT NULL DEFAULT '{}'::jsonb,
    hard_rules          JSONB NOT NULL DEFAULT '[]'::jsonb,
    professional_state  TEXT NOT NULL DEFAULT 'review_required'
                        CHECK (professional_state IN ('review_required', 'reviewing', 'approved', 'rejected')),
    catalog_snapshot    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS heavy_steel_drawing_packages (
    program_id      TEXT NOT NULL REFERENCES heavy_steel_programs(program_id) ON DELETE CASCADE,
    package_mark    TEXT NOT NULL,
    package_name    TEXT NOT NULL,
    drawing_count   INTEGER NOT NULL CHECK (drawing_count >= 0),
    description     TEXT NOT NULL,
    module_ids      TEXT[] NOT NULL DEFAULT '{}'::text[],
    section_keys    TEXT[] NOT NULL DEFAULT '{}'::text[],
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (program_id, package_mark)
);

CREATE TABLE IF NOT EXISTS heavy_steel_drawing_sections (
    program_id      TEXT NOT NULL REFERENCES heavy_steel_programs(program_id) ON DELETE CASCADE,
    section_key     TEXT NOT NULL,
    section_name    TEXT NOT NULL,
    package_name    TEXT NOT NULL,
    drawing_count   INTEGER NOT NULL CHECK (drawing_count >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (program_id, section_key)
);

CREATE TABLE IF NOT EXISTS heavy_steel_module_bindings (
    program_id      TEXT NOT NULL REFERENCES heavy_steel_programs(program_id) ON DELETE CASCADE,
    module_id       TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT,
    package_count   INTEGER NOT NULL CHECK (package_count >= 0),
    drawing_count   INTEGER NOT NULL CHECK (drawing_count >= 0),
    binding_state   TEXT NOT NULL DEFAULT 'source_mapped'
                    CHECK (binding_state IN ('source_mapped', 'review_required', 'approved', 'blocked')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (program_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_heavy_steel_packages_modules
    ON heavy_steel_drawing_packages USING gin (module_ids);
CREATE INDEX IF NOT EXISTS idx_heavy_steel_sections_package
    ON heavy_steel_drawing_sections(program_id, package_name);

INSERT INTO heavy_steel_source_documents (
    source_document_id,
    source_path,
    source_kind,
    title,
    provenance_state,
    extracted_to,
    metadata
) VALUES (
    'heavy_steel_hotel_drawing_catalog_docx',
    '/home/insome/下载/重钢装配式酒店深化图纸目录.docx',
    'word_document',
    '重钢装配式酒店深化图纸目录',
    'source_mapped',
    ARRAY[
        '03-frontend/lib/hotel-heavy-steel-program.ts',
        '02-architecture/HEAVY_STEEL_HOTEL_ZAOFANG_MODULE_PROGRAM.md',
        '04-backend/migrations/20260608000001_heavy_steel_program_truth.sql'
    ],
    '{"note":"External Word source path observed on local workstation. Professional approval remains required before construction/manufacturing claims."}'::jsonb
) ON CONFLICT (source_document_id) DO UPDATE SET
    source_path = EXCLUDED.source_path,
    source_kind = EXCLUDED.source_kind,
    title = EXCLUDED.title,
    provenance_state = EXCLUDED.provenance_state,
    extracted_to = EXCLUDED.extracted_to,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

INSERT INTO heavy_steel_programs (
    program_id,
    source_document_id,
    project_title,
    structure_system,
    precision_rule,
    modular_rule,
    delivery_window,
    total_drawings,
    package_count,
    section_count,
    phase_counts,
    priority_counts,
    hard_rules,
    professional_state,
    catalog_snapshot
) VALUES (
    'heavy_steel_hotel_100_rooms_q235b_bolted',
    'heavy_steel_hotel_drawing_catalog_docx',
    '100间精品酒店 · Q235B 全栓接重钢装配式',
    'Q235B全栓接重钢 · 无现场焊接',
    '0~-2mm 加工精度 · 孔洞均为圆孔',
    '跨度≤12m · 层高3.6m · ≤5层/18m · 模数600mm',
    '65~75天（P1先行 D1~15 / P2同步 D15~60 / P3收口 D40~75）',
    198,
    8,
    33,
    '{"P1·先行":55,"P2·同步":105,"P3·收口":38}'::jsonb,
    '{"高":111,"中":68,"低":19}'::jsonb,
    '[
        "工厂钢构件下单前，重钢装配式钢结构专项深化必须 100% 完成。",
        "螺栓孔位、耳板尺寸、预留孔洞一经确认不得变更。",
        "所有穿梁圆孔须与 SS-04-05 一一对应，穿梁孔定位确认前钢构加工图不得下单。",
        "全流程输出为专业复核草稿，结构、消防、节能、施工安全和验收结论必须由责任专业人员复核签署。"
    ]'::jsonb,
    'review_required',
    '{"sourceFile":"/home/insome/下载/重钢装配式酒店深化图纸目录.docx","frontendStruct":"03-frontend/lib/hotel-heavy-steel-program.ts","architectureDoc":"02-architecture/HEAVY_STEEL_HOTEL_ZAOFANG_MODULE_PROGRAM.md","totalDrawings":198,"packageCount":8,"sectionCount":33}'::jsonb
) ON CONFLICT (program_id) DO UPDATE SET
    source_document_id = EXCLUDED.source_document_id,
    project_title = EXCLUDED.project_title,
    structure_system = EXCLUDED.structure_system,
    precision_rule = EXCLUDED.precision_rule,
    modular_rule = EXCLUDED.modular_rule,
    delivery_window = EXCLUDED.delivery_window,
    total_drawings = EXCLUDED.total_drawings,
    package_count = EXCLUDED.package_count,
    section_count = EXCLUDED.section_count,
    phase_counts = EXCLUDED.phase_counts,
    priority_counts = EXCLUDED.priority_counts,
    hard_rules = EXCLUDED.hard_rules,
    professional_state = EXCLUDED.professional_state,
    catalog_snapshot = EXCLUDED.catalog_snapshot,
    updated_at = NOW();

INSERT INTO heavy_steel_drawing_packages (
    program_id,
    package_mark,
    package_name,
    drawing_count,
    description,
    module_ids,
    section_keys
) VALUES
    ('heavy_steel_hotel_100_rooms_q235b_bolted','①','重钢装配式钢结构专项深化',42,'Q235B 全栓接节点、结构体系、模块拆分、钢构件加工图，是工厂下单前必须 100% 冻结的最高优先级板块。',ARRAY['detailed_design','production_manufacturing','quantity_costing','material_logistics','construction_management','digital_twin','digital_archive'],ARRAY['1-A','1-B','1-C','1-D']),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','②','建筑土建深化（全面重构）',25,'取消砌体承重和外墙抹灰逻辑，改为钢骨架围护、装配式地坪、预制钢梯和工厂天沟体系。',ARRAY['detailed_design','standard_library','construction_management','digital_archive'],ARRAY['2-A','2-B','2-C']),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','③','室内精装深化（钢构适配版）',33,'精装服从钢构模数，前置预埋、吊顶避梁、声桥切断、干挂卡扣和公差协调。',ARRAY['detailed_design','production_manufacturing','construction_management','digital_archive'],ARRAY['3-A','3-B','3-C','3-D','3-E','3-F']),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','④','机电综合深化（系统性改图）',30,'机电管线先避让钢梁，穿梁圆孔与钢构加工图一一对应，先 BIM 碰撞后下单。',ARRAY['detailed_design','standard_library','construction_management','digital_twin','digital_archive'],ARRAY['4-A','4-B','4-C','4-D','4-E','4-F']),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','⑤','软装·厨房·景观·智能化专项',16,'重型软装、商业厨房、景观连廊和智能化设备必须前置钢基座、支架和预埋点。',ARRAY['detailed_design','production_manufacturing','material_logistics','construction_management','digital_archive'],ARRAY['5-A','5-B','5-C','5-D']),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','⑥','装配式围护结构专项深化',20,'ALC、外墙一体板、门窗装配、气密水密节点和热桥断桥按钢构模数协同。',ARRAY['detailed_design','standard_library','production_manufacturing','construction_management','digital_archive'],ARRAY['6-A','6-B','6-C','6-D']),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','⑦','消防专项深化',14,'钢构防火包覆、喷淋排烟与钢梁避让、防火分区围护配合和消防控制设备深化。',ARRAY['detailed_design','standard_library','construction_management','digital_archive'],ARRAY['7-A','7-B','7-C']),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','⑧','现场装配施工工艺深化',18,'吊装顺序、调平校准、螺栓紧固、拼缝防渗、干湿分区和质量安全验收工艺。',ARRAY['construction_management','material_logistics','digital_twin','digital_archive'],ARRAY['8-A','8-B','8-C'])
ON CONFLICT (program_id, package_mark) DO UPDATE SET
    package_name = EXCLUDED.package_name,
    drawing_count = EXCLUDED.drawing_count,
    description = EXCLUDED.description,
    module_ids = EXCLUDED.module_ids,
    section_keys = EXCLUDED.section_keys,
    updated_at = NOW();

INSERT INTO heavy_steel_drawing_sections (
    program_id,
    section_key,
    section_name,
    package_name,
    drawing_count
) VALUES
    ('heavy_steel_hotel_100_rooms_q235b_bolted','1-A','结构体系与截面定型','重钢装配式钢结构专项深化',12),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','1-B','全栓接节点深化','重钢装配式钢结构专项深化',11),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','1-C','模块化单元拆分深化','重钢装配式钢结构专项深化',8),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','1-D','钢构件加工深化（工厂直接使用）','重钢装配式钢结构专项深化',11),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','2-A','建筑平面与空间（钢构版）','建筑土建深化（全面重构）',7),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','2-B','地坪/楼地面构造（从钢楼承板起）','建筑土建深化（全面重构）',6),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','2-C','外墙/屋面/楼梯/细部','建筑土建深化（全面重构）',12),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','3-A','精装模数与平面控制（6份）','室内精装深化（钢构适配版）',6),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','3-B','吊顶系统与钢梁避让（6份）','室内精装深化（钢构适配版）',6),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','3-C','固装柜体与预埋件（5份）','室内精装深化（钢构适配版）',5),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','3-D','卫浴/防水/地面系统（6份）','室内精装深化（钢构适配版）',6),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','3-E','墙面系统与声学（6份）','室内精装深化（钢构适配版）',6),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','3-F','公区精装（4份）','室内精装深化（钢构适配版）',4),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','4-A','管线综合（6份）','机电综合深化（系统性改图）',6),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','4-B','穿梁预留（4份）','机电综合深化（系统性改图）',4),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','4-C','给排水（5份）','机电综合深化（系统性改图）',5),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','4-D','暖通空调（5份）','机电综合深化（系统性改图）',5),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','4-E','强电（4份）','机电综合深化（系统性改图）',4),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','4-F','弱电/智能化（6份）','机电综合深化（系统性改图）',6),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','5-A','软装预埋（3份）','软装·厨房·景观·智能化专项',3),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','5-B','厨房/后勤（4份）','软装·厨房·景观·智能化专项',4),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','5-C','景观/室外（4份）','软装·厨房·景观·智能化专项',4),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','5-D','智能化专项（5份）','软装·厨房·景观·智能化专项',5),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','6-A','外墙围护（8份）','装配式围护结构专项深化',8),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','6-B','内隔墙（5份）','装配式围护结构专项深化',5),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','6-C','屋面（4份）','装配式围护结构专项深化',4),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','6-D','热工气密性（3份）','装配式围护结构专项深化',3),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','7-A','钢构防火（4份）','消防专项深化',4),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','7-B','消防水报警（5份）','消防专项深化',5),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','7-C','防火分区排烟（5份）','消防专项深化',5),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','8-A','钢构安装工艺（6份）','现场装配施工工艺深化',6),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','8-B','围护精装施工工艺（6份）','现场装配施工工艺深化',6),
    ('heavy_steel_hotel_100_rooms_q235b_bolted','8-C','物料质量安全（6份）','现场装配施工工艺深化',6)
ON CONFLICT (program_id, section_key) DO UPDATE SET
    section_name = EXCLUDED.section_name,
    package_name = EXCLUDED.package_name,
    drawing_count = EXCLUDED.drawing_count,
    updated_at = NOW();

INSERT INTO heavy_steel_module_bindings (
    program_id,
    module_id,
    package_count,
    drawing_count,
    binding_state
)
SELECT
    'heavy_steel_hotel_100_rooms_q235b_bolted',
    module_id,
    COUNT(*)::integer AS package_count,
    SUM(drawing_count)::integer AS drawing_count,
    'source_mapped'
FROM heavy_steel_drawing_packages
CROSS JOIN LATERAL unnest(module_ids) AS module_id
WHERE program_id = 'heavy_steel_hotel_100_rooms_q235b_bolted'
GROUP BY module_id
ON CONFLICT (program_id, module_id) DO UPDATE SET
    package_count = EXCLUDED.package_count,
    drawing_count = EXCLUDED.drawing_count,
    binding_state = EXCLUDED.binding_state,
    updated_at = NOW();
