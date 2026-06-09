// app/api/local-files/[fileId]/ofd-native/route.ts - Native OFD package endpoint
// License: Apache-2.0

import { NextResponse } from "next/server";
import {
  buildOfdNativeManifest,
  OfdNativeRuntimeError,
} from "@/lib/ofd-native-runtime-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  try {
    const manifest = await buildOfdNativeManifest(fileId, request.url);
    return NextResponse.json(manifest, {
      headers: {
        "cache-control": "no-store",
        "x-architoken-ofd-runtime": manifest.viewer,
        "x-architoken-file-id": manifest.fileId,
      },
    });
  } catch (error) {
    if (error instanceof OfdNativeRuntimeError) {
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
        error: "ofd_native_runtime_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
