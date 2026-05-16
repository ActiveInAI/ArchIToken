// lib/local-file-runtime-server.ts - Node.js storage runtime for local uploads
// License: Apache-2.0

import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, extname, resolve } from 'node:path';
import { fileTypeForFileName } from './file-type-registry';
import {
  extensionOf,
  getLocalFileViewerKind,
  inferMimeType,
  localUploadsIndexFile,
  type LocalFileIndex,
  type LocalFileMetadata,
} from './local-file-runtime';
import type { ModuleId } from './module-registry';

function sanitizeFileName(name: string): string {
  return (
    name
      .replace(/[\\/]/g, '_')
      .replace(/[^\p{L}\p{N}._ -]/gu, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160) || 'uploaded-file'
  );
}

export function getLocalUploadsDir(): string {
  const configuredDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR?.trim();
  return configuredDir
    ? resolve(configuredDir)
    : join(/* turbopackIgnore: true */ homedir(), '.architoken', 'uploads');
}

export function getLocalUploadsIndexPath(): string {
  return join(getLocalUploadsDir(), localUploadsIndexFile);
}

export function resolveLocalUploadStoragePath(
  file: Pick<LocalFileMetadata, 'fileId' | 'ext' | 'storagePath'>,
): string {
  const storageName = basename(file.storagePath);
  if (
    !storageName.startsWith(file.fileId) ||
    (file.ext && !storageName.endsWith(file.ext))
  ) {
    throw new Error(`invalid local upload storage binding for ${file.fileId}`);
  }
  return join(getLocalUploadsDir(), storageName);
}

export async function ensureLocalUploadsDir(): Promise<void> {
  await mkdir(getLocalUploadsDir(), { recursive: true });
}

export async function readLocalFileIndex(): Promise<LocalFileIndex> {
  await ensureLocalUploadsDir();
  try {
    const content = await readFile(getLocalUploadsIndexPath(), 'utf8');
    const parsed = JSON.parse(content) as LocalFileIndex;
    return {
      files: Array.isArray(parsed.files)
        ? dedupeLocalFileIndex(parsed.files)
        : [],
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return { files: [] };
    }
    throw error;
  }
}

export async function writeLocalFileIndex(
  index: LocalFileIndex,
): Promise<void> {
  await ensureLocalUploadsDir();
  await writeFile(
    getLocalUploadsIndexPath(),
    `${JSON.stringify({ files: dedupeLocalFileIndex(index.files) }, null, 2)}\n`,
    'utf8',
  );
}

export async function getLocalFileMetadata(
  fileId: string,
): Promise<LocalFileMetadata | null> {
  const index = await readLocalFileIndex();
  return index.files.find((file) => file.fileId === fileId) ?? null;
}

export async function saveLocalUpload(input: {
  file: File;
  moduleId: ModuleId;
  parentId?: string;
  owner?: string;
  tags?: string[];
}): Promise<LocalFileMetadata> {
  await ensureLocalUploadsDir();

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const ext = extensionOf(input.file.name);
  const safeName = sanitizeFileName(input.file.name);
  const index = await readLocalFileIndex();
  const existing = await findExistingLocalUpload(index.files, {
    moduleId: input.moduleId,
    originalName: safeName,
    size: bytes.byteLength,
    checksum,
    ...(input.parentId ? { parentId: input.parentId } : {}),
  });
  if (existing) {
    return existing;
  }

  const fileId = `local-${Date.now()}-${randomUUID()}`;
  const storageName = `${fileId}${ext || extname(safeName)}`;
  const storagePath = join(getLocalUploadsDir(), storageName);
  const mimeType =
    input.file.type && input.file.type !== 'application/octet-stream'
      ? input.file.type
      : inferMimeType(input.file.name);
  const registryEntry = fileTypeForFileName(input.file.name);
  const viewerKind = getLocalFileViewerKind({ mimeType, ext });
  await writeFile(storagePath, bytes);

  const metadata: LocalFileMetadata = {
    fileId,
    originalName: safeName,
    moduleId: input.moduleId,
    ...(input.parentId ? { parentId: input.parentId } : {}),
    size: bytes.byteLength,
    mimeType,
    ext,
    storagePath,
    createdAt: new Date().toISOString(),
    owner: input.owner ?? 'local-user',
    status: 'schema_validating',
    version: 'v1.0',
    tags:
      input.tags ??
      Array.from(
        new Set(
          [
            'local-upload',
            viewerKind,
            registryEntry?.logicalType,
            registryEntry?.id,
            registryEntry?.productionRoute,
          ].filter((tag): tag is string => Boolean(tag)),
        ),
      ),
    checksum,
  };

  await writeLocalFileIndex({
    files: [metadata, ...index.files.filter((file) => file.fileId !== fileId)],
  });
  return metadata;
}

export async function deleteLocalUpload(
  fileId: string,
): Promise<LocalFileMetadata | null> {
  const index = await readLocalFileIndex();
  const metadata = index.files.find((file) => file.fileId === fileId) ?? null;
  if (!metadata) {
    return null;
  }

  try {
    await unlink(resolveLocalUploadStoragePath(metadata));
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== 'ENOENT') {
      throw error;
    }
  }

  await writeLocalFileIndex({
    files: index.files.filter((file) => file.fileId !== fileId),
  });
  return metadata;
}

function localUploadIdentity(
  file: Pick<
    LocalFileMetadata,
    'moduleId' | 'parentId' | 'originalName' | 'size' | 'checksum'
  >,
): string {
  return [
    file.moduleId,
    file.parentId ?? '',
    file.originalName,
    String(file.size),
    file.checksum,
  ].join('\u001f');
}

function dedupeLocalFileIndex(files: LocalFileMetadata[]): LocalFileMetadata[] {
  const byFileId = new Set<string>();
  const byIdentity = new Set<string>();
  const deduped: LocalFileMetadata[] = [];

  for (const file of files) {
    if (byFileId.has(file.fileId)) {
      continue;
    }
    const identity = localUploadIdentity(file);
    if (byIdentity.has(identity)) {
      continue;
    }
    byFileId.add(file.fileId);
    byIdentity.add(identity);
    deduped.push(file);
  }

  return deduped;
}

async function findExistingLocalUpload(
  files: LocalFileMetadata[],
  probe: Pick<
    LocalFileMetadata,
    'moduleId' | 'parentId' | 'originalName' | 'size' | 'checksum'
  >,
): Promise<LocalFileMetadata | null> {
  const identity = localUploadIdentity(probe);
  for (const file of files) {
    if (localUploadIdentity(file) !== identity) {
      continue;
    }
    try {
      await access(resolveLocalUploadStoragePath(file));
      return file;
    } catch {
      continue;
    }
  }
  return null;
}
