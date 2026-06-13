// lib/local-file-runtime-server.ts - Node.js storage runtime for local uploads
// License: Apache-2.0

import { createHash, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, extname, resolve } from "node:path";
import { fileTypeForFileName } from "./file-type-registry";
import {
  extensionOf,
  getLocalFileViewerKind,
  inferMimeType,
  localUploadsIndexFile,
  type LocalFileRuntimeArtifact,
  type LocalFileRuntimeFailureEvidence,
  type LocalFileRuntimeRecord,
  type LocalFileRuntimeRecordStatus,
  type LocalFileRuntimeWriteBack,
  type LocalFileIndex,
  type LocalFileMetadata,
} from "./local-file-runtime";
import type { ModuleId } from "./module-registry";

export interface LocalFileRuntimeRecordInput {
  actor?: string;
  route: string;
  status?: LocalFileRuntimeRecordStatus;
  operationId?: string;
  adapter?: string;
  engine?: string;
  artifact?: Partial<LocalFileRuntimeArtifact>;
  writeBack?: Partial<LocalFileRuntimeWriteBack>;
  failureEvidence?: LocalFileRuntimeFailureEvidence;
  notes?: string[];
}

function sanitizeFileName(name: string): string {
  return (
    name
      .replace(/[\\/]/g, "_")
      .replace(/[^\p{L}\p{N}._ -]/gu, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160) || "uploaded-file"
  );
}

export function getLocalUploadsDir(): string {
  const configuredDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR?.trim();
  return configuredDir
    ? resolve(configuredDir)
    : join(/* turbopackIgnore: true */ homedir(), ".architoken", "uploads");
}

export function getLocalUploadsIndexPath(): string {
  return join(getLocalUploadsDir(), localUploadsIndexFile);
}

export function resolveLocalUploadStoragePath(
  file: Pick<LocalFileMetadata, "fileId" | "ext" | "storagePath">,
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
    const content = await readFile(getLocalUploadsIndexPath(), "utf8");
    const parsed = JSON.parse(content) as LocalFileIndex;
    return {
      files: Array.isArray(parsed.files)
        ? dedupeLocalFileIndex(parsed.files.map(normalizePersistedLocalFile))
        : [],
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return { files: [] };
    }
    // A transient malformed read (e.g. a concurrent writer mid-update on a busy
    // CI runner) must not abort the caller — the index is a derived cache that is
    // rebuilt as files are persisted. Degrade to empty instead of throwing.
    if (error instanceof SyntaxError) {
      return { files: [] };
    }
    throw error;
  }
}

export async function writeLocalFileIndex(
  index: LocalFileIndex,
): Promise<void> {
  await ensureLocalUploadsDir();
  const target = getLocalUploadsIndexPath();
  // Write atomically (temp file + rename) so concurrent readers never observe a
  // half-written index. rename(2) is atomic on the same filesystem, eliminating
  // the read-modify-write corruption seen under parallel test workers.
  const tempPath = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(
    tempPath,
    `${JSON.stringify({ files: dedupeLocalFileIndex(index.files) }, null, 2)}\n`,
    "utf8",
  );
  await rename(tempPath, target);
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
  const checksum = createHash("sha256").update(bytes).digest("hex");
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
    return normalizePersistedLocalFile(existing);
  }

  const fileId = `local-${Date.now()}-${randomUUID()}`;
  const storageName = `${fileId}${ext || extname(safeName)}`;
  const storagePath = join(getLocalUploadsDir(), storageName);
  const mimeType =
    input.file.type && input.file.type !== "application/octet-stream"
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
    owner: input.owner ?? "local-user",
    status: "uploaded",
    version: "v1.0",
    tags:
      input.tags ??
      Array.from(
        new Set(
          [
            "local-upload",
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
    if (nodeError.code !== "ENOENT") {
      throw error;
    }
  }

  await writeLocalFileIndex({
    files: index.files.filter((file) => file.fileId !== fileId),
  });
  return metadata;
}

export async function updateLocalUploadBytes(
  fileId: string,
  bytes: Uint8Array,
  input: {
    mimeType?: string;
    tags?: string[];
    runtime?: LocalFileRuntimeRecordInput;
  } = {},
): Promise<LocalFileMetadata | null> {
  const index = await readLocalFileIndex();
  const metadata = index.files.find((file) => file.fileId === fileId) ?? null;
  if (!metadata) {
    return null;
  }

  const checksum = sha256Bytes(bytes);
  await writeFile(resolveLocalUploadStoragePath(metadata), bytes);

  const baseUpdated: LocalFileMetadata = {
    ...metadata,
    size: bytes.byteLength,
    mimeType: input.mimeType ?? metadata.mimeType,
    checksum,
    createdAt: new Date().toISOString(),
    version: bumpLocalUploadVersion(metadata.version),
    tags: Array.from(
      new Set([...(metadata.tags ?? []), "local-edit", ...(input.tags ?? [])]),
    ),
  };
  const updated: LocalFileMetadata = {
    ...baseUpdated,
    runtimeRecords: appendRuntimeRecord(metadata.runtimeRecords, {
      ...buildWriteBackRuntimeRecord(metadata, baseUpdated, bytes, input.runtime),
    }),
  };

  await writeLocalFileIndex({
    files: index.files.map((file) => (file.fileId === fileId ? updated : file)),
  });
  return updated;
}

export async function appendLocalUploadRuntimeRecord(
  fileId: string,
  input: LocalFileRuntimeRecordInput,
): Promise<LocalFileMetadata | null> {
  const index = await readLocalFileIndex();
  const metadata = index.files.find((file) => file.fileId === fileId) ?? null;
  if (!metadata) {
    return null;
  }

  const updated: LocalFileMetadata = {
    ...metadata,
    runtimeRecords: appendRuntimeRecord(
      metadata.runtimeRecords,
      buildRuntimeRecord(metadata, input),
    ),
  };

  await writeLocalFileIndex({
    files: index.files.map((file) => (file.fileId === fileId ? updated : file)),
  });
  return updated;
}

function localUploadIdentity(
  file: Pick<
    LocalFileMetadata,
    "moduleId" | "parentId" | "originalName" | "size" | "checksum"
  >,
): string {
  return [
    file.moduleId,
    file.parentId ?? "",
    file.originalName,
    String(file.size),
    file.checksum,
  ].join("\u001f");
}

function bumpLocalUploadVersion(version: string): string {
  const match = /^v(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) {
    return "v1.1";
  }
  const major = Number.parseInt(match[1] ?? "1", 10);
  const minor = Number.parseInt(match[2] ?? "0", 10);
  return `v${Number.isFinite(major) ? major : 1}.${Number.isFinite(minor) ? minor + 1 : 1}`;
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

function normalizePersistedLocalFile(
  file: LocalFileMetadata,
): LocalFileMetadata {
  const normalized = Array.isArray(file.runtimeRecords)
    ? { ...file, runtimeRecords: file.runtimeRecords.slice(-50) }
    : file;
  if (file.status !== "schema_validating") {
    return normalized;
  }

  return {
    ...normalized,
    status: "uploaded",
    tags: Array.from(new Set([...file.tags, "legacy-status-normalized"])),
  };
}

async function findExistingLocalUpload(
  files: LocalFileMetadata[],
  probe: Pick<
    LocalFileMetadata,
    "moduleId" | "parentId" | "originalName" | "size" | "checksum"
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

function buildWriteBackRuntimeRecord(
  source: LocalFileMetadata,
  updated: LocalFileMetadata,
  bytes: Uint8Array,
  input?: LocalFileRuntimeRecordInput,
): LocalFileRuntimeRecord {
  const route = input?.route ?? "local-files/put";
  return buildRuntimeRecord(source, {
    ...input,
    route,
    status: input?.status ?? "completed",
    artifact: {
      name: input?.artifact?.name ?? updated.originalName,
      role: input?.artifact?.role ?? "source_writeback",
      mediaType: input?.artifact?.mediaType ?? updated.mimeType,
      size: input?.artifact?.size ?? bytes.byteLength,
      checksum: input?.artifact?.checksum ?? updated.checksum,
      ...(input?.artifact?.path ? { path: input.artifact.path } : {}),
      ...(input?.artifact?.url ? { url: input.artifact.url } : {}),
      ...(input?.artifact?.engine ? { engine: input.artifact.engine } : {}),
      ...(input?.artifact?.persisted !== undefined
        ? { persisted: input.artifact.persisted }
        : {}),
      ...(input?.artifact?.metadata ? { metadata: input.artifact.metadata } : {}),
    },
    writeBack: {
      mode: input?.writeBack?.mode ?? "overwrite",
      route: input?.writeBack?.route ?? route,
      fileId: input?.writeBack?.fileId ?? updated.fileId,
      version: input?.writeBack?.version ?? updated.version,
      checksum: input?.writeBack?.checksum ?? updated.checksum,
      size: input?.writeBack?.size ?? updated.size,
      tags: input?.writeBack?.tags ?? updated.tags,
    },
  });
}

function buildRuntimeRecord(
  source: LocalFileMetadata,
  input: LocalFileRuntimeRecordInput,
): LocalFileRuntimeRecord {
  const record: LocalFileRuntimeRecord = {
    schema: "architoken.local_file_runtime_record.v1",
    recordId: `runtime-${Date.now()}-${randomUUID()}`,
    at: new Date().toISOString(),
    actor: input.actor ?? "local-file-runtime",
    route: input.route,
    status: input.status ?? "completed",
    source: {
      fileId: source.fileId,
      version: source.version,
      checksum: source.checksum,
      size: source.size,
    },
    ...(input.operationId ? { operationId: input.operationId } : {}),
    ...(input.adapter ? { adapter: input.adapter } : {}),
    ...(input.engine ? { engine: input.engine } : {}),
    ...(isCompleteArtifact(input.artifact)
      ? { artifact: input.artifact }
      : {}),
    ...(isCompleteWriteBack(input.writeBack)
      ? { writeBack: input.writeBack }
      : {}),
    ...(input.failureEvidence
      ? { failureEvidence: input.failureEvidence }
      : {}),
    ...(input.notes?.length ? { notes: input.notes } : {}),
  };
  return record;
}

function appendRuntimeRecord(
  existing: LocalFileRuntimeRecord[] | undefined,
  record: LocalFileRuntimeRecord,
): LocalFileRuntimeRecord[] {
  return [...(existing ?? []), record].slice(-50);
}

function isCompleteArtifact(
  artifact: Partial<LocalFileRuntimeArtifact> | undefined,
): artifact is LocalFileRuntimeArtifact {
  const size = artifact?.size;
  return Boolean(
    artifact?.name &&
      artifact.role &&
      artifact.mediaType &&
      typeof size === "number" &&
      Number.isFinite(size) &&
      size >= 0 &&
      artifact.checksum,
  );
}

function isCompleteWriteBack(
  writeBack: Partial<LocalFileRuntimeWriteBack> | undefined,
): writeBack is LocalFileRuntimeWriteBack {
  return Boolean(writeBack?.mode && writeBack.route);
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
