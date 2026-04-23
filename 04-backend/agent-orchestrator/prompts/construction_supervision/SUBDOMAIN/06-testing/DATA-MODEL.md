# 06-testing · DATA-MODEL

3 张表 · 完整 DDL。

---

## 1. 表清单

| # | 表 |
|---|---|
| 1 | `csr.test_witnessings` · 见证取样 |
| 2 | `csr.lab_reports` · 实验室报告 |
| 3 | `csr.onsite_tests` · 现场检测 |

---

## 2. DDL

### 2.1 `csr.test_witnessings`

```sql
CREATE TABLE IF NOT EXISTS csr.test_witnessings (
    id                     UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id              UUID        NOT NULL,
    project_id             UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    inspection_lot_id      UUID        REFERENCES csr.inspection_lots(id) ON DELETE SET NULL,

    witness_no             TEXT        NOT NULL,                 -- "JP-WIT-2026-0021"
    material_or_element    TEXT        NOT NULL,                 -- "混凝土 C30 · 二层梁"
    sampling_method        TEXT        NOT NULL,                 -- "现场坍落度试模"

    sampling_at            TIMESTAMPTZ NOT NULL,
    location_desc          TEXT        NOT NULL,
    bim_element_guids      TEXT[],

    sample_count           INTEGER     NOT NULL CHECK (sample_count > 0),
    sample_ids_json        JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- 封样编号

    -- 双签 · 监理方见证 · 施工方取样
    witness_supervisor_id  UUID        NOT NULL,
    sampler_contractor_id  UUID        NOT NULL,

    sealed_photo_ids       UUID[]      NOT NULL DEFAULT '{}',    -- 封样照片

    send_to_lab_name       TEXT,
    send_to_lab_cma_no     TEXT,
    sent_at                TIMESTAMPTZ,
    lab_report_id          UUID        REFERENCES csr.lab_reports(id) ON DELETE SET NULL,

    remarks                TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.test_witnessings IS '见证取样记录 · 双签 · 封样照片';

CREATE UNIQUE INDEX idx_tw_no ON csr.test_witnessings(tenant_id, witness_no);
CREATE INDEX idx_tw_project ON csr.test_witnessings(project_id, sampling_at DESC);
CREATE INDEX idx_tw_lot ON csr.test_witnessings(inspection_lot_id);

ALTER TABLE csr.test_witnessings ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.test_witnessings FORCE ROW LEVEL SECURITY;
CREATE POLICY tw_tenant ON csr.test_witnessings
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.2 `csr.lab_reports`

```sql
CREATE TABLE IF NOT EXISTS csr.lab_reports (
    id                     UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id              UUID        NOT NULL,
    project_id             UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    report_no              TEXT        NOT NULL,                 -- "JP-UT-2026-0013"
    test_type              TEXT        NOT NULL
                           CHECK (test_type IN (
                               'concrete_compression','rebar_pullout','steel_tensile',
                               'weld_ut','weld_mt','weld_rt','weld_pt',
                               'waterproof','fire_resistance','admixture','mortar',
                               'thermal_performance','other'
                           )),

    lab_name               TEXT        NOT NULL,
    lab_cma_no             TEXT        NOT NULL,
    lab_cma_verified_at    TIMESTAMPTZ,                          -- CMA 资质核验时间

    tested_at              DATE        NOT NULL,
    issued_at              DATE        NOT NULL,

    verdict                TEXT        NOT NULL
                           CHECK (verdict IN ('pass','fail','partial','n/a')),
    verdict_details        JSONB       NOT NULL DEFAULT '{}'::jsonb,

    standards_applied      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    raw_measurements       JSONB       NOT NULL DEFAULT '[]'::jsonb,

    report_uri             TEXT        NOT NULL,
    report_sha256          CHAR(64)    NOT NULL,
    report_ocr_text        TEXT,                                 -- OCR 抽取的正文

    linked_witness_id      UUID        REFERENCES csr.test_witnessings(id) ON DELETE SET NULL,
    linked_defect_ids      UUID[]      NOT NULL DEFAULT '{}',    -- 不合格自动反向关联

    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.lab_reports IS 'CMA 实验室检测报告 · lab_cma_no 必须有效';

CREATE UNIQUE INDEX idx_lr_no ON csr.lab_reports(tenant_id, report_no);
CREATE INDEX idx_lr_project_type ON csr.lab_reports(project_id, test_type, issued_at DESC);
CREATE INDEX idx_lr_verdict_fail ON csr.lab_reports(project_id) WHERE verdict = 'fail';

ALTER TABLE csr.lab_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.lab_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY lr_tenant ON csr.lab_reports
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.3 `csr.onsite_tests`

```sql
CREATE TABLE IF NOT EXISTS csr.onsite_tests (
    id                     UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id              UUID        NOT NULL,
    project_id             UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    inspection_lot_id      UUID        REFERENCES csr.inspection_lots(id) ON DELETE SET NULL,

    test_no                TEXT        NOT NULL,
    method                 TEXT        NOT NULL
                           CHECK (method IN (
                               'rebound','core','rebar_scan','cover_measure',
                               'ut','mt','rt','pt','pull_off','tap_tone','other'
                           )),

    tested_at              TIMESTAMPTZ NOT NULL,
    tester_id              UUID        NOT NULL,                -- 操作员
    witness_supervisor_id  UUID,                                -- 监理见证(可选)

    equipment_name         TEXT        NOT NULL,
    equipment_serial_no    TEXT        NOT NULL,
    equipment_calibration_valid_until DATE NOT NULL,
    equipment_calibration_cert_uri    TEXT,

    location_desc          TEXT,
    bim_element_guids      TEXT[],

    measurements           JSONB       NOT NULL DEFAULT '[]'::jsonb,
                           -- [{"sample":"A","value":25.3,"unit":"MPa","spec":">= 30","verdict":"fail"}]
    sample_size            INTEGER     NOT NULL,
    pass_count             INTEGER     NOT NULL DEFAULT 0,

    verdict                TEXT        NOT NULL
                           CHECK (verdict IN ('pass','fail','partial')),

    standards_applied      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    report_uri             TEXT,
    photo_evidence_ids     UUID[]      NOT NULL DEFAULT '{}',

    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.onsite_tests IS '现场检测 · 回弹 / UT / 钢筋扫描 等 · 仪器年检过期不得采信';

CREATE INDEX idx_ot_project_tested ON csr.onsite_tests(project_id, tested_at DESC);
CREATE INDEX idx_ot_lot ON csr.onsite_tests(inspection_lot_id);
CREATE INDEX idx_ot_equipment_expired
    ON csr.onsite_tests(tenant_id, equipment_serial_no)
    WHERE equipment_calibration_valid_until < CURRENT_DATE;

ALTER TABLE csr.onsite_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.onsite_tests FORCE ROW LEVEL SECURITY;
CREATE POLICY ot_tenant ON csr.onsite_tests
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

---

## 3. 示例 INSERT (锦屏 · W-208 UT 见证)

```sql
-- 见证取样
INSERT INTO csr.test_witnessings (
    tenant_id, project_id, inspection_lot_id, witness_no,
    material_or_element, sampling_method,
    sampling_at, location_desc, bim_element_guids,
    sample_count, sample_ids_json,
    witness_supervisor_id, sampler_contractor_id,
    send_to_lab_name, send_to_lab_cma_no
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '<lot id>',
    'JP-WIT-2026-0021',
    '钢结构焊缝 W-208 周边 · 二级焊缝', 'UT 抽样 3 点',
    TIMESTAMPTZ '2026-05-19 10:00:00+08',
    '二层 B×5 节点 柱-梁 焊缝',
    ARRAY['2A3K9XYZABCDEF12367']::text[],
    3, '["W-208-P1","W-208-P2","W-208-P3"]'::jsonb,
    '<张总监 uid>', '<焊工 uid>',
    '贵州某建筑工程检测公司', '160000003921'
);

-- 实验室报告回传
INSERT INTO csr.lab_reports (
    tenant_id, project_id, report_no, test_type,
    lab_name, lab_cma_no, lab_cma_verified_at,
    tested_at, issued_at,
    verdict, verdict_details,
    standards_applied, raw_measurements,
    report_uri, report_sha256,
    linked_witness_id
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'JP-UT-2026-0013', 'weld_ut',
    '贵州某建筑工程检测公司', '160000003921', TIMESTAMPTZ '2026-05-19 13:00',
    DATE '2026-05-19', DATE '2026-05-19',
    'fail',
    '{"samples":3,"pass":2,"fail":1,"fail_reason":"W-208-P2 内部夹渣 L=8mm 超 GB 50205-2020 §7.2.4 Ⅱ 级 5mm 限值"}'::jsonb,
    '["GB 50205-2020 §7.2.4","GB/T 11345-2013"]'::jsonb,
    '[{"sample":"W-208-P1","verdict":"pass"},
      {"sample":"W-208-P2","verdict":"fail","defect_length_mm":8},
      {"sample":"W-208-P3","verdict":"pass"}]'::jsonb,
    's3://insomeos/projects/jp/reports/JP-UT-2026-0013.pdf',
    'ab12cd34...(64 hex)...',
    '<witness id>'
);
```

---

## 4. 维护脚本

### 4.1 CMA 有效期校验

```sql
CREATE OR REPLACE FUNCTION csr.fn_cma_check() RETURNS TRIGGER AS $$
BEGIN
    -- 外部验证(同步)· 实际实现走后台 verify-cma job
    IF NEW.lab_cma_verified_at IS NULL OR NEW.lab_cma_verified_at < now() - INTERVAL '30 days' THEN
        -- 不强 reject · 标记提醒
        PERFORM pg_notify('csr_cma_stale', json_build_object('report_id', NEW.id, 'cma', NEW.lab_cma_no)::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 仪器年检过期阻断

```sql
-- onsite_test INSERT 时校验
ALTER TABLE csr.onsite_tests
ADD CONSTRAINT ot_calibration_valid
CHECK (equipment_calibration_valid_until >= tested_at::date);
```

---

## 5. 查询

```sql
-- 最近 30 日实验室报告
SELECT report_no, test_type, verdict, issued_at
FROM csr.lab_reports
WHERE project_id = $1 AND issued_at >= CURRENT_DATE - 30
ORDER BY issued_at DESC;

-- 不合格报告关联的缺陷
SELECT lr.report_no, qd.id AS defect_id, qd.description
FROM csr.lab_reports lr
CROSS JOIN UNNEST(lr.linked_defect_ids) WITH ORDINALITY d(defect_id, ord)
JOIN csr.quality_defects qd ON qd.id = d.defect_id
WHERE lr.project_id = $1 AND lr.verdict = 'fail';
```

---

version: 0.1.0 · 2026-04-23
