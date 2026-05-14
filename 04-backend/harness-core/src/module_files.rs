//! Module-scoped file and folder service.
//!
//! This Phase 2 skeleton stores metadata and small content stubs in memory.
//! Real bytes belong behind an `ObjectStore` adapter in a later implementation.

use std::{collections::HashMap, sync::Arc};

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
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

/// Metadata associated with a module file node.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleFileMetadata {
    /// Size in bytes. Folder nodes use zero.
    pub size_bytes: u64,
    /// Optional MIME type.
    pub mime_type: Option<String>,
    /// Optional checksum placeholder.
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
    /// Optional small in-memory content stub.
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
    /// Generated share URL placeholder.
    pub share_url: String,
    /// Permissions carried by the generated link.
    pub permissions: Vec<String>,
    /// Optional expiry timestamp.
    pub expires_at: Option<DateTime<Utc>>,
}

/// Replace in-memory content request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFileContentRequest {
    /// Content stub.
    pub content: String,
    /// Optional MIME type.
    pub content_type: Option<String>,
    /// Actor triggering the operation.
    pub actor: Option<String>,
}

/// In-memory content response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContentResponse {
    /// File id.
    pub file_id: Uuid,
    /// Content stub.
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
    /// Optional status filter.
    pub status: Option<ModuleFileStatus>,
    /// Optional file kind filter.
    pub kind: Option<ModuleFileKind>,
    /// Optional page size.
    pub limit: Option<usize>,
    /// Optional numeric cursor offset.
    pub cursor: Option<String>,
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
            .filter(|stored| {
                query
                    .parent_id
                    .is_none_or(|parent_id| stored.node.parent_id == Some(parent_id))
            })
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
        if req.name.trim().is_empty() {
            return Err(HarnessError::InvalidInput(
                "file name is required".to_owned(),
            ));
        }
        self.validate_parent(module_id.as_str(), req.parent_id)?;

        let now = Utc::now();
        let id = Uuid::new_v4();
        let node = ModuleFileNode {
            id,
            module_id: module_id.as_str().to_owned(),
            parent_id: req.parent_id,
            name: req.name,
            kind: req.kind,
            status: ModuleFileStatus::Active,
            metadata: ModuleFileMetadata {
                size_bytes: req.size_bytes.unwrap_or(0),
                mime_type: req.mime_type,
                checksum: None,
                version: 1,
                owner: req.owner.unwrap_or_else(|| DEFAULT_ACTOR.to_owned()),
                tags: req.tags.unwrap_or_default(),
                created_at: now,
                updated_at: now,
            },
        };
        let content = req.content.unwrap_or_default();
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
            if let Some(name) = req.name {
                if name.trim().is_empty() {
                    return Err(HarnessError::InvalidInput(
                        "file name is required".to_owned(),
                    ));
                }
                stored.node.name = name;
            }
            if let Some(owner) = req.owner {
                stored.node.metadata.owner = owner;
            }
            if let Some(tags) = req.tags {
                stored.node.metadata.tags = tags;
            }
            if let Some(mime_type) = req.mime_type {
                stored.node.metadata.mime_type = Some(mime_type);
            }
            stored.node.metadata.version += 1;
            stored.node.metadata.updated_at = Utc::now();
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
            if let Some(content_type) = req.content_type {
                stored.node.metadata.mime_type = Some(content_type);
            }
            stored.node.metadata.version += 1;
            stored.node.metadata.updated_at = Utc::now();
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

    /// Create a share link placeholder for a file or folder.
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

fn req_actor(actor: Option<String>) -> String {
    actor.unwrap_or_else(|| DEFAULT_ACTOR.to_owned())
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use crate::module_audit::{AuditEventKind, AuditEventQuery, ModuleAuditService};

    use super::{
        CopyFileRequest, CreateModuleFileRequest, FileListQuery, ModuleFileKind, ModuleFileService,
        ModuleFileStatus, MoveFileRequest, ShareFileRequest, UpdateModuleFileRequest,
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
                    content: None,
                },
            )
            .expect("file should be created");

        let page = files
            .list_module_files(
                "production_manufacturing",
                &FileListQuery {
                    parent_id: Some(root.id),
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
                    content: None,
                },
            )
            .expect_err("unknown module should fail");
        assert_eq!(err.http_status(), 404);
    }
}
