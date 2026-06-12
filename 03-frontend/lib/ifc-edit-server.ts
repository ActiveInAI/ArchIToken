// lib/ifc-edit-server.ts - Real IFC element attribute/pset write-back
// License: Apache-2.0
//
// 经 PANAEC_IFC_EDIT_COMMAND(即 06-workers/scripts/panaec-ifc-edit,
// ifcopenshell 原子编辑)修改 IFC 构件属性,产物走系统既有写回约定
// updateLocalUploadBytes:同 fileId、版本号递增、local-edit/ifc-edited 标签、
// 写回运行时审计记录。源 checksum 变化自动使派生/校验/BOM 缓存失效。

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { LocalFileMetadata } from "./local-file-runtime";
import {
  getLocalFileMetadata,
  resolveLocalUploadStoragePath,
  updateLocalUploadBytes,
} from "./local-file-runtime-server";
import { singleFlight } from "./single-flight-server";

const execFileAsync = promisify(execFile);

export class IfcEditError extends Error {
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
    this.name = "IfcEditError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface IfcEditOperation {
  globalId: string;
  attributes?: Record<string, string | null>;
  propertySet?: {
    name: string;
    properties: Record<string, string | number | boolean | null>;
  };
}

export interface IfcEditReport {
  schema: "architoken.ifc_edit_report.v1";
  editorRef: string;
  status: "applied" | "failed";
  error: string | null;
  operationCount: number;
  applied: Array<{ globalId: string; ifcClass: string; changes: string[] }>;
  [key: string]: unknown;
}

export interface IfcEditResult {
  file: LocalFileMetadata;
  report: IfcEditReport;
}

const ALLOWED_ATTRIBUTES = new Set([
  "Name",
  "Description",
  "Tag",
  "ObjectType",
  "LongName",
]);
const MAX_OPERATIONS = 200;
const IFC_GUID_PATTERN = /^[0-9A-Za-z_$]{22}$/;

function ifcEditCommand(): string | null {
  return process.env.PANAEC_IFC_EDIT_COMMAND?.trim() || null;
}

function ifcEditTimeoutMs(): number {
  const parsed = Number.parseInt(
    process.env.PANAEC_IFC_EDIT_TIMEOUT_MS ?? "",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1_800_000;
}

function assertValidOperations(operations: IfcEditOperation[]): void {
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new IfcEditError(
      400,
      "ifc_edit_empty_operations",
      "operations 必须是非空数组。",
    );
  }
  if (operations.length > MAX_OPERATIONS) {
    throw new IfcEditError(
      400,
      "ifc_edit_too_many_operations",
      `单次最多 ${MAX_OPERATIONS} 个操作。`,
      { count: operations.length },
    );
  }
  for (const op of operations) {
    if (!op || typeof op !== "object" || !IFC_GUID_PATTERN.test(op.globalId ?? "")) {
      throw new IfcEditError(
        400,
        "ifc_edit_invalid_global_id",
        "每个操作必须携带合法的 22 位 IFC GlobalId。",
        { globalId: op?.globalId },
      );
    }
    const hasAttributes =
      op.attributes &&
      typeof op.attributes === "object" &&
      Object.keys(op.attributes).length > 0;
    const hasPset =
      op.propertySet &&
      typeof op.propertySet === "object" &&
      typeof op.propertySet.name === "string" &&
      op.propertySet.name.trim() &&
      op.propertySet.properties &&
      Object.keys(op.propertySet.properties).length > 0;
    if (!hasAttributes && !hasPset) {
      throw new IfcEditError(
        400,
        "ifc_edit_empty_operation",
        `操作 ${op.globalId} 既无 attributes 也无 propertySet。`,
      );
    }
    for (const [name, value] of Object.entries(op.attributes ?? {})) {
      if (!ALLOWED_ATTRIBUTES.has(name)) {
        throw new IfcEditError(
          400,
          "ifc_edit_attribute_not_allowed",
          `属性 ${name} 不在可编辑白名单(${[...ALLOWED_ATTRIBUTES].join("/")})。`,
        );
      }
      if (value !== null && typeof value !== "string") {
        throw new IfcEditError(
          400,
          "ifc_edit_attribute_type",
          `属性 ${name} 只接受字符串或 null。`,
        );
      }
      if (typeof value === "string" && value.length > 500) {
        throw new IfcEditError(
          400,
          "ifc_edit_attribute_too_long",
          `属性 ${name} 超过 500 字符。`,
        );
      }
    }
  }
}

export async function applyIfcEdits(
  fileId: string,
  operations: IfcEditOperation[],
  actor?: string,
): Promise<IfcEditResult> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new IfcEditError(404, "file_not_found", "file not found", { fileId });
  }
  if (metadata.ext.toLowerCase() !== ".ifc") {
    throw new IfcEditError(
      415,
      "ifc_edit_unsupported_format",
      "IFC 编辑回写只支持 .ifc 源文件。",
      { ext: metadata.ext },
    );
  }
  assertValidOperations(operations);

  const command = ifcEditCommand();
  if (!command) {
    throw new IfcEditError(
      503,
      "ifc_editor_not_configured",
      "未配置 IFC 编辑器:需要 PANAEC_IFC_EDIT_COMMAND 指向真实 ifcopenshell 编辑命令。",
      { requiredEnv: ["PANAEC_IFC_EDIT_COMMAND"] },
    );
  }

  // 同一文件的编辑串行化,避免并发写回互相覆盖。
  return singleFlight(`ifc-edit:${metadata.fileId}`, async () => {
    const workDir = await mkdtemp(join(tmpdir(), "architoken-ifc-edit-"));
    try {
      const opsPath = join(workDir, "ops.json");
      const outPath = join(workDir, "edited.ifc");
      const reportPath = join(workDir, "report.json");
      await writeFile(opsPath, JSON.stringify({ operations }), "utf8");
      const sourcePath = resolveLocalUploadStoragePath(metadata);

      try {
        await execFileAsync(
          command,
          [sourcePath, outPath, "--ops", opsPath, "--report", reportPath],
          { timeout: ifcEditTimeoutMs(), maxBuffer: 64 * 1024 * 1024 },
        );
      } catch (error) {
        const report = await readReport(reportPath);
        throw new IfcEditError(
          422,
          "ifc_edit_rejected",
          report?.error
            ? `IFC 编辑被拒绝(原子,未部分生效): ${report.error}`
            : `IFC 编辑命令执行失败: ${error instanceof Error ? error.message : String(error)}`,
          { command },
        );
      }

      const report = await readReport(reportPath);
      if (!report || report.status !== "applied") {
        throw new IfcEditError(
          502,
          "ifc_edit_invalid_report",
          "IFC 编辑命令未产出 applied 状态的报告。",
          { command },
        );
      }
      const bytes = await readFile(outPath);
      const head = bytes.subarray(0, 14).toString("ascii");
      if (!head.startsWith("ISO-10303-21")) {
        throw new IfcEditError(
          502,
          "ifc_edit_invalid_output",
          "IFC 编辑产物不是合法的 ISO-10303-21 文件。",
        );
      }

      const updated = await updateLocalUploadBytes(metadata.fileId, bytes, {
        tags: ["ifc-edited"],
        runtime: {
          ...(actor ? { actor } : {}),
          route: `/api/local-files/${metadata.fileId}/ifc-edit`,
          status: "completed",
          adapter: "ifcopenshell_atomic_edit",
          engine: report.editorRef,
          notes: report.applied.map(
            (entry) =>
              `${entry.ifcClass} ${entry.globalId}: ${entry.changes.join("; ")}`,
          ),
        },
      });
      if (!updated) {
        throw new IfcEditError(
          500,
          "ifc_edit_write_back_failed",
          "编辑产物写回本地上传索引失败。",
        );
      }
      return { file: updated, report };
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });
}

async function readReport(reportPath: string): Promise<IfcEditReport | null> {
  try {
    const raw = await readFile(reportPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { schema?: unknown }).schema ===
        "architoken.ifc_edit_report.v1"
    ) {
      return parsed as IfcEditReport;
    }
    return null;
  } catch {
    return null;
  }
}
