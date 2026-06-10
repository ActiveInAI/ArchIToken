// lib/three-dm-derivative-server.ts - Licensed 3DM to IFC derivative runtime
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
import { basename, extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  getLocalFileMetadata,
  getLocalUploadsDir,
  resolveLocalUploadStoragePath,
} from "./local-file-runtime-server";
import { adapterSourceById } from "./adapter-source-registry";
import type { LocalFileMetadata } from "./local-file-runtime";

export type ThreeDmDerivativeFormat = "manifest" | "ifc";

export interface ThreeDmDerivativeAdapterProbe {
  id: string;
  label: string;
  priority: number;
  status: "available" | "missing";
  licenseBoundary: "external_licensed_adapter" | "open_source_process";
  sourceUrl: string;
  installHint: string;
  endpoint?: string;
  command?: string;
}

export interface ThreeDmOpenBimAppearancePolicy {
  schema: "architoken.openbim_appearance_policy.v1";
  version: string;
  ifcSchema: "IFC4";
  presentationStyleSources: string[];
  unstyledGeometry: string;
  syntheticMaterialColors: false;
}

export interface ThreeDmDerivativeArtifact {
  kind: "3dm-ifc";
  url: string;
  mediaType: "application/p21";
  engine: "PanAEC Engine";
  etag: string;
  cacheHit: boolean;
  cacheKey: string;
  appearancePolicy: ThreeDmOpenBimAppearancePolicy;
  size?: number;
}

export interface ThreeDmDerivativeManifest {
  schema: "architoken.3dm_derivative_manifest.v1";
  fileId: string;
  originalName: string;
  sourceFormat: "3dm";
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
  appearancePolicy: ThreeDmOpenBimAppearancePolicy;
  viewer: "panaec_3dm_ifc_model" | "licensed_adapter_required";
  engine: "PanAEC Engine";
  ifcArtifact?: ThreeDmDerivativeArtifact;
  adapters: ThreeDmDerivativeAdapterProbe[];
  permissions: {
    canView: boolean;
    canWriteDerivative: boolean;
    requiresLicensedAdapter: boolean;
  };
  notes: string[];
}

export interface ThreeDmDerivativeBytes {
  bytes: Buffer;
  mediaType: "application/p21";
  fileName: string;
  engine: "PanAEC Engine";
  etag: string;
  cacheHit: boolean;
}

export class ThreeDmDerivativeError extends Error {
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
    this.name = "ThreeDmDerivativeError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ThreeDmIfcDerivative {
  path: string;
  size: number;
  cacheHit: boolean;
  source: "cache" | "command" | "adapter";
}

interface ThreeDmCommandAdapterConfig {
  command: string;
  args: string[];
  source: "configured" | "repo-worker" | "common-command";
}

interface ProcessResult {
  stdout: Buffer;
  stderr: Buffer;
}

const threeDmAdapterTimeoutMs = 900_000;
const threeDmCommandTimeoutMs = 3_600_000;
const threeDmDerivativeRuntimeVersion = "v4-openbim-presentation-ifc";
const threeDmOpenBimAppearancePolicy: ThreeDmOpenBimAppearancePolicy = {
  schema: "architoken.openbim_appearance_policy.v1",
  version: threeDmDerivativeRuntimeVersion,
  ifcSchema: "IFC4",
  presentationStyleSources: [
    "IfcStyledItem -> IfcSurfaceStyle",
    "IfcMaterialDefinitionRepresentation -> IfcSurfaceStyle",
  ],
  unstyledGeometry:
    "Do not synthesize material colours; preserve geometry as unassigned presentation appearance.",
  syntheticMaterialColors: false,
};

function adapterSourceUrl(id: string, fallback: string): string {
  return adapterSourceById(id)?.url ?? fallback;
}

export async function buildThreeDmDerivativeManifest(
  fileId: string,
): Promise<ThreeDmDerivativeManifest> {
  const metadata = await requireLocalThreeDmMetadata(fileId);
  const sourceUrl = `/api/local-files/${encodeURIComponent(metadata.fileId)}`;
  const adapters = threeDmAdapterProbes();

  let ifc: ThreeDmIfcDerivative | null = await readCachedThreeDmIfc(metadata);
  let ifcError: Error | null = null;
  if (!ifc) {
    try {
      ifc = await ensureThreeDmIfcDerivative(metadata);
    } catch (error) {
      ifcError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (ifc) {
    const ifcUrl = `${sourceUrl}/3dm-derivative?format=ifc`;
    const etag = threeDmDerivativeEtag(metadata, "3dm-ifc");
    return {
      schema: "architoken.3dm_derivative_manifest.v1",
      fileId: metadata.fileId,
      originalName: metadata.originalName,
      sourceFormat: "3dm",
      sourceChecksum: metadata.checksum,
      sourceOfRecord: {
        url: sourceUrl,
        checksum: metadata.checksum,
        rangeRequests: true,
        substitutePreview: false,
      },
      etag,
      cachePolicy: "stream+etag+checksum",
      cacheKey: threeDmDerivativeCacheKey(metadata, "ifc"),
      appearancePolicy: threeDmOpenBimAppearancePolicy,
      viewer: "panaec_3dm_ifc_model",
      engine: "PanAEC Engine",
      ifcArtifact: {
        kind: "3dm-ifc",
        url: ifcUrl,
        mediaType: "application/p21",
        engine: "PanAEC Engine",
        etag,
        cacheHit: ifc.cacheHit,
        cacheKey: threeDmDerivativeCacheKey(metadata, "ifc"),
        appearancePolicy: threeDmOpenBimAppearancePolicy,
        size: ifc.size,
      },
      adapters,
      permissions: {
        canView: true,
        canWriteDerivative: true,
        requiresLicensedAdapter: true,
      },
      notes: threeDmIfcDerivativeReadyNotes(ifc),
    };
  }

  return {
    schema: "architoken.3dm_derivative_manifest.v1",
    fileId: metadata.fileId,
    originalName: metadata.originalName,
    sourceFormat: "3dm",
    sourceChecksum: metadata.checksum,
    sourceOfRecord: {
      url: sourceUrl,
      checksum: metadata.checksum,
      rangeRequests: true,
      substitutePreview: false,
    },
    etag: threeDmDerivativeEtag(metadata, "adapter-missing"),
    cachePolicy: "stream+etag+checksum",
    cacheKey: threeDmDerivativeCacheKey(metadata, "missing"),
    appearancePolicy: threeDmOpenBimAppearancePolicy,
    viewer: "licensed_adapter_required",
    engine: "PanAEC Engine",
    adapters,
    permissions: {
      canView: false,
      canWriteDerivative: false,
      requiresLicensedAdapter: true,
    },
    notes: [
      "3DM 是 Rhino/OpenNURBS 源格式；当前未接入 PanAEC Engine 3DM->IFC 真实派生适配器，系统不会用浏览器 mesh、显示网格或源包列表合成 IFC。",
      ...(ifcError ? [`3DM 转 IFC 尝试失败: ${ifcError.message}`] : []),
      "可接入 Rhino/Compute sidecar、Speckle IFC Exporter Rhino、OpenNURBS 能力服务或企业转换器；命令路径使用 PANAEC_3DM_TO_IFC_COMMAND，HTTP 路径使用 RHINO_ADAPTER_URL。",
    ],
  };
}

export async function readThreeDmDerivativeBytes(
  fileId: string,
  format: ThreeDmDerivativeFormat,
): Promise<ThreeDmDerivativeBytes> {
  const metadata = await requireLocalThreeDmMetadata(fileId);
  if (format === "ifc") {
    const derivative = await ensureThreeDmIfcDerivative(metadata);
    return {
      bytes: await readFile(derivative.path),
      mediaType: "application/p21",
      fileName: `${safeThreeDmStem(metadata)}.ifc`,
      engine: "PanAEC Engine",
      etag: threeDmDerivativeEtag(metadata, "3dm-ifc"),
      cacheHit: derivative.cacheHit,
    };
  }
  throw new ThreeDmDerivativeError(
    415,
    "unsupported_3dm_derivative_request",
    `Cannot serve ${format} derivative for 3DM`,
    { requestedFormat: format },
  );
}

function threeDmAdapterProbes(): ThreeDmDerivativeAdapterProbe[] {
  const endpoint = licensedThreeDmAdapterEndpoint();
  const command = threeDmIfcCommandAdapterConfig();
  const commandIsRepositoryWorker = command?.source === "repo-worker";
  return [
    {
      id: "rhino-model-export-ifc",
      label: "Rhino / Compute IFC export sidecar",
      priority: 1,
      status: endpoint ? "available" : "missing",
      licenseBoundary: "external_licensed_adapter",
      sourceUrl: adapterSourceUrl("mcneel", "https://github.com/mcneel"),
      installHint:
        "在用户授权的 Rhino/Rhino Compute/企业转换环境中打开 3DM，并导出真实 IFC；通过 PANAEC_3DM_TO_IFC_COMMAND 或 RHINO_ADAPTER_URL 暴露给 ArchIToken。",
      ...(endpoint ? { endpoint } : {}),
    },
    {
      id: "speckle-ifc-exporter-rhino",
      label: "Speckle IFC Exporter Rhino sidecar",
      priority: 2,
      status: endpoint ? "available" : "missing",
      licenseBoundary: "external_licensed_adapter",
      sourceUrl: adapterSourceUrl(
        "speckle-ifc-exporter-rhino",
        "https://github.com/specklesystems/IFC-Exporter-Rhino",
      ),
      installHint:
        "Speckle IFC Exporter Rhino 必须运行在独立 Rhino sidecar 或 HTTP 服务中，输出真实 IFC artifact；不得把显示 mesh 当成 IFC。",
      ...(endpoint ? { endpoint } : {}),
    },
    {
      id: "panaec-3dm-ifc-command-adapter",
      label: commandIsRepositoryWorker
        ? "PanAEC Engine rhino3dm/OpenNURBS IFC worker"
        : "PanAEC Engine 3DM to IFC command adapter",
      priority: 3,
      status: command ? "available" : "missing",
      licenseBoundary: commandIsRepositoryWorker
        ? "open_source_process"
        : "external_licensed_adapter",
      sourceUrl: "local-command-path",
      installHint: commandIsRepositoryWorker
        ? "使用仓库内置 rhino3dm/OpenNURBS + IfcOpenShell worker 读取 3DM 源几何并输出 IFC4；该路径只声明几何交换，不声明专业构件语义。"
        : "配置 PANAEC_3DM_TO_IFC_COMMAND 和 PANAEC_3DM_TO_IFC_ARGS 后，可调用本机、远程或授权 Rhino/OpenNURBS/Speckle 环境中的真实 3DM 转 IFC 命令。",
      ...(command ? { command: command.command } : {}),
    },
    {
      id: "rhino3dm-opennurbs-source-reader",
      label: "rhino3dm / OpenNURBS / IfcOpenShell geometry sidecar",
      priority: 4,
      status: command || endpoint ? "available" : "missing",
      licenseBoundary: "open_source_process",
      sourceUrl: adapterSourceUrl(
        "rhino3dm",
        "https://github.com/mcneel/rhino3dm",
      ),
      installHint:
        "rhino3dm/OpenNURBS 读取 3DM 源几何，IfcOpenShell 输出真实 ISO-10303-21 IFC 几何交换文件；该路径不声明 Rhino/Speckle 专业构件语义映射。",
      ...(command ? { command: command.command } : {}),
      ...(endpoint ? { endpoint } : {}),
    },
    {
      id: "panaec-rhino-adapter",
      label: "PanAEC Engine Rhino licensed adapter",
      priority: 10,
      status: endpoint ? "available" : "missing",
      licenseBoundary: "external_licensed_adapter",
      sourceUrl: adapterSourceUrl(
        "opennurbs",
        "https://github.com/mcneel/opennurbs",
      ),
      installHint:
        "接入 PanAEC Engine Rhino sidecar、Rhino Compute、Speckle Rhino 或企业转换服务后，可生成 3DM 真实 IFC、属性清单和对象映射。",
      ...(endpoint ? { endpoint } : {}),
    },
  ];
}

async function requireLocalThreeDmMetadata(
  fileId: string,
): Promise<LocalFileMetadata> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new ThreeDmDerivativeError(404, "file_not_found", "file not found", {
      fileId,
    });
  }
  if (metadata.ext.toLowerCase() !== ".3dm") {
    throw new ThreeDmDerivativeError(
      415,
      "unsupported_3dm_derivative_format",
      `Unsupported 3DM derivative format: ${metadata.ext || metadata.mimeType}`,
      { extension: metadata.ext, mimeType: metadata.mimeType },
    );
  }
  return metadata;
}

async function ensureThreeDmIfcDerivative(
  metadata: LocalFileMetadata,
): Promise<ThreeDmIfcDerivative> {
  const cached = await readCachedThreeDmIfc(metadata);
  if (cached) return cached;

  const adapter = threeDmIfcCommandAdapterConfig();
  const endpoint = licensedThreeDmAdapterEndpoint();
  if (!adapter && !endpoint) {
    throw new ThreeDmDerivativeError(
      503,
      "3dm_ifc_adapter_not_configured",
      "3DM->IFC 需要真实 Rhino/OpenNURBS/Speckle sidecar；当前未配置命令或 HTTP 适配器。",
      {
        requiredEnv: [
          "PANAEC_3DM_TO_IFC_COMMAND",
          "PANAEC_3DM_TO_IFC_ARGS",
          "RHINO_3DM_TO_IFC_COMMAND",
          "RHINO_3DM_TO_IFC_ARGS",
          "THREEDM2IFC_BIN",
          "THREEDM_TO_IFC_BIN",
          "RHINO_TO_IFC_BIN",
          "RHINO_ADAPTER_URL",
          "LICENSED_BIM_ADAPTER_URL",
        ],
      },
    );
  }

  const errors: Error[] = [];
  if (adapter) {
    try {
      return await runThreeDmIfcCommandAdapter(metadata, adapter);
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }
  if (endpoint) {
    try {
      return await runThreeDmHttpIfcAdapter(metadata, endpoint);
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  throw new ThreeDmDerivativeError(
    502,
    "3dm_ifc_pipeline_failed",
    `3DM 转 IFC 真实派生失败: ${errors
      .map((error) => error.message)
      .join("；")}`,
    { failures: errors.map((error) => error.message) },
  );
}

async function runThreeDmHttpIfcAdapter(
  metadata: LocalFileMetadata,
  endpoint: string,
): Promise<ThreeDmIfcDerivative> {
  const payload = {
    jobId: `3dm-ifc-${metadata.fileId}`,
    operation: "licensed_bim_convert",
    sourcePath: resolveLocalUploadStoragePath(metadata),
    sourceFileName: metadata.originalName,
    sourceFormat: "3dm",
    sourceChecksum: metadata.checksum,
    targetFormat: "ifc",
    targetSchema: threeDmOpenBimAppearancePolicy.ifcSchema,
    outputFormats: ["ifc", "properties-index"],
    appearancePolicy: threeDmOpenBimAppearancePolicy,
  };
  const response = await postThreeDmAdapterJson(endpoint, payload);
  const ifcBytes = await extractIfcBytes(endpoint, response);
  const target = cachedThreeDmIfcPath(metadata);
  await mkdir(threeDmDerivativeCacheDir(metadata), { recursive: true });
  await writeFile(target, ifcBytes);
  const written = await stat(target);
  if (!(await isReadableIfc(target))) {
    throw new ThreeDmDerivativeError(
      502,
      "3dm_adapter_invalid_ifc",
      "PanAEC Engine 3DM adapter returned bytes that are not a valid IFC artifact",
    );
  }
  return {
    path: target,
    size: written.size,
    cacheHit: false,
    source: "adapter",
  };
}

async function runThreeDmIfcCommandAdapter(
  metadata: LocalFileMetadata,
  adapter: ThreeDmCommandAdapterConfig,
): Promise<ThreeDmIfcDerivative> {
  const workDir = await mkdtemp(join(tmpdir(), "architoken-3dm-ifc-"));
  const outputPath = join(workDir, `${metadata.fileId}.ifc`);
  try {
    const args = threeDmCommandArgs(adapter, metadata, outputPath);
    const result = await runProcess(adapter.command, args, {
      cwd: workDir,
      timeoutMs: threeDmCommandTimeoutMs,
    });
    const output = await stat(outputPath).catch(() => null);
    if (
      !output?.isFile() ||
      output.size <= 0 ||
      !(await isReadableIfc(outputPath))
    ) {
      throw new ThreeDmDerivativeError(
        502,
        "3dm_ifc_command_adapter_missing_ifc",
        "PanAEC Engine 3DM->IFC command adapter completed without a valid IFC artifact",
        {
          command: adapter.command,
          stdout: trimProcessOutput(result.stdout),
          stderr: trimProcessOutput(result.stderr),
        },
      );
    }

    const target = cachedThreeDmIfcPath(metadata);
    await mkdir(threeDmDerivativeCacheDir(metadata), { recursive: true });
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

async function readCachedThreeDmIfc(
  metadata: LocalFileMetadata,
): Promise<ThreeDmIfcDerivative | null> {
  const paths = [
    cachedThreeDmIfcPath(metadata),
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

async function derivativeIfcCandidates(
  metadata: LocalFileMetadata,
): Promise<string[]> {
  const candidates: string[] = [];
  for (const directory of [
    ...threeDmDerivativeSearchDirs(metadata),
    ...(await sharedThreeDmChecksumDerivativeDirs(metadata)),
  ]) {
    candidates.push(...(await collectIfcFiles(directory, 3)));
  }
  return candidates;
}

async function sharedThreeDmChecksumDerivativeDirs(
  metadata: LocalFileMetadata,
): Promise<string[]> {
  const root = join(getLocalUploadsDir(), "derivatives");
  const checksum16 = metadata.checksum.slice(0, 16);
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== metadata.fileId)
    .flatMap((entry) => [
      join(root, entry.name, checksum16, "ifc"),
      join(root, entry.name, metadata.checksum, "ifc"),
    ]);
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

async function postThreeDmAdapterJson(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), threeDmAdapterTimeoutMs);
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
      throw new ThreeDmDerivativeError(
        response.status,
        "3dm_adapter_failed",
        `PanAEC Engine 3DM adapter returned HTTP ${response.status}`,
        { responseText: await response.text() },
      );
    }
    const data = (await response.json()) as unknown;
    if (!isRecord(data)) {
      throw new ThreeDmDerivativeError(
        502,
        "3dm_adapter_invalid_response",
        "PanAEC Engine 3DM adapter response must be a JSON object",
      );
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
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
    throw new ThreeDmDerivativeError(
      502,
      "3dm_adapter_missing_ifc",
      "PanAEC Engine 3DM adapter did not return an IFC artifact",
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
      throw new ThreeDmDerivativeError(
        artifactResponse.status,
        "3dm_adapter_artifact_fetch_failed",
        `Cannot fetch 3DM IFC artifact from ${artifactUrl}`,
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

  throw new ThreeDmDerivativeError(
    502,
    "3dm_adapter_missing_artifact_bytes",
    "PanAEC Engine 3DM adapter must return contentBase64, url/objectUri, or filePath for the IFC artifact",
    { artifact: ifcArtifact },
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

function licensedThreeDmAdapterEndpoint(): string | null {
  const baseUrl =
    process.env.RHINO_ADAPTER_URL?.trim() ||
    process.env.SPECKLE_RHINO_ADAPTER_URL?.trim() ||
    process.env.LICENSED_BIM_ADAPTER_URL?.trim();
  if (!baseUrl) return null;
  const adapterPath = process.env.RHINO_ADAPTER_PATH?.trim() || "/v1/convert";
  return new URL(
    adapterPath,
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  ).toString();
}

function threeDmIfcCommandAdapterConfig(): ThreeDmCommandAdapterConfig | null {
  const configuredCommand =
    process.env.PANAEC_3DM_TO_IFC_COMMAND?.trim() ||
    process.env.RHINO_3DM_TO_IFC_COMMAND?.trim() ||
    process.env.THREEDM_TO_IFC_COMMAND?.trim() ||
    process.env.RHINO_TO_IFC_COMMAND?.trim();
  if (configuredCommand) {
    return {
      command: configuredCommand,
      args: parseThreeDmCommandArgs(
        process.env.PANAEC_3DM_TO_IFC_ARGS ??
          process.env.RHINO_3DM_TO_IFC_ARGS ??
          process.env.THREEDM_TO_IFC_ARGS ??
          process.env.RHINO_TO_IFC_ARGS,
        "PANAEC_3DM_TO_IFC_ARGS",
      ),
      source: isRepositoryThreeDmIfcCommand(configuredCommand)
        ? "repo-worker"
        : "configured",
    };
  }

  const candidates: Array<{
    command: string | undefined;
    args: string[];
    source?: ThreeDmCommandAdapterConfig["source"];
  }> = [
    ...repositoryThreeDmIfcCommandCandidates().map((command) => ({
      command,
      args: ["--input", "{source}", "--output", "{output}"],
      source: "repo-worker" as const,
    })),
    {
      command: process.env.THREEDM2IFC_BIN,
      args: ["{source}", "{output}"],
    },
    {
      command: process.env.THREEDM_TO_IFC_BIN,
      args: ["{source}", "{output}"],
    },
    {
      command: process.env.RHINO_TO_IFC_BIN,
      args: ["--input", "{source}", "--output", "{output}"],
    },
    {
      command: process.env.RHINO_COMPUTE_EXPORT_IFC_BIN,
      args: ["--input", "{source}", "--output", "{output}"],
    },
    {
      command: "panaec-3dm-to-ifc",
      args: ["{source}", "{output}"],
    },
    {
      command: "rhino-3dm-to-ifc",
      args: ["--input", "{source}", "--output", "{output}"],
    },
    {
      command: "rhino-compute-export-ifc",
      args: ["--input", "{source}", "--output", "{output}"],
    },
    {
      command: "rhino-to-ifc",
      args: ["--input", "{source}", "--output", "{output}"],
    },
    {
      command: "3dm-to-ifc",
      args: ["{source}", "{output}"],
    },
    {
      command: "3dm2ifc",
      args: ["{source}", "{output}"],
    },
  ];

  for (const candidate of candidates) {
    const command = resolveExecutableSync([candidate.command]);
    if (!command) continue;
    return {
      command,
      args: candidate.args,
      source: candidate.source ?? "common-command",
    };
  }
  return null;
}

function repositoryThreeDmIfcCommandCandidates(
  options: { ignoreDisabled?: boolean } = {},
): string[] {
  if (
    !options.ignoreDisabled &&
    process.env.ARCHITOKEN_DISABLE_REPO_3DM_IFC_WORKER === "1"
  ) {
    return [];
  }
  const cwd = process.cwd();
  return [
    join(cwd, "06-workers", "scripts", "panaec-3dm-to-ifc"),
    join(cwd, "..", "06-workers", "scripts", "panaec-3dm-to-ifc"),
  ];
}

function isRepositoryThreeDmIfcCommand(command: string): boolean {
  const normalizedCommand = resolve(command);
  return repositoryThreeDmIfcCommandCandidates({ ignoreDisabled: true }).some(
    (candidate) => resolve(candidate) === normalizedCommand,
  );
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

function parseThreeDmCommandArgs(
  raw: string | undefined,
  envName: string,
): string[] {
  if (!raw?.trim()) return ["{source}", "{output}"];
  const parsed = JSON.parse(raw) as unknown;
  if (
    !Array.isArray(parsed) ||
    !parsed.every((item) => typeof item === "string")
  ) {
    throw new ThreeDmDerivativeError(
      500,
      "3dm_command_adapter_args_invalid",
      `${envName} must be a JSON string array`,
      { value: raw },
    );
  }
  return parsed;
}

function threeDmCommandArgs(
  adapter: ThreeDmCommandAdapterConfig,
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
    runtimeVersion: threeDmDerivativeRuntimeVersion,
    appearancePolicyVersion: threeDmOpenBimAppearancePolicy.version,
    appearancePolicy: JSON.stringify(threeDmOpenBimAppearancePolicy),
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
        new ThreeDmDerivativeError(
          504,
          "3dm_command_adapter_timeout",
          "PanAEC Engine 3DM command adapter timed out",
          { command, timeoutMs: options.timeoutMs },
        ),
      );
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(
        new ThreeDmDerivativeError(
          503,
          "3dm_command_adapter_spawn_failed",
          `Cannot start PanAEC Engine 3DM command adapter: ${error.message}`,
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
        new ThreeDmDerivativeError(
          502,
          "3dm_command_adapter_failed",
          `PanAEC Engine 3DM command adapter exited with code ${code ?? "unknown"}`,
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

function threeDmDerivativeCacheDir(metadata: LocalFileMetadata): string {
  return join(
    getLocalUploadsDir(),
    "derivatives",
    "3dm",
    threeDmDerivativeRuntimeVersion,
    metadata.checksum.slice(0, 16),
  );
}

function threeDmDerivativeSearchDirs(metadata: LocalFileMetadata): string[] {
  const root = getLocalUploadsDir();
  const checksum16 = metadata.checksum.slice(0, 16);
  return [
    threeDmDerivativeCacheDir(metadata),
    join(root, "derivatives", "3dm", metadata.fileId),
    join(root, "derivatives", "3dm", metadata.checksum),
    join(root, "derivatives", "3dm", checksum16),
    join(root, "derivatives", "ifc", metadata.checksum),
    join(root, "derivatives", "ifc", checksum16),
    join(root, "derivatives", metadata.fileId, checksum16, "ifc"),
    join(root, "derivatives", metadata.fileId, metadata.checksum, "ifc"),
    join(root, "derivatives", metadata.fileId, checksum16),
    join(root, "derivatives", metadata.fileId, metadata.checksum),
    join(root, "derivatives", metadata.checksum),
    join(root, "derivatives", checksum16),
    join(root, ".derivatives", "3dm", metadata.fileId),
    join(root, ".derivatives", "3dm", metadata.checksum),
    join(root, ".derivatives", "3dm", checksum16),
    join(root, ".derivatives", "ifc", metadata.checksum),
    join(root, ".derivatives", "ifc", checksum16),
    join(root, ".derivatives", metadata.checksum),
    join(root, ".derivatives", checksum16),
  ];
}

function cachedThreeDmIfcPath(metadata: LocalFileMetadata): string {
  return join(
    threeDmDerivativeCacheDir(metadata),
    `${safeThreeDmStem(metadata)}.ifc`,
  );
}

function threeDmDerivativeCacheKey(
  metadata: LocalFileMetadata,
  suffix: string,
): string {
  return `${metadata.checksum}:${threeDmDerivativeRuntimeVersion}:${suffix}`;
}

function threeDmDerivativeEtag(
  metadata: LocalFileMetadata,
  suffix: string,
): string {
  return `sha256-${metadata.checksum}-${threeDmDerivativeRuntimeVersion}-${suffix}`;
}

function safeThreeDmStem(metadata: LocalFileMetadata): string {
  return (
    fileNameStem(metadata.originalName)
      .replace(/[^\p{L}\p{N}._-]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96) || metadata.fileId
  );
}

function fileNameStem(name: string): string {
  return basename(name, extname(name));
}

function threeDmIfcDerivativeReadyNotes(
  derivative: ThreeDmIfcDerivative,
): string[] {
  if (derivative.source === "cache") {
    return [
      "3DM 使用已生成的真实 IFC 派生缓存走 IFC 原生查看；源 3DM 仍是记录真源。",
      "IFC 派生只接受真实 ISO-10303-21 文件，不用 Rhino display mesh 或源文件检查视图冒充 OpenBIM 交换结果。",
      "openBIM 表现样式只来自 IfcStyledItem/IfcSurfaceStyle 或 IfcMaterialDefinitionRepresentation；未声明样式的几何不会合成材料颜色。",
    ];
  }
  return [
    "3DM 通过真实 3DM->IFC command/HTTP sidecar 生成 IFC 几何派生，并走 IFC 原生查看；源 3DM 仍是记录真源。",
    "该路径不使用浏览器 mesh、显示网格或伪几何替代 3DM->IFC 转换结果。",
    "openBIM 表现样式只来自 IfcStyledItem/IfcSurfaceStyle 或 IfcMaterialDefinitionRepresentation；未声明样式的几何不会合成材料颜色。",
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
