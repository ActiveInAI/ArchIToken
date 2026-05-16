# 12-change_order · DATA-MODEL

5 张表 · 完整 DDL。

---

## 1. DDL

### 1.1 `csr.engineering_changes`

```sql
CREATE TABLE IF NOT EXISTS csr.engineering_changes (
    id                   UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id            UUID        NOT NULL,
    project_id           UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    rfc_no               TEXT        NOT NULL,                 -- "JP-RFC-2026-0019"
    title                TEXT        NOT NULL,
    initiator            TEXT        NOT NULL
                         CHECK (initiator IN ('owner','contractor','supervisor','designer','regulator')),
    initiator_user_id    UUID        NOT NULL,
    reason_category      TEXT        NOT NULL
                         CHECK (reason_category IN (
                             'design_error','design_improvement','site_condition',
                             'owner_request','regulatory','force_majeure','cost_optimization','other'
                         )),
    description          TEXT        NOT NULL,

    affected_sub_parts   UUID[]      NOT NULL DEFAULT '{}',
    affected_activities  UUID[]      NOT NULL DEFAULT '{}',
    bim_element_guids    TEXT[]      NOT NULL DEFAULT '{}',
    affected_boq_items   UUID[]      NOT NULL DEFAULT '{}',

    impact_cost_cny      NUMERIC(18,2) DEFAULT 0,
    impact_schedule_days NUMERIC(8,2) DEFAULT 0,
    impact_description   TEXT,

    attached_uri         TEXT,                                 -- 变更图 / 说明书
    attached_sha256      CHAR(64),

    status               TEXT        NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','reviewing','approved','rejected','executed','closed','cancelled')),

    reviewed_by_supervisor_id UUID,
    reviewed_by_supervisor_at TIMESTAMPTZ,
    approved_by_designer_id   UUID,
    approved_by_designer_at   TIMESTAMPTZ,
    approved_by_owner_id      UUID,
    approved_by_owner_at      TIMESTAMPTZ,

    executed_at          TIMESTAMPTZ,
    closed_at            TIMESTAMPTZ,

    linked_certification_id UUID,
    linked_claim_id      UUID,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ec_approved_needs_owner CHECK (
        status != 'approved' OR approved_by_owner_at IS NOT NULL
    )
);

COMMENT ON TABLE csr.engineering_changes IS '设计变更 RFC · 必须 owner 签方可 approved';

CREATE UNIQUE INDEX idx_ec_no ON csr.engineering_changes(tenant_id, rfc_no);
CREATE INDEX idx_ec_project_status ON csr.engineering_changes(project_id, status);
CREATE INDEX idx_ec_impact_cost ON csr.engineering_changes(project_id, impact_cost_cny DESC);

ALTER TABLE csr.engineering_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.engineering_changes FORCE ROW LEVEL SECURITY;
CREATE POLICY ec_tenant ON csr.engineering_changes
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.2 `csr.site_consultations`

```sql
CREATE TABLE IF NOT EXISTS csr.site_consultations (
    id                UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id         UUID        NOT NULL,
    project_id        UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    consultation_no   TEXT        NOT NULL,                   -- "JP-SC-2026-0033"
    consulted_at      TIMESTAMPTZ NOT NULL,
    consulted_by      UUID        NOT NULL,                   -- 现场发起方

    scope             TEXT        NOT NULL,
    description       TEXT        NOT NULL,
    bim_element_guids TEXT[],

    -- 洽商不涉及设计变更 · 仅小范围调整
    impact_cost_cny   NUMERIC(18,2) DEFAULT 0,
    impact_schedule_days NUMERIC(8,2) DEFAULT 0,

    status            TEXT        NOT NULL DEFAULT 'proposed'
                      CHECK (status IN ('proposed','agreed','rejected','implemented')),

    supervisor_agreed_at TIMESTAMPTZ,
    owner_agreed_at   TIMESTAMPTZ,                            -- 大额(> ¥10,000)需业主
    contractor_agreed_at TIMESTAMPTZ,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- 大额洽商必须业主同意
    CONSTRAINT sc_large_needs_owner CHECK (
        status != 'agreed' OR impact_cost_cny <= 10000 OR owner_agreed_at IS NOT NULL
    )
);

COMMENT ON TABLE csr.site_consultations IS '工程洽商 · 小范围调整 · 不涉及设计图变更';

CREATE UNIQUE INDEX idx_sc_no ON csr.site_consultations(tenant_id, consultation_no);
CREATE INDEX idx_sc_project ON csr.site_consultations(project_id, consulted_at DESC);

ALTER TABLE csr.site_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.site_consultations FORCE ROW LEVEL SECURITY;
CREATE POLICY sc_tenant ON csr.site_consultations
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.3 `csr.claims`

```sql
CREATE TABLE IF NOT EXISTS csr.claims (
    id                   UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id            UUID        NOT NULL,
    project_id           UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    claim_no             TEXT        NOT NULL,                 -- "JP-CLM-2026-0002"
    claimant             TEXT        NOT NULL
                         CHECK (claimant IN ('owner','contractor')),
    claim_type           TEXT        NOT NULL
                         CHECK (claim_type IN ('cost','time_extension','both','delay_damages','defect_damages')),

    incident_at          TIMESTAMPTZ NOT NULL,                 -- 索赔事件发生时
    notice_given_at      TIMESTAMPTZ NOT NULL,                 -- 通知对方时(28 天内)
    submitted_at         TIMESTAMPTZ,                          -- 详细资料提交(42 天)

    amount_claimed_cny   NUMERIC(18,2),
    days_claimed         NUMERIC(8,2),

    basis_contract_clause TEXT,                                -- 合同条款
    basis_description    TEXT        NOT NULL,
    evidence_refs        JSONB       NOT NULL DEFAULT '[]'::jsonb,

    -- 时效性
    within_notice_period BOOLEAN     GENERATED ALWAYS AS (
        notice_given_at <= incident_at + INTERVAL '28 days'
    ) STORED,

    -- 裁定
    status               TEXT        NOT NULL DEFAULT 'notified'
                         CHECK (status IN ('notified','submitted','under_review','partial_granted','granted','rejected','settled')),
    supervisor_recommendation JSONB,                           -- 监理裁定建议
    owner_decision       JSONB,

    granted_amount_cny   NUMERIC(18,2),
    granted_days         NUMERIC(8,2),

    settled_at           TIMESTAMPTZ,
    settlement_method    TEXT                                  -- 直接给 / 抵扣 / 仲裁
                         CHECK (settlement_method IS NULL OR settlement_method IN ('direct','offset','arbitration','litigation')),

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.claims IS '索赔 · 28 天通知期(FIDIC §20)· within_notice_period 自动计算';

CREATE UNIQUE INDEX idx_cl_no ON csr.claims(tenant_id, claim_no);
CREATE INDEX idx_cl_project_status ON csr.claims(project_id, status);
CREATE INDEX idx_cl_late ON csr.claims(project_id) WHERE within_notice_period = FALSE;

ALTER TABLE csr.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.claims FORCE ROW LEVEL SECURITY;
CREATE POLICY cl_tenant ON csr.claims
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.4 `csr.certifications`

```sql
CREATE TABLE IF NOT EXISTS csr.certifications (
    id                   UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id            UUID        NOT NULL,
    project_id           UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    cert_no              TEXT        NOT NULL,                 -- "JP-CRT-2026-0028"
    cert_type            TEXT        NOT NULL
                         CHECK (cert_type IN (
                             'quantity_adjustment','additional_work','material_change',
                             'time_extension','rate_adjustment','force_majeure_waiver','other'
                         )),

    issued_at            TIMESTAMPTZ NOT NULL,
    scope                TEXT        NOT NULL,
    description          TEXT        NOT NULL,
    amount_cny           NUMERIC(18,2) DEFAULT 0,
    days                 NUMERIC(8,2) DEFAULT 0,

    linked_rfc_id        UUID        REFERENCES csr.engineering_changes(id) ON DELETE SET NULL,
    linked_claim_id      UUID        REFERENCES csr.claims(id) ON DELETE SET NULL,
    linked_consultation_id UUID      REFERENCES csr.site_consultations(id) ON DELETE SET NULL,

    signed_by_owner_at      TIMESTAMPTZ,
    signed_by_contractor_at TIMESTAMPTZ,
    signed_by_supervisor_at TIMESTAMPTZ,

    status               TEXT        NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','pending','signed','paid','contested')),

    attachment_uri       TEXT,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- > ¥50,000 三方签
    CONSTRAINT crt_large_three_sigs CHECK (
        status != 'signed' OR amount_cny <= 50000 OR
        (signed_by_owner_at IS NOT NULL AND signed_by_contractor_at IS NOT NULL AND signed_by_supervisor_at IS NOT NULL)
    )
);

COMMENT ON TABLE csr.certifications IS '签证 · cost > 5 万 必三方签';

CREATE UNIQUE INDEX idx_crt_no ON csr.certifications(tenant_id, cert_no);
CREATE INDEX idx_crt_project_type ON csr.certifications(project_id, cert_type);

ALTER TABLE csr.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.certifications FORCE ROW LEVEL SECURITY;
CREATE POLICY crt_tenant ON csr.certifications
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 1.5 `csr.change_impact_assessments`

```sql
CREATE TABLE IF NOT EXISTS csr.change_impact_assessments (
    id                   UUID        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id            UUID        NOT NULL,
    project_id           UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    assessment_no        TEXT        NOT NULL,
    assessed_target      TEXT        NOT NULL
                         CHECK (assessed_target IN ('engineering_change','site_consultation','claim')),
    target_id            UUID        NOT NULL,

    cost_impact_cny      NUMERIC(18,2) DEFAULT 0,
    schedule_impact_days NUMERIC(8,2) DEFAULT 0,
    quality_impact       TEXT        DEFAULT 'none'            -- none / minor / moderate / major
                         CHECK (quality_impact IN ('none','minor','moderate','major')),
    safety_impact        TEXT        DEFAULT 'none'
                         CHECK (safety_impact IN ('none','minor','moderate','major')),

    cascading_effects    JSONB       NOT NULL DEFAULT '[]'::jsonb,
                         -- [{"subdomain":"01-progress","effect":"A2410 延 2 日"},
                         --  {"subdomain":"10-bim_integration","effect":"BIM 需更新 v4"}]

    generated_by         TEXT        NOT NULL DEFAULT 'llm'
                         CHECK (generated_by IN ('llm','manual','hybrid')),

    confidence           NUMERIC(4,3),                         -- 0.000 ~ 1.000

    reviewed_by          UUID,
    reviewed_at          TIMESTAMPTZ,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE csr.change_impact_assessments IS '变更影响评估 · 对工期 / 成本 / 质量 / 安全 四维';

CREATE INDEX idx_cia_target ON csr.change_impact_assessments(assessed_target, target_id);
CREATE INDEX idx_cia_project ON csr.change_impact_assessments(project_id, created_at DESC);

ALTER TABLE csr.change_impact_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE csr.change_impact_assessments FORCE ROW LEVEL SECURITY;
CREATE POLICY cia_tenant ON csr.change_impact_assessments
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

---

## 2. 示例 INSERT (锦屏 · 工期延期签证)

```sql
-- 索赔:因暴雨申请工期顺延
INSERT INTO csr.claims (
    tenant_id, project_id, claim_no, claimant, claim_type,
    incident_at, notice_given_at,
    days_claimed, basis_contract_clause, basis_description,
    status
) VALUES (
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
    'JP-CLM-2026-0002', 'contractor', 'time_extension',
    TIMESTAMPTZ '2026-05-30 00:00:00+08',
    TIMESTAMPTZ '2026-06-01 09:00:00+08',   -- 2 日内通知 · 符合 28 天
    1.5,
    'FIDIC §8.5 · 合同第 15 条',
    '2026-05-30 至 5/31 连续暴雨 · 降雨量日均 > 40mm · 停工 1.5 日 · 不可抗力',
    'notified'
);

-- 签证:工期延期签证
INSERT INTO csr.certifications (
    tenant_id, project_id, cert_no, cert_type, issued_at, scope, description,
    amount_cny, days,
    linked_claim_id, signed_by_owner_at, signed_by_contractor_at, signed_by_supervisor_at,
    status
) VALUES (
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
    'JP-CRT-2026-0028', 'time_extension', TIMESTAMPTZ '2026-06-02 14:00:00+08',
    '合同工期顺延 1.5 日', '基于 2026-05-30/31 暴雨停工 · 气象局证明 · 合同第 15 条',
    0, 1.5,
    '<claim id>',
    TIMESTAMPTZ '2026-06-02 14:30', TIMESTAMPTZ '2026-06-02 14:35', TIMESTAMPTZ '2026-06-02 14:40',
    'signed'
);

-- 影响评估
INSERT INTO csr.change_impact_assessments (
    tenant_id, project_id, assessment_no, assessed_target, target_id,
    cost_impact_cny, schedule_impact_days, quality_impact, safety_impact,
    cascading_effects, generated_by, confidence
) VALUES (
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',
    'JP-CIA-2026-0012', 'claim', '<claim id>',
    0, 1.5, 'none', 'none',
    '[
      {"subdomain":"01-progress","effect":"合同竣工日从 6/14 推到 6/15.5(按工作日)"},
      {"subdomain":"11-compliance","effect":"需归档气象局证明 · 作为法律依据"}
    ]'::jsonb,
    'llm', 0.92
);
```

---

## 3. 维护

### 3.1 索赔时效提醒

```sql
-- 索赔事件后 28 天内未 notify · 标红
CREATE OR REPLACE FUNCTION csr.fn_claim_late_scan() RETURNS void AS $$
BEGIN
    UPDATE csr.claims c SET status = 'rejected',
        supervisor_recommendation = json_build_object('reason','超 28 天未通知(FIDIC §20)')::jsonb
    WHERE c.status = 'notified'
      AND c.within_notice_period = FALSE
      AND c.supervisor_recommendation IS NULL;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. 查询

```sql
-- 累计变更金额
SELECT SUM(impact_cost_cny) AS total_rfc_cost,
       SUM(impact_schedule_days) AS total_rfc_days
FROM csr.engineering_changes
WHERE project_id = $1 AND status IN ('approved','executed','closed');

-- 未结签证
SELECT cert_no, cert_type, amount_cny, status
FROM csr.certifications
WHERE project_id = $1 AND status != 'paid'
ORDER BY issued_at;

-- 索赔台账
SELECT claim_no, claim_type, claimant, amount_claimed_cny, days_claimed, status
FROM csr.claims
WHERE project_id = $1
ORDER BY notice_given_at;
```

---

version: 0.1.0 · 2026-04-23
