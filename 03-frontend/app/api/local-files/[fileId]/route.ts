// app/api/local-files/[fileId]/route.ts - Local file stream endpoint
// License: Apache-2.0

import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import {
  deleteLocalUpload,
  getLocalFileMetadata,
  resolveLocalUploadStoragePath,
  updateLocalUploadBytes,
} from "@/lib/local-file-runtime-server";
import { isInlineEditableCodeFile } from "@/lib/code-file-editor";

export const runtime = "nodejs";

const maxInlineEditBytes = 16 * 1024 * 1024;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const metadata = await getLocalFileMetadata(fileId);

  if (!metadata) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  const path = resolveLocalUploadStoragePath(metadata);
  const fileStat = await stat(path);
  const etag = `"sha256-${metadata.checksum ?? `${metadata.fileId}-${fileStat.size}-${fileStat.mtimeMs}`}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: cacheHeaders(metadata, etag, fileStat.mtime.toUTCString()),
    });
  }

  const range = parseRangeHeader(request.headers.get("range"), fileStat.size);
  const headers = {
    ...cacheHeaders(metadata, etag, fileStat.mtime.toUTCString()),
    "content-type": metadata.mimeType,
    "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(metadata.originalName)}`,
    "x-architoken-file-id": metadata.fileId,
    "accept-ranges": "bytes",
  };

  if (range) {
    const stream = createReadStream(path, {
      start: range.start,
      end: range.end,
    });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        ...headers,
        "content-length": String(range.end - range.start + 1),
        "content-range": `bytes ${range.start}-${range.end}/${fileStat.size}`,
      },
    });
  }

  const stream = createReadStream(path);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      ...headers,
      "content-type": metadata.mimeType,
      "content-length": String(fileStat.size),
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
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  return NextResponse.json({ file: metadata });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const existing = await getLocalFileMetadata(fileId);
  if (!existing) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }
  if (!isInlineEditableLocalFile(existing)) {
    return NextResponse.json(
      { error: "file type is not supported by inline text editing" },
      { status: 415 },
    );
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxInlineEditBytes) {
    return NextResponse.json(
      { error: "inline edit payload too large" },
      { status: 413 },
    );
  }

  const metadata = await updateLocalUploadBytes(fileId, bytes, {
    mimeType:
      request.headers.get("content-type") ?? "text/plain; charset=utf-8",
    tags: ["text-edit"],
    runtime: {
      actor: "monaco-inline-editor",
      route: "local-files/put",
      engine: "monaco-editor",
      artifact: {
        name: existing.originalName,
        role: "code_inline_writeback",
        mediaType:
          request.headers.get("content-type") ?? "text/plain; charset=utf-8",
      },
      notes: [
        "Inline code/text save-back updates the controlled local CDE object, version and checksum.",
      ],
    },
  });

  if (!metadata) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  const runtimeRecord = metadata.runtimeRecords?.at(-1);
  return NextResponse.json({
    file: metadata,
    artifact: runtimeRecord?.artifact ?? null,
    writeBack: runtimeRecord?.writeBack ?? null,
    runtimeRecord: runtimeRecord ?? null,
  });
}

function isInlineEditableLocalFile(metadata: {
  ext: string;
  mimeType: string;
  originalName: string;
}): boolean {
  return isInlineEditableCodeFile({
    ext: metadata.ext,
    mimeType: metadata.mimeType,
    originalName: metadata.originalName,
  });
}

function cacheHeaders(
  metadata: { fileId: string },
  etag: string,
  lastModified: string,
): Record<string, string> {
  return {
    etag,
    "last-modified": lastModified,
    "cache-control": "private, max-age=0, must-revalidate",
    "x-architoken-file-id": metadata.fileId,
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
