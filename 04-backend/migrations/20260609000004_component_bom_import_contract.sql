-- ArchIToken component BOM import contract.
--
-- This migration makes the three workbook P0 path reusable:
-- 1. SJG 157-2024 semantic dictionary category workbook.
-- 2. Prefabricated steel component naming-rule workbook.
-- 3. YingShe MeiJu component material BOM workbook.
--
-- The imported data remains source evidence and professional_review_required
-- until a responsible professional approves it through the platform workflow.

ALTER TABLE bom_lines
    ADD COLUMN IF NOT EXISTS semantic_standard_id TEXT NOT NULL DEFAULT 'sjg157-2024',
    ADD COLUMN IF NOT EXISTS semantic_category_code TEXT,
    ADD COLUMN IF NOT EXISTS naming_rule_key TEXT,
    ADD COLUMN IF NOT EXISTS validation_issue_count INTEGER NOT NULL DEFAULT 0 CHECK (validation_issue_count >= 0),
    ADD COLUMN IF NOT EXISTS source_schema TEXT NOT NULL DEFAULT 'architoken.component_bom_line.v1';

UPDATE bom_lines
SET semantic_category_code = COALESCE(semantic_category_code, category_code)
WHERE semantic_category_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_bom_lines_semantic_category
    ON bom_lines(tenant_id, project_id, semantic_standard_id, semantic_category_code);
CREATE INDEX IF NOT EXISTS idx_bom_lines_validation_issue_count
    ON bom_lines(tenant_id, project_id, validation_state, validation_issue_count);

CREATE TABLE IF NOT EXISTS component_bom_import_batches (
    import_batch_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                 UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id                UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module_id                 TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT DEFAULT 'detailed_design',
    bom_document_id           UUID REFERENCES bom_documents(bom_document_id) ON DELETE SET NULL,
    bom_version_id            UUID REFERENCES bom_versions(bom_version_id) ON DELETE SET NULL,
    adapter_id                TEXT NOT NULL DEFAULT 'component_bom',
    worker_operation          TEXT NOT NULL DEFAULT 'component_bom_import',
    manifest_schema           TEXT NOT NULL DEFAULT 'architoken.component_bom_import_manifest.v1',
    status                    TEXT NOT NULL DEFAULT 'professional_review_required'
                              CHECK (status IN ('queued','running','completed','failed','blocked','professional_review_required')),
    review_state              TEXT NOT NULL DEFAULT 'professional_review_required'
                              CHECK (review_state IN ('professional_review_required','reviewing','approved','rejected')),
    source_bom_path           TEXT NOT NULL,
    source_bom_sha256         TEXT,
    source_sjg157_path        TEXT NOT NULL,
    source_sjg157_sha256      TEXT,
    source_naming_rule_path   TEXT NOT NULL,
    source_naming_rule_sha256 TEXT,
    sjg157_category_count     INTEGER NOT NULL DEFAULT 0 CHECK (sjg157_category_count >= 0),
    naming_rule_count         INTEGER NOT NULL DEFAULT 0 CHECK (naming_rule_count >= 0),
    bom_line_count            INTEGER NOT NULL DEFAULT 0 CHECK (bom_line_count >= 0),
    bom_category_ref_count    INTEGER NOT NULL DEFAULT 0 CHECK (bom_category_ref_count >= 0),
    total_quantity            NUMERIC(18,6) NOT NULL DEFAULT 0,
    total_weight_kg           NUMERIC(18,6) NOT NULL DEFAULT 0,
    validation_error_count    INTEGER NOT NULL DEFAULT 0 CHECK (validation_error_count >= 0),
    validation_warning_count  INTEGER NOT NULL DEFAULT 0 CHECK (validation_warning_count >= 0),
    artifact_manifest         JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (
        tenant_id,
        project_id,
        module_id,
        source_bom_path,
        source_sjg157_path,
        source_naming_rule_path
    )
);

CREATE INDEX IF NOT EXISTS idx_component_bom_import_batches_scope
    ON component_bom_import_batches(tenant_id, project_id, module_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_component_bom_import_batches_bom_version
    ON component_bom_import_batches(tenant_id, project_id, bom_version_id);
CREATE INDEX IF NOT EXISTS idx_component_bom_import_batches_artifacts
    ON component_bom_import_batches USING gin (artifact_manifest);

CREATE TABLE IF NOT EXISTS component_bom_naming_rules (
    naming_rule_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module_id            TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT DEFAULT 'detailed_design',
    import_batch_id      UUID REFERENCES component_bom_import_batches(import_batch_id) ON DELETE SET NULL,
    source_path          TEXT NOT NULL,
    source_sheet         TEXT NOT NULL,
    source_row           INTEGER NOT NULL CHECK (source_row > 0),
    rule_key             TEXT NOT NULL,
    rule_type            TEXT NOT NULL CHECK (rule_type IN ('general','component','version')),
    rule_category        TEXT NOT NULL DEFAULT '',
    component_group      TEXT NOT NULL DEFAULT '',
    component_type       TEXT NOT NULL DEFAULT '',
    prefix               TEXT NOT NULL DEFAULT '',
    naming_formula       TEXT NOT NULL DEFAULT '',
    standard_example     TEXT NOT NULL DEFAULT '',
    field_notes          TEXT NOT NULL DEFAULT '',
    version_code         TEXT NOT NULL DEFAULT '',
    status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','superseded','blocked','professional_review_required')),
    metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, source_path, source_sheet, source_row)
);

CREATE INDEX IF NOT EXISTS idx_component_bom_naming_rules_lookup
    ON component_bom_naming_rules(tenant_id, project_id, rule_type, prefix, status);
CREATE INDEX IF NOT EXISTS idx_component_bom_naming_rules_batch
    ON component_bom_naming_rules(tenant_id, project_id, import_batch_id);
CREATE INDEX IF NOT EXISTS idx_component_bom_naming_rules_metadata
    ON component_bom_naming_rules USING gin (metadata);

CREATE TABLE IF NOT EXISTS component_bom_source_category_refs (
    category_ref_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module_id            TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT DEFAULT 'detailed_design',
    import_batch_id      UUID REFERENCES component_bom_import_batches(import_batch_id) ON DELETE SET NULL,
    source_path          TEXT NOT NULL,
    source_sheet         TEXT NOT NULL,
    source_row           INTEGER NOT NULL CHECK (source_row > 0),
    sequence_no          INTEGER,
    section              TEXT NOT NULL DEFAULT '',
    level_name           TEXT NOT NULL DEFAULT '',
    category_code        TEXT NOT NULL,
    category_name        TEXT NOT NULL,
    semantic_standard_id TEXT NOT NULL DEFAULT 'sjg157-2024',
    match_state          TEXT NOT NULL DEFAULT 'source_imported'
                         CHECK (match_state IN ('source_imported','matched','missing_in_dictionary','blocked')),
    metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, source_path, source_sheet, source_row)
);

CREATE INDEX IF NOT EXISTS idx_component_bom_source_category_refs_code
    ON component_bom_source_category_refs(tenant_id, project_id, semantic_standard_id, category_code);
CREATE INDEX IF NOT EXISTS idx_component_bom_source_category_refs_batch
    ON component_bom_source_category_refs(tenant_id, project_id, import_batch_id);

CREATE TABLE IF NOT EXISTS component_bom_validation_issues (
    validation_issue_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module_id            TEXT NOT NULL REFERENCES modules(id) ON DELETE RESTRICT DEFAULT 'detailed_design',
    import_batch_id      UUID REFERENCES component_bom_import_batches(import_batch_id) ON DELETE SET NULL,
    bom_version_id       UUID REFERENCES bom_versions(bom_version_id) ON DELETE CASCADE,
    bom_line_id          UUID REFERENCES bom_lines(bom_line_id) ON DELETE CASCADE,
    line_no              INTEGER,
    component_name       TEXT NOT NULL DEFAULT '',
    category_code        TEXT NOT NULL DEFAULT '',
    severity             TEXT NOT NULL CHECK (severity IN ('error','warning','info')),
    issue_code           TEXT NOT NULL,
    issue_message        TEXT NOT NULL,
    source_path          TEXT NOT NULL DEFAULT '',
    source_sheet         TEXT NOT NULL DEFAULT '',
    source_row           INTEGER,
    source_column        TEXT NOT NULL DEFAULT '',
    source_range         TEXT NOT NULL DEFAULT '',
    status               TEXT NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open','resolved','waived','superseded')),
    resolution_note      TEXT NOT NULL DEFAULT '',
    resolved_by          TEXT,
    resolved_at          TIMESTAMPTZ,
    metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_component_bom_validation_issues_scope
    ON component_bom_validation_issues(tenant_id, project_id, module_id, severity, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_component_bom_validation_issues_line
    ON component_bom_validation_issues(tenant_id, project_id, bom_version_id, bom_line_id);
CREATE INDEX IF NOT EXISTS idx_component_bom_validation_issues_code
    ON component_bom_validation_issues(tenant_id, project_id, issue_code, status);
CREATE INDEX IF NOT EXISTS idx_component_bom_validation_issues_metadata
    ON component_bom_validation_issues USING gin (metadata);

ALTER TABLE component_bom_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_bom_naming_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_bom_source_category_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_bom_validation_issues ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    table_name TEXT;
    policy_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'component_bom_import_batches',
        'component_bom_naming_rules',
        'component_bom_source_category_refs',
        'component_bom_validation_issues'
    ]
    LOOP
        policy_name := table_name || '_tenant_isolation';
        IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = current_schema()
              AND tablename = table_name
              AND policyname = policy_name
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I USING (tenant_id = current_tenant()) WITH CHECK (tenant_id = current_tenant())',
                policy_name,
                table_name
            );
        END IF;
    END LOOP;
END $$;

ALTER TABLE component_bom_import_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE component_bom_naming_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE component_bom_source_category_refs FORCE ROW LEVEL SECURITY;
ALTER TABLE component_bom_validation_issues FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE component_bom_import_batches IS
    'Tenant-scoped import manifest for component BOM source workbooks. Data remains professional_review_required until approved.';
COMMENT ON TABLE component_bom_naming_rules IS
    'Imported component naming rules from the prefabricated steel component naming-rule workbook.';
COMMENT ON TABLE component_bom_source_category_refs IS
    'Category reference rows carried by the source BOM workbook for SJG 157 cross-checking.';
COMMENT ON TABLE component_bom_validation_issues IS
    'Structured BOM import validation findings, separated from source rows for review, waiver and audit.';
COMMENT ON COLUMN bom_lines.source_schema IS
    'Schema id of the source-derived BOM line artifact produced by the component_bom worker.';
COMMENT ON COLUMN bom_lines.validation_issue_count IS
    'Number of open validation issues associated with this source BOM line.';
