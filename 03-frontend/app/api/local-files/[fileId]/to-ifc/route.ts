// app/api/local-files/[fileId]/to-ifc/route.ts - 交换格式 → IFC4 派生端点
// License: Apache-2.0
//
// GET ?format=manifest:触发/查询转换(异步:就绪 200,首算 202 处理中)
// GET ?format=ifc:下载派生的真实几何 IFC4(就绪前同样 202)

import { NextResponse } from "next/server";
import {
  deriveExchangeIfc,
  ExchangeIfcError,
  readExchangeIfcBytes,
} from "@/lib/exchange-ifc-server";
import {
  derivationProcessingResponse,
  manifestInlineWaitMs,
  raceDerivationJob,
} from "@/lib/derivation-jobs-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "ifc" ? "ifc" : "manifest";

  try {
    const raced = await raceDerivationJob(
      `exchange-ifc:${fileId}`,
      () => deriveExchangeIfc(fileId),
      manifestInlineWaitMs(),
      "转 IFC 几何中(真实解析,大模型首算可能数分钟)",
    );
    if (!raced.done) {
      return derivationProcessingResponse(fileId, "to-ifc", raced.snapshot);
    }
    const result = raced.result;
    if (format === "manifest") {
      return NextResponse.json({
        schema: "architoken.exchange_ifc_manifest.v1",
        fileId,
        chain: result.chain,
        size: result.size,
        cacheHit: result.cacheHit,
        ifcUrl: `/api/local-files/${encodeURIComponent(fileId)}/to-ifc?format=ifc`,
      });
    }
    const { bytes, fileName } = await readExchangeIfcBytes(fileId);
    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);
    return new Response(body, {
      headers: {
        "content-type": "application/x-step",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "cache-control": "private, max-age=0, must-revalidate",
        "x-architoken-file-id": fileId,
      },
    });
  } catch (error) {
    if (error instanceof ExchangeIfcError) {
      return NextResponse.json(
        { error: error.code, message: error.message, ...error.details },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: "exchange_ifc_unexpected_error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
