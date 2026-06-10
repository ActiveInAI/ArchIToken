// lib/code-native-session-server.ts - Source-bound code editor session manifests
// License: Apache-2.0

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  codeEditingRuntimeReferences,
  codeEditingRuntimeVersions,
  isInlineEditableCodeFile,
  mimeTypeForCodeEditorContent,
} from "./code-file-editor";
import type { LocalFileMetadata } from "./local-file-runtime";
import {
  getLocalFileMetadata,
  resolveLocalUploadStoragePath,
  updateLocalUploadBytes,
} from "./local-file-runtime-server";
import type {
  LocalFileRuntimeArtifact,
  LocalFileRuntimeRecord,
  LocalFileRuntimeWriteBack,
} from "./local-file-runtime";

export type CodeEditorProvider = "auto" | "monaco" | "code-server";
export type CodeNativeViewer =
  | "monaco_inline_editor"
  | "code_server_sidecar"
  | "code_runtime_required";

export interface CodeNativeAdapterProbe {
  id: string;
  label: string;
  version: string;
  status: "available" | "missing" | "inline";
  licenseBoundary:
    | "frontend_runtime_dependency"
    | "isolated_sidecar_service"
    | "source_build_worker_or_wasm_parser";
  sourceUrl: string;
  installHint: string;
  endpoint?: string;
}

export interface CodeServerSidecarSession {
  version: string;
  baseUrl: string;
  launchUrl: string;
  sessionId: string;
  workspaceFolder: string;
  workspaceFilePath: string;
  commitUrl: string;
  workspacePolicy: "session_workspace_required";
  saveBackPolicy: "cde_put_required";
}

export interface MonacoInlineSession {
  version: string;
  sourceUrl: string;
}

export interface CodeNativeSessionManifest {
  schema: "architoken.code_native_session.v1";
  fileId: string;
  originalName: string;
  sourceFormat: string;
  sourceChecksum: string;
  sourceOfRecord: {
    url: string;
    checksum: string;
    substitutePreview: false;
  };
  viewer: CodeNativeViewer;
  engine: "PanAEC Engine Code Native";
  canEdit: boolean;
  canSaveBack: boolean;
  monaco?: MonacoInlineSession;
  codeServer?: CodeServerSidecarSession;
  adapters: CodeNativeAdapterProbe[];
  notes: string[];
}

export interface CodeNativeCommitResult {
  schema: "architoken.code_native_commit.v1";
  updated: boolean;
  fileId: string;
  file: LocalFileMetadata;
  sessionId: string;
  version: string;
  checksum: string;
  workspaceChecksum: string;
  workspaceFilePath: string;
  artifact: LocalFileRuntimeArtifact;
  writeBack: LocalFileRuntimeWriteBack;
  runtimeRecord: LocalFileRuntimeRecord;
  message: string;
}

export class CodeNativeSessionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CodeNativeSessionError";
    this.status = status;
  }
}

const maxCodeServerCommitBytes = 16 * 1024 * 1024;

export async function buildCodeNativeSessionManifest(
  fileId: string,
  requestUrl: string,
): Promise<CodeNativeSessionManifest> {
  const metadata = await requireCodeMetadata(fileId);
  const origin = publicOriginFromRequest(requestUrl);
  const sourceUrl = `${origin}/api/local-files/${encodeURIComponent(metadata.fileId)}`;
  const adapters = codeNativeAdapterProbes();
  const provider = configuredCodeEditorProvider();
  const codeServerUrl = configuredCodeServerUrl();

  if (provider === "code-server" && codeServerUrl) {
    const codeServer = await materializeCodeServerSession(metadata, {
      origin,
      baseUrl: codeServerUrl,
    });
    return {
      schema: "architoken.code_native_session.v1",
      fileId: metadata.fileId,
      originalName: metadata.originalName,
      sourceFormat: metadata.ext.toLowerCase().replace(/^\./, "") || "text",
      sourceChecksum: metadata.checksum,
      sourceOfRecord: {
        url: sourceUrl,
        checksum: metadata.checksum,
        substitutePreview: false,
      },
      viewer: "code_server_sidecar",
      engine: "PanAEC Engine Code Native",
      canEdit: true,
      canSaveBack: true,
      codeServer,
      adapters,
      notes: [
        "code-server follows the Collabora-style sidecar boundary: the editor is external, and ArchIToken remains the CDE source of record.",
        "The sidecar edits a session workspace copy. Saving as CDE evidence requires POSTing the session commit endpoint so ArchIToken updates file version, checksum and tags.",
      ],
    };
  }

  return {
    schema: "architoken.code_native_session.v1",
    fileId: metadata.fileId,
    originalName: metadata.originalName,
    sourceFormat: metadata.ext.toLowerCase().replace(/^\./, "") || "text",
    sourceChecksum: metadata.checksum,
    sourceOfRecord: {
      url: sourceUrl,
      checksum: metadata.checksum,
      substitutePreview: false,
    },
    viewer: "monaco_inline_editor",
    engine: "PanAEC Engine Code Native",
    canEdit: true,
    canSaveBack: true,
    monaco: {
      version: codeEditingRuntimeVersions.monacoEditor,
      sourceUrl,
    },
    adapters,
    notes: [
      "Monaco handles local inline code editing in the CDE workbench; save-back uses /api/local-files/{fileId} PUT with version/checksum updates.",
      "Tree-sitter v0.26.9 is the selected source-build route for deeper syntax tree and worker-side code intelligence.",
    ],
  };
}

export async function commitCodeServerSession(
  fileId: string,
  input: { sessionId: string },
): Promise<CodeNativeCommitResult> {
  const metadata = await requireCodeMetadata(fileId);
  const expectedSessionId = codeServerSessionId(metadata);
  if (input.sessionId !== expectedSessionId) {
    throw new CodeNativeSessionError(
      "code-server session no longer matches the current CDE source checksum",
      409,
    );
  }

  const workspaceFilePath = hostWorkspaceFilePath(metadata, expectedSessionId);
  const bytes = await readFile(workspaceFilePath);
  if (bytes.byteLength > maxCodeServerCommitBytes) {
    throw new CodeNativeSessionError("code-server edit payload too large", 413);
  }

  const updated = await updateLocalUploadBytes(fileId, bytes, {
    mimeType: mimeTypeForCodeEditorContent({
      name: metadata.originalName,
      mimeType: metadata.mimeType,
    }),
    tags: ["code-server-edit"],
    runtime: {
      actor: "code-server-sidecar",
      route: "code-session/commit",
      engine: "code-server",
      artifact: {
        name: metadata.originalName,
        role: "code_server_workspace_writeback",
        mediaType: mimeTypeForCodeEditorContent({
          name: metadata.originalName,
          mimeType: metadata.mimeType,
        }),
        path: workspaceFilePath,
      },
      notes: [
        "code-server edits a session workspace copy; this commit imports the edited bytes as a new CDE version.",
      ],
    },
  });
  if (!updated) {
    throw new CodeNativeSessionError("file not found", 404);
  }
  const runtimeRecord = updated.runtimeRecords?.at(-1);
  if (!runtimeRecord?.artifact || !runtimeRecord.writeBack) {
    throw new CodeNativeSessionError(
      "code-server commit did not produce runtime evidence",
      500,
    );
  }
  return {
    schema: "architoken.code_native_commit.v1",
    updated: true,
    fileId: updated.fileId,
    file: updated,
    sessionId: input.sessionId,
    version: updated.version,
    checksum: updated.checksum,
    workspaceChecksum: runtimeRecord.artifact.checksum,
    workspaceFilePath,
    artifact: runtimeRecord.artifact,
    writeBack: runtimeRecord.writeBack,
    runtimeRecord,
    message: `已导入 code-server 工作区并生成 ${updated.version}。`,
  };
}

export function codeNativeAdapterProbes(): CodeNativeAdapterProbe[] {
  const monaco = codeEditingRuntimeReferences.find(
    (item) => item.id === "monaco-editor",
  )!;
  const codeServer = codeEditingRuntimeReferences.find(
    (item) => item.id === "code-server",
  )!;
  const treeSitter = codeEditingRuntimeReferences.find(
    (item) => item.id === "tree-sitter",
  )!;
  const codeServerUrl = configuredCodeServerUrl();
  const provider = configuredCodeEditorProvider();

  return [
    {
      id: monaco.id,
      label: "Monaco Editor",
      version: monaco.version,
      status: "inline",
      licenseBoundary: monaco.boundary,
      sourceUrl: monaco.sourceUrl,
      installHint: "Pinned npm runtime dependency: monaco-editor@0.55.1",
    },
    {
      id: codeServer.id,
      label: "code-server",
      version: codeServer.version,
      status:
        provider === "code-server" && codeServerUrl ? "available" : "missing",
      licenseBoundary: codeServer.boundary,
      sourceUrl: codeServer.sourceUrl,
      installHint:
        "Run docker compose --profile code-editor up -d code-server, or set CODE_SERVER_URL to an isolated service.",
      ...(codeServerUrl ? { endpoint: codeServerUrl } : {}),
    },
    {
      id: treeSitter.id,
      label: "tree-sitter",
      version: treeSitter.version,
      status: "missing",
      licenseBoundary: treeSitter.boundary,
      sourceUrl: treeSitter.sourceUrl,
      installHint:
        "Build with uv run architoken-source-build build tree-sitter --root /tmp/architoken-source-builds.",
    },
  ];
}

async function materializeCodeServerSession(
  metadata: LocalFileMetadata,
  input: { origin: string; baseUrl: string },
): Promise<CodeServerSidecarSession> {
  const sessionId = codeServerSessionId(metadata);
  const workspaceFolder = codeServerWorkspaceFolder(sessionId);
  const workspaceFilePath = `${workspaceFolder}/${safeWorkspaceFileName(metadata.originalName)}`;
  const hostFolder = hostWorkspaceFolder(sessionId);
  const hostFile = hostWorkspaceFilePath(metadata, sessionId);
  const sourceBytes = await readFile(resolveLocalUploadStoragePath(metadata));

  await mkdir(hostFolder, { recursive: true });
  if (!(await fileExists(hostFile))) {
    await writeFile(hostFile, sourceBytes);
  }
  await writeFile(
    join(hostFolder, ".architoken-code-session.json"),
    `${JSON.stringify(
      {
        schema: "architoken.code_server_workspace.v1",
        fileId: metadata.fileId,
        originalName: metadata.originalName,
        sourceChecksum: metadata.checksum,
        workspaceFilePath,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return {
    version: codeEditingRuntimeVersions.codeServer,
    baseUrl: input.baseUrl,
    launchUrl: codeServerLaunchUrl(input.baseUrl, workspaceFolder),
    sessionId,
    workspaceFolder,
    workspaceFilePath,
    commitUrl: `${input.origin}/api/local-files/${encodeURIComponent(metadata.fileId)}/code-session/commit`,
    workspacePolicy: "session_workspace_required",
    saveBackPolicy: "cde_put_required",
  };
}

async function requireCodeMetadata(fileId: string): Promise<LocalFileMetadata> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new CodeNativeSessionError("file not found", 404);
  }
  if (
    !isInlineEditableCodeFile({
      ext: metadata.ext,
      mimeType: metadata.mimeType,
      originalName: metadata.originalName,
    })
  ) {
    throw new CodeNativeSessionError(
      "file type is not supported by code native editing",
      415,
    );
  }
  return metadata;
}

function configuredCodeEditorProvider(): CodeEditorProvider {
  const value = (process.env.ARCHITOKEN_CODE_EDITOR_PROVIDER ?? "monaco")
    .trim()
    .toLowerCase();
  return value === "auto" || value === "code-server" || value === "monaco"
    ? value
    : "monaco";
}

function configuredCodeServerUrl(): string {
  return trimTrailingSlash(process.env.CODE_SERVER_URL ?? "");
}

function codeServerLaunchUrl(baseUrl: string, workspaceFolder: string): string {
  return `${trimTrailingSlash(baseUrl)}/?folder=${encodeURIComponent(workspaceFolder)}`;
}

function codeServerWorkspaceFolder(sessionId: string): string {
  return `${configuredCodeServerWorkspaceMount()}/${sessionId}`;
}

function hostWorkspaceFolder(sessionId: string): string {
  return join(configuredCodeServerWorkspaceRoot(), sessionId);
}

function hostWorkspaceFilePath(
  metadata: Pick<LocalFileMetadata, "originalName">,
  sessionId: string,
): string {
  return join(
    hostWorkspaceFolder(sessionId),
    safeWorkspaceFileName(metadata.originalName),
  );
}

function codeServerSessionId(metadata: LocalFileMetadata): string {
  return [
    "code",
    metadata.fileId.replace(/[^a-zA-Z0-9_.-]/g, "_"),
    metadata.checksum.slice(0, 12),
  ].join("-");
}

function safeWorkspaceFileName(name: string): string {
  return (
    basename(name)
      .replace(/[\\/]/g, "_")
      .replace(/[^\p{L}\p{N}._ -]/gu, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160) || "source.txt"
  );
}

function configuredCodeServerWorkspaceRoot(): string {
  return resolve(
    process.env.ARCHITOKEN_CODE_SERVER_WORKSPACE_DIR?.trim() ||
      join(tmpdir(), "architoken-code-workspaces"),
  );
}

function configuredCodeServerWorkspaceMount(): string {
  return trimTrailingSlash(
    process.env.CODE_SERVER_WORKSPACE_MOUNT || "/home/coder/project",
  );
}

function publicOriginFromRequest(requestUrl: string): string {
  const configured = trimTrailingSlash(process.env.ARCHITOKEN_PUBLIC_BASE_URL);
  if (configured) return configured;
  return new URL(requestUrl).origin;
}

function trimTrailingSlash(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
