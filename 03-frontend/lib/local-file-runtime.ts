// lib/local-file-runtime.ts - Next.js local file runtime contract
// License: Apache-2.0

import {
  extensionOf as registryExtensionOf,
  fileTypeForExtension,
  inferRegistryMimeType,
  type FileViewerKind,
} from './file-type-registry';
import { normalizeModuleId, type ModuleId } from './module-registry';

export type LocalFileStatus =
  | 'uploaded'
  | 'schema_validating'
  | 'pending_approval'
  | 'approved'
  | 'archived';

export type LocalFileViewerKind = FileViewerKind;

export type LocalFileRuntimeRecordStatus =
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'skipped';

export interface LocalFileRuntimeSourceSnapshot {
  fileId: string;
  version: string;
  checksum: string;
  size: number;
}

export interface LocalFileRuntimeArtifact {
  name: string;
  role: string;
  mediaType: string;
  size: number;
  checksum: string;
  path?: string;
  url?: string;
  engine?: string;
  persisted?: boolean;
  metadata?: Record<string, unknown>;
}

export interface LocalFileRuntimeWriteBack {
  mode: 'overwrite' | 'new_file' | 'same_version' | 'none';
  route: string;
  fileId?: string;
  version?: string;
  checksum?: string;
  size?: number;
  tags?: string[];
}

export interface LocalFileRuntimeFailureEvidence {
  code: string;
  message: string;
  status?: number | string;
  adapter?: string;
  route?: string;
  command?: string;
  stderr?: string;
  details?: Record<string, unknown>;
}

export interface LocalFileRuntimeRecord {
  schema: 'architoken.local_file_runtime_record.v1';
  recordId: string;
  at: string;
  actor: string;
  route: string;
  status: LocalFileRuntimeRecordStatus;
  source: LocalFileRuntimeSourceSnapshot;
  operationId?: string;
  adapter?: string;
  engine?: string;
  artifact?: LocalFileRuntimeArtifact;
  writeBack?: LocalFileRuntimeWriteBack;
  failureEvidence?: LocalFileRuntimeFailureEvidence;
  notes?: string[];
}

export interface LocalFileMetadata {
  fileId: string;
  originalName: string;
  moduleId: ModuleId;
  parentId?: string;
  size: number;
  mimeType: string;
  ext: string;
  storagePath: string;
  createdAt: string;
  owner: string;
  status: LocalFileStatus;
  version: string;
  tags: string[];
  checksum: string;
  runtimeRecords?: LocalFileRuntimeRecord[];
}

export interface LocalFileIndex {
  files: LocalFileMetadata[];
}

export const localUploadsRelativeDir = '.architoken/uploads';
export const localUploadsIndexFile = 'index.json';

export function extensionOf(name: string): string {
  return registryExtensionOf(name);
}

export function inferMimeType(
  name: string,
  fallback = 'application/octet-stream',
): string {
  return inferRegistryMimeType(name, fallback);
}

export function getLocalFileViewerKind(
  input: Pick<LocalFileMetadata, 'mimeType' | 'ext'>,
): LocalFileViewerKind {
  const mime = input.mimeType.toLowerCase();
  const ext = input.ext.toLowerCase();
  const registered = fileTypeForExtension(ext);

  if (registered) return registered.viewerKind;

  if (mime === 'application/pdf' || ext === '.pdf' || ext === '.pdfa')
    return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.includes('json')) return 'json';
  if (mime.startsWith('model/')) return 'engineering';
  if (mime.startsWith('text/')) return 'text';
  return 'unknown';
}

export function isDigitalTwinSourceFile(
  input: Pick<LocalFileMetadata, 'ext' | 'mimeType'>,
): boolean {
  const kind = getLocalFileViewerKind(input);
  return kind === 'image' || kind === 'video' || kind === 'engineering';
}

export function normalizeUploadModuleId(
  value: FormDataEntryValue | string | null,
): ModuleId {
  const normalized = normalizeModuleId(
    String(value ?? 'construction_management'),
  );
  return normalized ?? 'construction_management';
}
