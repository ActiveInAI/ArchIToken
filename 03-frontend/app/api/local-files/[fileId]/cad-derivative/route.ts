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
      return NextResponse.json(await buildCadDerivativeManifest(fileId));
    }

    const derivative = await readCadDerivativeBytes(fileId, format, sheet);
    const body = new Uint8Array(derivative.bytes.byteLength);
    body.set(derivative.bytes);
    return new Response(body, {
      headers: {
        'content-type': derivative.mediaType,
        'content-length': String(derivative.bytes.byteLength),
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(derivative.fileName)}`,
        'x-architoken-cad-engine': derivative.engine,
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
  if (value === 'dxf' || value === 'pdf' || value === 'manifest') {
    return value;
  }
  return 'manifest';
}
