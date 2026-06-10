-- ArchIToken backup, restore and DR drill contract.
--
-- P0 scope:
-- - Backups are recorded as immutable artifacts with hashes.
-- - Restore drills must run against a separate target and record verification.
-- - Production readiness is blocked when no successful backup and restore drill exist.

CREATE TABLE IF NOT EXISTS backup_policies (
    backup_policy_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    policy_name            TEXT NOT NULL,
    backup_scope           TEXT NOT NULL CHECK (
        backup_scope IN ('postgres','object_store','config','audit_logs','full_platform')
    ),
    schedule_cron          TEXT NOT NULL,
    retention_days         INTEGER NOT NULL CHECK (retention_days >= 7),
    rpo_minutes            INTEGER NOT NULL CHECK (rpo_minutes >= 0),
    rto_minutes            INTEGER NOT NULL CHECK (rto_minutes >= 0),
    backup_target          TEXT NOT NULL,
    encryption_required    BOOLEAN NOT NULL DEFAULT TRUE,
    offsite_copy_required  BOOLEAN NOT NULL DEFAULT TRUE,
    immutable_lock_required BOOLEAN NOT NULL DEFAULT TRUE,
    status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','paused','disabled','blocked')),
    metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, policy_name)
);

CREATE INDEX IF NOT EXISTS idx_backup_policies_scope
    ON backup_policies(tenant_id, backup_scope, status);

CREATE TABLE IF NOT EXISTS backup_runs (
    backup_run_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    backup_policy_id       UUID NOT NULL REFERENCES backup_policies(backup_policy_id) ON DELETE RESTRICT,
    backup_kind            TEXT NOT NULL CHECK (
        backup_kind IN ('postgres_logical','postgres_physical','wal_archive','object_store','config_bundle','audit_log_archive')
    ),
    status                 TEXT NOT NULL CHECK (status IN ('running','completed','failed','verified','expired')),
    started_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at            TIMESTAMPTZ,
    artifact_uri           TEXT NOT NULL,
    artifact_sha256        TEXT NOT NULL,
    artifact_size_bytes    BIGINT NOT NULL DEFAULT 0 CHECK (artifact_size_bytes >= 0),
    database_name          TEXT NOT NULL DEFAULT '',
    source_lsn_start       TEXT NOT NULL DEFAULT '',
    source_lsn_end         TEXT NOT NULL DEFAULT '',
    manifest               JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, backup_policy_id, artifact_sha256)
);

CREATE INDEX IF NOT EXISTS idx_backup_runs_scope
    ON backup_runs(tenant_id, backup_kind, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_runs_manifest
    ON backup_runs USING gin (manifest);

CREATE TABLE IF NOT EXISTS restore_drills (
    restore_drill_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id             UUID REFERENCES projects(id) ON DELETE SET NULL,
    backup_policy_id       UUID NOT NULL REFERENCES backup_policies(backup_policy_id) ON DELETE RESTRICT,
    source_backup_run_id   UUID NOT NULL REFERENCES backup_runs(backup_run_id) ON DELETE RESTRICT,
    drill_kind             TEXT NOT NULL CHECK (
        drill_kind IN ('postgres_logical_restore','object_store_restore','config_restore','full_platform_restore')
    ),
    restore_target         TEXT NOT NULL,
    status                 TEXT NOT NULL CHECK (status IN ('running','passed','failed','blocked')),
    started_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at            TIMESTAMPTZ,
    rto_seconds            INTEGER CHECK (rto_seconds IS NULL OR rto_seconds >= 0),
    rpo_seconds            INTEGER CHECK (rpo_seconds IS NULL OR rpo_seconds >= 0),
    evidence_uri           TEXT NOT NULL DEFAULT '',
    verification_summary   JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, source_backup_run_id, restore_target)
);

CREATE INDEX IF NOT EXISTS idx_restore_drills_scope
    ON restore_drills(tenant_id, drill_kind, status, started_at DESC);

CREATE TABLE IF NOT EXISTS restore_verification_items (
    restore_verification_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    restore_drill_id             UUID NOT NULL REFERENCES restore_drills(restore_drill_id) ON DELETE CASCADE,
    check_name                   TEXT NOT NULL,
    expected_value               TEXT NOT NULL DEFAULT '',
    actual_value                 TEXT NOT NULL DEFAULT '',
    status                       TEXT NOT NULL CHECK (status IN ('passed','failed','warning')),
    metadata                     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, restore_drill_id, check_name)
);

CREATE INDEX IF NOT EXISTS idx_restore_verification_items_drill
    ON restore_verification_items(tenant_id, restore_drill_id, status);

ALTER TABLE backup_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE restore_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE restore_verification_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    table_name TEXT;
    policy_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'backup_policies',
        'backup_runs',
        'restore_drills',
        'restore_verification_items'
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

ALTER TABLE backup_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE backup_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE restore_drills FORCE ROW LEVEL SECURITY;
ALTER TABLE restore_verification_items FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW backup_restore_p0_readiness AS
SELECT
    p.tenant_id,
    COUNT(DISTINCT p.backup_policy_id) FILTER (WHERE p.status = 'active') AS active_policy_count,
    COUNT(DISTINCT r.backup_run_id) FILTER (WHERE r.status IN ('completed','verified')) AS successful_backup_count,
    COUNT(DISTINCT d.restore_drill_id) FILTER (WHERE d.status = 'passed') AS passed_restore_drill_count,
    MAX(r.finished_at) FILTER (WHERE r.status IN ('completed','verified')) AS last_successful_backup_at,
    MAX(d.finished_at) FILTER (WHERE d.status = 'passed') AS last_passed_restore_drill_at,
    CASE
        WHEN COUNT(DISTINCT p.backup_policy_id) FILTER (WHERE p.status = 'active') < 4 THEN 'blocked_missing_policy'
        WHEN COUNT(DISTINCT r.backup_run_id) FILTER (WHERE r.status IN ('completed','verified')) = 0 THEN 'blocked_no_successful_backup'
        WHEN COUNT(DISTINCT d.restore_drill_id) FILTER (WHERE d.status = 'passed') = 0 THEN 'blocked_no_restore_drill'
        WHEN COUNT(v.restore_verification_item_id) FILTER (WHERE v.status = 'failed') > 0 THEN 'blocked_failed_verification'
        ELSE 'passed'
    END AS p0_gate_state
FROM backup_policies p
LEFT JOIN backup_runs r
  ON r.tenant_id = p.tenant_id
 AND r.backup_policy_id = p.backup_policy_id
LEFT JOIN restore_drills d
  ON d.tenant_id = p.tenant_id
 AND d.backup_policy_id = p.backup_policy_id
LEFT JOIN restore_verification_items v
  ON v.tenant_id = p.tenant_id
 AND v.restore_drill_id = d.restore_drill_id
GROUP BY p.tenant_id;

COMMENT ON TABLE backup_policies IS
    'Tenant backup policies for PostgreSQL, object store, configuration and audit logs with RPO/RTO and immutability requirements.';
COMMENT ON TABLE backup_runs IS
    'Recorded backup artifacts with artifact URI, hash, size and manifest evidence.';
COMMENT ON TABLE restore_drills IS
    'Disaster recovery drills against separate restore targets with measured RTO/RPO.';
COMMENT ON TABLE restore_verification_items IS
    'Per-check restore verification evidence such as table counts, migration presence and artifact integrity.';
COMMENT ON VIEW backup_restore_p0_readiness IS
    'P0 readiness summary for successful backups and restore drills.';
