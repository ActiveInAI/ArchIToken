# 07-inspection_lot · DATA-MODEL

3 张表 · 完整 DDL(unit_projects 在 08-acceptance)。

---

## 1. DDL

### 1.1 `csr.sub_parts`

```sql
CREATE TABLE IF NOT EXISTS csr.sub_parts (
    id                 UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id          UUID        NOT NULL,
    project_id         UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    unit_project_id    UUID        NOT NULL,                 -- FK 到 csr.unit_projects(08-acceptance)
    parent_sub_part_id UUID        REFERENCES csr.sub_parts(id) ON DELETE CASCADE,

    code               TEXT        NOT NULL,                 -- "1" ~ "10"(GB 50300 附录 B)
    name               TEXT        NOT NULL,                 -- "主体结构" / "混凝土结构(子分部)"
    level              SMALLINT    NOT NULL DEFAULT 1
                       CHECK (level IN (1,2)),                -- 1 = 分部 · 2 = 子分部
    standard_code      TEXT        NOT NULL,                  -- 适用标号 "GB 50204-2015"

    order_in_parent    INTEGER     NOT NULL DEFAULT 0,

    verdict            TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (verdict IN ('pending','pass','fail','accepted')),
    accepted_at        TIMESTAMPTZ,
    accepted_by_sig_ids UUID[]    NOT NULL DEFAULT '{}',      -- sign_off id 列表(五方各一)

    remarks            TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.sub_parts IS '分部 + 子分部 · GB 50300-2013 附录 B · level=1 分部 · 2 子分部';

CREATE UNIQUE INDEX idx_sp_unit_code ON csr.sub_parts(tenant_id, unit_project_id, code);
CREATE INDEX idx_sp_parent ON csr.sub_parts(parent_sub_part_id);
CREATE INDEX idx_sp_verdict ON csr.sub_parts(project_id, verdict);

ALTER TABLE csr.sub_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.sub_parts FORCE ROW LEVEL SECURITY;
CREATE POLICY sp_tenant ON csr.sub_parts
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.2 `csr.sub_items`

```sql
CREATE TABLE IF NOT EXISTS csr.sub_items (
    id              UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id       UUID        NOT NULL,
    project_id      UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    sub_part_id     UUID        NOT NULL REFERENCES csr.sub_parts(id) ON DELETE CASCADE,

    code            TEXT        NOT NULL,                     -- "1.1.3" 等
    name            TEXT        NOT NULL,                     -- "钢筋安装"
    standard_clause JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- [{"standard":"GB 50204-2015","clause":"§5.2"}]

    order_in_parent INTEGER     NOT NULL DEFAULT 0,

    verdict         TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (verdict IN ('pending','pass','fail','accepted')),
    accepted_at     TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.sub_items IS '分项工程 · 上属 sub_part · 下带多个 inspection_lot';

CREATE UNIQUE INDEX idx_si_sp_code ON csr.sub_items(tenant_id, sub_part_id, code);
CREATE INDEX idx_si_verdict ON csr.sub_items(project_id, verdict);

ALTER TABLE csr.sub_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.sub_items FORCE ROW LEVEL SECURITY;
CREATE POLICY si_tenant ON csr.sub_items
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.3 `csr.inspection_lots`

```sql
CREATE TABLE IF NOT EXISTS csr.inspection_lots (
    id                     UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id              UUID        NOT NULL,
    project_id             UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    sub_item_id            UUID        NOT NULL REFERENCES csr.sub_items(id) ON DELETE CASCADE,

    lot_no                 TEXT        NOT NULL,                -- "JP-LOT-2026-B5-001"
    batch_description      TEXT        NOT NULL,                 -- "二层 B 轴 柱-梁焊接 · 3 根主梁"
    bim_element_guids      TEXT[],                               -- 涉及构件
    activity_ids           UUID[]      NOT NULL DEFAULT '{}',    -- 关联工序

    -- 主控项目 (main control items)
    main_items             JSONB       NOT NULL DEFAULT '[]'::jsonb,
                           -- [{"name":"焊缝外观","standard":"GB 50205-2020","clause":"§7.2.3",
                           --   "verdict":"pass","evidence_ids":["..."]}]
    -- 一般项目 (general items)
    general_items          JSONB       NOT NULL DEFAULT '[]'::jsonb,
                           -- [{"name":"尺寸偏差","sample_size":10,"pass_count":8,"spec":"±3mm","pass_rate":0.80}]

    -- 汇总
    main_total             INTEGER     GENERATED ALWAYS AS (jsonb_array_length(main_items)) STORED,
    main_pass              INTEGER     NOT NULL DEFAULT 0,
    general_pass_rate      NUMERIC(5,4),

    verdict                TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (verdict IN ('pending','pass','fail','accepted')),
    verdict_computed_at    TIMESTAMPTZ,

    contractor_self_check_at TIMESTAMPTZ,
    supervisor_reviewed_at TIMESTAMPTZ,
    supervisor_reviewer_id UUID,

    test_witnessing_ids    UUID[]      NOT NULL DEFAULT '{}',
    lab_report_ids         UUID[]      NOT NULL DEFAULT '{}',
    onsite_test_ids        UUID[]      NOT NULL DEFAULT '{}',
    photo_evidence_ids     UUID[]      NOT NULL DEFAULT '{}',

    remarks                TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- 核心不变量
    CONSTRAINT il_main_all_pass_required CHECK (
        verdict != 'pass' AND verdict != 'accepted' OR main_pass = main_total
    ),
    CONSTRAINT il_general_rate_required CHECK (
        verdict != 'pass' AND verdict != 'accepted' OR general_pass_rate IS NULL OR general_pass_rate >= 0.80
    )
);

COMMENT ON TABLE csr.inspection_lots IS '检验批 · 四级验收树底层 · 主控 100% · 一般 ≥80%';

CREATE UNIQUE INDEX idx_il_lot_no ON csr.inspection_lots(tenant_id, lot_no);
CREATE INDEX idx_il_si ON csr.inspection_lots(sub_item_id, verdict);
CREATE INDEX idx_il_verdict_pending ON csr.inspection_lots(project_id) WHERE verdict = 'pending';

ALTER TABLE csr.inspection_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.inspection_lots FORCE ROW LEVEL SECURITY;
CREATE POLICY il_tenant ON csr.inspection_lots
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

---

## 2. 示例 INSERT (锦屏 B 轴 批)

```sql
-- sub_part · 主体结构 (分部)
INSERT INTO csr.sub_parts (tenant_id, project_id, unit_project_id, code, name, level, standard_code)
VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
        '<unit 1 id>', '2', '主体结构', 1, 'GB 50300-2013');

-- sub_part · 钢结构 (子分部)
INSERT INTO csr.sub_parts (tenant_id, project_id, unit_project_id, parent_sub_part_id,
                           code, name, level, standard_code)
VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
        '<unit 1 id>', '<分部 主体 id>', '2.4', '钢结构', 2, 'GB 50205-2020');

-- sub_item · 钢结构 焊接连接
INSERT INTO csr.sub_items (tenant_id, project_id, sub_part_id, code, name, standard_clause)
VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
        '<子分部 钢结构 id>', '2.4.3', '焊接连接',
        '[{"standard":"GB 50205-2020","clause":"§7.2"}]'::jsonb);

-- inspection_lot · B 轴批
INSERT INTO csr.inspection_lots (
    tenant_id, project_id, sub_item_id, lot_no, batch_description,
    bim_element_guids, activity_ids,
    main_items, general_items
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '<sub_item 焊接连接 id>',
    'JP-LOT-2026-B5-001',
    '二层 B 轴 B×5 柱-梁焊接 · 3 节点',
    ARRAY['2A3K9XYZABCDEF12367','2A3K9XYZABCDEF12368','2A3K9XYZABCDEF12369'],
    ARRAY['<A1210>']::uuid[],
    -- 主控 5 项
    '[
      {"name":"焊缝外观","standard":"GB 50205-2020","clause":"§7.2.3","verdict":"pass"},
      {"name":"焊缝内部缺陷 UT","standard":"GB 50205-2020","clause":"§7.2.4","verdict":"fail"},
      {"name":"焊材与母材匹配","standard":"GB 50205-2020","clause":"§7.3.2","verdict":"pass"},
      {"name":"焊工资格","standard":"GB 50661-2011","clause":"§4.2","verdict":"pass"},
      {"name":"焊接工艺评定","standard":"GB 50661-2011","clause":"§5.2","verdict":"pass"}
    ]'::jsonb,
    -- 一般 12 项
    '[
      {"name":"焊脚尺寸","sample_size":10,"pass_count":9,"spec":"±1mm","pass_rate":0.90},
      {"name":"余高","sample_size":10,"pass_count":10,"pass_rate":1.00}
    ]'::jsonb
);
```

---

## 3. 维护脚本

### 3.1 验收结论自动计算

```sql
CREATE OR REPLACE FUNCTION csr.fn_il_compute_verdict() RETURNS TRIGGER AS $$
DECLARE pass_main int; fail_main int; total_main int; gp_rate numeric;
BEGIN
    SELECT
        COUNT(*) FILTER (WHERE (item->>'verdict') = 'pass'),
        COUNT(*) FILTER (WHERE (item->>'verdict') = 'fail'),
        COUNT(*)
    INTO pass_main, fail_main, total_main
    FROM jsonb_array_elements(NEW.main_items) item;

    SELECT COALESCE(
        AVG(( (item->>'pass_count')::numeric / NULLIF((item->>'sample_size')::numeric, 0) )),
        NULL
    ) INTO gp_rate
    FROM jsonb_array_elements(NEW.general_items) item;

    NEW.main_total := total_main;
    NEW.main_pass  := pass_main;
    NEW.general_pass_rate := gp_rate;

    NEW.verdict := CASE
        WHEN total_main > 0 AND pass_main < total_main THEN 'fail'
        WHEN gp_rate IS NOT NULL AND gp_rate < 0.80 THEN 'fail'
        WHEN total_main > 0 AND pass_main = total_main AND (gp_rate IS NULL OR gp_rate >= 0.80) THEN 'pass'
        ELSE 'pending'
    END;
    NEW.verdict_computed_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_il_compute
BEFORE INSERT OR UPDATE OF main_items, general_items ON csr.inspection_lots
FOR EACH ROW EXECUTE FUNCTION csr.fn_il_compute_verdict();
```

### 3.2 向上聚合

```sql
-- 当所有 inspection_lot 的 verdict=pass · sub_item verdict → pass
CREATE OR REPLACE FUNCTION csr.fn_si_rollup() RETURNS TRIGGER AS $$
DECLARE all_pass boolean;
BEGIN
    SELECT bool_and(verdict IN ('pass','accepted')) INTO all_pass
    FROM csr.inspection_lots WHERE sub_item_id = NEW.sub_item_id;
    IF all_pass THEN
        UPDATE csr.sub_items SET verdict='pass', updated_at=now() WHERE id = NEW.sub_item_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_si_rollup
AFTER UPDATE OF verdict ON csr.inspection_lots
FOR EACH ROW WHEN (NEW.verdict IN ('pass','accepted'))
EXECUTE FUNCTION csr.fn_si_rollup();
```

(sub_part → unit_project 的聚合同理 · 在 08-acceptance 里实现)

---

## 4. 查询

```sql
-- 验收树全貌
SELECT sp.name AS sub_part, si.name AS sub_item, il.lot_no, il.verdict
FROM csr.sub_parts sp
JOIN csr.sub_items si ON si.sub_part_id = sp.id
JOIN csr.inspection_lots il ON il.sub_item_id = si.id
WHERE sp.project_id = $1 AND sp.unit_project_id = $2
ORDER BY sp.code, si.code, il.lot_no;

-- 不合格批
SELECT lot_no, batch_description, main_pass, main_total, general_pass_rate
FROM csr.inspection_lots
WHERE project_id = $1 AND verdict = 'fail'
ORDER BY created_at DESC;
```

---

version: 0.1.0 · 2026-04-23
