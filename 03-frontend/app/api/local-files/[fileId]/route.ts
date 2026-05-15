// app/api/local-files/[fileId]/route.ts - Local file stream endpoint
// License: Apache-2.0

import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { getLocalFileMetadata, resolveLocalUploadStoragePath } from '@/lib/local-file-runtime-server';

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

  const bytes = await readFile(resolveLocalUploadStoragePath(metadata));
  return new Response(new Blob([bytes], { type: metadata.mimeType }), {
    headers: {
      'content-type': metadata.mimeType,
      'content-length': String(metadata.size),
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(metadata.originalName)}`,
      'x-architoken-file-id': metadata.fileId,
    },
  });
}
