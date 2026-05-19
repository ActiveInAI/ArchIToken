// lib/ifc-derivative-server.ts - IFC lightweight derivative cache manifest
// License: Apache-2.0

import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import {
  getLocalFileMetadata,
  getLocalUploadsDir,
  resolveLocalUploadStoragePath,
} from './local-file-runtime-server';
import type { LocalFileMetadata } from './local-file-runtime';

export type IfcDerivativeFormat = 'manifest' | 'properties-index';
export type IfcDerivativeAdapterStatus =
  | 'available'
  | 'missing'
  | 'configured_service';

export interface IfcDerivativeAdapterProbe {
  id: string;
  label: string;
  status: IfcDerivativeAdapterStatus;
  licenseBoundary: 'isolated_sidecar' | 'internal_worker_service';
  sourceUrl: string;
  installHint: string;
  executablePath?: string;
}

export interface IfcDerivativeManifest {
  schema: 'architoken.ifc_derivative_cache.v1';
  fileId: string;
  originalName: string;
  sourceFormat: 'ifc' | 'ifczip';
  sourceChecksum: string;
  sourceOfRecord: {
    url: string;
    checksum: string;
    rangeRequests: true;
    substitutePreview: false;
  };
  etag: string;
  cachePolicy: 'stream+etag+checksum';
  cacheKey: string;
  cacheHit: boolean;
  standard: 'IFC';
  adapters: IfcDerivativeAdapterProbe[];
  geometry: {
    status: 'ready' | 'pending_worker';
    manifestUrl: string;
  };
  properties: {
    status: 'ready' | 'pending_worker';
    indexUrl: string;
    totalRows: number;
    pageSize: number;
    etag: string;
  };
  derivatives: Array<{
    kind: 'glb' | 'fragments' | 'tiles';
    status: 'ready' | 'pending_worker';
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
    this.name = 'IfcDerivativeError';
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
  const manifestPath = join(derivativeDir, 'ifc_derivative_cache_manifest.json');
  await mkdir(derivativeDir, { recursive: true });
  await ensurePendingPropertiesIndex(metadata, derivativeDir);

  try {
    const cached = JSON.parse(await readFile(manifestPath, 'utf8')) as IfcDerivativeManifest;
    if (
      cached.schema === 'architoken.ifc_derivative_cache.v1' &&
      cached.sourceChecksum === metadata.checksum
    ) {
      return { ...cached, cacheHit: true };
    }
  } catch {
    // Continue and rebuild the manifest from the current derivative directory.
  }

  const manifest = await createIfcDerivativeManifest(metadata, derivativeDir, false);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

export async function readIfcDerivativeBytes(
  fileId: string,
  format: IfcDerivativeFormat,
): Promise<IfcDerivativeBytes> {
  const metadata = await requireLocalIfcMetadata(fileId);
  if (format !== 'properties-index') {
    throw new IfcDerivativeError(
      415,
      'unsupported_ifc_derivative_request',
      `Cannot serve ${format} as IFC derivative bytes.`,
    );
  }
  const derivativeDir = ifcDerivativeDir(metadata);
  await mkdir(derivativeDir, { recursive: true });
  const indexPath = await ensurePendingPropertiesIndex(metadata, derivativeDir);
  return {
    bytes: await readFile(indexPath),
    mediaType: 'application/json',
    fileName: 'ifc_properties_index.json',
    etag: ifcDerivativeEtag(metadata, 'properties-index'),
    cacheHit: true,
  };
}

async function createIfcDerivativeManifest(
  metadata: LocalFileMetadata,
  derivativeDir: string,
  cacheHit: boolean,
): Promise<IfcDerivativeManifest> {
  const sourceUrl = `/api/local-files/${encodeURIComponent(metadata.fileId)}`;
  const sourceFormat = metadata.ext.toLowerCase() === '.ifczip' ? 'ifczip' : 'ifc';
  const propertiesIndexPath = join(derivativeDir, 'ifc_properties_index.json');
  const propertiesIndex = await readPropertiesIndex(propertiesIndexPath);
  const existing = await listDerivativeArtifacts(derivativeDir);

  return {
    schema: 'architoken.ifc_derivative_cache.v1',
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
    etag: ifcDerivativeEtag(metadata, 'manifest'),
    cachePolicy: 'stream+etag+checksum',
    cacheKey: `${metadata.fileId}:${metadata.checksum.slice(0, 16)}:ifc`,
    cacheHit,
    standard: 'IFC',
    adapters: await probeIfcDerivativeAdapters(),
    geometry: {
      status: existing.geometryManifest ? 'ready' : 'pending_worker',
      manifestUrl: `${sourceUrl}/ifc-derivative?format=manifest`,
    },
    properties: {
      status: propertiesIndex.status,
      indexUrl: `${sourceUrl}/ifc-derivative?format=properties-index`,
      totalRows: propertiesIndex.totalRows,
      pageSize: propertiesIndex.pageSize,
      etag: ifcDerivativeEtag(metadata, 'properties-index'),
    },
    derivatives: [
      derivativeEntry('glb', existing.glb, 'model/gltf-binary', 'threejs', 'ifc_to_glb'),
      derivativeEntry(
        'fragments',
        existing.fragments,
        'thatopen-fragments',
        'thatopen',
        'ifc_ingest',
      ),
      derivativeEntry('tiles', existing.tiles, '3dtiles', 'cesium', 'ifc_to_3dtiles'),
    ],
    permissions: {
      canViewSource: true,
      canEditSource: false,
      canWriteDerivative: true,
      requiresWorkerAdapter: true,
    },
    notes: [
      'IFC source bytes remain the source of record and are streamed through the local file endpoint.',
      'IfcOpenShell / ThatOpen workers must populate GLB, fragments, tiles and paginated properties in this checksum-keyed cache.',
      'The frontend should load lightweight derivatives and paginated properties instead of reparsing the full IFC on every open.',
    ],
  };
}

export async function probeIfcDerivativeAdapters(): Promise<
  IfcDerivativeAdapterProbe[]
> {
  const ifcConvert = await resolveExecutable([
    process.env.IFCCONVERT_PATH,
    '/usr/local/bin/IfcConvert',
    '/usr/bin/IfcConvert',
    'IfcConvert',
    'ifcconvert',
  ]);
  const python = await resolveExecutable([
    process.env.IFCOPENSHELL_PYTHON,
    process.env.PYTHON,
    'python3',
  ]);
  const thatOpenWorker = process.env.THATOPEN_FRAGMENTS_WORKER_URL?.trim();

  const probes: IfcDerivativeAdapterProbe[] = [
    adapterProbe({
      id: 'ifcopenshell-ifcconvert',
      label: 'IfcOpenShell IfcConvert',
      executablePath: ifcConvert,
      licenseBoundary: 'isolated_sidecar',
      sourceUrl: 'https://github.com/IfcOpenShell/IfcOpenShell',
      installHint:
        'Build IfcOpenShell from source or install IfcConvert in an isolated worker image.',
    }),
    adapterProbe({
      id: 'ifcopenshell-python',
      label: 'IfcOpenShell Python worker',
      executablePath: python,
      licenseBoundary: 'isolated_sidecar',
      sourceUrl: 'https://github.com/IfcOpenShell/IfcOpenShell',
      installHint:
        'Install the ifcopenshell Python package in the worker runtime; python availability alone is not treated as parse success.',
    }),
    thatOpenWorker
      ? {
          id: 'thatopen-fragments-service',
          label: 'ThatOpen fragments worker',
          status: 'configured_service',
          licenseBoundary: 'internal_worker_service',
          sourceUrl: 'https://github.com/ThatOpen/engine_fragment',
          installHint:
            'THATOPEN_FRAGMENTS_WORKER_URL is configured; worker should emit fragments into the derivative cache.',
          executablePath: thatOpenWorker,
        }
      : {
          id: 'thatopen-fragments-service',
          label: 'ThatOpen fragments worker',
          status: 'missing',
          licenseBoundary: 'internal_worker_service',
          sourceUrl: 'https://github.com/ThatOpen/engine_fragment',
          installHint:
            'Configure THATOPEN_FRAGMENTS_WORKER_URL or bundle the fragments worker as an internal sidecar.',
        },
  ];

  return probes;
}

async function requireLocalIfcMetadata(
  fileId: string,
): Promise<LocalFileMetadata> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new IfcDerivativeError(404, 'file_not_found', 'file not found', {
      fileId,
    });
  }
  const ext = metadata.ext.toLowerCase();
  if (ext !== '.ifc' && ext !== '.ifczip') {
    throw new IfcDerivativeError(
      415,
      'unsupported_ifc_derivative_format',
      `Unsupported IFC derivative format: ${ext || metadata.mimeType}`,
      { extension: ext, mimeType: metadata.mimeType },
    );
  }
  return metadata;
}

function adapterProbe(input: {
  id: string;
  label: string;
  executablePath: string | null;
  licenseBoundary: IfcDerivativeAdapterProbe['licenseBoundary'];
  sourceUrl: string;
  installHint: string;
}): IfcDerivativeAdapterProbe {
  const base = {
    id: input.id,
    label: input.label,
    status: input.executablePath ? 'available' : 'missing',
    licenseBoundary: input.licenseBoundary,
    sourceUrl: input.sourceUrl,
    installHint: input.installHint,
  } as const;
  return input.executablePath
    ? { ...base, executablePath: input.executablePath }
    : base;
}

function derivativeEntry(
  kind: 'glb' | 'fragments' | 'tiles',
  path: string | null,
  format: string,
  preferredViewer: string,
  workerOperation: string,
): IfcDerivativeManifest['derivatives'][number] {
  const base = {
    kind,
    status: path ? 'ready' : 'pending_worker',
    format,
    preferredViewer,
    workerOperation,
  } as const;
  return path ? { ...base, url: path } : base;
}

async function ensurePendingPropertiesIndex(
  metadata: LocalFileMetadata,
  derivativeDir: string,
): Promise<string> {
  const indexPath = join(derivativeDir, 'ifc_properties_index.json');
  try {
    await access(indexPath, constants.R_OK);
    return indexPath;
  } catch {
    const sourcePath = resolveLocalUploadStoragePath(metadata);
    const sourceStat = await stat(sourcePath);
    const index = {
      schema: 'architoken.ifc_properties_index.v1',
      source: {
        fileId: metadata.fileId,
        checksum: metadata.checksum,
        size: sourceStat.size,
      },
      status: 'pending_worker',
      totalRows: 0,
      pageSize: 500,
      pages: [],
    };
    await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    return indexPath;
  }
}

async function readPropertiesIndex(path: string): Promise<{
  status: 'ready' | 'pending_worker';
  totalRows: number;
  pageSize: number;
}> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as {
      status?: string;
      totalRows?: number;
      pageSize?: number;
    };
    return {
      status: parsed.status === 'ready' ? 'ready' : 'pending_worker',
      totalRows: Number.isFinite(parsed.totalRows) ? Number(parsed.totalRows) : 0,
      pageSize: Number.isFinite(parsed.pageSize) ? Number(parsed.pageSize) : 500,
    };
  } catch {
    return { status: 'pending_worker', totalRows: 0, pageSize: 500 };
  }
}

async function listDerivativeArtifacts(derivativeDir: string): Promise<{
  geometryManifest: string | null;
  glb: string | null;
  fragments: string | null;
  tiles: string | null;
}> {
  const files = await listFiles(derivativeDir);
  return {
    geometryManifest: files.find((file) => basename(file) === 'geometry_manifest.json') ?? null,
    glb: files.find((file) => file.toLowerCase().endsWith('.glb')) ?? null,
    fragments:
      files.find((file) => /\.(frag|fragments)$/i.test(file)) ??
      files.find((file) => basename(file).toLowerCase().includes('fragment')) ??
      null,
    tiles: files.find((file) => basename(file).toLowerCase() === 'tileset.json') ?? null,
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

function ifcDerivativeDir(metadata: LocalFileMetadata): string {
  return join(
    getLocalUploadsDir(),
    'derivatives',
    metadata.fileId,
    metadata.checksum.slice(0, 16),
    'ifc',
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
    const resolved = candidate.includes('/')
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
  const pathValue = process.env.PATH ?? '';
  for (const segment of pathValue.split(':')) {
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
