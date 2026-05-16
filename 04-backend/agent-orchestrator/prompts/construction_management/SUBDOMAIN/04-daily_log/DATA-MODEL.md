# 04-daily_log · DATA-MODEL

5 张表 · 完整 DDL。

---

## 1. 表清单

| # | 表 | GB/T 50319 表号 |
|---|---|---|
| 1 | `csr.supervision_logs` | A.0.16 |
| 2 | `csr.monitoring_posts` | A.0.10 |
| 3 | `csr.patrol_records` | A.0.11 |
| 4 | `csr.parallel_inspections` | A.0.14 |
| 5 | `csr.meeting_minutes` | (无对应 · 参考 GB/T 50326) |

---

## 2. DDL

### 2.1 `csr.supervision_logs`

```sql
CREATE TABLE IF NOT EXISTS csr.supervision_logs (
    id                    UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id             UUID        NOT NULL,
    project_id            UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    log_date              DATE        NOT NULL,
    weather               JSONB       NOT NULL DEFAULT '{}'::jsonb,
                                      -- {"am":{"weather":"多云","temp_c":22,"wind":"3 级"},"pm":{...}}

    body                  TEXT        NOT NULL,                -- 结构化日志主体(markdown)
    summary_auto          TEXT,                                -- LLM 汇总的 TL;DR

    patrol_count          INTEGER     NOT NULL DEFAULT 0,
    monitoring_post_count INTEGER     NOT NULL DEFAULT 0,
    parallel_inspection_count INTEGER NOT NULL DEFAULT 0,

    key_events            JSONB       NOT NULL DEFAULT '[]'::jsonb,
                                      -- 跨子域事件汇总 · 同一结构
                                      -- [{"time":"10:15","subdomain":"02-quality","event":"发现焊缝UT不合格","ref_id":"..."}]

    rectification_issued  INTEGER     NOT NULL DEFAULT 0,      -- 当日开出的整改数
    rectification_closed  INTEGER     NOT NULL DEFAULT 0,      -- 当日闭环的整改数

    signed_by             UUID,
    signed_at             TIMESTAMPTZ,

    created_by            UUID,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT logs_one_per_day UNIQUE (tenant_id, project_id, log_date)
);

COMMENT ON TABLE csr.supervision_logs IS '监理日志 · 每项目每日 1 条 · GB/T 50319-2013 表 A.0.16';

CREATE INDEX idx_logs_project_date ON csr.supervision_logs(project_id, log_date DESC);
CREATE INDEX idx_logs_unsigned ON csr.supervision_logs(project_id) WHERE signed_at IS NULL;
CREATE INDEX idx_logs_fts ON csr.supervision_logs USING GIN (to_tsvector('simple', body));

ALTER TABLE csr.supervision_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.supervision_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY logs_tenant ON csr.supervision_logs
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.2 `csr.monitoring_posts`

```sql
CREATE TABLE IF NOT EXISTS csr.monitoring_posts (
    id                UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id         UUID        NOT NULL,
    project_id        UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    activity_id       UUID        NOT NULL REFERENCES csr.activities(id) ON DELETE RESTRICT,

    start_at          TIMESTAMPTZ NOT NULL,
    end_at            TIMESTAMPTZ,

    supervisor_id     UUID        NOT NULL,
    location_desc     TEXT        NOT NULL,
    bim_element_guids TEXT[],

    content           TEXT        NOT NULL,                    -- 旁站过程描述
    findings          TEXT,                                    -- 发现的问题 · 若有
    actions_taken     TEXT,                                    -- 监理口头指令 / A5 · 若有

    related_defect_ids       UUID[]  NOT NULL DEFAULT '{}',
    related_rectification_ids UUID[] NOT NULL DEFAULT '{}',
    photo_evidence_ids       UUID[]  NOT NULL DEFAULT '{}',

    signed_by         UUID,
    signed_at         TIMESTAMPTZ,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT mp_period CHECK (end_at IS NULL OR end_at >= start_at)
);

COMMENT ON TABLE csr.monitoring_posts IS '旁站记录 · 关键工序全过程 · GB/T 50319-2013 表 A.0.10';

CREATE INDEX idx_mp_project_start ON csr.monitoring_posts(project_id, start_at DESC);
CREATE INDEX idx_mp_activity ON csr.monitoring_posts(activity_id, start_at DESC);

ALTER TABLE csr.monitoring_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.monitoring_posts FORCE ROW LEVEL SECURITY;
CREATE POLICY mp_tenant ON csr.monitoring_posts
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.3 `csr.patrol_records`

```sql
CREATE TABLE IF NOT EXISTS csr.patrol_records (
    id               UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id        UUID        NOT NULL,
    project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    supervisor_id    UUID        NOT NULL,
    start_at         TIMESTAMPTZ NOT NULL,
    end_at           TIMESTAMPTZ,

    route            JSONB       NOT NULL DEFAULT '[]'::jsonb,
                                 -- [{"location":"一层 A-B 轴","gps":{...},"time":"..."}]
    focus_items      JSONB       NOT NULL DEFAULT '[]'::jsonb,
                                 -- 本次巡视关注点 · "焊缝质量" · "临边防护"

    findings_summary TEXT,
    photo_evidence_ids UUID[]    NOT NULL DEFAULT '{}',
    gps_trace        GEOGRAPHY(LineString, 4326),

    related_hazard_ids UUID[]    NOT NULL DEFAULT '{}',
    related_defect_ids UUID[]    NOT NULL DEFAULT '{}',

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT pr_evidence_required
        CHECK ((array_length(photo_evidence_ids, 1) >= 2) OR gps_trace IS NOT NULL)
);

COMMENT ON TABLE csr.patrol_records IS '巡视记录 · GB/T 50319-2013 表 A.0.11 · 至少 GPS 轨迹或 2 张照片';

CREATE INDEX idx_pr_project_start ON csr.patrol_records(project_id, start_at DESC);
CREATE INDEX idx_pr_supervisor ON csr.patrol_records(supervisor_id, start_at DESC);
CREATE INDEX idx_pr_gps ON csr.patrol_records USING GIST (gps_trace);

ALTER TABLE csr.patrol_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.patrol_records FORCE ROW LEVEL SECURITY;
CREATE POLICY pr_tenant ON csr.patrol_records
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.4 `csr.parallel_inspections`

```sql
CREATE TABLE IF NOT EXISTS csr.parallel_inspections (
    id                UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id         UUID        NOT NULL,
    project_id        UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    inspection_lot_id UUID        REFERENCES csr.inspection_lots(id) ON DELETE SET NULL,

    date              DATE        NOT NULL DEFAULT CURRENT_DATE,
    supervisor_id     UUID        NOT NULL,

    scope             TEXT        NOT NULL,                 -- "钢筋保护层厚度 平行检验 · 二层楼板"
    sampling_method   TEXT        NOT NULL,
    sample_size       INTEGER     NOT NULL,
    pass_count        INTEGER     NOT NULL DEFAULT 0,

    measurements      JSONB       NOT NULL DEFAULT '[]'::jsonb,
                                  -- [{"sample":"#1","location":"...","value":22,"spec":"20±5","verdict":"pass"}]

    verdict           TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (verdict IN ('pending','pass','fail','partial')),

    standards_used    JSONB       NOT NULL DEFAULT '[]'::jsonb,
    attached_report_uri TEXT,
    photo_evidence_ids UUID[]    NOT NULL DEFAULT '{}',

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.parallel_inspections IS '平行检验记录 · GB/T 50319-2013 表 A.0.14';

CREATE INDEX idx_pi_project_date ON csr.parallel_inspections(project_id, date DESC);
CREATE INDEX idx_pi_lot ON csr.parallel_inspections(inspection_lot_id);

ALTER TABLE csr.parallel_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.parallel_inspections FORCE ROW LEVEL SECURITY;
CREATE POLICY pi_tenant ON csr.parallel_inspections
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.5 `csr.meeting_minutes`

```sql
CREATE TABLE IF NOT EXISTS csr.meeting_minutes (
    id               UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id        UUID        NOT NULL,
    project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    meeting_type     TEXT        NOT NULL
                     CHECK (meeting_type IN (
                         'first_meeting',    -- 第一次工地例会 (监理规范要求)
                         'regular_weekly',   -- 每周监理例会
                         'monthly',
                         'topic',            -- 专题会
                         'change_review',    -- 变更评审
                         'safety_review'
                     )),
    held_at          TIMESTAMPTZ NOT NULL,
    duration_min     SMALLINT,

    chair_unit       TEXT        NOT NULL,                -- 主持单位
    venue            TEXT,

    attendees        JSONB       NOT NULL DEFAULT '[]'::jsonb,
                                 -- [{"unit":"监理","name":"张工","signed":true}, ...]
    absentees        JSONB       NOT NULL DEFAULT '[]'::jsonb,

    agenda           JSONB       NOT NULL DEFAULT '[]'::jsonb,
    decisions        JSONB       NOT NULL DEFAULT '[]'::jsonb,
                                 -- [{"topic":"...","decision":"...","owner":"...","due":"..."}]
    action_items     JSONB       NOT NULL DEFAULT '[]'::jsonb,

    audio_uri        TEXT,
    transcript_md    TEXT,                                -- 录音转写
    minutes_uri      TEXT,                                -- 正式纪要 PDF

    status           TEXT        NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','circulated','approved','archived')),

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.meeting_minutes IS '例会纪要 · GB/T 50319-2013 §5.7 · 五方应到必记';

CREATE INDEX idx_mm_project_held ON csr.meeting_minutes(project_id, held_at DESC);
CREATE INDEX idx_mm_type ON csr.meeting_minutes(meeting_type, held_at DESC);

ALTER TABLE csr.meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.meeting_minutes FORCE ROW LEVEL SECURITY;
CREATE POLICY mm_tenant ON csr.meeting_minutes
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

---

## 3. 示例 INSERT (锦屏 · Day 7 · 5/19 全天)

```sql
-- 巡视 3 次
INSERT INTO csr.patrol_records (tenant_id, project_id, supervisor_id, start_at, end_at, route, focus_items, findings_summary, photo_evidence_ids)
VALUES
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','<张工 uid>',
 '2026-05-19 08:30','2026-05-19 09:00',
 '[{"location":"东区基础","time":"08:35"},{"location":"塔吊站位","time":"08:45"}]'::jsonb,
 '["焊缝","临边防护"]'::jsonb,
 '东区基础防水薄膜完整 · 塔吊限位正常 · 无隐患', ARRAY['<photo 1>','<photo 2>','<photo 3>']::uuid[]);

-- 旁站 1 次 · 二层钢柱焊接
INSERT INTO csr.monitoring_posts (tenant_id, project_id, activity_id, start_at, end_at, supervisor_id, location_desc, content, findings)
VALUES
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','<A1210>',
 '2026-05-19 07:00','2026-05-19 09:30',
 '<张工>','二层 A 轴 × 3 轴 节点焊接',
 '全程旁站 · 焊工 张某某 持证 · 焊材 E50 牌号 · 电流 220A · 层间温度控制良好',
 '无异常');

-- 平行检验 1 次 · UT 见证
INSERT INTO csr.parallel_inspections (tenant_id, project_id, inspection_lot_id, supervisor_id, scope, sampling_method, sample_size, pass_count, measurements, verdict, standards_used)
VALUES
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','<lot id>','<张工>',
 '二层钢柱焊缝 W-208 UT 抽检','GB/T 11345-2013 抽样',3,2,
 '[{"sample":"W-208","value":"8mm 夹渣","spec":"≤ 5mm","verdict":"fail"}]'::jsonb,
 'fail',
 '["GB 50205-2020 §7.2.4","GB/T 11345-2013"]'::jsonb);

-- 汇总日志
INSERT INTO csr.supervision_logs (tenant_id, project_id, log_date, weather, body, summary_auto, patrol_count, monitoring_post_count, parallel_inspection_count, key_events, rectification_issued, rectification_closed)
VALUES
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
 '2026-05-19',
 '{"am":{"weather":"晴","temp_c":19,"wind":"3 级"},"pm":{"weather":"多云","temp_c":25,"wind":"3 级"}}'::jsonb,
 E'# Day 7 监理日志\n\n## 巡视\n- 08:30-09:00 · 3 个点\n\n## 旁站\n- 07:00-09:30 · A1210 二层钢柱焊接\n\n## 平行检验\n- UT 抽检 W-208 不合格\n\n## 整改\n- 签发 JP-RO-2026-0017 · 14:30 闭环',
 '今日巡视 3 次 · 旁站 1 次(二层钢柱焊接)· UT 发现 W-208 夹渣 · A5 签发并 4.5h 内闭环。',
 3, 1, 1,
 '[{"time":"10:15","subdomain":"02-quality","event":"UT 不合格","ref_id":"<defect>"},
   {"time":"10:25","subdomain":"02-quality","event":"签发 A5 JP-RO-2026-0017","ref_id":"<ro>"},
   {"time":"14:30","subdomain":"02-quality","event":"整改闭环","ref_id":"<ro>"}]'::jsonb,
 1, 1);
```

---

## 4. 查询样例

```sql
-- 最近 7 天日志(汇总视图)
SELECT log_date, patrol_count, monitoring_post_count, rectification_issued, rectification_closed, signed_at IS NOT NULL AS signed
FROM csr.supervision_logs
WHERE project_id = $1 AND log_date >= CURRENT_DATE - 7
ORDER BY log_date DESC;

-- 今日所有旁站
SELECT m.*, a.name AS activity_name
FROM csr.monitoring_posts m JOIN csr.activities a ON m.activity_id = a.id
WHERE m.project_id = $1 AND DATE(m.start_at) = CURRENT_DATE
ORDER BY m.start_at;

-- 本月月报输入(汇总所有 5 类记录)
SELECT
    log_date, patrol_count, monitoring_post_count, parallel_inspection_count,
    rectification_issued, rectification_closed, signed_at IS NOT NULL AS signed
FROM csr.supervision_logs
WHERE project_id = $1 AND log_date >= date_trunc('month', now())
ORDER BY log_date;

-- 未签日志 reminders
SELECT log_date, created_at, (now() - created_at) AS age
FROM csr.supervision_logs
WHERE project_id = $1 AND signed_at IS NULL
ORDER BY log_date;
```

---

version: 0.1.0 · 2026-04-23
