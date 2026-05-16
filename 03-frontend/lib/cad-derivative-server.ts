// lib/cad-derivative-server.ts - Native CAD derivative runtime for local uploads
// License: Apache-2.0

import { constants } from 'node:fs';
import {
  access,
  mkdir,
  readdir,
  readFile,
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

export interface CadDerivativeSheet {
  id: string;
  name: string;
  url: string;
}

export interface CadDerivativeManifest {
  fileId: string;
  originalName: string;
  sourceFormat: string;
  viewer: 'dxf_canvas' | 'dwg_vector_pdf';
  engine: string;
  sheets: CadDerivativeSheet[];
  notes: string[];
}

export interface CadDerivativeBytes {
  bytes: Buffer;
  mediaType: string;
  fileName: string;
  engine: string;
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
  sheets: Array<{
    id: string;
    name: string;
    path: string;
  }>;
}

const dwgPdfTimeoutMs = 180_000;
const dwgDxfTimeoutMs = 120_000;

export async function buildCadDerivativeManifest(
  fileId: string,
): Promise<CadDerivativeManifest> {
  const metadata = await requireLocalCadMetadata(fileId);
  const ext = metadata.ext.toLowerCase();

  if (ext === '.dxf') {
    return {
      fileId: metadata.fileId,
      originalName: metadata.originalName,
      sourceFormat: 'dxf',
      viewer: 'dxf_canvas',
      engine: 'browser-dxf-parser',
      sheets: [
        {
          id: 'model-space',
          name: 'Model Space',
          url: `/api/local-files/${encodeURIComponent(metadata.fileId)}`,
        },
      ],
      notes: [
        'DXF is rendered from original drawing entities in the browser Canvas viewer.',
      ],
    };
  }

  if (ext === '.dwg') {
    const derivative = await ensureDwgPdfDerivative(metadata);
    return {
      fileId: metadata.fileId,
      originalName: metadata.originalName,
      sourceFormat: 'dwg',
      viewer: 'dwg_vector_pdf',
      engine: derivative.engine,
      sheets: derivative.sheets.map((sheet) => ({
        id: sheet.id,
        name: sheet.name,
        url: `/api/local-files/${encodeURIComponent(metadata.fileId)}/cad-derivative?format=pdf&sheet=${encodeURIComponent(sheet.id)}`,
      })),
      notes: [
        'DWG is opened through the installed native DDC/ODA drawing runtime and exported as vector PDF sheets.',
        'If LibreDWG or ODAFileConverter is installed, the same endpoint can also serve DXF derivatives.',
      ],
    };
  }

  throw new CadDerivativeError(
    415,
    'unsupported_cad_derivative_format',
    `Unsupported CAD derivative format: ${ext || metadata.mimeType}`,
    { extension: ext, mimeType: metadata.mimeType },
  );
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
    return { engine: 'ddc-dwgexporter', sheets: cachedSheets };
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

  return { engine: 'ddc-dwgexporter', sheets };
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
    };
  } catch {
    // Continue to converter discovery.
  }

  const sourcePath = resolveLocalUploadStoragePath(metadata);
  const converter = await resolveExecutable([
    process.env.DWG_TO_DXF_PATH,
    'dwg2dxf',
    'dwgread',
  ]);
  if (!converter) {
    throw new CadDerivativeError(
      501,
      'dwg_dxf_converter_missing',
      'No DWG to DXF converter was found. Install LibreDWG dwg2dxf/dwgread or configure DWG_TO_DXF_PATH.',
      { checked: ['DWG_TO_DXF_PATH', 'dwg2dxf', 'dwgread'] },
    );
  }

  await mkdir(derivativeDir, { recursive: true });
  if (basename(converter).toLowerCase().includes('dwgread')) {
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
  };
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

function safeDerivativeStem(metadata: LocalFileMetadata): string {
  const stem = metadata.originalName.slice(
    0,
    metadata.originalName.length - extname(metadata.originalName).length,
  );
  return safeSheetId(stem || metadata.fileId);
}
