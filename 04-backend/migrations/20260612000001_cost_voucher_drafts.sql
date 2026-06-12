-- 20260612000001_cost_voucher_drafts.sql
-- 审定结算凭证草稿落库：计量造价审定结果 → 财务管理模块的凭证生成计划。
-- 对标金蝶云智能会计平台「凭证生成」: 来源单据为 cost_review_versions,
-- 凭证草稿持久化后由财务管理模块消费（生成正式凭证、对账）。

CREATE TABLE IF NOT EXISTS cost_voucher_drafts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cost_project_id         UUID REFERENCES cost_projects(id) ON DELETE CASCADE,
    review_version_id       UUID REFERENCES cost_review_versions(id) ON DELETE SET NULL,
    plan_key                TEXT NOT NULL,
    voucher_key             TEXT NOT NULL,
    description             TEXT NOT NULL DEFAULT '',
    source_doc_type         TEXT NOT NULL DEFAULT 'cost_review_version'
                                CHECK (source_doc_type = 'cost_review_version'),
    entries                 JSONB NOT NULL DEFAULT '[]'::jsonb,
    debit_total             NUMERIC(18, 2) NOT NULL DEFAULT 0,
    credit_total            NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tail_difference         NUMERIC(18, 2) NOT NULL DEFAULT 0,
    balanced                BOOLEAN NOT NULL DEFAULT TRUE,
    generation_status       TEXT NOT NULL DEFAULT 'generated'
                                CHECK (generation_status IN ('generated', 'skipped')),
    skip_reason             TEXT NOT NULL DEFAULT '',
    status                  TEXT NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'handed_off', 'posted', 'voided')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, plan_key, voucher_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_voucher_drafts_scope
    ON cost_voucher_drafts(tenant_id, project_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_voucher_drafts_plan
    ON cost_voucher_drafts(tenant_id, plan_key);

ALTER TABLE cost_voucher_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cost_voucher_drafts_tenant ON cost_voucher_drafts;
CREATE POLICY cost_voucher_drafts_tenant ON cost_voucher_drafts
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());
ALTER TABLE cost_voucher_drafts FORCE ROW LEVEL SECURITY;
