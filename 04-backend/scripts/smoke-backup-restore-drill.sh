#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATABASE_URL="${ARCHITOKEN_DATABASE__URL:-${DATABASE_URL:-postgres://architoken:architoken_dev_only@127.0.0.1:5433/architoken}}"
MIGRATION_REL="04-backend/migrations/20260609000006_backup_restore_dr_contract.sql"
TENANT_ID="${ARCHITOKEN_SMOKE_TENANT_ID:-11111111-1111-4111-8111-111111111111}"
PROJECT_ID="${ARCHITOKEN_SMOKE_PROJECT_ID:-5abffe50-2670-42e2-97ea-ec6ac71d8183}"
BACKUP_ROOT="${ARCHITOKEN_BACKUP_DRILL_DIR:-${TMPDIR:-/tmp}/architoken-backup-drill}"
STAMP="$(date -u +%Y%m%d%H%M%S)"
RESTORE_DB="architoken_restore_drill_${STAMP}_$$"
BACKUP_DIR="${BACKUP_ROOT}/${STAMP}"
BACKUP_FILE="${BACKUP_DIR}/architoken-${STAMP}.dump"
MANIFEST_FILE="${BACKUP_DIR}/architoken-${STAMP}.manifest.json"
RESTORE_URL="${DATABASE_URL%/*}/${RESTORE_DB}"
RESTORE_CREATED=0

cleanup_restore_db() {
    if [[ "${RESTORE_CREATED}" == "1" && "${RESTORE_DB}" == architoken_restore_drill_* ]]; then
        psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS ${RESTORE_DB} WITH (FORCE)" || true
    fi
}

trap cleanup_restore_db EXIT
trap 'printf "smoke-backup-restore-drill failed at line %s\n" "${LINENO}" >&2' ERR

for binary in psql pg_dump pg_restore sha256sum stat; do
    if ! command -v "${binary}" >/dev/null 2>&1; then
        printf '%s is required for backup/restore drill\n' "${binary}" >&2
        exit 1
    fi
done

mkdir -p "${BACKUP_DIR}"
cd "${REPO_ROOT}"

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${MIGRATION_REL}"

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 \
    -v tenant_id="${TENANT_ID}" \
    -v project_id="${PROJECT_ID}" <<'SQL'
SELECT set_config('app.current_tenant', :'tenant_id', false);

INSERT INTO tenants (id, name, locale, region)
VALUES (:'tenant_id', 'ArchIToken P0 备份恢复租户', 'zh-CN', 'CN')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW();

INSERT INTO projects (id, tenant_id, name, description, current_module_id, location, metadata)
VALUES (
    :'project_id',
    :'tenant_id',
    'ArchIToken P0 备份恢复演练项目',
    'Backup/restore P0 smoke project',
    'settings_center',
    'dr',
    jsonb_build_object('p0Gate', 'backup_restore_drill')
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    current_module_id = EXCLUDED.current_module_id,
    metadata = projects.metadata || EXCLUDED.metadata,
    updated_at = NOW();

INSERT INTO backup_policies (
    tenant_id,
    policy_name,
    backup_scope,
    schedule_cron,
    retention_days,
    rpo_minutes,
    rto_minutes,
    backup_target,
    encryption_required,
    offsite_copy_required,
    immutable_lock_required,
    status,
    metadata
) VALUES
    (:'tenant_id', 'postgres-logical-daily', 'postgres', '0 2 * * *', 30, 15, 30, 's3://architoken-backup/postgres', TRUE, TRUE, TRUE, 'active', '{"tier":"p0"}'::jsonb),
    (:'tenant_id', 'object-store-daily', 'object_store', '15 2 * * *', 30, 60, 60, 's3://architoken-backup/object-store', TRUE, TRUE, TRUE, 'active', '{"tier":"p0"}'::jsonb),
    (:'tenant_id', 'config-gitops-daily', 'config', '30 2 * * *', 90, 60, 60, 's3://architoken-backup/config', TRUE, TRUE, TRUE, 'active', '{"tier":"p0"}'::jsonb),
    (:'tenant_id', 'audit-log-immutable-daily', 'audit_logs', '45 2 * * *', 365, 60, 120, 's3://architoken-backup/audit-logs', TRUE, TRUE, TRUE, 'active', '{"tier":"p0"}'::jsonb)
ON CONFLICT (tenant_id, policy_name) DO UPDATE SET
    backup_scope = EXCLUDED.backup_scope,
    schedule_cron = EXCLUDED.schedule_cron,
    retention_days = EXCLUDED.retention_days,
    rpo_minutes = EXCLUDED.rpo_minutes,
    rto_minutes = EXCLUDED.rto_minutes,
    backup_target = EXCLUDED.backup_target,
    encryption_required = EXCLUDED.encryption_required,
    offsite_copy_required = EXCLUDED.offsite_copy_required,
    immutable_lock_required = EXCLUDED.immutable_lock_required,
    status = EXCLUDED.status,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();
SQL

pg_dump "${DATABASE_URL}" --format=custom --no-owner --no-privileges --file="${BACKUP_FILE}"

BACKUP_SHA256="$(sha256sum "${BACKUP_FILE}" | awk '{print $1}')"
BACKUP_SIZE="$(stat -c%s "${BACKUP_FILE}")"
cat >"${MANIFEST_FILE}" <<EOF
{
  "schema": "architoken.backup_manifest.v1",
  "createdAt": "${STAMP}",
  "databaseUrlRedacted": true,
  "artifact": "$(basename "${BACKUP_FILE}")",
  "sha256": "${BACKUP_SHA256}",
  "sizeBytes": ${BACKUP_SIZE}
}
EOF
MANIFEST_SHA256="$(sha256sum "${MANIFEST_FILE}" | awk '{print $1}')"

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE ${RESTORE_DB}"
RESTORE_CREATED=1
pg_restore --no-owner --no-privileges --dbname="${RESTORE_URL}" "${BACKUP_FILE}"

RESTORED_TENANT_COUNT="$(psql "${RESTORE_URL}" -v ON_ERROR_STOP=1 -At -c "SELECT COUNT(*) FROM tenants WHERE id = '${TENANT_ID}'::uuid")"
RESTORED_PROJECT_COUNT="$(psql "${RESTORE_URL}" -v ON_ERROR_STOP=1 -At -c "SELECT COUNT(*) FROM projects WHERE id = '${PROJECT_ID}'::uuid")"
RESTORED_AUDIT_REGCLASS="$(psql "${RESTORE_URL}" -v ON_ERROR_STOP=1 -At -c "SELECT to_regclass('public.audit_events') IS NOT NULL")"
RESTORED_POLICY_REGCLASS="$(psql "${RESTORE_URL}" -v ON_ERROR_STOP=1 -At -c "SELECT to_regclass('public.backup_policies') IS NOT NULL")"

if [[ "${RESTORED_TENANT_COUNT}" != "1" || "${RESTORED_PROJECT_COUNT}" != "1" || "${RESTORED_AUDIT_REGCLASS}" != "t" || "${RESTORED_POLICY_REGCLASS}" != "t" ]]; then
    printf 'restore verification failed: tenant=%s project=%s audit=%s policy=%s\n' \
        "${RESTORED_TENANT_COUNT}" "${RESTORED_PROJECT_COUNT}" "${RESTORED_AUDIT_REGCLASS}" "${RESTORED_POLICY_REGCLASS}" >&2
    exit 1
fi

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 \
    -v tenant_id="${TENANT_ID}" \
    -v project_id="${PROJECT_ID}" \
    -v backup_file="${BACKUP_FILE}" \
    -v backup_sha256="${BACKUP_SHA256}" \
    -v manifest_file="${MANIFEST_FILE}" \
    -v manifest_sha256="${MANIFEST_SHA256}" \
    -v backup_size="${BACKUP_SIZE}" \
    -v restore_target="${RESTORE_DB}" \
    -v restored_tenant_count="${RESTORED_TENANT_COUNT}" \
    -v restored_project_count="${RESTORED_PROJECT_COUNT}" <<'SQL'
SELECT set_config('app.current_tenant', :'tenant_id', false);

WITH policy AS (
    SELECT backup_policy_id, tenant_id
    FROM backup_policies
    WHERE tenant_id = :'tenant_id'::uuid
      AND policy_name = 'postgres-logical-daily'
), run_upsert AS (
    INSERT INTO backup_runs (
        tenant_id,
        backup_policy_id,
        backup_kind,
        status,
        started_at,
        finished_at,
        artifact_uri,
        artifact_sha256,
        artifact_size_bytes,
        database_name,
        manifest
    )
    SELECT
        tenant_id,
        backup_policy_id,
        'postgres_logical',
        'verified',
        NOW() - INTERVAL '2 minutes',
        NOW() - INTERVAL '1 minute',
        'file://' || :'backup_file',
        :'backup_sha256',
        :'backup_size'::bigint,
        current_database(),
        jsonb_build_object(
            'manifestUri', 'file://' || :'manifest_file',
            'manifestSha256', :'manifest_sha256',
            'tool', 'pg_dump_custom',
            'smoke', true
        )
    FROM policy
    ON CONFLICT (tenant_id, backup_policy_id, artifact_sha256) DO UPDATE SET
        status = EXCLUDED.status,
        finished_at = EXCLUDED.finished_at,
        artifact_uri = EXCLUDED.artifact_uri,
        artifact_size_bytes = EXCLUDED.artifact_size_bytes,
        manifest = EXCLUDED.manifest,
        updated_at = NOW()
    RETURNING backup_run_id, tenant_id, backup_policy_id
), drill_upsert AS (
    INSERT INTO restore_drills (
        tenant_id,
        project_id,
        backup_policy_id,
        source_backup_run_id,
        drill_kind,
        restore_target,
        status,
        started_at,
        finished_at,
        rto_seconds,
        rpo_seconds,
        evidence_uri,
        verification_summary,
        metadata
    )
    SELECT
        tenant_id,
        :'project_id'::uuid,
        backup_policy_id,
        backup_run_id,
        'postgres_logical_restore',
        :'restore_target',
        'passed',
        NOW() - INTERVAL '1 minute',
        NOW(),
        60,
        0,
        'file://' || :'manifest_file',
        jsonb_build_object(
            'tenantCount', :'restored_tenant_count'::int,
            'projectCount', :'restored_project_count'::int,
            'auditEventsTable', true,
            'backupPolicyTable', true
        ),
        jsonb_build_object('smoke', true, 'restoreDatabase', :'restore_target')
    FROM run_upsert
    ON CONFLICT (tenant_id, source_backup_run_id, restore_target) DO UPDATE SET
        status = EXCLUDED.status,
        finished_at = EXCLUDED.finished_at,
        rto_seconds = EXCLUDED.rto_seconds,
        rpo_seconds = EXCLUDED.rpo_seconds,
        evidence_uri = EXCLUDED.evidence_uri,
        verification_summary = EXCLUDED.verification_summary,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING restore_drill_id, tenant_id
), checks AS (
    INSERT INTO restore_verification_items (
        tenant_id,
        restore_drill_id,
        check_name,
        expected_value,
        actual_value,
        status,
        metadata
    )
    SELECT
        tenant_id,
        restore_drill_id,
        check_name,
        expected_value,
        actual_value,
        'passed',
        jsonb_build_object('smoke', true)
    FROM drill_upsert
    CROSS JOIN (VALUES
        ('tenant_restored', '1', :'restored_tenant_count'),
        ('project_restored', '1', :'restored_project_count'),
        ('audit_events_table_restored', 'true', 'true'),
        ('backup_policy_table_restored', 'true', 'true')
    ) AS item(check_name, expected_value, actual_value)
    ON CONFLICT (tenant_id, restore_drill_id, check_name) DO UPDATE SET
        expected_value = EXCLUDED.expected_value,
        actual_value = EXCLUDED.actual_value,
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata
    RETURNING restore_verification_item_id
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
    'smoke-backup-restore-drill',
    'backup_restore_drill_passed',
    'restore_drill',
    d.restore_drill_id::text,
    'PostgreSQL 逻辑备份和临时库恢复演练 P0 gate 已验证。',
    jsonb_build_object(
        'p0Gate', 'passed',
        'backupSha256', :'backup_sha256',
        'restoreTarget', :'restore_target'
    ),
    NOW()
FROM drill_upsert d;

DO $$
DECLARE
    readiness_row backup_restore_p0_readiness%ROWTYPE;
BEGIN
    SELECT * INTO readiness_row
    FROM backup_restore_p0_readiness
    WHERE tenant_id = current_setting('app.current_tenant')::uuid;

    IF readiness_row.p0_gate_state IS DISTINCT FROM 'passed' THEN
        RAISE EXCEPTION 'expected backup/restore P0 gate passed, got %', readiness_row.p0_gate_state;
    END IF;
    IF readiness_row.active_policy_count < 4 THEN
        RAISE EXCEPTION 'expected at least 4 active backup policies, got %', readiness_row.active_policy_count;
    END IF;
    IF readiness_row.successful_backup_count < 1 THEN
        RAISE EXCEPTION 'expected at least 1 successful backup';
    END IF;
    IF readiness_row.passed_restore_drill_count < 1 THEN
        RAISE EXCEPTION 'expected at least 1 passed restore drill';
    END IF;
END $$;
SQL

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS ${RESTORE_DB} WITH (FORCE)"
RESTORE_CREATED=0

printf 'ArchIToken backup/restore DR P0 smoke passed; backup=%s\n' "${BACKUP_FILE}"
