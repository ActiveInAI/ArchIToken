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

export interface LocalFileMetadata {
  fileId: string;
  originalName: string;
  moduleId: ModuleId;
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
    String(value ?? 'construction_supervision'),
  );
  return normalized ?? 'construction_supervision';
}
