# 10-bim_integration · DATA-MODEL

4 张表 · 完整 DDL。

---

## 1. DDL

### 1.1 `csr.bim_models`

```sql
CREATE TABLE IF NOT EXISTS csr.bim_models (
    id                  UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id           UUID        NOT NULL,
    project_id          UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    model_no            TEXT        NOT NULL,                 -- "JP-BIM-v1"
    version_no          INTEGER     NOT NULL,
    origin              TEXT        NOT NULL DEFAULT 'detailed_design'
                        CHECK (origin IN ('detailed_design','contractor','as_built','clash_fix')),

    ifc_version         TEXT        NOT NULL DEFAULT 'IFC4.3'
                        CHECK (ifc_version IN ('IFC2X3','IFC4','IFC4.1','IFC4.3','IFCX')),
    ifc_uri             TEXT        NOT NULL,
    ifc_sha256          CHAR(64)    NOT NULL,
    ifc_size_mb         NUMERIC(10,2),

    lod_aia             TEXT        CHECK (lod_aia IN ('100','200','300','350','400','500')),
    lod_gb              TEXT        CHECK (lod_gb  IN ('P1','P2','P3','P4')),

    elements_count      INTEGER,
    storey_count        SMALLINT,

    -- CDE 状态(ISO 19650)
    cde_state           TEXT        NOT NULL DEFAULT 'WIP'
                        CHECK (cde_state IN ('WIP','Shared','Published','Archive')),

    status              TEXT        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','active','superseded','archived')),

    published_at        TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.bim_models IS 'BIM 模型版本 · 镜像自 detailed_design · 含 CDE 状态';

CREATE UNIQUE INDEX idx_bm_project_version ON csr.bim_models(tenant_id, project_id, version_no);
CREATE UNIQUE INDEX idx_bm_one_active
    ON csr.bim_models(tenant_id, project_id)
    WHERE status = 'active';
CREATE INDEX idx_bm_cde ON csr.bim_models(project_id, cde_state);

ALTER TABLE csr.bim_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.bim_models FORCE ROW LEVEL SECURITY;
CREATE POLICY bm_tenant ON csr.bim_models
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.2 `csr.clash_reports`

```sql
CREATE TABLE IF NOT EXISTS csr.clash_reports (
    id                  UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id           UUID        NOT NULL,
    project_id          UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    bim_model_id        UUID        NOT NULL REFERENCES csr.bim_models(id) ON DELETE CASCADE,

    report_no           TEXT        NOT NULL,                 -- "JP-CLASH-2026-0012"
    clash_type          TEXT        NOT NULL
                        CHECK (clash_type IN ('hard','soft','clearance','workflow')),
    element_a_guid      TEXT        NOT NULL,
    element_b_guid      TEXT        NOT NULL,
    element_a_type      TEXT,                                 -- IfcBeam / IfcColumn 等
    element_b_type      TEXT,

    intersection_volume_m3 NUMERIC(12,4),
    min_distance_mm     NUMERIC(10,2),

    severity            TEXT        NOT NULL DEFAULT 'major'
                        CHECK (severity IN ('must_fix','major','minor','observation')),
    discipline_a        TEXT,                                 -- architectural / structural / mep
    discipline_b        TEXT,

    description         TEXT,
    suggested_action    TEXT,

    triage_by_llm       BOOLEAN     NOT NULL DEFAULT FALSE,
    triage_confidence   NUMERIC(4,3),

    status              TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','acknowledged','fixing','resolved','accepted_as_is','duplicate')),
    resolved_in_model_id UUID       REFERENCES csr.bim_models(id) ON DELETE SET NULL,
    resolved_at         TIMESTAMPTZ,

    screenshot_uri      TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT cr_hard_must_resolve CHECK (
        clash_type != 'hard' OR status IN ('resolved','accepted_as_is','duplicate')
    )
);

COMMENT ON TABLE csr.clash_reports IS '碰撞报告 · hard clash 未解决阻施工(CHECK)';

CREATE UNIQUE INDEX idx_cr_no ON csr.clash_reports(tenant_id, report_no);
CREATE INDEX idx_cr_project_status ON csr.clash_reports(project_id, status);
CREATE INDEX idx_cr_element_a ON csr.clash_reports(element_a_guid);
CREATE INDEX idx_cr_element_b ON csr.clash_reports(element_b_guid);

ALTER TABLE csr.clash_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.clash_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY cr_tenant ON csr.clash_reports
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.3 `csr.bim_to_wbs_links`

```sql
CREATE TABLE IF NOT EXISTS csr.bim_to_wbs_links (
    id                UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id         UUID        NOT NULL,
    project_id        UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    bim_model_id      UUID        NOT NULL REFERENCES csr.bim_models(id) ON DELETE CASCADE,

    bim_element_guid  TEXT        NOT NULL,
    activity_id       UUID        NOT NULL REFERENCES csr.activities(id) ON DELETE CASCADE,

    link_type         TEXT        NOT NULL DEFAULT 'installation'
                      CHECK (link_type IN ('installation','demolition','rework','inspection')),

    weight            NUMERIC(6,4) DEFAULT 1.0,                -- 单元素被多工序分摊权重
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT bwl_unique UNIQUE (tenant_id, bim_model_id, bim_element_guid, activity_id, link_type)
);

COMMENT ON TABLE csr.bim_to_wbs_links IS '4D 链接 · BIM 元素 → activity';

CREATE INDEX idx_bwl_model_guid ON csr.bim_to_wbs_links(bim_model_id, bim_element_guid);
CREATE INDEX idx_bwl_activity ON csr.bim_to_wbs_links(activity_id);

ALTER TABLE csr.bim_to_wbs_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.bim_to_wbs_links FORCE ROW LEVEL SECURITY;
CREATE POLICY bwl_tenant ON csr.bim_to_wbs_links
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.4 `csr.bim_to_boq_links`

```sql
CREATE TABLE IF NOT EXISTS csr.bim_to_boq_links (
    id                UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id         UUID        NOT NULL,
    project_id        UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    bim_model_id      UUID        NOT NULL REFERENCES csr.bim_models(id) ON DELETE CASCADE,

    bim_element_guid  TEXT        NOT NULL,
    boq_item_id       UUID        NOT NULL,                   -- FK 到 qc.boq_items (quantity_costing 模块)
    boq_item_code     TEXT,                                   -- 冗余便查

    quantity_json     JSONB       NOT NULL DEFAULT '{}'::jsonb,
                                   -- {"value":0.056,"unit":"m3"} 元素分摊的 BOQ 量

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT bbl_unique UNIQUE (tenant_id, bim_model_id, bim_element_guid, boq_item_id)
);

COMMENT ON TABLE csr.bim_to_boq_links IS '5D 链接 · BIM 元素 → BOQ 条目 · 量自动分摊';

CREATE INDEX idx_bbl_model_guid ON csr.bim_to_boq_links(bim_model_id, bim_element_guid);
CREATE INDEX idx_bbl_boq ON csr.bim_to_boq_links(boq_item_id);

ALTER TABLE csr.bim_to_boq_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.bim_to_boq_links FORCE ROW LEVEL SECURITY;
CREATE POLICY bbl_tenant ON csr.bim_to_boq_links
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

---

## 2. 示例 INSERT (锦屏 · IFC + 碰撞)

```sql
INSERT INTO csr.bim_models (
    tenant_id, project_id, model_no, version_no, origin, ifc_version,
    ifc_uri, ifc_sha256, ifc_size_mb, lod_aia, lod_gb,
    elements_count, storey_count, cde_state, status
) VALUES (
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
    'JP-BIM-v1', 1, 'detailed_design', 'IFC4.3',
    's3://architoken/projects/jp/bim/v1.ifc',
    'ab12cd34...(64 hex)...',
    85.40, '350', 'P4',
    1842, 3, 'Shared', 'active'
);

INSERT INTO csr.clash_reports (
    tenant_id, project_id, bim_model_id, report_no, clash_type,
    element_a_guid, element_b_guid, element_a_type, element_b_type,
    intersection_volume_m3, severity, discipline_a, discipline_b,
    description, suggested_action, triage_by_llm, triage_confidence, status
) VALUES (
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
    '<bim_model id>', 'JP-CLASH-2026-0012', 'hard',
    '2A3K9XYZABCDEF12367','2A3K9XYZPIPEX00012',
    'IfcBeam','IfcPipeSegment',
    0.0023, 'must_fix', 'structural','mep',
    '二层 B×5 主梁与给水管 DN80 实体相交 · 位置 x=12.5 y=3.2 z=4.1',
    '管道改走梁下 · 或调整梁开洞(需结构校核)',
    TRUE, 0.96, 'open'
);
```

---

## 3. 维护脚本

### 3.1 hard clash 阻施工

```sql
-- 应用层 trigger · 当 activity 切换到 'in_progress' · 校验关联构件无 hard clash open
CREATE OR REPLACE FUNCTION csr.fn_activity_start_clash_check() RETURNS TRIGGER AS $$
DECLARE cnt int;
BEGIN
    IF NEW.actual_start IS NOT NULL AND OLD.actual_start IS NULL THEN
        SELECT count(*) INTO cnt
        FROM csr.clash_reports c
        JOIN csr.bim_to_wbs_links l
          ON (l.bim_element_guid = c.element_a_guid OR l.bim_element_guid = c.element_b_guid)
         AND l.activity_id = NEW.id
        WHERE c.status = 'open' AND c.clash_type = 'hard';

        IF cnt > 0 THEN
            RAISE EXCEPTION 'Cannot start activity · % open hard clashes remain', cnt;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_activity_start_clash
BEFORE UPDATE OF actual_start ON csr.activities
FOR EACH ROW EXECUTE FUNCTION csr.fn_activity_start_clash_check();
```

---

## 4. 查询

```sql
-- 当前 active 模型
SELECT * FROM csr.bim_models
WHERE project_id = $1 AND status = 'active';

-- 未解决 hard clashes
SELECT report_no, element_a_type, element_b_type, suggested_action
FROM csr.clash_reports
WHERE project_id = $1 AND clash_type = 'hard' AND status = 'open';

-- 某 activity 关联所有 BIM 构件
SELECT bim_element_guid, link_type
FROM csr.bim_to_wbs_links
WHERE activity_id = $1;
```

---

version: 0.1.0 · 2026-04-23
