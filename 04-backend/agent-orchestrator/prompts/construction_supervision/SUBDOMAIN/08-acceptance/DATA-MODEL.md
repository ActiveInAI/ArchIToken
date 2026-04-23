# 08-acceptance · DATA-MODEL

4 张表 · 完整 DDL。

---

## 1. DDL

### 1.1 `csr.unit_projects`

```sql
CREATE TABLE IF NOT EXISTS csr.unit_projects (
    id                     UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id              UUID        NOT NULL,
    project_id             UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    code                   TEXT        NOT NULL,                -- "U-01"
    name                   TEXT        NOT NULL,                -- "锦屏应舍美居主楼"
    is_sub_unit            BOOLEAN     NOT NULL DEFAULT FALSE,  -- 子单位工程(大型项目才用)
    parent_unit_project_id UUID        REFERENCES csr.unit_projects(id) ON DELETE SET NULL,

    gross_floor_area_sqm   NUMERIC(12,2),
    stories                SMALLINT,

    verdict                TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (verdict IN ('pending','pass','fail','accepted')),
    accepted_at            TIMESTAMPTZ,
    handover_certificate_id UUID,

    remarks                TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.unit_projects IS '单位工程 · 可拆子单位 · GB 50300 §4.0.1';

CREATE UNIQUE INDEX idx_up_project_code ON csr.unit_projects(tenant_id, project_id, code);
CREATE INDEX idx_up_verdict ON csr.unit_projects(project_id, verdict);

ALTER TABLE csr.unit_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.unit_projects FORCE ROW LEVEL SECURITY;
CREATE POLICY up_tenant ON csr.unit_projects
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.2 `csr.acceptance_records`

```sql
CREATE TABLE IF NOT EXISTS csr.acceptance_records (
    id                     UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id              UUID        NOT NULL,
    project_id             UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    target_type            TEXT        NOT NULL
                           CHECK (target_type IN ('inspection_lot','sub_item','sub_part','unit_project','hidden_work','special')),
    target_id              UUID        NOT NULL,                    -- 柔性 FK · 按 target_type 解引用

    record_no              TEXT        NOT NULL,                    -- "JP-AR-2026-0012"
    level                  TEXT        NOT NULL
                           CHECK (level IN ('inspection_lot','sub_item','sub_part','unit_project','special')),

    acceptance_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    venue                  TEXT,

    standards_cited        JSONB       NOT NULL DEFAULT '[]'::jsonb,
                           -- [{"standard":"GB 50300-2013","clause":"§5.0.4"}]

    verdict                TEXT        NOT NULL
                           CHECK (verdict IN ('accepted','rejected','conditional')),
    conditional_items      JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- 附加条件 · 通过但要整改的小项

    -- 签字者(按 target_type 不同 · 要求不同)
    signed_by_owner_id         UUID,
    signed_by_contractor_id    UUID,
    signed_by_supervisor_id    UUID,
    signed_by_designer_id      UUID,
    signed_by_geotechnical_id  UUID,

    signed_by_owner_at         TIMESTAMPTZ,
    signed_by_contractor_at    TIMESTAMPTZ,
    signed_by_supervisor_at    TIMESTAMPTZ,
    signed_by_designer_at      TIMESTAMPTZ,
    signed_by_geotechnical_at  TIMESTAMPTZ,

    photo_evidence_ids     UUID[]      NOT NULL DEFAULT '{}',
    attached_docs          JSONB       NOT NULL DEFAULT '[]'::jsonb,

    -- 关键不变量 · target=unit_project → 五方签字齐全
    CONSTRAINT ar_unit_five_sigs CHECK (
        target_type != 'unit_project' OR verdict != 'accepted' OR
        (signed_by_owner_id IS NOT NULL AND signed_by_contractor_id IS NOT NULL
         AND signed_by_supervisor_id IS NOT NULL AND signed_by_designer_id IS NOT NULL)
    ),

    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.acceptance_records IS '验收记录统一表 · 对四级验收树 + 隐蔽 + 专项';

CREATE UNIQUE INDEX idx_ar_no ON csr.acceptance_records(tenant_id, record_no);
CREATE INDEX idx_ar_target ON csr.acceptance_records(target_type, target_id);
CREATE INDEX idx_ar_project_level ON csr.acceptance_records(project_id, level, acceptance_at DESC);

ALTER TABLE csr.acceptance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.acceptance_records FORCE ROW LEVEL SECURITY;
CREATE POLICY ar_tenant ON csr.acceptance_records
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.3 `csr.hidden_works`

```sql
CREATE TABLE IF NOT EXISTS csr.hidden_works (
    id                   UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id            UUID        NOT NULL,
    project_id           UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    inspection_lot_id    UUID        REFERENCES csr.inspection_lots(id) ON DELETE SET NULL,

    hw_no                TEXT        NOT NULL,                -- "JP-HW-2026-0031"
    title                TEXT        NOT NULL,                -- "二层楼板钢筋绑扎 · 隐蔽"
    category             TEXT        NOT NULL
                         CHECK (category IN ('rebar','waterproof','insulation','foundation','embedded','other')),

    before_buried_at     TIMESTAMPTZ NOT NULL,                -- 即将掩埋时点
    actual_buried_at     TIMESTAMPTZ,

    location_desc        TEXT,
    bim_element_guids    TEXT[],
    content              TEXT        NOT NULL,                -- 实际情况描述

    standards_applied    JSONB       NOT NULL DEFAULT '[]'::jsonb,

    -- 影像强制 ≥ 4 张(前后左右 or 多角度)
    photo_evidence_ids   UUID[]      NOT NULL DEFAULT '{}',

    verdict              TEXT        NOT NULL DEFAULT 'pending'
                         CHECK (verdict IN ('pending','pass','fail')),

    supervisor_signed_id UUID,
    supervisor_signed_at TIMESTAMPTZ,
    contractor_signed_id UUID,
    contractor_signed_at TIMESTAMPTZ,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT hw_photo_min CHECK (array_length(photo_evidence_ids, 1) >= 4 OR verdict IS NULL OR verdict = 'pending'),
    CONSTRAINT hw_dual_sign CHECK (
        verdict NOT IN ('pass','fail') OR
        (supervisor_signed_id IS NOT NULL AND contractor_signed_id IS NOT NULL)
    )
);

COMMENT ON TABLE csr.hidden_works IS '隐蔽工程验收 · 影像 ≥ 4 张 · 双签';

CREATE UNIQUE INDEX idx_hw_no ON csr.hidden_works(tenant_id, hw_no);
CREATE INDEX idx_hw_project_before ON csr.hidden_works(project_id, before_buried_at DESC);
CREATE INDEX idx_hw_lot ON csr.hidden_works(inspection_lot_id);

ALTER TABLE csr.hidden_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.hidden_works FORCE ROW LEVEL SECURITY;
CREATE POLICY hw_tenant ON csr.hidden_works
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.4 `csr.handover_certificates`

```sql
CREATE TABLE IF NOT EXISTS csr.handover_certificates (
    id                      UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id               UUID        NOT NULL,
    project_id              UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    unit_project_id         UUID        NOT NULL REFERENCES csr.unit_projects(id) ON DELETE RESTRICT,

    cert_no                 TEXT        NOT NULL,               -- "JP-HC-2026-0001"
    type                    TEXT        NOT NULL
                            CHECK (type IN ('completion','handover_partial','owner_occupancy')),

    final_acceptance_date   DATE        NOT NULL,
    filing_deadline         DATE        NOT NULL,                -- 建质 171 · 15 工作日
    filing_completed_at     TIMESTAMPTZ,
    filing_receipt_uri      TEXT,

    supervisor_assessment_report_uri TEXT NOT NULL,                -- GB/T 50319 §5.6.5
    supervisor_assessment_report_sha CHAR(64),

    sub_part_acceptance_ids UUID[]      NOT NULL DEFAULT '{}',     -- 关联全部 sub_part 验收记录
    special_acceptance_ids  UUID[]      NOT NULL DEFAULT '{}',     -- 消防 / 人防 / 防雷 / 节能 专项

    -- 五方最终签字
    signed_by_owner_id      UUID        NOT NULL,
    signed_by_contractor_id UUID        NOT NULL,
    signed_by_supervisor_id UUID        NOT NULL,
    signed_by_designer_id   UUID        NOT NULL,
    signed_by_geotechnical_id UUID,                               -- 勘察单位可能不参与最终

    cert_pdf_uri            TEXT        NOT NULL,
    cert_pdf_sha256         CHAR(64)    NOT NULL,

    status                  TEXT        NOT NULL DEFAULT 'issued'
                            CHECK (status IN ('issued','filed','archived','voided')),

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.handover_certificates IS '竣工验收证明书 · 五方最终签字 · 15 日备案';

CREATE UNIQUE INDEX idx_hc_no ON csr.handover_certificates(tenant_id, cert_no);
CREATE INDEX idx_hc_project ON csr.handover_certificates(project_id, final_acceptance_date DESC);
CREATE INDEX idx_hc_filing_due ON csr.handover_certificates(project_id) WHERE filing_completed_at IS NULL;

ALTER TABLE csr.handover_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.handover_certificates FORCE ROW LEVEL SECURITY;
CREATE POLICY hc_tenant ON csr.handover_certificates
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

---

## 2. 示例 INSERT (锦屏 · 竣工验收)

```sql
-- 隐蔽工程 · 二层楼板钢筋绑扎 · 5/21
INSERT INTO csr.hidden_works (
    tenant_id, project_id, inspection_lot_id, hw_no, title, category,
    before_buried_at, location_desc, bim_element_guids, content,
    standards_applied, photo_evidence_ids, verdict,
    supervisor_signed_id, contractor_signed_id
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '<lot id>', 'JP-HW-2026-0031',
    '二层楼板钢筋绑扎 · 隐蔽验收', 'rebar',
    TIMESTAMPTZ '2026-05-21 09:00:00+08',
    '二层 整层楼板',
    ARRAY[]::text[],
    '二层楼板双层双向钢筋 HRB400 φ12@200 绑扎完成 · 保护层 15mm 垫块到位 · 与图纸一致',
    '["GB 50204-2015 §5.2","GB 50300-2013 §5.0.4"]'::jsonb,
    ARRAY[<photo1>,<photo2>,<photo3>,<photo4>,<photo5>]::uuid[],
    'pass',
    '<张总监>', '<李项目经理>'
);

-- 单位工程
INSERT INTO csr.unit_projects (tenant_id, project_id, code, name, gross_floor_area_sqm, stories)
VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
        'U-01', '锦屏应舍美居主楼', 520.00, 3);

-- 竣工验收 acceptance_record
INSERT INTO csr.acceptance_records (
    tenant_id, project_id, target_type, target_id, record_no, level,
    acceptance_at, venue, standards_cited, verdict,
    signed_by_owner_id, signed_by_contractor_id, signed_by_supervisor_id,
    signed_by_designer_id, signed_by_geotechnical_id,
    signed_by_owner_at, signed_by_contractor_at, signed_by_supervisor_at,
    signed_by_designer_at, signed_by_geotechnical_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'unit_project', '<unit project id>',
    'JP-AR-2026-0080', 'unit_project',
    TIMESTAMPTZ '2026-06-13 14:00:00+08',
    '锦屏应舍美居项目部',
    '["GB 50300-2013 §5.0","建质〔2013〕171 号","GB/T 50319-2013 §5.6.5"]'::jsonb,
    'accepted',
    '<业主>', '<施工>', '<监理>', '<设计>', '<勘察>',
    TIMESTAMPTZ '2026-06-13 16:00',
    TIMESTAMPTZ '2026-06-13 16:00',
    TIMESTAMPTZ '2026-06-13 16:00',
    TIMESTAMPTZ '2026-06-13 16:00',
    TIMESTAMPTZ '2026-06-13 16:00'
);

-- 竣工证书
INSERT INTO csr.handover_certificates (
    tenant_id, project_id, unit_project_id, cert_no, type,
    final_acceptance_date, filing_deadline,
    supervisor_assessment_report_uri,
    sub_part_acceptance_ids, special_acceptance_ids,
    signed_by_owner_id, signed_by_contractor_id, signed_by_supervisor_id,
    signed_by_designer_id, signed_by_geotechnical_id,
    cert_pdf_uri, cert_pdf_sha256
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '<unit id>', 'JP-HC-2026-0001', 'completion',
    DATE '2026-06-13', DATE '2026-07-04',       -- 15 工作日
    's3://insomeos/projects/jp/reports/quality_assessment.pdf',
    ARRAY[<8 分部 acceptance ids>],
    ARRAY[<消防/节能/防雷 acceptance ids>],
    '<业主>', '<施工>', '<监理>', '<设计>', '<勘察>',
    's3://insomeos/projects/jp/certs/JP-HC-2026-0001.pdf',
    'de34...(64 hex)...'
);
```

---

## 3. 聚合触发(续 07)

```sql
-- sub_part 全 pass · unit_project rollup
CREATE OR REPLACE FUNCTION csr.fn_up_rollup() RETURNS TRIGGER AS $$
DECLARE all_pass boolean;
BEGIN
    SELECT bool_and(verdict IN ('pass','accepted')) INTO all_pass
    FROM csr.sub_parts WHERE unit_project_id = NEW.unit_project_id AND level = 1;
    IF all_pass THEN
        UPDATE csr.unit_projects SET verdict='pass', updated_at=now() WHERE id = NEW.unit_project_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_up_rollup
AFTER UPDATE OF verdict ON csr.sub_parts
FOR EACH ROW WHEN (NEW.verdict IN ('pass','accepted') AND NEW.level = 1)
EXECUTE FUNCTION csr.fn_up_rollup();
```

---

## 4. 查询

```sql
-- 某项目 · 尚未备案的竣工证书(15 日窗口剩余)
SELECT cert_no, final_acceptance_date, filing_deadline, filing_deadline - CURRENT_DATE AS days_left
FROM csr.handover_certificates
WHERE project_id = $1 AND filing_completed_at IS NULL
ORDER BY filing_deadline;

-- 隐蔽工程完整性(证明链)
SELECT hw.hw_no, hw.title, array_length(hw.photo_evidence_ids,1) AS photos,
       hw.supervisor_signed_id IS NOT NULL AS supervised,
       hw.verdict
FROM csr.hidden_works hw
WHERE hw.project_id = $1
ORDER BY hw.before_buried_at;
```

---

version: 0.1.0 · 2026-04-23
