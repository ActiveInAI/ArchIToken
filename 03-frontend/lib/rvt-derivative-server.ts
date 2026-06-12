// lib/rvt-derivative-server.ts - PanAEC Engine RVT derivative runtime for local uploads
// License: Apache-2.0

import { constants } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  getLocalFileMetadata,
  getLocalUploadsDir,
  resolveLocalUploadStoragePath,
} from "./local-file-runtime-server";
import { singleFlight } from "./single-flight-server";
import type { LocalFileMetadata } from "./local-file-runtime";

export type RvtDerivativeFormat = "manifest" | "dae" | "schedule" | "ifc";

export interface RvtDerivativeAdapterProbe {
  id: string;
  label: string;
  priority: number;
  status: "available" | "missing";
  licenseBoundary: "external_licensed_adapter";
  sourceUrl: string;
  installHint: string;
  executablePath?: string;
}

export interface RvtDerivativeArtifact {
  kind: "rvt-collada" | "rvt-schedule" | "rvt-ifc";
  url: string;
  mediaType:
    | "model/vnd.collada+xml"
    | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    | "application/p21";
  engine: "PanAEC Engine";
  etag: string;
  cacheHit: boolean;
  cacheKey: string;
  size?: number;
}

export interface RvtDerivativeManifest {
  schema: "architoken.rvt_derivative_manifest.v1";
  fileId: string;
  originalName: string;
  sourceFormat: "rvt" | "rfa";
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
  viewer: "panaec_rvt_model" | "adapter_required";
  engine: "PanAEC Engine";
  derivativeArtifact?: RvtDerivativeArtifact;
  scheduleArtifact?: RvtDerivativeArtifact;
  ifcArtifact?: RvtDerivativeArtifact;
  adapters: RvtDerivativeAdapterProbe[];
  permissions: {
    canView: boolean;
    canWriteDerivative: boolean;
    requiresLicensedAdapter: boolean;
  };
  notes: string[];
}

export interface RvtDerivativeBytes {
  bytes: Buffer;
  mediaType: RvtDerivativeArtifact["mediaType"];
  fileName: string;
  engine: "PanAEC Engine";
  etag: string;
  cacheHit: boolean;
}

export class RvtDerivativeError extends Error {
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
    this.name = "RvtDerivativeError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RvtModelDerivative {
  daePath: string;
  schedulePath: string;
  daeSize: number;
  scheduleSize: number;
  cacheHit: boolean;
}

interface RvtIfcDerivative {
  path: string;
  size: number;
  cacheHit: boolean;
}

interface ProcessResult {
  stdout: Buffer;
  stderr: Buffer;
}

const rvtExporterTimeoutMs = 3_600_000;
const rvt2IfcTimeoutMs = 3_600_000;
const rvtDerivativeRuntimeVersion = "v5-source-units-node-identity";
const colladaVisibleFallbackColor: [number, number, number, number] = [
  0.74, 0.78, 0.82, 1,
];
const converterBrowserToolNames = [
  "panaec-no-browser",
  "xdg-open",
  "gio",
  "gnome-open",
  "kde-open",
  "sensible-browser",
  "x-www-browser",
  "www-browser",
  "firefox",
  "google-chrome",
  "chromium",
  "chromium-browser",
] as const;

export async function buildRvtDerivativeManifest(
  fileId: string,
): Promise<RvtDerivativeManifest> {
  const metadata = await requireLocalRvtMetadata(fileId);
  const sourceUrl = `/api/local-files/${encodeURIComponent(metadata.fileId)}`;
  const adapters = await rvtAdapterProbes();

  let derivative: RvtModelDerivative | null = null;
  let derivativeError: RvtDerivativeError | null = null;
  try {
    derivative = await ensureRvtModelDerivative(metadata);
  } catch (error) {
    if (error instanceof RvtDerivativeError) {
      derivativeError = error;
    } else {
      throw error;
    }
  }

  const ifc = derivative ? await readCachedRvtIfc(metadata) : null;
  if (!derivative) {
    return {
      schema: "architoken.rvt_derivative_manifest.v1",
      fileId: metadata.fileId,
      originalName: metadata.originalName,
      sourceFormat: rvtSourceFormat(metadata),
      sourceChecksum: metadata.checksum,
      sourceOfRecord: {
        url: sourceUrl,
        checksum: metadata.checksum,
        rangeRequests: true,
        substitutePreview: false,
      },
      etag: rvtDerivativeEtag(metadata, "adapter-required"),
      cachePolicy: "stream+etag+checksum",
      cacheKey: rvtDerivativeCacheKey(metadata, "missing"),
      viewer: "adapter_required",
      engine: "PanAEC Engine",
      adapters,
      permissions: {
        canView: false,
        canWriteDerivative: false,
        requiresLicensedAdapter: true,
      },
      notes: [
        derivativeError?.message ??
          "RVT/RFA 需要 PanAEC Engine Revit 转换器生成真实模型和属性清单后查看。",
        "系统不会用截图、字节预览或伪模型替代真实 RVT 几何结果。",
      ],
    };
  }

  const daeUrl = `${sourceUrl}/rvt-derivative?format=dae`;
  const scheduleUrl = `${sourceUrl}/rvt-derivative?format=schedule`;
  const ifcUrl = `${sourceUrl}/rvt-derivative?format=ifc`;
  const etag = rvtDerivativeEtag(metadata, "rvt-model");

  return {
    schema: "architoken.rvt_derivative_manifest.v1",
    fileId: metadata.fileId,
    originalName: metadata.originalName,
    sourceFormat: rvtSourceFormat(metadata),
    sourceChecksum: metadata.checksum,
    sourceOfRecord: {
      url: sourceUrl,
      checksum: metadata.checksum,
      rangeRequests: true,
      substitutePreview: false,
    },
    etag,
    cachePolicy: "stream+etag+checksum",
    cacheKey: rvtDerivativeCacheKey(metadata, "model"),
    viewer: "panaec_rvt_model",
    engine: "PanAEC Engine",
    derivativeArtifact: {
      kind: "rvt-collada",
      url: daeUrl,
      mediaType: "model/vnd.collada+xml",
      engine: "PanAEC Engine",
      etag: rvtDerivativeEtag(metadata, "dae"),
      cacheHit: derivative.cacheHit,
      cacheKey: rvtDerivativeCacheKey(metadata, "dae"),
      size: derivative.daeSize,
    },
    scheduleArtifact: {
      kind: "rvt-schedule",
      url: scheduleUrl,
      mediaType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      engine: "PanAEC Engine",
      etag: rvtDerivativeEtag(metadata, "schedule"),
      cacheHit: derivative.cacheHit,
      cacheKey: rvtDerivativeCacheKey(metadata, "schedule"),
      size: derivative.scheduleSize,
    },
    ...(ifc
      ? {
          ifcArtifact: {
            kind: "rvt-ifc" as const,
            url: ifcUrl,
            mediaType: "application/p21" as const,
            engine: "PanAEC Engine" as const,
            etag: rvtDerivativeEtag(metadata, "ifc"),
            cacheHit: ifc.cacheHit,
            cacheKey: rvtDerivativeCacheKey(metadata, "ifc"),
            size: ifc.size,
          },
        }
      : {}),
    adapters,
    permissions: {
      canView: true,
      canWriteDerivative: true,
      requiresLicensedAdapter: true,
    },
    notes: [
      "RVT/RFA 通过 PanAEC Engine Revit 转换器生成真实 Collada 模型和属性清单；源 RVT/RFA 仍是记录真源。",
      "RVT2IFCconverter 可按需生成 IFC 派生，用于 OpenBIM 交换，不作为伪模型替代。",
    ],
  };
}

export async function readRvtDerivativeBytes(
  fileId: string,
  format: RvtDerivativeFormat,
): Promise<RvtDerivativeBytes> {
  const metadata = await requireLocalRvtMetadata(fileId);
  if (format === "dae") {
    const derivative = await ensureRvtModelDerivative(metadata);
    return {
      bytes: await readFile(derivative.daePath),
      mediaType: "model/vnd.collada+xml",
      fileName: `${safeRvtStem(metadata)}.dae`,
      engine: "PanAEC Engine",
      etag: rvtDerivativeEtag(metadata, "dae"),
      cacheHit: derivative.cacheHit,
    };
  }
  if (format === "schedule") {
    const derivative = await ensureRvtModelDerivative(metadata);
    return {
      bytes: await readFile(derivative.schedulePath),
      mediaType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName: `${safeRvtStem(metadata)}.xlsx`,
      engine: "PanAEC Engine",
      etag: rvtDerivativeEtag(metadata, "schedule"),
      cacheHit: derivative.cacheHit,
    };
  }
  if (format === "ifc") {
    const derivative = await ensureRvtIfcDerivative(metadata);
    return {
      bytes: await readFile(derivative.path),
      mediaType: "application/p21",
      fileName: `${safeRvtStem(metadata)}.ifc`,
      engine: "PanAEC Engine",
      etag: rvtDerivativeEtag(metadata, "ifc"),
      cacheHit: derivative.cacheHit,
    };
  }
  throw new RvtDerivativeError(
    415,
    "unsupported_rvt_derivative_request",
    `Cannot serve ${format} derivative for RVT/RFA`,
    { requestedFormat: format },
  );
}

async function ensureRvtModelDerivative(
  metadata: LocalFileMetadata,
): Promise<RvtModelDerivative> {
  const cached = await readCachedRvtModel(metadata);
  if (cached) return cached;
  // RvtExporter 单次可达 1 小时:并发请求共享同一转换 Promise
  return singleFlight(`rvt:${metadata.checksum}:model`, () =>
    ensureRvtModelDerivativeUncached(metadata),
  );
}

async function ensureRvtModelDerivativeUncached(
  metadata: LocalFileMetadata,
): Promise<RvtModelDerivative> {
  const exporter = await resolveExecutable([
    process.env.DDC_RVT_EXPORTER_PATH,
    "/usr/bin/RvtExporter",
    "RvtExporter",
  ]);
  if (!exporter) {
    throw new RvtDerivativeError(
      501,
      "rvt_exporter_missing",
      "没有找到 PanAEC Engine RVT 模型转换器。请安装 ddc-rvtconverter 或设置 DDC_RVT_EXPORTER_PATH。",
      {
        checked: [
          "DDC_RVT_EXPORTER_PATH",
          "/usr/bin/RvtExporter",
          "RvtExporter",
        ],
      },
    );
  }

  const cacheDir = rvtDerivativeCacheDir(metadata);
  await mkdir(cacheDir, { recursive: true });
  const workDir = rvtDerivativeWorkDir(metadata, "model");
  await mkdir(workDir, { recursive: true });
  const stagedSource = join(
    workDir,
    `source-${metadata.checksum.slice(0, 16)}${metadata.ext.toLowerCase()}`,
  );
  const workDae = join(workDir, `${metadata.fileId}.dae`);
  const workSchedule = join(workDir, `${metadata.fileId}.xlsx`);
  await copyFile(resolveLocalUploadStoragePath(metadata), stagedSource);
  await runProcess(
    exporter,
    [stagedSource, workDae, workSchedule, "basic", "bbox"],
    workDir,
    rvtExporterTimeoutMs,
  );
  await assertReadableNonEmpty(workDae, "rvt_dae_derivative_missing");
  await sanitizeColladaForBrowserLoader(workDae);
  await assertReadableNonEmpty(workDae, "rvt_dae_derivative_missing");
  await assertReadableNonEmpty(workSchedule, "rvt_schedule_derivative_missing");
  await copyFile(workDae, cachedRvtDaePath(metadata));
  await copyFile(workSchedule, cachedRvtSchedulePath(metadata));
  const daeStat = await stat(cachedRvtDaePath(metadata));
  const scheduleStat = await stat(cachedRvtSchedulePath(metadata));
  return {
    daePath: cachedRvtDaePath(metadata),
    schedulePath: cachedRvtSchedulePath(metadata),
    daeSize: daeStat.size,
    scheduleSize: scheduleStat.size,
    cacheHit: false,
  };
}

async function ensureRvtIfcDerivative(
  metadata: LocalFileMetadata,
): Promise<RvtIfcDerivative> {
  const cached = await readCachedRvtIfc(metadata);
  if (cached) return cached;
  return singleFlight(`rvt:${metadata.checksum}:ifc`, () =>
    ensureRvtIfcDerivativeUncached(metadata),
  );
}

async function ensureRvtIfcDerivativeUncached(
  metadata: LocalFileMetadata,
): Promise<RvtIfcDerivative> {
  const converter = await resolveExecutable([
    process.env.DDC_RVT2IFC_CONVERTER_PATH,
    "/usr/bin/RVT2IFCconverter",
    "RVT2IFCconverter",
  ]);
  if (!converter) {
    throw new RvtDerivativeError(
      501,
      "rvt2ifc_converter_missing",
      "没有找到 PanAEC Engine RVT to IFC 转换器。请安装 ddc-rvt2ifcconverter 或设置 DDC_RVT2IFC_CONVERTER_PATH。",
      {
        checked: [
          "DDC_RVT2IFC_CONVERTER_PATH",
          "/usr/bin/RVT2IFCconverter",
          "RVT2IFCconverter",
        ],
      },
    );
  }

  await mkdir(rvtDerivativeCacheDir(metadata), { recursive: true });
  const workDir = rvtDerivativeWorkDir(metadata, "ifc");
  await mkdir(workDir, { recursive: true });
  const stagedSource = join(
    workDir,
    `source-${metadata.checksum.slice(0, 16)}${metadata.ext.toLowerCase()}`,
  );
  const workIfc = join(workDir, `${metadata.fileId}.ifc`);
  await copyFile(resolveLocalUploadStoragePath(metadata), stagedSource);
  await runProcess(
    converter,
    [stagedSource, workIfc, "standard"],
    workDir,
    rvt2IfcTimeoutMs,
  );
  await assertReadableNonEmpty(workIfc, "rvt_ifc_derivative_missing");
  // SJG 157 语义增补:按构件名补真实 IFC 类型 + 分类(失败不致命,退回原 IFC)
  const enrichedIfc = await enrichRvtIfcWithSjg(workIfc, workDir);
  await copyFile(enrichedIfc, cachedRvtIfcPath(metadata));
  const ifcStat = await stat(cachedRvtIfcPath(metadata));
  return {
    path: cachedRvtIfcPath(metadata),
    size: ifcStat.size,
    cacheHit: false,
  };
}

/**
 * 用 06-workers 的 architoken_ifc_enrich 给 RVT2IFC 输出补 SJG 分类并升级 Proxy。
 * 命令不可用或执行失败时退回原 IFC(语义增补是增强项,不阻断查看)。
 */
async function enrichRvtIfcWithSjg(
  ifcPath: string,
  workDir: string,
): Promise<string> {
  const command = process.env.PANAEC_IFC_ENRICH_COMMAND?.trim();
  const fallbackScript =
    "/home/insome/dev/insomeos/06-workers/scripts/panaec-ifc-enrich";
  const enrichCommand =
    command || ((await resolveExecutable([fallbackScript])) ?? null);
  if (!enrichCommand) return ifcPath;
  const enrichedPath = join(workDir, "enriched.ifc");
  try {
    await runProcess(
      enrichCommand,
      [ifcPath, enrichedPath],
      workDir,
      rvt2IfcTimeoutMs,
    );
    await assertReadableNonEmpty(enrichedPath, "rvt_ifc_enrich_missing");
    return enrichedPath;
  } catch {
    return ifcPath;
  }
}

async function readCachedRvtModel(
  metadata: LocalFileMetadata,
): Promise<RvtModelDerivative | null> {
  try {
    const daeStat = await stat(cachedRvtDaePath(metadata));
    const scheduleStat = await stat(cachedRvtSchedulePath(metadata));
    if (daeStat.size <= 0 || scheduleStat.size <= 0) return null;
    return {
      daePath: cachedRvtDaePath(metadata),
      schedulePath: cachedRvtSchedulePath(metadata),
      daeSize: daeStat.size,
      scheduleSize: scheduleStat.size,
      cacheHit: true,
    };
  } catch {
    return null;
  }
}

async function readCachedRvtIfc(
  metadata: LocalFileMetadata,
): Promise<RvtIfcDerivative | null> {
  try {
    const ifcStat = await stat(cachedRvtIfcPath(metadata));
    if (ifcStat.size <= 0) return null;
    return {
      path: cachedRvtIfcPath(metadata),
      size: ifcStat.size,
      cacheHit: true,
    };
  } catch {
    return null;
  }
}

async function rvtAdapterProbes(): Promise<RvtDerivativeAdapterProbe[]> {
  const rvtExporter = await resolveExecutable([
    process.env.DDC_RVT_EXPORTER_PATH,
    "/usr/bin/RvtExporter",
    "RvtExporter",
  ]);
  const rvt2Ifc = await resolveExecutable([
    process.env.DDC_RVT2IFC_CONVERTER_PATH,
    "/usr/bin/RVT2IFCconverter",
    "RVT2IFCconverter",
  ]);
  return [
    {
      id: "panaec-rvt-exporter",
      label: "PanAEC Engine RVT model converter",
      priority: 10,
      status: rvtExporter ? "available" : "missing",
      licenseBoundary: "external_licensed_adapter",
      sourceUrl: "https://github.com/DataDrivenConstruction",
      installHint: "安装 ddc-rvtconverter 或设置 DDC_RVT_EXPORTER_PATH。",
      ...(rvtExporter ? { executablePath: rvtExporter } : {}),
    },
    {
      id: "panaec-rvt2ifc-converter",
      label: "PanAEC Engine RVT to IFC converter",
      priority: 20,
      status: rvt2Ifc ? "available" : "missing",
      licenseBoundary: "external_licensed_adapter",
      sourceUrl: "https://github.com/DataDrivenConstruction",
      installHint:
        "安装 ddc-rvt2ifcconverter 或设置 DDC_RVT2IFC_CONVERTER_PATH。",
      ...(rvt2Ifc ? { executablePath: rvt2Ifc } : {}),
    },
  ];
}

async function requireLocalRvtMetadata(
  fileId: string,
): Promise<LocalFileMetadata> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new RvtDerivativeError(404, "file_not_found", "file not found", {
      fileId,
    });
  }
  const ext = metadata.ext.toLowerCase();
  if (ext !== ".rvt" && ext !== ".rfa") {
    throw new RvtDerivativeError(
      415,
      "unsupported_rvt_derivative_format",
      `Unsupported RVT derivative format: ${metadata.ext || metadata.mimeType}`,
      { extension: metadata.ext, mimeType: metadata.mimeType },
    );
  }
  return metadata;
}

function rvtSourceFormat(metadata: LocalFileMetadata): "rvt" | "rfa" {
  return metadata.ext.toLowerCase() === ".rfa" ? "rfa" : "rvt";
}

function rvtDerivativeCacheDir(metadata: LocalFileMetadata): string {
  return join(
    getLocalUploadsDir(),
    "derivatives",
    "rvt",
    rvtDerivativeRuntimeVersion,
    metadata.checksum.slice(0, 16),
  );
}

function rvtDerivativeWorkDir(
  metadata: LocalFileMetadata,
  kind: "model" | "ifc",
): string {
  return join(
    tmpdir(),
    "architoken-rvt-derivatives",
    rvtDerivativeRuntimeVersion,
    metadata.checksum.slice(0, 16),
    kind,
  );
}

function cachedRvtDaePath(metadata: LocalFileMetadata): string {
  return join(rvtDerivativeCacheDir(metadata), `${metadata.fileId}.dae`);
}

function cachedRvtSchedulePath(metadata: LocalFileMetadata): string {
  return join(rvtDerivativeCacheDir(metadata), `${metadata.fileId}.xlsx`);
}

function cachedRvtIfcPath(metadata: LocalFileMetadata): string {
  return join(rvtDerivativeCacheDir(metadata), `${metadata.fileId}.ifc`);
}

function rvtDerivativeCacheKey(
  metadata: LocalFileMetadata,
  suffix: string,
): string {
  return `${metadata.fileId}:${rvtDerivativeRuntimeVersion}:${metadata.checksum.slice(0, 16)}:${suffix}`;
}

function rvtDerivativeEtag(
  metadata: LocalFileMetadata,
  suffix: string,
): string {
  return `"sha256-${metadata.checksum}-${rvtDerivativeRuntimeVersion}-${suffix}"`;
}

async function assertReadableNonEmpty(path: string, code: string) {
  const fileStat = await stat(path);
  if (!fileStat.isFile() || fileStat.size <= 0) {
    throw new RvtDerivativeError(
      502,
      code,
      `PanAEC Engine converter did not produce ${basename(path)}.`,
      { path },
    );
  }
}

async function resolveExecutable(
  candidates: Array<string | undefined>,
): Promise<string | null> {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = candidate.includes("/")
      ? resolve(candidate)
      : await findOnPath(candidate);
    if (!resolved) continue;
    try {
      await access(resolved, constants.X_OK);
      return resolved;
    } catch {
      continue;
    }
  }
  return null;
}

async function findOnPath(command: string): Promise<string | null> {
  const pathValue = process.env.PATH ?? "";
  for (const segment of pathValue.split(":")) {
    if (!segment) continue;
    const candidate = join(segment, command);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

async function sanitizeColladaForBrowserLoader(path: string): Promise<void> {
  const source = await readFile(path, "utf8");
  if (!source.includes("<COLLADA")) return;

  const uniqueIds = uniquifyColladaIds(source);
  const namedNodes = annotateColladaNodeNames(uniqueIds);
  const validScene = normalizeColladaDisplayColors(
    removeMissingColladaGeometryInstances(namedNodes),
  );

  if (validScene !== source) {
    await writeFile(path, validScene, "utf8");
  }
}

function uniquifyColladaIds(source: string): string {
  const seen = new Map<string, number>();
  return source.replace(/\bid="([^"]+)"/g, (match, id: string) => {
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count === 0) return match;
    return `id="${id}__${count + 1}"`;
  });
}

function annotateColladaNodeNames(source: string): string {
  return source.replace(
    /<node\b[^>]*\bid="([^"]+)"[^>]*>/g,
    (tag, id: string) => {
      const nodeName = colladaNodeNameFromId(id);
      const nameMatch = /\bname="([^"]*)"/.exec(tag);
      if (!nameMatch) {
        return tag.replace("<node", `<node name="${nodeName}"`);
      }
      const currentName = nameMatch[1]?.trim() ?? "";
      if (currentName && currentName.toLowerCase() !== "node") return tag;
      return tag.replace(/\bname="[^"]*"/, `name="${nodeName}"`);
    },
  );
}

function colladaNodeNameFromId(id: string): string {
  return id.replace(/[^A-Za-z0-9_.:-]+/g, "_") || "node";
}

function removeMissingColladaGeometryInstances(source: string): string {
  const ids = new Set(
    Array.from(source.matchAll(/\bid="([^"]+)"/g), (match) => match[1]),
  );
  const missingGeometryIds = new Set<string>();

  for (const match of source.matchAll(
    /<instance_geometry\b[^>]*\burl="#([^"]+)"[^>]*>/g,
  )) {
    const geometryId = match[1];
    if (!geometryId) continue;
    if (!ids.has(geometryId)) {
      missingGeometryIds.add(geometryId);
    }
  }

  let output = source;
  for (const geometryId of missingGeometryIds) {
    const escapedId = escapeRegExp(geometryId);
    const leafNodePattern = new RegExp(
      `<node\\b[^>]*>(?:(?!<node\\b)[\\s\\S])*?<instance_geometry\\b[^>]*\\burl="#${escapedId}"[^>]*(?:\\/>|>[\\s\\S]*?<\\/instance_geometry>)(?:(?!<node\\b)[\\s\\S])*?<\\/node>`,
      "g",
    );
    output = output.replace(leafNodePattern, "");
  }

  return output;
}

function normalizeColladaDisplayColors(source: string): string {
  if (!source.includes("<COLLADA") || !source.includes("<diffuse")) {
    return source;
  }
  return source.replace(
    /<(phong|lambert|blinn|constant)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (technique) => normalizeColladaMaterialTechniqueColor(technique),
  );
}

function normalizeColladaMaterialTechniqueColor(technique: string): string {
  const diffuseMatch =
    /<diffuse>\s*<color\b([^>]*)>([\s\S]*?)<\/color>\s*<\/diffuse>/i.exec(
      technique,
    );
  const specularMatch =
    /<specular>\s*<color\b[^>]*>([\s\S]*?)<\/color>\s*<\/specular>/i.exec(
      technique,
    );
  const ambientColor = colladaTechniqueColor(technique, "ambient");
  const emissionColor = colladaTechniqueColor(technique, "emission");
  const diffuseColor = parseColladaColor(diffuseMatch?.[2]);
  const specularColor = parseColladaColor(specularMatch?.[1]);
  if (!diffuseMatch || !diffuseColor || !colladaColorIsBlack(diffuseColor)) {
    return technique;
  }

  const displaySource =
    [ambientColor, emissionColor, specularColor].find(
      (color): color is [number, number, number, number] =>
        color !== null && !colladaColorIsBlack(color),
    ) ?? colladaVisibleFallbackColor;
  const displayColor: [number, number, number, number] = [
    displaySource[0],
    displaySource[1],
    displaySource[2],
    displaySource[3] ?? diffuseColor[3] ?? 1,
  ];
  const diffuseTag = diffuseMatch[0];
  return technique.replace(
    diffuseTag,
    diffuseTag.replace(diffuseMatch[2] ?? "", formatColladaColor(displayColor)),
  );
}

function colladaTechniqueColor(
  technique: string,
  tagName: "ambient" | "emission" | "specular",
): [number, number, number, number] | null {
  const match = new RegExp(
    `<${tagName}>\\s*<color\\b[^>]*>([\\s\\S]*?)<\\/color>\\s*<\\/${tagName}>`,
    "i",
  ).exec(technique);
  return parseColladaColor(match?.[1]);
}

function parseColladaColor(
  source: string | undefined,
): [number, number, number, number] | null {
  if (!source) return null;
  const values = source
    .trim()
    .split(/\s+/)
    .map((value) => Number.parseFloat(value))
    .filter(Number.isFinite);
  if (values.length < 3) return null;
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1];
}

function colladaColorIsBlack(color: [number, number, number, number]): boolean {
  return (
    Math.max(Math.abs(color[0]), Math.abs(color[1]), Math.abs(color[2])) <=
    0.035
  );
}

function formatColladaColor(color: number[]): string {
  return color.map(formatColladaColorChannel).join(" ");
}

function formatColladaColorChannel(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const clamped = Math.min(1, Math.max(0, value));
  return Number.isInteger(clamped)
    ? String(clamped)
    : clamped.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function ensureNoBrowserTools(cwd: string): Promise<string> {
  const toolsDir = join(cwd, ".panaec-no-browser");
  await mkdir(toolsDir, { recursive: true });
  const script = "#!/bin/sh\nexit 0\n";
  for (const name of converterBrowserToolNames) {
    const toolPath = join(toolsDir, name);
    await writeFile(toolPath, script, "utf8");
    await chmod(toolPath, 0o755);
  }
  return toolsDir;
}

async function runProcess(
  executable: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<ProcessResult> {
  const noBrowserToolsDir = await ensureNoBrowserTools(cwd);
  return new Promise((resolveProcess, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: {
        ...process.env,
        TMPDIR: process.env.TMPDIR || tmpdir(),
        BROWSER: join(noBrowserToolsDir, "panaec-no-browser"),
        PATH: `${noBrowserToolsDir}:${process.env.PATH ?? ""}`,
        DDC_DISABLE_BROWSER: "1",
        NO_BROWSER: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end("\n");
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new RvtDerivativeError(
          504,
          "rvt_derivative_timeout",
          `${basename(executable)} timed out after ${timeoutMs}ms.`,
        ),
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const result = {
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      };
      if (code === 0) {
        resolveProcess(result);
        return;
      }
      reject(
        new RvtDerivativeError(
          502,
          "rvt_derivative_process_failed",
          `${basename(executable)} exited with code ${code ?? "unknown"}.`,
          {
            stdout: result.stdout.toString("utf8").slice(-4000),
            stderr: result.stderr.toString("utf8").slice(-4000),
          },
        ),
      );
    });
  });
}

function safeRvtStem(metadata: LocalFileMetadata): string {
  return (
    metadata.originalName
      .replace(/\.[^.]+$/, "")
      .replace(/[^\p{L}\p{N}._-]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96) || metadata.fileId
  );
}
