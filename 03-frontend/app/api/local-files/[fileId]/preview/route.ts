// app/api/local-files/[fileId]/preview/route.ts - Frontend preview policy guard
// License: Apache-2.0

import { execFile } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import {
  getLocalFileMetadata,
  resolveLocalUploadStoragePath,
} from '@/lib/local-file-runtime-server';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

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
      const binary = process.env.ARCHITOKEN_LIBREOFFICE_BIN || 'libreoffice';
      await execFileAsync(binary, [
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        outDir,
        sourcePath,
      ], { timeout: 300_000 });
      const outputPath = join(
        outDir,
        `${basename(sourcePath).replace(/\.[^.]+$/, '')}.pdf`,
      );
      const bytes = await readFile(outputPath);
      return new NextResponse(bytes, {
        headers: {
          'content-type': 'application/pdf',
          'cache-control': 'no-store',
          'x-architoken-office-engine': 'libreoffice_headless',
        },
      });
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
