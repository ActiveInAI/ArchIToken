# 09-risk_analysis · DATA-MODEL

3 张表 · 完整 DDL。

---

## 1. DDL

### 1.1 `csr.risk_entries`

```sql
CREATE TABLE IF NOT EXISTS csr.risk_entries (
    id                   UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id            UUID        NOT NULL,
    project_id           UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    risk_no              TEXT        NOT NULL,                 -- "JP-RISK-2026-0015"
    title                TEXT        NOT NULL,                 -- "雨季山洪停工"
    category             TEXT        NOT NULL
                         CHECK (category IN (
                             'weather','geological','mechanical','electrical','fire',
                             'hazmat','schedule','cost','quality','regulatory',
                             'health','fraud','supplier','political','force_majeure','other'
                         )),

    description          TEXT        NOT NULL,
    affected_activities  UUID[]      NOT NULL DEFAULT '{}',
    bim_element_guids    TEXT[]      NOT NULL DEFAULT '{}',

    -- LEC 半定量
    likelihood           SMALLINT    NOT NULL CHECK (likelihood BETWEEN 1 AND 10),
    exposure             SMALLINT    NOT NULL CHECK (exposure BETWEEN 1 AND 10),
    consequence          SMALLINT    NOT NULL CHECK (consequence BETWEEN 1 AND 100),
    lec_score            NUMERIC(8,2) GENERATED ALWAYS AS (likelihood::numeric * exposure * consequence) STORED,
    severity             TEXT        NOT NULL DEFAULT 'minor'
                         CHECK (severity IN ('negligible','minor','major','critical')),

    -- 对策
    treatment_strategy   TEXT        NOT NULL DEFAULT 'mitigate'
                         CHECK (treatment_strategy IN ('avoid','mitigate','transfer','accept')),
    controls             JSONB       NOT NULL DEFAULT '[]'::jsonb,
                         -- [{"type":"engineering","measure":"...","responsibility":"..."}]

    residual_likelihood  SMALLINT,
    residual_exposure    SMALLINT,
    residual_consequence SMALLINT,
    residual_lec         NUMERIC(8,2) GENERATED ALWAYS AS (
                             residual_likelihood::numeric * residual_exposure * residual_consequence
                         ) STORED,

    monitoring_point_ids UUID[]      NOT NULL DEFAULT '{}',
    emergency_plan_ids   UUID[]      NOT NULL DEFAULT '{}',

    owner_id             UUID        NOT NULL,                 -- 风险责任人

    status               TEXT        NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open','mitigating','monitored','closed','realized')),

    realized_at          TIMESTAMPTZ,                          -- 风险已实现(事故 · 延误 · 等)
    realized_impact      JSONB,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT re_critical_needs_monitoring CHECK (
        severity NOT IN ('critical') OR status = 'closed' OR
        array_length(monitoring_point_ids, 1) >= 1
    ),
    CONSTRAINT re_critical_needs_plan CHECK (
        severity NOT IN ('critical') OR status = 'closed' OR
        array_length(emergency_plan_ids, 1) >= 1
    )
);

COMMENT ON TABLE csr.risk_entries IS '风险登记册 · LEC 自动分级 · critical 必须监测 + 预案';

CREATE UNIQUE INDEX idx_re_no ON csr.risk_entries(tenant_id, risk_no);
CREATE INDEX idx_re_project_severity ON csr.risk_entries(project_id, severity, status);
CREATE INDEX idx_re_lec_desc ON csr.risk_entries(project_id, lec_score DESC);
CREATE INDEX idx_re_owner ON csr.risk_entries(owner_id, status);

ALTER TABLE csr.risk_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.risk_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY re_tenant ON csr.risk_entries
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.2 `csr.risk_monitoring_points`

```sql
CREATE TABLE IF NOT EXISTS csr.risk_monitoring_points (
    id                   UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id            UUID        NOT NULL,
    project_id           UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    risk_entry_id        UUID        REFERENCES csr.risk_entries(id) ON DELETE CASCADE,

    point_no             TEXT        NOT NULL,                 -- "JP-MP-2026-0008"
    name                 TEXT        NOT NULL,
    category             TEXT        NOT NULL
                         CHECK (category IN (
                             'weather','strain','tilt','displacement','gas','water_level',
                             'vibration','temperature','crowd','iot_custom'
                         )),

    location_desc        TEXT,
    gps                  GEOGRAPHY(Point, 4326),
    bim_element_guids    TEXT[],

    -- IoT 接入
    iot_device_type      TEXT,                                 -- 设备型号
    iot_device_serial    TEXT,                                 -- 设备编号
    iot_topic            TEXT,                                 -- MQTT / pgmq topic
    data_source          TEXT        NOT NULL DEFAULT 'iot'
                         CHECK (data_source IN ('iot','manual','3rd_api','weather_bureau')),
    sampling_freq_sec    INTEGER     NOT NULL DEFAULT 300,     -- 秒

    -- 阈值
    threshold_json       JSONB       NOT NULL DEFAULT '{}'::jsonb,
                         -- {"warning":{"value":50,"unit":"mm"},"alarm":{"value":80,"unit":"mm"}}

    -- 最新值缓存(实际时序数据在 TimescaleDB)
    latest_value_json    JSONB,
    latest_read_at       TIMESTAMPTZ,

    status               TEXT        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','paused','faulty','retired')),

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.risk_monitoring_points IS '监测点位 · IoT/API/人工 · 阈值触发告警';

CREATE UNIQUE INDEX idx_mp_no ON csr.risk_monitoring_points(tenant_id, point_no);
CREATE INDEX idx_mp_project_status ON csr.risk_monitoring_points(project_id, status);
CREATE INDEX idx_mp_iot_topic ON csr.risk_monitoring_points(iot_topic);
CREATE INDEX idx_mp_gps ON csr.risk_monitoring_points USING GIST (gps);

ALTER TABLE csr.risk_monitoring_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.risk_monitoring_points FORCE ROW LEVEL SECURITY;
CREATE POLICY mp_tenant ON csr.risk_monitoring_points
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.3 `csr.emergency_plans`

```sql
CREATE TABLE IF NOT EXISTS csr.emergency_plans (
    id                   UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id            UUID        NOT NULL,
    project_id           UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    risk_entry_ids       UUID[]      NOT NULL DEFAULT '{}',

    plan_no              TEXT        NOT NULL,                 -- "JP-EP-2026-0003"
    title                TEXT        NOT NULL,
    scenario             TEXT        NOT NULL,                 -- "雨季山洪"
    scope                TEXT        NOT NULL,

    trigger_conditions   JSONB       NOT NULL DEFAULT '[]'::jsonb,
                         -- [{"source":"monitoring_point","point_id":"...","threshold":"warning"}]

    procedures           JSONB       NOT NULL DEFAULT '[]'::jsonb,
                         -- [{"step":1,"action":"立即停止基坑作业","owner":"施工负责人","time_minutes":5}]

    emergency_contacts   JSONB       NOT NULL DEFAULT '[]'::jsonb,
                         -- [{"role":"120 急救","number":"120"},{"role":"当地防汛办","number":"0855-xxx"}]

    muster_point_gps     GEOGRAPHY(Point, 4326),
    muster_point_desc    TEXT,

    -- 演练
    last_drill_at        TIMESTAMPTZ,
    drill_frequency_days INTEGER     NOT NULL DEFAULT 180,    -- 每 6 个月
    next_drill_due       DATE        GENERATED ALWAYS AS (
                             (last_drill_at::date + drill_frequency_days * INTERVAL '1 day')::date
                         ) STORED,

    status               TEXT        NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','approved','active','archived')),
    approved_by          UUID,
    approved_at          TIMESTAMPTZ,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.emergency_plans IS '应急预案 · 触发条件 · 步骤 · 联系人 · 演练周期';

CREATE UNIQUE INDEX idx_ep_no ON csr.emergency_plans(tenant_id, plan_no);
CREATE INDEX idx_ep_project_status ON csr.emergency_plans(project_id, status);
CREATE INDEX idx_ep_drill_due ON csr.emergency_plans(project_id, next_drill_due) WHERE status = 'active';

ALTER TABLE csr.emergency_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.emergency_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY ep_tenant ON csr.emergency_plans
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

---

## 2. 示例 INSERT (锦屏 · 雨季风险)

```sql
-- 风险登记
INSERT INTO csr.risk_entries (
    tenant_id, project_id, risk_no, title, category, description,
    likelihood, exposure, consequence, treatment_strategy, controls, owner_id
) VALUES (
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
    'JP-RISK-2026-0015', '雨季山洪停工', 'weather',
    '5-6 月贵州雨季 · 锦屏山区暴雨易引发山洪 · 可能冲击施工现场 · 造成 1-3 日停工',
    6, 6, 15,  -- L=6 · E=6 · C=15 → LEC=540 → critical
    'mitigate',
    '[{"type":"engineering","measure":"现场排水沟 · 雨污分流","responsibility":"施工方"},
      {"type":"monitoring","measure":"气象监测 + 水位传感器","responsibility":"监理"},
      {"type":"administrative","measure":"暴雨预警立停工","responsibility":"各方"}]'::jsonb,
    '<张总监>'
);

-- 监测点位
INSERT INTO csr.risk_monitoring_points (
    tenant_id, project_id, risk_entry_id, point_no, name, category,
    iot_device_type, iot_device_serial, iot_topic, data_source, sampling_freq_sec,
    threshold_json
) VALUES (
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
    '<risk id>', 'JP-MP-2026-0008', '锦屏气象雨量监测点', 'weather',
    'ACME 雨量计 v2', 'RMT-2026-04-12', 'mqtt://architoken/iot/jp/rainfall', 'iot', 600,
    '{"warning":{"value":30,"unit":"mm/h"},"alarm":{"value":50,"unit":"mm/h"}}'::jsonb
);

-- 应急预案
INSERT INTO csr.emergency_plans (
    tenant_id, project_id, risk_entry_ids, plan_no, title, scenario, scope,
    trigger_conditions, procedures, emergency_contacts, status
) VALUES (
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
    ARRAY['<risk id>']::uuid[],
    'JP-EP-2026-0003', '雨季山洪应急预案', '雨季山洪', '全项目',
    '[{"source":"monitoring_point","point_id":"<mp id>","threshold":"alarm"},
      {"source":"weather_bureau","condition":"暴雨红色预警"}]'::jsonb,
    '[{"step":1,"action":"监测触发 · 立即广播","owner":"安全员","time_minutes":1},
      {"step":2,"action":"停止所有基坑与高处作业","owner":"施工负责人","time_minutes":5},
      {"step":3,"action":"人员集合至 A 区集合点","owner":"班组长","time_minutes":10},
      {"step":4,"action":"清点 + 上报","owner":"项目经理","time_minutes":15},
      {"step":5,"action":"持续监测 · 雨停 + 连续 2 小时低于 warning 恢复","owner":"监理","time_minutes":120}]'::jsonb,
    '[{"role":"120","number":"120"},{"role":"119","number":"119"},
      {"role":"锦屏防汛办","number":"0855-xxxxxxx"},
      {"role":"监理总监 张工","number":"138-xxxxx"}]'::jsonb,
    'draft'
);
```

---

## 3. 维护脚本

### 3.1 LEC severity 自动分级

```sql
CREATE OR REPLACE FUNCTION csr.fn_risk_auto_severity() RETURNS TRIGGER AS $$
BEGIN
    NEW.severity := CASE
        WHEN NEW.lec_score >= 160 THEN 'critical'
        WHEN NEW.lec_score >= 70  THEN 'major'
        WHEN NEW.lec_score >= 20  THEN 'minor'
        ELSE 'negligible'
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_risk_auto_severity
BEFORE INSERT OR UPDATE OF likelihood, exposure, consequence ON csr.risk_entries
FOR EACH ROW EXECUTE FUNCTION csr.fn_risk_auto_severity();
```

### 3.2 演练到期扫描

```sql
-- 每日扫描一次 · pgmq 告警
CREATE OR REPLACE FUNCTION csr.fn_drill_due_scan() RETURNS void AS $$
BEGIN
    FOR r IN SELECT id, plan_no, next_drill_due FROM csr.emergency_plans
             WHERE status='active' AND next_drill_due <= CURRENT_DATE + 7
    LOOP
        PERFORM pg_notify('csr_drill_due', json_build_object('plan_id', r.id, 'plan_no', r.plan_no, 'due', r.next_drill_due)::text);
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. 查询

```sql
-- 风险热力图(LEC 分布)
SELECT severity, count(*), AVG(lec_score)::int AS avg_lec
FROM csr.risk_entries
WHERE project_id = $1 AND status IN ('open','mitigating','monitored')
GROUP BY severity;

-- 监测点位最新状态
SELECT mp.point_no, mp.name, mp.latest_value_json, mp.latest_read_at,
       mp.threshold_json->'alarm' AS alarm_th
FROM csr.risk_monitoring_points mp
WHERE mp.project_id = $1 AND mp.status = 'active'
ORDER BY mp.latest_read_at DESC NULLS LAST;
```

---

version: 0.1.0 · 2026-04-23
