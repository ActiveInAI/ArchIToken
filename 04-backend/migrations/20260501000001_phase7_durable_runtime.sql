-- Phase 7 durable runtime storage schema.
-- Mirrors `postgres_runtime_store::ensure_phase7_runtime_schema` so fresh
-- PostgreSQL init paths do not depend on gateway startup side effects.

CREATE TABLE IF NOT EXISTS assets (
    id                  UUID PRIMARY KEY,
    tenant_id           TEXT NOT NULL,
    project_id          TEXT NOT NULL,
    asset_id            UUID NOT NULL UNIQUE,
    kind                TEXT NOT NULL,
    name                TEXT NOT NULL,
    status              TEXT NOT NULL,
    source_format       TEXT,
    canonical_format    TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL,
    created_by          TEXT
);

CREATE TABLE IF NOT EXISTS asset_versions (
    id                  UUID PRIMARY KEY,
    tenant_id           TEXT NOT NULL,
    project_id          TEXT NOT NULL,
    asset_id            UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    version             INTEGER NOT NULL,
    status              TEXT NOT NULL,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL,
    created_by          TEXT,
    UNIQUE(asset_id, version)
);

CREATE TABLE IF NOT EXISTS asset_files (
    id                  UUID PRIMARY KEY,
    tenant_id           TEXT NOT NULL,
    project_id          TEXT NOT NULL,
    asset_id            UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    asset_version_id    UUID NOT NULL REFERENCES asset_versions(id) ON DELETE CASCADE,
    role                TEXT NOT NULL,
    format              TEXT NOT NULL,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL,
    created_by          TEXT
);

CREATE TABLE IF NOT EXISTS object_store_bindings (
    id                  UUID PRIMARY KEY,
    tenant_id           TEXT NOT NULL,
    project_id          TEXT NOT NULL,
    asset_id            UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    asset_file_id       UUID NOT NULL REFERENCES asset_files(id) ON DELETE CASCADE,
    bucket              TEXT NOT NULL,
    key                 TEXT NOT NULL,
    size_bytes          BIGINT NOT NULL,
    content_type        TEXT NOT NULL,
    checksum_sha256     TEXT,
    storage_class       TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL,
    created_by          TEXT,
    UNIQUE(asset_file_id)
);

CREATE TABLE IF NOT EXISTS conversion_jobs (
    id                  UUID PRIMARY KEY,
    tenant_id           TEXT NOT NULL,
    project_id          TEXT NOT NULL,
    job_id              UUID NOT NULL UNIQUE,
    operation           TEXT NOT NULL,
    source_asset_id     UUID NOT NULL REFERENCES assets(asset_id) ON DELETE RESTRICT,
    source_file_id      UUID NOT NULL REFERENCES asset_files(id) ON DELETE RESTRICT,
    status              TEXT NOT NULL,
    input               JSONB NOT NULL DEFAULT '{}'::jsonb,
    output              JSONB NOT NULL DEFAULT '{}'::jsonb,
    error               JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at          TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL,
    created_by          TEXT
);

CREATE TABLE IF NOT EXISTS module_files (
    id                  UUID PRIMARY KEY,
    tenant_id           TEXT NOT NULL,
    project_id          TEXT NOT NULL,
    file_id             UUID NOT NULL UNIQUE,
    module_id           TEXT NOT NULL,
    parent_id           UUID,
    name                TEXT NOT NULL,
    kind                TEXT NOT NULL,
    status              TEXT NOT NULL,
    validation_status   TEXT NOT NULL DEFAULT 'validator_not_configured',
    validation_validator_ref TEXT,
    validation_report_ref TEXT,
    validation_summary  TEXT,
    validation_checked_at TIMESTAMPTZ,
    validation_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    size_bytes          BIGINT NOT NULL,
    mime_type           TEXT,
    checksum            TEXT,
    version             INTEGER NOT NULL,
    owner               TEXT NOT NULL,
    tags                JSONB NOT NULL DEFAULT '[]'::jsonb,
    content             TEXT NOT NULL DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL,
    created_by          TEXT
);

CREATE TABLE IF NOT EXISTS module_transactions (
    id                   UUID PRIMARY KEY,
    tenant_id            TEXT NOT NULL,
    project_id           TEXT NOT NULL,
    transaction_id       UUID NOT NULL UNIQUE,
    module_id            TEXT NOT NULL,
    transaction_type     TEXT NOT NULL,
    status               TEXT NOT NULL,
    actor                TEXT NOT NULL,
    related_file_ids     JSONB NOT NULL DEFAULT '[]'::jsonb,
    related_artifact_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL,
    updated_at           TIMESTAMPTZ NOT NULL,
    created_by           TEXT
);

CREATE TABLE IF NOT EXISTS module_transaction_approvals (
    id                   UUID PRIMARY KEY,
    tenant_id            TEXT NOT NULL,
    project_id           TEXT NOT NULL,
    approval_id          UUID NOT NULL UNIQUE,
    transaction_id       UUID NOT NULL REFERENCES module_transactions(transaction_id) ON DELETE CASCADE,
    approver             TEXT NOT NULL,
    decision             TEXT NOT NULL,
    decision_comment     TEXT,
    decided_at           TIMESTAMPTZ NOT NULL,
    created_by           TEXT
);

CREATE TABLE IF NOT EXISTS runtime_executions (
    id                  UUID PRIMARY KEY,
    tenant_id           TEXT NOT NULL,
    project_id          TEXT NOT NULL,
    execution_id        UUID NOT NULL UNIQUE,
    kind                TEXT NOT NULL,
    provider            TEXT NOT NULL,
    status              TEXT NOT NULL,
    input               JSONB NOT NULL DEFAULT '{}'::jsonb,
    output              JSONB NOT NULL DEFAULT '{}'::jsonb,
    trace               JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at          TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL,
    created_by          TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
    id                  UUID PRIMARY KEY,
    tenant_id           TEXT,
    project_id          TEXT,
    module_id           TEXT NOT NULL,
    actor               TEXT NOT NULL,
    action              TEXT NOT NULL,
    target_type         TEXT NOT NULL,
    target_id           TEXT NOT NULL,
    summary             TEXT NOT NULL,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_scope
    ON assets(tenant_id, project_id, created_at, asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_versions_asset
    ON asset_versions(asset_id, version);
CREATE INDEX IF NOT EXISTS idx_asset_files_asset
    ON asset_files(asset_id, created_at);
CREATE INDEX IF NOT EXISTS idx_object_bindings_file
    ON object_store_bindings(asset_file_id);
CREATE INDEX IF NOT EXISTS idx_conversion_jobs_scope
    ON conversion_jobs(tenant_id, project_id, created_at, job_id);
CREATE INDEX IF NOT EXISTS idx_module_files_scope
    ON module_files(tenant_id, project_id, module_id, parent_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_module_files_file_id
    ON module_files(file_id);
CREATE INDEX IF NOT EXISTS idx_module_transactions_scope
    ON module_transactions(tenant_id, project_id, module_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_module_transactions_transaction_id
    ON module_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_module_transaction_approvals_transaction
    ON module_transaction_approvals(transaction_id, decided_at);
CREATE INDEX IF NOT EXISTS idx_runtime_executions_scope
    ON runtime_executions(tenant_id, project_id, created_at, execution_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_filters
    ON audit_events(module_id, target_type, target_id, created_at);

ALTER TABLE module_files ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'validator_not_configured';
ALTER TABLE module_files ADD COLUMN IF NOT EXISTS validation_validator_ref TEXT;
ALTER TABLE module_files ADD COLUMN IF NOT EXISTS validation_report_ref TEXT;
ALTER TABLE module_files ADD COLUMN IF NOT EXISTS validation_summary TEXT;
ALTER TABLE module_files ADD COLUMN IF NOT EXISTS validation_checked_at TIMESTAMPTZ;
ALTER TABLE module_files ADD COLUMN IF NOT EXISTS validation_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
