// app/api/local-files/[fileId]/office-session/callback/route.ts - OnlyOffice save-back callback
// License: Apache-2.0

import { NextResponse } from "next/server";
import {
  handleOnlyOfficeSaveCallback,
  OfficeNativeSessionError,
  type OnlyOfficeCallbackPayload,
} from "@/lib/office-native-session-server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  try {
    const payload = (await request.json()) as OnlyOfficeCallbackPayload;
    const result = await handleOnlyOfficeSaveCallback(fileId, payload);
    return NextResponse.json(
      {
        error: result.onlyOfficeError,
        handled: result.handled,
        updated: result.updated,
        message: result.message,
        file: result.file ?? null,
        checksum: result.checksum ?? null,
        artifact: result.artifact ?? null,
        writeBack: result.writeBack ?? null,
        failureEvidence: result.failureEvidence ?? null,
        runtimeRecord: result.runtimeRecord ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof OfficeNativeSessionError) {
      return NextResponse.json(
        {
          error: 1,
          code: error.code,
          message: error.message,
          ...error.details,
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        error: 1,
        code: "office_native_callback_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 200 },
    );
  }
}
