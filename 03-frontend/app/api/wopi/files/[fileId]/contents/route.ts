// app/api/wopi/files/[fileId]/contents/route.ts - Collabora WOPI file contents endpoints
// License: Apache-2.0

import { NextResponse } from "next/server";
import {
  OfficeNativeSessionError,
  readCollaboraWopiFileContents,
  writeCollaboraWopiFileContents,
} from "@/lib/office-native-session-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  try {
    const contents = await readCollaboraWopiFileContents(fileId, request);
    const body = new ArrayBuffer(contents.bytes.byteLength);
    new Uint8Array(body).set(contents.bytes);
    return new Response(body, {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-type": contents.mimeType,
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(contents.fileName)}`,
        "x-wopi-itemversion": contents.version,
      },
    });
  } catch (error) {
    return wopiErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  return putContents(request, await params);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  return putContents(request, await params);
}

async function putContents(
  request: Request,
  params: { fileId: string },
): Promise<Response> {
  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    const result = await writeCollaboraWopiFileContents(
      params.fileId,
      request,
      bytes,
    );
    return new Response(null, {
      status: result.updated ? 200 : 500,
      headers: {
        "x-wopi-itemversion": result.version,
        "x-architoken-checksum": result.checksum,
      },
    });
  } catch (error) {
    return wopiErrorResponse(error);
  }
}

function wopiErrorResponse(error: unknown): Response {
  if (error instanceof OfficeNativeSessionError) {
    const headers: HeadersInit = {};
    if (typeof error.details.lock === "string") {
      headers["x-wopi-lock"] = error.details.lock;
    }
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
        ...error.details,
      },
      {
        status: error.status,
        headers,
      },
    );
  }
  return NextResponse.json(
    {
      error: "collabora_wopi_contents_failed",
      message: error instanceof Error ? error.message : String(error),
    },
    { status: 500 },
  );
}
