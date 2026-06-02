// app/api/mlightcad/fonts/[...fontPath]/route.ts - MLightCAD CAD font endpoint
// License: Apache-2.0

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type MlightCadFontInfo = {
  name: string[];
  file: string;
  type: "mesh" | "shx" | "ttf";
  encoding?: string;
  url?: string;
};

const upstreamFontBaseUrls = [
  "https://mlightcad.gitlab.io/cad-data/fonts/",
  "https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/fonts/",
  "https://raw.githubusercontent.com/mlightcad/cad-data/main/fonts/",
] as const;
const localCadFontRoot =
  process.env.ARCHITOKEN_MLIGHTCAD_FONT_DIR ??
  join(process.cwd(), "runtime", "mlightcad", "fonts");
const fontManifestTtlMs = 10 * 60 * 1000;
const cacheHeaders = {
  "cache-control": "public, max-age=31536000, immutable",
  "x-architoken-adapter": "mlightcad-cad-viewer",
} as const;
const manifestHeaders = {
  ...cacheHeaders,
  "cache-control": "no-store",
} as const;

let cachedManifest: {
  expiresAt: number;
  fonts: MlightCadFontInfo[];
  fileMap: Map<string, MlightCadFontInfo>;
} | null = null;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fontPath: string[] }> },
) {
  const { fontPath } = await params;
  const requestedPath = fontPath.join("/");

  if (requestedPath === "fonts.json") {
    try {
      const { fonts } = await loadMlightCadFontManifest();
      return NextResponse.json(fonts, { headers: manifestHeaders });
    } catch (error) {
      return NextResponse.json(
        {
          error: "mlightcad_cad_font_manifest_unavailable",
          message: error instanceof Error ? error.message : String(error),
          required:
            "MLightCAD CAD font package is required. Do not use local UI fonts as a fallback.",
        },
        { status: 503, headers: manifestHeaders },
      );
    }
  }

  const { fileMap } = await loadMlightCadFontManifest();
  const font = fileMap.get(requestedPath);
  if (!font) {
    return NextResponse.json(
      { error: "mlightcad font is not registered" },
      { status: 404 },
    );
  }

  try {
    const bytes = await readCachedOrDownloadMlightCadFont(font.file);
    return new Response(uint8ArrayToArrayBuffer(bytes), {
      headers: {
        ...cacheHeaders,
        "content-type": contentTypeForFont(font.file),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "mlightcad_font_unavailable",
        message: error instanceof Error ? error.message : String(error),
        font: requestedPath,
      },
      { status: 503 },
    );
  }
}

async function loadMlightCadFontManifest() {
  const now = Date.now();
  if (cachedManifest && cachedManifest.expiresAt > now) {
    return cachedManifest;
  }

  const manifestBytes = await readCachedOrDownloadMlightCadFont("fonts.json");
  const parsedFonts = JSON.parse(
    new TextDecoder().decode(manifestBytes),
  ) as MlightCadFontInfo[];
  const safeFonts = dedupeMlightCadFonts(
    parsedFonts.filter(isSafeMlightCadFontInfo),
  );
  if (!safeFonts.length) {
    throw new Error("MLightCAD CAD font manifest did not contain safe fonts");
  }

  cachedManifest = {
    expiresAt: now + fontManifestTtlMs,
    fonts: safeFonts,
    fileMap: new Map(safeFonts.map((font) => [font.file, font])),
  };
  return cachedManifest;
}

function isSafeMlightCadFontInfo(font: MlightCadFontInfo): boolean {
  return (
    Array.isArray(font.name) &&
    font.name.every((name) => typeof name === "string" && name.length > 0) &&
    typeof font.file === "string" &&
    /^[^/\\]+\.(shx|woff|ttf)$/i.test(font.file) &&
    (font.type === "mesh" || font.type === "shx" || font.type === "ttf")
  );
}

function dedupeMlightCadFonts(fonts: MlightCadFontInfo[]): MlightCadFontInfo[] {
  const byFile = new Map<string, MlightCadFontInfo>();
  for (const font of fonts) {
    if (!isSafeMlightCadFontInfo(font)) continue;
    if (!byFile.has(font.file)) byFile.set(font.file, font);
  }
  return Array.from(byFile.values());
}

async function readCachedOrDownloadMlightCadFont(
  file: string,
): Promise<Uint8Array> {
  if (!isSafeMlightCadFontFile(file)) {
    throw new Error(`Unsafe MLightCAD CAD font file name: ${file}`);
  }

  const localPath = join(localCadFontRoot, file);
  try {
    const bytes = await readFile(localPath);
    return new Uint8Array(bytes);
  } catch {
    const bytes = await downloadMlightCadFont(file);
    try {
      await mkdir(localCadFontRoot, { recursive: true });
      await writeFile(localPath, bytes);
    } catch {
      // Read-only deployments can still serve the downloaded CAD font bytes.
    }
    return bytes;
  }
}

async function downloadMlightCadFont(file: string): Promise<Uint8Array> {
  const errors: string[] = [];
  for (const baseUrl of upstreamFontBaseUrls) {
    const url = upstreamFontUrl(baseUrl, file);
    try {
      const upstream = await fetch(url, { cache: "no-store" });
      if (!upstream.ok) {
        errors.push(`${url}: ${upstream.status} ${upstream.statusText}`);
        continue;
      }
      return new Uint8Array(await upstream.arrayBuffer());
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : error}`);
    }
  }

  throw new Error(
    `Failed to download MLightCAD CAD font '${file}'. ${errors.join("; ")}`,
  );
}

function upstreamFontUrl(baseUrl: string, file: string): string {
  return `${baseUrl}${encodeURIComponent(file)}`;
}

function isSafeMlightCadFontFile(file: string): boolean {
  return file === "fonts.json" || /^[^/\\]+\.(shx|woff|ttf)$/i.test(file);
}

function contentTypeForFont(file: string): string {
  const lower = file.toLowerCase();
  if (lower.endsWith(".woff")) return "font/woff";
  if (lower.endsWith(".ttf")) return "font/ttf";
  return "application/octet-stream";
}

function uint8ArrayToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const output = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(output).set(bytes);
  return output;
}
