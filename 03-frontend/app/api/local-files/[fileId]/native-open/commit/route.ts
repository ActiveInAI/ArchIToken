// app/api/local-files/[fileId]/native-open/commit/route.ts - Commit native editor workspace edits
// License: Apache-2.0

import { NextResponse } from "next/server";
import {
  commitEngineeringNativeSession,
  EngineeringNativeSessionError,
  type EngineeringNativeExternalApp,
} from "@/lib/engineering-native-session-server";
import { appendLocalUploadRuntimeRecord } from "@/lib/local-file-runtime-server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  try {
    const body = (await request.json()) as {
      app?: unknown;
      sessionId?: unknown;
    };
    const app: EngineeringNativeExternalApp | null =
      body.app === "freecad" || body.app === "blender" ? body.app : null;
    if (!app || typeof body.sessionId !== "string" || !body.sessionId.trim()) {
      return NextResponse.json(
        { error: "app and sessionId are required" },
        { status: 400 },
      );
    }

    const result = await commitEngineeringNativeSession(fileId, {
      app,
      sessionId: body.sessionId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
    }
    if (error instanceof EngineeringNativeSessionError) {
      const failureEvidence = {
        code: "engineering_native_commit_failed",
        message: error.message,
        status: error.status,
        route: "native-open/commit",
      };
      const recorded = await appendLocalUploadRuntimeRecord(fileId, {
        actor: "engineering-native-workbench",
        route: "native-open/commit",
        status: "failed",
        adapter: "engineering-native-workbench",
        engine: "FreeCAD/Blender",
        failureEvidence,
        writeBack: { mode: "none", route: "native-open/commit" },
      });
      return NextResponse.json(
        {
          error: error.message,
          failureEvidence,
          runtimeRecord: recorded?.runtimeRecords?.at(-1) ?? null,
        },
        { status: error.status },
      );
    }
    throw error;
  }
}
