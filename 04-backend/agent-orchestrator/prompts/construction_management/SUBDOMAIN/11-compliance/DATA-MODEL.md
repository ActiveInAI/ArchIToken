# 11-compliance · DATA-MODEL

4 张表 · 完整 DDL。

---

## 1. DDL

### 1.1 `csr.mandatory_clauses`

实际位置:**`sl.code_clauses`**(由 standard_library 模块持有 · 本 CSR 镜像 / 缓存)。
但为便于本模块独立说明 · 本节展示完整 schema(实际部署时归 sl schema)。

```sql
CREATE TABLE IF NOT EXISTS sl.code_clauses (
    id                  UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id           UUID,                                   -- 可空 · 全局标准
    standard_code       TEXT        NOT NULL,                  -- "GB 50300-2013"
    standard_name       TEXT        NOT NULL,
    clause_no           TEXT        NOT NULL,                  -- "§5.0.4"
    clause_text         TEXT        NOT NULL,
    is_mandatory        BOOLEAN     NOT NULL DEFAULT FALSE,    -- 强制性条文?
    sub_part_applicable TEXT[],                                -- 适用分部
    keywords            TEXT[],                                -- 便搜索

    effective_from      DATE        NOT NULL,
    effective_to        DATE,                                  -- 废止日
    supersedes          UUID,                                  -- 指向旧版 clause

    source_uri          TEXT,
    vector_embedding    vector(768),                           -- pgvector · 语义搜索

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sl.code_clauses IS '规范条款库 · is_mandatory=TRUE 即强条 · 跨模块共享';

CREATE UNIQUE INDEX idx_cc_standard_clause ON sl.code_clauses(standard_code, clause_no, effective_from);
CREATE INDEX idx_cc_mandatory ON sl.code_clauses(is_mandatory) WHERE is_mandatory AND effective_to IS NULL;
CREATE INDEX idx_cc_keywords ON sl.code_clauses USING GIN (keywords);
CREATE INDEX idx_cc_vector ON sl.code_clauses USING ivfflat (vector_embedding vector_cosine_ops);
```

### 1.2 `csr.compliance_checks`

```sql
CREATE TABLE IF NOT EXISTS csr.compliance_checks (
    id                  UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id           UUID        NOT NULL,
    project_id          UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    check_no            TEXT        NOT NULL,                 -- "JP-CC-2026-0055"
    target_type         TEXT        NOT NULL
                        CHECK (target_type IN (
                            'inspection_lot','sub_item','sub_part','unit_project',
                            'method_statement','engineering_change','design_review','handover'
                        )),
    target_id           UUID        NOT NULL,

    scope_desc          TEXT,
    triggered_by        TEXT        NOT NULL
                        CHECK (triggered_by IN ('manual','auto_on_event','scheduled','regulation_change')),

    clauses_checked     JSONB       NOT NULL DEFAULT '[]'::jsonb,
                        -- [{"standard":"GB 50300-2013","clause":"§5.0.4","is_mandatory":true,"verdict":"compliant"}]
    mandatory_violated  INTEGER     NOT NULL DEFAULT 0,
    mandatory_total     INTEGER     NOT NULL DEFAULT 0,
    general_flagged     INTEGER     NOT NULL DEFAULT 0,

    verdict             TEXT        NOT NULL
                        CHECK (verdict IN ('compliant','non_compliant','partial','n/a')),

    performed_by        UUID,
    performed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    bim_element_guids   TEXT[],

    followup_actions    JSONB       NOT NULL DEFAULT '[]'::jsonb,
                        -- 后续动作 · 例 生成 02-quality A5

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT cc_non_compliant_reason CHECK (
        verdict != 'non_compliant' OR mandatory_violated > 0
    )
);

COMMENT ON TABLE csr.compliance_checks IS '合规检查记录 · 违反强条自动 non_compliant';

CREATE UNIQUE INDEX idx_cc2_no ON csr.compliance_checks(tenant_id, check_no);
CREATE INDEX idx_cc2_target ON csr.compliance_checks(target_type, target_id);
CREATE INDEX idx_cc2_project_verdict ON csr.compliance_checks(project_id, verdict);
CREATE INDEX idx_cc2_non_compliant ON csr.compliance_checks(project_id) WHERE verdict = 'non_compliant';

ALTER TABLE csr.compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.compliance_checks FORCE ROW LEVEL SECURITY;
CREATE POLICY cc2_tenant ON csr.compliance_checks
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.3 `csr.permit_approvals`

```sql
CREATE TABLE IF NOT EXISTS csr.permit_approvals (
    id                  UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id           UUID        NOT NULL,
    project_id          UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    permit_type         TEXT        NOT NULL
                        CHECK (permit_type IN (
                            'construction_permit','quality_registration','safety_filing',
                            'fire_design_review','fire_acceptance','civil_defense',
                            'lightning_protection','environmental','energy'
                        )),
    permit_no           TEXT,                                  -- 行政部门发出的编号
    issuing_authority   TEXT        NOT NULL,

    applied_at          DATE,
    approved_at         DATE,
    valid_from          DATE,
    valid_to            DATE,                                  -- 有效期

    status              TEXT        NOT NULL DEFAULT 'applied'
                        CHECK (status IN ('applied','under_review','approved','rejected','expired','voided')),
    rejection_reason    TEXT,
    certificate_uri     TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.permit_approvals IS '行政审批进度 · 施工许可 · 质监 · 安监 · 消防等';

CREATE UNIQUE INDEX idx_pa_type_project
    ON csr.permit_approvals(tenant_id, project_id, permit_type, approved_at)
    WHERE approved_at IS NOT NULL;
CREATE INDEX idx_pa_project ON csr.permit_approvals(project_id, status);
CREATE INDEX idx_pa_expiring ON csr.permit_approvals(valid_to) WHERE status = 'approved' AND valid_to IS NOT NULL;

ALTER TABLE csr.permit_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.permit_approvals FORCE ROW LEVEL SECURITY;
CREATE POLICY pa_tenant ON csr.permit_approvals
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.4 `csr.archive_packages`

```sql
CREATE TABLE IF NOT EXISTS csr.archive_packages (
    id                  UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id           UUID        NOT NULL,
    project_id          UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    package_no          TEXT        NOT NULL,                 -- "JP-ARCH-2026-0001"
    package_type        TEXT        NOT NULL
                        CHECK (package_type IN ('monthly','stage','completion','post_occupancy')),
    period_start        DATE,
    period_end          DATE,

    table_of_contents   JSONB       NOT NULL DEFAULT '[]'::jsonb,
                        -- [{"section":"监理日志","items_count":45,"total_pages":180}]
    items_json          JSONB       NOT NULL DEFAULT '[]'::jsonb,
                        -- [{"item_type":"supervision_log","ref_id":"...","archived_uri":"..."}]

    -- GB/T 50328-2019 要求的类别
    has_monitoring_logs BOOLEAN     NOT NULL DEFAULT FALSE,
    has_acceptance      BOOLEAN     NOT NULL DEFAULT FALSE,
    has_test_reports    BOOLEAN     NOT NULL DEFAULT FALSE,
    has_method_stmts    BOOLEAN     NOT NULL DEFAULT FALSE,
    has_change_orders   BOOLEAN     NOT NULL DEFAULT FALSE,
    has_permits         BOOLEAN     NOT NULL DEFAULT FALSE,
    has_photos          BOOLEAN     NOT NULL DEFAULT FALSE,
    has_bim             BOOLEAN     NOT NULL DEFAULT FALSE,

    package_uri         TEXT,                                  -- zip / tar.gz 归档包
    package_sha256      CHAR(64),
    package_size_mb     NUMERIC(10,2),

    digital_archive_ref UUID,                                  -- digital_archive 模块引用 id
    local_archive_filed_at TIMESTAMPTZ,                         -- 本地城建档案馆归档

    status              TEXT        NOT NULL DEFAULT 'assembling'
                        CHECK (status IN ('assembling','ready','archived','rejected')),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- GB/T 50328-2019 竣工归档必须 8 类全有
    CONSTRAINT ap_completion_completeness CHECK (
        package_type != 'completion' OR status != 'ready' OR
        (has_monitoring_logs AND has_acceptance AND has_test_reports AND has_method_stmts
         AND has_change_orders AND has_permits AND has_photos)
    )
);

COMMENT ON TABLE csr.archive_packages IS '归档包 · GB/T 50328-2019 · 竣工必含 7 类齐';

CREATE UNIQUE INDEX idx_ap_no ON csr.archive_packages(tenant_id, package_no);
CREATE INDEX idx_ap_project_type ON csr.archive_packages(project_id, package_type);

ALTER TABLE csr.archive_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.archive_packages FORCE ROW LEVEL SECURITY;
CREATE POLICY ap_tenant ON csr.archive_packages
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

---

## 2. 示例 INSERT

```sql
-- 强条示例(来自 GB 50300-2013 §5.0.4)
INSERT INTO sl.code_clauses (
    standard_code, standard_name, clause_no, clause_text, is_mandatory,
    sub_part_applicable, keywords, effective_from, source_uri
) VALUES (
    'GB 50300-2013','建筑工程施工质量验收统一标准','§5.0.4',
    '检验批质量验收合格应符合下列规定:主控项目的质量经抽样检验均应合格;...',
    TRUE,
    ARRAY['地基基础','主体结构','建筑装饰装修','屋面','机电','节能']::text[],
    ARRAY['主控项目','检验批','合格'],
    DATE '2014-06-01',
    'https://www.mohurd.gov.cn/...'
);

-- 合规检查记录
INSERT INTO csr.compliance_checks (
    tenant_id, project_id, check_no, target_type, target_id, scope_desc,
    triggered_by, clauses_checked, mandatory_total, mandatory_violated,
    general_flagged, verdict, performed_at
) VALUES (
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
    'JP-CC-2026-0055', 'inspection_lot', '<lot id>',
    '二层 B 轴 焊接批验收合规扫描','auto_on_event',
    '[
       {"standard":"GB 50205-2020","clause":"§7.2.4","is_mandatory":true,"verdict":"violated",
        "detail":"W-208 UT 不合格 · 已 A5 整改"},
       {"standard":"GB 50300-2013","clause":"§5.0.4","is_mandatory":true,"verdict":"compliant"}
     ]'::jsonb,
    2, 1, 0, 'non_compliant', TIMESTAMPTZ '2026-05-19 10:30:00+08'
);

-- 施工许可
INSERT INTO csr.permit_approvals (
    tenant_id, project_id, permit_type, permit_no, issuing_authority,
    applied_at, approved_at, valid_from, valid_to, status, certificate_uri
) VALUES (
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
    'construction_permit','锦建字(2026)第 0012 号','锦屏县住建局',
    DATE '2026-04-20', DATE '2026-04-28',
    DATE '2026-04-28', DATE '2026-12-31',
    'approved','s3://architoken/projects/jp/permits/construction.pdf'
);
```

---

## 3. 维护脚本

### 3.1 许可即将过期提醒

```sql
CREATE OR REPLACE FUNCTION csr.fn_permit_expire_scan() RETURNS void AS $$
BEGIN
    FOR r IN SELECT id, permit_type, valid_to FROM csr.permit_approvals
             WHERE status='approved' AND valid_to IS NOT NULL
               AND valid_to <= CURRENT_DATE + 30 AND valid_to > CURRENT_DATE
    LOOP
        PERFORM pg_notify('csr_permit_expiring', json_build_object('id', r.id, 'type', r.permit_type, 'valid_to', r.valid_to)::text);
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. 查询

```sql
-- 当前项目 · 所有未通过合规检查
SELECT check_no, target_type, target_id, verdict, mandatory_violated
FROM csr.compliance_checks
WHERE project_id = $1 AND verdict = 'non_compliant'
ORDER BY performed_at DESC;

-- 项目所有许可证状态
SELECT permit_type, permit_no, status, valid_from, valid_to
FROM csr.permit_approvals
WHERE project_id = $1
ORDER BY permit_type;

-- 归档包完整性
SELECT package_no, package_type, status,
       has_monitoring_logs, has_acceptance, has_test_reports,
       has_method_stmts, has_change_orders, has_permits, has_photos, has_bim
FROM csr.archive_packages
WHERE project_id = $1;
```

---

version: 0.1.0 · 2026-04-23
