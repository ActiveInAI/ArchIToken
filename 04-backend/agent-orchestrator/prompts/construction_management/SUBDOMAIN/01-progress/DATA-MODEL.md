# 01-progress · DATA-MODEL

本子域 5 张表的完整 PostgreSQL DDL + 索引 + 注释 + 示例 INSERT。
Schema: `csr` (construction_management 缩写)。
命名 / RLS / 审计列 规范见模块顶层 [`../../DATA-MODEL.md`](../../DATA-MODEL.md) §1。

---

## 1. 表清单

| # | 表 | 业务含义 | 行预估 |
|---|---|---|---:|
| 1 | `csr.schedules` | 进度计划主表 (baseline + versioned) | ~10/project |
| 2 | `csr.wbs_nodes` | WBS 工作分解结构 (邻接表) | ~500/project |
| 3 | `csr.activities` | 工序 · 工期 · 逻辑关系 | ~2000/project |
| 4 | `csr.milestones` | 里程碑 · 合同关键节点 | ~20/project |
| 5 | `csr.progress_snapshots` | EVM 日 / 周快照 | ~500/project/year |

---

## 2. DDL

### 2.1 `csr.schedules`

```sql
CREATE TABLE IF NOT EXISTS csr.schedules (
    id               UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id        UUID        NOT NULL,
    project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    module_id        TEXT        NOT NULL DEFAULT 'construction_management' REFERENCES public.modules(id),

    version_no       INTEGER     NOT NULL,           -- 1, 2, 3 ... 同一 project 的计划版本
    name             TEXT        NOT NULL,           -- "v1 招标进度" / "v3 第一次赶工"
    is_baseline      BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active        BOOLEAN     NOT NULL DEFAULT TRUE,

    planned_start    DATE        NOT NULL,
    planned_finish   DATE        NOT NULL,
    data_date        DATE,                           -- 数据更新日 · Primavera 术语

    source           TEXT        NOT NULL DEFAULT 'manual'
                     CHECK (source IN ('manual','primavera_xer','msp_mpp','bim_4d','generated')),

    remarks          TEXT,
    created_by       UUID,
    updated_by       UUID,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,

    CONSTRAINT schedules_period_valid CHECK (planned_finish >= planned_start),
    CONSTRAINT schedules_version_unique UNIQUE (tenant_id, project_id, version_no)
);

COMMENT ON TABLE  csr.schedules           IS '进度计划主表 · 含基线与多版本';
COMMENT ON COLUMN csr.schedules.is_baseline IS '全项目只能有 1 行 TRUE · 由触发器强制';
COMMENT ON COLUMN csr.schedules.data_date IS '计划更新截止日 · Primavera Data Date';
COMMENT ON COLUMN csr.schedules.source   IS '计划来源 · 决定是否需要从外部同步';

CREATE INDEX idx_schedules_tenant_project
    ON csr.schedules (tenant_id, project_id, is_active, created_at DESC);

CREATE UNIQUE INDEX idx_schedules_one_baseline_per_project
    ON csr.schedules (tenant_id, project_id)
    WHERE is_baseline = TRUE AND deleted_at IS NULL;

ALTER TABLE csr.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.schedules FORCE  ROW LEVEL SECURITY;
CREATE POLICY schedules_tenant_isolation ON csr.schedules
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.2 `csr.wbs_nodes`

```sql
CREATE TABLE IF NOT EXISTS csr.wbs_nodes (
    id               UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id        UUID        NOT NULL,
    schedule_id      UUID        NOT NULL REFERENCES csr.schedules(id) ON DELETE CASCADE,
    parent_id        UUID        REFERENCES csr.wbs_nodes(id) ON DELETE CASCADE,

    code             TEXT        NOT NULL,             -- WBS 编码 "1.2.3"
    name             TEXT        NOT NULL,
    level            SMALLINT    NOT NULL,             -- 1=项目 · 2=阶段 · 3=分部 ...
    order_in_parent  INTEGER     NOT NULL DEFAULT 0,

    weight           NUMERIC(6,4) NOT NULL DEFAULT 0,  -- 0.0000 ~ 1.0000 权重

    budget_cost_cny  NUMERIC(18,2) DEFAULT 0,          -- 计划成本(分)
    budget_man_days  NUMERIC(12,2) DEFAULT 0,

    remarks          TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT wbs_level_positive CHECK (level >= 1),
    CONSTRAINT wbs_weight_valid   CHECK (weight >= 0 AND weight <= 1)
);

COMMENT ON TABLE  csr.wbs_nodes IS 'WBS 工作分解结构 · 邻接表模型 · 递归 CTE 查询';
COMMENT ON COLUMN csr.wbs_nodes.weight IS '本节点在兄弟节点中的权重 (兄弟求和 = 1.0000)';

CREATE UNIQUE INDEX idx_wbs_schedule_code
    ON csr.wbs_nodes (tenant_id, schedule_id, code);
CREATE INDEX idx_wbs_parent
    ON csr.wbs_nodes (parent_id);
CREATE INDEX idx_wbs_schedule
    ON csr.wbs_nodes (schedule_id, level, order_in_parent);

ALTER TABLE csr.wbs_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.wbs_nodes FORCE  ROW LEVEL SECURITY;
CREATE POLICY wbs_tenant_isolation ON csr.wbs_nodes
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.3 `csr.activities`

```sql
CREATE TABLE IF NOT EXISTS csr.activities (
    id                 UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id          UUID        NOT NULL,
    schedule_id        UUID        NOT NULL REFERENCES csr.schedules(id) ON DELETE CASCADE,
    wbs_node_id        UUID        NOT NULL REFERENCES csr.wbs_nodes(id) ON DELETE RESTRICT,

    code               TEXT        NOT NULL,           -- "A1020" 同一 schedule 唯一
    name               TEXT        NOT NULL,
    duration_days      NUMERIC(8,2) NOT NULL,
    is_key_process     BOOLEAN     NOT NULL DEFAULT FALSE,   -- 是否关键工序(需旁站)

    early_start        DATE,
    early_finish       DATE,
    late_start         DATE,
    late_finish        DATE,
    total_float        NUMERIC(8,2),
    free_float         NUMERIC(8,2),

    actual_start       DATE,
    actual_finish      DATE,
    pct_complete       NUMERIC(5,2) NOT NULL DEFAULT 0     -- 0.00 ~ 100.00
                       CHECK (pct_complete >= 0 AND pct_complete <= 100),

    predecessors_json  JSONB       NOT NULL DEFAULT '[]'::jsonb,
                                   -- [{"pred_id":"...","type":"FS","lag_days":0}, ...]
                                   -- type ∈ FS | SS | FF | SF

    resource_plan      JSONB       NOT NULL DEFAULT '{}'::jsonb,
                                   -- {"labor":{"pm":1,"foreman":2}, "materials":[...]}

    bim_element_guids  TEXT[],                            -- IFC GlobalId 双向映射

    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT activities_duration_positive   CHECK (duration_days >= 0),
    CONSTRAINT activities_es_le_ls            CHECK (early_start IS NULL OR late_start IS NULL OR early_start <= late_start),
    CONSTRAINT activities_actual_order        CHECK (actual_start IS NULL OR actual_finish IS NULL OR actual_start <= actual_finish)
);

COMMENT ON TABLE  csr.activities IS '工序表 · 对齐 Primavera / MS Project 字段语义';
COMMENT ON COLUMN csr.activities.predecessors_json IS '前驱数组 · 逻辑关系与时差';
COMMENT ON COLUMN csr.activities.is_key_process IS '关键工序 · monitoring_post 强关联';

CREATE UNIQUE INDEX idx_activities_schedule_code
    ON csr.activities (tenant_id, schedule_id, code);
CREATE INDEX idx_activities_wbs
    ON csr.activities (wbs_node_id);
CREATE INDEX idx_activities_schedule_dates
    ON csr.activities (schedule_id, early_start);
CREATE INDEX idx_activities_pct
    ON csr.activities (schedule_id, pct_complete)
    WHERE pct_complete < 100;
CREATE INDEX idx_activities_bim_guids
    ON csr.activities USING GIN (bim_element_guids);

ALTER TABLE csr.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.activities FORCE  ROW LEVEL SECURITY;
CREATE POLICY activities_tenant_isolation ON csr.activities
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.4 `csr.milestones`

```sql
CREATE TABLE IF NOT EXISTS csr.milestones (
    id               UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id        UUID        NOT NULL,
    project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    schedule_id      UUID        REFERENCES csr.schedules(id) ON DELETE SET NULL,
    activity_id      UUID        REFERENCES csr.activities(id) ON DELETE SET NULL,

    code             TEXT        NOT NULL,               -- "M01"
    name             TEXT        NOT NULL,               -- "基础完工"
    category         TEXT        NOT NULL
                     CHECK (category IN ('contract','payment','regulatory','internal','handover')),

    target_date      DATE        NOT NULL,
    actual_date      DATE,
    status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','achieved','slipped','waived')),

    liquidated_damages_cny_per_day NUMERIC(18,2),        -- 延期违约金 (元/日)
    remarks          TEXT,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  csr.milestones IS '里程碑表 · 含合同关键节点与违约金关联';
COMMENT ON COLUMN csr.milestones.category IS '合同 / 支付 / 监管 / 内部 / 移交';

CREATE UNIQUE INDEX idx_milestones_project_code
    ON csr.milestones (tenant_id, project_id, code);
CREATE INDEX idx_milestones_project_target
    ON csr.milestones (project_id, target_date);
CREATE INDEX idx_milestones_status
    ON csr.milestones (project_id, status) WHERE status IN ('pending','slipped');

ALTER TABLE csr.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.milestones FORCE  ROW LEVEL SECURITY;
CREATE POLICY milestones_tenant_isolation ON csr.milestones
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.5 `csr.progress_snapshots`

```sql
CREATE TABLE IF NOT EXISTS csr.progress_snapshots (
    id                UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id         UUID        NOT NULL,
    project_id        UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    schedule_id       UUID        NOT NULL REFERENCES csr.schedules(id) ON DELETE CASCADE,
    snapshot_date     DATE        NOT NULL,

    pv_cny            NUMERIC(18,2) NOT NULL,      -- Planned Value
    ev_cny            NUMERIC(18,2) NOT NULL,      -- Earned Value
    ac_cny            NUMERIC(18,2) NOT NULL,      -- Actual Cost

    cpi               NUMERIC(8,4)  GENERATED ALWAYS AS (CASE WHEN ac_cny > 0 THEN ev_cny / ac_cny ELSE NULL END) STORED,
    spi               NUMERIC(8,4)  GENERATED ALWAYS AS (CASE WHEN pv_cny > 0 THEN ev_cny / pv_cny ELSE NULL END) STORED,

    budget_at_completion_cny NUMERIC(18,2),        -- BAC
    estimate_at_completion_cny NUMERIC(18,2),      -- EAC
    estimate_to_complete_cny  NUMERIC(18,2),       -- ETC

    overall_pct       NUMERIC(5,2) NOT NULL DEFAULT 0
                      CHECK (overall_pct >= 0 AND overall_pct <= 100),

    remarks           TEXT,
    generated_by      TEXT NOT NULL DEFAULT 'manual'
                      CHECK (generated_by IN ('manual','llm_agent','scheduled_job')),

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT snapshots_unique_per_day UNIQUE (tenant_id, project_id, snapshot_date)
);

COMMENT ON TABLE  csr.progress_snapshots IS 'EVM 快照 · 日/周节律 · 不可修改 · 只能 INSERT 新行';
COMMENT ON COLUMN csr.progress_snapshots.cpi IS 'Cost Performance Index = EV / AC';
COMMENT ON COLUMN csr.progress_snapshots.spi IS 'Schedule Performance Index = EV / PV';

CREATE INDEX idx_snapshots_project_date
    ON csr.progress_snapshots (project_id, snapshot_date DESC);
CREATE INDEX idx_snapshots_spi_low
    ON csr.progress_snapshots (project_id, snapshot_date)
    WHERE spi < 0.95;

ALTER TABLE csr.progress_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.progress_snapshots FORCE  ROW LEVEL SECURITY;
CREATE POLICY snapshots_tenant_isolation ON csr.progress_snapshots
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

---

## 3. 示例 INSERT (锦屏应舍美居 · 520㎡ · 45 日)

```sql
-- 1. schedule v1 baseline
INSERT INTO csr.schedules (
    tenant_id, project_id, version_no, name, is_baseline, is_active,
    planned_start, planned_finish, data_date, source
) VALUES (
    '00000000-0000-0000-0000-000000000001',      -- tenant
    '00000000-0000-0000-0000-000000000010',      -- project: 锦屏应舍美居
    1, 'v1 · 45 日基线计划', TRUE, TRUE,
    DATE '2026-05-01', DATE '2026-06-14', DATE '2026-05-01', 'manual'
);

-- 2. WBS (level 1-3 · 省略)
INSERT INTO csr.wbs_nodes (tenant_id, schedule_id, parent_id, code, name, level, order_in_parent, weight)
VALUES
    ('00000000-0000-0000-0000-000000000001', <schedule_id>, NULL,        '1',     '锦屏应舍美居', 1, 0, 1.0000),
    ('00000000-0000-0000-0000-000000000001', <schedule_id>, <1.id>,      '1.1',   '基础工程',     2, 0, 0.1500),
    ('00000000-0000-0000-0000-000000000001', <schedule_id>, <1.id>,      '1.2',   '钢结构',       2, 1, 0.4000),
    ('00000000-0000-0000-0000-000000000001', <schedule_id>, <1.id>,      '1.3',   '围护',         2, 2, 0.2000),
    ('00000000-0000-0000-0000-000000000001', <schedule_id>, <1.id>,      '1.4',   '装饰装修机电', 2, 3, 0.2500);

-- 3. activity · 二层柱焊接 (关键工序)
INSERT INTO csr.activities (
    tenant_id, schedule_id, wbs_node_id, code, name, duration_days,
    is_key_process, early_start, early_finish, total_float, pct_complete,
    predecessors_json, bim_element_guids
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    <schedule_id>, <wbs 1.2 id>,
    'A1210', '二层钢柱焊接', 3.0,
    TRUE,
    DATE '2026-05-17', DATE '2026-05-20', 0, 0,
    '[{"pred_id":"A1205","type":"FS","lag_days":0}]'::jsonb,
    ARRAY['2A3K9XYZABCDEF12345', '2A3K9XYZABCDEF12346']
);

-- 4. milestone · 基础完工
INSERT INTO csr.milestones (tenant_id, project_id, code, name, category, target_date, liquidated_damages_cny_per_day)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'M01', '基础完工', 'contract', DATE '2026-05-15', 2000.00
);

-- 5. progress_snapshot · Day 7
INSERT INTO csr.progress_snapshots (
    tenant_id, project_id, schedule_id, snapshot_date,
    pv_cny, ev_cny, ac_cny,
    budget_at_completion_cny, estimate_at_completion_cny, overall_pct, generated_by
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    <schedule_id>, DATE '2026-05-07',
    159800.00, 150280.00, 163200.00,
    680000.00, 738460.00,          -- EAC = AC + (BAC-EV)/CPI
    22.10, 'llm_agent'
);
-- 自动算: CPI = 150280/163200 ≈ 0.9208 · SPI = 150280/159800 ≈ 0.9404
```

---

## 4. 维护脚本

### 4.1 基线锁定触发器 (unique partial index + 保护)

```sql
-- 禁止直接 UPDATE is_baseline = TRUE
CREATE OR REPLACE FUNCTION csr.fn_schedules_baseline_guard() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_baseline = TRUE AND NEW.is_baseline = FALSE THEN
        RAISE EXCEPTION 'baseline schedule cannot be unset · create new version instead';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_schedules_baseline_guard
BEFORE UPDATE ON csr.schedules
FOR EACH ROW EXECUTE FUNCTION csr.fn_schedules_baseline_guard();
```

### 4.2 WBS 环路检测

```sql
CREATE OR REPLACE FUNCTION csr.fn_wbs_no_cycle() RETURNS TRIGGER AS $$
DECLARE has_cycle BOOLEAN;
BEGIN
    IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
    WITH RECURSIVE walk AS (
        SELECT id, parent_id FROM csr.wbs_nodes WHERE id = NEW.parent_id
        UNION ALL
        SELECT n.id, n.parent_id FROM csr.wbs_nodes n JOIN walk w ON n.id = w.parent_id
    )
    SELECT EXISTS (SELECT 1 FROM walk WHERE id = NEW.id) INTO has_cycle;
    IF has_cycle THEN
        RAISE EXCEPTION 'WBS cycle detected · node % would create loop', NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wbs_no_cycle
BEFORE INSERT OR UPDATE OF parent_id ON csr.wbs_nodes
FOR EACH ROW EXECUTE FUNCTION csr.fn_wbs_no_cycle();
```

---

## 5. 查询样例

```sql
-- 某项目当前活动基线
SELECT * FROM csr.schedules
WHERE project_id = $1 AND is_active AND is_baseline LIMIT 1;

-- 关键路径候选(total_float = 0 的工序链)
SELECT code, name, early_start, early_finish, total_float
FROM csr.activities
WHERE schedule_id = $1 AND total_float = 0
ORDER BY early_start;

-- 最近 7 天 SPI 趋势
SELECT snapshot_date, spi, cpi, overall_pct
FROM csr.progress_snapshots
WHERE project_id = $1 AND snapshot_date >= CURRENT_DATE - 7
ORDER BY snapshot_date;

-- 待完成的工序(按 WBS 权重加权显示)
WITH wbs_w AS (
    SELECT id, weight FROM csr.wbs_nodes WHERE schedule_id = $1
)
SELECT a.code, a.name, a.pct_complete, w.weight
FROM csr.activities a JOIN wbs_w w ON w.id = a.wbs_node_id
WHERE a.schedule_id = $1 AND a.pct_complete < 100
ORDER BY w.weight DESC;
```

---

version: 0.1.0 · 2026-04-23
