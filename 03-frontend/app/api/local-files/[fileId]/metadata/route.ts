// app/api/local-files/[fileId]/metadata/route.ts - Local file metadata endpoint
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

  return NextResponse.json({ file: metadata });
}
