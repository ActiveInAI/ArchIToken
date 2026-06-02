// app/api/local-files/[fileId]/office-session/route.ts - Native Office editor session endpoint
// License: Apache-2.0

import { NextResponse } from "next/server";
import {
  buildOfficeNativeSessionManifest,
  OfficeNativeSessionError,
} from "@/lib/office-native-session-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  try {
    const manifest = await buildOfficeNativeSessionManifest(
      fileId,
      request.url,
    );
    return NextResponse.json(manifest, {
      headers: {
        "cache-control": "no-store",
        "x-architoken-office-runtime": manifest.viewer,
        "x-architoken-file-id": manifest.fileId,
      },
    });
  } catch (error) {
    if (error instanceof OfficeNativeSessionError) {
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
        error: "office_native_session_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
