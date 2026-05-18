// Backend CDE file API client for module workbench runtime.
// License: Apache-2.0

import { backendRequest, buildQuery } from './backend-api';
import {
  getModuleMimeTypeForName,
  getModuleRootId,
  type ModuleAuditEvent,
  type ModuleFileNode,
  type ModuleFileNodeKind,
  type ModuleFileStatus,
} from './module-file-system';
import type { ModuleId } from './module-registry';

export type BackendModuleFileKind = 'folder' | 'file';
export type BackendModuleFileStatus =
  | 'draft'
  | 'uploaded'
  | 'active'
  | 'shared'
  | 'soft_deleted'
  | 'archived';

export interface BackendModuleFileMetadata {
  sizeBytes: number;
  mimeType: string | null;
  checksum: string | null;
  version: number;
  owner: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BackendModuleFileNode {
  id: string;
  moduleId: string;
  parentId: string | null;
  name: string;
  kind: BackendModuleFileKind;
  status: BackendModuleFileStatus;
  metadata: BackendModuleFileMetadata;
}

export interface BackendPageInfo {
  nextCursor?: string | null;
  hasNextPage?: boolean;
}

export interface BackendModuleFileListResponse {
  files: BackendModuleFileNode[];
  total: number;
  pageInfo?: BackendPageInfo;
}

export interface ModuleFileListOptions {
  parentId?: string | null;
  status?: BackendModuleFileStatus;
  kind?: BackendModuleFileKind;
  limit?: number;
  cursor?: string;
}

export interface CreateBackendModuleFileInput {
  moduleId: ModuleId;
  parentId?: string | null;
  name: string;
  kind: BackendModuleFileKind;
  mimeType?: string | null;
  sizeBytes?: number;
  owner?: string;
  tags?: string[];
  checksum?: string | null;
  content?: string;
}

export interface UpdateBackendModuleFileInput {
  name?: string;
  owner?: string;
  tags?: string[];
  mimeType?: string;
}

export interface MoveBackendModuleFileInput {
  moduleId: ModuleId;
  targetParentId?: string | null;
  actor?: string;
}

export interface CopyBackendModuleFileInput {
  targetModuleId?: ModuleId;
  targetParentId?: string | null;
  name?: string;
  actor?: string;
}

export interface BackendShareFileResponse {
  fileId: string;
  shareUrl: string;
  permissions: string[];
  expiresAt: string | null;
}

export interface BackendFileContentResponse {
  fileId: string;
  content: string;
  contentType: string | null;
  updatedAt: string;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const statusMap = {
  draft: 'pending_approval',
  uploaded: 'uploaded',
  active: 'active',
  shared: 'shared',
  soft_deleted: 'soft_deleted',
  archived: 'archived',
} satisfies Record<BackendModuleFileStatus, ModuleFileStatus>;

export function isBackendModuleFileId(fileId: string | null | undefined): boolean {
  return Boolean(fileId && uuidPattern.test(fileId));
}

export function toBackendParentId(
  moduleId: ModuleId,
  parentId: string | null | undefined,
): string | null | undefined {
  if (!parentId || parentId === getModuleRootId(moduleId)) {
    return null;
  }
  return isBackendModuleFileId(parentId) ? parentId : undefined;
}

function requireBackendParentId(
  moduleId: ModuleId,
  parentId: string | null | undefined,
): string | null {
  const backendParentId = toBackendParentId(moduleId, parentId);
  if (backendParentId === undefined) {
    throw new Error(
      `Cannot persist module file under non-backend parent ${parentId}`,
    );
  }
  return backendParentId;
}

function toModuleFileKind(kind: BackendModuleFileKind): ModuleFileNodeKind {
  return kind === 'folder' ? 'folder' : 'file';
}

function backendAuditEvent(
  node: BackendModuleFileNode,
  summary: string,
): ModuleAuditEvent {
  const updatedAt = node.metadata.updatedAt || new Date().toISOString();
  return {
    id: `backend-cde-${node.id}-${updatedAt}`,
    at: updatedAt,
    actor: 'BackendModuleFileApiClient',
    summary,
  };
}

export function mapBackendModuleFileNode(
  node: BackendModuleFileNode,
): ModuleFileNode {
  const moduleId = node.moduleId as ModuleId;
  const type = toModuleFileKind(node.kind);
  const auditEvent = backendAuditEvent(node, `同步后端 CDE 文件 ${node.name}`);
  const mapped: ModuleFileNode = {
    id: node.id,
    name: node.name,
    type,
    moduleId,
    parentId: node.parentId ?? getModuleRootId(moduleId),
    size: node.metadata.sizeBytes,
    mimeType: node.metadata.mimeType ?? getModuleMimeTypeForName(node.name, type),
    status: statusMap[node.status],
    version: `v${node.metadata.version}.0`,
    owner: node.metadata.owner,
    updatedAt: node.metadata.updatedAt,
    tags: node.metadata.tags,
    permissions:
      node.status === 'shared'
        ? ['read', 'share']
        : ['read', 'write', 'share', 'approve'],
    auditTrail: [auditEvent],
    source: 'backend',
  };
  if (node.metadata.checksum) {
    mapped.checksum = node.metadata.checksum;
  }
  return mapped;
}

export async function listModuleFiles(
  moduleId: ModuleId,
  options: ModuleFileListOptions = {},
): Promise<{
  files: ModuleFileNode[];
  total: number;
  pageInfo?: BackendPageInfo;
}> {
  const query = buildQuery({
    parentId: toBackendParentId(moduleId, options.parentId),
    status: options.status,
    kind: options.kind,
    limit: options.limit,
    cursor: options.cursor,
  });
  const response = await backendRequest<BackendModuleFileListResponse>(
    `/v1/modules/${encodeURIComponent(moduleId)}/files${query}`,
    { cache: 'no-store' },
  );
  const result: {
    files: ModuleFileNode[];
    total: number;
    pageInfo?: BackendPageInfo;
  } = {
    files: response.files.map(mapBackendModuleFileNode),
    total: response.total,
  };
  if (response.pageInfo) {
    result.pageInfo = response.pageInfo;
  }
  return result;
}

export async function createModuleFile(
  input: CreateBackendModuleFileInput,
): Promise<ModuleFileNode> {
  const node = await backendRequest<BackendModuleFileNode>(
    `/v1/modules/${encodeURIComponent(input.moduleId)}/files`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        kind: input.kind,
        parentId: requireBackendParentId(input.moduleId, input.parentId),
        mimeType:
          input.mimeType ?? getModuleMimeTypeForName(input.name, input.kind),
        sizeBytes: input.sizeBytes,
        owner: input.owner,
        tags: input.tags,
        checksum: input.checksum,
        content: input.content,
      }),
    },
  );
  return mapBackendModuleFileNode(node);
}

export async function getModuleFile(fileId: string): Promise<ModuleFileNode> {
  const node = await backendRequest<BackendModuleFileNode>(
    `/v1/files/${encodeURIComponent(fileId)}`,
    { cache: 'no-store' },
  );
  return mapBackendModuleFileNode(node);
}

export async function updateModuleFile(
  fileId: string,
  input: UpdateBackendModuleFileInput,
): Promise<ModuleFileNode> {
  const node = await backendRequest<BackendModuleFileNode>(
    `/v1/files/${encodeURIComponent(fileId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return mapBackendModuleFileNode(node);
}

export async function moveModuleFile(
  fileId: string,
  input: MoveBackendModuleFileInput,
): Promise<ModuleFileNode> {
  const node = await backendRequest<BackendModuleFileNode>(
    `/v1/files/${encodeURIComponent(fileId)}/move`,
    {
      method: 'POST',
      body: JSON.stringify({
        targetParentId: requireBackendParentId(
          input.moduleId,
          input.targetParentId,
        ),
        actor: input.actor,
      }),
    },
  );
  return mapBackendModuleFileNode(node);
}

export async function copyModuleFile(
  fileId: string,
  input: CopyBackendModuleFileInput,
): Promise<ModuleFileNode> {
  const moduleId = input.targetModuleId;
  const node = await backendRequest<BackendModuleFileNode>(
    `/v1/files/${encodeURIComponent(fileId)}/copy`,
    {
      method: 'POST',
      body: JSON.stringify({
        targetModuleId: moduleId,
        targetParentId: moduleId
          ? requireBackendParentId(moduleId, input.targetParentId)
          : undefined,
        name: input.name,
        actor: input.actor,
      }),
    },
  );
  return mapBackendModuleFileNode(node);
}

export async function shareModuleFile(
  fileId: string,
  permissions: string[] = ['read'],
  actor = 'frontend-file-explorer',
): Promise<BackendShareFileResponse> {
  return backendRequest<BackendShareFileResponse>(
    `/v1/files/${encodeURIComponent(fileId)}/share`,
    {
      method: 'POST',
      body: JSON.stringify({
        permissions,
        actor,
      }),
    },
  );
}

export async function trashModuleFile(fileId: string): Promise<ModuleFileNode> {
  const node = await backendRequest<BackendModuleFileNode>(
    `/v1/files/${encodeURIComponent(fileId)}/trash`,
    { method: 'POST' },
  );
  return mapBackendModuleFileNode(node);
}

export async function getModuleFileContent(
  fileId: string,
): Promise<BackendFileContentResponse> {
  return backendRequest<BackendFileContentResponse>(
    `/v1/files/${encodeURIComponent(fileId)}/content`,
    { cache: 'no-store' },
  );
}

export async function updateModuleFileContent(
  fileId: string,
  content: string,
  contentType?: string,
  actor = 'frontend-file-explorer',
): Promise<BackendFileContentResponse> {
  return backendRequest<BackendFileContentResponse>(
    `/v1/files/${encodeURIComponent(fileId)}/content`,
    {
      method: 'PUT',
      body: JSON.stringify({
        content,
        contentType,
        actor,
      }),
    },
  );
}

export const moduleFileApiClient = {
  listModuleFiles,
  createModuleFile,
  getModuleFile,
  updateModuleFile,
  moveModuleFile,
  copyModuleFile,
  shareModuleFile,
  trashModuleFile,
  getModuleFileContent,
  updateModuleFileContent,
};
