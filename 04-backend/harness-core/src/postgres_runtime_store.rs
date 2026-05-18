//! PostgreSQL-backed runtime store for assets, jobs, executions, and audit.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Serialize, de::DeserializeOwned};
use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::{
    asset_registry::{
        AssetFileDownloadResponse, AssetFileRecord, AssetKind, AssetListQuery, AssetRecord,
        AssetStatus, AssetVersionRecord, CompleteUploadRequest, CompleteUploadResponse,
        ConversionJobActionRequest, ConversionJobListResponse, ConversionJobQuery,
        ConversionJobRecord, ConversionOperation, CreateAssetRequest, CreateAssetVersionRequest,
        CreateConversionJobRequest, ObjectStoreBindingRecord, PresignUploadRequest,
        PresignUploadResponse,
    },
    durable_store::DurableRecordMetadata,
    error::{HarnessError, Result},
    module_audit::{AuditEvent, AuditEventInput, AuditEventKind, AuditEventQuery},
    module_files::{
        CopyFileRequest, CreateModuleFileRequest, FileContentResponse, FileListQuery,
        ModuleFileKind, ModuleFileMetadata, ModuleFileNode, ModuleFileStatus, MoveFileRequest,
        ShareFileRequest, ShareFileResponse, UpdateFileContentRequest, UpdateModuleFileRequest,
    },
    module_pagination::{ListPage, paginate},
    module_registry::normalize_module_id,
    runtime_context::{PermissionGuard, RequestContext, RuntimePermission, assert_runtime_scope},
    runtime_execution::{
        AiActionPlan, CreateAiRuntimeDraftRequest, RuntimeExecutionApprovalRequest,
        RuntimeExecutionKind, RuntimeExecutionListQuery, RuntimeExecutionRecord,
        RuntimeExecutionStatus, RuntimeExecutionTraceResponse,
    },
};

const DEFAULT_BUCKET: &str = "architoken-assets";

/// Ensure the `PostgreSQL` schema required by runtime database-backed services.
///
/// # Errors
/// Returns a `SQLx` error if schema creation fails.
#[allow(clippy::too_many_lines)]
pub async fn ensure_phase7_runtime_schema(pool: &PgPool) -> Result<()> {
    sqlx::raw_sql(
        r"
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

        CREATE INDEX IF NOT EXISTS idx_assets_scope ON assets(tenant_id, project_id, created_at, asset_id);
        CREATE INDEX IF NOT EXISTS idx_asset_versions_asset ON asset_versions(asset_id, version);
        CREATE INDEX IF NOT EXISTS idx_asset_files_asset ON asset_files(asset_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_object_bindings_file ON object_store_bindings(asset_file_id);
        CREATE INDEX IF NOT EXISTS idx_conversion_jobs_scope ON conversion_jobs(tenant_id, project_id, created_at, job_id);
        CREATE INDEX IF NOT EXISTS idx_module_files_scope ON module_files(tenant_id, project_id, module_id, parent_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_module_files_file_id ON module_files(file_id);
        CREATE INDEX IF NOT EXISTS idx_runtime_executions_scope ON runtime_executions(tenant_id, project_id, created_at, execution_id);
        CREATE INDEX IF NOT EXISTS idx_audit_events_filters ON audit_events(module_id, target_type, target_id, created_at);
        ",
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Required Phase 7 database-backed runtime tables.
#[must_use]
pub const fn phase7_runtime_tables() -> &'static [&'static str] {
    &[
        "assets",
        "asset_versions",
        "asset_files",
        "object_store_bindings",
        "conversion_jobs",
        "module_files",
        "runtime_executions",
        "audit_events",
    ]
}

/// List module CDE files visible to a context from `PostgreSQL`.
///
/// # Errors
/// Returns permission, pagination, enum, or database errors.
pub async fn list_module_files(
    pool: &PgPool,
    context: &RequestContext,
    module_id: &str,
    query: &FileListQuery,
) -> Result<ListPage<ModuleFileNode>> {
    PermissionGuard::ensure(context, RuntimePermission::ArtifactRead)?;
    let module_id = normalize_module_id(module_id)
        .ok_or_else(|| HarnessError::NotFound(format!("module_id={module_id}")))?;
    let rows = sqlx::query_as::<_, ModuleFileRow>(
        r"
        SELECT id, tenant_id, project_id, file_id, module_id, parent_id, name,
               kind, status, size_bytes, mime_type, checksum, version, owner,
               tags::text AS tags, content, created_at, updated_at, created_by
        FROM module_files
        WHERE tenant_id = $1 AND project_id = $2 AND module_id = $3
        ORDER BY kind ASC, name ASC, file_id ASC
        ",
    )
    .bind(&context.tenant_id)
    .bind(&context.project_id)
    .bind(module_id.as_str())
    .fetch_all(pool)
    .await?;
    let mut items = rows
        .into_iter()
        .map(ModuleFileNode::try_from)
        .collect::<Result<Vec<_>>>()?;
    items.retain(|file| {
        query
            .parent_id
            .is_none_or(|parent_id| file.parent_id == Some(parent_id))
    });
    items.retain(|file| query.status.is_none_or(|status| file.status == status));
    items.retain(|file| query.kind.is_none_or(|kind| file.kind == kind));
    paginate(&items, query.limit, query.cursor.as_deref())
}

/// Create one module CDE file or folder in `PostgreSQL`.
///
/// # Errors
/// Returns permission, validation, parent, or database errors.
pub async fn create_module_file(
    pool: &PgPool,
    context: &RequestContext,
    module_id: &str,
    req: CreateModuleFileRequest,
) -> Result<ModuleFileNode> {
    PermissionGuard::ensure(context, RuntimePermission::ArtifactWrite)?;
    let module_id = normalize_module_id(module_id)
        .ok_or_else(|| HarnessError::NotFound(format!("module_id={module_id}")))?;
    validate_required("file name", &req.name)?;
    validate_module_file_parent(pool, context, module_id.as_str(), req.parent_id).await?;

    let now = Utc::now();
    let file_id = Uuid::new_v4();
    let owner = req.owner.unwrap_or_else(|| context.actor.clone());
    let tags = req.tags.unwrap_or_default();
    let file_content = req.content.unwrap_or_default();
    let row = ModuleFileRow {
        id: Uuid::new_v4(),
        tenant_id: context.tenant_id.clone(),
        project_id: context.project_id.clone(),
        file_id,
        module_id: module_id.as_str().to_owned(),
        parent_id: req.parent_id,
        name: req.name,
        kind: enum_to_db(req.kind)?,
        status: enum_to_db(ModuleFileStatus::Active)?,
        size_bytes: i64::try_from(req.size_bytes.unwrap_or(0)).map_err(|_| {
            HarnessError::InvalidInput("file size does not fit signed database column".to_owned())
        })?,
        mime_type: req.mime_type,
        checksum: None,
        version: 1,
        owner,
        tags: serde_json::to_string(&tags)?,
        content: file_content,
        created_at: now,
        updated_at: now,
        created_by: Some(context.actor.clone()),
    };
    let mut tx = pool.begin().await?;
    insert_module_file_row(&mut tx, &row).await?;
    append_module_file_audit_tx(
        &mut tx,
        context,
        &row,
        AuditEventKind::FileCreated,
        "module file created",
    )
    .await?;
    tx.commit().await?;
    ModuleFileNode::try_from(row)
}

/// Read one module CDE file visible to a context.
///
/// # Errors
/// Returns permission, scope, not-found, enum, or database errors.
pub async fn get_module_file(
    pool: &PgPool,
    context: &RequestContext,
    file_id: Uuid,
) -> Result<ModuleFileNode> {
    PermissionGuard::ensure(context, RuntimePermission::ArtifactRead)?;
    get_module_file_row(pool, context, file_id)
        .await
        .and_then(ModuleFileNode::try_from)
}

/// Update module CDE file metadata.
///
/// # Errors
/// Returns permission, validation, scope, or database errors.
pub async fn update_module_file(
    pool: &PgPool,
    context: &RequestContext,
    file_id: Uuid,
    req: UpdateModuleFileRequest,
) -> Result<ModuleFileNode> {
    PermissionGuard::ensure(context, RuntimePermission::ArtifactWrite)?;
    if let Some(name) = req.name.as_deref() {
        validate_required("file name", name)?;
    }
    let tags = req.tags.as_ref().map(serde_json::to_string).transpose()?;
    let row = sqlx::query_as::<_, ModuleFileRow>(
        r"
        UPDATE module_files
        SET name = COALESCE($4, name),
            owner = COALESCE($5, owner),
            tags = COALESCE($6::jsonb, tags),
            mime_type = COALESCE($7, mime_type),
            version = version + 1,
            updated_at = $8
        WHERE tenant_id = $1 AND project_id = $2 AND file_id = $3
        RETURNING id, tenant_id, project_id, file_id, module_id, parent_id, name,
                  kind, status, size_bytes, mime_type, checksum, version, owner,
                  tags::text AS tags, content, created_at, updated_at, created_by
        ",
    )
    .bind(&context.tenant_id)
    .bind(&context.project_id)
    .bind(file_id)
    .bind(req.name)
    .bind(req.owner)
    .bind(tags)
    .bind(req.mime_type)
    .bind(Utc::now())
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
    append_audit_event(
        pool,
        context,
        module_file_audit_input(
            context,
            &row,
            AuditEventKind::FileUpdated,
            "module file updated",
        ),
    )
    .await?;
    ModuleFileNode::try_from(row)
}

/// Return metadata for one module CDE file.
///
/// # Errors
/// Returns permission, scope, not-found, enum, or database errors.
pub async fn module_file_metadata(
    pool: &PgPool,
    context: &RequestContext,
    file_id: Uuid,
) -> Result<ModuleFileMetadata> {
    get_module_file(pool, context, file_id)
        .await
        .map(|file| file.metadata)
}

/// Read small development content for one module CDE file.
///
/// # Errors
/// Returns permission, scope, not-found, folder, enum, or database errors.
pub async fn module_file_content(
    pool: &PgPool,
    context: &RequestContext,
    file_id: Uuid,
) -> Result<FileContentResponse> {
    PermissionGuard::ensure(context, RuntimePermission::ArtifactRead)?;
    let row = get_module_file_row(pool, context, file_id).await?;
    if enum_from_db::<ModuleFileKind>(&row.kind, "module_file.kind")? != ModuleFileKind::File {
        return Err(HarnessError::InvalidInput(
            "folder nodes do not have content".to_owned(),
        ));
    }
    Ok(FileContentResponse {
        file_id,
        content: row.content,
        content_type: row.mime_type,
        updated_at: row.updated_at,
    })
}

/// Replace content for one module CDE file.
///
/// # Errors
/// Returns permission, validation, scope, not-found, enum, or database errors.
pub async fn update_module_file_content(
    pool: &PgPool,
    context: &RequestContext,
    file_id: Uuid,
    req: UpdateFileContentRequest,
) -> Result<FileContentResponse> {
    PermissionGuard::ensure(context, RuntimePermission::ArtifactWrite)?;
    let existing = get_module_file_row(pool, context, file_id).await?;
    if enum_from_db::<ModuleFileKind>(&existing.kind, "module_file.kind")? != ModuleFileKind::File {
        return Err(HarnessError::InvalidInput(
            "folder nodes do not have content".to_owned(),
        ));
    }
    let updated_at = Utc::now();
    let content_size = i64::try_from(req.content.len()).map_err(|_| {
        HarnessError::InvalidInput("file content is too large for database metadata".to_owned())
    })?;
    let row = sqlx::query_as::<_, ModuleFileRow>(
        r"
        UPDATE module_files
        SET content = $4,
            size_bytes = $5,
            mime_type = COALESCE($6, mime_type),
            version = version + 1,
            updated_at = $7
        WHERE tenant_id = $1 AND project_id = $2 AND file_id = $3
        RETURNING id, tenant_id, project_id, file_id, module_id, parent_id, name,
                  kind, status, size_bytes, mime_type, checksum, version, owner,
                  tags::text AS tags, content, created_at, updated_at, created_by
        ",
    )
    .bind(&context.tenant_id)
    .bind(&context.project_id)
    .bind(file_id)
    .bind(req.content)
    .bind(content_size)
    .bind(req.content_type)
    .bind(updated_at)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
    append_audit_event(
        pool,
        context,
        module_file_audit_input(
            context,
            &row,
            AuditEventKind::FileContentUpdated,
            "module file content updated",
        ),
    )
    .await?;
    Ok(FileContentResponse {
        file_id,
        content: row.content,
        content_type: row.mime_type,
        updated_at: row.updated_at,
    })
}

/// Move one module CDE file.
///
/// # Errors
/// Returns permission, parent, scope, not-found, enum, or database errors.
pub async fn move_module_file(
    pool: &PgPool,
    context: &RequestContext,
    file_id: Uuid,
    req: MoveFileRequest,
) -> Result<ModuleFileNode> {
    PermissionGuard::ensure(context, RuntimePermission::ArtifactWrite)?;
    let existing = get_module_file_row(pool, context, file_id).await?;
    validate_module_file_parent(pool, context, &existing.module_id, req.target_parent_id).await?;
    let row = sqlx::query_as::<_, ModuleFileRow>(
        r"
        UPDATE module_files
        SET parent_id = $4,
            version = version + 1,
            updated_at = $5
        WHERE tenant_id = $1 AND project_id = $2 AND file_id = $3
        RETURNING id, tenant_id, project_id, file_id, module_id, parent_id, name,
                  kind, status, size_bytes, mime_type, checksum, version, owner,
                  tags::text AS tags, content, created_at, updated_at, created_by
        ",
    )
    .bind(&context.tenant_id)
    .bind(&context.project_id)
    .bind(file_id)
    .bind(req.target_parent_id)
    .bind(Utc::now())
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
    append_audit_event(
        pool,
        context,
        module_file_audit_input(
            context,
            &row,
            AuditEventKind::FileMoved,
            "module file moved",
        ),
    )
    .await?;
    ModuleFileNode::try_from(row)
}

/// Copy one module CDE file.
///
/// # Errors
/// Returns permission, parent, scope, not-found, enum, or database errors.
pub async fn copy_module_file(
    pool: &PgPool,
    context: &RequestContext,
    file_id: Uuid,
    req: CopyFileRequest,
) -> Result<ModuleFileNode> {
    PermissionGuard::ensure(context, RuntimePermission::ArtifactWrite)?;
    let source = get_module_file_row(pool, context, file_id).await?;
    let target_module_id = match req.target_module_id.as_deref() {
        Some(module_id) => normalize_module_id(module_id)
            .ok_or_else(|| HarnessError::NotFound(format!("module_id={module_id}")))?,
        None => normalize_module_id(&source.module_id)
            .ok_or_else(|| HarnessError::NotFound(source.module_id.clone()))?,
    };
    validate_module_file_parent(
        pool,
        context,
        target_module_id.as_str(),
        req.target_parent_id,
    )
    .await?;
    let now = Utc::now();
    let row = ModuleFileRow {
        id: Uuid::new_v4(),
        tenant_id: context.tenant_id.clone(),
        project_id: context.project_id.clone(),
        file_id: Uuid::new_v4(),
        module_id: target_module_id.as_str().to_owned(),
        parent_id: req.target_parent_id,
        name: req.name.unwrap_or_else(|| format!("{} copy", source.name)),
        kind: source.kind,
        status: enum_to_db(ModuleFileStatus::Active)?,
        size_bytes: source.size_bytes,
        mime_type: source.mime_type,
        checksum: source.checksum,
        version: 1,
        owner: source.owner,
        tags: source.tags,
        content: source.content,
        created_at: now,
        updated_at: now,
        created_by: Some(context.actor.clone()),
    };
    let mut tx = pool.begin().await?;
    insert_module_file_row(&mut tx, &row).await?;
    append_module_file_audit_tx(
        &mut tx,
        context,
        &row,
        AuditEventKind::FileCopied,
        "module file copied",
    )
    .await?;
    tx.commit().await?;
    ModuleFileNode::try_from(row)
}

/// Share one module CDE file.
///
/// # Errors
/// Returns permission, scope, not-found, enum, or database errors.
pub async fn share_module_file(
    pool: &PgPool,
    context: &RequestContext,
    file_id: Uuid,
    req: ShareFileRequest,
) -> Result<ShareFileResponse> {
    PermissionGuard::ensure(context, RuntimePermission::ArtifactWrite)?;
    let row = sqlx::query_as::<_, ModuleFileRow>(
        r"
        UPDATE module_files
        SET status = $4,
            updated_at = $5
        WHERE tenant_id = $1 AND project_id = $2 AND file_id = $3
        RETURNING id, tenant_id, project_id, file_id, module_id, parent_id, name,
                  kind, status, size_bytes, mime_type, checksum, version, owner,
                  tags::text AS tags, content, created_at, updated_at, created_by
        ",
    )
    .bind(&context.tenant_id)
    .bind(&context.project_id)
    .bind(file_id)
    .bind(enum_to_db(ModuleFileStatus::Shared)?)
    .bind(Utc::now())
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
    append_audit_event(
        pool,
        context,
        module_file_audit_input(
            context,
            &row,
            AuditEventKind::FileShared,
            "module file shared",
        ),
    )
    .await?;
    Ok(ShareFileResponse {
        file_id,
        share_url: format!("/v1/files/{file_id}/shared/{}", Uuid::new_v4()),
        permissions: req.permissions,
        expires_at: req.expires_at,
    })
}

/// Soft-delete one module CDE file.
///
/// # Errors
/// Returns permission, scope, not-found, enum, or database errors.
pub async fn trash_module_file(
    pool: &PgPool,
    context: &RequestContext,
    file_id: Uuid,
) -> Result<ModuleFileNode> {
    PermissionGuard::ensure(context, RuntimePermission::ArtifactWrite)?;
    let row = sqlx::query_as::<_, ModuleFileRow>(
        r"
        UPDATE module_files
        SET status = $4,
            updated_at = $5
        WHERE tenant_id = $1 AND project_id = $2 AND file_id = $3
        RETURNING id, tenant_id, project_id, file_id, module_id, parent_id, name,
                  kind, status, size_bytes, mime_type, checksum, version, owner,
                  tags::text AS tags, content, created_at, updated_at, created_by
        ",
    )
    .bind(&context.tenant_id)
    .bind(&context.project_id)
    .bind(file_id)
    .bind(enum_to_db(ModuleFileStatus::SoftDeleted)?)
    .bind(Utc::now())
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
    append_audit_event(
        pool,
        context,
        module_file_audit_input(
            context,
            &row,
            AuditEventKind::FileTrashed,
            "module file trashed",
        ),
    )
    .await?;
    ModuleFileNode::try_from(row)
}

/// Create an asset and its first version in `PostgreSQL`.
///
/// # Errors
/// Returns permission, validation, or database errors.
pub async fn create_asset(
    pool: &PgPool,
    context: &RequestContext,
    req: CreateAssetRequest,
) -> Result<AssetRecord> {
    PermissionGuard::ensure(context, RuntimePermission::AssetWrite)?;
    validate_required("name", &req.name)?;
    let now = Utc::now();
    let asset_id = Uuid::new_v4();
    let metadata = DurableRecordMetadata {
        id: asset_id,
        tenant_id: context.tenant_id.clone(),
        project_id: Some(context.project_id.clone()),
        created_at: now,
        updated_at: now,
        created_by: Some(context.actor.clone()),
    };
    let asset = AssetRecord {
        metadata: metadata.clone(),
        asset_id,
        kind: req.kind,
        name: req.name,
        status: AssetStatus::Draft,
        source_format: req.source_format,
        canonical_format: req.canonical_format,
        payload: with_context(req.metadata, context),
    };
    let version = AssetVersionRecord {
        metadata: DurableRecordMetadata {
            id: Uuid::new_v4(),
            ..metadata
        },
        asset_id,
        version: 1,
        status: AssetStatus::Draft,
        payload: with_context(json!({ "initial": true }), context),
    };
    let mut tx = pool.begin().await?;
    insert_asset(&mut tx, &asset).await?;
    insert_asset_version(&mut tx, &version).await?;
    append_audit_event_tx(
        &mut tx,
        context,
        AuditEventInput {
            module_id: "digital_twin".to_owned(),
            actor: context.actor.clone(),
            action: AuditEventKind::AssetCreated,
            target_type: "asset".to_owned(),
            target_id: asset_id.to_string(),
            summary: "asset created".to_owned(),
            metadata: json!({ "context": context.audit_json(), "assetId": asset_id }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(asset)
}

/// List assets visible to a context.
///
/// # Errors
/// Returns permission, pagination, enum, or database errors.
pub async fn list_assets(
    pool: &PgPool,
    context: &RequestContext,
    query: &AssetListQuery,
) -> Result<ListPage<AssetRecord>> {
    PermissionGuard::ensure(context, RuntimePermission::AssetRead)?;
    let rows = sqlx::query_as::<_, AssetRow>(
        r"
        SELECT id, tenant_id, project_id, asset_id, kind, name, status, source_format,
               canonical_format, metadata::text AS payload, created_at, updated_at, created_by
        FROM assets
        WHERE tenant_id = $1 AND project_id = $2
        ORDER BY created_at ASC, asset_id ASC
        ",
    )
    .bind(&context.tenant_id)
    .bind(&context.project_id)
    .fetch_all(pool)
    .await?;
    let mut items = rows
        .into_iter()
        .map(AssetRecord::try_from)
        .collect::<Result<Vec<_>>>()?;
    items.retain(|asset| query.kind.is_none_or(|kind| asset.kind == kind));
    items.retain(|asset| query.status.is_none_or(|status| asset.status == status));
    paginate(&items, query.limit, query.cursor.as_deref())
}

/// Read one asset visible to a context.
///
/// # Errors
/// Returns permission, scope, not-found, enum, or database errors.
pub async fn get_asset(
    pool: &PgPool,
    context: &RequestContext,
    asset_id: Uuid,
) -> Result<AssetRecord> {
    PermissionGuard::ensure(context, RuntimePermission::AssetRead)?;
    let asset = get_asset_unscoped(pool, asset_id).await?;
    assert_asset_scope(context, &asset)?;
    Ok(asset)
}

/// Create one asset version.
///
/// # Errors
/// Returns permission, scope, validation, or database errors.
pub async fn create_asset_version(
    pool: &PgPool,
    context: &RequestContext,
    asset_id: Uuid,
    req: CreateAssetVersionRequest,
) -> Result<AssetVersionRecord> {
    PermissionGuard::ensure(context, RuntimePermission::AssetWrite)?;
    let asset = get_asset_unscoped(pool, asset_id).await?;
    assert_asset_scope(context, &asset)?;
    let next = sqlx::query_scalar::<_, i32>(
        "SELECT COALESCE(MAX(version), 0) + 1 FROM asset_versions WHERE asset_id = $1",
    )
    .bind(asset_id)
    .fetch_one(pool)
    .await?;
    let version = AssetVersionRecord {
        metadata: DurableRecordMetadata::new(
            context.tenant_id.clone(),
            Some(context.project_id.clone()),
            Some(req.actor.unwrap_or_else(|| context.actor.clone())),
        ),
        asset_id,
        version: u32::try_from(next).map_err(|_| {
            HarnessError::InvalidInput(format!("asset version overflow for {asset_id}"))
        })?,
        status: req.status.unwrap_or(AssetStatus::Draft),
        payload: with_context(req.metadata, context),
    };
    let mut tx = pool.begin().await?;
    insert_asset_version(&mut tx, &version).await?;
    append_audit_event_tx(
        &mut tx,
        context,
        AuditEventInput {
            module_id: "digital_twin".to_owned(),
            actor: context.actor.clone(),
            action: AuditEventKind::AssetVersionCreated,
            target_type: "asset".to_owned(),
            target_id: asset_id.to_string(),
            summary: "asset version created".to_owned(),
            metadata: json!({ "context": context.audit_json(), "assetId": asset_id }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(version)
}

/// List versions for one asset.
///
/// # Errors
/// Returns permission, scope, enum, or database errors.
pub async fn list_asset_versions(
    pool: &PgPool,
    context: &RequestContext,
    asset_id: Uuid,
) -> Result<Vec<AssetVersionRecord>> {
    PermissionGuard::ensure(context, RuntimePermission::AssetRead)?;
    let asset = get_asset_unscoped(pool, asset_id).await?;
    assert_asset_scope(context, &asset)?;
    let rows = sqlx::query_as::<_, AssetVersionRow>(
        r"
        SELECT id, tenant_id, project_id, asset_id, version, status,
               metadata::text AS payload, created_at, updated_at, created_by
        FROM asset_versions
        WHERE asset_id = $1
        ORDER BY version ASC
        ",
    )
    .bind(asset_id)
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(AssetVersionRecord::try_from).collect()
}

/// Prepare an upload URL after verifying the asset exists in `PostgreSQL`.
///
/// # Errors
/// Returns permission, scope, or validation errors.
pub async fn presign_upload(
    pool: &PgPool,
    context: &RequestContext,
    asset_id: Uuid,
    req: PresignUploadRequest,
) -> Result<PresignUploadResponse> {
    PermissionGuard::ensure(context, RuntimePermission::AssetWrite)?;
    validate_required("file_name", &req.file_name)?;
    validate_required("content_type", &req.content_type)?;
    let asset = get_asset_unscoped(pool, asset_id).await?;
    assert_asset_scope(context, &asset)?;
    let file_id = Uuid::new_v4();
    let key = format!(
        "{}/{}/{asset_id}/{file_id}/{}",
        context.tenant_id,
        context.project_id,
        sanitize_key_segment(&req.file_name)
    );
    Ok(PresignUploadResponse {
        asset_id,
        file_id,
        method: "PUT".to_owned(),
        upload_url: object_store_url(&object_store_bucket(), &key),
        headers: HashMap::from([("content-type".to_owned(), req.content_type)]),
        expires_at: Utc::now() + chrono::Duration::minutes(15),
    })
}

/// Complete upload metadata and object-store binding in `PostgreSQL`.
///
/// # Errors
/// Returns permission, scope, validation, duplicate, or database errors.
pub async fn complete_upload(
    pool: &PgPool,
    context: &RequestContext,
    asset_id: Uuid,
    req: CompleteUploadRequest,
) -> Result<CompleteUploadResponse> {
    PermissionGuard::ensure(context, RuntimePermission::AssetWrite)?;
    validate_required("key", &req.key)?;
    validate_required("content_type", &req.content_type)?;
    let asset = get_asset_unscoped(pool, asset_id).await?;
    assert_asset_scope(context, &asset)?;
    let version_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM asset_versions WHERE asset_id = $1 ORDER BY version DESC LIMIT 1",
    )
    .bind(asset_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("asset versions for {asset_id}")))?;
    let file = AssetFileRecord {
        metadata: DurableRecordMetadata {
            id: req.file_id,
            tenant_id: context.tenant_id.clone(),
            project_id: Some(context.project_id.clone()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            created_by: Some(req.actor.clone().unwrap_or_else(|| context.actor.clone())),
        },
        asset_id,
        asset_version_id: version_id,
        role: req.role.unwrap_or_else(|| "source".to_owned()),
        format: req.format.unwrap_or_else(|| "unknown".to_owned()),
        payload: with_context(json!({ "completed": true }), context),
    };
    let binding = ObjectStoreBindingRecord {
        metadata: DurableRecordMetadata::new(
            context.tenant_id.clone(),
            Some(context.project_id.clone()),
            Some(context.actor.clone()),
        ),
        asset_id,
        asset_file_id: req.file_id,
        bucket: req.bucket.unwrap_or_else(object_store_bucket),
        key: req.key,
        size_bytes: req.size_bytes,
        content_type: req.content_type,
        checksum_sha256: req.checksum_sha256,
        storage_class: req.storage_class.unwrap_or_else(|| "standard".to_owned()),
    };
    let mut tx = pool.begin().await?;
    insert_asset_file(&mut tx, &file).await?;
    insert_object_binding(&mut tx, &binding).await?;
    append_audit_event_tx(
        &mut tx,
        context,
        AuditEventInput {
            module_id: "digital_twin".to_owned(),
            actor: context.actor.clone(),
            action: AuditEventKind::AssetFileCompleted,
            target_type: "asset".to_owned(),
            target_id: asset_id.to_string(),
            summary: "asset file completed".to_owned(),
            metadata: json!({ "context": context.audit_json(), "assetId": asset_id, "fileId": file.metadata.id }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(CompleteUploadResponse { file, binding })
}

/// Prepare a download URL for one asset file.
///
/// # Errors
/// Returns permission, scope, not-found, or database errors.
pub async fn download_file(
    pool: &PgPool,
    context: &RequestContext,
    asset_id: Uuid,
    file_id: Uuid,
) -> Result<AssetFileDownloadResponse> {
    PermissionGuard::ensure(context, RuntimePermission::AssetRead)?;
    let asset = get_asset_unscoped(pool, asset_id).await?;
    assert_asset_scope(context, &asset)?;
    let file_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM asset_files WHERE id = $1 AND asset_id = $2)",
    )
    .bind(file_id)
    .bind(asset_id)
    .fetch_one(pool)
    .await?;
    if !file_exists {
        return Err(HarnessError::NotFound(format!("file_id={file_id}")));
    }
    let row = sqlx::query_as::<_, ObjectBindingRow>(
        r"
        SELECT id, tenant_id, project_id, asset_id, asset_file_id, bucket, key,
               size_bytes, content_type, checksum_sha256, storage_class,
               created_at, updated_at, created_by
        FROM object_store_bindings
        WHERE asset_file_id = $1 AND asset_id = $2
        ",
    )
    .bind(file_id)
    .bind(asset_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
    let binding = ObjectStoreBindingRecord::try_from(row)?;
    assert_runtime_scope(
        context,
        &binding.metadata.tenant_id,
        binding.metadata.project_id.as_deref().unwrap_or_default(),
    )?;
    append_audit_event(
        pool,
        context,
        AuditEventInput {
            module_id: "digital_twin".to_owned(),
            actor: context.actor.clone(),
            action: AuditEventKind::AssetFileDownloadRequested,
            target_type: "asset".to_owned(),
            target_id: asset_id.to_string(),
            summary: "asset file download requested".to_owned(),
            metadata: json!({ "context": context.audit_json(), "assetId": asset_id, "fileId": file_id }),
        },
    )
    .await?;
    Ok(AssetFileDownloadResponse {
        asset_id,
        file_id,
        download_url: object_store_url(&binding.bucket, &binding.key),
        binding,
    })
}

/// Create a conversion job in `PostgreSQL`.
///
/// # Errors
/// Returns permission, scope, not-found, validation, or database errors.
pub async fn create_conversion_job(
    pool: &PgPool,
    context: &RequestContext,
    req: CreateConversionJobRequest,
) -> Result<ConversionJobRecord> {
    PermissionGuard::ensure(context, RuntimePermission::ConversionRun)?;
    let asset = get_asset_unscoped(pool, req.source_asset_id).await?;
    assert_asset_scope(context, &asset)?;
    let file = get_asset_file_unscoped(pool, req.source_asset_id, req.source_file_id).await?;
    assert_runtime_scope(
        context,
        &file.metadata.tenant_id,
        file.metadata.project_id.as_deref().unwrap_or_default(),
    )?;
    let job_id = Uuid::new_v4();
    let job = ConversionJobRecord {
        metadata: DurableRecordMetadata::new(
            context.tenant_id.clone(),
            Some(context.project_id.clone()),
            Some(req.actor.unwrap_or_else(|| context.actor.clone())),
        ),
        job_id,
        operation: req.operation,
        source_asset_id: req.source_asset_id,
        source_file_id: req.source_file_id,
        status: "queued".to_owned(),
        input: with_context(req.input, context),
        output: json!({}),
        error: json!({}),
        started_at: None,
        finished_at: None,
    };
    let mut tx = pool.begin().await?;
    insert_conversion_job(&mut tx, &job).await?;
    append_audit_event_tx(
        &mut tx,
        context,
        AuditEventInput {
            module_id: "digital_twin".to_owned(),
            actor: context.actor.clone(),
            action: AuditEventKind::ConversionJobCreated,
            target_type: "asset".to_owned(),
            target_id: req.source_asset_id.to_string(),
            summary: "conversion job created".to_owned(),
            metadata: json!({ "context": context.audit_json(), "jobId": job_id }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(job)
}

/// List conversion jobs visible to a context.
///
/// # Errors
/// Returns permission, pagination, enum, or database errors.
pub async fn list_conversion_jobs(
    pool: &PgPool,
    context: &RequestContext,
    query: &ConversionJobQuery,
) -> Result<ConversionJobListResponse> {
    PermissionGuard::ensure(context, RuntimePermission::AssetRead)?;
    let rows = sqlx::query_as::<_, ConversionJobRow>(
        r"
        SELECT id, tenant_id, project_id, job_id, operation, source_asset_id, source_file_id,
               status, input::text AS input, output::text AS output, error::text AS error,
               started_at, finished_at, created_at, updated_at, created_by
        FROM conversion_jobs
        WHERE tenant_id = $1 AND project_id = $2
        ORDER BY created_at ASC, job_id ASC
        ",
    )
    .bind(&context.tenant_id)
    .bind(&context.project_id)
    .fetch_all(pool)
    .await?;
    let mut items = rows
        .into_iter()
        .map(ConversionJobRecord::try_from)
        .collect::<Result<Vec<_>>>()?;
    items.retain(|job| {
        query
            .operation
            .is_none_or(|operation| job.operation == operation)
    });
    items.retain(|job| {
        query
            .status
            .as_ref()
            .is_none_or(|status| &job.status == status)
    });
    let page = paginate(&items, query.limit, query.cursor.as_deref())?;
    Ok(ConversionJobListResponse {
        total: page.items.len(),
        jobs: page.items,
        page_info: page.page_info,
    })
}

/// Read one conversion job.
///
/// # Errors
/// Returns permission, scope, not-found, enum, or database errors.
pub async fn get_conversion_job(
    pool: &PgPool,
    context: &RequestContext,
    job_id: Uuid,
) -> Result<ConversionJobRecord> {
    PermissionGuard::ensure(context, RuntimePermission::AssetRead)?;
    let job = get_conversion_job_unscoped(pool, job_id).await?;
    assert_job_scope(context, &job)?;
    Ok(job)
}

/// Cancel one conversion job.
///
/// # Errors
/// Returns permission, scope, invalid-state, or database errors.
pub async fn cancel_conversion_job(
    pool: &PgPool,
    context: &RequestContext,
    job_id: Uuid,
    req: ConversionJobActionRequest,
) -> Result<ConversionJobRecord> {
    PermissionGuard::ensure(context, RuntimePermission::ConversionRun)?;
    let mut job = get_conversion_job_unscoped(pool, job_id).await?;
    assert_job_scope(context, &job)?;
    if matches!(job.status.as_str(), "completed" | "failed" | "cancelled") {
        return Err(HarnessError::InvalidInput(format!(
            "conversion job {job_id} is terminal"
        )));
    }
    "cancelled".clone_into(&mut job.status);
    job.finished_at = Some(Utc::now());
    job.error = with_context(
        json!({ "reason": req.reason.unwrap_or_else(|| "cancelled".to_owned()) }),
        context,
    );
    job.metadata.updated_at = Utc::now();
    let mut tx = pool.begin().await?;
    update_conversion_job(&mut tx, &job).await?;
    append_conversion_audit_tx(
        &mut tx,
        &job,
        AuditEventKind::ConversionJobCancelled,
        "conversion job cancelled",
    )
    .await?;
    tx.commit().await?;
    Ok(job)
}

/// Mark a conversion job as dispatched.
///
/// # Errors
/// Returns not-found or database errors.
pub async fn mark_conversion_job_dispatched(
    pool: &PgPool,
    job_id: Uuid,
    queue_subject: &str,
) -> Result<ConversionJobRecord> {
    let mut job = get_conversion_job_unscoped(pool, job_id).await?;
    "dispatched".clone_into(&mut job.status);
    job.started_at = Some(Utc::now());
    job.output = json!({ "dispatch": { "queue": "nats", "subject": queue_subject } });
    job.metadata.updated_at = Utc::now();
    let mut tx = pool.begin().await?;
    update_conversion_job(&mut tx, &job).await?;
    append_conversion_audit_tx(
        &mut tx,
        &job,
        AuditEventKind::ConversionJobDispatched,
        "conversion job dispatched",
    )
    .await?;
    tx.commit().await?;
    Ok(job)
}

/// Mark dispatch failure in `PostgreSQL`.
///
/// # Errors
/// Returns not-found or database errors.
pub async fn fail_conversion_job_dispatch(
    pool: &PgPool,
    job_id: Uuid,
    reason: &str,
) -> Result<ConversionJobRecord> {
    let mut job = get_conversion_job_unscoped(pool, job_id).await?;
    "failed".clone_into(&mut job.status);
    job.error = json!({ "code": "conversion_dispatch_failed", "message": reason });
    job.finished_at = Some(Utc::now());
    job.metadata.updated_at = Utc::now();
    let mut tx = pool.begin().await?;
    update_conversion_job(&mut tx, &job).await?;
    append_conversion_audit_tx(
        &mut tx,
        &job,
        AuditEventKind::ConversionJobFailed,
        "conversion job dispatch failed",
    )
    .await?;
    tx.commit().await?;
    Ok(job)
}

/// Apply a trusted worker result to a conversion job.
///
/// # Errors
/// Returns not-found, invalid status, or database errors.
pub async fn apply_conversion_job_worker_result(
    pool: &PgPool,
    job_id: Uuid,
    status: &str,
    output: Value,
    error: Value,
) -> Result<ConversionJobRecord> {
    if !matches!(
        status,
        "queued" | "dispatched" | "running" | "completed" | "failed" | "blocked" | "cancelled"
    ) {
        return Err(HarnessError::InvalidInput(format!(
            "unsupported conversion worker status: {status}"
        )));
    }
    let mut job = get_conversion_job_unscoped(pool, job_id).await?;
    if job.status == "cancelled" {
        return Err(HarnessError::InvalidInput(format!(
            "conversion job {job_id} is cancelled"
        )));
    }
    job.status = status.to_owned();
    job.output = output;
    job.error = error;
    if job.started_at.is_none() {
        job.started_at = Some(Utc::now());
    }
    if matches!(status, "completed" | "failed" | "blocked" | "cancelled") {
        job.finished_at = Some(Utc::now());
    }
    job.metadata.updated_at = Utc::now();
    let mut tx = pool.begin().await?;
    update_conversion_job(&mut tx, &job).await?;
    append_conversion_audit_tx(
        &mut tx,
        &job,
        if status == "completed" {
            AuditEventKind::ConversionJobCompleted
        } else {
            AuditEventKind::ConversionJobFailed
        },
        "conversion job worker result applied",
    )
    .await?;
    tx.commit().await?;
    Ok(job)
}

/// Create an approval-gated AI runtime draft in `PostgreSQL`.
///
/// # Errors
/// Returns permission, validation, or database errors.
pub async fn create_ai_runtime_draft(
    pool: &PgPool,
    context: &RequestContext,
    req: CreateAiRuntimeDraftRequest,
) -> Result<RuntimeExecutionRecord> {
    PermissionGuard::ensure(context, RuntimePermission::GenerationCreate)?;
    reject_direct_asset_mutation(&req.action_plan)?;
    let now = Utc::now();
    let execution_id = Uuid::new_v4();
    let actor = req.actor.clone().unwrap_or_else(|| context.actor.clone());
    let record = RuntimeExecutionRecord {
        metadata: DurableRecordMetadata {
            id: Uuid::new_v4(),
            tenant_id: context.tenant_id.clone(),
            project_id: Some(context.project_id.clone()),
            created_at: now,
            updated_at: now,
            created_by: Some(actor.clone()),
        },
        execution_id,
        kind: RuntimeExecutionKind::AiCommandDraft,
        provider: req.provider.clone(),
        status: RuntimeExecutionStatus::PendingApproval,
        input: json!({
            "prompt": req.prompt,
            "queryPlan": req.query_plan,
            "actionPlan": req.action_plan,
            "draftViewerCommands": req.draft_viewer_commands,
            "context": context.audit_json()
        }),
        output: json!({
            "assetMutationAllowed": false,
            "directAssetMutation": false,
            "draftOnly": true
        }),
        trace: json!({
            "events": [
                {
                    "event": "ai_draft_created",
                    "at": now,
                    "actor": actor,
                    "approvalRequired": true
                },
                {
                    "event": "draft_viewer_commands_generated",
                    "at": now,
                    "count": req.draft_viewer_commands.len()
                }
            ]
        }),
        started_at: None,
        finished_at: None,
    };
    let mut tx = pool.begin().await?;
    insert_runtime_execution(&mut tx, &record).await?;
    append_audit_event_tx(
        &mut tx,
        context,
        AuditEventInput {
            module_id: "digital_twin".to_owned(),
            actor,
            action: AuditEventKind::AiRuntimeDraftCreated,
            target_type: "runtime_execution".to_owned(),
            target_id: execution_id.to_string(),
            summary: "AI runtime draft created".to_owned(),
            metadata: json!({
                "provider": req.provider,
                "status": record.status,
                "context": context.audit_json()
            }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(record)
}

/// List runtime executions visible to a context.
///
/// # Errors
/// Returns permission, pagination, enum, or database errors.
pub async fn list_runtime_executions(
    pool: &PgPool,
    context: &RequestContext,
    query: &RuntimeExecutionListQuery,
) -> Result<ListPage<RuntimeExecutionRecord>> {
    PermissionGuard::ensure(context, RuntimePermission::ArtifactRead)?;
    let rows = sqlx::query_as::<_, RuntimeExecutionRow>(
        r"
        SELECT id, tenant_id, project_id, execution_id, kind, provider, status,
               input::text AS input, output::text AS output, trace::text AS trace,
               started_at, finished_at, created_at, updated_at, created_by
        FROM runtime_executions
        WHERE tenant_id = $1 AND project_id = $2
        ORDER BY created_at ASC, execution_id ASC
        ",
    )
    .bind(&context.tenant_id)
    .bind(&context.project_id)
    .fetch_all(pool)
    .await?;
    let mut items = rows
        .into_iter()
        .map(RuntimeExecutionRecord::try_from)
        .collect::<Result<Vec<_>>>()?;
    items.retain(|execution| query.kind.is_none_or(|kind| execution.kind == kind));
    items.retain(|execution| query.status.is_none_or(|status| execution.status == status));
    paginate(&items, query.limit, query.cursor.as_deref())
}

/// Get one runtime execution visible to a context.
///
/// # Errors
/// Returns permission, scope, not-found, enum, or database errors.
pub async fn get_runtime_execution(
    pool: &PgPool,
    context: &RequestContext,
    execution_id: Uuid,
) -> Result<RuntimeExecutionRecord> {
    PermissionGuard::ensure(context, RuntimePermission::ArtifactRead)?;
    let execution = get_runtime_execution_unscoped(pool, execution_id).await?;
    assert_runtime_scope(
        context,
        &execution.metadata.tenant_id,
        execution.metadata.project_id.as_deref().unwrap_or_default(),
    )?;
    Ok(execution)
}

/// Get trace events for one runtime execution.
///
/// # Errors
/// Returns permission, scope, not-found, enum, or database errors.
pub async fn runtime_execution_trace(
    pool: &PgPool,
    context: &RequestContext,
    execution_id: Uuid,
) -> Result<RuntimeExecutionTraceResponse> {
    let execution = get_runtime_execution(pool, context, execution_id).await?;
    let trace_events = execution
        .trace
        .get("events")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    Ok(RuntimeExecutionTraceResponse {
        execution,
        trace_events,
    })
}

/// Approve or reject one runtime execution.
///
/// # Errors
/// Returns permission, scope, invalid-state, or database errors.
pub async fn approve_runtime_execution(
    pool: &PgPool,
    context: &RequestContext,
    execution_id: Uuid,
    mut req: RuntimeExecutionApprovalRequest,
) -> Result<RuntimeExecutionRecord> {
    PermissionGuard::ensure(context, RuntimePermission::GenerationApprove)?;
    if req.actor.trim().is_empty() {
        req.actor.clone_from(&context.actor);
    }
    let mut execution = get_runtime_execution_unscoped(pool, execution_id).await?;
    assert_runtime_scope(
        context,
        &execution.metadata.tenant_id,
        execution.metadata.project_id.as_deref().unwrap_or_default(),
    )?;
    if execution.status != RuntimeExecutionStatus::PendingApproval {
        return Err(HarnessError::InvalidInput(format!(
            "runtime execution status {:?} does not allow approval",
            execution.status
        )));
    }
    let now = Utc::now();
    execution.status = if req.approved {
        RuntimeExecutionStatus::Queued
    } else {
        RuntimeExecutionStatus::Cancelled
    };
    execution.metadata.updated_at = now;
    execution.finished_at = if req.approved { None } else { Some(now) };
    append_trace_event(
        &mut execution.trace,
        json!({
            "event": if req.approved { "ai_runtime_approved" } else { "ai_runtime_rejected" },
            "at": now,
            "actor": req.actor,
            "comment": req.comment,
            "queuedForExecution": req.approved
        }),
    );
    execution.output = json!({
        "approved": req.approved,
        "queuedForExecution": req.approved,
        "directAssetMutation": false
    });
    let mut tx = pool.begin().await?;
    update_runtime_execution(&mut tx, &execution).await?;
    append_audit_event_tx(
        &mut tx,
        context,
        AuditEventInput {
            module_id: "digital_twin".to_owned(),
            actor: req.actor,
            action: if req.approved {
                AuditEventKind::AiRuntimeExecutionApproved
            } else {
                AuditEventKind::AiRuntimeExecutionRejected
            },
            target_type: "runtime_execution".to_owned(),
            target_id: execution.execution_id.to_string(),
            summary: if req.approved {
                "AI runtime draft approved".to_owned()
            } else {
                "AI runtime draft rejected".to_owned()
            },
            metadata: json!({ "status": execution.status, "context": context.audit_json() }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(execution)
}

/// List audit events from `PostgreSQL`.
///
/// # Errors
/// Returns pagination, enum, or database errors.
pub async fn list_audit_events(
    pool: &PgPool,
    query: &AuditEventQuery,
) -> Result<ListPage<AuditEvent>> {
    let rows = sqlx::query_as::<_, AuditEventRow>(
        r"
        SELECT id, module_id, actor, action, target_type, target_id, summary,
               metadata::text AS metadata, created_at
        FROM audit_events
        ORDER BY created_at ASC, id ASC
        ",
    )
    .fetch_all(pool)
    .await?;
    let mut items = rows
        .into_iter()
        .map(AuditEvent::try_from)
        .collect::<Result<Vec<_>>>()?;
    items.retain(|event| {
        query
            .module_id
            .as_ref()
            .is_none_or(|module_id| &event.module_id == module_id)
    });
    items.retain(|event| {
        query
            .target_type
            .as_ref()
            .is_none_or(|target_type| &event.target_type == target_type)
    });
    items.retain(|event| {
        query
            .target_id
            .as_ref()
            .is_none_or(|target_id| &event.target_id == target_id)
    });
    items.retain(|event| {
        query
            .actor
            .as_ref()
            .is_none_or(|actor| &event.actor == actor)
    });
    paginate(&items, query.limit, query.cursor.as_deref())
}

async fn get_asset_unscoped(pool: &PgPool, asset_id: Uuid) -> Result<AssetRecord> {
    let row = sqlx::query_as::<_, AssetRow>(
        r"
        SELECT id, tenant_id, project_id, asset_id, kind, name, status, source_format,
               canonical_format, metadata::text AS payload, created_at, updated_at, created_by
        FROM assets
        WHERE asset_id = $1
        ",
    )
    .bind(asset_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("asset_id={asset_id}")))?;
    AssetRecord::try_from(row)
}

async fn get_asset_file_unscoped(
    pool: &PgPool,
    asset_id: Uuid,
    file_id: Uuid,
) -> Result<AssetFileRecord> {
    let row = sqlx::query_as::<_, AssetFileRow>(
        r"
        SELECT id, tenant_id, project_id, asset_id, asset_version_id, role, format,
               metadata::text AS payload, created_at, updated_at, created_by
        FROM asset_files
        WHERE asset_id = $1 AND id = $2
        ",
    )
    .bind(asset_id)
    .bind(file_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
    AssetFileRecord::try_from(row)
}

async fn get_conversion_job_unscoped(pool: &PgPool, job_id: Uuid) -> Result<ConversionJobRecord> {
    let row = sqlx::query_as::<_, ConversionJobRow>(
        r"
        SELECT id, tenant_id, project_id, job_id, operation, source_asset_id, source_file_id,
               status, input::text AS input, output::text AS output, error::text AS error,
               started_at, finished_at, created_at, updated_at, created_by
        FROM conversion_jobs
        WHERE job_id = $1
        ",
    )
    .bind(job_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("job_id={job_id}")))?;
    ConversionJobRecord::try_from(row)
}

async fn get_runtime_execution_unscoped(
    pool: &PgPool,
    execution_id: Uuid,
) -> Result<RuntimeExecutionRecord> {
    let row = sqlx::query_as::<_, RuntimeExecutionRow>(
        r"
        SELECT id, tenant_id, project_id, execution_id, kind, provider, status,
               input::text AS input, output::text AS output, trace::text AS trace,
               started_at, finished_at, created_at, updated_at, created_by
        FROM runtime_executions
        WHERE execution_id = $1
        ",
    )
    .bind(execution_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("execution_id={execution_id}")))?;
    RuntimeExecutionRecord::try_from(row)
}

async fn insert_asset(tx: &mut Transaction<'_, Postgres>, asset: &AssetRecord) -> Result<()> {
    sqlx::query(
        r"
        INSERT INTO assets
            (id, tenant_id, project_id, asset_id, kind, name, status, source_format,
             canonical_format, metadata, created_at, updated_at, created_by)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13)
        ",
    )
    .bind(asset.metadata.id)
    .bind(&asset.metadata.tenant_id)
    .bind(required_project_id(&asset.metadata)?)
    .bind(asset.asset_id)
    .bind(enum_to_db(asset.kind)?)
    .bind(&asset.name)
    .bind(enum_to_db(asset.status)?)
    .bind(&asset.source_format)
    .bind(&asset.canonical_format)
    .bind(asset.payload.to_string())
    .bind(asset.metadata.created_at)
    .bind(asset.metadata.updated_at)
    .bind(&asset.metadata.created_by)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn insert_asset_version(
    tx: &mut Transaction<'_, Postgres>,
    version: &AssetVersionRecord,
) -> Result<()> {
    sqlx::query(
        r"
        INSERT INTO asset_versions
            (id, tenant_id, project_id, asset_id, version, status, metadata,
             created_at, updated_at, created_by)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
        ",
    )
    .bind(version.metadata.id)
    .bind(&version.metadata.tenant_id)
    .bind(required_project_id(&version.metadata)?)
    .bind(version.asset_id)
    .bind(i32::try_from(version.version).map_err(|_| {
        HarnessError::InvalidInput(format!("asset version {} exceeds i32", version.version))
    })?)
    .bind(enum_to_db(version.status)?)
    .bind(version.payload.to_string())
    .bind(version.metadata.created_at)
    .bind(version.metadata.updated_at)
    .bind(&version.metadata.created_by)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn insert_asset_file(
    tx: &mut Transaction<'_, Postgres>,
    file: &AssetFileRecord,
) -> Result<()> {
    sqlx::query(
        r"
        INSERT INTO asset_files
            (id, tenant_id, project_id, asset_id, asset_version_id, role, format, metadata,
             created_at, updated_at, created_by)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
        ",
    )
    .bind(file.metadata.id)
    .bind(&file.metadata.tenant_id)
    .bind(required_project_id(&file.metadata)?)
    .bind(file.asset_id)
    .bind(file.asset_version_id)
    .bind(&file.role)
    .bind(&file.format)
    .bind(file.payload.to_string())
    .bind(file.metadata.created_at)
    .bind(file.metadata.updated_at)
    .bind(&file.metadata.created_by)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn insert_object_binding(
    tx: &mut Transaction<'_, Postgres>,
    binding: &ObjectStoreBindingRecord,
) -> Result<()> {
    sqlx::query(
        r"
        INSERT INTO object_store_bindings
            (id, tenant_id, project_id, asset_id, asset_file_id, bucket, key, size_bytes,
             content_type, checksum_sha256, storage_class, created_at, updated_at, created_by)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ",
    )
    .bind(binding.metadata.id)
    .bind(&binding.metadata.tenant_id)
    .bind(required_project_id(&binding.metadata)?)
    .bind(binding.asset_id)
    .bind(binding.asset_file_id)
    .bind(&binding.bucket)
    .bind(&binding.key)
    .bind(
        i64::try_from(binding.size_bytes)
            .map_err(|_| HarnessError::InvalidInput("object size exceeds i64".to_owned()))?,
    )
    .bind(&binding.content_type)
    .bind(&binding.checksum_sha256)
    .bind(&binding.storage_class)
    .bind(binding.metadata.created_at)
    .bind(binding.metadata.updated_at)
    .bind(&binding.metadata.created_by)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn insert_conversion_job(
    tx: &mut Transaction<'_, Postgres>,
    job: &ConversionJobRecord,
) -> Result<()> {
    sqlx::query(
        r"
        INSERT INTO conversion_jobs
            (id, tenant_id, project_id, job_id, operation, source_asset_id, source_file_id,
             status, input, output, error, started_at, finished_at,
             created_at, updated_at, created_by)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb,
             $12, $13, $14, $15, $16)
        ",
    )
    .bind(job.metadata.id)
    .bind(&job.metadata.tenant_id)
    .bind(required_project_id(&job.metadata)?)
    .bind(job.job_id)
    .bind(enum_to_db(job.operation)?)
    .bind(job.source_asset_id)
    .bind(job.source_file_id)
    .bind(&job.status)
    .bind(job.input.to_string())
    .bind(job.output.to_string())
    .bind(job.error.to_string())
    .bind(job.started_at)
    .bind(job.finished_at)
    .bind(job.metadata.created_at)
    .bind(job.metadata.updated_at)
    .bind(&job.metadata.created_by)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn update_conversion_job(
    tx: &mut Transaction<'_, Postgres>,
    job: &ConversionJobRecord,
) -> Result<()> {
    let affected = sqlx::query(
        r"
        UPDATE conversion_jobs
        SET status = $2, output = $3::jsonb, error = $4::jsonb, started_at = $5,
            finished_at = $6, updated_at = $7
        WHERE job_id = $1
        ",
    )
    .bind(job.job_id)
    .bind(&job.status)
    .bind(job.output.to_string())
    .bind(job.error.to_string())
    .bind(job.started_at)
    .bind(job.finished_at)
    .bind(job.metadata.updated_at)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(HarnessError::NotFound(format!("job_id={}", job.job_id)));
    }
    Ok(())
}

async fn insert_runtime_execution(
    tx: &mut Transaction<'_, Postgres>,
    execution: &RuntimeExecutionRecord,
) -> Result<()> {
    sqlx::query(
        r"
        INSERT INTO runtime_executions
            (id, tenant_id, project_id, execution_id, kind, provider, status, input, output,
             trace, started_at, finished_at, created_at, updated_at, created_by)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb,
             $11, $12, $13, $14, $15)
        ",
    )
    .bind(execution.metadata.id)
    .bind(&execution.metadata.tenant_id)
    .bind(required_project_id(&execution.metadata)?)
    .bind(execution.execution_id)
    .bind(enum_to_db(execution.kind)?)
    .bind(&execution.provider)
    .bind(enum_to_db(execution.status)?)
    .bind(execution.input.to_string())
    .bind(execution.output.to_string())
    .bind(execution.trace.to_string())
    .bind(execution.started_at)
    .bind(execution.finished_at)
    .bind(execution.metadata.created_at)
    .bind(execution.metadata.updated_at)
    .bind(&execution.metadata.created_by)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn update_runtime_execution(
    tx: &mut Transaction<'_, Postgres>,
    execution: &RuntimeExecutionRecord,
) -> Result<()> {
    let affected = sqlx::query(
        r"
        UPDATE runtime_executions
        SET status = $2, output = $3::jsonb, trace = $4::jsonb, finished_at = $5, updated_at = $6
        WHERE execution_id = $1
        ",
    )
    .bind(execution.execution_id)
    .bind(enum_to_db(execution.status)?)
    .bind(execution.output.to_string())
    .bind(execution.trace.to_string())
    .bind(execution.finished_at)
    .bind(execution.metadata.updated_at)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(HarnessError::NotFound(format!(
            "execution_id={}",
            execution.execution_id
        )));
    }
    Ok(())
}

async fn append_audit_event(
    pool: &PgPool,
    context: &RequestContext,
    input: AuditEventInput,
) -> Result<AuditEvent> {
    let mut tx = pool.begin().await?;
    let event = append_audit_event_tx(&mut tx, context, input).await?;
    tx.commit().await?;
    Ok(event)
}

async fn append_audit_event_tx(
    tx: &mut Transaction<'_, Postgres>,
    context: &RequestContext,
    input: AuditEventInput,
) -> Result<AuditEvent> {
    let event = AuditEvent {
        id: Uuid::new_v4(),
        module_id: input.module_id,
        actor: input.actor,
        action: input.action,
        target_type: input.target_type,
        target_id: input.target_id,
        summary: input.summary,
        metadata: input.metadata,
        created_at: Utc::now(),
    };
    sqlx::query(
        r"
        INSERT INTO audit_events
            (id, tenant_id, project_id, module_id, actor, action, target_type, target_id,
             summary, metadata, created_at)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
        ",
    )
    .bind(event.id)
    .bind(&context.tenant_id)
    .bind(&context.project_id)
    .bind(&event.module_id)
    .bind(&event.actor)
    .bind(enum_to_db(event.action)?)
    .bind(&event.target_type)
    .bind(&event.target_id)
    .bind(&event.summary)
    .bind(event.metadata.to_string())
    .bind(event.created_at)
    .execute(&mut **tx)
    .await?;
    Ok(event)
}

async fn append_conversion_audit_tx(
    tx: &mut Transaction<'_, Postgres>,
    job: &ConversionJobRecord,
    action: AuditEventKind,
    summary: &str,
) -> Result<AuditEvent> {
    let actor = job
        .metadata
        .created_by
        .clone()
        .unwrap_or_else(|| "conversion-worker".to_owned());
    let context = RequestContext {
        tenant_id: job.metadata.tenant_id.clone(),
        project_id: job.metadata.project_id.clone().unwrap_or_default(),
        actor: actor.clone(),
        roles: Vec::new(),
        request_id: "conversion-worker".to_owned(),
        correlation_id: job.job_id.to_string(),
    };
    append_audit_event_tx(
        tx,
        &context,
        AuditEventInput {
            module_id: "digital_twin".to_owned(),
            actor,
            action,
            target_type: "conversion_job".to_owned(),
            target_id: job.job_id.to_string(),
            summary: summary.to_owned(),
            metadata: json!({
                "jobId": job.job_id,
                "assetId": job.source_asset_id,
                "fileId": job.source_file_id,
                "status": job.status,
                "tenantId": job.metadata.tenant_id,
                "projectId": job.metadata.project_id,
            }),
        },
    )
    .await
}

fn assert_asset_scope(context: &RequestContext, asset: &AssetRecord) -> Result<()> {
    assert_runtime_scope(
        context,
        &asset.metadata.tenant_id,
        asset.metadata.project_id.as_deref().unwrap_or_default(),
    )
}

fn assert_job_scope(context: &RequestContext, job: &ConversionJobRecord) -> Result<()> {
    assert_runtime_scope(
        context,
        &job.metadata.tenant_id,
        job.metadata.project_id.as_deref().unwrap_or_default(),
    )
}

fn reject_direct_asset_mutation(plan: &AiActionPlan) -> Result<()> {
    if plan.actions.iter().any(|action| action.mutates_assets) {
        return Err(HarnessError::InvalidInput(
            "AI runtime actions must produce draft commands and cannot directly mutate assets"
                .to_owned(),
        ));
    }
    Ok(())
}

fn append_trace_event(trace: &mut Value, event: Value) {
    if let Some(events) = trace.get_mut("events").and_then(Value::as_array_mut) {
        events.push(event);
        return;
    }
    *trace = json!({ "events": [event] });
}

fn validate_required(field: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() {
        return Err(HarnessError::InvalidInput(format!("{field} is required")));
    }
    Ok(())
}

fn with_context(mut payload: Value, context: &RequestContext) -> Value {
    if let Some(object) = payload.as_object_mut() {
        object.insert("context".to_owned(), context.audit_json());
        return payload;
    }
    json!({ "value": payload, "context": context.audit_json() })
}

fn required_project_id(metadata: &DurableRecordMetadata) -> Result<&str> {
    metadata
        .project_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| HarnessError::InvalidInput("project_id is required".to_owned()))
}

fn enum_to_db<T: Serialize>(value: T) -> Result<String> {
    let value = serde_json::to_value(value)?;
    value
        .as_str()
        .map(ToOwned::to_owned)
        .ok_or_else(|| HarnessError::Internal("enum did not serialize as string".to_owned()))
}

fn enum_from_db<T: DeserializeOwned>(value: &str, field: &str) -> Result<T> {
    serde_json::from_value(Value::String(value.to_owned())).map_err(|err| {
        HarnessError::InvalidInput(format!("invalid {field} database value {value:?}: {err}"))
    })
}

fn json_from_db(value: &str, field: &str) -> Result<Value> {
    serde_json::from_str(value).map_err(|err| {
        HarnessError::InvalidInput(format!("invalid {field} JSON stored in database: {err}"))
    })
}

fn sanitize_key_segment(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_') {
                ch
            } else {
                '_'
            }
        })
        .collect()
}

fn object_store_bucket() -> String {
    std::env::var("S3_BUCKET")
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_BUCKET.to_owned())
}

fn object_store_url(bucket: &str, key: &str) -> String {
    let endpoint = std::env::var("S3_PUBLIC_ENDPOINT")
        .or_else(|_| std::env::var("S3_ENDPOINT"))
        .ok()
        .map(|value| value.trim().trim_end_matches('/').to_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "http://localhost:8333".to_owned());
    format!("{endpoint}/{bucket}/{key}")
}

async fn get_module_file_row(
    pool: &PgPool,
    context: &RequestContext,
    file_id: Uuid,
) -> Result<ModuleFileRow> {
    sqlx::query_as::<_, ModuleFileRow>(
        r"
        SELECT id, tenant_id, project_id, file_id, module_id, parent_id, name,
               kind, status, size_bytes, mime_type, checksum, version, owner,
               tags::text AS tags, content, created_at, updated_at, created_by
        FROM module_files
        WHERE tenant_id = $1 AND project_id = $2 AND file_id = $3
        ",
    )
    .bind(&context.tenant_id)
    .bind(&context.project_id)
    .bind(file_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))
}

async fn validate_module_file_parent(
    pool: &PgPool,
    context: &RequestContext,
    module_id: &str,
    parent_id: Option<Uuid>,
) -> Result<()> {
    let Some(parent_id) = parent_id else {
        return Ok(());
    };
    let parent = get_module_file_row(pool, context, parent_id).await?;
    if parent.module_id != module_id {
        return Err(HarnessError::InvalidInput(
            "parent folder must be in the same module".to_owned(),
        ));
    }
    if enum_from_db::<ModuleFileKind>(&parent.kind, "module_file.kind")? != ModuleFileKind::Folder {
        return Err(HarnessError::InvalidInput(
            "parent must be a folder".to_owned(),
        ));
    }
    Ok(())
}

async fn insert_module_file_row(
    tx: &mut Transaction<'_, Postgres>,
    row: &ModuleFileRow,
) -> Result<()> {
    sqlx::query(
        r"
        INSERT INTO module_files
            (id, tenant_id, project_id, file_id, module_id, parent_id, name,
             kind, status, size_bytes, mime_type, checksum, version, owner,
             tags, content, created_at, updated_at, created_by)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
             $15::jsonb, $16, $17, $18, $19)
        ",
    )
    .bind(row.id)
    .bind(&row.tenant_id)
    .bind(&row.project_id)
    .bind(row.file_id)
    .bind(&row.module_id)
    .bind(row.parent_id)
    .bind(&row.name)
    .bind(&row.kind)
    .bind(&row.status)
    .bind(row.size_bytes)
    .bind(&row.mime_type)
    .bind(&row.checksum)
    .bind(row.version)
    .bind(&row.owner)
    .bind(&row.tags)
    .bind(&row.content)
    .bind(row.created_at)
    .bind(row.updated_at)
    .bind(&row.created_by)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

fn module_file_audit_input(
    context: &RequestContext,
    row: &ModuleFileRow,
    action: AuditEventKind,
    summary: &str,
) -> AuditEventInput {
    AuditEventInput {
        module_id: row.module_id.clone(),
        actor: context.actor.clone(),
        action,
        target_type: "file".to_owned(),
        target_id: row.file_id.to_string(),
        summary: summary.to_owned(),
        metadata: json!({
            "name": row.name,
            "kind": row.kind,
            "status": row.status,
        }),
    }
}

async fn append_module_file_audit_tx(
    tx: &mut Transaction<'_, Postgres>,
    context: &RequestContext,
    row: &ModuleFileRow,
    action: AuditEventKind,
    summary: &str,
) -> Result<AuditEvent> {
    append_audit_event_tx(
        tx,
        context,
        module_file_audit_input(context, row, action, summary),
    )
    .await
}

#[derive(Debug, FromRow)]
struct ModuleFileRow {
    id: Uuid,
    tenant_id: String,
    project_id: String,
    file_id: Uuid,
    module_id: String,
    parent_id: Option<Uuid>,
    name: String,
    kind: String,
    status: String,
    size_bytes: i64,
    mime_type: Option<String>,
    checksum: Option<String>,
    version: i32,
    owner: String,
    tags: String,
    content: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    created_by: Option<String>,
}

impl TryFrom<ModuleFileRow> for ModuleFileNode {
    type Error = HarnessError;

    fn try_from(row: ModuleFileRow) -> Result<Self> {
        let tags = json_from_db(&row.tags, "module_file.tags")?;
        let tags = tags
            .as_array()
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(ToOwned::to_owned))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        Ok(Self {
            id: row.file_id,
            module_id: row.module_id,
            parent_id: row.parent_id,
            name: row.name,
            kind: enum_from_db::<ModuleFileKind>(&row.kind, "module_file.kind")?,
            status: enum_from_db::<ModuleFileStatus>(&row.status, "module_file.status")?,
            metadata: ModuleFileMetadata {
                size_bytes: u64::try_from(row.size_bytes).map_err(|_| {
                    HarnessError::InvalidInput(format!(
                        "invalid module file size {}",
                        row.size_bytes
                    ))
                })?,
                mime_type: row.mime_type,
                checksum: row.checksum,
                version: u32::try_from(row.version).map_err(|_| {
                    HarnessError::InvalidInput(format!(
                        "invalid module file version {}",
                        row.version
                    ))
                })?,
                owner: row.owner,
                tags,
                created_at: row.created_at,
                updated_at: row.updated_at,
            },
        })
    }
}

#[derive(Debug, FromRow)]
struct AssetRow {
    id: Uuid,
    tenant_id: String,
    project_id: String,
    asset_id: Uuid,
    kind: String,
    name: String,
    status: String,
    source_format: Option<String>,
    canonical_format: Option<String>,
    payload: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    created_by: Option<String>,
}

impl TryFrom<AssetRow> for AssetRecord {
    type Error = HarnessError;

    fn try_from(row: AssetRow) -> Result<Self> {
        Ok(Self {
            metadata: DurableRecordMetadata {
                id: row.id,
                tenant_id: row.tenant_id,
                project_id: Some(row.project_id),
                created_at: row.created_at,
                updated_at: row.updated_at,
                created_by: row.created_by,
            },
            asset_id: row.asset_id,
            kind: enum_from_db::<AssetKind>(&row.kind, "asset.kind")?,
            name: row.name,
            status: enum_from_db::<AssetStatus>(&row.status, "asset.status")?,
            source_format: row.source_format,
            canonical_format: row.canonical_format,
            payload: json_from_db(&row.payload, "asset.metadata")?,
        })
    }
}

#[derive(Debug, FromRow)]
struct AssetVersionRow {
    id: Uuid,
    tenant_id: String,
    project_id: String,
    asset_id: Uuid,
    version: i32,
    status: String,
    payload: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    created_by: Option<String>,
}

impl TryFrom<AssetVersionRow> for AssetVersionRecord {
    type Error = HarnessError;

    fn try_from(row: AssetVersionRow) -> Result<Self> {
        Ok(Self {
            metadata: DurableRecordMetadata {
                id: row.id,
                tenant_id: row.tenant_id,
                project_id: Some(row.project_id),
                created_at: row.created_at,
                updated_at: row.updated_at,
                created_by: row.created_by,
            },
            asset_id: row.asset_id,
            version: u32::try_from(row.version).map_err(|_| {
                HarnessError::InvalidInput(format!("invalid asset version {}", row.version))
            })?,
            status: enum_from_db::<AssetStatus>(&row.status, "asset_version.status")?,
            payload: json_from_db(&row.payload, "asset_version.metadata")?,
        })
    }
}

#[derive(Debug, FromRow)]
struct AssetFileRow {
    id: Uuid,
    tenant_id: String,
    project_id: String,
    asset_id: Uuid,
    asset_version_id: Uuid,
    role: String,
    format: String,
    payload: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    created_by: Option<String>,
}

impl TryFrom<AssetFileRow> for AssetFileRecord {
    type Error = HarnessError;

    fn try_from(row: AssetFileRow) -> Result<Self> {
        Ok(Self {
            metadata: DurableRecordMetadata {
                id: row.id,
                tenant_id: row.tenant_id,
                project_id: Some(row.project_id),
                created_at: row.created_at,
                updated_at: row.updated_at,
                created_by: row.created_by,
            },
            asset_id: row.asset_id,
            asset_version_id: row.asset_version_id,
            role: row.role,
            format: row.format,
            payload: json_from_db(&row.payload, "asset_file.metadata")?,
        })
    }
}

#[derive(Debug, FromRow)]
struct ObjectBindingRow {
    id: Uuid,
    tenant_id: String,
    project_id: String,
    asset_id: Uuid,
    asset_file_id: Uuid,
    bucket: String,
    key: String,
    size_bytes: i64,
    content_type: String,
    checksum_sha256: Option<String>,
    storage_class: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    created_by: Option<String>,
}

impl TryFrom<ObjectBindingRow> for ObjectStoreBindingRecord {
    type Error = HarnessError;

    fn try_from(row: ObjectBindingRow) -> Result<Self> {
        Ok(Self {
            metadata: DurableRecordMetadata {
                id: row.id,
                tenant_id: row.tenant_id,
                project_id: Some(row.project_id),
                created_at: row.created_at,
                updated_at: row.updated_at,
                created_by: row.created_by,
            },
            asset_id: row.asset_id,
            asset_file_id: row.asset_file_id,
            bucket: row.bucket,
            key: row.key,
            size_bytes: u64::try_from(row.size_bytes).map_err(|_| {
                HarnessError::InvalidInput(format!("negative object size {}", row.size_bytes))
            })?,
            content_type: row.content_type,
            checksum_sha256: row.checksum_sha256,
            storage_class: row.storage_class,
        })
    }
}

#[derive(Debug, FromRow)]
struct ConversionJobRow {
    id: Uuid,
    tenant_id: String,
    project_id: String,
    job_id: Uuid,
    operation: String,
    source_asset_id: Uuid,
    source_file_id: Uuid,
    status: String,
    input: String,
    output: String,
    error: String,
    started_at: Option<DateTime<Utc>>,
    finished_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    created_by: Option<String>,
}

impl TryFrom<ConversionJobRow> for ConversionJobRecord {
    type Error = HarnessError;

    fn try_from(row: ConversionJobRow) -> Result<Self> {
        Ok(Self {
            metadata: DurableRecordMetadata {
                id: row.id,
                tenant_id: row.tenant_id,
                project_id: Some(row.project_id),
                created_at: row.created_at,
                updated_at: row.updated_at,
                created_by: row.created_by,
            },
            job_id: row.job_id,
            operation: enum_from_db::<ConversionOperation>(&row.operation, "conversion.operation")?,
            source_asset_id: row.source_asset_id,
            source_file_id: row.source_file_id,
            status: row.status,
            input: json_from_db(&row.input, "conversion.input")?,
            output: json_from_db(&row.output, "conversion.output")?,
            error: json_from_db(&row.error, "conversion.error")?,
            started_at: row.started_at,
            finished_at: row.finished_at,
        })
    }
}

#[derive(Debug, FromRow)]
struct RuntimeExecutionRow {
    id: Uuid,
    tenant_id: String,
    project_id: String,
    execution_id: Uuid,
    kind: String,
    provider: String,
    status: String,
    input: String,
    output: String,
    trace: String,
    started_at: Option<DateTime<Utc>>,
    finished_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    created_by: Option<String>,
}

impl TryFrom<RuntimeExecutionRow> for RuntimeExecutionRecord {
    type Error = HarnessError;

    fn try_from(row: RuntimeExecutionRow) -> Result<Self> {
        Ok(Self {
            metadata: DurableRecordMetadata {
                id: row.id,
                tenant_id: row.tenant_id,
                project_id: Some(row.project_id),
                created_at: row.created_at,
                updated_at: row.updated_at,
                created_by: row.created_by,
            },
            execution_id: row.execution_id,
            kind: enum_from_db::<RuntimeExecutionKind>(&row.kind, "runtime_execution.kind")?,
            provider: row.provider,
            status: enum_from_db::<RuntimeExecutionStatus>(
                &row.status,
                "runtime_execution.status",
            )?,
            input: json_from_db(&row.input, "runtime_execution.input")?,
            output: json_from_db(&row.output, "runtime_execution.output")?,
            trace: json_from_db(&row.trace, "runtime_execution.trace")?,
            started_at: row.started_at,
            finished_at: row.finished_at,
        })
    }
}

#[derive(Debug, FromRow)]
struct AuditEventRow {
    id: Uuid,
    module_id: String,
    actor: String,
    action: String,
    target_type: String,
    target_id: String,
    summary: String,
    metadata: String,
    created_at: DateTime<Utc>,
}

impl TryFrom<AuditEventRow> for AuditEvent {
    type Error = HarnessError;

    fn try_from(row: AuditEventRow) -> Result<Self> {
        Ok(Self {
            id: row.id,
            module_id: row.module_id,
            actor: row.actor,
            action: enum_from_db::<AuditEventKind>(&row.action, "audit.action")?,
            target_type: row.target_type,
            target_id: row.target_id,
            summary: row.summary,
            metadata: json_from_db(&row.metadata, "audit.metadata")?,
            created_at: row.created_at,
        })
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        asset_registry::{AssetKind, AssetStatus, ConversionOperation},
        module_audit::AuditEventKind,
        module_files::{ModuleFileKind, ModuleFileStatus},
        runtime_execution::{RuntimeExecutionKind, RuntimeExecutionStatus},
    };

    use super::{enum_from_db, enum_to_db, phase7_runtime_tables};

    #[test]
    fn phase7_runtime_schema_manifest_contains_db_backed_tables() {
        for table in [
            "assets",
            "asset_versions",
            "asset_files",
            "object_store_bindings",
            "conversion_jobs",
            "module_files",
            "runtime_executions",
            "audit_events",
        ] {
            assert!(phase7_runtime_tables().contains(&table));
        }
    }

    #[test]
    fn postgres_enum_mapping_uses_api_wire_values() {
        assert_eq!(enum_to_db(AssetKind::Ifc).expect("asset kind"), "ifc");
        assert_eq!(
            enum_to_db(AssetStatus::Draft).expect("asset status"),
            "draft"
        );
        assert_eq!(
            enum_to_db(ConversionOperation::OpenbimValidate).expect("conversion op"),
            "openbim_validate"
        );
        assert_eq!(
            enum_to_db(ModuleFileKind::Folder).expect("module file kind"),
            "folder"
        );
        assert_eq!(
            enum_to_db(ModuleFileStatus::SoftDeleted).expect("module file status"),
            "soft_deleted"
        );
        assert_eq!(
            enum_to_db(RuntimeExecutionKind::AiCommandDraft).expect("runtime kind"),
            "ai_command_draft"
        );
        assert_eq!(
            enum_to_db(RuntimeExecutionStatus::PendingApproval).expect("runtime status"),
            "pending_approval"
        );
        assert_eq!(
            enum_to_db(AuditEventKind::ConversionJobCompleted).expect("audit kind"),
            "conversion_job_completed"
        );
        assert_eq!(
            enum_from_db::<ConversionOperation>("bcf_ingest", "operation")
                .expect("operation roundtrip"),
            ConversionOperation::BcfIngest
        );
    }
}
