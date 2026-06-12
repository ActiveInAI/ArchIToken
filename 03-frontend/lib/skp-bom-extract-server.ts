// lib/skp-bom-extract-server.ts - Server-side SKP -> BOM extraction pipeline
// License: Apache-2.0

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { inflateRawSync } from "node:zlib";

import type { LocalFileMetadata } from "./local-file-runtime";
import {
  appendLocalUploadRuntimeRecord,
  getLocalFileMetadata,
  getLocalUploadsDir,
  resolveLocalUploadStoragePath,
} from "./local-file-runtime-server";
import {
  buildSkpBomManifest,
  collectSkpComponentNames,
  renderSkpBomCsv,
  scanUtf8Strings,
  type SkpBomExtractManifest,
  type SkpComponentObservation,
} from "./skp-bom-extract";

const execFileAsync = promisify(execFile);

export class SkpBomExtractError extends Error {
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
    this.name = "SkpBomExtractError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const bomExtractRoute = "/api/local-files/{fileId}/bom-export";

const zipEocdSignature = 0x06054b50;
const zipCentralSignature = 0x02014b50;
const zipLocalSignature = 0x04034b50;

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

/**
 * SketchUp 2021+ 的 .skp 是带自定义前置头的 ZIP 容器（中央目录偏移
 * 需按实际 EOCD 位置修正）；几何与构件定义在 model.dat 条目内。
 * 旧版（纯二进制流）直接返回整个文件用于名称扫描。
 */
export function readSkpModelStream(bytes: Buffer): {
  modelBytes: Buffer;
  container: "zip" | "legacy";
} {
  const eocdPosition = findEndOfCentralDirectory(bytes);
  if (eocdPosition < 0) {
    return { modelBytes: bytes, container: "legacy" };
  }

  const entryCount = bytes.readUInt16LE(eocdPosition + 10);
  const centralSize = bytes.readUInt32LE(eocdPosition + 12);
  const centralOffset = bytes.readUInt32LE(eocdPosition + 16);
  // SKP 在 ZIP 数据前有自定义文件头，记录的偏移量需要整体平移。
  const offsetDelta = eocdPosition - centralSize - centralOffset;

  const entries = readCentralDirectory(
    bytes,
    centralOffset + offsetDelta,
    entryCount,
  );
  const modelEntry =
    entries.find((entry) => entry.name === "model.dat") ??
    entries.find((entry) => entry.name.endsWith("/model.dat")) ??
    null;
  if (!modelEntry) {
    throw new SkpBomExtractError(
      422,
      "skp_model_stream_not_found",
      "SKP 容器内未找到 model.dat 模型流",
      { entries: entries.slice(0, 20).map((entry) => entry.name) },
    );
  }

  return {
    modelBytes: extractZipEntry(bytes, modelEntry, offsetDelta),
    container: "zip",
  };
}

function findEndOfCentralDirectory(bytes: Buffer): number {
  const minEocdSize = 22;
  const maxCommentLength = 65535;
  const scanFloor = Math.max(0, bytes.length - minEocdSize - maxCommentLength);
  for (let pos = bytes.length - minEocdSize; pos >= scanFloor; pos -= 1) {
    if (bytes.readUInt32LE(pos) === zipEocdSignature) {
      return pos;
    }
  }
  return -1;
}

function readCentralDirectory(
  bytes: Buffer,
  start: number,
  entryCount: number,
): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let pos = start;
  for (let i = 0; i < entryCount; i += 1) {
    if (pos + 46 > bytes.length || bytes.readUInt32LE(pos) !== zipCentralSignature) {
      break;
    }
    const nameLength = bytes.readUInt16LE(pos + 28);
    const extraLength = bytes.readUInt16LE(pos + 30);
    const commentLength = bytes.readUInt16LE(pos + 32);
    entries.push({
      name: bytes.toString("utf8", pos + 46, pos + 46 + nameLength),
      compressionMethod: bytes.readUInt16LE(pos + 10),
      compressedSize: bytes.readUInt32LE(pos + 20),
      uncompressedSize: bytes.readUInt32LE(pos + 24),
      localHeaderOffset: bytes.readUInt32LE(pos + 42),
    });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function extractZipEntry(
  bytes: Buffer,
  entry: ZipEntry,
  offsetDelta: number,
): Buffer {
  const headerPos = entry.localHeaderOffset + offsetDelta;
  if (
    headerPos + 30 > bytes.length ||
    bytes.readUInt32LE(headerPos) !== zipLocalSignature
  ) {
    throw new SkpBomExtractError(
      422,
      "skp_zip_local_header_invalid",
      "SKP 容器条目本地头无效",
      { entry: entry.name },
    );
  }
  const nameLength = bytes.readUInt16LE(headerPos + 26);
  const extraLength = bytes.readUInt16LE(headerPos + 28);
  const dataStart = headerPos + 30 + nameLength + extraLength;
  const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return Buffer.from(compressed);
  }
  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressed);
  }
  throw new SkpBomExtractError(
    422,
    "skp_zip_compression_unsupported",
    `SKP 容器条目压缩方式不支持: ${entry.compressionMethod}`,
    { entry: entry.name },
  );
}

export interface SkpBomExtractResult {
  manifest: SkpBomExtractManifest;
  csv: string;
  etag: string;
  container: "zip" | "legacy";
}

interface SkpSdkBomScan {
  schema: string;
  modelVersion?: string;
  definitions: Array<{ name: string; instances: number }>;
}

const library2dSymbolPattern = /^\$(?:DorLib2D|DORLIB2D|WinLib2D|WINLIB2D)\$/;

function sdkBomCommand(): string | null {
  return process.env.PANAEC_SKP_BOM_COMMAND?.trim() || null;
}

function sdkBomTimeoutMs(): number {
  const parsed = Number.parseInt(
    process.env.PANAEC_SKP_BOM_TIMEOUT_MS ?? "",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 600_000;
}

function sdkBomCacheDir(metadata: LocalFileMetadata): string {
  return join(
    getLocalUploadsDir(),
    "derivatives",
    "skp",
    "v1-bom-scan",
    metadata.checksum.slice(0, 16),
  );
}

/**
 * 官方 SketchUp SDK 实例计数：经 PANAEC_SKP_BOM_COMMAND（{source} {output}
 * 约定）取得每个组件定义的真实放置数，结果按源文件 checksum 缓存。
 * 命令未配置或失败时返回 null，由调用方回退到名称扫描。
 */
async function runSdkBomScan(
  metadata: LocalFileMetadata,
  sourcePath: string,
): Promise<SkpSdkBomScan | null> {
  const command = sdkBomCommand();
  if (!command) return null;

  const cachePath = join(sdkBomCacheDir(metadata), "bom_scan.json");
  try {
    return JSON.parse(await readFile(cachePath, "utf8")) as SkpSdkBomScan;
  } catch {
    // cache miss
  }

  try {
    const scratchPath = join(
      tmpdir(),
      `skp-bom-${metadata.checksum.slice(0, 16)}-${process.pid}.json`,
    );
    await execFileAsync(command, [sourcePath, scratchPath], {
      timeout: sdkBomTimeoutMs(),
      maxBuffer: 16 * 1024 * 1024,
    });
    const raw = await readFile(scratchPath, "utf8");
    const scan = JSON.parse(raw) as SkpSdkBomScan;
    if (!Array.isArray(scan.definitions)) return null;
    await mkdir(sdkBomCacheDir(metadata), { recursive: true });
    await writeFile(`${cachePath}.tmp`, raw, "utf8");
    await rename(`${cachePath}.tmp`, cachePath);
    return scan;
  } catch (error) {
    console.warn(
      `[skp-bom-extract] SDK instance scan failed for ${metadata.fileId}, falling back to name scan:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function extractSkpBomForFile(
  fileId: string,
  options: { actor?: string } = {},
): Promise<SkpBomExtractResult> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new SkpBomExtractError(404, "file_not_found", "file not found", {
      fileId,
    });
  }
  if (metadata.ext.toLowerCase() !== ".skp") {
    throw new SkpBomExtractError(
      415,
      "unsupported_source_format",
      `BOM 提取当前仅支持 .skp 源文件，当前为 ${metadata.ext || "未知格式"}`,
      { fileId, ext: metadata.ext },
    );
  }

  try {
    const sourcePath = resolveLocalUploadStoragePath(metadata);
    const sdkScan = await runSdkBomScan(metadata, sourcePath);

    let components: SkpComponentObservation[];
    let skipped2dSymbols: string[];
    let quantityBasis: "sdk_instance_count" | "definition_copies";
    let container: "zip" | "legacy";

    if (sdkScan) {
      components = sdkScan.definitions
        .filter((def) => !library2dSymbolPattern.test(def.name.trim()))
        .map((def) => ({ name: def.name, instances: def.instances }));
      skipped2dSymbols = sdkScan.definitions
        .map((def) => def.name.trim())
        .filter((name) => library2dSymbolPattern.test(name));
      quantityBasis = "sdk_instance_count";
      container = "zip";
    } else {
      const bytes = await readFile(sourcePath);
      const stream = readSkpModelStream(bytes);
      container = stream.container;
      const scanned = scanUtf8Strings(stream.modelBytes);
      const collection = collectSkpComponentNames(scanned);
      components = collection.componentNames.map((name) => ({ name }));
      skipped2dSymbols = collection.skipped2dSymbols;
      quantityBasis = "definition_copies";
    }

    const manifest = buildSkpBomManifest({
      components,
      quantityBasis,
      skipped2dSymbols,
      source: {
        fileId: metadata.fileId,
        originalName: metadata.originalName,
        checksum: metadata.checksum,
        size: metadata.size,
        version: metadata.version,
      },
    });
    const csv = renderSkpBomCsv(manifest);
    const etag = `"skp-bom-${metadata.checksum.slice(0, 16)}-${manifest.adapter}-${manifest.summary.lineCount}"`;

    await recordBomExtractRuntime(metadata, manifest, csv, options.actor);

    return { manifest, csv, etag, container };
  } catch (error) {
    if (error instanceof SkpBomExtractError) {
      await recordBomExtractFailure(metadata, error, options.actor);
      throw error;
    }
    const wrapped = new SkpBomExtractError(
      500,
      "skp_bom_extract_failed",
      error instanceof Error ? error.message : String(error),
      { fileId },
    );
    await recordBomExtractFailure(metadata, wrapped, options.actor);
    throw wrapped;
  }
}

async function recordBomExtractRuntime(
  metadata: LocalFileMetadata,
  manifest: SkpBomExtractManifest,
  csv: string,
  actor?: string,
): Promise<void> {
  const csvBytes = Buffer.from(csv, "utf8");
  await appendLocalUploadRuntimeRecord(metadata.fileId, {
    ...(actor ? { actor } : {}),
    route: bomExtractRoute,
    status: manifest.summary.lineCount > 0 ? "completed" : "failed",
    adapter: manifest.adapter,
    artifact: {
      name: `${metadata.originalName.replace(/\.[^.]+$/, "")}_BOM清单.csv`,
      role: "bom-export",
      mediaType: "text/csv; charset=utf-8",
      size: csvBytes.byteLength,
      checksum: createHash("sha256").update(csvBytes).digest("hex"),
      metadata: {
        lineCount: manifest.summary.lineCount,
        namedLineCount: manifest.summary.namedLineCount,
        totalQuantity: manifest.summary.totalQuantity,
        totalWeightKg: manifest.summary.totalWeightKg,
      },
    },
    notes: manifest.notes,
  });
}

async function recordBomExtractFailure(
  metadata: LocalFileMetadata,
  error: SkpBomExtractError,
  actor?: string,
): Promise<void> {
  try {
    await appendLocalUploadRuntimeRecord(metadata.fileId, {
      ...(actor ? { actor } : {}),
      route: bomExtractRoute,
      status: "failed",
      adapter: "skp_bom_extract",
      failureEvidence: {
        code: error.code,
        message: error.message,
        status: error.status,
        route: bomExtractRoute,
      },
    });
  } catch {
    // 运行时记录失败不应吞掉原始提取错误。
  }
}
