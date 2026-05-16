# 02-quality · DATA-MODEL

本子域 5 张表 · 完整 DDL · RLS · 索引 · 示例 INSERT。
命名规范见模块顶层 [`../../DATA-MODEL.md`](../../DATA-MODEL.md) §1。

---

## 1. 表清单

| # | 表 | 业务 | 行预估 |
|---|---|---|---:|
| 1 | `csr.quality_plans` | 项目级质量计划 | ~3/project |
| 2 | `csr.material_receipts` | 材料进场验收 | ~500/project |
| 3 | `csr.quality_defects` | 缺陷登记 | ~200/project |
| 4 | `csr.rectification_orders` | A5 整改通知单 | ~150/project |
| 5 | `csr.non_conformance_reports` | NCR · ISO 9001:2015 §8.7 | ~30/project |

---

## 2. DDL

### 2.1 `csr.quality_plans`

```sql
CREATE TABLE IF NOT EXISTS csr.quality_plans (
    id              UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id       UUID        NOT NULL,
    project_id      UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    version_no      INTEGER     NOT NULL DEFAULT 1,
    title           TEXT        NOT NULL,
    applicable_standards JSONB  NOT NULL DEFAULT '[]'::jsonb,   -- ["GB 50300-2013",...]

    key_processes   JSONB       NOT NULL DEFAULT '[]'::jsonb,   -- 关键工序清单
    testing_plan    JSONB       NOT NULL DEFAULT '{}'::jsonb,    -- 抽检计划

    approved_by     UUID,
    approved_at     TIMESTAMPTZ,
    status          TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','submitted','approved','archived')),

    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.quality_plans IS '项目级质量计划 QP · 对标 ISO 9001:2015 §8.1';

CREATE UNIQUE INDEX idx_qp_project_version ON csr.quality_plans(tenant_id, project_id, version_no);
CREATE INDEX idx_qp_project_active ON csr.quality_plans(project_id) WHERE status = 'approved';

ALTER TABLE csr.quality_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.quality_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY qp_tenant ON csr.quality_plans
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.2 `csr.material_receipts`

```sql
CREATE TABLE IF NOT EXISTS csr.material_receipts (
    id               UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id        UUID        NOT NULL,
    project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    material_code    TEXT        NOT NULL,             -- 族库引用 · sl.material_catalog.code
    material_name    TEXT        NOT NULL,
    batch_no         TEXT        NOT NULL,             -- 厂家批次号
    supplier_name    TEXT        NOT NULL,

    received_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    quantity         NUMERIC(18,4) NOT NULL,
    unit             TEXT        NOT NULL,             -- kg / m / m2 / m3 / t / pcs

    cert_no          TEXT,                             -- 合格证编号
    cert_uri         TEXT,                             -- 合格证 PDF 链接
    mill_cert_uri    TEXT,                             -- 钢材质保书 / 出厂质量证明

    witness_required  BOOLEAN    NOT NULL DEFAULT FALSE,
    witness_test_id   UUID,                            -- 引用 csr.test_witnessings

    verdict           TEXT       NOT NULL DEFAULT 'pending'
                      CHECK (verdict IN ('pending','pass','fail','concession','returned')),
    verdict_by        UUID,
    verdict_at        TIMESTAMPTZ,
    remarks           TEXT,

    photo_evidence_ids UUID[]    NOT NULL DEFAULT '{}',

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT mr_qty_positive CHECK (quantity > 0)
);

COMMENT ON TABLE csr.material_receipts IS '材料进场验收 · 见证取样入口 · 合格后方可进入工序';

CREATE INDEX idx_mr_project_received ON csr.material_receipts(project_id, received_at DESC);
CREATE INDEX idx_mr_batch ON csr.material_receipts(tenant_id, material_code, batch_no);
CREATE INDEX idx_mr_verdict_pending ON csr.material_receipts(project_id, verdict) WHERE verdict = 'pending';

ALTER TABLE csr.material_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.material_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY mr_tenant ON csr.material_receipts
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.3 `csr.quality_defects`

```sql
CREATE TABLE IF NOT EXISTS csr.quality_defects (
    id                  UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id           UUID        NOT NULL,
    project_id          UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    inspection_lot_id   UUID        REFERENCES csr.inspection_lots(id) ON DELETE SET NULL,
    activity_id         UUID        REFERENCES csr.activities(id) ON DELETE SET NULL,

    discovered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    discovered_by       UUID,

    category            TEXT        NOT NULL
                        CHECK (category IN (
                            'material',        -- 材料问题
                            'workmanship',     -- 工艺 / 手艺
                            'dimension',       -- 尺寸偏差
                            'alignment',       -- 位置 / 轴线 / 标高
                            'weld',            -- 焊接
                            'concrete',        -- 混凝土(蜂窝 / 麻面 / 露筋)
                            'finish',          -- 饰面
                            'mep',             -- 机电
                            'other'
                        )),
    severity            TEXT        NOT NULL
                        CHECK (severity IN ('minor','major','critical')),

    location_desc       TEXT,                             -- "二层 A 轴 × 3 轴 钢柱"
    bim_element_guids   TEXT[],
    description         TEXT        NOT NULL,
    root_cause_hint     TEXT,                              -- LLM 分类器填

    standards_violated  JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- [{"standard":"GB 50205-2020","clause":"§7.2.4"}]

    status              TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','rectifying','verifying','closed','dismissed')),

    photo_evidence_ids  UUID[]      NOT NULL DEFAULT '{}',
    closed_at           TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.quality_defects IS '缺陷登记 · 上接 inspection_lot · 下接 rectification_order';

CREATE INDEX idx_qd_project_open
    ON csr.quality_defects(project_id, severity, status) WHERE status != 'closed';
CREATE INDEX idx_qd_inspection_lot ON csr.quality_defects(inspection_lot_id);
CREATE INDEX idx_qd_bim_guids ON csr.quality_defects USING GIN (bim_element_guids);

ALTER TABLE csr.quality_defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.quality_defects FORCE ROW LEVEL SECURITY;
CREATE POLICY qd_tenant ON csr.quality_defects
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.4 `csr.rectification_orders`

```sql
CREATE TABLE IF NOT EXISTS csr.rectification_orders (
    id              UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id       UUID        NOT NULL,
    project_id      UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    defect_id       UUID        REFERENCES csr.quality_defects(id) ON DELETE SET NULL,
    hazard_id       UUID        REFERENCES csr.safety_hazards(id) ON DELETE SET NULL,

    form_code       TEXT        NOT NULL DEFAULT 'A5',    -- GB/T 50319-2013 附表代号
    serial_no       TEXT        NOT NULL,                 -- "JP-RO-2026-0017"

    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    issued_by       UUID        NOT NULL,
    issued_to_unit  TEXT        NOT NULL,                 -- 施工单位

    deadline        TIMESTAMPTZ NOT NULL,
    required_action TEXT        NOT NULL,

    response_body   TEXT,
    responded_at    TIMESTAMPTZ,

    status          TEXT        NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','acknowledged','rectifying','closed','overdue','escalated')),

    closed_photos   UUID[]      NOT NULL DEFAULT '{}',    -- 整改后 photo_evidence 强制 ≥1

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ro_origin_exactly_one CHECK ((defect_id IS NULL) <> (hazard_id IS NULL)),
    CONSTRAINT ro_closed_needs_photo CHECK (status != 'closed' OR array_length(closed_photos, 1) >= 1)
);

COMMENT ON TABLE csr.rectification_orders IS 'A5 整改通知单 · GB/T 50319-2013 表 A.0.5 · 既可挂缺陷也可挂隐患';

CREATE UNIQUE INDEX idx_ro_serial ON csr.rectification_orders(tenant_id, serial_no);
CREATE INDEX idx_ro_project_open ON csr.rectification_orders(project_id, status) WHERE status NOT IN ('closed');
CREATE INDEX idx_ro_deadline_overdue ON csr.rectification_orders(deadline) WHERE status IN ('open','acknowledged','rectifying');

ALTER TABLE csr.rectification_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.rectification_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY ro_tenant ON csr.rectification_orders
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.5 `csr.non_conformance_reports`

```sql
CREATE TABLE IF NOT EXISTS csr.non_conformance_reports (
    id               UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id        UUID        NOT NULL,
    project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    defect_id        UUID        NOT NULL REFERENCES csr.quality_defects(id) ON DELETE CASCADE,

    ncr_no           TEXT        NOT NULL,                 -- "JP-NCR-2026-0007"
    raised_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    disposition      TEXT        NOT NULL
                     CHECK (disposition IN ('rework','repair','concession','scrap')),
                     -- ISO 9001:2015 §8.7 四选一

    designer_approval_required BOOLEAN NOT NULL DEFAULT FALSE,
    designer_approved_by UUID,
    designer_approved_at TIMESTAMPTZ,

    owner_approved_by    UUID,
    owner_approved_at    TIMESTAMPTZ,

    cost_impact_cny      NUMERIC(18,2) DEFAULT 0,
    schedule_impact_days NUMERIC(8,2)  DEFAULT 0,

    status           TEXT        NOT NULL DEFAULT 'raised'
                     CHECK (status IN ('raised','designer_reviewing','owner_reviewing','approved','rejected','implemented','closed')),

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ncr_concession_needs_designer
        CHECK (disposition != 'concession' OR designer_approved_at IS NOT NULL OR status IN ('raised','designer_reviewing','rejected'))
);

COMMENT ON TABLE csr.non_conformance_reports IS 'NCR · 不合格品报告 · ISO 9001:2015 §8.7 · 让步接收需 designer 签字';

CREATE UNIQUE INDEX idx_ncr_no ON csr.non_conformance_reports(tenant_id, ncr_no);
CREATE INDEX idx_ncr_project_status ON csr.non_conformance_reports(project_id, status);

ALTER TABLE csr.non_conformance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.non_conformance_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY ncr_tenant ON csr.non_conformance_reports
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

---

## 3. 示例 INSERT (锦屏 · 5/19 焊缝 UT 不合格)

```sql
-- 缺陷登记
INSERT INTO csr.quality_defects (
    tenant_id, project_id, inspection_lot_id, activity_id,
    category, severity, location_desc, bim_element_guids,
    description, standards_violated, status
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '...', '...',
    'weld', 'major', '二层 B 轴 × 5 轴 柱-梁节点 焊缝 W-208',
    ARRAY['2A3K9XYZABCDEF12367'],
    'UT 检测发现内部夹渣 · 长度 8mm · 超过 GB 50205-2020 §7.2.4 二级焊缝允许值(L ≤ 5mm)',
    '[{"standard":"GB 50205-2020","clause":"§7.2.4","type":"二级焊缝内部缺陷"}]'::jsonb,
    'open'
);

-- A5 整改通知单
INSERT INTO csr.rectification_orders (
    tenant_id, project_id, defect_id, form_code, serial_no,
    issued_by, issued_to_unit, deadline, required_action, status
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '...',                                    -- defect_id
    'A5', 'JP-RO-2026-0017',
    '...',                                    -- supervisor id
    '贵州某钢构公司',
    now() + INTERVAL '1 day',                 -- major = 1 天
    '清除夹渣并按 GB 50205-2020 §7.2.4 重新焊接 · UT 复检 100%',
    'open'
);
```

---

## 4. 维护脚本

### 4.1 整改闭环触发器(强制影像)

```sql
-- status → closed 且 closed_photos 数组空 · 拒绝
ALTER TABLE csr.rectification_orders
ADD CONSTRAINT ro_closed_needs_photo
CHECK (status != 'closed' OR array_length(closed_photos, 1) >= 1);
```
(已在 DDL 里)

### 4.2 逾期自动升级

```sql
CREATE OR REPLACE FUNCTION csr.fn_ro_auto_overdue() RETURNS void AS $$
BEGIN
    UPDATE csr.rectification_orders
    SET status = 'overdue', updated_at = now()
    WHERE status IN ('open','acknowledged','rectifying')
      AND deadline < now();
END;
$$ LANGUAGE plpgsql;

-- 由 pg_cron 或 pgmq scheduled job 每 30 分钟跑一次
```

---

## 5. 查询样例

```sql
-- 未闭环的整改单(按即将到期排序)
SELECT serial_no, required_action, deadline - now() AS remaining
FROM csr.rectification_orders
WHERE project_id = $1 AND status != 'closed'
ORDER BY deadline;

-- 按分部统计缺陷
SELECT category, severity, count(*)
FROM csr.quality_defects
WHERE project_id = $1 AND created_at >= date_trunc('month', now())
GROUP BY category, severity
ORDER BY category, severity;

-- 让步接收的 NCR 清单
SELECT ncr_no, defect_id, designer_approved_at, owner_approved_at
FROM csr.non_conformance_reports
WHERE project_id = $1 AND disposition = 'concession' AND status = 'implemented';
```

---

version: 0.1.0 · 2026-04-23
