// lib/model-bom-export-server.ts - All-format model/drawing BOM export
// License: Apache-2.0
//
// 按源格式分发到各自的真实计量链,统一缓存与诚实标注:
//   .step/.stp/.iges/.igs → FreeCAD/OCCT 装配实体计量(panaec-step-to-bom)
//   .dwg/.dxf             → ezdxf 块引用统计,DWG 经 LibreDWG dwg2dxf(panaec-drawing-to-bom)
//   .usd/.usda/.usdc/.usdz→ three.js USDLoader 实例计数(与查看器同源,Node 原生)
//   .pdf                  → pdfplumber 图纸表格原样提取(panaec-pdf-to-bom)
//   .rvt/.3dm             → 复用各自真实 IFC 派生,再走 ifcopenshell 几何实测 BOM
// 命令缺失/失败一律明确报错,不降级伪造。

import { execFile } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { LocalFileMetadata } from "./local-file-runtime";
import {
  getLocalFileMetadata,
  getLocalUploadsDir,
  resolveLocalUploadStoragePath,
} from "./local-file-runtime-server";
import { readRvtDerivativeBytes } from "./rvt-derivative-server";
import { readThreeDmDerivativeBytes } from "./three-dm-derivative-server";
import { singleFlight } from "./single-flight-server";

const execFileAsync = promisify(execFile);

export class ModelBomExportError extends Error {
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
    this.name = "ModelBomExportError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ModelBomExtractResult {
  manifest: Record<string, unknown>;
  summaryCsv: Buffer | null;
  elementsCsv: Buffer | null;
  cacheHit: boolean;
  chain: string;
}

interface BomChainConfig {
  kind: string;
  chain: string;
  commandEnv: string;
  defaultScript: string;
}

const workerScriptsDir = "/home/insome/dev/insomeos/06-workers/scripts";

const CHAINS: Record<string, BomChainConfig> = {
  ".step": stepChain(),
  ".stp": stepChain(),
  ".iges": stepChain(),
  ".igs": stepChain(),
  ".dwg": drawingChain(),
  ".dxf": drawingChain(),
  ".usd": usdChain(),
  ".usda": usdChain(),
  ".usdc": usdChain(),
  ".usdz": usdChain(),
  ".pdf": pdfChain(),
};

function stepChain(): BomChainConfig {
  return {
    kind: "step-occt",
    chain: "OCCT 装配实体计量(FreeCAD)",
    commandEnv: "PANAEC_STEP_BOM_COMMAND",
    defaultScript: join(workerScriptsDir, "panaec-step-to-bom"),
  };
}

function drawingChain(): BomChainConfig {
  return {
    kind: "drawing-blocks",
    chain: "图纸块引用统计(ezdxf,DWG 经 LibreDWG)",
    commandEnv: "PANAEC_DRAWING_BOM_COMMAND",
    defaultScript: join(workerScriptsDir, "panaec-drawing-to-bom"),
  };
}

function usdChain(): BomChainConfig {
  return {
    kind: "usd-prims",
    chain: "USD 几何实例计数(three.js USDLoader,与查看器同源)",
    commandEnv: "PANAEC_USD_BOM_COMMAND",
    defaultScript: join(workerScriptsDir, "panaec-usd-to-bom"),
  };
}

function pdfChain(): BomChainConfig {
  return {
    kind: "pdf-tables",
    chain: "图纸表格原样提取(pdfplumber)",
    commandEnv: "PANAEC_PDF_BOM_COMMAND",
    defaultScript: join(workerScriptsDir, "panaec-pdf-to-bom"),
  };
}

export function modelBomSupportedExt(ext: string): boolean {
  const lower = ext.toLowerCase();
  return lower in CHAINS || lower === ".rvt" || lower === ".3dm";
}

function resolveChainCommand(config: BomChainConfig): string {
  const fromEnv = process.env[config.commandEnv]?.trim();
  if (fromEnv) return fromEnv;
  try {
    accessSync(config.defaultScript, constants.X_OK);
    return config.defaultScript;
  } catch {
    throw new ModelBomExportError(
      503,
      "model_bom_adapter_unavailable",
      `${config.chain} 命令不可用:请配置 ${config.commandEnv} 或部署 ${config.defaultScript};不做降级伪造。`,
      { requiredEnv: [config.commandEnv] },
    );
  }
}

function bomCacheDir(metadata: LocalFileMetadata, kind: string): string {
  return join(
    getLocalUploadsDir(),
    "derivatives",
    "model-bom",
    kind,
    metadata.checksum.slice(0, 16),
  );
}

async function readCached(cacheDir: string): Promise<{
  manifest: Record<string, unknown>;
  summaryCsv: Buffer | null;
  elementsCsv: Buffer | null;
} | null> {
  try {
    const manifestRaw = await readFile(join(cacheDir, "manifest.json"), "utf8");
    const manifest = JSON.parse(manifestRaw) as Record<string, unknown>;
    if (manifest.schema !== "architoken.model_bom_manifest.v1" &&
        manifest.schema !== "architoken.ifc_bom_manifest.v1") {
      return null;
    }
    const summaryCsv = await readFile(join(cacheDir, "bom_summary.csv")).catch(
      () => null,
    );
    const elementsCsv = await readFile(
      join(cacheDir, "bom_elements.csv"),
    ).catch(() => null);
    return { manifest, summaryCsv, elementsCsv };
  } catch {
    return null;
  }
}

async function runChainCommand(
  command: string,
  sourcePath: string,
  cacheDir: string,
  displayName: string,
): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  try {
    await execFileAsync(
      command,
      [
        sourcePath,
        join(cacheDir, "manifest.json"),
        "--csv-dir",
        cacheDir,
        "--name",
        displayName,
      ],
      { timeout: modelBomTimeoutMs(), maxBuffer: 256 * 1024 * 1024 },
    );
  } catch (error) {
    throw new ModelBomExportError(
      502,
      "model_bom_command_failed",
      `BOM 计量命令执行失败: ${error instanceof Error ? error.message.slice(0, 500) : String(error)}`,
      { command },
    );
  }
}

function modelBomTimeoutMs(): number {
  const parsed = Number.parseInt(
    process.env.PANAEC_MODEL_BOM_TIMEOUT_MS ?? "",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1_800_000;
}

async function ifcDerivativeChain(
  metadata: LocalFileMetadata,
): Promise<ModelBomExtractResult> {
  const ext = metadata.ext.toLowerCase();
  const kind = `${ext.slice(1)}-via-ifc`;
  const chainLabel =
    ext === ".rvt"
      ? "RVT→IFC(RVT2IFCconverter)→ifcopenshell 几何实测"
      : "3DM→IFC(rhino3dm)→ifcopenshell 几何实测";
  const cacheDir = bomCacheDir(metadata, kind);
  const cached = await readCached(cacheDir);
  if (cached) return { ...cached, cacheHit: true, chain: chainLabel };

  const ifcBomCommand = process.env.PANAEC_IFC_BOM_COMMAND?.trim();
  if (!ifcBomCommand) {
    throw new ModelBomExportError(
      503,
      "model_bom_adapter_unavailable",
      "需要 PANAEC_IFC_BOM_COMMAND(ifcopenshell 几何实测)才能对 IFC 派生执行 BOM。",
      { requiredEnv: ["PANAEC_IFC_BOM_COMMAND"] },
    );
  }

  return singleFlight(`model-bom:${metadata.checksum}:${kind}`, async () => {
    const again = await readCached(cacheDir);
    if (again) return { ...again, cacheHit: true, chain: chainLabel };

    // 取真实 IFC 派生(缓存命中即秒回;否则触发各自的真实转换链)
    const ifcBytes =
      ext === ".rvt"
        ? (await readRvtDerivativeBytes(metadata.fileId, "ifc")).bytes
        : (await readThreeDmDerivativeBytes(metadata.fileId, "ifc")).bytes;

    await mkdir(cacheDir, { recursive: true });
    const stagedIfc = join(cacheDir, "derived-source.ifc");
    await writeFile(stagedIfc, ifcBytes);
    try {
      await runChainCommand(
        ifcBomCommand,
        stagedIfc,
        cacheDir,
        `${metadata.originalName}(IFC 派生)`,
      );
    } finally {
      // IFC 派生原件保存在各自的派生缓存里,这里的暂存副本用完即清
      await rm(stagedIfc, { force: true });
    }
    const artifacts = await readCached(cacheDir);
    if (!artifacts) {
      throw new ModelBomExportError(
        500,
        "model_bom_artifacts_missing",
        "BOM 命令执行成功但未产出 manifest/CSV 工件。",
        { cacheDir },
      );
    }
    return { ...artifacts, cacheHit: false, chain: chainLabel };
  });
}

export async function extractModelBomForFile(
  fileId: string,
): Promise<ModelBomExtractResult> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new ModelBomExportError(404, "file_not_found", "file not found", {
      fileId,
    });
  }
  const ext = metadata.ext.toLowerCase();

  if (ext === ".rvt" || ext === ".3dm") {
    return ifcDerivativeChain(metadata);
  }

  const config = CHAINS[ext];
  if (!config) {
    throw new ModelBomExportError(
      415,
      "model_bom_unsupported_format",
      `该格式暂无 BOM 计量链: ${ext || "未知"}`,
      { ext },
    );
  }

  const cacheDir = bomCacheDir(metadata, config.kind);
  const cached = await readCached(cacheDir);
  if (cached) return { ...cached, cacheHit: true, chain: config.chain };

  const command = resolveChainCommand(config);
  return singleFlight(
    `model-bom:${metadata.checksum}:${config.kind}`,
    async () => {
      const again = await readCached(cacheDir);
      if (again) return { ...again, cacheHit: true, chain: config.chain };
      const sourcePath = resolveLocalUploadStoragePath(metadata);
      await runChainCommand(command, sourcePath, cacheDir, metadata.originalName);
      const artifacts = await readCached(cacheDir);
      if (!artifacts) {
        throw new ModelBomExportError(
          500,
          "model_bom_artifacts_missing",
          "BOM 命令执行成功但未产出 manifest/CSV 工件。",
          { cacheDir },
        );
      }
      return { ...artifacts, cacheHit: false, chain: config.chain };
    },
  );
}
