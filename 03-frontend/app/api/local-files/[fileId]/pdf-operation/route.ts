// app/api/local-files/[fileId]/pdf-operation/route.ts - Source-bound PDF operation endpoint
// License: Apache-2.0

import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import {
  normalizePdfOperationId,
  pdfOperationById,
  pdfOperationRegistry,
  pdfOperationsByCategory,
} from "@/lib/pdf-operation-registry";
import {
  appendLocalUploadRuntimeRecord,
  getLocalFileMetadata,
  resolveLocalUploadStoragePath,
  saveLocalUpload,
  updateLocalUploadBytes,
} from "@/lib/local-file-runtime-server";
import type {
  LocalFileMetadata,
  LocalFileRuntimeArtifact,
  LocalFileRuntimeFailureEvidence,
  LocalFileRuntimeRecord,
} from "@/lib/local-file-runtime";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

type PdfSaveMode = "new_file" | "overwrite" | "artifact_only";

interface PdfOperationRequest {
  pdfOperation?: unknown;
  stirlingOperationPath?: unknown;
  fields?: unknown;
  additionalFileIds?: unknown;
  outputFileName?: unknown;
  outputFormat?: unknown;
  saveMode?: unknown;
  timeoutSeconds?: unknown;
  lang?: unknown;
  paddleocrOptions?: unknown;
}

interface WorkerCliArtifact {
  name?: string;
  media_type?: string;
  role?: string;
  metadata?: {
    path?: string;
    [key: string]: unknown;
  };
}

interface WorkerCliResult {
  status?: string;
  artifacts?: WorkerCliArtifact[];
  output?: Record<string, unknown>;
  error?: {
    code?: string;
    message?: string;
    [key: string]: unknown;
  };
}

interface PdfArtifactPersistenceResult {
  savedFile: LocalFileMetadata | null;
  runtimeRecord: LocalFileRuntimeRecord | null;
}

export async function GET() {
  return NextResponse.json({
    schema: "architoken.pdf-operation-registry.v1",
    sourceOfTruth:
      "Stirling-PDF executes real PDF operations; PaddleOCR executes OCR/document-vision evidence extraction.",
    operations: pdfOperationRegistry,
    categories: pdfOperationsByCategory(),
    audit: {
      substitutePreview: false,
      requiresRealArtifactOrBlocked: true,
      ocrIsEvidenceOnly: true,
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }
  if (!isPdfSource(metadata)) {
    return NextResponse.json(
      {
        error: "pdf operation requires a PDF source file",
        fileId: metadata.fileId,
        extension: metadata.ext,
        mimeType: metadata.mimeType,
      },
      { status: 415 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as PdfOperationRequest;
  const operationRaw =
    typeof body.pdfOperation === "string" ? body.pdfOperation : "";
  const operationId = normalizePdfOperationId(operationRaw);
  const operation = pdfOperationById(operationId);
  if (!operation) {
    return NextResponse.json(
      {
        error: "unsupported pdfOperation",
        pdfOperation: operationRaw,
        supportedOperations: pdfOperationRegistry.map((item) => item.id),
      },
      { status: 400 },
    );
  }

  const additionalSourcePaths = await resolveAdditionalSourcePaths(body);
  if ("error" in additionalSourcePaths) {
    return additionalSourcePaths.error;
  }

  const outputDir = join(
    tmpdir(),
    "architoken-pdf-operation",
    `${metadata.fileId}-${operation.id}-${randomUUID()}`,
  );
  await mkdir(outputDir, { recursive: true });
  const jobPath = join(outputDir, "pdf-operation-job.json");
  const adapter =
    operation.engine === "paddleocr" ? "paddleocr" : "stirling_pdf";
  const workerOperation =
    operation.engine === "paddleocr" ? "ocr" : "pdf_parse";
  const fields = isRecord(body.fields) ? body.fields : {};
  const job = {
    job_id: `pdf-operation-${metadata.fileId}-${Date.now()}`,
    tenant_id: "local",
    project_id: "local-cde",
    actor: "frontend-pdf-operation",
    operation: workerOperation,
    source_asset_id: metadata.fileId,
    source_file_id: metadata.fileId,
    input: {
      adapter,
      sourcePath: resolveLocalUploadStoragePath(metadata),
      sourceFileName: metadata.originalName,
      outputDir,
      pdfOperation: operation.id,
      outputFormat:
        typeof body.outputFormat === "string" && body.outputFormat.trim()
          ? body.outputFormat.trim()
          : "pdf",
      fields,
      ...(additionalSourcePaths.paths.length > 0
        ? { additionalSourcePaths: additionalSourcePaths.paths }
        : {}),
      ...(typeof body.stirlingOperationPath === "string" &&
      body.stirlingOperationPath.trim()
        ? { stirlingOperationPath: body.stirlingOperationPath.trim() }
        : {}),
      ...(typeof body.timeoutSeconds === "number"
        ? { timeoutSeconds: Math.max(1, Math.floor(body.timeoutSeconds)) }
        : {}),
      ...(typeof body.lang === "string" && body.lang.trim()
        ? { lang: body.lang.trim() }
        : {}),
      ...(isRecord(body.paddleocrOptions)
        ? { paddleocrOptions: body.paddleocrOptions }
        : {}),
    },
  };
  await writeFile(jobPath, `${JSON.stringify(job, null, 2)}\n`, "utf8");

  const result = await runWorker(adapter, jobPath);
  const artifacts = await runtimeArtifactsFromWorkerResult(result);
  const missingArtifactFailure =
    result.status === "completed" && artifacts.length === 0
      ? pdfFailureEvidence({
          code: "pdf_operation_missing_artifact",
          message:
            "PDF worker reported completed but did not return any real artifact path/checksum evidence.",
          status: "completed_without_artifact",
          adapter,
          result,
        })
      : null;
  const effectiveStatus = missingArtifactFailure ? "failed" : result.status;
  const persistence =
    effectiveStatus === "completed"
      ? await persistPdfOperationArtifact({
          body,
          metadata,
          operationId: operation.id,
          adapter,
          artifacts,
          result,
        })
      : { savedFile: null, runtimeRecord: null };
  const failureEvidence =
    missingArtifactFailure ??
    (effectiveStatus === "completed"
      ? null
      : pdfFailureEvidence({
          code: result.error?.code ?? "pdf_operation_failed",
          message:
            result.error?.message ??
            `PDF worker returned ${effectiveStatus ?? "unknown"} status.`,
          status: effectiveStatus ?? "failed",
          adapter,
          result,
        }));
  const recordedFailure =
    failureEvidence && effectiveStatus !== "completed"
      ? await appendLocalUploadRuntimeRecord(metadata.fileId, {
          actor: "frontend-pdf-operation",
          route: "pdf-operation",
          status: effectiveStatus === "blocked" ? "blocked" : "failed",
          operationId: operation.id,
          adapter,
          engine: adapter,
          failureEvidence,
          writeBack: { mode: "none", route: "pdf-operation" },
        })
      : null;

  const status =
    effectiveStatus === "completed"
      ? 200
      : effectiveStatus === "blocked"
        ? 409
        : 500;
  return NextResponse.json(
    {
      schema: "architoken.pdf-operation-result.v1",
      fileId: metadata.fileId,
      operation,
      adapter,
      workerResult: result,
      artifacts,
      savedFile: persistence.savedFile,
      writeBack: persistence.runtimeRecord?.writeBack ?? null,
      failureEvidence,
      runtimeRecord:
        persistence.runtimeRecord ??
        recordedFailure?.runtimeRecords?.at(-1) ??
        null,
      audit: {
        sourceOfRecord: `/api/local-files/${encodeURIComponent(metadata.fileId)}`,
        substitutePreview: false,
        realArtifactRequired: true,
        ocrIsEvidenceOnly: operation.engine === "paddleocr",
      },
    },
    { status },
  );
}

async function runWorker(
  adapter: string,
  jobPath: string,
): Promise<WorkerCliResult> {
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
          adapter,
          "--job",
          jobPath,
        ]
      : [
          "-m",
          "architoken_workers.worker_cli",
          "--adapter",
          adapter,
          "--job",
          jobPath,
        ];
  let stdout = "";
  let stderr = "";
  try {
    const result = await execFileAsync(workerBinary, workerArgs, {
      cwd: workerDir,
      encoding: "utf8",
      timeout: 900_000,
      maxBuffer: 20 * 1024 * 1024,
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    const processError = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: string | number;
    };
    return {
      status: "failed",
      error: {
        code: "pdf_worker_process_failed",
        message: processError.message,
        status: processError.code,
        stderr: processError.stderr ?? stderr,
      },
      output: { stdout: processError.stdout ?? stdout },
    };
  }
  try {
    return JSON.parse(stdout) as WorkerCliResult;
  } catch (error) {
    return {
      status: "failed",
      error: {
        code: "invalid_worker_response",
        message: error instanceof Error ? error.message : String(error),
        stderr,
      },
      output: { stdout },
    };
  }
}

async function resolveAdditionalSourcePaths(
  body: PdfOperationRequest,
): Promise<{ paths: string[] } | { error: NextResponse }> {
  if (body.additionalFileIds === undefined) {
    return { paths: [] };
  }
  if (
    !Array.isArray(body.additionalFileIds) ||
    !body.additionalFileIds.every(
      (item): item is string => typeof item === "string",
    )
  ) {
    return {
      error: NextResponse.json(
        { error: "additionalFileIds must be a string array" },
        { status: 400 },
      ),
    };
  }
  const paths: string[] = [];
  for (const additionalFileId of body.additionalFileIds) {
    const metadata = await getLocalFileMetadata(additionalFileId);
    if (!metadata) {
      return {
        error: NextResponse.json(
          { error: "additional PDF file not found", fileId: additionalFileId },
          { status: 404 },
        ),
      };
    }
    if (!isPdfSource(metadata)) {
      return {
        error: NextResponse.json(
          {
            error: "additional file is not a PDF",
            fileId: additionalFileId,
            extension: metadata.ext,
            mimeType: metadata.mimeType,
          },
          { status: 415 },
        ),
      };
    }
    paths.push(resolveLocalUploadStoragePath(metadata));
  }
  return { paths };
}

async function persistPdfOperationArtifact(input: {
  body: PdfOperationRequest;
  metadata: LocalFileMetadata;
  operationId: string;
  adapter: string;
  artifacts: LocalFileRuntimeArtifact[];
  result: WorkerCliResult;
}): Promise<PdfArtifactPersistenceResult> {
  const saveMode = normalizeSaveMode(input.body.saveMode);
  const artifact =
    input.artifacts.find(
      (item) =>
        item.role === "pdf_derivative" || item.mediaType === "application/pdf",
    ) ?? input.artifacts[0];
  if (!artifact) {
    return { savedFile: null, runtimeRecord: null };
  }

  if (saveMode === "artifact_only") {
    const recorded = await appendLocalUploadRuntimeRecord(
      input.metadata.fileId,
      {
        actor: "frontend-pdf-operation",
        route: "pdf-operation",
        status: "completed",
        operationId: input.operationId,
        adapter: input.adapter,
        engine: input.adapter,
        artifact,
        writeBack: { mode: "none", route: "pdf-operation" },
        notes: [
          "PDF operation produced a real artifact but did not overwrite or create a CDE file because saveMode=artifact_only.",
        ],
      },
    );
    return {
      savedFile: null,
      runtimeRecord: recorded?.runtimeRecords?.at(-1) ?? null,
    };
  }
  const artifactPath = artifact.path;
  if (!artifactPath) {
    return { savedFile: null, runtimeRecord: null };
  }
  await stat(artifactPath);
  const bytes = await readFile(artifactPath);
  const mediaType = artifact.mediaType;
  if (saveMode === "overwrite") {
    if (mediaType !== "application/pdf") {
      return { savedFile: null, runtimeRecord: null };
    }
    const savedFile = await updateLocalUploadBytes(input.metadata.fileId, bytes, {
      mimeType: mediaType,
      tags: ["pdf-operation", `pdf-operation:${input.operationId}`],
      runtime: {
        actor: "frontend-pdf-operation",
        route: "pdf-operation",
        operationId: input.operationId,
        adapter: input.adapter,
        engine: input.adapter,
        artifact,
        writeBack: { mode: "overwrite", route: "pdf-operation" },
        notes: [
          "PDF operation overwrote the controlled local source with a real PDF artifact and bumped version/checksum.",
        ],
      },
    });
    return {
      savedFile,
      runtimeRecord: savedFile?.runtimeRecords?.at(-1) ?? null,
    };
  }
  const outputName =
    typeof input.body.outputFileName === "string" &&
    input.body.outputFileName.trim()
      ? input.body.outputFileName.trim()
      : derivedFileName(
          input.metadata.originalName,
          input.operationId,
          mediaType,
        );
  const savedFile = await saveLocalUpload({
    file: new File([bytes], outputName, { type: mediaType }),
    moduleId: input.metadata.moduleId,
    ...(input.metadata.parentId ? { parentId: input.metadata.parentId } : {}),
    owner: input.metadata.owner,
    tags: [
      "local-upload",
      "pdf",
      "pdf-operation",
      `pdf-operation:${input.operationId}`,
      "stirling-pdf",
    ],
  });
  const recorded = await appendLocalUploadRuntimeRecord(input.metadata.fileId, {
    actor: "frontend-pdf-operation",
    route: "pdf-operation",
    status: "completed",
    operationId: input.operationId,
    adapter: input.adapter,
    engine: input.adapter,
    artifact,
    writeBack: {
      mode: "new_file",
      route: "pdf-operation",
      fileId: savedFile.fileId,
      version: savedFile.version,
      checksum: savedFile.checksum,
      size: savedFile.size,
      tags: savedFile.tags,
    },
    notes: [
      "PDF operation persisted a real artifact as a new controlled local CDE file.",
    ],
  });
  return {
    savedFile,
    runtimeRecord: recorded?.runtimeRecords?.at(-1) ?? null,
  };
}

async function runtimeArtifactsFromWorkerResult(
  result: WorkerCliResult,
): Promise<LocalFileRuntimeArtifact[]> {
  const artifacts: LocalFileRuntimeArtifact[] = [];
  for (const artifact of result.artifacts ?? []) {
    const metadata = isRecord(artifact.metadata) ? artifact.metadata : {};
    const path = typeof metadata.path === "string" ? metadata.path : "";
    const mediaType =
      typeof artifact.media_type === "string" && artifact.media_type.trim()
        ? artifact.media_type
        : "application/octet-stream";
    const name =
      typeof artifact.name === "string" && artifact.name.trim()
        ? artifact.name
        : path
          ? basename(path)
          : "artifact.bin";
    const statResult = path ? await stat(path).catch(() => null) : null;
    const size =
      typeof metadata.sizeBytes === "number"
        ? metadata.sizeBytes
        : (statResult?.size ?? 0);
    const checksum =
      typeof metadata.sha256 === "string" && metadata.sha256.trim()
        ? metadata.sha256.trim()
        : path && statResult
          ? sha256Buffer(await readFile(path))
          : "";
    if (!checksum) {
      continue;
    }
    artifacts.push({
      name,
      role:
        typeof artifact.role === "string" && artifact.role.trim()
          ? artifact.role
          : "pdf_runtime_artifact",
      mediaType,
      size,
      checksum,
      ...(path ? { path } : {}),
      engine: "pdf-operation-worker",
      metadata: Object.fromEntries(
        Object.entries(metadata).filter(([key]) => key !== "path"),
      ),
    });
  }
  return artifacts;
}

function pdfFailureEvidence(input: {
  code: string;
  message: string;
  status: string;
  adapter: string;
  result: WorkerCliResult;
}): LocalFileRuntimeFailureEvidence {
  return {
    code: input.code,
    message: input.message,
    status: input.status,
    adapter: input.adapter,
    route: "pdf-operation",
    details: {
      workerStatus: input.result.status ?? "unknown",
      workerError: input.result.error ?? null,
      workerOutput: input.result.output ?? null,
    },
  };
}

function sha256Buffer(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeSaveMode(value: unknown): PdfSaveMode {
  if (value === "overwrite" || value === "artifact_only") {
    return value;
  }
  return "new_file";
}

function derivedFileName(
  originalName: string,
  operationId: string,
  mediaType: string,
): string {
  const extension = extensionForMediaType(mediaType);
  const base = originalName.replace(/\.[^.]+$/, "") || "document";
  return `${base}.${operationId}.${extension}`;
}

function extensionForMediaType(mediaType: string): string {
  const normalized = mediaType.toLowerCase().split(";").at(0)?.trim() ?? "";
  if (normalized === "application/pdf") return "pdf";
  if (normalized === "application/zip") return "zip";
  if (normalized === "application/json") return "json";
  if (normalized === "application/xml") return "xml";
  if (normalized === "application/epub+zip") return "epub";
  if (normalized === "application/rtf") return "rtf";
  if (normalized === "image/png") return "png";
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/svg+xml") return "svg";
  if (normalized === "text/plain") return "txt";
  if (normalized === "text/html") return "html";
  if (normalized === "text/csv") return "csv";
  if (normalized === "text/markdown") return "md";
  const guessed = extname(mediaType).replace(/^\./, "");
  return guessed || "bin";
}

function isPdfSource(
  metadata: Pick<LocalFileMetadata, "ext" | "mimeType">,
): boolean {
  const ext = metadata.ext.toLowerCase();
  const mime = metadata.mimeType.toLowerCase();
  return ext === ".pdf" || ext === ".pdfa" || mime === "application/pdf";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
