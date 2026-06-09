//! Module-scoped file and folder service.
//!
//! Development stores metadata and small content records in memory.
//! Production bytes belong behind the configured `ObjectStore` adapter.

use std::{collections::HashMap, fmt::Write as _, sync::Arc};

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use ring::digest;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    error::{HarnessError, Result},
    module_audit::{AuditEventInput, AuditEventKind, ModuleAuditService},
    module_pagination::{ListPage, paginate},
    module_registry::normalize_module_id,
};

const DEFAULT_ACTOR: &str = "system";

/// Module file node kind.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModuleFileKind {
    /// A folder node.
    Folder,
    /// A file node.
    File,
}

/// Module file lifecycle status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModuleFileStatus {
    /// Newly created draft item.
    Draft,
    /// Uploaded item pending downstream processing.
    Uploaded,
    /// Active item visible in the module workbench.
    Active,
    /// Item has an active share link.
    Shared,
    /// Item was soft-deleted and remains auditable.
    SoftDeleted,
    /// Item was archived.
    Archived,
}

/// Module file validation lifecycle/result status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModuleFileValidationStatus {
    /// No backend validator route is registered for this file type.
    ValidatorNotConfigured,
    /// A backend validator route exists, but no worker result has been recorded.
    PendingValidation,
    /// A backend validator is currently running.
    Validating,
    /// Backend validation passed.
    Passed,
    /// Backend validation failed.
    Failed,
    /// Machine checks are insufficient; a qualified professional must review.
    ProfessionalReviewRequired,
}

/// Metadata associated with a module file node.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleFileMetadata {
    /// Size in bytes. Folder nodes use zero.
    pub size_bytes: u64,
    /// Optional MIME type.
    pub mime_type: Option<String>,
    /// Optional checksum.
    pub checksum: Option<String>,
    /// Current file version.
    pub version: u32,
    /// Owner display name or user id.
    pub owner: String,
    /// Search and business tags.
    pub tags: Vec<String>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Backend-owned validation result associated with a module file node.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleFileValidationResult {
    /// Current validation status.
    pub status: ModuleFileValidationStatus,
    /// Backend validator route or implementation reference.
    pub validator_ref: Option<String>,
    /// Validation report artifact or URL reference.
    pub report_ref: Option<String>,
    /// Human-readable validation summary.
    pub summary: Option<String>,
    /// When the validation result was produced.
    pub checked_at: Option<DateTime<Utc>>,
    /// When this validation record was last updated.
    pub updated_at: DateTime<Utc>,
}

/// Module file or folder node returned by file APIs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleFileNode {
    /// File id.
    pub id: Uuid,
    /// Active module id.
    pub module_id: String,
    /// Parent folder id. `None` means module root.
    pub parent_id: Option<Uuid>,
    /// Display name.
    pub name: String,
    /// File node kind.
    pub kind: ModuleFileKind,
    /// File node status.
    pub status: ModuleFileStatus,
    /// File metadata.
    pub metadata: ModuleFileMetadata,
    /// Backend-owned file validation result.
    pub validation: ModuleFileValidationResult,
}

/// Create file or folder request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateModuleFileRequest {
    /// Display name.
    pub name: String,
    /// Node kind.
    pub kind: ModuleFileKind,
    /// Optional parent folder id.
    pub parent_id: Option<Uuid>,
    /// Optional MIME type.
    pub mime_type: Option<String>,
    /// Optional size in bytes.
    pub size_bytes: Option<u64>,
    /// Optional owner. Defaults to `system`.
    pub owner: Option<String>,
    /// Optional tags.
    pub tags: Option<Vec<String>>,
    /// Optional checksum for the source bytes.
    pub checksum: Option<String>,
    /// Optional small development content.
    pub content: Option<String>,
}

/// Update file or folder request.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateModuleFileRequest {
    /// Optional replacement display name.
    pub name: Option<String>,
    /// Optional replacement owner.
    pub owner: Option<String>,
    /// Optional replacement tags.
    pub tags: Option<Vec<String>>,
    /// Optional replacement MIME type.
    pub mime_type: Option<String>,
}

/// Update backend-owned validation result for one file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFileValidationRequest {
    /// New validation status.
    pub status: ModuleFileValidationStatus,
    /// Backend validator route or implementation reference.
    pub validator_ref: Option<String>,
    /// Validation report artifact or URL reference.
    pub report_ref: Option<String>,
    /// Human-readable validation summary.
    pub summary: Option<String>,
    /// When the validation result was produced. Defaults to now.
    pub checked_at: Option<DateTime<Utc>>,
    /// Actor triggering the update.
    pub actor: Option<String>,
}

/// Move file or folder request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveFileRequest {
    /// Target parent folder id. `None` moves to module root.
    pub target_parent_id: Option<Uuid>,
    /// Actor triggering the operation.
    pub actor: Option<String>,
}

/// Copy file or folder request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyFileRequest {
    /// Optional active target module id.
    pub target_module_id: Option<String>,
    /// Target parent folder id. `None` copies to target module root.
    pub target_parent_id: Option<Uuid>,
    /// Optional replacement name for the copied node.
    pub name: Option<String>,
    /// Actor triggering the operation.
    pub actor: Option<String>,
}

/// Share file or folder request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareFileRequest {
    /// Permissions carried by the generated link.
    pub permissions: Vec<String>,
    /// Optional expiry timestamp.
    pub expires_at: Option<DateTime<Utc>>,
    /// Actor triggering the operation.
    pub actor: Option<String>,
}

/// Share operation response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareFileResponse {
    /// Shared file id.
    pub file_id: Uuid,
    /// Generated share URL.
    pub share_url: String,
    /// Permissions carried by the generated link.
    pub permissions: Vec<String>,
    /// Optional expiry timestamp.
    pub expires_at: Option<DateTime<Utc>>,
}

/// Replace file content request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFileContentRequest {
    /// Content.
    pub content: String,
    /// Optional MIME type.
    pub content_type: Option<String>,
    /// Actor triggering the operation.
    pub actor: Option<String>,
}

/// File content response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContentResponse {
    /// File id.
    pub file_id: Uuid,
    /// Content.
    pub content: String,
    /// Optional MIME type.
    pub content_type: Option<String>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Query shape used by `GET /v1/modules/{module_id}/files`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileListQuery {
    /// Optional parent folder id. Omit or use `null` for all parents.
    pub parent_id: Option<Uuid>,
    /// Optional parent scope. `root` lists only module-root children.
    pub parent_scope: Option<FileListParentScope>,
    /// Optional status filter.
    pub status: Option<ModuleFileStatus>,
    /// Optional file kind filter.
    pub kind: Option<ModuleFileKind>,
    /// Optional page size.
    pub limit: Option<usize>,
    /// Optional numeric cursor offset.
    pub cursor: Option<String>,
}

/// Parent scope selector for module file listing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileListParentScope {
    /// List only files and folders whose parent is the module root.
    Root,
}

#[derive(Debug, Clone)]
struct StoredFile {
    node: ModuleFileNode,
    content: String,
}

/// In-memory module file service.
#[derive(Debug, Clone)]
pub struct ModuleFileService {
    files: Arc<RwLock<HashMap<Uuid, StoredFile>>>,
    audit: Arc<ModuleAuditService>,
}

impl ModuleFileService {
    /// Create an empty file service.
    #[must_use]
    pub fn new(audit: Arc<ModuleAuditService>) -> Self {
        Self {
            files: Arc::new(RwLock::new(HashMap::new())),
            audit,
        }
    }

    /// List files for an active module id.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the module id cannot be normalized.
    pub fn list_module_files(
        &self,
        module_id: &str,
        query: &FileListQuery,
    ) -> Result<ListPage<ModuleFileNode>> {
        let module_id = normalize_module_id(module_id)
            .ok_or_else(|| HarnessError::NotFound(format!("module_id={module_id}")))?;
        let items: Vec<ModuleFileNode> = self
            .files
            .read()
            .values()
            .filter(|stored| stored.node.module_id == module_id.as_str())
            .filter(|stored| matches_file_parent_filter(stored.node.parent_id, query))
            .filter(|stored| {
                query
                    .status
                    .is_none_or(|status| stored.node.status == status)
            })
            .filter(|stored| query.kind.is_none_or(|kind| stored.node.kind == kind))
            .map(|stored| stored.node.clone())
            .collect();
        paginate(&items, query.limit, query.cursor.as_deref())
    }

    /// Create a module file or folder.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] for an unknown module or parent id,
    /// and [`HarnessError::InvalidInput`] for an empty name or invalid parent.
    pub fn create_file(
        &self,
        module_id: &str,
        req: CreateModuleFileRequest,
    ) -> Result<ModuleFileNode> {
        let module_id = normalize_module_id(module_id)
            .ok_or_else(|| HarnessError::NotFound(format!("module_id={module_id}")))?;
        let CreateModuleFileRequest {
            name,
            kind,
            parent_id,
            mime_type,
            size_bytes,
            owner,
            tags,
            checksum,
            content,
        } = req;
        if name.trim().is_empty() {
            return Err(HarnessError::InvalidInput(
                "file name is required".to_owned(),
            ));
        }
        self.validate_parent(module_id.as_str(), parent_id)?;

        let now = Utc::now();
        let id = Uuid::new_v4();
        let content = content.unwrap_or_default();
        let checksum = checksum
            .as_deref()
            .and_then(normalize_checksum)
            .or_else(|| checksum_for_content(&content));
        let tags = tags.unwrap_or_default();
        let validation =
            initial_module_file_validation(kind, &name, mime_type.as_deref(), &tags, now);
        let node = ModuleFileNode {
            id,
            module_id: module_id.as_str().to_owned(),
            parent_id,
            name,
            kind,
            status: ModuleFileStatus::Active,
            metadata: ModuleFileMetadata {
                size_bytes: size_bytes.unwrap_or(0),
                mime_type,
                checksum,
                version: 1,
                owner: owner.unwrap_or_else(|| DEFAULT_ACTOR.to_owned()),
                tags,
                created_at: now,
                updated_at: now,
            },
            validation,
        };
        self.files.write().insert(
            id,
            StoredFile {
                node: node.clone(),
                content,
            },
        );
        self.audit_file(
            &node,
            AuditEventKind::FileCreated,
            req_actor(None),
            "file node created",
        );
        Ok(node)
    }

    /// Get one file or folder.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the file id is unknown.
    pub fn get_file(&self, file_id: Uuid) -> Result<ModuleFileNode> {
        self.files
            .read()
            .get(&file_id)
            .map(|stored| stored.node.clone())
            .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))
    }

    /// Update file metadata.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the file id is unknown and
    /// [`HarnessError::InvalidInput`] for an empty replacement name.
    pub fn update_file(
        &self,
        file_id: Uuid,
        req: UpdateModuleFileRequest,
    ) -> Result<ModuleFileNode> {
        let node = {
            let mut files = self.files.write();
            let stored = files
                .get_mut(&file_id)
                .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
            let mut validation_relevant_changed = if let Some(name) = req.name {
                if name.trim().is_empty() {
                    return Err(HarnessError::InvalidInput(
                        "file name is required".to_owned(),
                    ));
                }
                stored.node.name = name;
                true
            } else {
                false
            };
            if let Some(owner) = req.owner {
                stored.node.metadata.owner = owner;
            }
            if let Some(tags) = req.tags {
                stored.node.metadata.tags = tags;
                validation_relevant_changed = true;
            }
            if let Some(mime_type) = req.mime_type {
                stored.node.metadata.mime_type = Some(mime_type);
                validation_relevant_changed = true;
            }
            stored.node.metadata.version += 1;
            let now = Utc::now();
            stored.node.metadata.updated_at = now;
            if validation_relevant_changed {
                stored.node.validation = initial_module_file_validation(
                    stored.node.kind,
                    &stored.node.name,
                    stored.node.metadata.mime_type.as_deref(),
                    &stored.node.metadata.tags,
                    now,
                );
            }
            let node = stored.node.clone();
            drop(files);
            node
        };
        self.audit_file(
            &node,
            AuditEventKind::FileUpdated,
            req_actor(None),
            "file updated",
        );
        Ok(node)
    }

    /// Get file metadata.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the file id is unknown.
    pub fn metadata(&self, file_id: Uuid) -> Result<ModuleFileMetadata> {
        self.get_file(file_id).map(|node| node.metadata)
    }

    /// Get in-memory file content.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the file id is unknown and
    /// [`HarnessError::InvalidInput`] when the node is a folder.
    pub fn content(&self, file_id: Uuid) -> Result<FileContentResponse> {
        let files = self.files.read();
        let stored = files
            .get(&file_id)
            .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
        if stored.node.kind != ModuleFileKind::File {
            return Err(HarnessError::InvalidInput(
                "folder nodes do not have content".to_owned(),
            ));
        }
        let response = FileContentResponse {
            file_id,
            content: stored.content.clone(),
            content_type: stored.node.metadata.mime_type.clone(),
            updated_at: stored.node.metadata.updated_at,
        };
        drop(files);
        Ok(response)
    }

    /// Replace in-memory file content.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the file id is unknown and
    /// [`HarnessError::InvalidInput`] when the node is a folder.
    pub fn update_content(
        &self,
        file_id: Uuid,
        req: UpdateFileContentRequest,
    ) -> Result<FileContentResponse> {
        let actor = req_actor(req.actor);
        let (node, response) = {
            let mut files = self.files.write();
            let stored = files
                .get_mut(&file_id)
                .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
            if stored.node.kind != ModuleFileKind::File {
                return Err(HarnessError::InvalidInput(
                    "folder nodes do not have content".to_owned(),
                ));
            }
            stored.content = req.content;
            stored.node.metadata.size_bytes = stored.content.len() as u64;
            stored.node.metadata.checksum = checksum_for_content(&stored.content);
            if let Some(content_type) = req.content_type {
                stored.node.metadata.mime_type = Some(content_type);
            }
            stored.node.metadata.version += 1;
            stored.node.metadata.updated_at = Utc::now();
            stored.node.validation = initial_module_file_validation(
                stored.node.kind,
                &stored.node.name,
                stored.node.metadata.mime_type.as_deref(),
                &stored.node.metadata.tags,
                stored.node.metadata.updated_at,
            );
            let response = FileContentResponse {
                file_id,
                content: stored.content.clone(),
                content_type: stored.node.metadata.mime_type.clone(),
                updated_at: stored.node.metadata.updated_at,
            };
            let node = stored.node.clone();
            drop(files);
            (node, response)
        };
        self.audit_file(
            &node,
            AuditEventKind::FileContentUpdated,
            actor,
            "file content updated",
        );
        Ok(response)
    }

    /// Update backend-owned validation status for one module file.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the file id is unknown.
    pub fn update_validation(
        &self,
        file_id: Uuid,
        req: UpdateFileValidationRequest,
    ) -> Result<ModuleFileNode> {
        let actor = req_actor(req.actor);
        let node = {
            let mut files = self.files.write();
            let stored = files
                .get_mut(&file_id)
                .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
            let now = Utc::now();
            stored.node.validation = ModuleFileValidationResult {
                status: req.status,
                validator_ref: req.validator_ref,
                report_ref: req.report_ref,
                summary: req.summary,
                checked_at: req.checked_at.or(Some(now)),
                updated_at: now,
            };
            stored.node.metadata.updated_at = now;
            let node = stored.node.clone();
            drop(files);
            node
        };
        self.audit_file(
            &node,
            AuditEventKind::FileUpdated,
            actor,
            "file validation updated",
        );
        Ok(node)
    }

    /// Move a file or folder.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the file or parent id is unknown,
    /// and [`HarnessError::InvalidInput`] when the parent is invalid.
    pub fn move_file(&self, file_id: Uuid, req: MoveFileRequest) -> Result<ModuleFileNode> {
        let current_module_id = self.get_file(file_id)?.module_id;
        self.validate_parent(&current_module_id, req.target_parent_id)?;
        let node = {
            let mut files = self.files.write();
            let stored = files
                .get_mut(&file_id)
                .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
            stored.node.parent_id = req.target_parent_id;
            stored.node.metadata.version += 1;
            stored.node.metadata.updated_at = Utc::now();
            let node = stored.node.clone();
            drop(files);
            node
        };
        self.audit_file(
            &node,
            AuditEventKind::FileMoved,
            req_actor(req.actor),
            "file moved",
        );
        Ok(node)
    }

    /// Copy a file or folder.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the file, module, or parent id is unknown,
    /// and [`HarnessError::InvalidInput`] when the parent is invalid.
    pub fn copy_file(&self, file_id: Uuid, req: CopyFileRequest) -> Result<ModuleFileNode> {
        let source = self
            .files
            .read()
            .get(&file_id)
            .cloned()
            .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
        let target_module_id = match req.target_module_id.as_deref() {
            Some(module_id) => normalize_module_id(module_id)
                .ok_or_else(|| HarnessError::NotFound(format!("module_id={module_id}")))?,
            None => normalize_module_id(&source.node.module_id)
                .ok_or_else(|| HarnessError::NotFound(source.node.module_id.clone()))?,
        };
        self.validate_parent(target_module_id.as_str(), req.target_parent_id)?;

        let now = Utc::now();
        let id = Uuid::new_v4();
        let mut copied = source.node;
        copied.id = id;
        target_module_id.as_str().clone_into(&mut copied.module_id);
        copied.parent_id = req.target_parent_id;
        copied.name = req.name.unwrap_or_else(|| format!("{} copy", copied.name));
        copied.status = ModuleFileStatus::Active;
        copied.metadata.version = 1;
        copied.metadata.created_at = now;
        copied.metadata.updated_at = now;

        self.files.write().insert(
            id,
            StoredFile {
                node: copied.clone(),
                content: source.content,
            },
        );
        self.audit_file(
            &copied,
            AuditEventKind::FileCopied,
            req_actor(req.actor),
            "file copied",
        );
        Ok(copied)
    }

    /// Create a share link for a file or folder.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the file id is unknown.
    pub fn share_file(&self, file_id: Uuid, req: ShareFileRequest) -> Result<ShareFileResponse> {
        let node = {
            let mut files = self.files.write();
            let stored = files
                .get_mut(&file_id)
                .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
            stored.node.status = ModuleFileStatus::Shared;
            stored.node.metadata.updated_at = Utc::now();
            let node = stored.node.clone();
            drop(files);
            node
        };
        let response = ShareFileResponse {
            file_id,
            share_url: format!("/v1/files/{file_id}/shared/{}", Uuid::new_v4()),
            permissions: req.permissions,
            expires_at: req.expires_at,
        };
        self.audit_file(
            &node,
            AuditEventKind::FileShared,
            req_actor(req.actor),
            "file shared",
        );
        Ok(response)
    }

    /// Soft-delete a file or folder.
    ///
    /// # Errors
    /// Returns [`HarnessError::NotFound`] when the file id is unknown.
    pub fn trash_file(&self, file_id: Uuid) -> Result<ModuleFileNode> {
        let node = {
            let mut files = self.files.write();
            let stored = files
                .get_mut(&file_id)
                .ok_or_else(|| HarnessError::NotFound(format!("file_id={file_id}")))?;
            stored.node.status = ModuleFileStatus::SoftDeleted;
            stored.node.metadata.updated_at = Utc::now();
            let node = stored.node.clone();
            drop(files);
            node
        };
        self.audit_file(
            &node,
            AuditEventKind::FileTrashed,
            req_actor(None),
            "file trashed",
        );
        Ok(node)
    }

    fn validate_parent(&self, module_id: &str, parent_id: Option<Uuid>) -> Result<()> {
        let Some(parent_id) = parent_id else {
            return Ok(());
        };
        let files = self.files.read();
        let parent = files
            .get(&parent_id)
            .ok_or_else(|| HarnessError::NotFound(format!("parent_id={parent_id}")))?;
        let parent_module_id = parent.node.module_id.clone();
        let parent_kind = parent.node.kind;
        drop(files);
        if parent_module_id != module_id {
            return Err(HarnessError::InvalidInput(
                "parent folder must be in the same module".to_owned(),
            ));
        }
        if parent_kind != ModuleFileKind::Folder {
            return Err(HarnessError::InvalidInput(
                "parent must be a folder".to_owned(),
            ));
        }
        Ok(())
    }

    fn audit_file(
        &self,
        node: &ModuleFileNode,
        action: AuditEventKind,
        actor: String,
        summary: &str,
    ) {
        let _event = self.audit.append(AuditEventInput {
            module_id: node.module_id.clone(),
            actor,
            action,
            target_type: "file".to_owned(),
            target_id: node.id.to_string(),
            summary: summary.to_owned(),
            metadata: json!({
                "name": node.name,
                "kind": node.kind,
                "status": node.status,
            }),
        });
    }
}

fn matches_file_parent_filter(parent_id: Option<Uuid>, query: &FileListQuery) -> bool {
    if query.parent_scope == Some(FileListParentScope::Root) {
        return parent_id.is_none();
    }
    query
        .parent_id
        .is_none_or(|expected_parent_id| parent_id == Some(expected_parent_id))
}

fn req_actor(actor: Option<String>) -> String {
    actor.unwrap_or_else(|| DEFAULT_ACTOR.to_owned())
}

fn normalize_checksum(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_owned())
    }
}

fn checksum_for_content(content: &str) -> Option<String> {
    if content.is_empty() {
        return None;
    }
    let digest = digest::digest(&digest::SHA256, content.as_bytes());
    let mut hex = String::with_capacity(digest.as_ref().len() * 2);
    for byte in digest.as_ref() {
        let _ = write!(hex, "{byte:02x}");
    }
    Some(format!("sha256:{hex}"))
}

/// Compute the backend-owned initial validation state for a module file.
#[must_use]
pub fn initial_module_file_validation(
    kind: ModuleFileKind,
    name: &str,
    mime_type: Option<&str>,
    tags: &[String],
    updated_at: DateTime<Utc>,
) -> ModuleFileValidationResult {
    ModuleFileValidationResult {
        status: initial_validation_status(kind, name, mime_type, tags),
        validator_ref: None,
        report_ref: None,
        summary: None,
        checked_at: None,
        updated_at,
    }
}

fn initial_validation_status(
    kind: ModuleFileKind,
    name: &str,
    mime_type: Option<&str>,
    tags: &[String],
) -> ModuleFileValidationStatus {
    if kind == ModuleFileKind::Folder {
        return ModuleFileValidationStatus::ValidatorNotConfigured;
    }

    if tags
        .iter()
        .any(|tag| tag == "professional-review-required" || tag == "engineer-review")
    {
        return ModuleFileValidationStatus::ProfessionalReviewRequired;
    }

    let normalized_name = name.trim().to_lowercase();
    let extension = normalized_name
        .rsplit_once('.')
        .map(|(_, ext)| format!(".{ext}"))
        .unwrap_or_default();
    let mime = mime_type.unwrap_or_default().trim().to_lowercase();

    if matches!(
        extension.as_str(),
        ".pdf" | ".pdfa" | ".rvt" | ".rfa" | ".dwg" | ".dgn" | ".3dm" | ".skp"
    ) {
        return ModuleFileValidationStatus::ProfessionalReviewRequired;
    }

    if matches!(
        extension.as_str(),
        ".ifc"
            | ".ifczip"
            | ".ids"
            | ".bcf"
            | ".bcfzip"
            | ".json"
            | ".yaml"
            | ".yml"
            | ".toml"
            | ".xml"
            | ".csv"
            | ".tsv"
            | ".step"
            | ".stp"
            | ".iges"
            | ".igs"
            | ".stl"
            | ".dxf"
            | ".glb"
            | ".gltf"
            | ".svg"
            | ".html"
            | ".htm"
            | ".js"
            | ".ts"
            | ".rs"
            | ".md"
            | ".docx"
            | ".xlsx"
            | ".pptx"
            | ".zip"
    ) || mime.contains("json")
        || mime.contains("yaml")
        || mime.starts_with("text/")
        || mime.starts_with("model/")
    {
        return ModuleFileValidationStatus::PendingValidation;
    }

    ModuleFileValidationStatus::ValidatorNotConfigured
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use crate::module_audit::{AuditEventKind, AuditEventQuery, ModuleAuditService};

    use super::{
        CopyFileRequest, CreateModuleFileRequest, FileListParentScope, FileListQuery,
        ModuleFileKind, ModuleFileService, ModuleFileStatus, ModuleFileValidationStatus,
        MoveFileRequest, ShareFileRequest, UpdateFileContentRequest, UpdateFileValidationRequest,
        UpdateModuleFileRequest,
    };

    fn create_factory_folder_and_file(files: &ModuleFileService) -> (uuid::Uuid, uuid::Uuid) {
        let folder = files
            .create_file(
                "production_manufacturing",
                CreateModuleFileRequest {
                    name: "CNC".to_owned(),
                    kind: ModuleFileKind::Folder,
                    parent_id: None,
                    mime_type: None,
                    size_bytes: None,
                    owner: Some("planner".to_owned()),
                    tags: Some(vec!["factory".to_owned()]),
                    checksum: None,
                    content: None,
                },
            )
            .expect("folder should be created");
        assert_eq!(folder.module_id, "production_manufacturing");

        let file = files
            .create_file(
                "production_manufacturing",
                CreateModuleFileRequest {
                    name: "plate.nc".to_owned(),
                    kind: ModuleFileKind::File,
                    parent_id: Some(folder.id),
                    mime_type: Some("text/plain".to_owned()),
                    size_bytes: Some(3),
                    owner: Some("planner".to_owned()),
                    tags: None,
                    checksum: None,
                    content: Some("G01".to_owned()),
                },
            )
            .expect("file should be created");
        (folder.id, file.id)
    }

    #[test]
    fn file_workflow_audits_operations() {
        let audit = Arc::new(ModuleAuditService::new());
        let files = ModuleFileService::new(Arc::clone(&audit));
        let (folder_id, file_id) = create_factory_folder_and_file(&files);

        let renamed = files
            .update_file(
                file_id,
                UpdateModuleFileRequest {
                    name: Some("plate-v2.nc".to_owned()),
                    owner: None,
                    tags: Some(vec!["cnc".to_owned()]),
                    mime_type: None,
                },
            )
            .expect("file should be renamed");
        assert_eq!(renamed.name, "plate-v2.nc");

        let moved = files
            .move_file(
                file_id,
                MoveFileRequest {
                    target_parent_id: None,
                    actor: Some("planner".to_owned()),
                },
            )
            .expect("file should be moved");
        assert_eq!(moved.parent_id, None);

        let copied = files
            .copy_file(
                file_id,
                CopyFileRequest {
                    target_module_id: None,
                    target_parent_id: Some(folder_id),
                    name: Some("plate-copy.nc".to_owned()),
                    actor: Some("planner".to_owned()),
                },
            )
            .expect("file should be copied");
        assert_ne!(copied.id, file_id);

        let share = files
            .share_file(
                file_id,
                ShareFileRequest {
                    permissions: vec!["read".to_owned()],
                    expires_at: None,
                    actor: Some("planner".to_owned()),
                },
            )
            .expect("file should be shared");
        assert!(share.share_url.contains(&file_id.to_string()));

        let trashed = files.trash_file(file_id).expect("file should be trashed");
        assert_eq!(trashed.status, ModuleFileStatus::SoftDeleted);

        let events = audit
            .list(&AuditEventQuery {
                module_id: Some("production_manufacturing".to_owned()),
                target_type: None,
                target_id: None,
                actor: None,
                limit: Some(20),
                cursor: None,
            })
            .expect("audit events should list");
        assert!(
            events
                .items
                .iter()
                .any(|event| event.action == AuditEventKind::FileCopied)
        );
        assert!(
            events
                .items
                .iter()
                .any(|event| event.action == AuditEventKind::FileTrashed)
        );
    }

    #[test]
    fn create_and_list_files_with_filters() {
        let audit = Arc::new(ModuleAuditService::new());
        let files = ModuleFileService::new(audit);
        let root = files
            .create_file(
                "production_manufacturing",
                CreateModuleFileRequest {
                    name: "Root".to_owned(),
                    kind: ModuleFileKind::Folder,
                    parent_id: None,
                    mime_type: None,
                    size_bytes: None,
                    owner: None,
                    tags: None,
                    checksum: None,
                    content: None,
                },
            )
            .expect("root folder should be created");
        let child = files
            .create_file(
                "production_manufacturing",
                CreateModuleFileRequest {
                    name: "drawing.dxf".to_owned(),
                    kind: ModuleFileKind::File,
                    parent_id: Some(root.id),
                    mime_type: Some("application/dxf".to_owned()),
                    size_bytes: Some(128),
                    owner: None,
                    tags: None,
                    checksum: None,
                    content: None,
                },
            )
            .expect("file should be created");
        let root_id = root.id;
        let child_id = child.id;

        let page = files
            .list_module_files(
                "production_manufacturing",
                &FileListQuery {
                    parent_id: Some(root_id),
                    parent_scope: None,
                    status: Some(ModuleFileStatus::Active),
                    kind: Some(ModuleFileKind::File),
                    limit: Some(1),
                    cursor: None,
                },
            )
            .expect("filtered file list should work");

        assert_eq!(page.items, vec![child]);
        assert_eq!(page.page_info.limit, 1);
        assert!(!page.page_info.has_more);

        let root_page = files
            .list_module_files(
                "production_manufacturing",
                &FileListQuery {
                    parent_id: None,
                    parent_scope: Some(FileListParentScope::Root),
                    status: None,
                    kind: None,
                    limit: None,
                    cursor: None,
                },
            )
            .expect("root-scoped file list should work");

        assert_eq!(root_page.items, vec![root]);
        assert!(!root_page.items.iter().any(|node| node.id == child_id));
    }

    #[test]
    fn file_content_updates_refresh_checksum() {
        let audit = Arc::new(ModuleAuditService::new());
        let files = ModuleFileService::new(audit);
        let file = files
            .create_file(
                "digital_twin",
                CreateModuleFileRequest {
                    name: "source.ifc".to_owned(),
                    kind: ModuleFileKind::File,
                    parent_id: None,
                    mime_type: Some("application/x-step".to_owned()),
                    size_bytes: Some(12),
                    owner: Some("planner".to_owned()),
                    tags: Some(vec!["ifc".to_owned()]),
                    checksum: Some("sha256:source".to_owned()),
                    content: None,
                },
            )
            .expect("file should be created");
        assert_eq!(file.metadata.checksum.as_deref(), Some("sha256:source"));

        let updated = files
            .update_content(
                file.id,
                UpdateFileContentRequest {
                    content: "ISO-10303-21;".to_owned(),
                    content_type: Some("application/x-step".to_owned()),
                    actor: Some("planner".to_owned()),
                },
            )
            .expect("content should update");
        assert_eq!(updated.content, "ISO-10303-21;");

        let node = files.get_file(file.id).expect("file should still exist");
        assert_ne!(node.metadata.checksum.as_deref(), Some("sha256:source"));
        assert!(
            node.metadata
                .checksum
                .unwrap_or_default()
                .starts_with("sha256:")
        );
    }

    #[test]
    fn validation_result_is_independent_from_file_status() {
        let audit = Arc::new(ModuleAuditService::new());
        let files = ModuleFileService::new(audit);
        let ifc = files
            .create_file(
                "construction_management",
                CreateModuleFileRequest {
                    name: "model.ifc".to_owned(),
                    kind: ModuleFileKind::File,
                    parent_id: None,
                    mime_type: Some("application/x-step".to_owned()),
                    size_bytes: Some(12),
                    owner: None,
                    tags: None,
                    checksum: None,
                    content: None,
                },
            )
            .expect("ifc should be created");
        assert_eq!(ifc.status, ModuleFileStatus::Active);
        assert_eq!(
            ifc.validation.status,
            ModuleFileValidationStatus::PendingValidation
        );

        let pdf = files
            .create_file(
                "construction_management",
                CreateModuleFileRequest {
                    name: "signed-drawing.pdf".to_owned(),
                    kind: ModuleFileKind::File,
                    parent_id: None,
                    mime_type: Some("application/pdf".to_owned()),
                    size_bytes: Some(12),
                    owner: None,
                    tags: None,
                    checksum: None,
                    content: None,
                },
            )
            .expect("pdf should be created");
        assert_eq!(pdf.status, ModuleFileStatus::Active);
        assert_eq!(
            pdf.validation.status,
            ModuleFileValidationStatus::ProfessionalReviewRequired
        );

        let validated = files
            .update_validation(
                ifc.id,
                UpdateFileValidationRequest {
                    status: ModuleFileValidationStatus::Passed,
                    validator_ref: Some("test-validator".to_owned()),
                    report_ref: None,
                    summary: Some("ok".to_owned()),
                    checked_at: None,
                    actor: Some("tester".to_owned()),
                },
            )
            .expect("validation should update");
        assert_eq!(validated.status, ModuleFileStatus::Active);
        assert_eq!(
            validated.validation.status,
            ModuleFileValidationStatus::Passed
        );
        assert_eq!(
            validated.validation.validator_ref.as_deref(),
            Some("test-validator")
        );
    }

    #[test]
    fn invalid_module_id_returns_not_found() {
        let audit = Arc::new(ModuleAuditService::new());
        let files = ModuleFileService::new(audit);
        let err = files
            .create_file(
                "not_a_module",
                CreateModuleFileRequest {
                    name: "bad".to_owned(),
                    kind: ModuleFileKind::File,
                    parent_id: None,
                    mime_type: None,
                    size_bytes: None,
                    owner: None,
                    tags: None,
                    checksum: None,
                    content: None,
                },
            )
            .expect_err("unknown module should fail");
        assert_eq!(err.http_status(), 404);
    }
}
