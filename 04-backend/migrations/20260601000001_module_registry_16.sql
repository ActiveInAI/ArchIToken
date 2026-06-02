-- ArchIToken module registry alignment · 16 active modules
-- Keeps `finance_hr` only as a disabled historical alias.

CREATE TABLE IF NOT EXISTS modules (
    id              TEXT PRIMARY KEY,
    zh_name         TEXT NOT NULL,
    en_name         TEXT NOT NULL,
    order_num       INTEGER NOT NULL UNIQUE,
    description     TEXT NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS current_module_id TEXT;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_current_module_id_fkey;

UPDATE projects
SET current_module_id = 'finance_management'
WHERE current_module_id = 'finance_hr';

UPDATE modules
SET enabled = FALSE,
    order_num = order_num + 1000,
    updated_at = NOW()
WHERE order_num BETWEEN 1 AND 16
  AND id NOT IN (
    'personal_center',
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
  );

UPDATE modules
SET order_num = CASE id
    WHEN 'personal_center' THEN -1
    WHEN 'marketing_service' THEN -2
    WHEN 'planning_management' THEN -3
    WHEN 'concept_design' THEN -4
    WHEN 'standard_library' THEN -5
    WHEN 'detailed_design' THEN -6
    WHEN 'quantity_costing' THEN -7
    WHEN 'material_logistics' THEN -8
    WHEN 'production_manufacturing' THEN -9
    WHEN 'construction_management' THEN -10
    WHEN 'digital_twin' THEN -11
    WHEN 'digital_archive' THEN -12
    WHEN 'finance_management' THEN -13
    WHEN 'human_resources' THEN -14
    WHEN 'ai_center' THEN -15
    WHEN 'settings_center' THEN -16
    WHEN 'finance_hr' THEN -1200
    ELSE order_num
END
WHERE id IN (
    'personal_center',
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
    'settings_center',
    'finance_hr'
);

INSERT INTO modules (id, zh_name, en_name, order_num, description) VALUES
    ('personal_center', '个人中心', 'Personal Center', 1, '个人资料、账号安全、通知、最近工作、个人审批、收藏和偏好入口'),
    ('marketing_service', '市场客服', 'Marketing Service', 2, '客户线索、需求澄清、报价和初版方案入口'),
    ('planning_management', '计划管理', 'Planning Management', 3, 'WBS、里程碑、资源计划、审批计划和总控排程'),
    ('concept_design', '方案设计', 'Concept Design', 4, '多方案生成、初步三维表达、合规约束和造价估算'),
    ('standard_library', '标准族库', 'Standard Library', 5, '规范条文、族库构件、材料、模板和规则包'),
    ('detailed_design', '深化设计', 'Detailed Design', 6, 'IFC、施工图、节点深化、结构连接和碰撞检查'),
    ('quantity_costing', '计量造价', 'Quantity & Costing', 7, '工程量、BOQ、清单、价格库和变更估算'),
    ('material_logistics', '材料物流', 'Material Logistics', 8, '材料库存、采购、包装、装车、物流和签收'),
    ('production_manufacturing', '生产制造', 'Production Manufacturing', 9, '生产计划、工序路线、CNC、焊接、质检、发运和 Paperclip 模块内编排'),
    ('construction_management', '施工管理', 'Construction Management', 10, '施工方案、进度、质量、安全、日志、整改和竣工资料'),
    ('digital_twin', '数字孪生', 'Digital Twin', 11, 'IFC、GLB、点云、IoT、SCADA 和运维告警'),
    ('digital_archive', '数字档案', 'Digital Archive', 12, '工程档案、版本链、签章、留存和检索'),
    ('finance_management', '财务管理', 'Finance Management', 13, '合同、收付款、发票、成本、预算、现金流、佣金和结算归档'),
    ('human_resources', '人力资源', 'Human Resources', 14, '组织岗位、人员班组、资质证书、考勤工时、培训记录、绩效评估和劳动合规'),
    ('ai_center', 'AI中心', 'AI Capability Center', 15, '模型路由、RAG、MCP、Agent、权限和成本审计'),
    ('settings_center', '设置中心', 'Settings Center', 16, '人员、账号、密码、头像、单位、岗位、角色和权限')
ON CONFLICT (id) DO UPDATE
SET zh_name = EXCLUDED.zh_name,
    en_name = EXCLUDED.en_name,
    order_num = EXCLUDED.order_num,
    description = EXCLUDED.description,
    enabled = TRUE,
    updated_at = NOW();

INSERT INTO modules (id, zh_name, en_name, order_num, description, enabled) VALUES
    ('finance_hr', '财务人力', 'Finance & HR', 1200, '历史兼容别名;当前拆分为 finance_management 与 human_resources', FALSE)
ON CONFLICT (id) DO UPDATE
SET zh_name = EXCLUDED.zh_name,
    en_name = EXCLUDED.en_name,
    order_num = EXCLUDED.order_num,
    description = EXCLUDED.description,
    enabled = FALSE,
    updated_at = NOW();

UPDATE projects
SET current_module_id = 'marketing_service'
WHERE current_module_id IS NULL
   OR current_module_id NOT IN (SELECT id FROM modules WHERE enabled = TRUE);

ALTER TABLE projects
    ADD CONSTRAINT projects_current_module_id_fkey
    FOREIGN KEY (current_module_id) REFERENCES modules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_module ON projects(tenant_id, current_module_id);
