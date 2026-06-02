// app/api/local-files/[fileId]/code-session/commit/route.ts - Commit code-server workspace edits
// License: Apache-2.0

import { NextResponse } from "next/server";
import {
  CodeNativeSessionError,
  commitCodeServerSession,
} from "@/lib/code-native-session-server";
import { appendLocalUploadRuntimeRecord } from "@/lib/local-file-runtime-server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  try {
    const body = (await request.json()) as { sessionId?: string };
    if (!body.sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 },
      );
    }
    const result = await commitCodeServerSession(fileId, {
      sessionId: body.sessionId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
    }
    if (error instanceof CodeNativeSessionError) {
      const failureEvidence = {
        code: "code_session_commit_failed",
        message: error.message,
        status: error.status,
        adapter: "code-server",
        route: "code-session/commit",
      };
      const recorded = await appendLocalUploadRuntimeRecord(fileId, {
        actor: "code-server-sidecar",
        route: "code-session/commit",
        status: "failed",
        adapter: "code-server",
        engine: "code-server",
        failureEvidence,
        writeBack: { mode: "none", route: "code-session/commit" },
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
