// lib/ifc-bom-extract-server.ts - Server-side IFC -> BOM extraction pipeline
// License: Apache-2.0
//
// 经 PANAEC_IFC_BOM_COMMAND（{source} {output.json} --csv-dir {dir} 约定，
// 即 06-workers/scripts/panaec-ifc-to-bom）对 IFC 模型做几何实测 BOM 提取，
// 结果按源文件 checksum 缓存。与 skp-bom-extract-server 不同，IFC 路径没有
// 名称扫描兜底——命令缺失即明确报错，不降级伪造。

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { LocalFileMetadata } from "./local-file-runtime";
import {
  appendLocalUploadRuntimeRecord,
  getLocalFileMetadata,
  getLocalUploadsDir,
  resolveLocalUploadStoragePath,
} from "./local-file-runtime-server";

const execFileAsync = promisify(execFile);

export class IfcBomExtractError extends Error {
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
    this.name = "IfcBomExtractError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type IfcBomExportFormat = "manifest" | "csv" | "elements-csv";

export interface IfcBomManifest {
  schema: "architoken.ifc_bom_manifest.v1";
  summary: {
    lineCount: number;
    elementCount: number;
    totalQuantity: number;
    weightedLineCount: number;
    totalWeightKg: number;
    geometryFailures: number;
    byClass: Record<string, number>;
  };
  lines: unknown[];
  notes: string[];
  [key: string]: unknown;
}

export interface IfcBomExtractResult {
  manifest: IfcBomManifest;
  summaryCsv: Buffer;
  elementsCsv: Buffer;
  etag: string;
  cacheHit: boolean;
}

const bomExtractRoute = "/api/local-files/{fileId}/bom-export";
const bomExtractAdapter = "ifc_geometry_pca_scan";

function ifcBomCommand(): string | null {
  return process.env.PANAEC_IFC_BOM_COMMAND?.trim() || null;
}

function ifcBomTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.PANAEC_IFC_BOM_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 600_000;
}

function ifcBomCacheDir(metadata: LocalFileMetadata): string {
  return join(
    getLocalUploadsDir(),
    "derivatives",
    "ifc",
    "v1-bom-scan",
    metadata.checksum.slice(0, 16),
  );
}

async function readCachedArtifacts(
  cacheDir: string,
): Promise<{ manifest: IfcBomManifest; summaryCsv: Buffer; elementsCsv: Buffer } | null> {
  try {
    const [manifestRaw, summaryCsv, elementsCsv] = await Promise.all([
      readFile(join(cacheDir, "manifest.json"), "utf8"),
      readFile(join(cacheDir, "bom_summary.csv")),
      readFile(join(cacheDir, "bom_elements.csv")),
    ]);
    return { manifest: JSON.parse(manifestRaw) as IfcBomManifest, summaryCsv, elementsCsv };
  } catch {
    return null;
  }
}

export async function extractIfcBomForFile(
  fileId: string,
  options: { actor?: string } = {},
): Promise<IfcBomExtractResult> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new IfcBomExtractError(404, "file_not_found", "file not found", { fileId });
  }
  if (metadata.ext.toLowerCase() !== ".ifc") {
    throw new IfcBomExtractError(
      415,
      "unsupported_source_format",
      `IFC BOM 提取仅支持 .ifc 源文件，当前为 ${metadata.ext || "未知格式"}`,
      { fileId, ext: metadata.ext },
    );
  }
  const command = ifcBomCommand();
  if (!command) {
    throw new IfcBomExtractError(
      503,
      "ifc_bom_adapter_unavailable",
      "PANAEC_IFC_BOM_COMMAND 未配置；IFC BOM 提取需要 ifcopenshell 几何实测适配器，不做降级伪造",
      { fileId },
    );
  }

  const cacheDir = ifcBomCacheDir(metadata);
  const cached = await readCachedArtifacts(cacheDir);
  if (cached) {
    return {
      ...cached,
      etag: bomEtag(metadata, cached.manifest),
      cacheHit: true,
    };
  }

  try {
    await mkdir(cacheDir, { recursive: true });
    const sourcePath = resolveLocalUploadStoragePath(metadata);
    await execFileAsync(
      command,
      [sourcePath, join(cacheDir, "manifest.json"), "--csv-dir", cacheDir, "--name", metadata.originalName],
      { timeout: ifcBomTimeoutMs(), maxBuffer: 256 * 1024 * 1024 },
    );
    const artifacts = await readCachedArtifacts(cacheDir);
    if (!artifacts) {
      throw new IfcBomExtractError(
        500,
        "ifc_bom_artifacts_missing",
        "适配器执行成功但未产出 manifest/CSV 工件",
        { fileId, cacheDir },
      );
    }
    await recordRuntime(metadata, artifacts.manifest, artifacts.summaryCsv, options.actor);
    return {
      ...artifacts,
      etag: bomEtag(metadata, artifacts.manifest),
      cacheHit: false,
    };
  } catch (error) {
    const wrapped =
      error instanceof IfcBomExtractError
        ? error
        : new IfcBomExtractError(
            500,
            "ifc_bom_extract_failed",
            error instanceof Error ? error.message : String(error),
            { fileId },
          );
    await recordFailure(metadata, wrapped, options.actor);
    throw wrapped;
  }
}

function bomEtag(metadata: LocalFileMetadata, manifest: IfcBomManifest): string {
  return `"ifc-bom-${metadata.checksum.slice(0, 16)}-${manifest.summary.lineCount}-${manifest.summary.elementCount}"`;
}

async function recordRuntime(
  metadata: LocalFileMetadata,
  manifest: IfcBomManifest,
  summaryCsv: Buffer,
  actor?: string,
): Promise<void> {
  await appendLocalUploadRuntimeRecord(metadata.fileId, {
    ...(actor ? { actor } : {}),
    route: bomExtractRoute,
    status: manifest.summary.elementCount > 0 ? "completed" : "failed",
    adapter: bomExtractAdapter,
    artifact: {
      name: `${metadata.originalName.replace(/\.[^.]+$/, "")}_BOM清单.csv`,
      role: "bom-export",
      mediaType: "text/csv; charset=utf-8",
      size: summaryCsv.byteLength,
      checksum: createHash("sha256").update(summaryCsv).digest("hex"),
      metadata: {
        lineCount: manifest.summary.lineCount,
        elementCount: manifest.summary.elementCount,
        totalWeightKg: manifest.summary.totalWeightKg,
        weightedLineCount: manifest.summary.weightedLineCount,
      },
    },
    notes: manifest.notes,
  });
}

async function recordFailure(
  metadata: LocalFileMetadata,
  error: IfcBomExtractError,
  actor?: string,
): Promise<void> {
  try {
    await appendLocalUploadRuntimeRecord(metadata.fileId, {
      ...(actor ? { actor } : {}),
      route: bomExtractRoute,
      status: "failed",
      adapter: bomExtractAdapter,
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
