// app/api/local-files/[fileId]/bom-export/route.ts - Model BOM export endpoint
// License: Apache-2.0
//
// 按源文件扩展名分发：.skp 走 SDK 实例计数/名称扫描，.ifc 走 ifcopenshell
// 几何实测。format：manifest|csv（汇总），IFC 另支持 elements-csv（构件明细）。

import { NextResponse } from "next/server";
import {
  extractIfcBomForFile,
  IfcBomExtractError,
  type IfcBomExportFormat,
} from "@/lib/ifc-bom-extract-server";
import { getLocalFileMetadata } from "@/lib/local-file-runtime-server";
import {
  extractSkpBomForFile,
  SkpBomExtractError,
} from "@/lib/skp-bom-extract-server";
import {
  extractModelBomForFile,
  ModelBomExportError,
  modelBomSupportedExt,
} from "@/lib/model-bom-export-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const url = new URL(request.url);
  const format = normalizeFormat(url.searchParams.get("format"));

  try {
    const metadata = await getLocalFileMetadata(fileId);
    if (!metadata) {
      return NextResponse.json(
        { error: "file_not_found", message: "file not found", fileId },
        { status: 404 },
      );
    }
    const ext = metadata.ext.toLowerCase();
    if (ext === ".ifc") {
      return await handleIfc(request, fileId, format, metadata.originalName);
    }
    if (ext === ".skp") {
      return await handleSkp(request, fileId, format);
    }
    if (modelBomSupportedExt(ext)) {
      return await handleModel(request, fileId, format, metadata.originalName);
    }
    return await handleSkp(request, fileId, format);
  } catch (error) {
    if (
      error instanceof SkpBomExtractError ||
      error instanceof IfcBomExtractError ||
      error instanceof ModelBomExportError
    ) {
      return NextResponse.json(
        { error: error.code, message: error.message, ...error.details },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: "bom_export_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

async function handleModel(
  _request: Request,
  fileId: string,
  format: IfcBomExportFormat,
  originalName: string,
) {
  const result = await extractModelBomForFile(fileId);
  const headers = {
    "cache-control": "private, max-age=0, must-revalidate",
    "x-architoken-file-id": fileId,
    // HTTP 头仅限 ISO-8859-1:中文链路说明放 JSON 体,头用 ASCII 标识
    "x-architoken-bom-adapter": "model-bom-chain",
    "x-architoken-cache-hit": String(result.cacheHit),
  };
  const sourceName = originalName.replace(/\.[^.]+$/, "");
  if (format === "csv") {
    if (!result.summaryCsv) {
      return NextResponse.json(
        { error: "model_bom_csv_missing", message: "该计量链未产出汇总 CSV。" },
        { status: 404, headers },
      );
    }
    return csvResponse(result.summaryCsv, `${sourceName}_BOM清单.csv`, headers);
  }
  if (format === "elements-csv") {
    if (!result.elementsCsv) {
      return NextResponse.json(
        { error: "model_bom_csv_missing", message: "该计量链未产出明细 CSV。" },
        { status: 404, headers },
      );
    }
    return csvResponse(result.elementsCsv, `${sourceName}_BOM明细.csv`, headers);
  }
  return NextResponse.json(
    { chain: result.chain, cacheHit: result.cacheHit, ...result.manifest },
    { headers },
  );
}

async function handleSkp(
  request: Request,
  fileId: string,
  format: IfcBomExportFormat,
) {
  const result = await extractSkpBomForFile(fileId);
  const headers = baseHeaders(result.etag, fileId, result.manifest.adapter);
  if (request.headers.get("if-none-match") === result.etag) {
    return new Response(null, { status: 304, headers });
  }
  if (format === "csv" || format === "elements-csv") {
    const fileName = `${result.manifest.source.originalName.replace(/\.[^.]+$/, "")}_BOM清单.csv`;
    return csvResponse(result.csv, fileName, headers);
  }
  return NextResponse.json(result.manifest, { headers });
}

async function handleIfc(
  request: Request,
  fileId: string,
  format: IfcBomExportFormat,
  originalName: string,
) {
  const result = await extractIfcBomForFile(fileId);
  const headers = {
    ...baseHeaders(result.etag, fileId, "ifc_geometry_pca_scan"),
    "x-architoken-cache-hit": String(result.cacheHit),
  };
  if (request.headers.get("if-none-match") === result.etag) {
    return new Response(null, { status: 304, headers });
  }
  const sourceName = originalName.replace(/\.[^.]+$/, "");
  if (format === "csv") {
    return csvResponse(result.summaryCsv, `${sourceName}_BOM汇总清单.csv`, headers);
  }
  if (format === "elements-csv") {
    return csvResponse(result.elementsCsv, `${sourceName}_BOM构件明细.csv`, headers);
  }
  return NextResponse.json(result.manifest, { headers });
}

function csvResponse(
  body: Buffer | string,
  fileName: string,
  headers: Record<string, string>,
) {
  const bytes = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  return new Response(new Uint8Array(bytes), {
    headers: {
      ...headers,
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}

function normalizeFormat(value: string | null): IfcBomExportFormat {
  return value === "csv" || value === "elements-csv" ? value : "manifest";
}

function baseHeaders(etag: string, fileId: string, adapter: string) {
  return {
    etag,
    "cache-control": "private, max-age=0, must-revalidate",
    "x-architoken-file-id": fileId,
    "x-architoken-bom-adapter": adapter,
  };
}
