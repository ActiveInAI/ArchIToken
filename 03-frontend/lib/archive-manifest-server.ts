// lib/archive-manifest-server.ts - Server-side archive manifest runtime
// License: Apache-2.0

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";
import {
  getLocalFileMetadata,
  resolveLocalUploadStoragePath,
} from "./local-file-runtime-server";
import { extensionOf } from "./file-type-registry";
import type { LocalFileMetadata } from "./local-file-runtime";

type ArchiveEntryKind =
  | "directory"
  | "archive"
  | "cad"
  | "bim"
  | "office"
  | "document"
  | "image"
  | "media"
  | "code"
  | "data"
  | "file";

export interface ArchiveManifestEntry {
  name: string;
  directory: boolean;
  extension: string;
  kind: ArchiveEntryKind;
  compressedSize: number;
  uncompressedSize: number;
  method: number;
  methodLabel: string;
  localHeaderOffset: number;
  encrypted: boolean;
  unsafe: boolean;
  modifiedAt: string;
  depth: number;
}

export interface ArchiveManifest {
  schema: "architoken.archive_manifest.v1";
  fileId: string;
  originalName: string;
  sourceFormat: string;
  sourceChecksum: string;
  sourceOfRecord: {
    url: string;
    checksum: string;
    rangeRequests: true;
    substitutePreview: false;
  };
  etag: string;
  cachePolicy: "stream+etag+checksum";
  viewer: "external_archive_manifest";
  engine: string;
  entries: ArchiveManifestEntry[];
  fileCount: number;
  directoryCount: number;
  compressedBytes: number;
  uncompressedBytes: number;
  encryptedCount: number;
  nestedArchiveCount: number;
  unsafePathCount: number;
  warnings: string[];
  permissions: {
    canList: boolean;
    canExtractInBrowser: false;
    requiresArchiveWorker: true;
  };
}

export class ArchiveManifestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ArchiveManifestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ArchiveListResult {
  stdout: Buffer;
  stderr: Buffer;
}

const archiveListTimeoutMs = 180_000;
const archiveManifestExtensions = new Set([
  ".7z",
  ".rar",
  ".skp",
  ".tar",
  ".gz",
  ".tgz",
  ".bz2",
  ".xz",
  ".zst",
  ".zipx",
]);

export async function buildArchiveManifest(
  fileId: string,
): Promise<ArchiveManifest> {
  const metadata = await requireLocalArchiveMetadata(fileId);
  const archiveLister = await resolveArchiveLister();
  if (!archiveLister) {
    throw new ArchiveManifestError(
      501,
      "archive_lister_missing",
      "未找到 7z/7zz 归档索引器，RAR/7Z/TAR 等格式无法生成可信目录清单。",
      {
        checked: [
          "ARCHITOKEN_7Z_BIN",
          "/usr/bin/7z",
          "/usr/local/bin/7z",
          "7z",
          "7zz",
        ],
      },
    );
  }

  const sourcePath = resolveLocalUploadStoragePath(metadata);
  const result = await runArchiveLister(archiveLister, sourcePath);
  const entries = parseSevenZipTechnicalList(
    result.stdout.toString("utf8"),
    sourcePath,
  );
  const sourceStat = await stat(sourcePath);
  const warnings = entries
    .filter((entry) => entry.unsafe)
    .map((entry) => `发现可疑路径: ${entry.name}`);

  return {
    schema: "architoken.archive_manifest.v1",
    fileId: metadata.fileId,
    originalName: metadata.originalName,
    sourceFormat: metadata.ext.toLowerCase().replace(/^\./, "") || "archive",
    sourceChecksum: metadata.checksum,
    sourceOfRecord: {
      url: `/api/local-files/${encodeURIComponent(metadata.fileId)}`,
      checksum: metadata.checksum,
      rangeRequests: true,
      substitutePreview: false,
    },
    etag: archiveManifestEtag(metadata),
    cachePolicy: "stream+etag+checksum",
    viewer: "external_archive_manifest",
    engine: basename(archiveLister),
    entries,
    fileCount: entries.filter((entry) => !entry.directory).length,
    directoryCount: entries.filter((entry) => entry.directory).length,
    compressedBytes: sourceStat.size,
    uncompressedBytes: sumArchiveEntryBytes(entries),
    encryptedCount: entries.filter((entry) => entry.encrypted).length,
    nestedArchiveCount: entries.filter((entry) => entry.kind === "archive")
      .length,
    unsafePathCount: entries.filter((entry) => entry.unsafe).length,
    warnings: [...new Set(warnings)],
    permissions: {
      canList: true,
      canExtractInBrowser: false,
      requiresArchiveWorker: true,
    },
  };
}

export function parseSevenZipTechnicalList(
  output: string,
  sourcePath = "",
): ArchiveManifestEntry[] {
  const normalizedSource = sourcePath.replace(/\\/g, "/");
  const blocks = output
    .split(/\r?\n(?=Path = )/)
    .map((block) => block.trim())
    .filter((block) => block.startsWith("Path = "));
  const entries: ArchiveManifestEntry[] = [];

  for (const block of blocks) {
    const fields = parseSevenZipBlock(block);
    const name = fields.Path?.trim();
    if (!name) continue;
    const normalizedName = name.replace(/\\/g, "/");
    if (
      normalizedSource &&
      (normalizedName === normalizedSource ||
        normalizedName.endsWith(`/${basename(normalizedSource)}`)) &&
      fields.Type
    ) {
      continue;
    }

    const attributes = fields.Attributes ?? "";
    const directory = /\bD\b/.test(attributes) || normalizedName.endsWith("/");
    const extension = archiveEntryExtension(normalizedName);
    const uncompressedSize = parseArchiveByteSize(fields.Size);
    const compressedSize = parseArchiveByteSize(fields["Packed Size"]);

    entries.push({
      name: normalizedName,
      directory,
      extension,
      kind: classifyArchiveEntry(normalizedName, directory),
      compressedSize,
      uncompressedSize,
      method: -1,
      methodLabel: fields.Method?.trim() || "external",
      localHeaderOffset: -1,
      encrypted: fields.Encrypted?.trim() === "+",
      unsafe: isUnsafeArchivePath(normalizedName),
      modifiedAt: formatArchiveModifiedAt(fields.Modified),
      depth: normalizedName.split("/").filter(Boolean).length - 1,
    });
  }

  return entries;
}

async function requireLocalArchiveMetadata(
  fileId: string,
): Promise<LocalFileMetadata> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new ArchiveManifestError(404, "file_not_found", "file not found", {
      fileId,
    });
  }
  const ext = metadata.ext.toLowerCase();
  if (!archiveManifestExtensions.has(ext)) {
    throw new ArchiveManifestError(
      415,
      "unsupported_archive_manifest_format",
      `Unsupported archive manifest format: ${metadata.ext || metadata.mimeType}`,
      { extension: metadata.ext, mimeType: metadata.mimeType },
    );
  }
  return metadata;
}

async function resolveArchiveLister(): Promise<string | null> {
  const candidates = [
    process.env.ARCHITOKEN_7Z_BIN,
    "/usr/bin/7z",
    "/usr/local/bin/7z",
    "7z",
    "7zz",
  ].filter((candidate): candidate is string => Boolean(candidate?.trim()));

  for (const candidate of candidates) {
    const resolved = await resolveExecutable(candidate);
    if (resolved) return resolved;
  }
  return null;
}

async function resolveExecutable(candidate: string): Promise<string | null> {
  if (candidate.includes("/")) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      return null;
    }
  }

  for (const directory of (process.env.PATH ?? "").split(":")) {
    if (!directory) continue;
    const executable = join(directory, candidate);
    try {
      await access(executable, constants.X_OK);
      return executable;
    } catch {
      // Try next PATH entry.
    }
  }
  return null;
}

async function runArchiveLister(
  command: string,
  sourcePath: string,
): Promise<ArchiveListResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, ["l", "-slt", sourcePath], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new ArchiveManifestError(
          504,
          "archive_lister_timeout",
          "归档索引器执行超时。",
          { command, timeoutMs: archiveListTimeoutMs },
        ),
      );
    }, archiveListTimeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(
        new ArchiveManifestError(
          503,
          "archive_lister_spawn_failed",
          `无法启动归档索引器: ${error.message}`,
          { command },
        ),
      );
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const result = {
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      };
      if (code === 0) {
        resolve(result);
        return;
      }
      reject(
        new ArchiveManifestError(
          502,
          "archive_lister_failed",
          `归档索引器退出码 ${code ?? "unknown"}`,
          {
            command,
            stdout: trimProcessOutput(result.stdout),
            stderr: trimProcessOutput(result.stderr),
          },
        ),
      );
    });
  });
}

function parseSevenZipBlock(block: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const separator = line.indexOf(" = ");
    if (separator < 0) continue;
    fields[line.slice(0, separator)] = line.slice(separator + 3);
  }
  return fields;
}

function parseArchiveByteSize(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatArchiveModifiedAt(value: string | undefined): string {
  if (!value?.trim()) return "-";
  return value.trim().slice(0, 19);
}

function archiveEntryExtension(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.endsWith(".tar.gz")) return ".tar.gz";
  if (normalized.endsWith(".tar.bz2")) return ".tar.bz2";
  if (normalized.endsWith(".tar.xz")) return ".tar.xz";
  return extensionOf(normalized);
}

function classifyArchiveEntry(
  name: string,
  directory: boolean,
): ArchiveEntryKind {
  if (directory) return "directory";
  const extension = archiveEntryExtension(name);
  if (
    [
      ".zip",
      ".zipx",
      ".7z",
      ".rar",
      ".tar",
      ".gz",
      ".bz2",
      ".xz",
      ".zst",
      ".tgz",
      ".tbz2",
      ".tar.gz",
      ".tar.bz2",
      ".tar.xz",
      ".ifczip",
      ".bcfzip",
      ".jar",
      ".war",
      ".ear",
      ".apk",
      ".ipa",
      ".asar",
    ].includes(extension)
  )
    return "archive";
  if (
    [
      ".ifc",
      ".ifczip",
      ".ids",
      ".bcf",
      ".bcfzip",
      ".idm",
      ".rvt",
      ".rfa",
    ].includes(extension)
  )
    return "bim";
  if (
    [
      ".dxf",
      ".dwg",
      ".step",
      ".stp",
      ".iges",
      ".igs",
      ".brep",
      ".stl",
      ".ply",
      ".3dm",
      ".skp",
      ".usd",
      ".usda",
      ".usdc",
      ".usdz",
      ".gltf",
      ".glb",
      ".b3dm",
      ".i3dm",
      ".pnts",
      ".cmpt",
      ".las",
      ".laz",
      ".e57",
    ].includes(extension)
  )
    return "cad";
  if (
    [
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".odt",
      ".ods",
      ".odp",
      ".rtf",
    ].includes(extension)
  )
    return "office";
  if ([".pdf", ".txt", ".md", ".html", ".htm"].includes(extension))
    return "document";
  if (
    [
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".gif",
      ".svg",
      ".heic",
      ".tif",
      ".tiff",
    ].includes(extension)
  )
    return "image";
  if (
    [
      ".mp4",
      ".mov",
      ".mkv",
      ".webm",
      ".avi",
      ".mxf",
      ".mp3",
      ".wav",
      ".flac",
      ".ogg",
    ].includes(extension)
  )
    return "media";
  if (
    [
      ".json",
      ".xml",
      ".csv",
      ".tsv",
      ".yaml",
      ".yml",
      ".sql",
      ".geojson",
      ".dat",
    ].includes(extension)
  )
    return "data";
  if (
    [
      ".js",
      ".ts",
      ".tsx",
      ".py",
      ".rs",
      ".go",
      ".java",
      ".cpp",
      ".c",
      ".h",
      ".cs",
    ].includes(extension)
  )
    return "code";
  return "file";
}

function isUnsafeArchivePath(name: string): boolean {
  return (
    name.startsWith("/") ||
    /^[a-zA-Z]:/.test(name) ||
    name.split("/").some((part) => part === "..")
  );
}

function sumArchiveEntryBytes(entries: ArchiveManifestEntry[]): number {
  return entries.reduce(
    (total, entry) => total + (entry.directory ? 0 : entry.uncompressedSize),
    0,
  );
}

function archiveManifestEtag(metadata: LocalFileMetadata): string {
  const digest = createHash("sha256")
    .update(`${metadata.fileId}:${metadata.checksum}:archive-manifest-v1`)
    .digest("hex")
    .slice(0, 24);
  return `"archive-${digest}"`;
}

function trimProcessOutput(buffer: Buffer): string {
  return buffer.toString("utf8").trim().slice(0, 2000);
}
