// app/api/local-files/[fileId]/code-session/route.ts - Code editor session manifest
// License: Apache-2.0

import { NextResponse } from "next/server";
import {
  buildCodeNativeSessionManifest,
  CodeNativeSessionError,
} from "@/lib/code-native-session-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  try {
    const manifest = await buildCodeNativeSessionManifest(fileId, request.url);
    return NextResponse.json(manifest);
  } catch (error) {
    if (error instanceof CodeNativeSessionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
}
