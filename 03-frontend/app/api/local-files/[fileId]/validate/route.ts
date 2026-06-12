// app/api/local-files/[fileId]/validate/route.ts - Real file validation endpoint
// License: Apache-2.0
//
// GET ?refresh=1 强制重校验。当前支持 .ifc(本地 ifcopenshell schema/EXPRESS
// 规则校验,经 PANAEC_IFC_VALIDATE_COMMAND)。响应附带 ModuleFileValidationResult
// 兼容字段,供文件列表"校验状态"列直接消费。

import { NextResponse } from "next/server";
import {
  IfcValidateError,
  validateIfcFile,
} from "@/lib/ifc-validate-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") === "1";
  // mode=cached:只读已有报告,绝不触发新校验(供文件列表轻量查询)
  const cachedOnly = url.searchParams.get("mode") === "cached";

  try {
    const { report, cacheHit } = await validateIfcFile(fileId, {
      refresh,
      cachedOnly,
    });
    return NextResponse.json({
      fileId,
      cacheHit,
      validation: {
        status: report.status,
        validatorRef: report.validatorRef,
        reportRef: `/api/local-files/${encodeURIComponent(fileId)}/validate`,
        summary:
          report.status === "passed"
            ? `通过(${report.ifcSchema ?? "IFC"} schema/EXPRESS${
                report.idsResults?.length
                  ? ` + ${report.idsResults.length} 套 IDS 规则`
                  : " 规则"
              })`
            : `失败:${report.errorCount} 处问题${
                report.idsResults?.some(
                  (entry) => entry.status === "failed" || entry.error,
                )
                  ? "(含 IDS 规则未通过)"
                  : ""
              }`,
        checkedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      report,
    });
  } catch (error) {
    if (error instanceof IfcValidateError) {
      return NextResponse.json(
        { error: error.code, message: error.message, ...error.details },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: "ifc_validate_unexpected_error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
