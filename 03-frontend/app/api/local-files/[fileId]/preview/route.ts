// app/api/local-files/[fileId]/preview/route.ts - Real local file preview derivatives
// License: Apache-2.0

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, copyFile } from 'node:fs/promises';
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
  _request: Request,
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

  const workdir = await mkdtemp(
    join(/* turbopackIgnore: true */ tmpdir(), 'architoken-office-preview-'),
  );
  try {
    const inputName = safePreviewName(
      metadata.originalName || basename(metadata.storagePath),
    );
    const inputPath = join(workdir, inputName);
    await copyFile(
      resolveLocalUploadStoragePath(metadata),
      /* turbopackIgnore: true */ inputPath,
    );

    await execFileAsync(
      'libreoffice',
      [
        '--headless',
        '--nologo',
        '--nofirststartwizard',
        '--convert-to',
        'pdf',
        '--outdir',
        workdir,
        inputPath,
      ],
      { timeout: 60_000 },
    );

    const outputPath = join(
      workdir,
      `${inputName.replace(/\.[^.]+$/, '')}.pdf`,
    );
    const bytes = await readFile(/* turbopackIgnore: true */ outputPath);
    return new Response(new Uint8Array(bytes), {
      headers: {
        'content-type': 'application/pdf',
        'content-length': String(bytes.byteLength),
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(`${metadata.originalName}.pdf`)}`,
        'x-architoken-preview-adapter': 'libreoffice-headless',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'LibreOffice preview conversion failed',
        detail: error instanceof Error ? error.message : String(error),
        adapter: 'libreoffice-headless',
      },
      { status: 502 },
    );
  } finally {
    await rm(/* turbopackIgnore: true */ workdir, {
      recursive: true,
      force: true,
    });
  }
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

function safePreviewName(name: string): string {
  return (
    name
      .replace(/[\\/]/g, '_')
      .replace(/[^\p{L}\p{N}._ -]/gu, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160) || 'office-file'
  );
}
