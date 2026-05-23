// app/api/local-files/[fileId]/archive-manifest/route.ts - Archive manifest endpoint
// License: Apache-2.0

import { NextResponse } from "next/server";
import {
  ArchiveManifestError,
  buildArchiveManifest,
} from "@/lib/archive-manifest-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  try {
    const manifest = await buildArchiveManifest(fileId);
    if (request.headers.get("if-none-match") === manifest.etag) {
      return new Response(null, {
        status: 304,
        headers: manifestHeaders(manifest),
      });
    }
    return NextResponse.json(manifest, { headers: manifestHeaders(manifest) });
  } catch (error) {
    if (error instanceof ArchiveManifestError) {
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
        error: "archive_manifest_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

function manifestHeaders(manifest: { etag: string; fileId: string }) {
  return {
    etag: manifest.etag,
    "cache-control": "private, max-age=0, must-revalidate",
    "x-architoken-file-id": manifest.fileId,
    "x-architoken-cache-contract": "stream+etag+checksum",
  };
}
