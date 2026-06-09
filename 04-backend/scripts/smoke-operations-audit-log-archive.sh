#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATABASE_URL="${ARCHITOKEN_DATABASE__URL:-${DATABASE_URL:-postgres://architoken:architoken_dev_only@127.0.0.1:5433/architoken}}"
MIGRATION_REL="04-backend/migrations/20260609000005_operations_audit_log_archive.sql"
TENANT_ID="${ARCHITOKEN_SMOKE_TENANT_ID:-11111111-1111-4111-8111-111111111111}"
PROJECT_ID="${ARCHITOKEN_SMOKE_PROJECT_ID:-5abffe50-2670-42e2-97ea-ec6ac71d8183}"

trap 'printf "smoke-operations-audit-log-archive failed at line %s\n" "${LINENO}" >&2' ERR

if ! command -v psql >/dev/null 2>&1; then
    printf 'psql is required for operations audit/log archive smoke\n' >&2
    exit 1
fi

cd "${REPO_ROOT}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${MIGRATION_REL}"

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 \
    -v tenant_id="${TENANT_ID}" \
    -v project_id="${PROJECT_ID}" <<'SQL'
SELECT set_config('app.current_tenant', :'tenant_id', false);

INSERT INTO tenants (id, name, locale, region)
VALUES (:'tenant_id', 'ArchIToken P0 运维审计租户', 'zh-CN', 'CN')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW();

INSERT INTO projects (id, tenant_id, name, description, current_module_id, location, metadata)
VALUES (
    :'project_id',
    :'tenant_id',
    'ArchIToken P0 运维审计演练项目',
    'JumpServer/日志归档 P0 smoke project',
    'settings_center',
    'ops',
    jsonb_build_object('p0Gate', 'operations_audit_log_archive')
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    current_module_id = EXCLUDED.current_module_id,
    metadata = projects.metadata || EXCLUDED.metadata,
    updated_at = NOW();

WITH instance_upsert AS (
    INSERT INTO operations_bastion_instances (
        tenant_id,
        provider,
        instance_name,
        base_url,
        network_zone,
        status,
        retention_days,
        metadata
    ) VALUES (
        :'tenant_id',
        'jumpserver',
        'srv-04-jumpserver',
        'https://jumpserver.architoken.local',
        'ops-vlan',
        'active',
        365,
        jsonb_build_object('smoke', true, 'mfa', 'required')
    )
    ON CONFLICT (tenant_id, provider, instance_name) DO UPDATE SET
        base_url = EXCLUDED.base_url,
        status = EXCLUDED.status,
        retention_days = EXCLUDED.retention_days,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING bastion_instance_id
), asset_upsert AS (
    INSERT INTO operations_bastion_assets (
        tenant_id,
        project_id,
        module_id,
        asset_kind,
        asset_name,
        environment,
        management_endpoint,
        access_policy,
        criticality,
        metadata
    ) VALUES (
        :'tenant_id',
        :'project_id',
        'settings_center',
        'database',
        'architoken-postgres-primary',
        'production',
        'postgres://postgres.internal:5432/architoken',
        'bastion_only',
        'critical',
        jsonb_build_object('smoke', true, 'owner', 'settings_center')
    )
    ON CONFLICT (tenant_id, environment, asset_kind, asset_name) DO UPDATE SET
        project_id = EXCLUDED.project_id,
        module_id = EXCLUDED.module_id,
        management_endpoint = EXCLUDED.management_endpoint,
        access_policy = EXCLUDED.access_policy,
        criticality = EXCLUDED.criticality,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING bastion_asset_id
), session_upsert AS (
    INSERT INTO operations_bastion_sessions (
        tenant_id,
        project_id,
        bastion_instance_id,
        bastion_asset_id,
        external_session_id,
        actor,
        protocol,
        source_ip,
        started_at,
        ended_at,
        duration_seconds,
        risk_level,
        session_status,
        recording_uri,
        recording_sha256,
        transcript_uri,
        transcript_sha256,
        command_count,
        archive_state,
        review_state,
        metadata
    )
    SELECT
        :'tenant_id',
        :'project_id',
        i.bastion_instance_id,
        a.bastion_asset_id,
        'jumpserver-smoke-session-20260609',
        'ops-admin',
        'database',
        '10.10.4.10'::inet,
        NOW() - INTERVAL '10 minutes',
        NOW() - INTERVAL '8 minutes',
        120,
        'high',
        'completed',
        's3://architoken-audit/jumpserver/2026/06/09/session-20260609.cast.zst',
        encode(digest('jumpserver-smoke-session-recording', 'sha256'), 'hex'),
        's3://architoken-audit/jumpserver/2026/06/09/session-20260609.transcript.jsonl.zst',
        encode(digest('jumpserver-smoke-session-transcript', 'sha256'), 'hex'),
        2,
        'verified',
        'reviewed',
        jsonb_build_object('smoke', true, 'p0Gate', 'jumpserver_log_archive')
    FROM instance_upsert i
    CROSS JOIN asset_upsert a
    ON CONFLICT (tenant_id, external_session_id) DO UPDATE SET
        recording_uri = EXCLUDED.recording_uri,
        recording_sha256 = EXCLUDED.recording_sha256,
        transcript_uri = EXCLUDED.transcript_uri,
        transcript_sha256 = EXCLUDED.transcript_sha256,
        command_count = EXCLUDED.command_count,
        archive_state = EXCLUDED.archive_state,
        review_state = EXCLUDED.review_state,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING bastion_session_id, started_at
), commands AS (
    INSERT INTO operations_bastion_command_events (
        tenant_id,
        bastion_session_id,
        sequence_no,
        executed_at,
        command_text,
        command_sha256,
        redacted,
        result_status,
        policy_decision,
        risk_level,
        metadata
    )
    SELECT
        :'tenant_id',
        s.bastion_session_id,
        c.sequence_no,
        s.started_at + (c.sequence_no || ' seconds')::interval,
        c.command_text,
        encode(digest(c.command_text, 'sha256'), 'hex'),
        TRUE,
        'succeeded',
        'allow_recorded',
        c.risk_level,
        jsonb_build_object('smoke', true)
    FROM session_upsert s
    CROSS JOIN (VALUES
        (1, 'psql -c SELECT current_database();', 'medium'),
        (2, 'pg_dump --schema-only architoken', 'high')
    ) AS c(sequence_no, command_text, risk_level)
    ON CONFLICT (tenant_id, bastion_session_id, sequence_no) DO UPDATE SET
        command_text = EXCLUDED.command_text,
        command_sha256 = EXCLUDED.command_sha256,
        result_status = EXCLUDED.result_status,
        policy_decision = EXCLUDED.policy_decision,
        risk_level = EXCLUDED.risk_level,
        metadata = EXCLUDED.metadata
    RETURNING command_event_id, bastion_session_id, sequence_no, created_at
), archive AS (
    INSERT INTO operations_log_archive_batches (
        tenant_id,
        project_id,
        source_system,
        archive_kind,
        object_uri,
        manifest_uri,
        manifest_sha256,
        item_count,
        byte_size,
        compression,
        encryption_state,
        retention_policy,
        legal_hold,
        status,
        sealed_at,
        verified_at,
        metadata
    ) VALUES (
        :'tenant_id',
        :'project_id',
        'jumpserver',
        'bastion_session',
        's3://architoken-audit/jumpserver/2026/06/09/session-archive.tar.zst',
        's3://architoken-audit/jumpserver/2026/06/09/session-archive.manifest.json',
        encode(digest('jumpserver-smoke-archive-manifest', 'sha256'), 'hex'),
        3,
        4096,
        'zstd',
        'encrypted',
        'immutable_365_days',
        FALSE,
        'verified',
        NOW(),
        NOW(),
        jsonb_build_object('smoke', true, 'contains', ARRAY['session','commands','recording'])
    )
    ON CONFLICT (tenant_id, source_system, archive_kind, manifest_sha256) DO UPDATE SET
        object_uri = EXCLUDED.object_uri,
        manifest_uri = EXCLUDED.manifest_uri,
        item_count = EXCLUDED.item_count,
        byte_size = EXCLUDED.byte_size,
        encryption_state = EXCLUDED.encryption_state,
        status = EXCLUDED.status,
        sealed_at = EXCLUDED.sealed_at,
        verified_at = EXCLUDED.verified_at,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING log_archive_batch_id
), archive_items AS (
    INSERT INTO operations_log_archive_items (
        tenant_id,
        log_archive_batch_id,
        source_table,
        source_id,
        source_created_at,
        object_uri,
        item_sha256,
        item_state,
        metadata
    )
    SELECT
        :'tenant_id',
        a.log_archive_batch_id,
        item.source_table,
        item.source_id,
        NOW(),
        item.object_uri,
        encode(digest(item.source_table || ':' || item.source_id, 'sha256'), 'hex'),
        'verified',
        jsonb_build_object('smoke', true)
    FROM archive a
    CROSS JOIN session_upsert s
    CROSS JOIN LATERAL (
        VALUES
            ('operations_bastion_sessions', s.bastion_session_id::text, 's3://architoken-audit/jumpserver/2026/06/09/session.json'),
            ('operations_bastion_command_events', s.bastion_session_id::text || ':commands', 's3://architoken-audit/jumpserver/2026/06/09/commands.jsonl'),
            ('operations_bastion_sessions', s.bastion_session_id::text || ':recording', 's3://architoken-audit/jumpserver/2026/06/09/session.cast.zst')
    ) AS item(source_table, source_id, object_uri)
    ON CONFLICT (tenant_id, log_archive_batch_id, source_table, source_id) DO UPDATE SET
        object_uri = EXCLUDED.object_uri,
        item_sha256 = EXCLUDED.item_sha256,
        item_state = EXCLUDED.item_state,
        metadata = EXCLUDED.metadata
    RETURNING log_archive_item_id
)
INSERT INTO audit_events (
    id,
    tenant_id,
    project_id,
    module_id,
    actor,
    action,
    target_type,
    target_id,
    summary,
    metadata,
    created_at
)
SELECT
    gen_random_uuid(),
    :'tenant_id',
    :'project_id',
    'settings_center',
    'smoke-operations-audit-log-archive',
    'operations_audit_log_archive_verified',
    'operations_log_archive_batch',
    a.log_archive_batch_id::text,
    'JumpServer 会话、命令审计和日志归档 P0 gate 已验证。',
    jsonb_build_object('p0Gate', 'passed', 'script', 'smoke-operations-audit-log-archive.sh'),
    NOW()
FROM archive a;

DO $$
DECLARE
    readiness_row operations_audit_log_archive_readiness%ROWTYPE;
BEGIN
    SELECT * INTO readiness_row
    FROM operations_audit_log_archive_readiness
    WHERE tenant_id = current_setting('app.current_tenant')::uuid;

    IF readiness_row.p0_gate_state IS DISTINCT FROM 'passed' THEN
        RAISE EXCEPTION 'expected operations audit/log archive gate passed, got %', readiness_row.p0_gate_state;
    END IF;
    IF readiness_row.bastion_session_count < 1 THEN
        RAISE EXCEPTION 'expected at least one bastion session';
    END IF;
    IF readiness_row.command_event_count < 2 THEN
        RAISE EXCEPTION 'expected at least two command events';
    END IF;
    IF readiness_row.archive_batch_count < 1 THEN
        RAISE EXCEPTION 'expected at least one archive batch';
    END IF;
END $$;
SQL

printf 'ArchIToken operations audit/log archive P0 smoke passed\n'
