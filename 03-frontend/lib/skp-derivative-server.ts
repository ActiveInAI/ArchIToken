// lib/skp-derivative-server.ts - Licensed SKP derivative runtime for local uploads
// License: Apache-2.0

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getLocalFileMetadata,
  getLocalUploadsDir,
  resolveLocalUploadStoragePath,
} from './local-file-runtime-server';
import type { LocalFileMetadata } from './local-file-runtime';

export type SkpDerivativeFormat = 'manifest' | 'glb';

export interface SkpDerivativeAdapterProbe {
  id: string;
  label: string;
  priority: number;
  status: 'available' | 'missing';
  licenseBoundary: 'external_licensed_adapter';
  sourceUrl: string;
  installHint: string;
  endpoint?: string;
}

export interface SkpDerivativeArtifact {
  kind: 'skp-glb';
  url: string;
  mediaType: 'model/gltf-binary';
  engine: string;
  etag: string;
  cacheHit: boolean;
  cacheKey: string;
  size?: number;
}

export interface SkpDerivativeManifest {
  schema: 'architoken.skp_derivative_manifest.v1';
  fileId: string;
  originalName: string;
  sourceFormat: 'skp';
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
  viewer: 'prengine_skp_model' | 'licensed_adapter_required';
  engine: 'Prengine';
  derivativeArtifact?: SkpDerivativeArtifact;
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
  mediaType: 'model/gltf-binary';
  fileName: string;
  engine: 'Prengine';
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
    this.name = 'SkpDerivativeError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface SkpGlbDerivative {
  path: string;
  size: number;
  cacheHit: boolean;
}

const skpAdapterTimeoutMs = 900_000;

export async function buildSkpDerivativeManifest(
  fileId: string,
): Promise<SkpDerivativeManifest> {
  const metadata = await requireLocalSkpMetadata(fileId);
  const sourceUrl = `/api/local-files/${encodeURIComponent(metadata.fileId)}`;
  const adapters = skpAdapterProbes();
  const adapterReady = adapters.some((adapter) => adapter.status === 'available');

  let derivative: SkpGlbDerivative | null = await readCachedSkpGlb(metadata);
  if (!derivative && adapterReady) {
    derivative = await ensureSkpGlbDerivative(metadata);
  }

  if (!derivative) {
    return {
      schema: 'architoken.skp_derivative_manifest.v1',
      fileId: metadata.fileId,
      originalName: metadata.originalName,
      sourceFormat: 'skp',
      sourceChecksum: metadata.checksum,
      sourceOfRecord: {
        url: sourceUrl,
        checksum: metadata.checksum,
        rangeRequests: true,
        substitutePreview: false,
      },
      etag: skpDerivativeEtag(metadata, 'adapter-missing'),
      cachePolicy: 'stream+etag+checksum',
      cacheKey: skpDerivativeCacheKey(metadata, 'missing'),
      viewer: 'licensed_adapter_required',
      engine: 'Prengine',
      adapters,
      permissions: {
        canView: false,
        canWriteDerivative: false,
        requiresLicensedAdapter: true,
      },
      notes: [
        'SKP 是私有模型格式；当前未接入 Prengine 授权模型适配器，系统不会用字节预览、伪几何或不完整前端复刻替代真实模型。',
        '请接入 Prengine 授权 SKP 适配器，返回 GLB 模型和属性清单后再查看。',
      ],
    };
  }

  const glbUrl = `${sourceUrl}/skp-derivative?format=glb`;
  const etag = skpDerivativeEtag(metadata, 'skp-glb');
  return {
    schema: 'architoken.skp_derivative_manifest.v1',
    fileId: metadata.fileId,
    originalName: metadata.originalName,
    sourceFormat: 'skp',
    sourceChecksum: metadata.checksum,
    sourceOfRecord: {
      url: sourceUrl,
      checksum: metadata.checksum,
      rangeRequests: true,
      substitutePreview: false,
    },
    etag,
    cachePolicy: 'stream+etag+checksum',
    cacheKey: skpDerivativeCacheKey(metadata, 'glb'),
    viewer: 'prengine_skp_model',
    engine: 'Prengine',
    derivativeArtifact: {
      kind: 'skp-glb',
      url: glbUrl,
      mediaType: 'model/gltf-binary',
      engine: 'Prengine',
      etag,
      cacheHit: derivative.cacheHit,
      cacheKey: skpDerivativeCacheKey(metadata, 'glb'),
      size: derivative.size,
    },
    adapters,
    permissions: {
      canView: true,
      canWriteDerivative: true,
      requiresLicensedAdapter: true,
    },
    notes: [
      'SKP 通过 Prengine 授权适配器生成真实模型派生；源 SKP 仍是记录真源。',
      '前端只显示适配器返回的真实模型，不显示字节预览或伪模型。',
    ],
  };
}

export async function readSkpDerivativeBytes(
  fileId: string,
  format: SkpDerivativeFormat,
): Promise<SkpDerivativeBytes> {
  if (format !== 'glb') {
    throw new SkpDerivativeError(
      415,
      'unsupported_skp_derivative_request',
      `Cannot serve ${format} derivative for SKP`,
      { requestedFormat: format },
    );
  }
  const metadata = await requireLocalSkpMetadata(fileId);
  const derivative = await ensureSkpGlbDerivative(metadata);
  return {
    bytes: await readFile(derivative.path),
    mediaType: 'model/gltf-binary',
    fileName: `${safeSkpStem(metadata)}.glb`,
    engine: 'Prengine',
    etag: skpDerivativeEtag(metadata, 'skp-glb'),
    cacheHit: derivative.cacheHit,
  };
}

function skpAdapterProbes(): SkpDerivativeAdapterProbe[] {
  const endpoint = licensedSkpAdapterEndpoint();
  return [
    {
      id: 'prengine-sketchup-adapter',
      label: 'Prengine SketchUp adapter',
      priority: 10,
      status: endpoint ? 'available' : 'missing',
      licenseBoundary: 'external_licensed_adapter',
      sourceUrl: 'https://github.com/specklesystems/speckle-sketchup',
      installHint:
        '接入 Prengine 授权模型适配器后，可生成 SKP 真实模型和属性清单。',
      ...(endpoint ? { endpoint } : {}),
    },
  ];
}

async function requireLocalSkpMetadata(
  fileId: string,
): Promise<LocalFileMetadata> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new SkpDerivativeError(404, 'file_not_found', 'file not found', {
      fileId,
    });
  }
  if (metadata.ext.toLowerCase() !== '.skp') {
    throw new SkpDerivativeError(
      415,
      'unsupported_skp_derivative_format',
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

  const endpoint = licensedSkpAdapterEndpoint();
  if (!endpoint) {
    throw new SkpDerivativeError(
      503,
      'skp_adapter_not_configured',
      'SKP 需要接入 Prengine 授权模型适配器后才能真实显示',
      {
        requiredEnv: ['SKETCHUP_ADAPTER_URL', 'LICENSED_BIM_ADAPTER_URL'],
      },
    );
  }

  const payload = {
    jobId: `skp-${metadata.fileId}`,
    operation: 'licensed_bim_convert',
    sourcePath: resolveLocalUploadStoragePath(metadata),
    sourceFileName: metadata.originalName,
    sourceFormat: 'skp',
    sourceChecksum: metadata.checksum,
    outputFormats: ['glb', 'properties-index'],
  };
  const response = await postSkpAdapterJson(endpoint, payload);
  const glbBytes = await extractGlbBytes(endpoint, response);
  const target = cachedSkpGlbPath(metadata);
  await mkdir(skpDerivativeCacheDir(metadata), { recursive: true });
  await writeFile(target, glbBytes);
  const written = await stat(target);
  return {
    path: target,
    size: written.size,
    cacheHit: false,
  };
}

async function readCachedSkpGlb(
  metadata: LocalFileMetadata,
): Promise<SkpGlbDerivative | null> {
  const path = cachedSkpGlbPath(metadata);
  try {
    const fileStat = await stat(path);
    if (!fileStat.isFile() || fileStat.size <= 0) return null;
    return {
      path,
      size: fileStat.size,
      cacheHit: true,
    };
  } catch {
    return null;
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
      method: 'POST',
      headers: {
        'content-type': 'application/json',
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
        'skp_adapter_failed',
        `Prengine SKP adapter returned HTTP ${response.status}`,
        { responseText: await response.text() },
      );
    }
    const data = (await response.json()) as unknown;
    if (!isRecord(data)) {
      throw new SkpDerivativeError(
        502,
        'skp_adapter_invalid_response',
        'Prengine SKP adapter response must be a JSON object',
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
    artifacts.find((artifact) => typeof artifact.contentBase64 === 'string');
  if (!glbArtifact) {
    throw new SkpDerivativeError(
      502,
      'skp_adapter_missing_glb',
      'Prengine SKP adapter did not return a GLB artifact',
      { response },
    );
  }

  const contentBase64 = glbArtifact.contentBase64;
  if (typeof contentBase64 === 'string') {
    return Buffer.from(contentBase64, 'base64');
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
        'skp_adapter_artifact_fetch_failed',
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
    'skp_adapter_missing_artifact_bytes',
    'Prengine SKP adapter must return contentBase64, url/objectUri, or filePath for the GLB artifact',
    { artifact: glbArtifact },
  );
}

function isGlbArtifactCandidate(artifact: Record<string, unknown>): boolean {
  const mediaType = stringValue(artifact.mediaType) ?? stringValue(artifact.media_type);
  const name = stringValue(artifact.name);
  const role = stringValue(artifact.role);
  return Boolean(
    mediaType?.includes('gltf-binary') ||
      mediaType?.includes('model/gltf') ||
      name?.toLowerCase().endsWith('.glb') ||
      role?.toLowerCase().includes('glb'),
  );
}

function licensedSkpAdapterEndpoint(): string | null {
  const baseUrl =
    process.env.SKETCHUP_ADAPTER_URL?.trim() ||
    process.env.LICENSED_BIM_ADAPTER_URL?.trim();
  if (!baseUrl) return null;
  const adapterPath = process.env.SKETCHUP_ADAPTER_PATH?.trim() || '/v1/convert';
  return new URL(adapterPath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

function skpDerivativeCacheDir(metadata: LocalFileMetadata): string {
  return join(getLocalUploadsDir(), '.derivatives', 'skp', metadata.checksum);
}

function cachedSkpGlbPath(metadata: LocalFileMetadata): string {
  return join(skpDerivativeCacheDir(metadata), `${safeSkpStem(metadata)}.glb`);
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
  return metadata.originalName
    .replace(/\.[^.]+$/, '')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || metadata.fileId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
