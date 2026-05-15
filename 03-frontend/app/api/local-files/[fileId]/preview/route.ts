// app/api/local-files/[fileId]/preview/route.ts - Frontend preview policy guard
// License: Apache-2.0

import { NextResponse } from 'next/server';
import { getLocalFileMetadata } from '@/lib/local-file-runtime-server';

export const runtime = 'nodejs';

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
