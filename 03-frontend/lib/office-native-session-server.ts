// lib/office-native-session-server.ts - Source-bound native Office editing sessions
// License: Apache-2.0

import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  appendLocalUploadRuntimeRecord,
  getLocalFileMetadata,
  resolveLocalUploadStoragePath,
  updateLocalUploadBytes,
} from "./local-file-runtime-server";
import type {
  LocalFileMetadata,
  LocalFileRuntimeArtifact,
  LocalFileRuntimeFailureEvidence,
  LocalFileRuntimeRecord,
  LocalFileRuntimeWriteBack,
} from "./local-file-runtime";
import {
  officePreviewFamilyForExtension,
  type OfficePreviewFamily,
} from "./office-preview-policy";

export type OfficeNativeViewer =
  | "onlyoffice_editor"
  | "collabora_wopi_editor"
  | "office_runtime_required";

export interface OfficeNativeAdapterProbe {
  id: string;
  label: string;
  status: "available" | "missing" | "pending_wopi_host";
  licenseBoundary: "sidecar_service" | "external_service";
  sourceUrl: string;
  installHint: string;
  endpoint?: string;
}

export interface OnlyOfficeEditorConfig {
  type: "desktop";
  documentType: "word" | "cell" | "slide" | "pdf";
  document: {
    fileType: string;
    isForm?: boolean;
    key: string;
    title: string;
    url: string;
    permissions: {
      edit: boolean;
      download: boolean;
      print: boolean;
      review: boolean;
      comment: boolean;
    };
    info: {
      owner: string;
      uploaded: string;
    };
  };
  editorConfig: {
    mode: "edit";
    lang: string;
    callbackUrl: string;
    user: {
      id: string;
      name: string;
    };
    customization: {
      autosave: boolean;
      forcesave: boolean;
      compactToolbar: boolean;
      help: boolean;
      feedback: boolean;
    };
  };
  token?: string;
}

export interface OnlyOfficeNativeSession {
  apiScriptUrl: string;
  documentServerUrl: string;
  config: OnlyOfficeEditorConfig;
}

export interface CollaboraNativeSession {
  documentServerUrl: string;
  editorUrl: string;
  wopiSrc: string;
  accessToken: string;
  accessTokenTtl: number;
  mode: "edit";
}

export interface OfficeNativeSessionManifest {
  schema: "architoken.office_native_session.v1";
  fileId: string;
  originalName: string;
  sourceFormat: string;
  sourceChecksum: string;
  sourceOfRecord: {
    url: string;
    checksum: string;
    substitutePreview: false;
  };
  viewer: OfficeNativeViewer;
  engine: "PanAEC Engine Office Native";
  canEdit: boolean;
  canSaveBack: boolean;
  onlyoffice?: OnlyOfficeNativeSession;
  collabora?: CollaboraNativeSession;
  adapters: OfficeNativeAdapterProbe[];
  notes: string[];
}

export interface OnlyOfficeCallbackPayload {
  status?: number;
  url?: string;
  key?: string;
  token?: string;
  error?: number;
}

export interface OfficeNativeSaveResult {
  handled: boolean;
  updated: boolean;
  onlyOfficeError: number;
  message: string;
  file?: LocalFileMetadata;
  checksum?: string;
  artifact?: LocalFileRuntimeArtifact;
  writeBack?: LocalFileRuntimeWriteBack;
  failureEvidence?: LocalFileRuntimeFailureEvidence;
  runtimeRecord?: LocalFileRuntimeRecord;
}

export interface CollaboraWopiCheckFileInfo {
  BaseFileName: string;
  OwnerId: string;
  Size: number;
  UserId: string;
  UserFriendlyName: string;
  Version: string;
  UserCanWrite: boolean;
  SupportsLocks: boolean;
  SupportsUpdate: boolean;
  UserCanNotWriteRelative: boolean;
  PostMessageOrigin: string;
  LastModifiedTime: string;
}

export interface CollaboraWopiContents {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
  version: string;
}

export interface CollaboraWopiMutationResult {
  updated: boolean;
  version: string;
  checksum: string;
  message: string;
  artifact?: LocalFileRuntimeArtifact;
  writeBack?: LocalFileRuntimeWriteBack;
  runtimeRecord?: LocalFileRuntimeRecord;
}

export interface CollaboraWopiControlResult {
  status: number;
  headers: Record<string, string>;
  message: string;
}

type NativeOfficeFamily = OfficePreviewFamily | "pdf";
type OnlyOfficeFamily = "document" | "spreadsheet" | "presentation" | "pdf";
type OfficeEditorProvider = "auto" | "collabora" | "onlyoffice";

const collaboraNativeFamilies = new Set<NativeOfficeFamily>([
  "document",
  "spreadsheet",
  "presentation",
  "drawing",
  "database",
  "pdf",
]);
const onlyOfficeNativeFamilies = new Set<NativeOfficeFamily>([
  "document",
  "spreadsheet",
  "presentation",
  "pdf",
]);
const collaboraDiscoveryGatedFamilies = new Set<NativeOfficeFamily>(["ofd"]);
const defaultCollaboraUiDefaults =
  "UIMode=notebookbar;TextSidebar=false;SpreadsheetSidebar=false;PresentationSidebar=false";

export async function buildOfficeNativeSessionManifest(
  fileId: string,
  requestUrl: string,
): Promise<OfficeNativeSessionManifest> {
  const metadata = await requireOfficeMetadata(fileId);
  const origin = publicOriginFromRequest(requestUrl);
  const sourceUrl = `${origin}/api/local-files/${encodeURIComponent(metadata.fileId)}`;
  const adapters = officeNativeAdapterProbes();
  const provider = configuredOfficeEditorProvider();
  const collaboraUrl = configuredCollaboraOnlineUrl();
  const onlyOfficeUrl = configuredOnlyOfficeDocumentServerUrl();
  const collaboraSupport =
    provider !== "onlyoffice" && collaboraUrl
      ? await collaboraSupportForMetadata(metadata, collaboraUrl)
      : { supported: false, notes: [] as string[] };

  if (
    provider !== "onlyoffice" &&
    collaboraUrl &&
    configuredCollaboraWopiSecret() &&
    collaboraSupport.supported
  ) {
    const family = nativeOfficeFamilyForExtension(metadata.ext);
    const collabora = collaboraNativeSession(metadata, {
      origin,
      documentServerUrl: collaboraUrl,
    });
    return {
      schema: "architoken.office_native_session.v1",
      fileId: metadata.fileId,
      originalName: metadata.originalName,
      sourceFormat: metadata.ext.toLowerCase().replace(/^\./, ""),
      sourceChecksum: metadata.checksum,
      sourceOfRecord: {
        url: sourceUrl,
        checksum: metadata.checksum,
        substitutePreview: false,
      },
      viewer: "collabora_wopi_editor",
      engine: "PanAEC Engine Office Native",
      canEdit: true,
      canSaveBack: true,
      collabora,
      adapters,
      notes: [
        "Collabora Online is used as an isolated WOPI native Office editor; the uploaded Office/PDF object remains the source of record.",
        "WOPI PutFile writes edited bytes back into the local controlled object and bumps its version.",
        "MinerU remains the document-intelligence parser for PDF/Office Markdown, JSON, OCR, tables, formulas and RAG artifacts; it is not used as the online editor.",
        ...(family === "pdf"
          ? [
              "Collabora Online exposes PDF through its view/comment route. Full PDF content editing remains gated to a dedicated PDF service adapter such as Stirling-PDF, MuPDF/PDFium, or a licensed PDF editor.",
            ]
          : []),
        ...legacyOfficeFormatNotes(metadata.ext),
        ...collaboraSupport.notes,
      ],
    };
  }

  if (
    provider !== "collabora" &&
    onlyOfficeUrl &&
    canUseOnlyOfficeMetadata(metadata)
  ) {
    const config = onlyOfficeEditorConfig(metadata, {
      origin,
      documentServerUrl: onlyOfficeUrl,
      sourceUrl,
    });
    const signedConfig = signOnlyOfficeConfig(config);
    return {
      schema: "architoken.office_native_session.v1",
      fileId: metadata.fileId,
      originalName: metadata.originalName,
      sourceFormat: metadata.ext.toLowerCase().replace(/^\./, ""),
      sourceChecksum: metadata.checksum,
      sourceOfRecord: {
        url: sourceUrl,
        checksum: metadata.checksum,
        substitutePreview: false,
      },
      viewer: "onlyoffice_editor",
      engine: "PanAEC Engine Office Native",
      canEdit: true,
      canSaveBack: true,
      onlyoffice: {
        apiScriptUrl: `${onlyOfficeUrl}/web-apps/apps/api/documents/api.js`,
        documentServerUrl: onlyOfficeUrl,
        config: signedConfig,
      },
      adapters,
      notes: [
        "OnlyOffice DocumentServer is used as an isolated native Office editor; the original Office object remains the source of record.",
        ...legacyOfficeFormatNotes(metadata.ext),
        "Save callbacks write the edited Office binary back into the local controlled object and bump its version.",
      ],
    };
  }

  return {
    schema: "architoken.office_native_session.v1",
    fileId: metadata.fileId,
    originalName: metadata.originalName,
    sourceFormat: metadata.ext.toLowerCase().replace(/^\./, ""),
    sourceChecksum: metadata.checksum,
    sourceOfRecord: {
      url: sourceUrl,
      checksum: metadata.checksum,
      substitutePreview: false,
    },
    viewer: "office_runtime_required",
    engine: "PanAEC Engine Office Native",
    canEdit: false,
    canSaveBack: false,
    adapters,
    notes: [
      "Office/OFD/ODF online editing requires a native service adapter. Configure COLLABORA_ONLINE_URL with COLLABORA_WOPI_TOKEN_SECRET for the preferred Collabora WOPI route, or explicitly select ONLYOFFICE_DOCUMENT_SERVER_URL for supported Office formats; browser-side HTML/table extraction is read-only and must not be treated as native editing.",
      ...collaboraSupport.notes,
    ],
  };
}

export async function handleOnlyOfficeSaveCallback(
  fileId: string,
  payload: OnlyOfficeCallbackPayload,
): Promise<OfficeNativeSaveResult> {
  const metadata = await requireOfficeMetadata(fileId);
  if (!isOnlyOfficeSaveStatus(payload.status)) {
    const runtimeRecord = await appendOfficeRuntimeRecord(metadata, {
      route: "office-session/callback",
      status: "skipped",
      adapter: "onlyoffice",
      engine: "OnlyOffice DocumentServer",
      writeBack: {
        mode: "none",
        route: "office-session/callback",
      },
      notes: [
        `OnlyOffice status ${payload.status ?? "unknown"} does not require source write-back.`,
      ],
    });
    return {
      handled: true,
      updated: false,
      onlyOfficeError: 0,
      message: `OnlyOffice status ${payload.status ?? "unknown"} does not require save-back.`,
      ...(runtimeRecord ? { runtimeRecord } : {}),
    };
  }

  const verification = verifyOnlyOfficeCallback(payload);
  if (!verification.ok) {
    const failureEvidence = officeFailureEvidence(
      "onlyoffice_callback_token_invalid",
      verification.message,
      "onlyoffice",
    );
    const runtimeRecord = await appendOfficeRuntimeRecord(metadata, {
      route: "office-session/callback",
      status: "failed",
      adapter: "onlyoffice",
      engine: "OnlyOffice DocumentServer",
      failureEvidence,
      writeBack: { mode: "none", route: "office-session/callback" },
    });
    return {
      handled: true,
      updated: false,
      onlyOfficeError: 1,
      message: verification.message,
      failureEvidence,
      ...(runtimeRecord ? { runtimeRecord } : {}),
    };
  }

  if (!payload.url) {
    const failureEvidence = officeFailureEvidence(
      "onlyoffice_callback_download_url_missing",
      "OnlyOffice save callback did not include a download URL.",
      "onlyoffice",
    );
    const runtimeRecord = await appendOfficeRuntimeRecord(metadata, {
      route: "office-session/callback",
      status: "failed",
      adapter: "onlyoffice",
      engine: "OnlyOffice DocumentServer",
      failureEvidence,
      writeBack: { mode: "none", route: "office-session/callback" },
    });
    return {
      handled: true,
      updated: false,
      onlyOfficeError: 1,
      message: "OnlyOffice save callback did not include a download URL.",
      failureEvidence,
      ...(runtimeRecord ? { runtimeRecord } : {}),
    };
  }

  const response = await fetch(payload.url);
  if (!response.ok) {
    const failureEvidence = officeFailureEvidence(
      "onlyoffice_callback_download_failed",
      `Cannot download edited Office document: HTTP ${response.status}.`,
      "onlyoffice",
      response.status,
    );
    const runtimeRecord = await appendOfficeRuntimeRecord(metadata, {
      route: "office-session/callback",
      status: "failed",
      adapter: "onlyoffice",
      engine: "OnlyOffice DocumentServer",
      failureEvidence,
      writeBack: { mode: "none", route: "office-session/callback" },
    });
    return {
      handled: true,
      updated: false,
      onlyOfficeError: 1,
      message: `Cannot download edited Office document: HTTP ${response.status}.`,
      failureEvidence,
      ...(runtimeRecord ? { runtimeRecord } : {}),
    };
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const maxBytes = officeEditMaxBytes();
  if (bytes.byteLength <= 0 || bytes.byteLength > maxBytes) {
    const failureEvidence = officeFailureEvidence(
      "onlyoffice_callback_payload_size_invalid",
      `Edited Office payload size ${bytes.byteLength} is outside the allowed range.`,
      "onlyoffice",
      413,
      { sizeBytes: bytes.byteLength, maxBytes },
    );
    const runtimeRecord = await appendOfficeRuntimeRecord(metadata, {
      route: "office-session/callback",
      status: "failed",
      adapter: "onlyoffice",
      engine: "OnlyOffice DocumentServer",
      failureEvidence,
      writeBack: { mode: "none", route: "office-session/callback" },
    });
    return {
      handled: true,
      updated: false,
      onlyOfficeError: 1,
      message: `Edited Office payload size ${bytes.byteLength} is outside the allowed range.`,
      failureEvidence,
      ...(runtimeRecord ? { runtimeRecord } : {}),
    };
  }

  const updated = await updateLocalUploadBytes(fileId, bytes, {
    mimeType: metadata.mimeType,
    tags: ["office-native-edit", "onlyoffice-saveback"],
    runtime: {
      actor: "onlyoffice-documentserver",
      route: "office-session/callback",
      adapter: "onlyoffice",
      engine: "OnlyOffice DocumentServer",
      artifact: {
        name: metadata.originalName,
        role: "onlyoffice_saveback_binary",
        mediaType: metadata.mimeType,
      },
      notes: [
        "OnlyOffice callback downloaded real edited bytes and saved them as a controlled local CDE version.",
      ],
    },
  });
  const runtimeRecord = updated?.runtimeRecords?.at(-1);

  return {
    handled: true,
    updated: true,
    onlyOfficeError: 0,
    message: "Edited Office document saved back to the local source object.",
    ...(updated ? { file: updated, checksum: updated.checksum } : {}),
    ...(runtimeRecord?.artifact ? { artifact: runtimeRecord.artifact } : {}),
    ...(runtimeRecord?.writeBack ? { writeBack: runtimeRecord.writeBack } : {}),
    ...(runtimeRecord ? { runtimeRecord } : {}),
  };
}

export async function buildCollaboraWopiCheckFileInfo(
  fileId: string,
  request: Request,
): Promise<CollaboraWopiCheckFileInfo> {
  const metadata = await requireVerifiedWopiMetadata(fileId, request);
  const origin = publicOriginFromRequest(request.url);
  return {
    BaseFileName: metadata.originalName,
    OwnerId: metadata.owner || "local-user",
    Size: Number(metadata.size),
    UserId: process.env.COLLABORA_WOPI_USER_ID || metadata.owner || "local-user",
    UserFriendlyName:
      process.env.COLLABORA_WOPI_USER_NAME || metadata.owner || "local-user",
    Version: metadata.version,
    UserCanWrite: true,
    SupportsLocks: true,
    SupportsUpdate: true,
    UserCanNotWriteRelative: true,
    PostMessageOrigin: origin,
    LastModifiedTime: metadata.createdAt,
  };
}

export async function readCollaboraWopiFileContents(
  fileId: string,
  request: Request,
): Promise<CollaboraWopiContents> {
  const metadata = await requireVerifiedWopiMetadata(fileId, request);
  const bytes = await readFile(resolveLocalUploadStoragePath(metadata));
  return {
    bytes,
    mimeType: metadata.mimeType || "application/octet-stream",
    fileName: metadata.originalName,
    version: metadata.version,
  };
}

export async function writeCollaboraWopiFileContents(
  fileId: string,
  request: Request,
  bytes: Uint8Array,
): Promise<CollaboraWopiMutationResult> {
  const metadata = await requireVerifiedWopiMetadata(fileId, request);
  const maxBytes = officeEditMaxBytes();
  if (bytes.byteLength <= 0 || bytes.byteLength > maxBytes) {
    throw new OfficeNativeSessionError(
      413,
      "collabora_wopi_payload_too_large",
      `Edited Office payload size ${bytes.byteLength} is outside the allowed range.`,
    );
  }
  const lockResult = assertWopiLock(fileId, request.headers);
  if (lockResult) {
    throw new OfficeNativeSessionError(
      lockResult.status,
      "collabora_wopi_lock_conflict",
      lockResult.message,
      { lock: lockResult.headers["X-WOPI-Lock"] ?? "" },
    );
  }
  const updated = await updateLocalUploadBytes(fileId, bytes, {
    mimeType: metadata.mimeType,
    tags: ["office-native-edit", "collabora-wopi-saveback"],
    runtime: {
      actor: "collabora-online-wopi",
      route: "collabora-wopi/putfile",
      adapter: "collabora",
      engine: "Collabora Online WOPI",
      artifact: {
        name: metadata.originalName,
        role: "collabora_wopi_putfile_binary",
        mediaType: metadata.mimeType,
      },
      notes: [
        "Collabora WOPI PutFile saved real edited bytes as a controlled local CDE version.",
      ],
    },
  });
  const runtimeRecord = updated?.runtimeRecords?.at(-1);
  return {
    updated: Boolean(updated),
    version: updated?.version ?? metadata.version,
    checksum: updated?.checksum ?? metadata.checksum,
    message: "Edited Office document saved back through Collabora WOPI PutFile.",
    ...(runtimeRecord?.artifact ? { artifact: runtimeRecord.artifact } : {}),
    ...(runtimeRecord?.writeBack ? { writeBack: runtimeRecord.writeBack } : {}),
    ...(runtimeRecord ? { runtimeRecord } : {}),
  };
}

const collaboraWopiLocks = new Map<string, string>();

export async function handleCollaboraWopiFileControl(
  fileId: string,
  request: Request,
): Promise<CollaboraWopiControlResult> {
  await requireVerifiedWopiMetadata(fileId, request);
  const override = request.headers.get("x-wopi-override")?.toUpperCase() ?? "";
  const requestedLock = request.headers.get("x-wopi-lock") ?? "";
  const currentLock = collaboraWopiLocks.get(fileId) ?? "";

  if (override === "LOCK" || override === "REFRESH_LOCK") {
    if (currentLock && currentLock !== requestedLock) {
      return wopiLockConflict(currentLock);
    }
    if (requestedLock) collaboraWopiLocks.set(fileId, requestedLock);
    return { status: 200, headers: {}, message: "WOPI lock accepted." };
  }

  if (override === "GET_LOCK") {
    return {
      status: 200,
      headers: currentLock ? { "X-WOPI-Lock": currentLock } : {},
      message: "WOPI lock returned.",
    };
  }

  if (override === "UNLOCK") {
    if (currentLock && currentLock !== requestedLock) {
      return wopiLockConflict(currentLock);
    }
    collaboraWopiLocks.delete(fileId);
    return { status: 200, headers: {}, message: "WOPI lock released." };
  }

  return {
    status: 501,
    headers: {},
    message: `Unsupported WOPI override: ${override || "none"}.`,
  };
}

function officeNativeAdapterProbes(): OfficeNativeAdapterProbe[] {
  const onlyOffice = configuredOnlyOfficeDocumentServerUrl();
  const collabora = configuredCollaboraOnlineUrl();
  const collaboraSecret = configuredCollaboraWopiSecret();
  return [
    {
      id: "collabora-online-wopi",
      label: "Collabora Online WOPI",
      status: collabora && collaboraSecret ? "available" : "missing",
      licenseBoundary: "sidecar_service",
      sourceUrl: "https://github.com/CollaboraOnline/online",
      installHint:
        "Run Collabora Online and set COLLABORA_ONLINE_URL plus COLLABORA_WOPI_TOKEN_SECRET.",
      ...(collabora ? { endpoint: collabora } : {}),
    },
    {
      id: "onlyoffice-documentserver",
      label: "ONLYOFFICE DocumentServer",
      status: onlyOffice ? "available" : "missing",
      licenseBoundary: "sidecar_service",
      sourceUrl: "https://github.com/ONLYOFFICE/DocumentServer",
      installHint:
        "Only use when explicitly selected or as a reviewed fallback: run ONLYOFFICE DocumentServer as an isolated service and set ONLYOFFICE_DOCUMENT_SERVER_URL.",
      ...(onlyOffice ? { endpoint: onlyOffice } : {}),
    },
  ];
}

async function requireOfficeMetadata(
  fileId: string,
): Promise<LocalFileMetadata> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new OfficeNativeSessionError(
      404,
      "file_not_found",
      "file not found",
      {
        fileId,
      },
    );
  }
  if (!nativeOfficeFamilyForExtension(metadata.ext)) {
    throw new OfficeNativeSessionError(
      415,
      "unsupported_office_format",
      `Unsupported Office format: ${metadata.ext || metadata.mimeType}`,
      { extension: metadata.ext, mimeType: metadata.mimeType },
    );
  }
  return metadata;
}

function canUseOnlyOfficeMetadata(metadata: LocalFileMetadata): boolean {
  const family = nativeOfficeFamilyForExtension(metadata.ext);
  return Boolean(family && onlyOfficeNativeFamilies.has(family));
}

function onlyOfficeEditorConfig(
  metadata: LocalFileMetadata,
  input: {
    origin: string;
    documentServerUrl: string;
    sourceUrl: string;
  },
): OnlyOfficeEditorConfig {
  const family = nativeOfficeFamilyForExtension(metadata.ext);
  if (!family || !onlyOfficeNativeFamilies.has(family)) {
    throw new OfficeNativeSessionError(
      415,
      "unsupported_office_format",
      `Unsupported Office format: ${metadata.ext || metadata.mimeType}`,
    );
  }

  return {
    type: "desktop",
    documentType: onlyOfficeDocumentType(family as OnlyOfficeFamily),
    document: {
      fileType: metadata.ext.toLowerCase().replace(/^\./, ""),
      ...(family === "pdf" ? { isForm: false } : {}),
      key: onlyOfficeDocumentKey(metadata),
      title: metadata.originalName,
      url: input.sourceUrl,
      permissions: {
        edit: true,
        download: true,
        print: true,
        review: true,
        comment: true,
      },
      info: {
        owner: metadata.owner,
        uploaded: metadata.createdAt,
      },
    },
    editorConfig: {
      mode: "edit",
      lang: process.env.ONLYOFFICE_LANG || "zh-CN",
      callbackUrl: `${input.origin}/api/local-files/${encodeURIComponent(metadata.fileId)}/office-session/callback`,
      user: {
        id: process.env.ONLYOFFICE_USER_ID || metadata.owner || "local-user",
        name:
          process.env.ONLYOFFICE_USER_NAME || metadata.owner || "local-user",
      },
      customization: {
        autosave: true,
        forcesave: true,
        compactToolbar: false,
        help: false,
        feedback: false,
      },
    },
  };
}

function onlyOfficeDocumentType(family: OnlyOfficeFamily): "word" | "cell" | "slide" | "pdf" {
  if (family === "pdf") return "pdf";
  if (family === "spreadsheet") return "cell";
  if (family === "presentation") return "slide";
  return "word";
}

function collaboraNativeSession(
  metadata: LocalFileMetadata,
  input: {
    origin: string;
    documentServerUrl: string;
  },
): CollaboraNativeSession {
  const token = signWopiAccessToken(metadata);
  const ttl = collaboraAccessTokenTtl();
  const wopiSrc = `${input.origin}/api/wopi/files/${encodeURIComponent(metadata.fileId)}`;
  return {
    documentServerUrl: input.documentServerUrl,
    editorUrl: collaboraEditorUrl(input.documentServerUrl, {
      wopiSrc,
      accessToken: token,
      accessTokenTtl: ttl,
    }),
    wopiSrc,
    accessToken: token,
    accessTokenTtl: ttl,
    mode: "edit",
  };
}

function collaboraEditorUrl(
  documentServerUrl: string,
  input: {
    wopiSrc: string;
    accessToken: string;
    accessTokenTtl: number;
  },
): string {
  const path =
    process.env.COLLABORA_ONLINE_EDITOR_PATH?.trim() ||
    "/browser/dist/cool.html";
  const base = `${documentServerUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  const params = new URLSearchParams({
    WOPISrc: input.wopiSrc,
    access_token: input.accessToken,
    access_token_ttl: String(input.accessTokenTtl),
    permission: "edit",
    lang: process.env.COLLABORA_LANG || "zh-CN",
    ui_defaults:
      process.env.COLLABORA_UI_DEFAULTS?.trim() || defaultCollaboraUiDefaults,
  });
  return `${base}?${params.toString()}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nativeOfficeFamilyForExtension(
  extension: string,
): NativeOfficeFamily | null {
  const normalized = extension.trim().toLowerCase();
  if (normalized === ".pdf" || normalized === "pdf") return "pdf";
  return officePreviewFamilyForExtension(extension);
}

async function collaboraSupportForMetadata(
  metadata: LocalFileMetadata,
  documentServerUrl: string,
): Promise<{ supported: boolean; notes: string[] }> {
  const family = nativeOfficeFamilyForExtension(metadata.ext);
  const normalizedExt = metadata.ext.trim().toLowerCase().replace(/^\./, "");
  if (!family || !normalizedExt) {
    return {
      supported: false,
      notes: [
        `Collabora WOPI cannot be selected because the source extension is not registered: ${metadata.ext || metadata.mimeType}.`,
      ],
    };
  }
  if (collaboraNativeFamilies.has(family)) {
    return {
      supported: true,
      notes: [
        `${normalizedExt.toUpperCase()} is routed through the preferred Collabora WOPI native session.`,
      ],
    };
  }
  if (!collaboraDiscoveryGatedFamilies.has(family)) {
    return { supported: false, notes: [] };
  }

  const discovery = await collaboraDiscoverySupportsExtension(
    documentServerUrl,
    normalizedExt,
  );
  if (discovery.supported) {
    return {
      supported: true,
      notes: [
        `${normalizedExt.toUpperCase()} is opened through Collabora WOPI because the live discovery document advertises this extension.`,
      ],
    };
  }
  return {
    supported: false,
    notes: [
      `${normalizedExt.toUpperCase()} is not advertised by the live Collabora discovery document, so ArchIToken will not fake native display with PDF/image/OCR derivatives.`,
      ...discovery.notes,
    ],
  };
}

async function collaboraDiscoverySupportsExtension(
  documentServerUrl: string,
  extension: string,
): Promise<{ supported: boolean; notes: string[] }> {
  try {
    const response = await fetch(
      `${documentServerUrl.replace(/\/+$/, "")}/hosting/discovery`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return {
        supported: false,
        notes: [`Collabora discovery returned HTTP ${response.status}.`],
      };
    }
    const discoveryXml = await response.text();
    const supported = new RegExp(
      `\\bext=["']${escapeRegExp(extension)}["'][^>]*\\bname=["'](?:edit|view|view_comment)["']|\\bname=["'](?:edit|view|view_comment)["'][^>]*\\bext=["']${escapeRegExp(extension)}["']`,
      "i",
    ).test(discoveryXml);
    return {
      supported,
      notes: supported
        ? [`Collabora discovery advertises .${extension}.`]
        : [`Collabora discovery does not advertise .${extension}.`],
    };
  } catch (error) {
    return {
      supported: false,
      notes: [
        `Collabora discovery probe failed: ${error instanceof Error ? error.message : String(error)}.`,
      ],
    };
  }
}

function legacyOfficeFormatNotes(extension: string): string[] {
  const normalized = extension.trim().toLowerCase().replace(/^\./, "");
  if (!["doc", "xls", "ppt"].includes(normalized)) return [];
  return [
    `${normalized.toUpperCase()} is a legacy binary Office format. The selected native Office editor may use its internal conversion pipeline for editing; ArchIToken still keeps the uploaded file object as the source of record and saves returned edited bytes as a new controlled version.`,
  ];
}

function onlyOfficeDocumentKey(metadata: LocalFileMetadata): string {
  return `${metadata.fileId}-${metadata.checksum.slice(0, 24)}`
    .replace(/[^A-Za-z0-9._=-]/g, "_")
    .slice(0, 120);
}

function signOnlyOfficeConfig(
  config: OnlyOfficeEditorConfig,
): OnlyOfficeEditorConfig {
  const secret = process.env.ONLYOFFICE_JWT_SECRET?.trim();
  if (!secret) return config;
  return {
    ...config,
    token: signJwt(config, secret),
  };
}

function verifyOnlyOfficeCallback(payload: OnlyOfficeCallbackPayload): {
  ok: boolean;
  message: string;
} {
  const secret = process.env.ONLYOFFICE_JWT_SECRET?.trim();
  if (!secret) return { ok: true, message: "JWT not configured." };
  if (!payload.token) {
    return { ok: false, message: "OnlyOffice callback token is missing." };
  }
  return verifyJwt(payload.token, secret)
    ? { ok: true, message: "OnlyOffice callback token verified." }
    : { ok: false, message: "OnlyOffice callback token verification failed." };
}

function isOnlyOfficeSaveStatus(status: number | undefined): boolean {
  return status === 2 || status === 6;
}

function publicOriginFromRequest(requestUrl: string): string {
  const configured = process.env.ARCHITOKEN_PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const url = new URL(requestUrl);
  return url.origin;
}

function configuredOnlyOfficeDocumentServerUrl(): string | null {
  const url = process.env.ONLYOFFICE_DOCUMENT_SERVER_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

function configuredOfficeEditorProvider(): OfficeEditorProvider {
  const provider = (
    process.env.ARCHITOKEN_OFFICE_EDITOR_PROVIDER || "auto"
  ).trim().toLowerCase();
  if (provider === "collabora" || provider === "onlyoffice") return provider;
  return "auto";
}

function configuredCollaboraOnlineUrl(): string | null {
  const url =
    process.env.COLLABORA_ONLINE_URL?.trim() ||
    process.env.COLLABORA_DOCUMENT_SERVER_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

function configuredCollaboraWopiSecret(): string | null {
  const secret =
    process.env.COLLABORA_WOPI_TOKEN_SECRET?.trim() ||
    process.env.ARCHITOKEN_WOPI_TOKEN_SECRET?.trim() ||
    process.env.ARCHITOKEN_AUTH__JWT_SECRET?.trim();
  if (secret) return secret;
  return process.env.NODE_ENV === "production"
    ? null
    : "architoken-dev-collabora-wopi-secret";
}

function collaboraAccessTokenTtl(): number {
  const seconds = Number.parseInt(
    process.env.COLLABORA_ACCESS_TOKEN_TTL_SECONDS ?? "",
    10,
  );
  const ttlSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 86400;
  return Date.now() + ttlSeconds * 1000;
}

function officeEditMaxBytes(): number {
  const parsed = Number.parseInt(
    process.env.ARCHITOKEN_OFFICE_EDIT_MAX_BYTES ?? "",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 512 * 1024 * 1024;
}

async function appendOfficeRuntimeRecord(
  metadata: LocalFileMetadata,
  input: Parameters<typeof appendLocalUploadRuntimeRecord>[1],
): Promise<LocalFileRuntimeRecord | undefined> {
  const updated = await appendLocalUploadRuntimeRecord(metadata.fileId, {
    actor: "office-native-runtime",
    ...input,
  });
  return updated?.runtimeRecords?.at(-1);
}

function officeFailureEvidence(
  code: string,
  message: string,
  adapter: string,
  status?: number | string,
  details?: Record<string, unknown>,
): LocalFileRuntimeFailureEvidence {
  return {
    code,
    message,
    adapter,
    route: "office-session/callback",
    ...(status !== undefined ? { status } : {}),
    ...(details ? { details } : {}),
  };
}

async function requireVerifiedWopiMetadata(
  fileId: string,
  request: Request,
): Promise<LocalFileMetadata> {
  const metadata = await requireOfficeMetadata(fileId);
  const token = accessTokenFromRequest(request);
  if (!token) {
    throw new OfficeNativeSessionError(
      401,
      "collabora_wopi_token_missing",
      "Collabora WOPI access_token is missing.",
    );
  }
  const verification = verifyWopiAccessToken(token, fileId);
  if (!verification.ok) {
    throw new OfficeNativeSessionError(
      401,
      "collabora_wopi_token_invalid",
      verification.message,
    );
  }
  return metadata;
}

function accessTokenFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("access_token")?.trim();
  if (queryToken) return queryToken;
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || null;
}

function signWopiAccessToken(metadata: LocalFileMetadata): string {
  const secret = configuredCollaboraWopiSecret();
  if (!secret) {
    throw new OfficeNativeSessionError(
      503,
      "collabora_wopi_secret_missing",
      "COLLABORA_WOPI_TOKEN_SECRET is required for Collabora WOPI editing.",
    );
  }
  return signJwt(
    {
      aud: "collabora-online",
      sub: metadata.owner || "local-user",
      fileId: metadata.fileId,
      permissions: ["read", "write"],
      exp: Math.floor(collaboraAccessTokenTtl() / 1000),
    },
    secret,
  );
}

function verifyWopiAccessToken(
  token: string,
  expectedFileId: string,
): { ok: boolean; message: string } {
  const secret = configuredCollaboraWopiSecret();
  if (!secret) return { ok: false, message: "WOPI token secret is missing." };
  if (!verifyJwt(token, secret)) {
    return { ok: false, message: "WOPI token signature verification failed." };
  }
  const payload = decodeJwtPayload(token);
  if (payload?.fileId !== expectedFileId) {
    return { ok: false, message: "WOPI token file binding does not match." };
  }
  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  if (exp > 0 && exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, message: "WOPI token expired." };
  }
  return { ok: true, message: "WOPI token verified." };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const encodedPayload = token.split(".")[1];
  if (!encodedPayload) return null;
  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function assertWopiLock(
  fileId: string,
  headers: Headers,
): CollaboraWopiControlResult | null {
  const currentLock = collaboraWopiLocks.get(fileId) ?? "";
  if (!currentLock) return null;
  const requestedLock = headers.get("x-wopi-lock") ?? "";
  return requestedLock === currentLock ? null : wopiLockConflict(currentLock);
}

function wopiLockConflict(currentLock: string): CollaboraWopiControlResult {
  return {
    status: 409,
    headers: { "X-WOPI-Lock": currentLock },
    message: "WOPI lock mismatch.",
  };
}

function signJwt(payload: unknown, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = hmacSha256(signingInput, secret);
  return `${signingInput}.${signature}`;
}

function verifyJwt(token: string, secret: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [encodedHeader, encodedPayload, signature] = parts;
  if (!encodedHeader || !encodedPayload || !signature) return false;
  const expected = hmacSha256(`${encodedHeader}.${encodedPayload}`, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

function hmacSha256(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export class OfficeNativeSessionError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "OfficeNativeSessionError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
