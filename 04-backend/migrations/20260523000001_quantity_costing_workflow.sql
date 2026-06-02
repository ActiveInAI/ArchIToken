-- migrations/20260523000001_quantity_costing_workflow.sql
-- ArchIToken quantity_costing durable workflow schema.
-- Scope: self-developed quantity costing, review integration, standards/quota
-- registry, submitted/approved comparison, increase/decrease ledger, reports,
-- approvals and Open CDE audit evidence. This migration intentionally does not
-- encode proprietary vendor formats, report templates, quota libraries or rules.

CREATE OR REPLACE FUNCTION current_tenant() RETURNS UUID AS $$
DECLARE
    t TEXT;
BEGIN
    BEGIN
        t := current_setting('app.current_tenant', true);
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;
    IF t IS NULL OR t = '' THEN RETURN NULL; END IF;
    RETURN t::UUID;
END
$$ LANGUAGE plpgsql STABLE;

CREATE TABLE IF NOT EXISTS cost_projects (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module_id               TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT
                                DEFAULT 'quantity_costing'
                                CHECK (module_id = 'quantity_costing'),
    costing_project_key     TEXT NOT NULL,
    name                    TEXT NOT NULL,
    jurisdiction            TEXT NOT NULL,
    standard_profile_id     TEXT NOT NULL,
    quota_library_id        TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','submitted','reviewing','professional_review_required','approved','archived')),
    output_state            TEXT NOT NULL DEFAULT 'professional_review_required'
                                CHECK (output_state IN ('draft_assist','rule_checked','professional_review_required','professional_reviewed','signoff_ready','signed_record')),
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, costing_project_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_projects_scope
    ON cost_projects(tenant_id, project_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS cost_project_tree_nodes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cost_project_id         UUID NOT NULL REFERENCES cost_projects(id) ON DELETE CASCADE,
    parent_id               UUID REFERENCES cost_project_tree_nodes(id) ON DELETE SET NULL,
    node_key                TEXT NOT NULL,
    node_type               TEXT NOT NULL CHECK (node_type IN ('project','single_project','unit_project','specialty')),
    name                    TEXT NOT NULL,
    specialty               TEXT NOT NULL,
    sort_order              INTEGER NOT NULL DEFAULT 0,
    standard_profile_id     TEXT NOT NULL,
    quota_library_id        TEXT NOT NULL,
    audit_state             TEXT NOT NULL DEFAULT 'draft'
                                CHECK (audit_state IN ('draft','reviewing','approved','archived','soft_deleted')),
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, cost_project_id, node_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_project_tree_nodes_project
    ON cost_project_tree_nodes(tenant_id, cost_project_id, parent_id, sort_order);

CREATE TABLE IF NOT EXISTS cost_standards (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    standard_id             TEXT NOT NULL,
    name                    TEXT NOT NULL,
    jurisdiction            TEXT NOT NULL,
    specialty               TEXT NOT NULL DEFAULT '',
    effective_from          DATE,
    effective_to            DATE,
    publisher               TEXT NOT NULL DEFAULT '',
    source_ref              TEXT NOT NULL DEFAULT '',
    status                  TEXT NOT NULL DEFAULT 'source_pending'
                                CHECK (status IN ('active','source_pending','retired')),
    source_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    license_boundary        TEXT NOT NULL DEFAULT 'registry_reference',
    review_required         BOOLEAN NOT NULL DEFAULT TRUE,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, standard_id)
);
CREATE INDEX IF NOT EXISTS idx_cost_standards_scope
    ON cost_standards(tenant_id, jurisdiction, status, effective_from DESC);

CREATE TABLE IF NOT EXISTS cost_quota_libraries (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    quota_library_id        TEXT NOT NULL,
    name                    TEXT NOT NULL,
    jurisdiction            TEXT NOT NULL,
    specialty               TEXT NOT NULL,
    version                 TEXT NOT NULL,
    standard_id             TEXT NOT NULL,
    source_ref              TEXT NOT NULL DEFAULT '',
    status                  TEXT NOT NULL DEFAULT 'source_pending'
                                CHECK (status IN ('active','source_pending','retired')),
    source_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    license_boundary        TEXT NOT NULL DEFAULT 'registry_reference',
    review_required         BOOLEAN NOT NULL DEFAULT TRUE,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, quota_library_id)
);
CREATE INDEX IF NOT EXISTS idx_cost_quota_libraries_scope
    ON cost_quota_libraries(tenant_id, jurisdiction, specialty, status);

CREATE TABLE IF NOT EXISTS cost_quota_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    quota_library_id        TEXT NOT NULL,
    quota_item_id           TEXT NOT NULL,
    boq_code                TEXT NOT NULL CHECK (boq_code ~ '^[0-9]{9}$'),
    name                    TEXT NOT NULL,
    unit                    TEXT NOT NULL,
    source_ref              TEXT NOT NULL DEFAULT '',
    source_status           TEXT NOT NULL DEFAULT 'source_pending'
                                CHECK (source_status IN ('active','source_pending','retired')),
    management_rate         NUMERIC(12,6) NOT NULL DEFAULT 0,
    profit_rate             NUMERIC(12,6) NOT NULL DEFAULT 0,
    risk_rate               NUMERIC(12,6) NOT NULL DEFAULT 0,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, quota_item_id)
);
CREATE INDEX IF NOT EXISTS idx_cost_quota_items_code
    ON cost_quota_items(tenant_id, quota_library_id, boq_code);

CREATE TABLE IF NOT EXISTS cost_price_snapshots (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    snapshot_key            TEXT NOT NULL,
    jurisdiction            TEXT NOT NULL,
    price_date              DATE NOT NULL,
    source_ref              TEXT NOT NULL DEFAULT '',
    source_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    status                  TEXT NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','review','approved','archived')),
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, snapshot_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_price_snapshots_project
    ON cost_price_snapshots(tenant_id, project_id, price_date DESC, status);

CREATE TABLE IF NOT EXISTS cost_resource_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    quota_item_id           TEXT,
    price_snapshot_id       UUID REFERENCES cost_price_snapshots(id) ON DELETE SET NULL,
    resource_id             TEXT NOT NULL,
    resource_type           TEXT NOT NULL CHECK (resource_type IN ('labor','material','machine')),
    name                    TEXT NOT NULL,
    unit                    TEXT NOT NULL,
    standard_consumption    NUMERIC(18,6) NOT NULL DEFAULT 0,
    submitted_consumption   NUMERIC(18,6) NOT NULL DEFAULT 0,
    approved_consumption    NUMERIC(18,6) NOT NULL DEFAULT 0,
    standard_price          NUMERIC(18,4) NOT NULL DEFAULT 0,
    submitted_price         NUMERIC(18,4) NOT NULL DEFAULT 0,
    approved_price          NUMERIC(18,4) NOT NULL DEFAULT 0,
    source_ref              TEXT NOT NULL DEFAULT '',
    source_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cost_resource_items_scope
    ON cost_resource_items(tenant_id, quota_item_id, resource_type, resource_id);

CREATE TABLE IF NOT EXISTS cost_bill_versions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cost_project_id         UUID NOT NULL REFERENCES cost_projects(id) ON DELETE CASCADE,
    version_key             TEXT NOT NULL,
    version_type            TEXT NOT NULL CHECK (version_type IN ('estimate','budget','progress_measurement','settlement')),
    status                  TEXT NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','submitted','reviewing','approved','archived')),
    description             TEXT NOT NULL DEFAULT '',
    source_file_ids         JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, cost_project_id, version_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_bill_versions_project
    ON cost_bill_versions(tenant_id, cost_project_id, version_type, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS cost_review_versions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cost_project_id         UUID NOT NULL REFERENCES cost_projects(id) ON DELETE CASCADE,
    review_key              TEXT NOT NULL,
    review_round            INTEGER NOT NULL CHECK (review_round >= 1),
    submitted_version_id    UUID REFERENCES cost_bill_versions(id) ON DELETE SET NULL,
    approved_version_id     UUID REFERENCES cost_bill_versions(id) ON DELETE SET NULL,
    description             TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'reviewing'
                                CHECK (status IN ('draft','reviewing','professional_review_required','approved','archived')),
    output_state            TEXT NOT NULL DEFAULT 'professional_review_required'
                                CHECK (output_state IN ('draft_assist','rule_checked','professional_review_required','professional_reviewed','signoff_ready','signed_record')),
    source_file_ids         JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, cost_project_id, review_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_review_versions_project
    ON cost_review_versions(tenant_id, cost_project_id, review_round DESC, status);

CREATE TABLE IF NOT EXISTS cost_boq_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cost_project_id         UUID NOT NULL REFERENCES cost_projects(id) ON DELETE CASCADE,
    review_version_id       UUID REFERENCES cost_review_versions(id) ON DELETE SET NULL,
    tree_node_id            UUID REFERENCES cost_project_tree_nodes(id) ON DELETE SET NULL,
    item_key                TEXT NOT NULL,
    submitted_code          TEXT NOT NULL DEFAULT '',
    approved_code           TEXT NOT NULL DEFAULT '',
    submitted_name          TEXT NOT NULL DEFAULT '',
    approved_name           TEXT NOT NULL DEFAULT '',
    submitted_feature       TEXT NOT NULL DEFAULT '',
    approved_feature        TEXT NOT NULL DEFAULT '',
    unit                    TEXT NOT NULL,
    submitted_qty           NUMERIC(18,6) NOT NULL DEFAULT 0,
    approved_qty            NUMERIC(18,6) NOT NULL DEFAULT 0,
    qty_delta               NUMERIC(18,6) NOT NULL DEFAULT 0,
    submitted_unit_price    NUMERIC(18,4) NOT NULL DEFAULT 0,
    approved_unit_price     NUMERIC(18,4) NOT NULL DEFAULT 0,
    submitted_total         NUMERIC(18,4) NOT NULL DEFAULT 0,
    approved_total          NUMERIC(18,4) NOT NULL DEFAULT 0,
    amount_delta            NUMERIC(18,4) NOT NULL DEFAULT 0,
    increase_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
    decrease_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
    change_mark             TEXT NOT NULL DEFAULT 'none'
                                CHECK (change_mark IN ('none','add','delete','modify','temporary')),
    change_reason           TEXT NOT NULL DEFAULT '',
    source_ref              TEXT NOT NULL DEFAULT '',
    rule_id                 TEXT NOT NULL DEFAULT '',
    element_id              TEXT,
    source_review_required  BOOLEAN NOT NULL DEFAULT TRUE,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, cost_project_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_boq_items_review
    ON cost_boq_items(tenant_id, review_version_id, change_mark, amount_delta DESC);
CREATE INDEX IF NOT EXISTS idx_cost_boq_items_code
    ON cost_boq_items(tenant_id, approved_code, submitted_code);

CREATE TABLE IF NOT EXISTS cost_quota_subitems (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    boq_item_id             UUID NOT NULL REFERENCES cost_boq_items(id) ON DELETE CASCADE,
    quota_item_id           TEXT,
    name                    TEXT NOT NULL,
    unit                    TEXT NOT NULL,
    submitted_qty           NUMERIC(18,6) NOT NULL DEFAULT 0,
    approved_qty            NUMERIC(18,6) NOT NULL DEFAULT 0,
    submitted_total         NUMERIC(18,4) NOT NULL DEFAULT 0,
    approved_total          NUMERIC(18,4) NOT NULL DEFAULT 0,
    source_ref              TEXT NOT NULL DEFAULT '',
    source_review_required  BOOLEAN NOT NULL DEFAULT TRUE,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cost_quota_subitems_boq
    ON cost_quota_subitems(tenant_id, boq_item_id, quota_item_id);

CREATE TABLE IF NOT EXISTS cost_unit_price_components (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    boq_item_id             UUID REFERENCES cost_boq_items(id) ON DELETE CASCADE,
    quota_subitem_id        UUID REFERENCES cost_quota_subitems(id) ON DELETE CASCADE,
    component_key           TEXT NOT NULL,
    component_type          TEXT NOT NULL CHECK (component_type IN ('labor','material','machine','management','profit','risk','fee','tax')),
    name                    TEXT NOT NULL,
    base_amount             NUMERIC(18,4) NOT NULL DEFAULT 0,
    rate                    NUMERIC(12,6),
    submitted_amount        NUMERIC(18,4) NOT NULL DEFAULT 0,
    approved_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
    amount_delta            NUMERIC(18,4) NOT NULL DEFAULT 0,
    source_ref              TEXT NOT NULL DEFAULT '',
    source_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    source_review_required  BOOLEAN NOT NULL DEFAULT TRUE,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cost_unit_price_components_item
    ON cost_unit_price_components(tenant_id, boq_item_id, quota_subitem_id, component_type);

CREATE TABLE IF NOT EXISTS cost_quantity_details (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    boq_item_id             UUID NOT NULL REFERENCES cost_boq_items(id) ON DELETE CASCADE,
    version_side            TEXT NOT NULL CHECK (version_side IN ('submitted','approved')),
    expression              TEXT NOT NULL,
    result_qty              NUMERIC(18,6) NOT NULL DEFAULT 0,
    unit                    TEXT NOT NULL,
    source_file_id          TEXT,
    source_element_id       TEXT,
    review_note             TEXT NOT NULL DEFAULT '',
    parse_status            TEXT NOT NULL DEFAULT 'manual_review_required'
                                CHECK (parse_status IN ('parsed','manual_review_required','failed')),
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cost_quantity_details_boq
    ON cost_quantity_details(tenant_id, boq_item_id, version_side);

CREATE TABLE IF NOT EXISTS cost_measure_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cost_project_id         UUID NOT NULL REFERENCES cost_projects(id) ON DELETE CASCADE,
    review_version_id       UUID REFERENCES cost_review_versions(id) ON DELETE SET NULL,
    item_key                TEXT NOT NULL,
    name                    TEXT NOT NULL,
    measure_type            TEXT NOT NULL CHECK (measure_type IN ('organization','technical')),
    submitted_base_amount   NUMERIC(18,4) NOT NULL DEFAULT 0,
    approved_base_amount    NUMERIC(18,4) NOT NULL DEFAULT 0,
    submitted_rate          NUMERIC(12,6) NOT NULL DEFAULT 0,
    approved_rate           NUMERIC(12,6) NOT NULL DEFAULT 0,
    submitted_amount        NUMERIC(18,4) NOT NULL DEFAULT 0,
    approved_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
    amount_delta            NUMERIC(18,4) NOT NULL DEFAULT 0,
    change_mark             TEXT NOT NULL DEFAULT 'none'
                                CHECK (change_mark IN ('none','add','delete','modify','temporary')),
    source_rule_id          TEXT NOT NULL DEFAULT '',
    source_ref              TEXT NOT NULL DEFAULT '',
    source_review_required  BOOLEAN NOT NULL DEFAULT TRUE,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, cost_project_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_measure_items_review
    ON cost_measure_items(tenant_id, review_version_id, measure_type, change_mark);

CREATE TABLE IF NOT EXISTS cost_other_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cost_project_id         UUID NOT NULL REFERENCES cost_projects(id) ON DELETE CASCADE,
    review_version_id       UUID REFERENCES cost_review_versions(id) ON DELETE SET NULL,
    item_key                TEXT NOT NULL,
    name                    TEXT NOT NULL,
    other_type              TEXT NOT NULL CHECK (other_type IN ('provisional_sum','daywork','general_contract_service')),
    submitted_amount        NUMERIC(18,4) NOT NULL DEFAULT 0,
    approved_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
    amount_delta            NUMERIC(18,4) NOT NULL DEFAULT 0,
    change_mark             TEXT NOT NULL DEFAULT 'none'
                                CHECK (change_mark IN ('none','add','delete','modify','temporary')),
    source_rule_id          TEXT NOT NULL DEFAULT '',
    source_ref              TEXT NOT NULL DEFAULT '',
    source_review_required  BOOLEAN NOT NULL DEFAULT TRUE,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, cost_project_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_other_items_review
    ON cost_other_items(tenant_id, review_version_id, other_type, change_mark);

CREATE TABLE IF NOT EXISTS cost_fee_summary_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cost_project_id         UUID NOT NULL REFERENCES cost_projects(id) ON DELETE CASCADE,
    review_version_id       UUID REFERENCES cost_review_versions(id) ON DELETE SET NULL,
    fee_key                 TEXT NOT NULL,
    name                    TEXT NOT NULL,
    submitted_base_amount   NUMERIC(18,4) NOT NULL DEFAULT 0,
    approved_base_amount    NUMERIC(18,4) NOT NULL DEFAULT 0,
    submitted_rate          NUMERIC(12,6) NOT NULL DEFAULT 0,
    approved_rate           NUMERIC(12,6) NOT NULL DEFAULT 0,
    submitted_amount        NUMERIC(18,4) NOT NULL DEFAULT 0,
    approved_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
    amount_delta            NUMERIC(18,4) NOT NULL DEFAULT 0,
    change_mark             TEXT NOT NULL DEFAULT 'none'
                                CHECK (change_mark IN ('none','add','delete','modify','temporary')),
    source_rule_id          TEXT NOT NULL DEFAULT '',
    source_ref              TEXT NOT NULL DEFAULT '',
    source_review_required  BOOLEAN NOT NULL DEFAULT TRUE,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, cost_project_id, fee_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_fee_summary_items_review
    ON cost_fee_summary_items(tenant_id, review_version_id, change_mark);

CREATE TABLE IF NOT EXISTS cost_delta_analysis_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cost_project_id         UUID NOT NULL REFERENCES cost_projects(id) ON DELETE CASCADE,
    review_version_id       UUID REFERENCES cost_review_versions(id) ON DELETE CASCADE,
    source_table            TEXT NOT NULL CHECK (source_table IN ('cost_boq_items','cost_measure_items','cost_other_items','cost_fee_summary_items')),
    source_id               UUID NOT NULL,
    selected_for_report     BOOLEAN NOT NULL DEFAULT FALSE,
    filter_context          JSONB NOT NULL DEFAULT '{}'::jsonb,
    merge_context           JSONB NOT NULL DEFAULT '{}'::jsonb,
    amount_delta            NUMERIC(18,4) NOT NULL DEFAULT 0,
    amount_delta_ratio      NUMERIC(12,6) NOT NULL DEFAULT 0,
    change_mark             TEXT NOT NULL DEFAULT 'none'
                                CHECK (change_mark IN ('none','add','delete','modify','temporary')),
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cost_delta_analysis_items_review
    ON cost_delta_analysis_items(tenant_id, review_version_id, selected_for_report, amount_delta DESC);

CREATE TABLE IF NOT EXISTS cost_report_templates (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_key            TEXT NOT NULL,
    name                    TEXT NOT NULL,
    template_type           TEXT NOT NULL CHECK (template_type IN ('review_report','excel_export','pdf_export','docx_export')),
    source_ref              TEXT NOT NULL DEFAULT '',
    owner_role              TEXT NOT NULL DEFAULT '造价负责人',
    status                  TEXT NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','review','approved','archived','disabled')),
    content                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, template_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_report_templates_scope
    ON cost_report_templates(tenant_id, template_type, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS cost_review_reports (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cost_project_id         UUID NOT NULL REFERENCES cost_projects(id) ON DELETE CASCADE,
    review_version_id       UUID REFERENCES cost_review_versions(id) ON DELETE CASCADE,
    template_id             UUID REFERENCES cost_report_templates(id) ON DELETE SET NULL,
    report_key              TEXT NOT NULL,
    title                   TEXT NOT NULL,
    selected_item_ids       JSONB NOT NULL DEFAULT '[]'::jsonb,
    submitted_total         NUMERIC(18,4) NOT NULL DEFAULT 0,
    approved_total          NUMERIC(18,4) NOT NULL DEFAULT 0,
    amount_delta            NUMERIC(18,4) NOT NULL DEFAULT 0,
    increase_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
    decrease_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
    output_state            TEXT NOT NULL DEFAULT 'professional_review_required'
                                CHECK (output_state IN ('draft_assist','rule_checked','professional_review_required','professional_reviewed','signoff_ready','signed_record')),
    status                  TEXT NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','generated','review','approved','archived')),
    artifact_refs           JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, cost_project_id, report_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_review_reports_review
    ON cost_review_reports(tenant_id, review_version_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS cost_approval_records (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cost_project_id         UUID NOT NULL REFERENCES cost_projects(id) ON DELETE CASCADE,
    review_version_id       UUID REFERENCES cost_review_versions(id) ON DELETE SET NULL,
    report_id               UUID REFERENCES cost_review_reports(id) ON DELETE SET NULL,
    approval_key            TEXT NOT NULL,
    title                   TEXT NOT NULL,
    professional_role       TEXT NOT NULL DEFAULT '注册造价工程师',
    approver_id             UUID REFERENCES users(id),
    status                  TEXT NOT NULL DEFAULT 'waiting'
                                CHECK (status IN ('not_started','waiting','approved','rejected','returned')),
    decision                TEXT NOT NULL DEFAULT '',
    evidence_refs           JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, approval_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_approval_records_scope
    ON cost_approval_records(tenant_id, cost_project_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS cost_audit_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id              UUID REFERENCES projects(id) ON DELETE CASCADE,
    cost_project_id         UUID REFERENCES cost_projects(id) ON DELETE CASCADE,
    module_id               TEXT NOT NULL DEFAULT 'quantity_costing'
                                CHECK (module_id = 'quantity_costing'),
    event_key               TEXT NOT NULL,
    actor_id                UUID REFERENCES users(id),
    actor_label             TEXT NOT NULL DEFAULT '',
    event_type              TEXT NOT NULL,
    summary                 TEXT NOT NULL,
    target_table            TEXT NOT NULL DEFAULT '',
    target_id               UUID,
    evidence_refs           JSONB NOT NULL DEFAULT '[]'::jsonb,
    payload                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, event_key)
);
CREATE INDEX IF NOT EXISTS idx_cost_audit_events_scope
    ON cost_audit_events(tenant_id, cost_project_id, created_at DESC, event_type);

ALTER TABLE cost_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_project_tree_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_quota_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_quota_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_resource_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_bill_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_review_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_boq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_quota_subitems ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_unit_price_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_quantity_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_measure_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_other_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_fee_summary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_delta_analysis_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_approval_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cost_projects_tenant ON cost_projects;
CREATE POLICY cost_projects_tenant ON cost_projects
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_project_tree_nodes_tenant ON cost_project_tree_nodes;
CREATE POLICY cost_project_tree_nodes_tenant ON cost_project_tree_nodes
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_standards_tenant ON cost_standards;
CREATE POLICY cost_standards_tenant ON cost_standards
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_quota_libraries_tenant ON cost_quota_libraries;
CREATE POLICY cost_quota_libraries_tenant ON cost_quota_libraries
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_quota_items_tenant ON cost_quota_items;
CREATE POLICY cost_quota_items_tenant ON cost_quota_items
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_price_snapshots_tenant ON cost_price_snapshots;
CREATE POLICY cost_price_snapshots_tenant ON cost_price_snapshots
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_resource_items_tenant ON cost_resource_items;
CREATE POLICY cost_resource_items_tenant ON cost_resource_items
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_bill_versions_tenant ON cost_bill_versions;
CREATE POLICY cost_bill_versions_tenant ON cost_bill_versions
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_review_versions_tenant ON cost_review_versions;
CREATE POLICY cost_review_versions_tenant ON cost_review_versions
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_boq_items_tenant ON cost_boq_items;
CREATE POLICY cost_boq_items_tenant ON cost_boq_items
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_quota_subitems_tenant ON cost_quota_subitems;
CREATE POLICY cost_quota_subitems_tenant ON cost_quota_subitems
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_unit_price_components_tenant ON cost_unit_price_components;
CREATE POLICY cost_unit_price_components_tenant ON cost_unit_price_components
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_quantity_details_tenant ON cost_quantity_details;
CREATE POLICY cost_quantity_details_tenant ON cost_quantity_details
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_measure_items_tenant ON cost_measure_items;
CREATE POLICY cost_measure_items_tenant ON cost_measure_items
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_other_items_tenant ON cost_other_items;
CREATE POLICY cost_other_items_tenant ON cost_other_items
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_fee_summary_items_tenant ON cost_fee_summary_items;
CREATE POLICY cost_fee_summary_items_tenant ON cost_fee_summary_items
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_delta_analysis_items_tenant ON cost_delta_analysis_items;
CREATE POLICY cost_delta_analysis_items_tenant ON cost_delta_analysis_items
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_report_templates_tenant ON cost_report_templates;
CREATE POLICY cost_report_templates_tenant ON cost_report_templates
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_review_reports_tenant ON cost_review_reports;
CREATE POLICY cost_review_reports_tenant ON cost_review_reports
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_approval_records_tenant ON cost_approval_records;
CREATE POLICY cost_approval_records_tenant ON cost_approval_records
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS cost_audit_events_tenant ON cost_audit_events;
CREATE POLICY cost_audit_events_tenant ON cost_audit_events
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

ALTER TABLE cost_projects FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_project_tree_nodes FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_standards FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_quota_libraries FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_quota_items FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_price_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_resource_items FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_bill_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_review_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_boq_items FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_quota_subitems FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_unit_price_components FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_quantity_details FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_measure_items FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_other_items FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_fee_summary_items FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_delta_analysis_items FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_report_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_review_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_approval_records FORCE ROW LEVEL SECURITY;
ALTER TABLE cost_audit_events FORCE ROW LEVEL SECURITY;
