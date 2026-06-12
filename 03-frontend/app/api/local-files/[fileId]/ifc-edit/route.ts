// app/api/local-files/[fileId]/ifc-edit/route.ts - IFC element write-back endpoint
// License: Apache-2.0
//
// POST { operations: [{ globalId, attributes?, propertySet? }] }
// 真实 ifcopenshell 原子编辑;走系统写回约定(同 fileId 版本递增 + 审计
// 运行时记录);checksum 变化自动失效派生/校验/BOM 缓存。

import { NextResponse } from "next/server";
import {
  applyIfcEdits,
  IfcEditError,
  type IfcEditOperation,
} from "@/lib/ifc-edit-server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  let body: { operations?: IfcEditOperation[]; actor?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "ifc_edit_invalid_json", message: "请求体必须是 JSON。" },
      { status: 400 },
    );
  }

  try {
    const { file, report } = await applyIfcEdits(
      fileId,
      body.operations ?? [],
      body.actor,
    );
    return NextResponse.json({
      fileId: file.fileId,
      version: file.version,
      checksum: file.checksum,
      size: file.size,
      applied: report.applied,
      editorRef: report.editorRef,
    });
  } catch (error) {
    if (error instanceof IfcEditError) {
      return NextResponse.json(
        { error: error.code, message: error.message, ...error.details },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: "ifc_edit_unexpected_error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
