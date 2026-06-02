// app/api/mlightcad/assets/[asset]/route.ts - MLightCAD worker asset endpoint
// License: Apache-2.0

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const allowedAssets = {
  "dxf-parser-worker.js": join(
    "node_modules",
    "@mlightcad",
    "data-model",
    "dist",
    "dxf-parser-worker.js",
  ),
  "libredwg-parser-worker.js": join(
    "node_modules",
    "@mlightcad",
    "cad-simple-viewer",
    "dist",
    "libredwg-parser-worker.js",
  ),
  "mtext-renderer-worker.js": join(
    "node_modules",
    "@mlightcad",
    "cad-simple-viewer",
    "dist",
    "mtext-renderer-worker.js",
  ),
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> },
) {
  const { asset } = await params;
  const relativePath =
    allowedAssets[asset as keyof typeof allowedAssets] ?? null;

  if (!relativePath) {
    return NextResponse.json(
      { error: "mlightcad asset is not registered" },
      { status: 404 },
    );
  }

  try {
    const bytes = await readFile(join(process.cwd(), relativePath));
    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);
    return new Response(body, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
        "x-architoken-adapter": "mlightcad-cad-viewer",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "mlightcad_asset_unavailable",
        message: error instanceof Error ? error.message : String(error),
        asset,
      },
      { status: 503 },
    );
  }
}
