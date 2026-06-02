// lib/skp-derivative-server.ts - Licensed SKP derivative runtime for local uploads
// License: Apache-2.0

import {
  copyFile,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { accessSync, constants } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
  getLocalFileMetadata,
  getLocalUploadsDir,
  readLocalFileIndex,
  resolveLocalUploadStoragePath,
} from "./local-file-runtime-server";
import { adapterSourceById } from "./adapter-source-registry";
import type { LocalFileMetadata } from "./local-file-runtime";

export type SkpDerivativeFormat = "manifest" | "glb" | "ifc";

export interface SkpDerivativeAdapterProbe {
  id: string;
  label: string;
  priority: number;
  status: "available" | "missing";
  licenseBoundary:
    | "external_licensed_adapter"
    | "isolated_copyleft_sidecar"
    | "open_source_process";
  sourceUrl: string;
  installHint: string;
  endpoint?: string;
  command?: string;
}

export interface SkpDerivativeArtifact {
  kind: "skp-glb" | "skp-ifc";
  url: string;
  mediaType: "model/gltf-binary" | "application/p21";
  engine: string;
  etag: string;
  cacheHit: boolean;
  cacheKey: string;
  size?: number;
}

export interface SkpDerivativeManifest {
  schema: "architoken.skp_derivative_manifest.v1";
  fileId: string;
  originalName: string;
  sourceFormat: "skp";
  sourceChecksum: string;
  sourceOfRecord: {
    url: string;
    checksum: string;
    rangeRequests: true;
    substitutePreview: false;
  };
  etag: string;
  cachePolicy: "stream+etag+checksum";
  cacheKey: string;
  viewer:
    | "prengine_skp_model"
    | "prengine_skp_ifc_model"
    | "licensed_adapter_required";
  engine: "Prengine";
  derivativeArtifact?: SkpDerivativeArtifact;
  ifcArtifact?: SkpDerivativeArtifact;
  adapters: SkpDerivativeAdapterProbe[];
  permissions: {
    canView: boolean;
    canWriteDerivative: boolean;
    requiresLicensedAdapter: boolean;
  };
  notes: string[];
}

export interface SkpDerivativeBytes {
  bytes: Buffer;
  mediaType: "model/gltf-binary" | "application/p21";
  fileName: string;
  engine: "Prengine";
  etag: string;
  cacheHit: boolean;
}

export class SkpDerivativeError extends Error {
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
    this.name = "SkpDerivativeError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface SkpGlbDerivative {
  path: string;
  size: number;
  cacheHit: boolean;
  source: "cache" | "command" | "adapter" | "glb-fallback";
  sourcePath?: string;
}

interface SkpIfcDerivative {
  path: string;
  size: number;
  cacheHit: boolean;
  source: "cache" | "command" | "adapter";
}

interface SkpCommandAdapterConfig {
  command: string;
  args: string[];
  source: "configured" | "assimp" | "common-command";
}

interface ProcessResult {
  stdout: Buffer;
  stderr: Buffer;
}

const skpAdapterTimeoutMs = 900_000;
const skpCommandTimeoutMs = 3_600_000;
const skpDerivativeRuntimeVersion = "v1-real-glb";

function adapterSourceUrl(id: string, fallback: string): string {
  return adapterSourceById(id)?.url ?? fallback;
}

export async function buildSkpDerivativeManifest(
  fileId: string,
): Promise<SkpDerivativeManifest> {
  const metadata = await requireLocalSkpMetadata(fileId);
  const sourceUrl = `/api/local-files/${encodeURIComponent(metadata.fileId)}`;
  const adapters = skpAdapterProbes();

  let ifc: SkpIfcDerivative | null = await readCachedSkpIfc(metadata);
  let ifcError: Error | null = null;
  if (!ifc) {
    try {
      ifc = await ensureSkpIfcDerivative(metadata);
    } catch (error) {
      ifcError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (ifc) {
    const ifcUrl = `${sourceUrl}/skp-derivative?format=ifc`;
    const etag = skpDerivativeEtag(metadata, "skp-ifc");
    return {
      schema: "architoken.skp_derivative_manifest.v1",
      fileId: metadata.fileId,
      originalName: metadata.originalName,
      sourceFormat: "skp",
      sourceChecksum: metadata.checksum,
      sourceOfRecord: {
        url: sourceUrl,
        checksum: metadata.checksum,
        rangeRequests: true,
        substitutePreview: false,
      },
      etag,
      cachePolicy: "stream+etag+checksum",
      cacheKey: skpDerivativeCacheKey(metadata, "ifc"),
      viewer: "prengine_skp_ifc_model",
      engine: "Prengine",
      ifcArtifact: {
        kind: "skp-ifc",
        url: ifcUrl,
        mediaType: "application/p21",
        engine: "Prengine",
        etag,
        cacheHit: ifc.cacheHit,
        cacheKey: skpDerivativeCacheKey(metadata, "ifc"),
        size: ifc.size,
      },
      adapters,
      permissions: {
        canView: true,
        canWriteDerivative: true,
        requiresLicensedAdapter: true,
      },
      notes: skpIfcDerivativeReadyNotes(ifc),
    };
  }

  let derivative: SkpGlbDerivative | null = await readCachedSkpGlb(metadata);
  let derivativeError: Error | null = null;
  if (!derivative) {
    try {
      derivative = await ensureSkpGlbDerivative(metadata);
    } catch (error) {
      derivativeError =
        error instanceof Error ? error : new Error(String(error));
    }
  }

  if (!derivative && !ifc) {
    return {
      schema: "architoken.skp_derivative_manifest.v1",
      fileId: metadata.fileId,
      originalName: metadata.originalName,
      sourceFormat: "skp",
      sourceChecksum: metadata.checksum,
      sourceOfRecord: {
        url: sourceUrl,
        checksum: metadata.checksum,
        rangeRequests: true,
        substitutePreview: false,
      },
      etag: skpDerivativeEtag(metadata, "adapter-missing"),
      cachePolicy: "stream+etag+checksum",
      cacheKey: skpDerivativeCacheKey(metadata, "missing"),
      viewer: "licensed_adapter_required",
      engine: "Prengine",
      adapters,
      permissions: {
        canView: false,
        canWriteDerivative: false,
        requiresLicensedAdapter: true,
      },
      notes: [
        "SKP 是私有模型格式；当前未接入 Prengine 授权模型适配器，系统不会用字节预览、伪几何或不完整前端复刻替代真实模型。",
        ...(derivativeError
          ? [`SKP 派生尝试失败: ${derivativeError.message}`]
          : []),
        ...(ifcError ? [`SKP 转 IFC 尝试失败: ${ifcError.message}`] : []),
        "当前没有找到同源或缓存的真实 GLB 派生产物；已检查同目录同名 GLB、显式绑定 GLB、uploads/derivatives 和旧 .derivatives 派生目录。",
        "可接入 SketchUp Ruby Model#export、BIM-Tools SketchUp IFC Manager GPL 隔离 sidecar、Yulio glTF exporter sidecar 或 Speckle SketchUp sidecar；命令路径使用 PRENGINE_SKP_TO_IFC_COMMAND / PRENGINE_SKP_CONVERTER_COMMAND，HTTP 路径使用 SKETCHUP_ADAPTER_URL。",
      ],
    };
  }

  const glbDerivative = derivative;
  if (!glbDerivative) {
    throw new SkpDerivativeError(
      500,
      "skp_derivative_state_invalid",
      "SKP derivative state lost GLB artifact after manifest branching.",
    );
  }

  const glbUrl = `${sourceUrl}/skp-derivative?format=glb`;
  const etag = skpDerivativeEtag(metadata, "skp-glb");
  return {
    schema: "architoken.skp_derivative_manifest.v1",
    fileId: metadata.fileId,
    originalName: metadata.originalName,
    sourceFormat: "skp",
    sourceChecksum: metadata.checksum,
    sourceOfRecord: {
      url: sourceUrl,
      checksum: metadata.checksum,
      rangeRequests: true,
      substitutePreview: false,
    },
    etag,
    cachePolicy: "stream+etag+checksum",
    cacheKey: skpDerivativeCacheKey(metadata, "glb"),
    viewer: "prengine_skp_model",
    engine: "Prengine",
    derivativeArtifact: {
      kind: "skp-glb",
      url: glbUrl,
      mediaType: "model/gltf-binary",
      engine: "Prengine",
      etag,
      cacheHit: glbDerivative.cacheHit,
      cacheKey: skpDerivativeCacheKey(metadata, "glb"),
      size: glbDerivative.size,
    },
    adapters,
    permissions: {
      canView: true,
      canWriteDerivative: true,
      requiresLicensedAdapter: glbDerivative.source !== "glb-fallback",
    },
    notes: skpDerivativeReadyNotes(glbDerivative),
  };
}

export async function readSkpDerivativeBytes(
  fileId: string,
  format: SkpDerivativeFormat,
): Promise<SkpDerivativeBytes> {
  const metadata = await requireLocalSkpMetadata(fileId);
  if (format === "glb") {
    const derivative = await ensureSkpGlbDerivative(metadata);
    return {
      bytes: await readFile(derivative.path),
      mediaType: "model/gltf-binary",
      fileName: `${safeSkpStem(metadata)}.glb`,
      engine: "Prengine",
      etag: skpDerivativeEtag(metadata, "skp-glb"),
      cacheHit: derivative.cacheHit,
    };
  }
  if (format === "ifc") {
    const derivative = await ensureSkpIfcDerivative(metadata);
    return {
      bytes: await readFile(derivative.path),
      mediaType: "application/p21",
      fileName: `${safeSkpStem(metadata)}.ifc`,
      engine: "Prengine",
      etag: skpDerivativeEtag(metadata, "skp-ifc"),
      cacheHit: derivative.cacheHit,
    };
  }
  throw new SkpDerivativeError(
    415,
    "unsupported_skp_derivative_request",
    `Cannot serve ${format} derivative for SKP`,
    { requestedFormat: format },
  );
}

function skpAdapterProbes(): SkpDerivativeAdapterProbe[] {
  const endpoint = licensedSkpAdapterEndpoint();
  const command = skpCommandAdapterConfig();
  const ifcCommand = skpIfcCommandAdapterConfig();
  const openSourceCommand = openSourceSkpCommandAdapterConfig();
  const commonCommand = commonSkpGlbCommandAdapterConfig();
  return [
    {
      id: "sketchup-ruby-model-export-ifc",
      label: "SketchUp Ruby Model.export IFC sidecar",
      priority: 1,
      status: ifcCommand || endpoint ? "available" : "missing",
      licenseBoundary: "external_licensed_adapter",
      sourceUrl: adapterSourceUrl(
        "sketchup-ruby-model-api",
        "https://ruby.sketchup.com/Sketchup/Model.html",
      ),
      installHint:
        "在用户授权的 SketchUp Pro Ruby 运行时中打开 SKP，并调用 Sketchup::Model#export 生成 IFC；通过 PRENGINE_SKP_TO_IFC_COMMAND 或 SKETCHUP_ADAPTER_URL 暴露给 ArchIToken。",
      ...(ifcCommand ? { command: ifcCommand.command } : {}),
      ...(endpoint ? { endpoint } : {}),
    },
    {
      id: "sketchup-ifc-manager-sidecar",
      label: "BIM-Tools SketchUp IFC Manager sidecar",
      priority: 2,
      status: ifcCommand ? "available" : "missing",
      licenseBoundary: "isolated_copyleft_sidecar",
      sourceUrl: adapterSourceUrl(
        "sketchup-ifc-manager",
        "https://github.com/BIM-Tools/SketchUp-IFC-Manager",
      ),
      installHint:
        "GPL IFC Manager 只能在独立 SketchUp Ruby sidecar/CLI/HTTP 服务中运行，输出真实 IFC artifact；不得把 GPL 源码并入前端、后端或分发核心。",
      ...(ifcCommand ? { command: ifcCommand.command } : {}),
    },
    {
      id: "prengine-skp-ifc-command-adapter",
      label: "Prengine SKP to IFC command adapter",
      priority: 3,
      status: ifcCommand ? "available" : "missing",
      licenseBoundary: "external_licensed_adapter",
      sourceUrl: "local-command-path",
      installHint:
        "配置 PRENGINE_SKP_TO_IFC_COMMAND 和 PRENGINE_SKP_TO_IFC_ARGS 后，可调用本机、远程或授权 SketchUp 环境中的真实 SKP 转 IFC 命令；该路径不会用 GLB 替代 IFC。",
      ...(ifcCommand ? { command: ifcCommand.command } : {}),
    },
    {
      id: "yulio-sketchup-gltf-exporter-sidecar",
      label: "Yulio SketchUp glTF/GLB exporter sidecar",
      priority: 4,
      status: command || commonCommand || endpoint ? "available" : "missing",
      licenseBoundary: "external_licensed_adapter",
      sourceUrl: adapterSourceUrl(
        "yulio-sketchup-gltf-exporter",
        "https://github.com/YulioTech/SketchUp-glTF-Exporter-Ruby",
      ),
      installHint:
        "在用户授权的 SketchUp Ruby 运行时加载 MIT Yulio glTF exporter，输出真实 GLB；通过 PRENGINE_SKP_CONVERTER_COMMAND、SKP2GLB_BIN 或 SKETCHUP_ADAPTER_URL 接入。",
      ...(command ? { command: command.command } : {}),
      ...(endpoint ? { endpoint } : {}),
    },
    {
      id: "sketchup-ruby-model-export-glb",
      label: "SketchUp Ruby Model.export GLB sidecar",
      priority: 5,
      status: command || commonCommand || endpoint ? "available" : "missing",
      licenseBoundary: "external_licensed_adapter",
      sourceUrl: adapterSourceUrl(
        "sketchup-ruby-exporter-options",
        "https://ruby.sketchup.com/file.exporter_options.html",
      ),
      installHint:
        "SketchUp 2024+ 可通过 Ruby Model#export 导出 GLB；GLB 仅作为源绑定浏览器运行时派生，不替代 SKP 真源、属性或 IFC/openBIM 语义。",
      ...(command ? { command: command.command } : {}),
      ...(endpoint ? { endpoint } : {}),
    },
    {
      id: "assimp-skp-glb",
      label: "Assimp SKP GLB converter",
      priority: 6,
      status: openSourceCommand ? "available" : "missing",
      licenseBoundary: "open_source_process",
      sourceUrl: "https://github.com/assimp/assimp",
      installHint:
        "安装 Assimp，并确认当前构建包含 SKP importer；可自动尝试 assimp export source.skp output.glb。",
      ...(openSourceCommand ? { command: openSourceCommand.command } : {}),
    },
    {
      id: "common-skp-glb-command",
      label: "Common SKP to GLB command fallback",
      priority: 7,
      status: commonCommand ? "available" : "missing",
      licenseBoundary: "external_licensed_adapter",
      sourceUrl: "local-command-path",
      installHint:
        "安装或放入 PATH：prengine-skp-to-glb、sketchup-ruby-export-glb、yulio-skp-to-glb、skp2glb、skp-to-glb、skp2gltf、sketchup-to-gltf 等真实 SKP 转 GLB 命令；也可用 SKP2GLB_BIN/SKP_TO_GLB_BIN 指定路径。",
      ...(commonCommand ? { command: commonCommand.command } : {}),
    },
    {
      id: "prengine-skp-command-adapter",
      label: "Prengine SKP command adapter",
      priority: 8,
      status: command ? "available" : "missing",
      licenseBoundary: "external_licensed_adapter",
      sourceUrl: adapterSourceUrl(
        "yulio-sketchup-gltf-exporter",
        "https://github.com/YulioTech/SketchUp-glTF-Exporter-Ruby",
      ),
      installHint:
        "配置 PRENGINE_SKP_CONVERTER_COMMAND 和 PRENGINE_SKP_CONVERTER_ARGS 后，可调用本机或授权 SketchUp/Yulio 环境中的 SKP 转 GLB 命令。",
      ...(command ? { command: command.command } : {}),
    },
    {
      id: "prengine-sketchup-adapter",
      label: "Prengine / Speckle SketchUp sidecar adapter",
      priority: 10,
      status: endpoint ? "available" : "missing",
      licenseBoundary: "external_licensed_adapter",
      sourceUrl: adapterSourceUrl(
        "speckle-sketchup",
        "https://github.com/specklesystems/speckle-sketchup",
      ),
      installHint:
        "接入 Prengine 授权 SketchUp sidecar 或 Speckle SketchUp Connector 派生服务后，可生成 SKP 真实 IFC/GLB、属性清单和对象映射。",
      ...(endpoint ? { endpoint } : {}),
    },
  ];
}

async function requireLocalSkpMetadata(
  fileId: string,
): Promise<LocalFileMetadata> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new SkpDerivativeError(404, "file_not_found", "file not found", {
      fileId,
    });
  }
  if (metadata.ext.toLowerCase() !== ".skp") {
    throw new SkpDerivativeError(
      415,
      "unsupported_skp_derivative_format",
      `Unsupported SKP derivative format: ${metadata.ext || metadata.mimeType}`,
      { extension: metadata.ext, mimeType: metadata.mimeType },
    );
  }
  return metadata;
}

async function ensureSkpGlbDerivative(
  metadata: LocalFileMetadata,
): Promise<SkpGlbDerivative> {
  const cached = await readCachedSkpGlb(metadata);
  if (cached) return cached;

  const errors: Error[] = [];
  const commandAdapter =
    skpCommandAdapterConfig() ??
    openSourceSkpCommandAdapterConfig() ??
    commonSkpGlbCommandAdapterConfig();
  if (commandAdapter) {
    try {
      return await runSkpCommandAdapter(metadata, commandAdapter);
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  const endpoint = licensedSkpAdapterEndpoint();
  if (endpoint) {
    try {
      return await runSkpHttpAdapter(metadata, endpoint);
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  const fallback = await materializeSkpGlbFallback(metadata);
  if (fallback) return fallback;

  if (errors.length > 0) {
    throw new SkpDerivativeError(
      502,
      "skp_derivative_pipeline_failed",
      `SKP 转 GLB 真实派生失败，且未找到可用 GLB 兜底: ${errors
        .map((error) => error.message)
        .join("；")}`,
      { failures: errors.map((error) => error.message) },
    );
  }

  throw new SkpDerivativeError(
    503,
    "skp_adapter_not_configured",
    "SKP 需要接入 Prengine 授权模型适配器后才能真实显示",
    {
      requiredEnv: [
        "assimp",
        "PRENGINE_SKP_CONVERTER_COMMAND",
        "PRENGINE_SKP_CONVERTER_ARGS",
        "SKP2GLB_BIN",
        "SKP_TO_GLB_BIN",
        "SKETCHUP_TO_GLTF_BIN",
        "SKETCHUP_ADAPTER_URL",
        "LICENSED_BIM_ADAPTER_URL",
      ],
      fallback: "同目录/同名/同模块 GLB 可作为最后兜底",
    },
  );
}

async function runSkpHttpAdapter(
  metadata: LocalFileMetadata,
  endpoint: string,
): Promise<SkpGlbDerivative> {
  if (!endpoint) {
    throw new SkpDerivativeError(
      503,
      "skp_adapter_not_configured",
      "SKP 需要接入 Prengine 授权模型适配器后才能真实显示",
      {
        requiredEnv: [
          "assimp",
          "PRENGINE_SKP_CONVERTER_COMMAND",
          "PRENGINE_SKP_CONVERTER_ARGS",
          "SKETCHUP_ADAPTER_URL",
          "LICENSED_BIM_ADAPTER_URL",
        ],
      },
    );
  }

  const payload = {
    jobId: `skp-${metadata.fileId}`,
    operation: "licensed_bim_convert",
    sourcePath: resolveLocalUploadStoragePath(metadata),
    sourceFileName: metadata.originalName,
    sourceFormat: "skp",
    sourceChecksum: metadata.checksum,
    outputFormats: ["glb", "properties-index"],
  };
  const response = await postSkpAdapterJson(endpoint, payload);
  const glbBytes = await extractGlbBytes(endpoint, response);
  const target = cachedSkpGlbPath(metadata);
  await mkdir(skpDerivativeCacheDir(metadata), { recursive: true });
  await writeFile(target, glbBytes);
  const written = await stat(target);
  if (!(await isReadableGlb(target))) {
    throw new SkpDerivativeError(
      502,
      "skp_adapter_invalid_glb",
      "Prengine SKP adapter returned bytes that are not a valid GLB artifact",
    );
  }
  return {
    path: target,
    size: written.size,
    cacheHit: false,
    source: "adapter",
  };
}

async function runSkpCommandAdapter(
  metadata: LocalFileMetadata,
  adapter: SkpCommandAdapterConfig,
): Promise<SkpGlbDerivative> {
  const workDir = await mkdtemp(join(tmpdir(), "architoken-skp-derivative-"));
  const outputPath = join(workDir, `${metadata.fileId}.glb`);
  try {
    const args = skpCommandArgs(adapter, metadata, outputPath);
    const result = await runProcess(adapter.command, args, {
      cwd: workDir,
      timeoutMs: skpCommandTimeoutMs,
    });
    const output = await stat(outputPath).catch(() => null);
    if (
      !output?.isFile() ||
      output.size <= 0 ||
      !(await isReadableGlb(outputPath))
    ) {
      throw new SkpDerivativeError(
        502,
        "skp_command_adapter_missing_glb",
        "Prengine SKP command adapter completed without a valid GLB artifact",
        {
          command: adapter.command,
          stdout: trimProcessOutput(result.stdout),
          stderr: trimProcessOutput(result.stderr),
        },
      );
    }

    const target = cachedSkpGlbPath(metadata);
    await mkdir(skpDerivativeCacheDir(metadata), { recursive: true });
    await copyFile(outputPath, target);
    const written = await stat(target);
    return {
      path: target,
      size: written.size,
      cacheHit: false,
      source: "command",
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function ensureSkpIfcDerivative(
  metadata: LocalFileMetadata,
): Promise<SkpIfcDerivative> {
  const cached = await readCachedSkpIfc(metadata);
  if (cached) return cached;

  const adapter = skpIfcCommandAdapterConfig();
  const endpoint = licensedSkpAdapterEndpoint();
  if (!adapter && !endpoint) {
    throw new SkpDerivativeError(
      503,
      "skp_ifc_adapter_not_configured",
      "SKP->IFC 需要真实 SketchUp Ruby/IFC Manager/Speckle 读取导出 sidecar；当前未配置命令或 HTTP 适配器。",
      {
        requiredEnv: [
          "PRENGINE_SKP_TO_IFC_COMMAND",
          "PRENGINE_SKP_TO_IFC_ARGS",
          "SKP_TO_IFC_COMMAND",
          "SKETCHUP_TO_IFC_COMMAND",
          "SKP2IFC_BIN",
          "SKP_TO_IFC_BIN",
          "SKETCHUP_TO_IFC_BIN",
          "SKETCHUP_ADAPTER_URL",
          "LICENSED_BIM_ADAPTER_URL",
        ],
      },
    );
  }

  const errors: Error[] = [];
  if (adapter) {
    try {
      return await runSkpIfcCommandAdapter(metadata, adapter);
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }
  if (endpoint) {
    try {
      return await runSkpHttpIfcAdapter(metadata, endpoint);
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  throw new SkpDerivativeError(
    502,
    "skp_ifc_pipeline_failed",
    `SKP 转 IFC 真实派生失败: ${errors
      .map((error) => error.message)
      .join("；")}`,
    { failures: errors.map((error) => error.message) },
  );
}

async function runSkpHttpIfcAdapter(
  metadata: LocalFileMetadata,
  endpoint: string,
): Promise<SkpIfcDerivative> {
  const payload = {
    jobId: `skp-ifc-${metadata.fileId}`,
    operation: "licensed_bim_convert",
    sourcePath: resolveLocalUploadStoragePath(metadata),
    sourceFileName: metadata.originalName,
    sourceFormat: "skp",
    sourceChecksum: metadata.checksum,
    targetFormat: "ifc",
    outputFormats: ["ifc", "properties-index"],
  };
  const response = await postSkpAdapterJson(endpoint, payload);
  const ifcBytes = await extractIfcBytes(endpoint, response);
  const target = cachedSkpIfcPath(metadata);
  await mkdir(skpDerivativeCacheDir(metadata), { recursive: true });
  await writeFile(target, ifcBytes);
  const written = await stat(target);
  if (!(await isReadableIfc(target))) {
    throw new SkpDerivativeError(
      502,
      "skp_adapter_invalid_ifc",
      "Prengine SKP adapter returned bytes that are not a valid IFC artifact",
    );
  }
  return {
    path: target,
    size: written.size,
    cacheHit: false,
    source: "adapter",
  };
}

async function runSkpIfcCommandAdapter(
  metadata: LocalFileMetadata,
  adapter: SkpCommandAdapterConfig,
): Promise<SkpIfcDerivative> {
  const workDir = await mkdtemp(join(tmpdir(), "architoken-skp-ifc-"));
  const outputPath = join(workDir, `${metadata.fileId}.ifc`);
  try {
    const args = skpCommandArgs(adapter, metadata, outputPath);
    const result = await runProcess(adapter.command, args, {
      cwd: workDir,
      timeoutMs: skpCommandTimeoutMs,
    });
    const output = await stat(outputPath).catch(() => null);
    if (
      !output?.isFile() ||
      output.size <= 0 ||
      !(await isReadableIfc(outputPath))
    ) {
      throw new SkpDerivativeError(
        502,
        "skp_ifc_command_adapter_missing_ifc",
        "Prengine SKP->IFC command adapter completed without a valid IFC artifact",
        {
          command: adapter.command,
          stdout: trimProcessOutput(result.stdout),
          stderr: trimProcessOutput(result.stderr),
        },
      );
    }

    const target = cachedSkpIfcPath(metadata);
    await mkdir(skpDerivativeCacheDir(metadata), { recursive: true });
    await copyFile(outputPath, target);
    const written = await stat(target);
    return {
      path: target,
      size: written.size,
      cacheHit: false,
      source: "command",
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function readCachedSkpGlb(
  metadata: LocalFileMetadata,
): Promise<SkpGlbDerivative | null> {
  const paths = [
    cachedSkpGlbPath(metadata),
    ...(await derivativeGlbCandidates(metadata)),
  ];
  const readable = await readFirstReadableGlb(paths);
  if (!readable) return null;
  return {
    path: readable.path,
    size: readable.size,
    cacheHit: true,
    source: "cache",
  };
}

async function readCachedSkpIfc(
  metadata: LocalFileMetadata,
): Promise<SkpIfcDerivative | null> {
  const paths = [
    cachedSkpIfcPath(metadata),
    ...(await derivativeIfcCandidates(metadata)),
  ];
  const readable = await readFirstReadableIfc(paths);
  if (!readable) return null;
  return {
    path: readable.path,
    size: readable.size,
    cacheHit: true,
    source: "cache",
  };
}

async function readFirstReadableIfc(
  paths: string[],
): Promise<{ path: string; size: number } | null> {
  const seen = new Set<string>();
  for (const path of paths) {
    if (seen.has(path)) continue;
    seen.add(path);
    try {
      const fileStat = await stat(path);
      if (!fileStat.isFile() || fileStat.size <= 0) continue;
      if (!(await isReadableIfc(path))) continue;
      return { path, size: fileStat.size };
    } catch {
      continue;
    }
  }
  return null;
}

async function readFirstReadableGlb(
  paths: string[],
): Promise<{ path: string; size: number } | null> {
  const seen = new Set<string>();
  for (const path of paths) {
    if (seen.has(path)) continue;
    seen.add(path);
    try {
      const fileStat = await stat(path);
      if (!fileStat.isFile() || fileStat.size <= 0) continue;
      if (!(await isReadableGlb(path))) continue;
      return { path, size: fileStat.size };
    } catch {
      continue;
    }
  }
  return null;
}

async function materializeReadableGlb(
  metadata: LocalFileMetadata,
  fallbackPath: string,
): Promise<SkpGlbDerivative> {
  const target = cachedSkpGlbPath(metadata);
  await mkdir(skpDerivativeCacheDir(metadata), { recursive: true });
  if (fallbackPath !== target) {
    await copyFile(fallbackPath, target);
  }
  const written = await stat(target);
  return {
    path: target,
    size: written.size,
    cacheHit: false,
    source: "glb-fallback",
    sourcePath: fallbackPath,
  };
}

async function materializeSkpGlbFallback(
  metadata: LocalFileMetadata,
): Promise<SkpGlbDerivative | null> {
  const readable = await readFirstReadableGlb(
    await findSkpGlbFallbackPaths(metadata),
  );
  if (!readable) return null;
  return await materializeReadableGlb(metadata, readable.path);
}

async function findSkpGlbFallbackPaths(
  metadata: LocalFileMetadata,
): Promise<string[]> {
  const sourcePath = resolveLocalUploadStoragePath(metadata);
  const sourceDir = dirname(sourcePath);
  const sourceStorageStem = basename(sourcePath, extname(sourcePath));
  const originalStem = fileNameStem(metadata.originalName);
  return [
    join(sourceDir, `${sourceStorageStem}.glb`),
    join(sourceDir, `${safeSkpStem(metadata)}.glb`),
    join(sourceDir, `${originalStem}.glb`),
    ...(await indexedSiblingGlbCandidates(metadata)),
    ...(await derivativeGlbCandidates(metadata)),
  ].filter((candidate) => candidate && candidate !== sourcePath);
}

async function indexedSiblingGlbCandidates(
  metadata: LocalFileMetadata,
): Promise<string[]> {
  const index = await readLocalFileIndex().catch(() => ({ files: [] }));
  const sourceStem = normalizedFileStem(metadata.originalName);
  const candidates: string[] = [];
  for (const file of index.files) {
    if (file.fileId === metadata.fileId) continue;
    if (file.ext.toLowerCase() !== ".glb") continue;
    if (file.moduleId !== metadata.moduleId) continue;
    if ((file.parentId ?? "") !== (metadata.parentId ?? "")) continue;

    const tags = new Set(file.tags.map((tag) => tag.toLowerCase()));
    const explicitMatch =
      tags.has(`skp-fallback:${metadata.fileId}`) ||
      tags.has(`skp-source:${metadata.fileId}`) ||
      tags.has(`source:${metadata.fileId}`);
    const nameMatch = normalizedFileStem(file.originalName) === sourceStem;
    if (!explicitMatch && !nameMatch) continue;

    try {
      candidates.push(resolveLocalUploadStoragePath(file));
    } catch {
      continue;
    }
  }
  return candidates;
}

async function derivativeGlbCandidates(
  metadata: LocalFileMetadata,
): Promise<string[]> {
  const candidates: string[] = [];
  for (const directory of [
    ...skpDerivativeSearchDirs(metadata),
    ...(await sharedSkpChecksumDerivativeDirs(metadata, "glb")),
  ]) {
    candidates.push(...(await collectGlbFiles(directory, 3)));
  }
  return candidates;
}

async function derivativeIfcCandidates(
  metadata: LocalFileMetadata,
): Promise<string[]> {
  const candidates: string[] = [];
  for (const directory of [
    ...skpDerivativeSearchDirs(metadata),
    ...(await sharedSkpChecksumDerivativeDirs(metadata, "ifc")),
  ]) {
    candidates.push(...(await collectIfcFiles(directory, 3)));
  }
  return candidates;
}

async function sharedSkpChecksumDerivativeDirs(
  metadata: LocalFileMetadata,
  kind: "glb" | "ifc",
): Promise<string[]> {
  const root = join(getLocalUploadsDir(), "derivatives");
  const checksum16 = metadata.checksum.slice(0, 16);
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== metadata.fileId)
    .flatMap((entry) => [
      join(root, entry.name, checksum16, kind),
      join(root, entry.name, metadata.checksum, kind),
    ]);
}

async function collectGlbFiles(
  directory: string,
  maxDepth: number,
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  const candidates: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".glb")) {
      candidates.push(path);
      continue;
    }
    if (entry.isDirectory() && maxDepth > 0) {
      candidates.push(...(await collectGlbFiles(path, maxDepth - 1)));
    }
  }
  return candidates;
}

async function collectIfcFiles(
  directory: string,
  maxDepth: number,
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  const candidates: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".ifc")) {
      candidates.push(path);
      continue;
    }
    if (entry.isDirectory() && maxDepth > 0) {
      candidates.push(...(await collectIfcFiles(path, maxDepth - 1)));
    }
  }
  return candidates;
}

async function isReadableGlb(path: string): Promise<boolean> {
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    const fileStat = await stat(path);
    if (!fileStat.isFile() || fileStat.size < 4) return false;
    handle = await open(path, "r");
    const header = Buffer.alloc(4);
    const { bytesRead } = await handle.read(header, 0, 4, 0);
    return bytesRead === 4 && header.toString("ascii") === "glTF";
  } catch {
    return false;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function isReadableIfc(path: string): Promise<boolean> {
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    const fileStat = await stat(path);
    if (!fileStat.isFile() || fileStat.size <= 0) return false;
    handle = await open(path, "r");
    const header = Buffer.alloc(Math.min(fileStat.size, 65_536));
    await handle.read(header, 0, header.byteLength, 0);
    const text = header.toString("latin1").toUpperCase();
    return (
      text.slice(0, 4096).includes("ISO-10303-21") &&
      text.includes("FILE_SCHEMA")
    );
  } catch {
    return false;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function postSkpAdapterJson(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), skpAdapterTimeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.LICENSED_BIM_ADAPTER_TOKEN
          ? {
              authorization: `Bearer ${process.env.LICENSED_BIM_ADAPTER_TOKEN}`,
            }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new SkpDerivativeError(
        response.status,
        "skp_adapter_failed",
        `Prengine SKP adapter returned HTTP ${response.status}`,
        { responseText: await response.text() },
      );
    }
    const data = (await response.json()) as unknown;
    if (!isRecord(data)) {
      throw new SkpDerivativeError(
        502,
        "skp_adapter_invalid_response",
        "Prengine SKP adapter response must be a JSON object",
      );
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function extractGlbBytes(
  endpoint: string,
  response: Record<string, unknown>,
): Promise<Buffer> {
  const artifacts = Array.isArray(response.artifacts)
    ? response.artifacts.filter(isRecord)
    : [response];
  const glbArtifact =
    artifacts.find(isGlbArtifactCandidate) ??
    artifacts.find((artifact) => typeof artifact.contentBase64 === "string");
  if (!glbArtifact) {
    throw new SkpDerivativeError(
      502,
      "skp_adapter_missing_glb",
      "Prengine SKP adapter did not return a GLB artifact",
      { response },
    );
  }

  const contentBase64 = glbArtifact.contentBase64;
  if (typeof contentBase64 === "string") {
    return Buffer.from(contentBase64, "base64");
  }

  const uri =
    stringValue(glbArtifact.url) ??
    stringValue(glbArtifact.objectUri) ??
    stringValue(glbArtifact.object_uri);
  if (uri) {
    const artifactUrl = new URL(uri, endpoint).toString();
    const artifactResponse = await fetch(artifactUrl);
    if (!artifactResponse.ok) {
      throw new SkpDerivativeError(
        artifactResponse.status,
        "skp_adapter_artifact_fetch_failed",
        `Cannot fetch SKP GLB artifact from ${artifactUrl}`,
      );
    }
    return Buffer.from(await artifactResponse.arrayBuffer());
  }

  const filePath =
    stringValue(glbArtifact.filePath) ??
    stringValue(glbArtifact.file_path) ??
    stringValue(glbArtifact.path);
  if (filePath) {
    return await readFile(filePath);
  }

  throw new SkpDerivativeError(
    502,
    "skp_adapter_missing_artifact_bytes",
    "Prengine SKP adapter must return contentBase64, url/objectUri, or filePath for the GLB artifact",
    { artifact: glbArtifact },
  );
}

async function extractIfcBytes(
  endpoint: string,
  response: Record<string, unknown>,
): Promise<Buffer> {
  const artifacts = Array.isArray(response.artifacts)
    ? response.artifacts.filter(isRecord)
    : [response];
  const ifcArtifact =
    artifacts.find(isIfcArtifactCandidate) ??
    artifacts.find((artifact) => typeof artifact.contentBase64 === "string");
  if (!ifcArtifact) {
    throw new SkpDerivativeError(
      502,
      "skp_adapter_missing_ifc",
      "Prengine SKP adapter did not return an IFC artifact",
      { response },
    );
  }

  const contentBase64 = ifcArtifact.contentBase64;
  if (typeof contentBase64 === "string") {
    return Buffer.from(contentBase64, "base64");
  }

  const uri =
    stringValue(ifcArtifact.url) ??
    stringValue(ifcArtifact.objectUri) ??
    stringValue(ifcArtifact.object_uri);
  if (uri) {
    const artifactUrl = new URL(uri, endpoint).toString();
    const artifactResponse = await fetch(artifactUrl);
    if (!artifactResponse.ok) {
      throw new SkpDerivativeError(
        artifactResponse.status,
        "skp_adapter_artifact_fetch_failed",
        `Cannot fetch SKP IFC artifact from ${artifactUrl}`,
      );
    }
    return Buffer.from(await artifactResponse.arrayBuffer());
  }

  const filePath =
    stringValue(ifcArtifact.filePath) ??
    stringValue(ifcArtifact.file_path) ??
    stringValue(ifcArtifact.path);
  if (filePath) {
    return await readFile(filePath);
  }

  throw new SkpDerivativeError(
    502,
    "skp_adapter_missing_artifact_bytes",
    "Prengine SKP adapter must return contentBase64, url/objectUri, or filePath for the IFC artifact",
    { artifact: ifcArtifact },
  );
}

function isGlbArtifactCandidate(artifact: Record<string, unknown>): boolean {
  const mediaType =
    stringValue(artifact.mediaType) ?? stringValue(artifact.media_type);
  const name = stringValue(artifact.name);
  const role = stringValue(artifact.role);
  return Boolean(
    mediaType?.includes("gltf-binary") ||
    mediaType?.includes("model/gltf") ||
    name?.toLowerCase().endsWith(".glb") ||
    role?.toLowerCase().includes("glb"),
  );
}

function isIfcArtifactCandidate(artifact: Record<string, unknown>): boolean {
  const mediaType =
    stringValue(artifact.mediaType) ?? stringValue(artifact.media_type);
  const name = stringValue(artifact.name);
  const role = stringValue(artifact.role);
  return Boolean(
    mediaType?.includes("application/p21") ||
    mediaType?.includes("application/x-step") ||
    mediaType?.includes("model/ifc") ||
    name?.toLowerCase().endsWith(".ifc") ||
    role?.toLowerCase().includes("ifc"),
  );
}

function licensedSkpAdapterEndpoint(): string | null {
  const baseUrl =
    process.env.SKETCHUP_ADAPTER_URL?.trim() ||
    process.env.LICENSED_BIM_ADAPTER_URL?.trim();
  if (!baseUrl) return null;
  const adapterPath =
    process.env.SKETCHUP_ADAPTER_PATH?.trim() || "/v1/convert";
  return new URL(
    adapterPath,
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  ).toString();
}

function skpIfcCommandAdapterConfig(): SkpCommandAdapterConfig | null {
  const configuredCommand =
    process.env.PRENGINE_SKP_TO_IFC_COMMAND?.trim() ||
    process.env.SKP_TO_IFC_COMMAND?.trim() ||
    process.env.SKETCHUP_TO_IFC_COMMAND?.trim();
  if (configuredCommand) {
    return {
      command: configuredCommand,
      args: parseSkpCommandArgs(
        process.env.PRENGINE_SKP_TO_IFC_ARGS ??
          process.env.SKP_TO_IFC_ARGS ??
          process.env.SKETCHUP_TO_IFC_ARGS,
        "PRENGINE_SKP_TO_IFC_ARGS",
      ),
      source: "configured",
    };
  }

  const candidates: Array<{
    command: string | undefined;
    args: string[];
  }> = [
    {
      command: process.env.SKP2IFC_BIN,
      args: ["{source}", "{output}"],
    },
    {
      command: process.env.SKP_TO_IFC_BIN,
      args: ["{source}", "{output}"],
    },
    {
      command: process.env.SKETCHUP_TO_IFC_BIN,
      args: ["--input", "{source}", "--output", "{output}"],
    },
    {
      command: "prengine-skp-to-ifc",
      args: ["{source}", "{output}"],
    },
    {
      command: "sketchup-ruby-export-ifc",
      args: ["--input", "{source}", "--output", "{output}"],
    },
    {
      command: "sketchup-ifc-manager-export",
      args: ["--input", "{source}", "--output", "{output}"],
    },
    {
      command: "skp2ifc",
      args: ["{source}", "{output}"],
    },
    {
      command: "skp-to-ifc",
      args: ["{source}", "{output}"],
    },
    {
      command: "sketchup-to-ifc",
      args: ["--input", "{source}", "--output", "{output}"],
    },
    {
      command: "sketchup2ifc",
      args: ["{source}", "{output}"],
    },
  ];

  for (const candidate of candidates) {
    const command = resolveExecutableSync([candidate.command]);
    if (!command) continue;
    return {
      command,
      args: candidate.args,
      source: "common-command",
    };
  }
  return null;
}

function skpCommandAdapterConfig(): SkpCommandAdapterConfig | null {
  const command =
    process.env.PRENGINE_SKP_CONVERTER_COMMAND?.trim() ||
    process.env.SKP_CONVERTER_COMMAND?.trim();
  if (!command) return null;
  return {
    command,
    args: parseSkpCommandArgs(
      process.env.PRENGINE_SKP_CONVERTER_ARGS ?? process.env.SKP_CONVERTER_ARGS,
      "PRENGINE_SKP_CONVERTER_ARGS",
    ),
    source: "configured",
  };
}

function openSourceSkpCommandAdapterConfig(): SkpCommandAdapterConfig | null {
  const command = resolveExecutableSync([
    process.env.ASSIMP_BIN,
    "/usr/bin/assimp",
    "/usr/local/bin/assimp",
    "assimp",
  ]);
  if (!command) return null;
  if (!assimpSupportsSkp(command)) return null;
  return {
    command,
    args: ["export", "{source}", "{output}"],
    source: "assimp",
  };
}

function commonSkpGlbCommandAdapterConfig(): SkpCommandAdapterConfig | null {
  const candidates: Array<{
    command: string | undefined;
    args: string[];
  }> = [
    {
      command: process.env.SKP2GLB_BIN,
      args: ["{source}", "{output}"],
    },
    {
      command: process.env.SKP_TO_GLB_BIN,
      args: ["{source}", "{output}"],
    },
    {
      command: process.env.SKETCHUP_TO_GLTF_BIN,
      args: ["--input", "{source}", "--output", "{output}"],
    },
    {
      command: "prengine-skp-to-glb",
      args: ["{source}", "{output}"],
    },
    {
      command: "sketchup-ruby-export-glb",
      args: ["--input", "{source}", "--output", "{output}"],
    },
    {
      command: "yulio-skp-to-glb",
      args: ["--input", "{source}", "--output", "{output}"],
    },
    {
      command: "skp2glb",
      args: ["{source}", "{output}"],
    },
    {
      command: "skp-to-glb",
      args: ["{source}", "{output}"],
    },
    {
      command: "skp2gltf",
      args: ["{source}", "{output}"],
    },
    {
      command: "sketchup-to-gltf",
      args: ["--input", "{source}", "--output", "{output}"],
    },
    {
      command: "sketchup2gltf",
      args: ["{source}", "{output}"],
    },
  ];

  for (const candidate of candidates) {
    const command = resolveExecutableSync([candidate.command]);
    if (!command) continue;
    return {
      command,
      args: candidate.args,
      source: "common-command",
    };
  }
  return null;
}

function assimpSupportsSkp(command: string): boolean {
  const result = spawnSync(command, ["knowext", "skp"], {
    encoding: "utf8",
    timeout: 10_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0;
}

function resolveExecutableSync(
  candidates: Array<string | undefined>,
): string | null {
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    if (candidate.includes("/")) {
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        continue;
      }
    }
    for (const directory of (process.env.PATH ?? "").split(":")) {
      if (!directory) continue;
      const executable = join(directory, candidate);
      try {
        accessSync(executable, constants.X_OK);
        return executable;
      } catch {
        // Try next PATH entry.
      }
    }
  }
  return null;
}

function parseSkpCommandArgs(
  raw: string | undefined,
  envName: string,
): string[] {
  if (!raw?.trim()) return ["{source}", "{output}"];
  const parsed = JSON.parse(raw) as unknown;
  if (
    !Array.isArray(parsed) ||
    !parsed.every((item) => typeof item === "string")
  ) {
    throw new SkpDerivativeError(
      500,
      "skp_command_adapter_args_invalid",
      `${envName} must be a JSON string array`,
      { value: raw },
    );
  }
  return parsed;
}

function skpCommandArgs(
  adapter: SkpCommandAdapterConfig,
  metadata: LocalFileMetadata,
  outputPath: string,
): string[] {
  const sourcePath = resolveLocalUploadStoragePath(metadata);
  const replacements: Record<string, string> = {
    source: sourcePath,
    input: sourcePath,
    output: outputPath,
    fileId: metadata.fileId,
    fileName: metadata.originalName,
    checksum: metadata.checksum,
  };
  return adapter.args.map((arg) =>
    Object.entries(replacements).reduce(
      (value, [key, replacement]) => value.replaceAll(`{${key}}`, replacement),
      arg,
    ),
  );
}

async function runProcess(
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs: number },
): Promise<ProcessResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new SkpDerivativeError(
          504,
          "skp_command_adapter_timeout",
          "Prengine SKP command adapter timed out",
          { command, timeoutMs: options.timeoutMs },
        ),
      );
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(
        new SkpDerivativeError(
          503,
          "skp_command_adapter_spawn_failed",
          `Cannot start Prengine SKP command adapter: ${error.message}`,
          { command, args },
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
        new SkpDerivativeError(
          502,
          "skp_command_adapter_failed",
          `Prengine SKP command adapter exited with code ${code ?? "unknown"}`,
          {
            command,
            code,
            stdout: trimProcessOutput(result.stdout),
            stderr: trimProcessOutput(result.stderr),
          },
        ),
      );
    });
  });
}

function skpDerivativeCacheDir(metadata: LocalFileMetadata): string {
  return join(
    getLocalUploadsDir(),
    "derivatives",
    "skp",
    skpDerivativeRuntimeVersion,
    metadata.checksum.slice(0, 16),
  );
}

function skpDerivativeSearchDirs(metadata: LocalFileMetadata): string[] {
  const root = getLocalUploadsDir();
  const checksum16 = metadata.checksum.slice(0, 16);
  return [
    skpDerivativeCacheDir(metadata),
    join(root, "derivatives", "skp", metadata.fileId),
    join(root, "derivatives", "skp", metadata.checksum),
    join(root, "derivatives", "skp", checksum16),
    join(root, "derivatives", "glb", metadata.checksum),
    join(root, "derivatives", "glb", checksum16),
    join(root, "derivatives", metadata.fileId, checksum16, "glb"),
    join(root, "derivatives", metadata.fileId, metadata.checksum, "glb"),
    join(root, "derivatives", metadata.fileId, checksum16),
    join(root, "derivatives", metadata.fileId, metadata.checksum),
    join(root, "derivatives", metadata.checksum),
    join(root, "derivatives", checksum16),
    join(root, ".derivatives", "skp", metadata.fileId),
    join(root, ".derivatives", "skp", metadata.checksum),
    join(root, ".derivatives", "skp", checksum16),
    join(root, ".derivatives", "glb", metadata.checksum),
    join(root, ".derivatives", "glb", checksum16),
    join(root, ".derivatives", metadata.checksum),
    join(root, ".derivatives", checksum16),
  ];
}

function cachedSkpGlbPath(metadata: LocalFileMetadata): string {
  return join(skpDerivativeCacheDir(metadata), `${safeSkpStem(metadata)}.glb`);
}

function cachedSkpIfcPath(metadata: LocalFileMetadata): string {
  return join(skpDerivativeCacheDir(metadata), `${safeSkpStem(metadata)}.ifc`);
}

function skpDerivativeCacheKey(
  metadata: LocalFileMetadata,
  suffix: string,
): string {
  return `${metadata.checksum}:${suffix}`;
}

function skpDerivativeEtag(
  metadata: LocalFileMetadata,
  suffix: string,
): string {
  return `sha256-${metadata.checksum}-${suffix}`;
}

function safeSkpStem(metadata: LocalFileMetadata): string {
  return (
    fileNameStem(metadata.originalName)
      .replace(/[^\p{L}\p{N}._-]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96) || metadata.fileId
  );
}

function fileNameStem(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function normalizedFileStem(name: string): string {
  return fileNameStem(name).trim().toLowerCase();
}

function skpDerivativeReadyNotes(derivative: SkpGlbDerivative): string[] {
  if (derivative.source === "glb-fallback") {
    return [
      "SKP 未能直接解析时，使用已存在的真实 GLB 派生作为最后兜底；源 SKP 仍是记录真源。",
      "GLB 兜底只接受同名、同模块或显式绑定的真实 GLB，不显示字节预览或伪模型。",
    ];
  }
  if (derivative.source === "cache") {
    return [
      "SKP 使用已生成的真实 GLB 派生缓存；源 SKP 仍是记录真源。",
      "前端只显示真实模型派生，不显示字节预览或伪模型。",
    ];
  }
  return [
    "SKP 通过真实 SKP 转 GLB 命令或 Prengine 授权适配器生成模型派生；源 SKP 仍是记录真源。",
    "前端只显示适配器返回的真实模型，不显示字节预览或伪模型；推荐 sidecar 为 SketchUp Ruby Model#export GLB、Yulio glTF exporter 或 Speckle SketchUp 派生服务。",
  ];
}

function skpIfcDerivativeReadyNotes(derivative: SkpIfcDerivative): string[] {
  if (derivative.source === "cache") {
    return [
      "SKP 使用已生成的真实 IFC 派生缓存走 IFC 原生查看；源 SKP 仍是记录真源。",
      "IFC 派生只接受真实 ISO-10303-21 文件，不用 GLB 或源包目录冒充 OpenBIM 交换结果。",
    ];
  }
  return [
    "SKP 通过真实 SketchUp Ruby/IFC Manager/Speckle sidecar 生成 OpenBIM 派生，并走 IFC 原生查看；源 SKP 仍是记录真源。",
    "该路径不使用 GLB、字节预览或伪几何替代 SKP->IFC 转换结果。",
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function trimProcessOutput(value: Buffer): string {
  return value.toString("utf8").replace(/\s+/g, " ").trim().slice(0, 4000);
}
