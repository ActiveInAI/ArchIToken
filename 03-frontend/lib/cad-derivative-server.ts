// lib/cad-derivative-server.ts - Native CAD derivative runtime for local uploads
// License: Apache-2.0

import { constants } from 'node:fs';
import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join, parse, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import {
  getLocalFileMetadata,
  getLocalUploadsDir,
  resolveLocalUploadStoragePath,
} from './local-file-runtime-server';
import type { LocalFileMetadata } from './local-file-runtime';

export type CadDerivativeFormat = 'dxf' | 'pdf' | 'manifest';
export type CadDerivativeViewer = 'dxf_canvas' | 'dwg_vector_pdf';
export type CadDerivativeAdapterStatus =
  | 'available'
  | 'missing'
  | 'blocked_by_policy';

export interface CadDerivativeSheet {
  id: string;
  name: string;
  url: string;
}

export interface CadDerivativeAdapterProbe {
  id: string;
  label: string;
  priority: number;
  status: CadDerivativeAdapterStatus;
  licenseBoundary: 'isolated_sidecar' | 'external_licensed_adapter' | 'browser_source_parser';
  sourceUrl: string;
  installHint: string;
  executablePath?: string;
}

export interface CadDerivativeArtifact {
  kind: 'source-dxf' | 'dwg-dxf' | 'dwg-vector-pdf';
  url: string;
  mediaType: string;
  engine: string;
  etag: string;
  cacheHit: boolean;
  cacheKey: string;
  size?: number;
}

export interface CadDerivativeManifest {
  schema: 'architoken.cad_derivative_manifest.v1';
  fileId: string;
  originalName: string;
  sourceFormat: string;
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
  viewer: CadDerivativeViewer;
  engine: string;
  derivativeArtifact: CadDerivativeArtifact;
  adapters: CadDerivativeAdapterProbe[];
  permissions: {
    canView: boolean;
    canEditSource: boolean;
    canWriteDerivative: boolean;
    requiresLicensedAdapter: boolean;
  };
  sheets: CadDerivativeSheet[];
  notes: string[];
}

export interface CadDerivativeBytes {
  bytes: Buffer;
  mediaType: string;
  fileName: string;
  engine: string;
  etag: string;
  cacheHit: boolean;
}

export class CadDerivativeError extends Error {
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
    this.name = 'CadDerivativeError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ProcessResult {
  stdout: Buffer;
  stderr: Buffer;
}

interface DwgPdfDerivative {
  engine: string;
  cacheHit: boolean;
  sheets: Array<{
    id: string;
    name: string;
    path: string;
  }>;
}

interface ConverterDefinition {
  id: string;
  label: string;
  priority: number;
  candidates: Array<string | undefined>;
  licenseBoundary: CadDerivativeAdapterProbe['licenseBoundary'];
  sourceUrl: string;
  installHint: string;
  policyEnabled?: boolean;
}

const dwgPdfTimeoutMs = 180_000;
const dwgDxfTimeoutMs = 120_000;

export async function probeCadDerivativeAdapters(): Promise<
  CadDerivativeAdapterProbe[]
> {
  const definitions = cadAdapterDefinitions();
  const probes = await Promise.all(
    definitions.map(async (definition) => {
      const executablePath = await resolveExecutable(definition.candidates);
      const status = adapterStatus(definition, executablePath);
      const base = {
        id: definition.id,
        label: definition.label,
        priority: definition.priority,
        status,
        licenseBoundary: definition.licenseBoundary,
        sourceUrl: definition.sourceUrl,
        installHint: definition.installHint,
      };
      return executablePath
        ? { ...base, executablePath }
        : base;
    }),
  );
  return probes.sort((left, right) => left.priority - right.priority);
}

export async function buildCadDerivativeManifest(
  fileId: string,
): Promise<CadDerivativeManifest> {
  const metadata = await requireLocalCadMetadata(fileId);
  const ext = metadata.ext.toLowerCase();
  const adapters = await probeCadDerivativeAdapters();
  const sourceUrl = `/api/local-files/${encodeURIComponent(metadata.fileId)}`;
  const cacheKey = derivativeCacheKey(metadata, 'source');

  if (ext === '.dxf') {
    const sourcePath = resolveLocalUploadStoragePath(metadata);
    const sourceStat = await stat(sourcePath);
    const etag = cadDerivativeEtag(metadata, 'source-dxf');
    return {
      schema: 'architoken.cad_derivative_manifest.v1',
      fileId: metadata.fileId,
      originalName: metadata.originalName,
      sourceFormat: 'dxf',
      sourceChecksum: metadata.checksum,
      sourceOfRecord: {
        url: sourceUrl,
        checksum: metadata.checksum,
        rangeRequests: true,
        substitutePreview: false,
      },
      etag,
      cachePolicy: 'stream+etag+checksum',
      cacheKey,
      viewer: 'dxf_canvas',
      engine: 'browser-dxf-parser',
      derivativeArtifact: {
        kind: 'source-dxf',
        url: sourceUrl,
        mediaType: 'application/dxf',
        engine: 'original-dxf',
        etag,
        cacheHit: false,
        cacheKey,
        size: sourceStat.size,
      },
      adapters,
      permissions: {
        canView: true,
        canEditSource: false,
        canWriteDerivative: false,
        requiresLicensedAdapter: false,
      },
      sheets: [
        {
          id: 'model-space',
          name: 'Model Space',
          url: sourceUrl,
        },
      ],
      notes: [
        'DXF is rendered from original drawing entities in the browser Canvas viewer.',
      ],
    };
  }

  if (ext === '.dwg') {
    try {
      const derivative = await readDwgDxfDerivative(metadata);
      const etag = cadDerivativeEtag(metadata, 'dwg-dxf');
      const dxfUrl = `${sourceUrl}/cad-derivative?format=dxf`;
      return {
        schema: 'architoken.cad_derivative_manifest.v1',
        fileId: metadata.fileId,
        originalName: metadata.originalName,
        sourceFormat: 'dwg',
        sourceChecksum: metadata.checksum,
        sourceOfRecord: {
          url: sourceUrl,
          checksum: metadata.checksum,
          rangeRequests: true,
          substitutePreview: false,
        },
        etag,
        cachePolicy: 'stream+etag+checksum',
        cacheKey: derivativeCacheKey(metadata, 'dxf'),
        viewer: 'dxf_canvas',
        engine: derivative.engine,
        derivativeArtifact: {
          kind: 'dwg-dxf',
          url: dxfUrl,
          mediaType: derivative.mediaType,
          engine: derivative.engine,
          etag: derivative.etag,
          cacheHit: derivative.cacheHit,
          cacheKey: derivativeCacheKey(metadata, 'dxf'),
          size: derivative.bytes.byteLength,
        },
        adapters,
        permissions: {
          canView: true,
          canEditSource: false,
          canWriteDerivative: true,
          requiresLicensedAdapter: true,
        },
        sheets: [
          {
            id: 'model-space',
            name: 'Model Space',
            url: dxfUrl,
          },
        ],
        notes: [
          'DWG is opened through a server-side DWG-to-DXF derivative and rendered as lightweight CAD entities.',
          'The original DWG bytes remain the source of record; the derivative is cached by file checksum.',
        ],
      };
    } catch (error) {
      if (!(error instanceof CadDerivativeError)) {
        throw error;
      }
      if (process.env.ARCHITOKEN_ALLOW_DWG_VECTOR_PDF_FALLBACK === '1') {
        const pdfDerivative = await ensureDwgPdfDerivative(metadata);
        const etag = cadDerivativeEtag(metadata, 'dwg-vector-pdf');
        return {
          schema: 'architoken.cad_derivative_manifest.v1',
          fileId: metadata.fileId,
          originalName: metadata.originalName,
          sourceFormat: 'dwg',
          sourceChecksum: metadata.checksum,
          sourceOfRecord: {
            url: sourceUrl,
            checksum: metadata.checksum,
            rangeRequests: true,
            substitutePreview: false,
          },
          etag,
          cachePolicy: 'stream+etag+checksum',
          cacheKey: derivativeCacheKey(metadata, 'pdf'),
          viewer: 'dwg_vector_pdf',
          engine: pdfDerivative.engine,
          derivativeArtifact: {
            kind: 'dwg-vector-pdf',
            url: `${sourceUrl}/cad-derivative?format=pdf`,
            mediaType: 'application/pdf',
            engine: pdfDerivative.engine,
            etag,
            cacheHit: pdfDerivative.cacheHit,
            cacheKey: derivativeCacheKey(metadata, 'pdf'),
          },
          adapters,
          permissions: {
            canView: true,
            canEditSource: false,
            canWriteDerivative: true,
            requiresLicensedAdapter: true,
          },
          sheets: pdfDerivative.sheets.map((sheet) => ({
            id: sheet.id,
            name: sheet.name,
            url: `/api/local-files/${encodeURIComponent(metadata.fileId)}/cad-derivative?format=pdf&sheet=${encodeURIComponent(sheet.id)}`,
          })),
          notes: [
            `DWG-to-DXF adapter did not produce a valid entity derivative (${error.code}), so an explicitly enabled licensed vector-PDF fallback is being served.`,
            'Default production behavior forbids automatic DDC/watermark/external-page fallback.',
          ],
        };
      }
      throw new CadDerivativeError(
        error.status,
        error.code,
        `${error.message} Default DWG viewing requires a real DWG-to-DXF derivative; automatic DDC/watermark/external-page fallback is disabled.`,
        { ...error.details, adapters },
      );
    }
  }

  throw new CadDerivativeError(
    415,
    'unsupported_cad_derivative_format',
    `Unsupported CAD derivative format: ${ext || metadata.mimeType}`,
    { extension: ext, mimeType: metadata.mimeType },
  );
}

function cadAdapterDefinitions(): ConverterDefinition[] {
  return [
    {
      id: 'oda-file-converter',
      label: 'ODA File Converter',
      priority: 10,
      candidates: [
        process.env.ODA_FILE_CONVERTER_PATH,
        '/usr/bin/ODAFileConverter',
        '/usr/local/bin/ODAFileConverter',
        'ODAFileConverter',
      ],
      licenseBoundary: 'external_licensed_adapter',
      sourceUrl: 'https://www.opendesign.com/guestfiles/oda_file_converter',
      installHint:
        'Install ODA File Converter in an isolated licensed sidecar and set ODA_FILE_CONVERTER_PATH.',
    },
    {
      id: 'libredwg-dwg2dxf',
      label: 'LibreDWG dwg2dxf',
      priority: 20,
      candidates: [
        toolFromDir(process.env.ARCHITOKEN_LIBREDWG_BIN, 'dwg2dxf'),
        toolFromDir(process.env.LIBREDWG_BIN_DIR, 'dwg2dxf'),
        '/tmp/architoken-libredwg/bin/dwg2dxf',
        '/usr/local/bin/dwg2dxf',
        '/usr/bin/dwg2dxf',
        'dwg2dxf',
      ],
      licenseBoundary: 'isolated_sidecar',
      sourceUrl: 'https://github.com/LibreDWG/libredwg',
      installHint:
        'Build LibreDWG from source as an isolated GPL sidecar and set ARCHITOKEN_LIBREDWG_BIN or LIBREDWG_BIN_DIR.',
    },
    {
      id: 'libredwg-dwgread',
      label: 'LibreDWG dwgread',
      priority: 30,
      candidates: [
        toolFromDir(process.env.ARCHITOKEN_LIBREDWG_BIN, 'dwgread'),
        toolFromDir(process.env.LIBREDWG_BIN_DIR, 'dwgread'),
        '/tmp/architoken-libredwg/bin/dwgread',
        '/usr/local/bin/dwgread',
        '/usr/bin/dwgread',
        'dwgread',
      ],
      licenseBoundary: 'isolated_sidecar',
      sourceUrl: 'https://github.com/LibreDWG/libredwg',
      installHint:
        'Build LibreDWG from source as an isolated GPL sidecar; use dwgread -O DXF for stdout derivatives.',
    },
    {
      id: 'freecad-headless',
      label: 'FreeCAD / FreeCADCmd',
      priority: 40,
      candidates: [
        process.env.FREECADCMD_PATH,
        process.env.FREECAD_PATH,
        '/usr/bin/FreeCADCmd',
        '/usr/local/bin/FreeCADCmd',
        '/snap/bin/freecad',
        'FreeCADCmd',
        'freecadcmd',
        'freecad',
      ],
      licenseBoundary: 'isolated_sidecar',
      sourceUrl: 'https://github.com/FreeCAD/FreeCAD',
      installHint:
        'Build FreeCAD from source or install FreeCADCmd as a headless sidecar for DWG/DXF handoff and OCCT exchange conversions.',
    },
    {
      id: 'ddc-dwgexporter-vector-pdf',
      label: 'DDC DwgExporter vector PDF',
      priority: 90,
      candidates: [
        process.env.DDC_DWG_EXPORTER_PATH,
        '/usr/bin/DwgExporter',
        'DwgExporter',
      ],
      licenseBoundary: 'external_licensed_adapter',
      sourceUrl: 'https://github.com/datadrivenconstruction/cad2data-Revit-IFC-DWG-DGN',
      installHint:
        'Use only as an explicitly enabled licensed vector-PDF fallback; it must not replace DWG entity derivatives.',
      policyEnabled: process.env.ARCHITOKEN_ALLOW_DWG_VECTOR_PDF_FALLBACK === '1',
    },
  ];
}

function adapterStatus(
  definition: ConverterDefinition,
  executablePath: string | null,
): CadDerivativeAdapterStatus {
  if (!executablePath) {
    return 'missing';
  }
  if (definition.policyEnabled === false) {
    return 'blocked_by_policy';
  }
  return 'available';
}

function dwgToDxfConverterCandidates(): Array<string | undefined> {
  return [
    process.env.DWG_TO_DXF_PATH,
    ...cadAdapterDefinitions()
      .filter((definition) =>
        ['oda-file-converter', 'libredwg-dwg2dxf', 'libredwg-dwgread'].includes(
          definition.id,
        ),
      )
      .flatMap((definition) => definition.candidates),
  ];
}

export async function readCadDerivativeBytes(
  fileId: string,
  format: CadDerivativeFormat,
  sheetId?: string | null,
): Promise<CadDerivativeBytes> {
  const metadata = await requireLocalCadMetadata(fileId);
  const ext = metadata.ext.toLowerCase();

  if (ext === '.dxf' && format === 'dxf') {
    return {
      bytes: await readFile(resolveLocalUploadStoragePath(metadata)),
      mediaType: 'application/dxf',
      fileName: metadata.originalName,
      engine: 'original-dxf',
      etag: cadDerivativeEtag(metadata, 'source-dxf'),
      cacheHit: false,
    };
  }

  if (ext === '.dwg' && format === 'pdf') {
    const derivative = await ensureDwgPdfDerivative(metadata);
    const sheet = selectSheet(derivative.sheets, sheetId);
    return {
      bytes: await readFile(sheet.path),
      mediaType: 'application/pdf',
      fileName: `${safeDerivativeStem(metadata)}-${sheet.id}.pdf`,
      engine: derivative.engine,
      etag: cadDerivativeEtag(metadata, `dwg-vector-pdf-${sheet.id}`),
      cacheHit: derivative.cacheHit,
    };
  }

  if (ext === '.dwg' && format === 'dxf') {
    return await readDwgDxfDerivative(metadata);
  }

  throw new CadDerivativeError(
    415,
    'unsupported_cad_derivative_request',
    `Cannot serve ${format} derivative for ${ext}`,
    { extension: ext, requestedFormat: format },
  );
}

async function requireLocalCadMetadata(
  fileId: string,
): Promise<LocalFileMetadata> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new CadDerivativeError(404, 'file_not_found', 'file not found', {
      fileId,
    });
  }
  return metadata;
}

async function ensureDwgPdfDerivative(
  metadata: LocalFileMetadata,
): Promise<DwgPdfDerivative> {
  const derivativeDir = dwgDerivativeDir(metadata, 'pdf');
  const outputStem = `${metadata.fileId}-dwg`;
  const sheetDir = join(derivativeDir, `SHEETS_PDF_${outputStem}`);
  const cachedSheets = await listPdfSheets(sheetDir);
  if (cachedSheets.length > 0) {
    return { engine: 'ddc-dwgexporter', cacheHit: true, sheets: cachedSheets };
  }

  const exporter = await resolveExecutable([
    process.env.DDC_DWG_EXPORTER_PATH,
    '/usr/bin/DwgExporter',
    'DwgExporter',
  ]);
  if (!exporter) {
    throw new CadDerivativeError(
      501,
      'dwg_native_exporter_missing',
      'No native DWG exporter was found. Install DDC DWG Community, ODAFileConverter, or LibreDWG on the server.',
      {
        checked: ['DDC_DWG_EXPORTER_PATH', '/usr/bin/DwgExporter', 'DwgExporter'],
      },
    );
  }

  await mkdir(derivativeDir, { recursive: true });
  const sourcePath = resolveLocalUploadStoragePath(metadata);
  const outputXlsx = join(derivativeDir, `${outputStem}.xlsx`);
  await runProcess(
    exporter,
    [sourcePath, outputXlsx, 'sheets2pdf'],
    derivativeDir,
    dwgPdfTimeoutMs,
  );

  const sheets = await listPdfSheets(sheetDir);
  if (sheets.length === 0) {
    throw new CadDerivativeError(
      502,
      'dwg_pdf_derivative_missing',
      'The native DWG exporter finished but did not produce PDF sheets.',
      { exporter, sheetDir },
    );
  }

  return { engine: 'ddc-dwgexporter', cacheHit: false, sheets };
}

async function readDwgDxfDerivative(
  metadata: LocalFileMetadata,
): Promise<CadDerivativeBytes> {
  const derivativeDir = dwgDerivativeDir(metadata, 'dxf');
  const outputDxf = join(derivativeDir, `${metadata.fileId}.dxf`);
  try {
    await access(outputDxf, constants.R_OK);
    return {
      bytes: await readFile(outputDxf),
      mediaType: 'application/dxf',
      fileName: `${safeDerivativeStem(metadata)}.dxf`,
      engine: 'cached-dwg-dxf',
      etag: cadDerivativeEtag(metadata, 'dwg-dxf'),
      cacheHit: true,
    };
  } catch {
    // Continue to converter discovery.
  }

  const sourcePath = resolveLocalUploadStoragePath(metadata);
  const converter = await resolveExecutable(dwgToDxfConverterCandidates());
  if (!converter) {
    throw new CadDerivativeError(
      501,
      'dwg_dxf_converter_missing',
      'No DWG to DXF converter was found. Install LibreDWG dwg2dxf/dwgread, ODAFileConverter, or configure DWG_TO_DXF_PATH / ODA_FILE_CONVERTER_PATH.',
      {
        checked: [
          'DWG_TO_DXF_PATH',
          'ODA_FILE_CONVERTER_PATH',
          '/usr/bin/ODAFileConverter',
          'ODAFileConverter',
          'ARCHITOKEN_LIBREDWG_BIN/dwg2dxf',
          'LIBREDWG_BIN_DIR/dwg2dxf',
          '/tmp/architoken-libredwg/bin/dwg2dxf',
          '/usr/local/bin/dwg2dxf',
          '/usr/bin/dwg2dxf',
          'dwg2dxf',
          'ARCHITOKEN_LIBREDWG_BIN/dwgread',
          'LIBREDWG_BIN_DIR/dwgread',
          '/tmp/architoken-libredwg/bin/dwgread',
          '/usr/local/bin/dwgread',
          '/usr/bin/dwgread',
          'dwgread',
        ],
      },
    );
  }

  await mkdir(derivativeDir, { recursive: true });
  const converterName = basename(converter).toLowerCase();
  if (converterName.includes('odafileconverter')) {
    await runOdaFileConverter(converter, metadata, derivativeDir, outputDxf);
  } else if (converterName.includes('dwgread')) {
    const result = await runProcess(
      converter,
      ['-O', 'DXF', sourcePath],
      derivativeDir,
      dwgDxfTimeoutMs,
    );
    if (!looksLikeDxf(result.stdout)) {
      throw new CadDerivativeError(
        502,
        'dwgread_dxf_output_invalid',
        'dwgread finished but did not return DXF text on stdout.',
      );
    }
    await writeFile(outputDxf, result.stdout);
  } else {
    await runProcess(
      converter,
      ['-o', outputDxf, sourcePath],
      derivativeDir,
      dwgDxfTimeoutMs,
    );
  }

  await access(outputDxf, constants.R_OK);
  return {
    bytes: await readFile(outputDxf),
    mediaType: 'application/dxf',
    fileName: `${safeDerivativeStem(metadata)}.dxf`,
    engine: basename(converter),
    etag: cadDerivativeEtag(metadata, 'dwg-dxf'),
    cacheHit: false,
  };
}

async function runOdaFileConverter(
  converter: string,
  metadata: LocalFileMetadata,
  derivativeDir: string,
  outputDxf: string,
) {
  const sourcePath = resolveLocalUploadStoragePath(metadata);
  const inputDir = join(derivativeDir, 'oda-input');
  const outputDir = join(derivativeDir, 'oda-output');
  const inputName = `${safeDerivativeStem(metadata)}.dwg`;
  await mkdir(inputDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await copyFile(sourcePath, join(inputDir, inputName));
  await runProcess(
    converter,
    [inputDir, outputDir, 'ACAD2018', 'DXF', '0', '1'],
    derivativeDir,
    dwgDxfTimeoutMs,
  );

  const candidates = await listDerivativeFiles(outputDir, '.dxf');
  const exact = candidates.find(
    (candidate) =>
      parse(candidate).name.toLowerCase() === parse(inputName).name.toLowerCase(),
  );
  const selected = exact ?? candidates[0];
  if (!selected) {
    throw new CadDerivativeError(
      502,
      'oda_dxf_output_missing',
      'ODAFileConverter finished but did not produce a DXF file.',
      { outputDir },
    );
  }
  await copyFile(selected, outputDxf);
}

function selectSheet(
  sheets: DwgPdfDerivative['sheets'],
  sheetId?: string | null,
): DwgPdfDerivative['sheets'][number] {
  const selected =
    (sheetId ? sheets.find((sheet) => sheet.id === sheetId) : null) ??
    sheets[0];
  if (!selected) {
    throw new CadDerivativeError(
      404,
      'dwg_pdf_sheet_not_found',
      'No DWG PDF sheets are available.',
    );
  }
  return selected;
}

function dwgDerivativeDir(
  metadata: LocalFileMetadata,
  kind: 'pdf' | 'dxf',
): string {
  return join(
    getLocalUploadsDir(),
    'derivatives',
    metadata.fileId,
    metadata.checksum.slice(0, 16),
    kind,
  );
}

function derivativeCacheKey(
  metadata: LocalFileMetadata,
  kind: 'source' | 'dxf' | 'pdf',
): string {
  return `${metadata.fileId}:${metadata.checksum.slice(0, 16)}:${kind}`;
}

function cadDerivativeEtag(
  metadata: LocalFileMetadata,
  variant: string,
): string {
  return `"sha256-${metadata.checksum}-${variant}"`;
}

async function listPdfSheets(
  sheetDir: string,
): Promise<DwgPdfDerivative['sheets']> {
  try {
    const entries = await readdir(sheetDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
      .map((entry) => {
        const parsed = parse(entry.name);
        return {
          id: safeSheetId(parsed.name),
          name: parsed.name || 'Sheet',
          path: join(sheetDir, entry.name),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    return [];
  }
}

async function listDerivativeFiles(
  directory: string,
  extension: string,
): Promise<string[]> {
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
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) {
        result.push(path);
      }
    }
  }
  await walk(directory);
  return result.sort((left, right) => left.localeCompare(right));
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

function runProcess(
  executable: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<ProcessResult> {
  return new Promise((resolveProcess, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: {
        ...process.env,
        TMPDIR: process.env.TMPDIR || tmpdir(),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(
        new CadDerivativeError(
          504,
          'cad_derivative_timeout',
          `${basename(executable)} timed out after ${timeoutMs}ms.`,
        ),
      );
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
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
        new CadDerivativeError(
          502,
          'cad_derivative_process_failed',
          `${basename(executable)} exited with code ${code ?? 'unknown'}.`,
          {
            stdout: result.stdout.toString('utf8').slice(-4000),
            stderr: result.stderr.toString('utf8').slice(-4000),
          },
        ),
      );
    });
  });
}

function looksLikeDxf(bytes: Buffer): boolean {
  const head = bytes.subarray(0, Math.min(bytes.length, 1024)).toString('latin1');
  return /(^|\r?\n)\s*0\s*(\r?\n)\s*SECTION/i.test(head);
}

function safeSheetId(value: string): string {
  return (
    value
      .replace(/\.[^.]+$/, '')
      .replace(/[^\p{L}\p{N}._-]+/gu, '_')
      .slice(0, 96) || 'sheet'
  );
}

function toolFromDir(directory: string | undefined, binary: string) {
  return directory ? join(directory, binary) : undefined;
}

function safeDerivativeStem(metadata: LocalFileMetadata): string {
  const stem = metadata.originalName.slice(
    0,
    metadata.originalName.length - extname(metadata.originalName).length,
  );
  return safeSheetId(stem || metadata.fileId);
}
