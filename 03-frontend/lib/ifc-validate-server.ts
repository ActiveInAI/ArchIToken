// lib/ifc-validate-server.ts - Server-side real IFC validation pipeline
// License: Apache-2.0
//
// 经 PANAEC_IFC_VALIDATE_COMMAND（{source} {output.json} 约定，即
// 06-workers/scripts/panaec-ifc-validate）执行本地 ifcopenshell
// schema/EXPRESS 规则校验，报告按源文件 checksum 缓存。命令缺失即明确
// 报告 validator_not_configured，不伪造通过/失败结论。

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { LocalFileMetadata } from "./local-file-runtime";
import {
  getLocalFileMetadata,
  getLocalUploadsDir,
  readLocalFileIndex,
  resolveLocalUploadStoragePath,
} from "./local-file-runtime-server";
import { singleFlight } from "./single-flight-server";

const execFileAsync = promisify(execFile);

export class IfcValidateError extends Error {
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
    this.name = "IfcValidateError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface IfcValidationReport {
  schema: "architoken.ifc_validation_report.v1";
  validatorRef: string;
  ifcSchema: string | null;
  status: "passed" | "failed";
  errorCount: number;
  fatalError: string | null;
  errors: Array<Record<string, string>>;
  truncated: boolean;
  durationSeconds: number;
  scope: string;
  notes: string[];
  idsResults?: Array<Record<string, unknown>>;
  appliedIdsFiles?: string[];
  [key: string]: unknown;
}

export interface IfcValidateResult {
  report: IfcValidationReport;
  cacheHit: boolean;
}

const validationRuntimeVersion = "v1-schema-express";

function ifcValidateCommand(): string | null {
  return process.env.PANAEC_IFC_VALIDATE_COMMAND?.trim() || null;
}

function ifcValidateTimeoutMs(): number {
  const parsed = Number.parseInt(
    process.env.PANAEC_IFC_VALIDATE_TIMEOUT_MS ?? "",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1_800_000;
}

interface ModuleIdsFile {
  path: string;
  originalName: string;
  checksum: string;
}

/**
 * 参与校验的 IDS 1.0 规则文件(.ids):标准族库(standard_library)中的
 * IDS 视为全局标准,适用于所有模块的 IFC;另叠加源文件所在模块自己的 IDS。
 */
async function discoverModuleIdsFiles(
  metadata: LocalFileMetadata,
): Promise<ModuleIdsFile[]> {
  const index = await readLocalFileIndex().catch(() => ({ files: [] }));
  const results: ModuleIdsFile[] = [];
  for (const file of index.files) {
    if (file.ext.toLowerCase() !== ".ids") continue;
    if (
      file.moduleId !== metadata.moduleId &&
      file.moduleId !== "standard_library"
    )
      continue;
    try {
      results.push({
        path: resolveLocalUploadStoragePath(file),
        originalName: file.originalName,
        checksum: file.checksum,
      });
    } catch {
      continue;
    }
  }
  return results.sort((a, b) => a.checksum.localeCompare(b.checksum));
}

function idsSetFingerprint(idsFiles: ModuleIdsFile[]): string {
  if (!idsFiles.length) return "none";
  return createHash("sha256")
    .update(idsFiles.map((file) => file.checksum).join("|"))
    .digest("hex")
    .slice(0, 12);
}

function validationCacheDir(metadata: LocalFileMetadata): string {
  return join(
    getLocalUploadsDir(),
    "derivatives",
    "ifc",
    "validation",
    validationRuntimeVersion,
    metadata.checksum.slice(0, 16),
  );
}

function validationReportPath(
  metadata: LocalFileMetadata,
  idsKey: string,
): string {
  return join(validationCacheDir(metadata), `report-${idsKey}.json`);
}

async function readCachedReport(
  metadata: LocalFileMetadata,
  idsKey: string,
): Promise<IfcValidationReport | null> {
  try {
    const raw = await readFile(validationReportPath(metadata, idsKey), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { schema?: unknown }).schema ===
        "architoken.ifc_validation_report.v1"
    ) {
      return parsed as IfcValidationReport;
    }
    return null;
  } catch {
    return null;
  }
}

export async function validateIfcFile(
  fileId: string,
  {
    refresh = false,
    cachedOnly = false,
  }: { refresh?: boolean; cachedOnly?: boolean } = {},
): Promise<IfcValidateResult> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new IfcValidateError(404, "file_not_found", "file not found", {
      fileId,
    });
  }
  if (metadata.ext.toLowerCase() !== ".ifc") {
    throw new IfcValidateError(
      415,
      "ifc_validate_unsupported_format",
      "当前校验器只支持 IFC 源文件(schema/EXPRESS 规则)。",
      { ext: metadata.ext },
    );
  }

  const idsFiles = await discoverModuleIdsFiles(metadata);
  const idsKey = idsSetFingerprint(idsFiles);

  if (!refresh) {
    const cached = await readCachedReport(metadata, idsKey);
    if (cached) return { report: cached, cacheHit: true };
  }
  if (cachedOnly) {
    throw new IfcValidateError(
      404,
      "ifc_validation_not_cached",
      "该文件尚无校验报告(mode=cached 不触发新校验)。",
      { fileId },
    );
  }

  const command = ifcValidateCommand();
  if (!command) {
    throw new IfcValidateError(
      503,
      "ifc_validator_not_configured",
      "未配置校验器:需要 PANAEC_IFC_VALIDATE_COMMAND 指向真实 IFC 校验命令(本地 ifcopenshell schema/EXPRESS 校验)。",
      { requiredEnv: ["PANAEC_IFC_VALIDATE_COMMAND"] },
    );
  }

  return singleFlight(
    `ifc-validate:${metadata.checksum}:${idsKey}`,
    async () => {
      const again = await readCachedReport(metadata, idsKey);
      if (again && !refresh) return { report: again, cacheHit: true };

      const cacheDir = validationCacheDir(metadata);
      await mkdir(cacheDir, { recursive: true });
      const sourcePath = resolveLocalUploadStoragePath(metadata);
      const reportPath = validationReportPath(metadata, idsKey);
      const args = [sourcePath, reportPath];
      for (const idsFile of idsFiles) {
        args.push("--ids", idsFile.path);
      }
      try {
        await execFileAsync(command, args, {
          timeout: ifcValidateTimeoutMs(),
          maxBuffer: 64 * 1024 * 1024,
        });
      } catch (error) {
        throw new IfcValidateError(
          502,
          "ifc_validator_failed",
          `IFC 校验命令执行失败: ${error instanceof Error ? error.message : String(error)}`,
          { command },
        );
      }
      const report = await readCachedReport(metadata, idsKey);
      if (!report) {
        throw new IfcValidateError(
          502,
          "ifc_validator_invalid_report",
          "IFC 校验命令未产出合法的 architoken.ifc_validation_report.v1 报告。",
          { command },
        );
      }
      report.appliedIdsFiles = idsFiles.map((file) => file.originalName);
      return { report, cacheHit: false };
    },
  );
}
