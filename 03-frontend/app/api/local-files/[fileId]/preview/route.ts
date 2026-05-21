// app/api/local-files/[fileId]/preview/route.ts - Frontend preview policy guard
// License: Apache-2.0

import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import {
  getLocalFileMetadata,
  resolveLocalUploadStoragePath,
} from '@/lib/local-file-runtime-server';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);
const officePreviewConversions = new Map<string, Promise<string>>();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const metadata = await getLocalFileMetadata(fileId);

  if (!metadata) {
    return NextResponse.json({ error: 'file not found' }, { status: 404 });
  }

  if (!isOfficeFile(metadata.ext, metadata.mimeType)) {
    return NextResponse.json(
      {
        error: 'preview adapter not available for this file type',
        fileId: metadata.fileId,
        mimeType: metadata.mimeType,
        extension: metadata.ext,
      },
      { status: 415 },
    );
  }

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get('format') ?? 'manifest').toLowerCase();
  if (format === 'pdf') {
    try {
      const sourcePath = resolveLocalUploadStoragePath(metadata);
      const outDir = join(tmpdir(), 'architoken-office-preview', metadata.fileId);
      await mkdir(outDir, { recursive: true });
      const outputPath = officePreviewOutputPath(outDir, sourcePath);
      const cachedPdfPath = await resolveFreshConvertedPdfPath(
        outDir,
        outputPath,
        sourcePath,
      );
      if (cachedPdfPath) {
        const bytes = await readFile(cachedPdfPath);
        return officePdfResponse(bytes, 'hit');
      }

      const binary = process.env.ARCHITOKEN_LIBREOFFICE_BIN || 'libreoffice';

      let conversion = officePreviewConversions.get(metadata.fileId);
      if (!conversion) {
        conversion = convertOfficeToPdf({
          binary,
          outDir,
          outputPath,
          sourcePath,
        });
        officePreviewConversions.set(metadata.fileId, conversion);
        void conversion.then(
          () => {
            if (officePreviewConversions.get(metadata.fileId) === conversion) {
              officePreviewConversions.delete(metadata.fileId);
            }
          },
          () => {
            if (officePreviewConversions.get(metadata.fileId) === conversion) {
              officePreviewConversions.delete(metadata.fileId);
            }
          },
        );
      }

      const pdfPath = await conversion;
      const bytes = await readFile(pdfPath);
      return officePdfResponse(bytes, 'miss');
    } catch (error) {
      return NextResponse.json(
        {
          error: 'libreoffice_preview_failed',
          message: error instanceof Error ? error.message : String(error),
          fileId: metadata.fileId,
          adapters: [
            'LibreOffice headless',
            'WPS Office isolated desktop/service adapter',
            'Collabora WOPI service',
            'OnlyOffice DocumentServer',
          ],
        },
        { status: 409 },
      );
    }
  }

  return NextResponse.json(
    {
      error: 'frontend_derivative_disabled',
      fileId: metadata.fileId,
      mimeType: metadata.mimeType,
      extension: metadata.ext,
      originalName: metadata.originalName,
      operation: 'office_convert',
      requiredRuntime:
        'Backend native Office runtime must bind the original object and return an audited viewer manifest. The frontend local-file API must not create PDF/HTML/image substitutes.',
      adapters: [
        'LibreOffice headless export worker',
        'WPS Office isolated desktop/service adapter',
        'Univer document runtime',
        'MarkItDown/OOXML extractor',
      ],
    },
    { status: 409 },
  );
}

function officePreviewOutputPath(outDir: string, sourcePath: string): string {
  return join(outDir, `${basename(sourcePath).replace(/\.[^.]+$/, '')}.pdf`);
}

async function convertOfficeToPdf({
  binary,
  outDir,
  outputPath,
  sourcePath,
}: {
  binary: string;
  outDir: string;
  outputPath: string;
  sourcePath: string;
}): Promise<string> {
  const profileDir = await mkdtemp(
    join(tmpdir(), `architoken-lo-profile-${randomUUID()}-`),
  );

  try {
    await execFileAsync(binary, [
      '--nologo',
      '--nofirststartwizard',
      '--headless',
      `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
      '--convert-to',
      'pdf',
      '--outdir',
      outDir,
      sourcePath,
    ], { timeout: 300_000 });
    return resolveConvertedPdfPath(outDir, outputPath);
  } finally {
    await rm(profileDir, { recursive: true, force: true });
  }
}

async function resolveFreshConvertedPdfPath(
  outDir: string,
  expectedPath: string,
  sourcePath: string,
): Promise<string | null> {
  try {
    const pdfPath = await resolveConvertedPdfPath(outDir, expectedPath);
    const [sourceFile, pdfFile] = await Promise.all([
      stat(sourcePath),
      stat(pdfPath),
    ]);
    return pdfFile.mtimeMs >= sourceFile.mtimeMs ? pdfPath : null;
  } catch {
    return null;
  }
}

async function resolveConvertedPdfPath(
  outDir: string,
  expectedPath: string,
): Promise<string> {
  try {
    await stat(expectedPath);
    return expectedPath;
  } catch {
    const entries = await readdir(outDir);
    const pdf = entries.find((entry) => entry.toLowerCase().endsWith('.pdf'));
    if (!pdf) throw new Error('LibreOffice did not produce a PDF file.');
    return join(outDir, pdf);
  }
}

function officePdfResponse(bytes: Buffer, cacheStatus: 'hit' | 'miss') {
  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  return new NextResponse(body, {
    headers: {
      'content-type': 'application/pdf',
      'cache-control': 'no-store',
      'x-architoken-office-engine': 'libreoffice_headless',
      'x-architoken-preview-engine': 'Prengine Office PDF adapter',
      'x-architoken-preview-cache': cacheStatus,
    },
  });
}

function isOfficeFile(ext: string, mimeType: string): boolean {
  const normalizedExt = ext.toLowerCase();
  const normalizedMime = mimeType.toLowerCase();
  return (
    [
      '.doc',
      '.docx',
      '.odt',
      '.rtf',
      '.xls',
      '.xlsx',
      '.xlsm',
      '.xlsb',
      '.ods',
      '.ppt',
      '.pptx',
      '.odp',
    ].includes(normalizedExt) ||
    normalizedMime.includes('officedocument') ||
    normalizedMime.includes('opendocument') ||
    normalizedMime.includes('msword') ||
    normalizedMime.includes('application/rtf') ||
    normalizedMime.includes('ms-excel') ||
    normalizedMime.includes('ms-powerpoint')
  );
}
