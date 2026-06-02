-- ====================================================================
-- construction_management · GLOBAL-TABLES.sql
-- ====================================================================
-- 4 张全局表 · 所有 CSR 12 子域共用 · 一般项目级 + 审计
--   1. public.projects              · 项目主表
--   2. csr.contracts                · 施工合同(主合同 + 分包)
--   3. csr.parties                  · 五方责任主体
--   4. public.audit_log             · 审计日志(所有写操作留痕)
--
-- Schema 约定:
--   public.*  · 所有模块共用的根表
--   csr.*     · 本模块独有表
--
-- version: 0.1.0 · 2026-04-23
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. public.projects · 项目主表(跨 16 模块共用)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.projects (
    id                      UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id               UUID        NOT NULL,

    code                    TEXT        NOT NULL,                 -- 租户内项目编号 "JP001"
    name                    TEXT        NOT NULL,                 -- "锦屏应舍美居"
    short_name              TEXT,                                 -- "锦屏"

    -- 地理
    province                TEXT,                                 -- "贵州"
    city                    TEXT,                                 -- "黔东南苗族侗族自治州"
    county                  TEXT,                                 -- "锦屏县"
    address                 TEXT,
    gps                     GEOGRAPHY(Point, 4326),
    terrain                 TEXT,                                 -- "山区" / "平原" / "滨水"

    -- 规模
    project_type            TEXT        NOT NULL
                            CHECK (project_type IN (
                                'residential_villa','residential_multi_family','commercial_office',
                                'commercial_retail','industrial','infrastructure','renovation',
                                'light_steel_villa','heavy_steel_villa','public','other'
                            )),
    stories                 SMALLINT,
    gross_floor_area_sqm    NUMERIC(12,2),
    land_area_sqm           NUMERIC(12,2),
    structural_system       TEXT,                                 -- "Q355B heavy steel frame"

    -- 合同
    contract_amount_cny     NUMERIC(18,2),
    contract_currency       TEXT        NOT NULL DEFAULT 'CNY',   -- ISO 4217
    commenced_date          DATE,
    contracted_completion_date DATE,
    actual_completion_date  DATE,
    filed_date              DATE,

    -- 当前状态
    current_module_id       TEXT        NOT NULL DEFAULT 'marketing_service'
                            REFERENCES public.modules(id),        -- 16 模块 of which
    lifecycle_module         TEXT        NOT NULL DEFAULT 'planning'
                            CHECK (lifecycle_module IN (
                                'planning','design','procurement','construction',
                                'acceptance','handover','operation','disposal'
                            )),

    -- 描述
    description             TEXT,
    anchor_case             BOOLEAN     NOT NULL DEFAULT FALSE,   -- 是否 ArchIToken 锚点项目

    -- 审计
    created_by              UUID,
    updated_by              UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ,

    CONSTRAINT prj_code_unique UNIQUE (tenant_id, code)
);

COMMENT ON TABLE  public.projects IS '项目主表 · 所有 16 模块的根引用';
COMMENT ON COLUMN public.projects.current_module_id IS '当前所在模块(16 模块架构)· 允许无归属';
COMMENT ON COLUMN public.projects.anchor_case IS '锚点项目 · 锦屏应舍美居是 ArchIToken 首个 anchor_case';

CREATE INDEX idx_prj_tenant_lifecycle
    ON public.projects (tenant_id, lifecycle_module, created_at DESC);
CREATE INDEX idx_prj_anchor
    ON public.projects (tenant_id) WHERE anchor_case = TRUE;
CREATE INDEX idx_prj_gps
    ON public.projects USING GIST (gps);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE  ROW LEVEL SECURITY;
CREATE POLICY prj_tenant_isolation ON public.projects
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

-- 锚点项目 · 锦屏应舍美居(示例 INSERT)
INSERT INTO public.projects (
    id, tenant_id, code, name, short_name,
    province, city, county, terrain,
    project_type, stories, gross_floor_area_sqm, structural_system,
    contract_amount_cny, contract_currency,
    commenced_date, contracted_completion_date,
    current_module_id, lifecycle_module, anchor_case, description
) VALUES (
    '00000000-0000-0000-0000-000000000010'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'JP001', '锦屏应舍美居', '锦屏',
    '贵州省', '黔东南苗族侗族自治州', '锦屏县', '山区',
    'light_steel_villa', 3, 520.00, 'Q355B heavy steel frame 300mm grid',
    680000.00, 'CNY',
    DATE '2026-05-01', DATE '2026-06-14',
    'construction_management', 'construction', TRUE,
    '520㎡ 三层重钢别墅 · 45 日交付 · ArchIToken 深度试点首个项目 · 2026-04-23 立项'
) ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 2. csr.contracts · 施工合同(主 + 分包)
-- ====================================================================

CREATE TABLE IF NOT EXISTS csr.contracts (
    id                  UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id           UUID        NOT NULL,
    project_id          UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    contract_no         TEXT        NOT NULL,                 -- "JP-CON-2026-0001"
    contract_type       TEXT        NOT NULL
                        CHECK (contract_type IN (
                            'main_construction','supervision','design','geotechnical',
                            'subcontract_specialty','subcontract_labor','epc','design_build','other'
                        )),

    parent_contract_id  UUID        REFERENCES csr.contracts(id) ON DELETE SET NULL,

    party_a_id          UUID        NOT NULL,                 -- FK csr.parties
    party_b_id          UUID        NOT NULL,

    -- 合同基本
    signed_date         DATE        NOT NULL,
    amount_cny          NUMERIC(18,2) NOT NULL,
    currency            TEXT        NOT NULL DEFAULT 'CNY',
    payment_terms       JSONB       NOT NULL DEFAULT '{}'::jsonb,
                        -- {"advance":0.3,"milestones":[...], "retention":0.05}

    commenced_date      DATE,
    planned_completion_date DATE,
    actual_completion_date DATE,

    -- 合同条款(法律查阅用)
    clauses_uri         TEXT,                                  -- 合同正文 PDF
    clauses_sha256      CHAR(64),
    template_ref        TEXT,                                  -- "GF-2017-0201" / "FIDIC Red Book 2017"

    liquidated_damages_per_day_cny NUMERIC(18,2),              -- 每日违约金
    warranty_period_years  NUMERIC(4,2) DEFAULT 2.0,           -- 保修期

    -- 状态
    status              TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('draft','signed','active','completed','terminated','disputed')),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT con_no_unique UNIQUE (tenant_id, contract_no)
);

COMMENT ON TABLE csr.contracts IS '合同主表 · 主合同 + 分包 + 监理合同 · 通过 parent_contract_id 构成树';

CREATE INDEX idx_con_project_type ON csr.contracts(project_id, contract_type);
CREATE INDEX idx_con_parent ON csr.contracts(parent_contract_id) WHERE parent_contract_id IS NOT NULL;
CREATE INDEX idx_con_status ON csr.contracts(project_id, status);

ALTER TABLE csr.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.contracts FORCE  ROW LEVEL SECURITY;
CREATE POLICY con_tenant_isolation ON csr.contracts
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

-- ====================================================================
-- 3. csr.parties · 五方责任主体
-- ====================================================================

CREATE TABLE IF NOT EXISTS csr.parties (
    id                  UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id           UUID        NOT NULL,
    project_id          UUID        REFERENCES public.projects(id) ON DELETE CASCADE,  -- 可空 · 通用供方

    role                TEXT        NOT NULL
                        CHECK (role IN (
                            'owner','contractor','supervisor','designer','geotechnical',
                            'material_supplier','equipment_supplier','consultant','subcontractor',
                            'inspector','other'
                        )),
    unit_name           TEXT        NOT NULL,                 -- 单位名称
    unit_short_name     TEXT,
    legal_representative TEXT,
    business_license_no TEXT,

    -- 项目代表
    representative_name TEXT,                                  -- "李项目经理"
    representative_title TEXT,                                  -- "项目经理"
    representative_user_id UUID,                               -- 对接 users 表(settings_center)

    -- 资质
    qualifications_json JSONB       NOT NULL DEFAULT '[]'::jsonb,
                        -- [{"type":"施工总承包一级","cert_no":"...","valid_to":"..."}]

    -- 联系
    phone               TEXT,
    email               TEXT,
    address             TEXT,

    -- 状态
    status              TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','terminated','blacklisted')),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.parties IS '五方责任主体 + 其它参与方 · 以单位 + 代表 为核心';

CREATE UNIQUE INDEX idx_party_project_role
    ON csr.parties(tenant_id, project_id, role, unit_name)
    WHERE project_id IS NOT NULL;
CREATE INDEX idx_party_role ON csr.parties(tenant_id, role, status);

ALTER TABLE csr.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.parties FORCE  ROW LEVEL SECURITY;
CREATE POLICY party_tenant_isolation ON csr.parties
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

-- 锦屏五方 · 示例 INSERT
INSERT INTO csr.parties (
    tenant_id, project_id, role, unit_name, representative_name, representative_title,
    qualifications_json, phone
) VALUES
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
 'owner','张先生(业主)','张先生','业主',
 '[]'::jsonb, '138-xxxxxxx'),

('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
 'contractor','贵州某钢构公司','李工','项目经理',
 '[{"type":"施工总承包三级","cert_no":"建施总字第 xxx 号","valid_to":"2028-12-31"}]'::jsonb,
 '138-xxxxxxx'),

('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
 'supervisor','某地方监理公司','张工','总监理工程师',
 '[{"type":"房屋建筑工程监理乙级","cert_no":"建监字第 xxx 号","valid_to":"2027-06-30"}]'::jsonb,
 '138-xxxxxxx'),

('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
 'designer','某建筑师事务所','王工','主创建筑师',
 '[{"type":"建筑工程乙级","cert_no":"建设计字第 xxx 号","valid_to":"2028-12-31"}]'::jsonb,
 '138-xxxxxxx'),

('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
 'geotechnical','锦屏县勘察院','赵工','勘察负责人',
 '[{"type":"岩土工程勘察乙级","cert_no":"建勘字第 xxx 号","valid_to":"2028-12-31"}]'::jsonb,
 '0855-xxxxxxx')
ON CONFLICT DO NOTHING;

-- ====================================================================
-- 4. public.audit_log · 审计日志
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
    id                  UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id           UUID        NOT NULL,
    project_id          UUID        REFERENCES public.projects(id) ON DELETE SET NULL,

    operation_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    operation_by        UUID,                                   -- user id
    operation_by_unit   TEXT,                                   -- 冗余 · 便于离职后查

    module_id           TEXT        REFERENCES public.modules(id),   -- 16 模块
    subdomain           TEXT,                                         -- "01-progress" 等
    target_table        TEXT        NOT NULL,
    target_id           UUID,
    action              TEXT        NOT NULL
                        CHECK (action IN ('INSERT','UPDATE','DELETE','SIGN','APPROVE','REJECT','TRIGGER')),

    before_json         JSONB,                                  -- UPDATE/DELETE 时
    after_json          JSONB,                                  -- INSERT/UPDATE 时
    diff_json           JSONB,                                  -- 计算值 · 便查

    -- 合规审计关键标记
    is_critical         BOOLEAN     NOT NULL DEFAULT FALSE,     -- 涉及 A5 · NCR · 签证 · 合同等
    legal_relevance     TEXT,                                   -- "contract" · "safety" · "quality" · ...

    ip_address          INET,
    user_agent          TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS '审计日志 · 所有写操作留痕 · 合规 / 举证用 · 永不删除';

CREATE INDEX idx_audit_project_time ON public.audit_log(project_id, operation_at DESC);
CREATE INDEX idx_audit_target ON public.audit_log(target_table, target_id);
CREATE INDEX idx_audit_critical ON public.audit_log(tenant_id, operation_at DESC) WHERE is_critical = TRUE;
CREATE INDEX idx_audit_module ON public.audit_log(module_id, subdomain);

-- 分区 · 按月 · 大量数据(每月 partition)
-- CREATE TABLE public.audit_log_y2026m04 PARTITION OF public.audit_log FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- audit_log 有特殊 RLS · 只允许读 · 写由触发器自动
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE  ROW LEVEL SECURITY;

CREATE POLICY audit_log_read ON public.audit_log
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- INSERT/UPDATE/DELETE 走高权限角色(audit_writer) · 普通租户不可直写
CREATE POLICY audit_log_write ON public.audit_log
    FOR INSERT
    WITH CHECK (
        tenant_id = current_setting('app.current_tenant')::uuid
        AND current_user = 'audit_writer'
    );

-- audit_log 永不 UPDATE / DELETE(合规要求)
-- 不建 UPDATE/DELETE policy · 默认拒绝

-- ====================================================================
-- 5. 通用审计触发器模板
-- ====================================================================

CREATE OR REPLACE FUNCTION public.fn_audit_log_row() RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.audit_log (
        tenant_id, project_id,
        operation_by, operation_by_unit,
        module_id, subdomain, target_table, target_id, action,
        before_json, after_json,
        is_critical, legal_relevance
    ) VALUES (
        COALESCE(NEW.tenant_id, OLD.tenant_id),
        COALESCE(NEW.project_id, OLD.project_id, NULL),
        current_setting('app.current_user', TRUE)::uuid,
        current_setting('app.current_user_unit', TRUE),
        COALESCE(NEW.module_id, OLD.module_id, 'construction_management'),
        TG_ARGV[0],                                    -- subdomain 参数
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END,
        COALESCE(TG_ARGV[1]::boolean, FALSE),           -- is_critical
        TG_ARGV[2]                                      -- legal_relevance
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.fn_audit_log_row IS
    '通用审计触发器 · TG_ARGV[0]=subdomain · [1]=is_critical · [2]=legal_relevance';

-- 使用示例:
-- CREATE TRIGGER trg_audit_rfc
-- AFTER INSERT OR UPDATE OR DELETE ON csr.engineering_changes
-- FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_row('12-change_order','TRUE','contract');

-- ====================================================================
-- 6. 查询样例
-- ====================================================================

-- 项目全貌
-- SELECT * FROM public.projects WHERE id = '<uuid>';

-- 项目的五方
-- SELECT role, unit_name, representative_name FROM csr.parties
-- WHERE project_id = '<uuid>' ORDER BY CASE role
--   WHEN 'owner' THEN 1 WHEN 'contractor' THEN 2 WHEN 'supervisor' THEN 3
--   WHEN 'designer' THEN 4 WHEN 'geotechnical' THEN 5 ELSE 99 END;

-- 某项目的所有合同(树形)
-- WITH RECURSIVE tree AS (
--     SELECT *, 0 AS depth FROM csr.contracts WHERE parent_contract_id IS NULL AND project_id = $1
--     UNION ALL
--     SELECT c.*, t.depth + 1 FROM csr.contracts c JOIN tree t ON c.parent_contract_id = t.id
-- )
-- SELECT contract_no, contract_type, amount_cny, depth FROM tree ORDER BY depth, signed_date;

-- 审计日志 · 最近 7 日关键操作
-- SELECT operation_at, operation_by_unit, target_table, action, legal_relevance
-- FROM public.audit_log
-- WHERE project_id = $1 AND is_critical AND operation_at >= now() - INTERVAL '7 days'
-- ORDER BY operation_at DESC;

COMMIT;

-- version: 0.1.0 · 2026-04-23
