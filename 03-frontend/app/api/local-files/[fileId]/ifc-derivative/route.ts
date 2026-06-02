// app/api/local-files/[fileId]/ifc-derivative/route.ts - IFC derivative cache endpoint
// License: Apache-2.0

import { NextResponse } from "next/server";
import {
  buildIfcDerivativeManifest,
  IfcDerivativeError,
  readIfcDerivativeBytes,
  type IfcDerivativeFormat,
} from "@/lib/ifc-derivative-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const url = new URL(request.url);
  const format = normalizeFormat(url.searchParams.get("format"));
  const tilePath = url.searchParams.get("path");

  try {
    if (format === "manifest") {
      const manifest = await buildIfcDerivativeManifest(fileId);
      if (request.headers.get("if-none-match") === manifest.etag) {
        return new Response(null, {
          status: 304,
          headers: cacheHeaders(manifest.etag, manifest.fileId),
        });
      }
      return NextResponse.json(manifest, {
        headers: cacheHeaders(manifest.etag, manifest.fileId),
      });
    }

    const derivative = await readIfcDerivativeBytes(fileId, format, tilePath);
    if (request.headers.get("if-none-match") === derivative.etag) {
      return new Response(null, {
        status: 304,
        headers: derivativeHeaders(derivative),
      });
    }

    const range = parseRangeHeader(
      request.headers.get("range"),
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
        "content-length": String(payload.byteLength),
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(derivative.fileName)}`,
        ...(range
          ? {
              "content-range": `bytes ${range.start}-${range.end}/${derivative.bytes.byteLength}`,
            }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof IfcDerivativeError) {
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
        error: "ifc_derivative_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

function normalizeFormat(value: string | null): IfcDerivativeFormat {
  if (value === "properties-index") {
    return value;
  }
  if (value === "openusd") {
    return value;
  }
  if (value === "tileset") {
    return value;
  }
  if (value === "tile") {
    return value;
  }
  if (value === "glb") {
    return value;
  }
  return "manifest";
}

function cacheHeaders(etag: string, fileId: string) {
  return {
    etag,
    "cache-control": "private, max-age=0, must-revalidate",
    "x-architoken-file-id": fileId,
    "x-architoken-cache-contract": "stream+etag+checksum",
  };
}

function derivativeHeaders(derivative: {
  mediaType: string;
  etag: string;
  cacheHit: boolean;
}) {
  return {
    "content-type": derivative.mediaType,
    etag: derivative.etag,
    "cache-control": "private, max-age=0, must-revalidate",
    "accept-ranges": "bytes",
    "x-architoken-cache-hit": String(derivative.cacheHit),
  };
}

function parseRangeHeader(
  header: string | null,
  size: number,
): { start: number; end: number } | null {
  if (!header?.startsWith("bytes=")) {
    return null;
  }
  const [startRaw, endRaw] = header.slice("bytes=".length).split("-", 2);
  const start = Number.parseInt(startRaw ?? "", 10);
  const requestedEnd = Number.parseInt(endRaw ?? "", 10);
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
