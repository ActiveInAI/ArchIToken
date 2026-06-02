// lib/ifc-derivative-server.ts - IFC lightweight derivative cache manifest
// License: Apache-2.0

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import {
  getLocalFileMetadata,
  getLocalUploadsDir,
  resolveLocalUploadStoragePath,
} from "./local-file-runtime-server";
import type {
  LocalFileMetadata,
  LocalFileRuntimeArtifact,
  LocalFileRuntimeFailureEvidence,
} from "./local-file-runtime";

export type IfcDerivativeFormat =
  | "manifest"
  | "properties-index"
  | "openusd"
  | "tileset"
  | "tile"
  | "glb";
export type IfcDerivativeAdapterStatus =
  | "available"
  | "missing"
  | "configured_service";

export interface IfcDerivativeAdapterProbe {
  id: string;
  label: string;
  priority: number;
  role: "primary" | "fallback" | "diagnostic";
  capability:
    | "glb_derivative"
    | "openusd_derivative"
    | "tiles3d_derivative"
    | "properties_worker"
    | "isolated_visual_reference"
    | "fragments_derivative";
  status: IfcDerivativeAdapterStatus;
  licenseBoundary: "isolated_sidecar" | "internal_worker_service";
  sourceUrl: string;
  installHint: string;
  executablePath?: string;
  artifactPath?: string;
}

export interface IfcDerivativeManifest {
  schema: "architoken.ifc_derivative_cache.v1";
  fileId: string;
  originalName: string;
  sourceFormat: "ifc" | "ifczip";
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
  cacheHit: boolean;
  standard: "IFC";
  artifacts: LocalFileRuntimeArtifact[];
  failureEvidence: LocalFileRuntimeFailureEvidence[];
  adapters: IfcDerivativeAdapterProbe[];
  geometry: {
    status: "ready" | "pending_worker";
    manifestUrl: string;
  };
  properties: {
    status: "ready" | "pending_worker";
    indexUrl: string;
    totalRows: number;
    pageSize: number;
    etag: string;
  };
  derivatives: Array<{
    kind: "openusd" | "glb" | "fragments" | "tiles";
    status: "ready" | "pending_worker";
    url?: string;
    format: string;
    preferredViewer: string;
    workerOperation: string;
  }>;
  permissions: {
    canViewSource: boolean;
    canEditSource: boolean;
    canWriteDerivative: boolean;
    requiresWorkerAdapter: boolean;
  };
  notes: string[];
}

export interface IfcDerivativeBytes {
  bytes: Buffer;
  mediaType: string;
  fileName: string;
  etag: string;
  cacheHit: boolean;
}

export class IfcDerivativeError extends Error {
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
    this.name = "IfcDerivativeError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function buildIfcDerivativeManifest(
  fileId: string,
): Promise<IfcDerivativeManifest> {
  const metadata = await requireLocalIfcMetadata(fileId);
  const derivativeDir = ifcDerivativeDir(metadata);
  const manifestPath = join(
    derivativeDir,
    "ifc_derivative_cache_manifest.json",
  );
  await mkdir(derivativeDir, { recursive: true });
  await ensurePendingPropertiesIndex(metadata, derivativeDir);

  try {
    const cached = JSON.parse(
      await readFile(manifestPath, "utf8"),
    ) as IfcDerivativeManifest;
    if (
      cached.schema === "architoken.ifc_derivative_cache.v1" &&
      cached.sourceChecksum === metadata.checksum
    ) {
      return { ...cached, cacheHit: true };
    }
  } catch {
    // Continue and rebuild the manifest from the current derivative directory.
  }

  const manifest = await createIfcDerivativeManifest(
    metadata,
    derivativeDir,
    false,
  );
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  return manifest;
}

export async function readIfcDerivativeBytes(
  fileId: string,
  format: IfcDerivativeFormat,
  tilePath?: string | null,
): Promise<IfcDerivativeBytes> {
  const metadata = await requireLocalIfcMetadata(fileId);
  if (format === "tileset") {
    const derivativeDir = ifcDerivativeDir(metadata);
    await mkdir(derivativeDir, { recursive: true });
    const existing = await listDerivativeArtifacts(derivativeDir);
    if (!existing.tiles) {
      throw new IfcDerivativeError(
        503,
        "ifc_3dtiles_derivative_missing",
        "3D Tiles derivative is not available yet. Configure the ifc_to_3dtiles worker/Cesium tiler only for digital-twin scene derivatives.",
        { adapter: "cesium-ion-3dtiles", workerOperation: "ifc_to_3dtiles" },
      );
    }
    const tilesetBytes = await readTilesetJsonDerivative(
      existing.tiles,
      metadata,
      "",
    );
    return {
      bytes: tilesetBytes,
      mediaType: "application/vnd.3dtiles+json",
      fileName: "tileset.json",
      etag: ifcDerivativeEtag(metadata, "tileset"),
      cacheHit: true,
    };
  }

  if (format === "tile") {
    const derivativeDir = ifcDerivativeDir(metadata);
    const resolvedTile = resolveDerivativeTilePath(derivativeDir, tilePath);
    const extension = extname(resolvedTile).toLowerCase();
    const bytes =
      extension === ".json"
        ? await readTilesetJsonDerivative(
            resolvedTile,
            metadata,
            dirname(tilePath ?? ""),
          )
        : await readFile(resolvedTile);
    return {
      bytes,
      mediaType: tileMediaType(extension),
      fileName: basename(resolvedTile),
      etag: ifcDerivativeEtag(metadata, `tile-${tilePath ?? "unknown"}`),
      cacheHit: true,
    };
  }

  if (format === "openusd") {
    const derivativeDir = ifcDerivativeDir(metadata);
    await mkdir(derivativeDir, { recursive: true });
    const existing = await listDerivativeArtifacts(derivativeDir);
    if (!existing.openusd) {
      throw new IfcDerivativeError(
        503,
        "ifc_openusd_derivative_missing",
        "OpenUSD/USDZ derivative is not available yet. Configure the Prengine OpenUSD worker; glTF/GLB remains fallback only.",
        { adapter: "prengine-openusd", workerOperation: "ifc_to_openusd" },
      );
    }
    const extension = extname(existing.openusd).toLowerCase() || ".usd";
    return {
      bytes: await readFile(existing.openusd),
      mediaType:
        extension === ".usdz" ? "model/vnd.usdz+zip" : "model/vnd.usd",
      fileName: `${safeDerivativeBaseName(metadata.originalName)}${extension}`,
      etag: ifcDerivativeEtag(metadata, "openusd"),
      cacheHit: true,
    };
  }

  if (format === "glb") {
    const derivativeDir = ifcDerivativeDir(metadata);
    await mkdir(derivativeDir, { recursive: true });
    const existing = await listDerivativeArtifacts(derivativeDir);
    if (!existing.glb) {
      throw new IfcDerivativeError(
        503,
        "ifc_glb_derivative_missing",
        "GLB fallback derivative is not available yet. Configure a GLB worker only when OpenUSD/USDZ/3D Tiles cannot be used.",
        { adapter: "gltf-glb-fallback-worker" },
      );
    }
    return {
      bytes: await readFile(existing.glb),
      mediaType: "model/gltf-binary",
      fileName: `${safeDerivativeBaseName(metadata.originalName)}.glb`,
      etag: ifcDerivativeEtag(metadata, "glb"),
      cacheHit: true,
    };
  }

  if (format !== "properties-index") {
    throw new IfcDerivativeError(
      415,
      "unsupported_ifc_derivative_request",
      `Cannot serve ${format} as IFC derivative bytes.`,
    );
  }
  const derivativeDir = ifcDerivativeDir(metadata);
  await mkdir(derivativeDir, { recursive: true });
  const indexPath = await ensurePendingPropertiesIndex(metadata, derivativeDir);
  return {
    bytes: await readFile(indexPath),
    mediaType: "application/json",
    fileName: "ifc_properties_index.json",
    etag: ifcDerivativeEtag(metadata, "properties-index"),
    cacheHit: true,
  };
}

async function createIfcDerivativeManifest(
  metadata: LocalFileMetadata,
  derivativeDir: string,
  cacheHit: boolean,
): Promise<IfcDerivativeManifest> {
  const sourceUrl = `/api/local-files/${encodeURIComponent(metadata.fileId)}`;
  const sourceFormat =
    metadata.ext.toLowerCase() === ".ifczip" ? "ifczip" : "ifc";
  const propertiesIndexPath = join(derivativeDir, "ifc_properties_index.json");
  const propertiesIndex = await readPropertiesIndex(propertiesIndexPath);
  const existing = await listDerivativeArtifacts(derivativeDir);
  const artifacts = await ifcRuntimeArtifacts({
    metadata,
    sourceUrl,
    propertiesIndexPath,
    existing,
  });

  return {
    schema: "architoken.ifc_derivative_cache.v1",
    fileId: metadata.fileId,
    originalName: metadata.originalName,
    sourceFormat,
    sourceChecksum: metadata.checksum,
    sourceOfRecord: {
      url: sourceUrl,
      checksum: metadata.checksum,
      rangeRequests: true,
      substitutePreview: false,
    },
    etag: ifcDerivativeEtag(metadata, "manifest"),
    cachePolicy: "stream+etag+checksum",
    cacheKey: `${metadata.fileId}:${metadata.checksum.slice(0, 16)}:ifc`,
    cacheHit,
    standard: "IFC",
    artifacts,
    failureEvidence: [],
    adapters: await probeIfcDerivativeAdapters(),
    geometry: {
      status: existing.geometryManifest ? "ready" : "pending_worker",
      manifestUrl: `${sourceUrl}/ifc-derivative?format=manifest`,
    },
    properties: {
      status: propertiesIndex.status,
      indexUrl: `${sourceUrl}/ifc-derivative?format=properties-index`,
      totalRows: propertiesIndex.totalRows,
      pageSize: propertiesIndex.pageSize,
      etag: ifcDerivativeEtag(metadata, "properties-index"),
    },
    derivatives: [
      derivativeEntry(
        "openusd",
        existing.openusd ? `${sourceUrl}/ifc-derivative?format=openusd` : null,
        "openusd",
        "prengine-openusd",
        "ifc_to_openusd",
      ),
      derivativeEntry(
        "tiles",
        existing.tiles ? `${sourceUrl}/ifc-derivative?format=tileset` : null,
        "3dtiles",
        "3dtiles",
        "ifc_to_3dtiles",
      ),
      derivativeEntry(
        "glb",
        existing.glb ? `${sourceUrl}/ifc-derivative?format=glb` : null,
        "model/gltf-binary",
        "threejs",
        "ifc_to_glb",
      ),
      derivativeEntry(
        "fragments",
        existing.fragments,
        "thatopen-fragments",
        "thatopen",
        "ifc_ingest",
      ),
    ],
    permissions: {
      canViewSource: true,
      canEditSource: false,
      canWriteDerivative: true,
      requiresWorkerAdapter: true,
    },
    notes: [
      "IFC source bytes remain the source of record and are streamed through the local file endpoint.",
      "Native IFC opening uses IFC-Lite Rust/WASM streaming geometry plus WebGPU renderer; it does not route through this 3D Tiles endpoint.",
      "OpenUSD/USDZ and 3D Tiles are the preferred Prengine scene derivatives when workers have produced real artifacts.",
      "OBJ/MTL and FBX are not default Prengine derivative targets.",
      "IFC-Lite and ThatOpen adapters are native/fallback/diagnostic boundaries.",
      "Workers may additionally populate OpenUSD/USDZ, 3D Tiles, GLB fallback, fragments and paginated properties in this checksum-keyed cache.",
      "Native IFC frontends must not auto-trigger OpenUSD/USDZ/3D Tiles/GLB generation while opening the source file.",
    ],
  };
}

export async function probeIfcDerivativeAdapters(): Promise<
  IfcDerivativeAdapterProbe[]
> {
  const ifcConvert = await resolveExecutable(ifcConvertCandidates());
  const python = await resolveExecutable([
    process.env.IFCOPENSHELL_PYTHON,
    process.env.PYTHON,
    "python3",
  ]);
  const louistrueVisual = await resolveReadableFile(
    louistrueIfcLiteViewerCandidates(),
  );
  const thatOpenViewer = await resolveReadableFile(
    thatOpenWebIfcViewerCandidates(),
  );
  const openUsdWorkerUrl =
    process.env.PRENGINE_OPENUSD_WORKER_URL?.trim() ||
    process.env.ARCHITOKEN_OPENUSD_WORKER_URL?.trim();
  const cesiumIonToken = process.env.CESIUM_ION_TOKEN?.trim();
  const tilesWorkerUrl =
    process.env.IFC_3DTILES_WORKER_URL?.trim() ||
    process.env.ARCHITOKEN_3DTILES_WORKER_URL?.trim();
  const thatOpenWorker = process.env.THATOPEN_FRAGMENTS_WORKER_URL?.trim();

  const probes: IfcDerivativeAdapterProbe[] = [
    openUsdWorkerUrl
      ? {
          id: "prengine-openusd",
          label: "Prengine OpenUSD/USDZ worker",
          priority: 5,
          role: "primary",
          capability: "openusd_derivative",
          status: "configured_service",
          licenseBoundary: "internal_worker_service",
          sourceUrl: "internal://prengine/openusd",
          installHint:
            "PRENGINE_OPENUSD_WORKER_URL is configured; worker should emit USD/USDZ derivatives before any glTF/GLB fallback.",
          executablePath: openUsdWorkerUrl,
        }
      : {
          id: "prengine-openusd",
          label: "Prengine OpenUSD/USDZ worker",
          priority: 5,
          role: "primary",
          capability: "openusd_derivative",
          status: "missing",
          licenseBoundary: "internal_worker_service",
          sourceUrl: "internal://prengine/openusd",
          installHint:
            "Configure PRENGINE_OPENUSD_WORKER_URL or ARCHITOKEN_OPENUSD_WORKER_URL before treating glTF/GLB as anything other than fallback.",
        },
    cesiumIonToken || tilesWorkerUrl
      ? {
          id: "cesium-ion-3dtiles",
          label: tilesWorkerUrl
            ? "Self-hosted 3D Tiles worker"
            : "Cesium ion 3D Tiles worker",
          priority: 10,
          role: "primary",
          capability: "tiles3d_derivative",
          status: "configured_service",
          licenseBoundary: "internal_worker_service",
          sourceUrl: "https://github.com/CesiumGS/cesium",
          installHint:
            "3D Tiles worker is configured for digital-twin scene derivatives; worker operation ifc_to_3dtiles should populate tileset.json.",
          ...(tilesWorkerUrl ? { executablePath: tilesWorkerUrl } : {}),
        }
      : {
          id: "cesium-ion-3dtiles",
          label: "Cesium ion 3D Tiles worker",
          priority: 10,
          role: "primary",
          capability: "tiles3d_derivative",
          status: "missing",
          licenseBoundary: "internal_worker_service",
          sourceUrl: "https://github.com/CesiumGS/cesium",
          installHint:
            "Configure CESIUM_ION_TOKEN or a self-hosted 3D Tiles tiler only when digital-twin scene derivatives are required.",
        },
    adapterProbe({
      id: "ifcopenshell-ifcconvert",
      label: "IfcOpenShell IfcConvert",
      priority: 20,
      role: "diagnostic",
      capability: "isolated_visual_reference",
      executablePath: ifcConvert,
      licenseBoundary: "isolated_sidecar",
      sourceUrl: "https://github.com/IfcOpenShell/IfcOpenShell",
      installHint:
        "IfcConvert remains an isolated diagnostic boundary; OBJ/MTL output is no longer a default derivative target.",
    }),
    adapterProbe({
      id: "ifcopenshell-python",
      label: "IfcOpenShell Python worker",
      priority: 30,
      role: "fallback",
      capability: "properties_worker",
      executablePath: python,
      licenseBoundary: "isolated_sidecar",
      sourceUrl: "https://github.com/IfcOpenShell/IfcOpenShell",
      installHint:
        "Install the ifcopenshell Python package in the worker runtime; python availability alone is not treated as parse success.",
    }),
    artifactProbe({
      id: "louistrue-ifcliteviewer",
      label: "louistrue ifcLiteViewer",
      priority: 40,
      role: "diagnostic",
      capability: "isolated_visual_reference",
      artifactPath: louistrueVisual,
      licenseBoundary: "internal_worker_service",
      sourceUrl: "https://github.com/louistrue/ifcLiteViewer",
      installHint:
        "Use the source-built PowerBI visual package only as an isolated fallback/diagnostic viewer boundary; do not replace the IfcOpenShell derivative path.",
    }),
    thatOpenWorker
      ? {
          id: "thatopen-fragments-service",
          label: "ThatOpen fragments worker",
          priority: 50,
          role: "fallback",
          capability: "fragments_derivative",
          status: "configured_service",
          licenseBoundary: "internal_worker_service",
          sourceUrl: "https://github.com/ThatOpen/engine_fragment",
          installHint:
            "THATOPEN_FRAGMENTS_WORKER_URL is configured; worker should emit fragments into the derivative cache.",
          executablePath: thatOpenWorker,
        }
      : {
          id: "thatopen-fragments-service",
          label: "ThatOpen fragments worker",
          priority: 50,
          role: "fallback",
          capability: "fragments_derivative",
          status: "missing",
          licenseBoundary: "internal_worker_service",
          sourceUrl: "https://github.com/ThatOpen/engine_fragment",
          installHint:
            "Configure THATOPEN_FRAGMENTS_WORKER_URL or bundle the fragments worker as an internal sidecar.",
        },
    artifactProbe({
      id: "thatopen-web-ifc-viewer",
      label: "ThatOpen web-ifc-viewer source build",
      priority: 60,
      role: "fallback",
      capability: "isolated_visual_reference",
      artifactPath: thatOpenViewer,
      licenseBoundary: "internal_worker_service",
      sourceUrl: "https://github.com/ThatOpen/web-ifc-viewer",
      installHint:
        "Use the source-built ThatOpen viewer only behind an internal adapter boundary; the old custom browser web-ifc parsing path remains disabled for this module.",
    }),
  ];

  return probes;
}

async function requireLocalIfcMetadata(
  fileId: string,
): Promise<LocalFileMetadata> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new IfcDerivativeError(404, "file_not_found", "file not found", {
      fileId,
    });
  }
  const ext = metadata.ext.toLowerCase();
  if (ext !== ".ifc" && ext !== ".ifczip") {
    throw new IfcDerivativeError(
      415,
      "unsupported_ifc_derivative_format",
      `Unsupported IFC derivative format: ${ext || metadata.mimeType}`,
      { extension: ext, mimeType: metadata.mimeType },
    );
  }
  return metadata;
}

function adapterProbe(input: {
  id: string;
  label: string;
  priority: number;
  role: IfcDerivativeAdapterProbe["role"];
  capability: IfcDerivativeAdapterProbe["capability"];
  executablePath: string | null;
  licenseBoundary: IfcDerivativeAdapterProbe["licenseBoundary"];
  sourceUrl: string;
  installHint: string;
}): IfcDerivativeAdapterProbe {
  const base = {
    id: input.id,
    label: input.label,
    priority: input.priority,
    role: input.role,
    capability: input.capability,
    status: input.executablePath ? "available" : "missing",
    licenseBoundary: input.licenseBoundary,
    sourceUrl: input.sourceUrl,
    installHint: input.installHint,
  } as const;
  return input.executablePath
    ? { ...base, executablePath: input.executablePath }
    : base;
}

function artifactProbe(input: {
  id: string;
  label: string;
  priority: number;
  role: IfcDerivativeAdapterProbe["role"];
  capability: IfcDerivativeAdapterProbe["capability"];
  artifactPath: string | null;
  licenseBoundary: IfcDerivativeAdapterProbe["licenseBoundary"];
  sourceUrl: string;
  installHint: string;
}): IfcDerivativeAdapterProbe {
  const base = {
    id: input.id,
    label: input.label,
    priority: input.priority,
    role: input.role,
    capability: input.capability,
    status: input.artifactPath ? "available" : "missing",
    licenseBoundary: input.licenseBoundary,
    sourceUrl: input.sourceUrl,
    installHint: input.installHint,
  } as const;
  return input.artifactPath
    ? { ...base, artifactPath: input.artifactPath }
    : base;
}

function derivativeEntry(
  kind: "openusd" | "glb" | "fragments" | "tiles",
  path: string | null,
  format: string,
  preferredViewer: string,
  workerOperation: string,
): IfcDerivativeManifest["derivatives"][number] {
  const base = {
    kind,
    status: path ? "ready" : "pending_worker",
    format,
    preferredViewer,
    workerOperation,
  } as const;
  return path ? { ...base, url: path } : base;
}

async function ifcRuntimeArtifacts(input: {
  metadata: LocalFileMetadata;
  sourceUrl: string;
  propertiesIndexPath: string;
  existing: {
    geometryManifest: string | null;
    openusd: string | null;
    glb: string | null;
    fragments: string | null;
    tiles: string | null;
  };
}): Promise<LocalFileRuntimeArtifact[]> {
  const sourcePath = resolveLocalUploadStoragePath(input.metadata);
  const sourceStat = await stat(sourcePath);
  const artifacts: LocalFileRuntimeArtifact[] = [
    {
      name: input.metadata.originalName,
      role: "ifc_source_runtime",
      mediaType: input.metadata.mimeType || "application/x-step",
      size: sourceStat.size,
      checksum: input.metadata.checksum,
      url: input.sourceUrl,
      engine: "original-source+ifc-lite-webgpu",
    },
    await artifactFromDerivativePath(input.propertiesIndexPath, {
      role: "ifc_properties_index",
      mediaType: "application/json",
      url: `${input.sourceUrl}/ifc-derivative?format=properties-index`,
      engine: "ifc-derivative-cache",
    }),
  ];

  const derivativeArtifacts = [
    input.existing.geometryManifest
      ? {
          path: input.existing.geometryManifest,
          role: "ifc_geometry_manifest",
          mediaType: "application/json",
          url: `${input.sourceUrl}/ifc-derivative?format=manifest`,
          engine: "ifc-geometry-worker",
        }
      : null,
    input.existing.openusd
      ? {
          path: input.existing.openusd,
          role: "ifc_openusd_derivative",
          mediaType: "model/vnd.usd",
          url: `${input.sourceUrl}/ifc-derivative?format=openusd`,
          engine: "prengine-openusd",
        }
      : null,
    input.existing.tiles
      ? {
          path: input.existing.tiles,
          role: "ifc_3dtiles_tileset",
          mediaType: "application/vnd.3dtiles+json",
          url: `${input.sourceUrl}/ifc-derivative?format=tileset`,
          engine: "ifc-to-3dtiles-worker",
        }
      : null,
    input.existing.glb
      ? {
          path: input.existing.glb,
          role: "ifc_glb_fallback",
          mediaType: "model/gltf-binary",
          url: `${input.sourceUrl}/ifc-derivative?format=glb`,
          engine: "ifc-to-glb-worker",
        }
      : null,
    input.existing.fragments
      ? {
          path: input.existing.fragments,
          role: "ifc_fragments_derivative",
          mediaType: "application/octet-stream",
          url: input.existing.fragments,
          engine: "thatopen-fragments-worker",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  for (const artifact of derivativeArtifacts) {
    artifacts.push(
      await artifactFromDerivativePath(artifact.path, {
        role: artifact.role,
        mediaType: artifact.mediaType,
        url: artifact.url,
        engine: artifact.engine,
      }),
    );
  }

  return artifacts;
}

async function artifactFromDerivativePath(
  path: string,
  input: {
    role: string;
    mediaType: string;
    url: string;
    engine: string;
  },
): Promise<LocalFileRuntimeArtifact> {
  const bytes = await readFile(path);
  return {
    name: basename(path),
    role: input.role,
    mediaType: input.mediaType,
    size: bytes.byteLength,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    path,
    url: input.url,
    engine: input.engine,
  };
}

async function ensurePendingPropertiesIndex(
  metadata: LocalFileMetadata,
  derivativeDir: string,
): Promise<string> {
  const indexPath = join(derivativeDir, "ifc_properties_index.json");
  try {
    await access(indexPath, constants.R_OK);
    return indexPath;
  } catch {
    const sourcePath = resolveLocalUploadStoragePath(metadata);
    const sourceStat = await stat(sourcePath);
    const index = {
      schema: "architoken.ifc_properties_index.v1",
      source: {
        fileId: metadata.fileId,
        checksum: metadata.checksum,
        size: sourceStat.size,
      },
      status: "pending_worker",
      totalRows: 0,
      pageSize: 500,
      pages: [],
    };
    await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
    return indexPath;
  }
}

async function readPropertiesIndex(path: string): Promise<{
  status: "ready" | "pending_worker";
  totalRows: number;
  pageSize: number;
}> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as {
      status?: string;
      totalRows?: number;
      pageSize?: number;
    };
    return {
      status: parsed.status === "ready" ? "ready" : "pending_worker",
      totalRows: Number.isFinite(parsed.totalRows)
        ? Number(parsed.totalRows)
        : 0,
      pageSize: Number.isFinite(parsed.pageSize)
        ? Number(parsed.pageSize)
        : 500,
    };
  } catch {
    return { status: "pending_worker", totalRows: 0, pageSize: 500 };
  }
}

async function readTilesetJsonDerivative(
  path: string,
  metadata: LocalFileMetadata,
  basePath: string,
): Promise<Buffer> {
  const raw = await readFile(path, "utf8");
  try {
    const parsed = JSON.parse(raw) as unknown;
    const sourceUrl = `/api/local-files/${encodeURIComponent(metadata.fileId)}`;
    const rewritten = rewriteTilesetReferences(parsed, sourceUrl, basePath);
    return Buffer.from(`${JSON.stringify(rewritten, null, 2)}\n`, "utf8");
  } catch {
    return Buffer.from(raw, "utf8");
  }
}

function rewriteTilesetReferences(
  value: unknown,
  sourceUrl: string,
  basePath: string,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      rewriteTilesetReferences(item, sourceUrl, basePath),
    );
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if ((key === "uri" || key === "url") && typeof item === "string") {
      output[key] = rewriteTilesetUri(item, sourceUrl, basePath);
    } else {
      output[key] = rewriteTilesetReferences(item, sourceUrl, basePath);
    }
  }
  return output;
}

function rewriteTilesetUri(
  uri: string,
  sourceUrl: string,
  basePath: string,
): string {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(uri)) {
    return uri;
  }
  const normalizedPath = normalizeDerivativeTilePath(
    basePath && basePath !== "." ? join(basePath, uri) : uri,
  );
  return `${sourceUrl}/ifc-derivative?format=tile&path=${encodeURIComponent(
    normalizedPath,
  )}`;
}

async function listDerivativeArtifacts(derivativeDir: string): Promise<{
  geometryManifest: string | null;
  openusd: string | null;
  glb: string | null;
  fragments: string | null;
  tiles: string | null;
}> {
  const files = await listFiles(derivativeDir);
  return {
    geometryManifest:
      files.find((file) => basename(file) === "geometry_manifest.json") ?? null,
    openusd:
      files.find((file) => /\.(usd|usda|usdc|usdz)$/i.test(file)) ?? null,
    glb: files.find((file) => file.toLowerCase().endsWith(".glb")) ?? null,
    fragments:
      files.find((file) => /\.(frag|fragments)$/i.test(file)) ??
      files.find((file) => basename(file).toLowerCase().includes("fragment")) ??
      null,
    tiles:
      files.find((file) => basename(file).toLowerCase() === "tileset.json") ??
      null,
  };
}

async function listFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(current: string) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile()) {
        result.push(path);
      }
    }
  }
  await walk(directory);
  return result.sort((left, right) => left.localeCompare(right));
}

function resolveDerivativeTilePath(
  derivativeDir: string,
  path: string | null | undefined,
): string {
  const normalizedPath = normalizeDerivativeTilePath(path);
  if (!normalizedPath) {
    throw new IfcDerivativeError(
      400,
      "ifc_tile_path_required",
      "3D Tiles content requests require a relative tile path.",
    );
  }
  const resolved = resolve(derivativeDir, normalizedPath);
  const root = resolve(derivativeDir);
  if (resolved !== root && !resolved.startsWith(`${root}/`)) {
    throw new IfcDerivativeError(
      400,
      "ifc_tile_path_invalid",
      "3D Tiles content path must stay inside the derivative cache directory.",
      { path },
    );
  }
  return resolved;
}

function normalizeDerivativeTilePath(path: string | null | undefined): string {
  return (path ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
}

function tileMediaType(extension: string): string {
  if (extension === ".json") return "application/vnd.3dtiles+json";
  if (extension === ".b3dm") return "model/vnd.3dtiles.b3dm";
  if (extension === ".i3dm") return "model/vnd.3dtiles.i3dm";
  if (extension === ".pnts") return "model/vnd.3dtiles.pnts";
  if (extension === ".cmpt") return "model/vnd.3dtiles.cmpt";
  if (extension === ".glb") return "model/gltf-binary";
  if (extension === ".gltf") return "model/gltf+json";
  if (extension === ".bin") return "application/octet-stream";
  return "application/octet-stream";
}

function ifcDerivativeDir(metadata: LocalFileMetadata): string {
  return join(
    getLocalUploadsDir(),
    "derivatives",
    metadata.fileId,
    metadata.checksum.slice(0, 16),
    "ifc",
  );
}

function ifcConvertCandidates(): Array<string | undefined> {
  const sourceBuildRoot = ifcSourceBuildRoot();
  return [
    process.env.IFCCONVERT_PATH,
    join(sourceBuildRoot, "ifcopenshell", "prefix", "bin", "IfcConvert"),
    "/usr/local/bin/IfcConvert",
    "/usr/bin/IfcConvert",
    "IfcConvert",
    "ifcconvert",
  ];
}

function louistrueIfcLiteViewerCandidates(): Array<string | undefined> {
  const sourceBuildRoot = ifcSourceBuildRoot();
  return [
    process.env.LOUISTRUE_IFCLITEVIEWER_PBIVIZ,
    join(
      sourceBuildRoot,
      "louistrue-ifcliteviewer",
      "src",
      "dist",
      "ifcLiteViewer.1.0.1.0.pbiviz",
    ),
  ];
}

function thatOpenWebIfcViewerCandidates(): Array<string | undefined> {
  const sourceBuildRoot = ifcSourceBuildRoot();
  return [
    process.env.THATOPEN_WEB_IFC_VIEWER_BUNDLE,
    join(
      sourceBuildRoot,
      "thatopen-web-ifc-viewer",
      "src",
      "viewer",
      "dist",
      "index.js",
    ),
  ];
}

function ifcSourceBuildRoot(): string {
  return (
    process.env.ARCHITOKEN_SOURCE_BUILD_ROOT ??
    "/tmp/architoken-source-builds-real"
  );
}

function safeDerivativeBaseName(fileName: string): string {
  const leaf = basename(fileName).replace(/\.[^.]+$/, "");
  return (
    leaf
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "model"
  );
}

function ifcDerivativeEtag(
  metadata: LocalFileMetadata,
  variant: string,
): string {
  return `"sha256-${metadata.checksum}-${variant}"`;
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

async function resolveReadableFile(
  candidates: Array<string | undefined>,
): Promise<string | null> {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = resolve(candidate);
    try {
      await access(resolved, constants.R_OK);
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
