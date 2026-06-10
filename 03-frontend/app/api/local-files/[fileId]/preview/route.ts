// app/api/local-files/[fileId]/preview/route.ts - Frontend preview policy guard
// License: Apache-2.0

import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import {
  getLocalFileMetadata,
  resolveLocalUploadStoragePath,
} from "@/lib/local-file-runtime-server";
import { officePdfExportFilter } from "@/lib/office-preview-policy";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const officePreviewConversions = new Map<string, Promise<string>>();
const officeCliHtmlConversions = new Map<string, Promise<string>>();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const metadata = await getLocalFileMetadata(fileId);

  if (!metadata) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  if (!isOfficeFile(metadata.ext, metadata.mimeType)) {
    return NextResponse.json(
      {
        error: "preview adapter not available for this file type",
        fileId: metadata.fileId,
        mimeType: metadata.mimeType,
        extension: metadata.ext,
      },
      { status: 415 },
    );
  }

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "manifest").toLowerCase();
  if (format === "html" || format === "officecli-html") {
    try {
      const htmlPath = await resolveOfficeCliHtmlPreview(metadata);
      const html = await readFile(htmlPath, "utf8");
      return new NextResponse(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-architoken-office-engine": "officecli",
          "x-architoken-preview-engine": "PanAEC Engine OfficeCLI HTML adapter",
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: "officecli_preview_failed",
          message: error instanceof Error ? error.message : String(error),
          fileId: metadata.fileId,
          adapters: [
            "OfficeCLI isolated worker",
            "LibreOffice headless export worker",
            "Collabora WOPI service",
            "OnlyOffice DocumentServer",
          ],
        },
        { status: 409 },
      );
    }
  }

  if (format === "pdf") {
    try {
      const sourcePath = resolveLocalUploadStoragePath(metadata);
      const outDir = join(
        tmpdir(),
        "architoken-office-preview",
        metadata.fileId,
      );
      await mkdir(outDir, { recursive: true });
      const outputPath = officePreviewOutputPath(outDir, sourcePath);
      const cachedPdfPath = await resolveFreshConvertedPdfPath(
        outDir,
        outputPath,
        sourcePath,
      );
      if (cachedPdfPath) {
        const bytes = await readFile(cachedPdfPath);
        return officePdfResponse(bytes, "hit");
      }

      const binary = process.env.ARCHITOKEN_LIBREOFFICE_BIN || "libreoffice";

      let conversion = officePreviewConversions.get(metadata.fileId);
      if (!conversion) {
        conversion = convertOfficeToPdf({
          binary,
          extension: metadata.ext,
          outDir,
          outputPath,
          sourcePath,
        });
        officePreviewConversions.set(metadata.fileId, conversion);
        void conversion.then(
          () => {
            if (officePreviewConversions.get(metadata.fileId) === conversion) {
              officePreviewConversions.delete(metadata.fileId);
            }
          },
          () => {
            if (officePreviewConversions.get(metadata.fileId) === conversion) {
              officePreviewConversions.delete(metadata.fileId);
            }
          },
        );
      }

      const pdfPath = await conversion;
      const bytes = await readFile(pdfPath);
      return officePdfResponse(bytes, "miss");
    } catch (error) {
      return NextResponse.json(
        {
          error: "libreoffice_preview_failed",
          message: error instanceof Error ? error.message : String(error),
          fileId: metadata.fileId,
          adapters: [
            "LibreOffice headless",
            "WPS Office isolated desktop/service adapter",
            "Collabora WOPI service",
            "OnlyOffice DocumentServer",
          ],
        },
        { status: 409 },
      );
    }
  }

  return NextResponse.json(
    {
      error: "frontend_derivative_disabled",
      fileId: metadata.fileId,
      mimeType: metadata.mimeType,
      extension: metadata.ext,
      originalName: metadata.originalName,
      operation: "office_convert",
      requiredRuntime:
        "Backend native Office runtime must bind the original object and return an audited viewer manifest. The frontend local-file API must not create PDF/HTML/image substitutes.",
      adapters: [
        "LibreOffice headless export worker",
        "WPS Office isolated desktop/service adapter",
        "Univer document runtime",
        "MarkItDown/OOXML extractor",
      ],
    },
    { status: 409 },
  );
}

async function resolveOfficeCliHtmlPreview(metadata: {
  fileId: string;
  originalName: string;
  ext: string;
  storagePath: string;
}): Promise<string> {
  const cacheKey = `${metadata.fileId}:html`;
  let conversion = officeCliHtmlConversions.get(cacheKey);
  if (!conversion) {
    conversion = runOfficeCliHtmlPreview(metadata);
    officeCliHtmlConversions.set(cacheKey, conversion);
    void conversion.then(
      () => {
        if (officeCliHtmlConversions.get(cacheKey) === conversion) {
          officeCliHtmlConversions.delete(cacheKey);
        }
      },
      () => {
        if (officeCliHtmlConversions.get(cacheKey) === conversion) {
          officeCliHtmlConversions.delete(cacheKey);
        }
      },
    );
  }
  return conversion;
}

async function runOfficeCliHtmlPreview(metadata: {
  fileId: string;
  originalName: string;
  ext: string;
  storagePath: string;
}): Promise<string> {
  const sourcePath = resolveLocalUploadStoragePath(metadata);
  const outputDir = join(
    tmpdir(),
    "architoken-officecli-preview",
    metadata.fileId,
  );
  await mkdir(outputDir, { recursive: true });
  const jobPath = join(outputDir, "officecli-html-job.json");
  const job = {
    job_id: `officecli-preview-${metadata.fileId}`,
    tenant_id: "local",
    project_id: "local-cde",
    actor: "frontend-preview",
    operation: "office_convert",
    source_asset_id: metadata.fileId,
    source_file_id: metadata.fileId,
    input: {
      adapter: "officecli",
      sourcePath,
      sourceFileName: metadata.originalName,
      outputDir,
      previewFormats: ["html"],
      ...(process.env.OFFICECLI_BINARY
        ? { officecliBinary: process.env.OFFICECLI_BINARY }
        : {}),
    },
  };
  await writeFile(jobPath, `${JSON.stringify(job, null, 2)}\n`, "utf8");

  const workerDir =
    process.env.ARCHITOKEN_WORKERS_DIR ??
    resolve(process.cwd(), "..", "06-workers");
  const workerBinary = process.env.ARCHITOKEN_WORKER_CLI_BINARY || "uv";
  const workerArgs =
    basename(workerBinary) === "uv"
      ? [
          "run",
          "python",
          "-m",
          "architoken_workers.worker_cli",
          "--adapter",
          "officecli",
          "--job",
          jobPath,
        ]
      : [
          "-m",
          "architoken_workers.worker_cli",
          "--adapter",
          "officecli",
          "--job",
          jobPath,
        ];
  const { stdout, stderr } = await execFileAsync(workerBinary, workerArgs, {
    cwd: workerDir,
    encoding: "utf8",
    timeout: 300_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  const result = JSON.parse(stdout) as {
    status?: string;
    error?: { code?: string; message?: string };
    artifacts?: Array<{
      role?: string;
      metadata?: { path?: string };
    }>;
  };
  if (result.status !== "completed") {
    throw new Error(
      result.error?.message ||
        result.error?.code ||
        stderr ||
        "OfficeCLI worker did not complete.",
    );
  }
  const htmlArtifact = result.artifacts?.find(
    (artifact) => artifact.role === "officecli_preview_html",
  );
  const htmlPath = htmlArtifact?.metadata?.path;
  if (!htmlPath) {
    throw new Error(
      "OfficeCLI worker completed without an HTML preview artifact.",
    );
  }
  await stat(htmlPath);
  return htmlPath;
}

function officePreviewOutputPath(outDir: string, sourcePath: string): string {
  return join(outDir, `${basename(sourcePath).replace(/\.[^.]+$/, "")}.pdf`);
}

async function convertOfficeToPdf({
  binary,
  extension,
  outDir,
  outputPath,
  sourcePath,
}: {
  binary: string;
  extension: string;
  outDir: string;
  outputPath: string;
  sourcePath: string;
}): Promise<string> {
  const profileDir = await mkdtemp(
    join(tmpdir(), `architoken-lo-profile-${randomUUID()}-`),
  );
  const exportFilter = officePdfExportFilter(extension);

  try {
    await execFileAsync(
      binary,
      [
        "--nologo",
        "--nofirststartwizard",
        "--headless",
        `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
        "--convert-to",
        exportFilter,
        "--outdir",
        outDir,
        sourcePath,
      ],
      {
        env: {
          ...process.env,
          SAL_USE_VCLPLUGIN: process.env.SAL_USE_VCLPLUGIN ?? "gen",
        },
        timeout: 300_000,
      },
    );
    return resolveConvertedPdfPath(outDir, outputPath);
  } finally {
    await rm(profileDir, { recursive: true, force: true });
  }
}

async function resolveFreshConvertedPdfPath(
  outDir: string,
  expectedPath: string,
  sourcePath: string,
): Promise<string | null> {
  try {
    const pdfPath = await resolveConvertedPdfPath(outDir, expectedPath);
    const [sourceFile, pdfFile] = await Promise.all([
      stat(sourcePath),
      stat(pdfPath),
    ]);
    return pdfFile.mtimeMs >= sourceFile.mtimeMs ? pdfPath : null;
  } catch {
    return null;
  }
}

async function resolveConvertedPdfPath(
  outDir: string,
  expectedPath: string,
): Promise<string> {
  try {
    await stat(expectedPath);
    return expectedPath;
  } catch {
    const entries = await readdir(outDir);
    const pdf = entries.find((entry) => entry.toLowerCase().endsWith(".pdf"));
    if (!pdf) throw new Error("LibreOffice did not produce a PDF file.");
    return join(outDir, pdf);
  }
}

function officePdfResponse(bytes: Buffer, cacheStatus: "hit" | "miss") {
  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  return new NextResponse(body, {
    headers: {
      "content-type": "application/pdf",
      "cache-control": "no-store",
      "x-architoken-office-engine": "libreoffice_headless",
      "x-architoken-preview-engine": "PanAEC Engine Office PDF adapter",
      "x-architoken-preview-cache": cacheStatus,
    },
  });
}

function isOfficeFile(ext: string, mimeType: string): boolean {
  const normalizedExt = ext.toLowerCase();
  const normalizedMime = mimeType.toLowerCase();
  return (
    [
      ".doc",
      ".docx",
      ".odt",
      ".rtf",
      ".xls",
      ".xlsx",
      ".xlsm",
      ".xlsb",
      ".ods",
      ".ppt",
      ".pptx",
      ".odp",
    ].includes(normalizedExt) ||
    normalizedMime.includes("officedocument") ||
    normalizedMime.includes("opendocument") ||
    normalizedMime.includes("msword") ||
    normalizedMime.includes("application/rtf") ||
    normalizedMime.includes("ms-excel") ||
    normalizedMime.includes("ms-powerpoint")
  );
}
