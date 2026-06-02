// app/api/local-files/[fileId]/cad-derivative/route.ts - Native CAD derivative endpoint
// License: Apache-2.0

import { NextResponse } from 'next/server';
import {
  buildCadDerivativeManifest,
  CadDerivativeError,
  readCadDerivativeBytes,
  type CadDerivativeFormat,
} from '@/lib/cad-derivative-server';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const url = new URL(request.url);
  const format = normalizeFormat(url.searchParams.get('format'));
  const sheet = url.searchParams.get('sheet');

  try {
    if (format === 'manifest') {
      const manifest = await buildCadDerivativeManifest(fileId);
      if (request.headers.get('if-none-match') === manifest.etag) {
        return new Response(null, {
          status: 304,
          headers: manifestHeaders(manifest),
        });
      }
      return NextResponse.json(manifest, { headers: manifestHeaders(manifest) });
    }

    const derivative = await readCadDerivativeBytes(fileId, format, sheet);
    if (request.headers.get('if-none-match') === derivative.etag) {
      return new Response(null, {
        status: 304,
        headers: derivativeHeaders(derivative),
      });
    }

    const range = parseRangeHeader(
      request.headers.get('range'),
      derivative.bytes.byteLength,
    );
    const payload = range
      ? derivative.bytes.subarray(range.start, range.end + 1)
      : derivative.bytes;
    const body = new Uint8Array(payload.byteLength);
    body.set(payload);
    return new Response(body, {
      status: range ? 206 : 200,
      headers: {
        ...derivativeHeaders(derivative),
        'content-length': String(payload.byteLength),
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(derivative.fileName)}`,
        ...(range
          ? {
              'content-range': `bytes ${range.start}-${range.end}/${derivative.bytes.byteLength}`,
            }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof CadDerivativeError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
          ...error.details,
        },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: 'cad_derivative_failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

function normalizeFormat(value: string | null): CadDerivativeFormat {
  if (
    value === 'dxf' ||
    value === 'pdf' ||
    value === 'svg' ||
    value === 'manifest'
  ) {
    return value;
  }
  return 'manifest';
}

function manifestHeaders(manifest: { etag: string; fileId: string }) {
  return {
    etag: manifest.etag,
    'cache-control': 'private, max-age=0, must-revalidate',
    'x-architoken-file-id': manifest.fileId,
    'x-architoken-cache-contract': 'stream+etag+checksum',
  };
}

function derivativeHeaders(derivative: {
  mediaType: string;
  engine: string;
  etag: string;
  cacheHit: boolean;
}) {
  return {
    'content-type': derivative.mediaType,
    etag: derivative.etag,
    'cache-control': 'private, max-age=0, must-revalidate',
    'accept-ranges': 'bytes',
    'x-architoken-cad-engine': derivative.engine,
    'x-architoken-cache-hit': String(derivative.cacheHit),
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
