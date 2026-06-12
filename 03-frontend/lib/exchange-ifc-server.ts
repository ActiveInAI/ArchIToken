// lib/exchange-ifc-server.ts - 交换格式 → IFC4 几何派生
// License: Apache-2.0
//
// 把 3D 交换/网格格式转换为真实几何 IFC4(FreeCAD/OCCT / LibreDWG / ezdxf),
// 按构件名做 SJG 157 分类升级真实 IFC 类型。命令缺失或源无三维几何时明确报错,
// 绝不把 2D 图纸或无几何源(PDF)伪造成三维 IFC。结果按源 checksum 缓存。
//
//   .step/.stp/.iges/.igs/.stl → panaec-cad-to-ifc(OCCT 实体/网格三角化)
//   .dwg                       → panaec-dwg-to-ifc(LibreDWG 3DFACE,PKPM 图层语义)
//   .dxf                       → panaec-dxf-to-ifc(3DFACE;纯 2D 诚实报错)
//   .pdf / .ifc / 其他         → 不支持(PDF 无三维模型几何)

import { execFile } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { LocalFileMetadata } from "./local-file-runtime";
import {
  getLocalFileMetadata,
  getLocalUploadsDir,
  resolveLocalUploadStoragePath,
} from "./local-file-runtime-server";
import { singleFlight } from "./single-flight-server";

const execFileAsync = promisify(execFile);
const workerScriptsDir = "/home/insome/dev/insomeos/06-workers/scripts";

export class ExchangeIfcError extends Error {
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
    this.name = "ExchangeIfcError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ExchangeIfcChain {
  kind: string;
  chain: string;
  commandEnv: string;
  defaultScript: string;
}

const CHAINS: Record<string, ExchangeIfcChain> = {
  ".step": cadChain(),
  ".stp": cadChain(),
  ".iges": cadChain(),
  ".igs": cadChain(),
  ".stl": cadChain(),
  ".dwg": {
    kind: "dwg-ifc",
    chain: "DWG→IFC(LibreDWG 3DFACE + PKPM 图层语义)",
    commandEnv: "PANAEC_DWG_TO_IFC_COMMAND",
    defaultScript: join(workerScriptsDir, "panaec-dwg-to-ifc"),
  },
  ".dxf": {
    kind: "dxf-ifc",
    chain: "DXF→IFC(3DFACE 三角化;纯 2D 不可转)",
    commandEnv: "PANAEC_DXF_TO_IFC_COMMAND",
    defaultScript: join(workerScriptsDir, "panaec-dxf-to-ifc"),
  },
};

function cadChain(): ExchangeIfcChain {
  return {
    kind: "cad-ifc",
    chain: "STEP/IGES/STL→IFC(FreeCAD/OCCT 实体三角化)",
    commandEnv: "PANAEC_CAD_TO_IFC_COMMAND",
    defaultScript: join(workerScriptsDir, "panaec-cad-to-ifc"),
  };
}

// 明确"无三维模型几何,不可转 IFC"的格式(诚实拒绝而非伪造)
const NO_MODEL_GEOMETRY = new Set([".pdf", ".ofd"]);

export function exchangeIfcSupportedExt(ext: string): boolean {
  return ext.toLowerCase() in CHAINS;
}

export function exchangeIfcExplicitlyUnsupported(ext: string): boolean {
  return NO_MODEL_GEOMETRY.has(ext.toLowerCase());
}

export interface ExchangeIfcResult {
  path: string;
  size: number;
  cacheHit: boolean;
  chain: string;
}

function ifcTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.PANAEC_EXCHANGE_IFC_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3_600_000;
}

function cacheDir(metadata: LocalFileMetadata, kind: string): string {
  return join(
    getLocalUploadsDir(),
    "derivatives",
    "exchange-ifc",
    kind,
    metadata.checksum.slice(0, 16),
  );
}

function resolveCommand(config: ExchangeIfcChain): string {
  const fromEnv = process.env[config.commandEnv]?.trim();
  if (fromEnv) return fromEnv;
  try {
    accessSync(config.defaultScript, constants.X_OK);
    return config.defaultScript;
  } catch {
    throw new ExchangeIfcError(
      503,
      "exchange_ifc_adapter_unavailable",
      `${config.chain} 命令不可用:请配置 ${config.commandEnv} 或部署 ${config.defaultScript}。`,
      { requiredEnv: [config.commandEnv] },
    );
  }
}

export async function deriveExchangeIfc(
  fileId: string,
): Promise<ExchangeIfcResult> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new ExchangeIfcError(404, "file_not_found", "file not found", { fileId });
  }
  const ext = metadata.ext.toLowerCase();
  if (NO_MODEL_GEOMETRY.has(ext)) {
    throw new ExchangeIfcError(
      415,
      "exchange_ifc_no_model_geometry",
      `${ext || "该格式"} 不含三维模型几何,无法转 IFC;如为图纸请查看或导出图纸 BOM。`,
      { ext },
    );
  }
  if (ext === ".ifc") {
    throw new ExchangeIfcError(
      400,
      "exchange_ifc_already_ifc",
      "源文件已是 IFC,无需转换。",
      { ext },
    );
  }
  const config = CHAINS[ext];
  if (!config) {
    throw new ExchangeIfcError(
      415,
      "exchange_ifc_unsupported_format",
      `暂不支持 ${ext || "未知格式"} 转 IFC。`,
      { ext },
    );
  }

  const dir = cacheDir(metadata, config.kind);
  const outPath = join(dir, "model.ifc");
  const cached = await readCached(outPath);
  if (cached) return { ...cached, cacheHit: true, chain: config.chain };

  const command = resolveCommand(config);
  return singleFlight(`exchange-ifc:${metadata.checksum}:${config.kind}`, async () => {
    const again = await readCached(outPath);
    if (again) return { ...again, cacheHit: true, chain: config.chain };
    await mkdir(dir, { recursive: true });
    const sourcePath = resolveLocalUploadStoragePath(metadata);
    try {
      await execFileAsync(
        command,
        [sourcePath, outPath, "--name", metadata.originalName],
        { timeout: ifcTimeoutMs(), maxBuffer: 64 * 1024 * 1024 },
      );
    } catch (error) {
      const stderr =
        typeof error === "object" && error && "stderr" in error
          ? String((error as { stderr?: unknown }).stderr ?? "")
          : "";
      // worker 对纯 2D/无几何源以非零退出 + 中文说明报错,原样透出
      const reason = stderr.trim().split("\n").pop() || (error instanceof Error ? error.message : String(error));
      throw new ExchangeIfcError(
        422,
        "exchange_ifc_conversion_failed",
        `${config.chain} 失败: ${reason.slice(0, 300)}`,
        { command },
      );
    }
    const result = await readCached(outPath);
    if (!result) {
      throw new ExchangeIfcError(
        500,
        "exchange_ifc_missing_output",
        "转换命令执行成功但未产出 IFC。",
        { outPath },
      );
    }
    return { ...result, cacheHit: false, chain: config.chain };
  });
}

async function readCached(
  outPath: string,
): Promise<{ path: string; size: number } | null> {
  try {
    const head = await readFile(outPath);
    if (head.subarray(0, 14).toString("ascii").startsWith("ISO-10303-21")) {
      const s = await stat(outPath);
      return { path: outPath, size: s.size };
    }
    return null;
  } catch {
    return null;
  }
}

export async function readExchangeIfcBytes(fileId: string): Promise<{
  bytes: Buffer;
  fileName: string;
  chain: string;
}> {
  const result = await deriveExchangeIfc(fileId);
  const metadata = await getLocalFileMetadata(fileId);
  const base = (metadata?.originalName ?? fileId).replace(/\.[^.]+$/, "");
  return {
    bytes: await readFile(result.path),
    fileName: `${base}.ifc`,
    chain: result.chain,
  };
}
