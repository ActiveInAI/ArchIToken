// app/api/local-files/[fileId]/archive-entry/route.ts - Controlled archive entry preview stream
// License: Apache-2.0

import { NextResponse } from "next/server";
import {
  ArchiveManifestError,
  extractArchiveEntryBytes,
} from "@/lib/archive-manifest-server";
import { inferMimeType } from "@/lib/local-file-runtime";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const entryName = new URL(request.url).searchParams.get("path") ?? "";
  if (!entryName.trim()) {
    return NextResponse.json(
      { error: "archive_entry_path_required", message: "path is required" },
      { status: 400 },
    );
  }

  try {
    const extraction = await extractArchiveEntryBytes(fileId, entryName);
    const fileName =
      extraction.entry.name.split("/").filter(Boolean).at(-1) ??
      extraction.entry.name;
    const body = extraction.bytes.buffer.slice(
      extraction.bytes.byteOffset,
      extraction.bytes.byteOffset + extraction.bytes.byteLength,
    ) as ArrayBuffer;

    return new NextResponse(body, {
      headers: {
        "content-type": inferMimeType(fileName),
        "content-length": String(extraction.bytes.byteLength),
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "cache-control": "private, max-age=0, must-revalidate",
        "x-architoken-file-id": extraction.manifest.fileId,
        "x-architoken-archive-entry": encodeURIComponent(extraction.entry.name),
        "x-architoken-archive-entry-sha256": extraction.sha256,
        "x-architoken-preview-engine": `controlled_archive_${extraction.engine}`,
      },
    });
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
        error: "archive_entry_extract_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
