// app/api/wopi/files/[fileId]/route.ts - Collabora WOPI CheckFileInfo and lock endpoints
// License: Apache-2.0

import { NextResponse } from "next/server";
import {
  buildCollaboraWopiCheckFileInfo,
  handleCollaboraWopiFileControl,
  OfficeNativeSessionError,
} from "@/lib/office-native-session-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  try {
    const info = await buildCollaboraWopiCheckFileInfo(fileId, request);
    return NextResponse.json(info, {
      headers: {
        "cache-control": "no-store",
        "x-wopi-itemversion": info.Version,
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
  const { fileId } = await params;

  try {
    const result = await handleCollaboraWopiFileControl(fileId, request);
    return new Response(null, {
      status: result.status,
      headers: result.headers,
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
      error: "collabora_wopi_failed",
      message: error instanceof Error ? error.message : String(error),
    },
    { status: 500 },
  );
}
