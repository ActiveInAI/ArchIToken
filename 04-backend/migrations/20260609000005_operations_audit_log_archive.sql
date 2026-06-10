-- ArchIToken operations bastion and log archive contract.
--
-- P0 scope:
-- - JumpServer or equivalent bastion sessions are durable business records.
-- - Command audit and session recording evidence are required for production ops.
-- - Log archive batches are immutable evidence packages with manifest hashes.

CREATE TABLE IF NOT EXISTS operations_bastion_instances (
    bastion_instance_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider                   TEXT NOT NULL DEFAULT 'jumpserver'
                               CHECK (provider IN ('jumpserver','teleport','openssh','cloud_bastion','other')),
    instance_name              TEXT NOT NULL,
    base_url                   TEXT NOT NULL DEFAULT '',
    network_zone               TEXT NOT NULL DEFAULT 'ops',
    status                     TEXT NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','maintenance','disabled','blocked')),
    mfa_required               BOOLEAN NOT NULL DEFAULT TRUE,
    session_recording_required BOOLEAN NOT NULL DEFAULT TRUE,
    command_audit_required     BOOLEAN NOT NULL DEFAULT TRUE,
    log_archive_required       BOOLEAN NOT NULL DEFAULT TRUE,
    retention_days             INTEGER NOT NULL DEFAULT 365 CHECK (retention_days >= 30),
    metadata                   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, provider, instance_name)
);

CREATE INDEX IF NOT EXISTS idx_operations_bastion_instances_scope
    ON operations_bastion_instances(tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS operations_bastion_assets (
    bastion_asset_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id                 UUID REFERENCES projects(id) ON DELETE SET NULL,
    module_id                  TEXT REFERENCES modules(id) ON DELETE SET NULL,
    asset_kind                 TEXT NOT NULL CHECK (asset_kind IN ('host','kubernetes','database','network','storage','application')),
    asset_name                 TEXT NOT NULL,
    environment                TEXT NOT NULL DEFAULT 'production'
                               CHECK (environment IN ('development','staging','production','dr','ops')),
    management_endpoint        TEXT NOT NULL DEFAULT '',
    access_policy              TEXT NOT NULL DEFAULT 'bastion_only'
                               CHECK (access_policy IN ('bastion_only','readonly_bastion','break_glass','blocked')),
    criticality                TEXT NOT NULL DEFAULT 'high'
                               CHECK (criticality IN ('low','medium','high','critical')),
    metadata                   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, environment, asset_kind, asset_name)
);

CREATE INDEX IF NOT EXISTS idx_operations_bastion_assets_scope
    ON operations_bastion_assets(tenant_id, project_id, environment, criticality);

CREATE TABLE IF NOT EXISTS operations_bastion_sessions (
    bastion_session_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id                 UUID REFERENCES projects(id) ON DELETE SET NULL,
    bastion_instance_id        UUID NOT NULL REFERENCES operations_bastion_instances(bastion_instance_id) ON DELETE RESTRICT,
    bastion_asset_id           UUID NOT NULL REFERENCES operations_bastion_assets(bastion_asset_id) ON DELETE RESTRICT,
    external_session_id        TEXT NOT NULL,
    actor                      TEXT NOT NULL,
    protocol                   TEXT NOT NULL DEFAULT 'ssh'
                               CHECK (protocol IN ('ssh','rdp','kubernetes','database','web','other')),
    source_ip                  INET,
    started_at                 TIMESTAMPTZ NOT NULL,
    ended_at                   TIMESTAMPTZ,
    duration_seconds           INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    risk_level                 TEXT NOT NULL DEFAULT 'medium'
                               CHECK (risk_level IN ('low','medium','high','critical')),
    session_status             TEXT NOT NULL DEFAULT 'completed'
                               CHECK (session_status IN ('started','completed','failed','terminated','blocked')),
    recording_uri              TEXT NOT NULL DEFAULT '',
    recording_sha256           TEXT,
    transcript_uri             TEXT NOT NULL DEFAULT '',
    transcript_sha256          TEXT,
    command_count              INTEGER NOT NULL DEFAULT 0 CHECK (command_count >= 0),
    archive_state              TEXT NOT NULL DEFAULT 'pending_archive'
                               CHECK (archive_state IN ('pending_archive','archived','verified','failed')),
    review_state               TEXT NOT NULL DEFAULT 'review_required'
                               CHECK (review_state IN ('review_required','reviewing','reviewed','waived','blocked')),
    metadata                   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, external_session_id)
);

CREATE INDEX IF NOT EXISTS idx_operations_bastion_sessions_scope
    ON operations_bastion_sessions(tenant_id, project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_operations_bastion_sessions_archive
    ON operations_bastion_sessions(tenant_id, archive_state, review_state, started_at DESC);

CREATE TABLE IF NOT EXISTS operations_bastion_command_events (
    command_event_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bastion_session_id         UUID NOT NULL REFERENCES operations_bastion_sessions(bastion_session_id) ON DELETE CASCADE,
    sequence_no                INTEGER NOT NULL CHECK (sequence_no > 0),
    executed_at                TIMESTAMPTZ NOT NULL,
    command_text               TEXT NOT NULL DEFAULT '',
    command_sha256             TEXT NOT NULL,
    redacted                   BOOLEAN NOT NULL DEFAULT TRUE,
    result_status              TEXT NOT NULL DEFAULT 'recorded'
                               CHECK (result_status IN ('recorded','succeeded','failed','blocked','unknown')),
    policy_decision            TEXT NOT NULL DEFAULT 'allow_recorded'
                               CHECK (policy_decision IN ('allow_recorded','allow_readonly','blocked','break_glass')),
    risk_level                 TEXT NOT NULL DEFAULT 'medium'
                               CHECK (risk_level IN ('low','medium','high','critical')),
    metadata                   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, bastion_session_id, sequence_no)
);

CREATE INDEX IF NOT EXISTS idx_operations_bastion_command_events_session
    ON operations_bastion_command_events(tenant_id, bastion_session_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_operations_bastion_command_events_risk
    ON operations_bastion_command_events(tenant_id, risk_level, executed_at DESC);

CREATE TABLE IF NOT EXISTS operations_log_archive_batches (
    log_archive_batch_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id                 UUID REFERENCES projects(id) ON DELETE SET NULL,
    source_system              TEXT NOT NULL CHECK (
        source_system IN ('jumpserver','gateway','worker','postgres','kubernetes','object_store','systemd','other')
    ),
    archive_kind               TEXT NOT NULL CHECK (
        archive_kind IN ('bastion_session','audit_event','application_log','database_log','security_log','backup_manifest')
    ),
    object_uri                 TEXT NOT NULL,
    manifest_uri               TEXT NOT NULL,
    manifest_sha256            TEXT NOT NULL,
    item_count                 INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
    byte_size                  BIGINT NOT NULL DEFAULT 0 CHECK (byte_size >= 0),
    compression                TEXT NOT NULL DEFAULT 'zstd',
    encryption_state           TEXT NOT NULL DEFAULT 'required'
                               CHECK (encryption_state IN ('required','encrypted','not_required','failed')),
    retention_policy           TEXT NOT NULL DEFAULT 'immutable_365_days',
    legal_hold                 BOOLEAN NOT NULL DEFAULT FALSE,
    status                     TEXT NOT NULL DEFAULT 'sealed'
                               CHECK (status IN ('collecting','sealed','verified','failed','expired')),
    sealed_at                  TIMESTAMPTZ,
    verified_at                TIMESTAMPTZ,
    metadata                   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, source_system, archive_kind, manifest_sha256)
);

CREATE INDEX IF NOT EXISTS idx_operations_log_archive_batches_scope
    ON operations_log_archive_batches(tenant_id, project_id, source_system, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operations_log_archive_batches_manifest
    ON operations_log_archive_batches(tenant_id, manifest_sha256);

CREATE TABLE IF NOT EXISTS operations_log_archive_items (
    log_archive_item_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    log_archive_batch_id       UUID NOT NULL REFERENCES operations_log_archive_batches(log_archive_batch_id) ON DELETE CASCADE,
    source_table               TEXT NOT NULL,
    source_id                  TEXT NOT NULL,
    source_created_at          TIMESTAMPTZ,
    object_uri                 TEXT NOT NULL DEFAULT '',
    item_sha256                TEXT NOT NULL,
    item_state                 TEXT NOT NULL DEFAULT 'archived'
                               CHECK (item_state IN ('archived','verified','failed')),
    metadata                   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, log_archive_batch_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_operations_log_archive_items_batch
    ON operations_log_archive_items(tenant_id, log_archive_batch_id, source_table);

ALTER TABLE operations_bastion_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_bastion_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_bastion_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_bastion_command_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_log_archive_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_log_archive_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    table_name TEXT;
    policy_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'operations_bastion_instances',
        'operations_bastion_assets',
        'operations_bastion_sessions',
        'operations_bastion_command_events',
        'operations_log_archive_batches',
        'operations_log_archive_items'
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

ALTER TABLE operations_bastion_instances FORCE ROW LEVEL SECURITY;
ALTER TABLE operations_bastion_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE operations_bastion_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE operations_bastion_command_events FORCE ROW LEVEL SECURITY;
ALTER TABLE operations_log_archive_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE operations_log_archive_items FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW operations_audit_log_archive_readiness AS
SELECT
    tenant_id,
    COUNT(*) FILTER (WHERE table_name = 'operations_bastion_sessions') AS bastion_session_count,
    COUNT(*) FILTER (WHERE table_name = 'operations_bastion_command_events') AS command_event_count,
    COUNT(*) FILTER (WHERE table_name = 'operations_log_archive_batches') AS archive_batch_count,
    COUNT(*) FILTER (WHERE table_name = 'operations_bastion_sessions' AND state = 'missing_recording') AS missing_recording_count,
    COUNT(*) FILTER (WHERE table_name = 'operations_bastion_sessions' AND state = 'pending_archive') AS pending_archive_count,
    CASE
        WHEN COUNT(*) FILTER (WHERE table_name = 'operations_bastion_sessions') = 0 THEN 'blocked_no_bastion_session'
        WHEN COUNT(*) FILTER (WHERE table_name = 'operations_log_archive_batches') = 0 THEN 'blocked_no_archive_batch'
        WHEN COUNT(*) FILTER (WHERE table_name = 'operations_bastion_sessions' AND state IN ('missing_recording','pending_archive')) > 0 THEN 'blocked_unarchived_session'
        ELSE 'passed'
    END AS p0_gate_state
FROM (
    SELECT
        tenant_id,
        'operations_bastion_sessions' AS table_name,
        CASE
            WHEN recording_uri = '' OR recording_sha256 IS NULL THEN 'missing_recording'
            WHEN archive_state NOT IN ('archived','verified') THEN 'pending_archive'
            ELSE 'ready'
        END AS state
    FROM operations_bastion_sessions
    UNION ALL
    SELECT tenant_id, 'operations_bastion_command_events', 'ready'
    FROM operations_bastion_command_events
    UNION ALL
    SELECT tenant_id, 'operations_log_archive_batches', status
    FROM operations_log_archive_batches
) readiness
GROUP BY tenant_id;

COMMENT ON TABLE operations_bastion_instances IS
    'Registered JumpServer or equivalent bastion instances with MFA, session recording and archive policy requirements.';
COMMENT ON TABLE operations_bastion_sessions IS
    'Immutable operations session evidence from bastion access; production sessions require recording and archive verification.';
COMMENT ON TABLE operations_bastion_command_events IS
    'Per-command audit events captured from bastion sessions. Store redacted command text plus hash evidence.';
COMMENT ON TABLE operations_log_archive_batches IS
    'Immutable log archive batches with object URI and manifest hash for compliance and disaster evidence.';
COMMENT ON VIEW operations_audit_log_archive_readiness IS
    'P0 readiness summary for bastion session recording, command audit and log archive coverage.';
