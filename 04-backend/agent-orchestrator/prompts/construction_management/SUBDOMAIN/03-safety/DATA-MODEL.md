# 03-safety · DATA-MODEL

本子域 5 张表 · 完整 DDL。

---

## 1. 表清单

| # | 表 | 业务 |
|---|---|---|
| 1 | `csr.safety_plans` | HSE 计划 |
| 2 | `csr.safety_hazards` | 隐患登记(HIRA) |
| 3 | `csr.work_permits` | 作业许可(动火/高处/受限/吊装) |
| 4 | `csr.toolbox_talks` | 班前会 · 安全交底 |
| 5 | `csr.incident_reports` | 事故 · 未遂 · 疾病 |

---

## 2. DDL

### 2.1 `csr.safety_plans`

```sql
CREATE TABLE IF NOT EXISTS csr.safety_plans (
    id               UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id        UUID        NOT NULL,
    project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    version_no       INTEGER     NOT NULL DEFAULT 1,
    title            TEXT        NOT NULL,
    major_hazards_identified JSONB NOT NULL DEFAULT '[]'::jsonb, -- 识别的危大工程清单
    applicable_standards     JSONB NOT NULL DEFAULT '[]'::jsonb,
    emergency_contact        JSONB NOT NULL DEFAULT '{}'::jsonb, -- 应急电话 · 119/120/当地安监
    muster_point_gps         GEOGRAPHY(Point, 4326),            -- 疏散集合点

    approved_by      UUID,
    approved_at      TIMESTAMPTZ,
    status           TEXT        NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','submitted','approved','archived')),

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.safety_plans IS 'HSE 计划 · 对标 ISO 45001:2018 · 危大清单嵌入';

CREATE UNIQUE INDEX idx_sp_project_version ON csr.safety_plans(tenant_id, project_id, version_no);
CREATE INDEX idx_sp_active ON csr.safety_plans(project_id) WHERE status = 'approved';

ALTER TABLE csr.safety_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.safety_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY sp_tenant ON csr.safety_plans
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.2 `csr.safety_hazards`

```sql
CREATE TABLE IF NOT EXISTS csr.safety_hazards (
    id                UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id         UUID        NOT NULL,
    project_id        UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    discovered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    discovered_by     UUID,
    source            TEXT        NOT NULL DEFAULT 'patrol'
                      CHECK (source IN ('patrol','inspection','hira_ai','whistleblower','contractor_self')),

    category          TEXT        NOT NULL
                      CHECK (category IN (
                          'fall_protection','electrical','lifting','scaffolding','formwork',
                          'excavation','confined_space','hot_work','ppe','housekeeping',
                          'fire','machinery','chemical','other'
                      )),
    severity          TEXT        NOT NULL
                      CHECK (severity IN ('minor','major','critical')),

    -- HIRA · LEC 半定量评分
    likelihood        SMALLINT,                       -- L (1-10)
    exposure          SMALLINT,                       -- E (1-10)
    consequence       SMALLINT,                       -- C (1-100)
    lec_score         NUMERIC(8,2) GENERATED ALWAYS AS (likelihood::numeric * exposure * consequence) STORED,

    location_desc     TEXT,
    gps               GEOGRAPHY(Point, 4326),
    bim_element_guids TEXT[],
    description       TEXT        NOT NULL,
    root_cause        TEXT,
    immediate_action  TEXT,
    long_term_action  TEXT,

    standards_violated JSONB      NOT NULL DEFAULT '[]'::jsonb,

    rectification_order_id UUID   REFERENCES csr.rectification_orders(id) ON DELETE SET NULL,

    status            TEXT        NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','rectifying','verifying','closed','dismissed')),

    photo_evidence_ids UUID[]     NOT NULL DEFAULT '{}',
    closed_at         TIMESTAMPTZ,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.safety_hazards IS 'HIRA 隐患登记 · LEC 三因子评分 · 可挂 A5 整改单';

CREATE INDEX idx_sh_project_open ON csr.safety_hazards(project_id, severity, status) WHERE status != 'closed';
CREATE INDEX idx_sh_gps ON csr.safety_hazards USING GIST (gps);
CREATE INDEX idx_sh_lec_high ON csr.safety_hazards(project_id, lec_score) WHERE lec_score >= 70;
CREATE INDEX idx_sh_category ON csr.safety_hazards(project_id, category);

ALTER TABLE csr.safety_hazards ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.safety_hazards FORCE ROW LEVEL SECURITY;
CREATE POLICY sh_tenant ON csr.safety_hazards
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.3 `csr.work_permits`

```sql
CREATE TABLE IF NOT EXISTS csr.work_permits (
    id               UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id        UUID        NOT NULL,
    project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    activity_id      UUID        REFERENCES csr.activities(id) ON DELETE SET NULL,

    permit_no        TEXT        NOT NULL,                -- "JP-WP-HW-2026-0032"
    permit_type      TEXT        NOT NULL
                     CHECK (permit_type IN ('hot_work','height','confined_space','lifting','excavation','electrical_switch')),
    hot_work_level   TEXT                                 -- 一级 / 二级 / 三级 · 仅 hot_work 有
                     CHECK (hot_work_level IS NULL OR hot_work_level IN ('level_1','level_2','level_3')),

    applicant        UUID        NOT NULL,
    applicant_unit   TEXT        NOT NULL,

    scope_desc       TEXT        NOT NULL,
    location_desc    TEXT        NOT NULL,
    bim_element_guids TEXT[],

    start_at         TIMESTAMPTZ NOT NULL,
    end_at           TIMESTAMPTZ NOT NULL,

    risk_controls    JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- 控制措施清单
    ppe_required     TEXT[]      NOT NULL DEFAULT '{}',          -- 必需 PPE

    supervisor_approved_by UUID,
    supervisor_approved_at TIMESTAMPTZ,
    safety_officer_approved_by UUID,
    safety_officer_approved_at TIMESTAMPTZ,

    status           TEXT        NOT NULL DEFAULT 'requested'
                     CHECK (status IN ('requested','approved','active','closed','expired','revoked')),

    actual_start_at  TIMESTAMPTZ,
    actual_end_at    TIMESTAMPTZ,
    close_remarks    TEXT,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT wp_period_valid CHECK (end_at > start_at),
    CONSTRAINT wp_dual_signoff_approved
        CHECK (status != 'approved' OR (supervisor_approved_at IS NOT NULL AND safety_officer_approved_at IS NOT NULL))
);

COMMENT ON TABLE csr.work_permits IS '作业许可 · 双签 supervisor + safety officer · 按类别枚举';

CREATE UNIQUE INDEX idx_wp_no ON csr.work_permits(tenant_id, permit_no);
CREATE INDEX idx_wp_project_active ON csr.work_permits(project_id, status) WHERE status IN ('approved','active');
CREATE INDEX idx_wp_period ON csr.work_permits(project_id, start_at, end_at);

ALTER TABLE csr.work_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.work_permits FORCE ROW LEVEL SECURITY;
CREATE POLICY wp_tenant ON csr.work_permits
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.4 `csr.toolbox_talks`

```sql
CREATE TABLE IF NOT EXISTS csr.toolbox_talks (
    id              UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id       UUID        NOT NULL,
    project_id      UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    crew_id         UUID        REFERENCES csr.crews(id) ON DELETE SET NULL,
    activity_id     UUID        REFERENCES csr.activities(id) ON DELETE SET NULL,

    held_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_min    SMALLINT    NOT NULL DEFAULT 15,

    topic           TEXT        NOT NULL,
    key_points      JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- 本次交底要点
    ppe_checklist   JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- 必戴 PPE 勾选

    related_permits UUID[]      NOT NULL DEFAULT '{}',         -- 关联作业许可
    related_hazards UUID[]      NOT NULL DEFAULT '{}',         -- 关联隐患

    attendees       JSONB       NOT NULL DEFAULT '[]'::jsonb,
                                -- [{"worker_id":"...","name":"...","signed":true,"signed_at":"..."}]

    giver_id        UUID        NOT NULL,
    level           TEXT        NOT NULL DEFAULT 'crew'
                    CHECK (level IN ('company','project','crew')),

    audio_uri       TEXT,                                        -- 可选 · 录音备份
    transcript_md   TEXT,                                        -- 自动转写
    photo_evidence_ids UUID[]   NOT NULL DEFAULT '{}',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.toolbox_talks IS '班前会 · 安全交底 · 三级(公司 · 项目 · 班组)';

CREATE INDEX idx_tbt_project_held ON csr.toolbox_talks(project_id, held_at DESC);
CREATE INDEX idx_tbt_crew ON csr.toolbox_talks(crew_id, held_at DESC);

ALTER TABLE csr.toolbox_talks ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.toolbox_talks FORCE ROW LEVEL SECURITY;
CREATE POLICY tbt_tenant ON csr.toolbox_talks
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 2.5 `csr.incident_reports`

```sql
CREATE TABLE IF NOT EXISTS csr.incident_reports (
    id                UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id         UUID        NOT NULL,
    project_id        UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    incident_at       TIMESTAMPTZ NOT NULL,
    reported_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    late_reported     BOOLEAN     GENERATED ALWAYS AS (reported_at > incident_at + INTERVAL '24 hours') STORED,

    type              TEXT        NOT NULL
                      CHECK (type IN ('incident','near_miss','occupational_illness','property_damage')),
    severity_grade    TEXT        NOT NULL
                      CHECK (severity_grade IN ('minor_injury','serious_injury','fatal','mass_injury','property_only')),

    location_desc     TEXT,
    gps               GEOGRAPHY(Point, 4326),

    involved_workers  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    involved_machinery JSONB      NOT NULL DEFAULT '[]'::jsonb,

    initial_cause     TEXT,
    description       TEXT        NOT NULL,
    immediate_action  TEXT        NOT NULL,

    reporter_id       UUID        NOT NULL,
    witnessed_by      JSONB       NOT NULL DEFAULT '[]'::jsonb,

    external_reported TEXT[]      NOT NULL DEFAULT '{}',     -- ["local_safety_bureau","hospital","police"]
    investigation_status TEXT     NOT NULL DEFAULT 'pending'
                      CHECK (investigation_status IN ('pending','investigating','closed','referred_to_authority')),

    photo_evidence_ids UUID[]     NOT NULL DEFAULT '{}',
    report_uri        TEXT,                                  -- 正式 PDF 报告

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.incident_reports IS '事故 · 未遂 · 疾病 · 财产损失 · 24h 内上报 · late_reported 自动计算';

CREATE INDEX idx_ir_project_occurred ON csr.incident_reports(project_id, incident_at DESC);
CREATE INDEX idx_ir_severity ON csr.incident_reports(severity_grade);
CREATE INDEX idx_ir_late ON csr.incident_reports(project_id) WHERE late_reported = TRUE;

ALTER TABLE csr.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.incident_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY ir_tenant ON csr.incident_reports
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

---

## 3. 示例 INSERT (锦屏 · 二层吊装作业许可)

```sql
INSERT INTO csr.work_permits (
    tenant_id, project_id, activity_id, permit_no, permit_type,
    applicant, applicant_unit, scope_desc, location_desc, bim_element_guids,
    start_at, end_at, risk_controls, ppe_required, status
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '<A1210 activity id>',
    'JP-WP-LIFT-2026-0032', 'lifting',
    '<foreman user id>', '贵州某钢构公司',
    '二层 B×5 ~ B×7 三根主梁吊装', '东区塔吊覆盖范围',
    ARRAY['2A3K9XYZABCDEF12367','2A3K9XYZABCDEF12368','2A3K9XYZABCDEF12369'],
    TIMESTAMPTZ '2026-05-19 09:30:00+08', TIMESTAMPTZ '2026-05-19 11:30:00+08',
    '[{"control":"起重机年检在期","verified":true},
      {"control":"风速 ≤ 6 级","verified_each_hour":true},
      {"control":"吊装区域警戒","verified":true},
      {"control":"信号工持证","verified":true}]'::jsonb,
    ARRAY['安全帽','安全带','反光衣','钢头鞋','防护手套'],
    'requested'
);
```

---

## 4. 维护脚本

### 4.1 高 LEC 自动 critical

```sql
CREATE OR REPLACE FUNCTION csr.fn_hazard_auto_severity() RETURNS TRIGGER AS $$
BEGIN
    -- GB/T 33859 分级参考 · lec >= 160 · critical · 70~159 · major · 20~69 · minor
    IF NEW.lec_score IS NOT NULL THEN
        NEW.severity := CASE
            WHEN NEW.lec_score >= 160 THEN 'critical'
            WHEN NEW.lec_score >= 70  THEN 'major'
            ELSE 'minor'
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_hazard_auto_severity
BEFORE INSERT OR UPDATE OF lec_score ON csr.safety_hazards
FOR EACH ROW EXECUTE FUNCTION csr.fn_hazard_auto_severity();
```

### 4.2 作业许可过期自动 expired

```sql
CREATE OR REPLACE FUNCTION csr.fn_wp_auto_expire() RETURNS void AS $$
BEGIN
    UPDATE csr.work_permits
    SET status = 'expired', updated_at = now()
    WHERE status IN ('approved','active') AND end_at < now();
END;
$$ LANGUAGE plpgsql;

-- 每 10 分钟由 pg_cron 调
```

---

## 5. 查询样例

```sql
-- 今日活动作业许可
SELECT permit_no, permit_type, scope_desc, start_at, end_at, status
FROM csr.work_permits
WHERE project_id = $1
  AND tstzrange(start_at, end_at, '[]') && tstzrange(now()::date, now()::date + 1)
  AND status IN ('approved','active')
ORDER BY start_at;

-- 高 LEC 未闭环隐患
SELECT id, category, lec_score, description
FROM csr.safety_hazards
WHERE project_id = $1 AND lec_score >= 70 AND status != 'closed'
ORDER BY lec_score DESC;

-- 本月未遂事件(Heinrich 金字塔分析)
SELECT date_trunc('week', incident_at) AS week,
       type, severity_grade, count(*)
FROM csr.incident_reports
WHERE project_id = $1 AND incident_at >= now() - INTERVAL '30 days'
GROUP BY 1, type, severity_grade
ORDER BY 1, type;
```

---

version: 0.1.0 · 2026-04-23
