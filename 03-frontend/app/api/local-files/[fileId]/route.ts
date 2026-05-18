// app/api/local-files/[fileId]/route.ts - Local file stream endpoint
// License: Apache-2.0

import { NextResponse } from 'next/server';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import {
  deleteLocalUpload,
  getLocalFileMetadata,
  resolveLocalUploadStoragePath,
} from '@/lib/local-file-runtime-server';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const metadata = await getLocalFileMetadata(fileId);

  if (!metadata) {
    return NextResponse.json({ error: 'file not found' }, { status: 404 });
  }

  const path = resolveLocalUploadStoragePath(metadata);
  const fileStat = await stat(path);
  const etag = `"sha256-${metadata.checksum ?? `${metadata.fileId}-${fileStat.size}-${fileStat.mtimeMs}`}"`;
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: cacheHeaders(metadata, etag, fileStat.mtime.toUTCString()),
    });
  }

  const range = parseRangeHeader(request.headers.get('range'), fileStat.size);
  const headers = {
    ...cacheHeaders(metadata, etag, fileStat.mtime.toUTCString()),
    'content-type': metadata.mimeType,
    'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(metadata.originalName)}`,
    'x-architoken-file-id': metadata.fileId,
    'accept-ranges': 'bytes',
  };

  if (range) {
    const stream = createReadStream(path, { start: range.start, end: range.end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        ...headers,
        'content-length': String(range.end - range.start + 1),
        'content-range': `bytes ${range.start}-${range.end}/${fileStat.size}`,
      },
    });
  }

  const stream = createReadStream(path);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      ...headers,
      'content-type': metadata.mimeType,
      'content-length': String(fileStat.size),
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const metadata = await deleteLocalUpload(fileId);

  if (!metadata) {
    return NextResponse.json({ error: 'file not found' }, { status: 404 });
  }

  return NextResponse.json({ file: metadata });
}

function cacheHeaders(
  metadata: { fileId: string },
  etag: string,
  lastModified: string,
): Record<string, string> {
  return {
    etag,
    'last-modified': lastModified,
    'cache-control': 'private, max-age=0, must-revalidate',
    'x-architoken-file-id': metadata.fileId,
  };
}

function parseRangeHeader(
  header: string | null,
  size: number,
): { start: number; end: number } | null {
  if (!header?.startsWith('bytes=')) {
    return null;
  }
  const [startRaw, endRaw] = header.slice('bytes='.length).split('-', 2);
  const start = Number.parseInt(startRaw ?? '', 10);
  const requestedEnd = Number.parseInt(endRaw ?? '', 10);
  if (!Number.isFinite(start) || start < 0 || start >= size) {
    return null;
  }
  const end = Number.isFinite(requestedEnd)
    ? Math.min(requestedEnd, size - 1)
    : size - 1;
  if (end < start) {
    return null;
  }
  return { start, end };
}
