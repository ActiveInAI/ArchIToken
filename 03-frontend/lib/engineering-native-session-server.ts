// lib/engineering-native-session-server.ts - Controlled FreeCAD/Blender native edit sessions
// License: Apache-2.0

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { LocalFileMetadata } from "./local-file-runtime";
import {
  appendLocalUploadRuntimeRecord,
  getLocalFileMetadata,
  resolveLocalUploadStoragePath,
  updateLocalUploadBytes,
} from "./local-file-runtime-server";
import type {
  LocalFileRuntimeArtifact,
  LocalFileRuntimeRecord,
  LocalFileRuntimeWriteBack,
} from "./local-file-runtime";

export type EngineeringNativeExternalApp = "freecad" | "blender";
export type EngineeringNativeLaunchMode = "embedded" | "gui";

export interface EngineeringNativeExternalAppRoute {
  id: string;
  app: EngineeringNativeExternalApp;
  label: string;
  status: "ready" | "not_supported_for_format";
  mode: EngineeringNativeLaunchMode;
  binaryCandidates: string[];
  launch: {
    method: "POST";
    body: {
      app: EngineeringNativeExternalApp;
      mode: EngineeringNativeLaunchMode;
    };
  };
  saveBack: {
    method: "POST";
    route: "native-open/commit";
    body: {
      app: EngineeringNativeExternalApp;
      sessionId: string;
    };
  };
  note: string;
}

export interface EngineeringNativeWorkspaceSession {
  schema: "architoken.engineering_native_workspace.v1";
  app: EngineeringNativeExternalApp;
  sessionId: string;
  workspaceFolder: string;
  workspaceFilePath: string;
  commitUrl: string;
  sourceChecksum: string;
  workspacePolicy: "copy_on_launch";
  saveBackPolicy: "commit_as_cde_version";
}

export interface EngineeringNativeLaunchManifest {
  schema: "architoken.native-external-app-launch.v1";
  status: "launched";
  app: EngineeringNativeExternalApp;
  mode: EngineeringNativeLaunchMode;
  pid?: number;
  binary?: string;
  fileId: string;
  originalName: string;
  extension: string;
  size: number;
  checksum: string;
  sourcePath: string;
  session: EngineeringNativeWorkspaceSession & {
    workspaceSize: number;
    workspaceMtime: string;
  };
  embedded?: EngineeringNativeEmbeddedWorkbench;
  audit: {
    sourceOfRecord: string;
    externalProcess: true;
    saveBackRequired: true;
    versioningRequired: true;
    approvalRequired: true;
  };
}

export interface EngineeringNativeCommitResult {
  schema: "architoken.engineering_native_commit.v1";
  updated: boolean;
  app: EngineeringNativeExternalApp;
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

export interface EngineeringNativeEmbeddedWorkbench {
  mode: "embedded_vnc";
  publicUrl: string;
  apiUrl: string;
  launchUrl: string;
  status: "launched" | "ready";
  display: string;
  processId?: number;
  hostProcessId?: number;
  hostAppLaunchRequired?: boolean;
  note: string;
}

export class EngineeringNativeSessionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "EngineeringNativeSessionError";
    this.status = status;
  }
}

const maxEngineeringNativeCommitBytes = 2 * 1024 * 1024 * 1024;

export async function launchEngineeringNativeSession(
  fileId: string,
  input: {
    app: EngineeringNativeExternalApp;
    mode?: EngineeringNativeLaunchMode;
    requestUrl: string;
  },
): Promise<EngineeringNativeLaunchManifest> {
  const metadata = await requireEngineeringNativeMetadata(fileId);
  const ext = metadata.ext.toLowerCase();
  ensureNativeAppSupportsExtension(input.app, ext);
  const mode = input.mode ?? "embedded";
  const sourcePath = resolveLocalUploadStoragePath(metadata);
  const sourceStat = await stat(sourcePath);
  const session = await materializeEngineeringNativeSession(
    metadata,
    input.app,
    {
      origin: engineeringNativePublicOriginFromRequest(input.requestUrl),
    },
  );
  const workspaceStat = await stat(session.workspaceFilePath);

  if (mode === "embedded") {
    const embedded = await launchEngineeringEmbeddedWorkbench(
      metadata,
      session,
    );
    return {
      schema: "architoken.native-external-app-launch.v1",
      status: "launched",
      app: input.app,
      mode,
      fileId: metadata.fileId,
      originalName: metadata.originalName,
      extension: ext,
      size: sourceStat.size,
      checksum: metadata.checksum,
      sourcePath,
      session: {
        ...session,
        workspaceSize: workspaceStat.size,
        workspaceMtime: workspaceStat.mtime.toISOString(),
      },
      embedded,
      audit: {
        sourceOfRecord: `/api/local-files/${encodeURIComponent(metadata.fileId)}`,
        externalProcess: true,
        saveBackRequired: true,
        versioningRequired: true,
        approvalRequired: true,
      },
    };
  }

  const binary = resolveEngineeringNativeExternalAppBinary(input.app);
  if (!binary) {
    throw new EngineeringNativeSessionError(
      `${input.app} binary not found`,
      501,
    );
  }
  const child = spawn(binary, [session.workspaceFilePath], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return {
    schema: "architoken.native-external-app-launch.v1",
    status: "launched",
    app: input.app,
    mode,
    ...(child.pid ? { pid: child.pid } : {}),
    binary,
    fileId: metadata.fileId,
    originalName: metadata.originalName,
    extension: ext,
    size: sourceStat.size,
    checksum: metadata.checksum,
    sourcePath,
    session: {
      ...session,
      workspaceSize: workspaceStat.size,
      workspaceMtime: workspaceStat.mtime.toISOString(),
    },
    audit: {
      sourceOfRecord: `/api/local-files/${encodeURIComponent(metadata.fileId)}`,
      externalProcess: true,
      saveBackRequired: true,
      versioningRequired: true,
      approvalRequired: true,
    },
  };
}

export async function materializeEngineeringNativeSession(
  metadata: LocalFileMetadata,
  app: EngineeringNativeExternalApp,
  input: { origin?: string } = {},
): Promise<EngineeringNativeWorkspaceSession> {
  ensureNativeAppSupportsExtension(app, metadata.ext.toLowerCase());
  const sessionId = engineeringNativeSessionId(metadata, app);
  const workspaceFolder = engineeringNativeWorkspaceFolder(sessionId);
  const workspaceFilePath = join(
    workspaceFolder,
    safeNativeWorkspaceFileName(metadata.originalName),
  );
  const sourcePath = resolveLocalUploadStoragePath(metadata);

  await mkdir(workspaceFolder, { recursive: true });
  if (!(await fileExists(workspaceFilePath))) {
    await copyFile(sourcePath, workspaceFilePath);
  }

  const session: EngineeringNativeWorkspaceSession = {
    schema: "architoken.engineering_native_workspace.v1",
    app,
    sessionId,
    workspaceFolder,
    workspaceFilePath,
    commitUrl: `${trimTrailingSlash(input.origin)}/api/local-files/${encodeURIComponent(
      metadata.fileId,
    )}/native-open/commit`,
    sourceChecksum: metadata.checksum,
    workspacePolicy: "copy_on_launch",
    saveBackPolicy: "commit_as_cde_version",
  };

  await writeFile(
    join(workspaceFolder, ".architoken-native-session.json"),
    `${JSON.stringify(
      {
        ...session,
        fileId: metadata.fileId,
        originalName: metadata.originalName,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return session;
}

export async function commitEngineeringNativeSession(
  fileId: string,
  input: {
    app: EngineeringNativeExternalApp;
    sessionId: string;
  },
): Promise<EngineeringNativeCommitResult> {
  const metadata = await requireEngineeringNativeMetadata(fileId);
  ensureNativeAppSupportsExtension(input.app, metadata.ext.toLowerCase());
  const expectedSessionId = engineeringNativeSessionId(metadata, input.app);
  if (input.sessionId !== expectedSessionId) {
    throw new EngineeringNativeSessionError(
      "native editor session no longer matches the current CDE source checksum",
      409,
    );
  }

  const workspaceFilePath = engineeringNativeWorkspaceFilePath(
    metadata,
    input.app,
  );
  const workspaceStat = await stat(workspaceFilePath).catch(
    (error: unknown) => {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        throw new EngineeringNativeSessionError(
          "native editor workspace file not found",
          404,
        );
      }
      throw error;
    },
  );

  if (workspaceStat.size > maxEngineeringNativeCommitBytes) {
    throw new EngineeringNativeSessionError(
      "native editor workspace file is too large to commit in-process",
      413,
    );
  }

  const bytes = await readFile(workspaceFilePath);
  const workspaceChecksum = sha256(bytes);
  if (workspaceChecksum === metadata.checksum) {
    const recorded = await appendLocalUploadRuntimeRecord(metadata.fileId, {
      actor: `${input.app}-native-workbench`,
      route: "native-open/commit",
      status: "skipped",
      adapter: input.app,
      engine: input.app === "freecad" ? "FreeCAD" : "Blender",
      artifact: {
        name: basename(workspaceFilePath),
        role: "engineering_native_workspace",
        mediaType: metadata.mimeType,
        size: bytes.byteLength,
        checksum: workspaceChecksum,
        path: workspaceFilePath,
      },
      writeBack: {
        mode: "same_version",
        route: "native-open/commit",
        fileId: metadata.fileId,
        version: metadata.version,
        checksum: metadata.checksum,
        size: metadata.size,
        tags: metadata.tags,
      },
      notes: ["Workspace checksum matched the CDE source; no new version was imported."],
    });
    const runtimeRecord = recorded?.runtimeRecords?.at(-1);
    if (!runtimeRecord?.artifact || !runtimeRecord.writeBack) {
      throw new EngineeringNativeSessionError(
        "native editor skipped commit did not produce runtime evidence",
        500,
      );
    }
    return {
      schema: "architoken.engineering_native_commit.v1",
      updated: false,
      app: input.app,
      fileId: metadata.fileId,
      file: recorded ?? metadata,
      sessionId: input.sessionId,
      version: metadata.version,
      checksum: metadata.checksum,
      workspaceChecksum,
      workspaceFilePath,
      artifact: runtimeRecord.artifact,
      writeBack: runtimeRecord.writeBack,
      runtimeRecord,
      message: "工作副本与 CDE 当前版本一致，无需导入新版本。",
    };
  }

  const updated = await updateLocalUploadBytes(fileId, bytes, {
    mimeType: metadata.mimeType,
    tags: ["engineering-native-session", `native-${input.app}-edit`],
    runtime: {
      actor: `${input.app}-native-workbench`,
      route: "native-open/commit",
      adapter: input.app,
      engine: input.app === "freecad" ? "FreeCAD" : "Blender",
      artifact: {
        name: basename(workspaceFilePath),
        role: "engineering_native_workspace_writeback",
        mediaType: metadata.mimeType,
        path: workspaceFilePath,
      },
      notes: [
        "Native workbench save-back imports the controlled workspace copy as a new CDE version.",
      ],
    },
  });
  if (!updated) {
    throw new EngineeringNativeSessionError("file not found", 404);
  }
  const runtimeRecord = updated.runtimeRecords?.at(-1);
  if (!runtimeRecord?.artifact || !runtimeRecord.writeBack) {
    throw new EngineeringNativeSessionError(
      "native editor commit did not produce runtime evidence",
      500,
    );
  }

  return {
    schema: "architoken.engineering_native_commit.v1",
    updated: true,
    app: input.app,
    fileId: updated.fileId,
    file: updated,
    sessionId: input.sessionId,
    version: updated.version,
    checksum: updated.checksum,
    workspaceChecksum,
    workspaceFilePath,
    artifact: runtimeRecord.artifact,
    writeBack: runtimeRecord.writeBack,
    runtimeRecord,
    message: `已导入 ${input.app === "freecad" ? "FreeCAD" : "Blender"} 工作副本并生成 ${updated.version}。`,
  };
}

export function engineeringNativeExternalAppsFor(
  ext: string,
): EngineeringNativeExternalAppRoute[] {
  const normalized = ext.toLowerCase();
  const routes: EngineeringNativeExternalAppRoute[] = [];

  if (freeCadNativeExtensions.has(normalized)) {
    routes.push({
      id: "native-freecad-gui",
      app: "freecad",
      label: "FreeCAD 内嵌原生工作台",
      status: "ready",
      mode: "embedded",
      binaryCandidates: nativeExternalAppBinaryCandidates("freecad"),
      launch: { method: "POST", body: { app: "freecad", mode: "embedded" } },
      saveBack: {
        method: "POST",
        route: "native-open/commit",
        body: { app: "freecad", sessionId: "{session.sessionId}" },
      },
      note: "Embeds the FreeCAD sidecar workbench inside ArchIToken with a controlled workspace copy. Save-back imports the saved workspace as a new CDE version.",
    });
  }

  if (blenderNativeExtensions.has(normalized)) {
    routes.push({
      id: "native-blender-gui",
      app: "blender",
      label: "Blender 内嵌原生工作台",
      status: "ready",
      mode: "embedded",
      binaryCandidates: nativeExternalAppBinaryCandidates("blender"),
      launch: { method: "POST", body: { app: "blender", mode: "embedded" } },
      saveBack: {
        method: "POST",
        route: "native-open/commit",
        body: { app: "blender", sessionId: "{session.sessionId}" },
      },
      note: "Embeds the Blender sidecar workbench inside ArchIToken with a controlled workspace copy. Save-back imports the saved workspace as a new CDE version.",
    });
  }

  return routes;
}

export function nativeExternalAppBinaryCandidates(
  app: EngineeringNativeExternalApp,
): string[] {
  if (app === "freecad") {
    return [
      process.env.ARCHITOKEN_FREECAD_GUI_BINARY,
      "/snap/bin/freecad",
      "/usr/bin/freecad",
      "/usr/local/bin/freecad",
      "freecad",
      "FreeCAD",
    ].filter((value): value is string => Boolean(value));
  }

  return [
    process.env.ARCHITOKEN_BLENDER_GUI_BINARY,
    process.env.BLENDER_BINARY,
    "/usr/bin/blender",
    "/usr/local/bin/blender",
    "blender",
  ].filter((value): value is string => Boolean(value));
}

export function resolveEngineeringNativeExternalAppBinary(
  app: EngineeringNativeExternalApp,
): string | null {
  for (const candidate of nativeExternalAppBinaryCandidates(app)) {
    if (candidate.includes("/") && isExecutableFile(candidate))
      return candidate;
    if (!candidate.includes("/")) {
      const resolved = resolveCommandFromPath(candidate);
      if (resolved) return resolved;
    }
  }
  return null;
}

async function launchEngineeringEmbeddedWorkbench(
  metadata: LocalFileMetadata,
  session: EngineeringNativeWorkspaceSession,
): Promise<EngineeringNativeEmbeddedWorkbench> {
  const publicUrl = configuredEngineeringNativeWorkbenchPublicUrl();
  const apiUrl = configuredEngineeringNativeWorkbenchApiUrl();
  if (!publicUrl || !apiUrl) {
    throw new EngineeringNativeSessionError(
      "engineering native workbench sidecar is not configured",
      501,
    );
  }

  const response = await fetch(`${apiUrl}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      app: session.app,
      sessionId: session.sessionId,
      fileId: metadata.fileId,
      originalName: metadata.originalName,
      workspaceFolder: session.workspaceFolder,
      workspaceFilePath: session.workspaceFilePath,
      sourceChecksum: metadata.checksum,
    }),
  }).catch((error: unknown) => {
    throw new EngineeringNativeSessionError(
      `engineering native workbench sidecar is unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`,
      502,
    );
  });

  const payload = (await response.json().catch(() => ({}))) as {
    status?: "launched" | "ready";
    launchUrl?: string;
    processId?: number;
    hostAppLaunchRequired?: boolean;
    display?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new EngineeringNativeSessionError(
      payload.error ||
        `engineering native workbench sidecar rejected the session: HTTP ${response.status}`,
      response.status >= 500 ? 502 : response.status,
    );
  }

  const display = payload.display || ":99";
  let hostProcessId: number | undefined;
  if (payload.hostAppLaunchRequired) {
    hostProcessId = launchHostNativeAppOnDisplay(
      session.app,
      session.workspaceFilePath,
      display,
    );
  }

  return {
    mode: "embedded_vnc",
    publicUrl,
    apiUrl,
    launchUrl:
      payload.launchUrl ||
      engineeringNativeWorkbenchLaunchUrl(publicUrl, session.sessionId),
    status: hostProcessId || payload.processId ? "launched" : "ready",
    display,
    ...(payload.processId ? { processId: payload.processId } : {}),
    ...(hostProcessId ? { hostProcessId } : {}),
    ...(payload.hostAppLaunchRequired
      ? { hostAppLaunchRequired: payload.hostAppLaunchRequired }
      : {}),
    note: "FreeCAD/Blender is rendered inside ArchIToken through the engineering-native-workbench display sidecar.",
  };
}

function launchHostNativeAppOnDisplay(
  app: EngineeringNativeExternalApp,
  workspaceFilePath: string,
  display: string,
): number {
  const binary = resolveEngineeringNativeExternalAppBinary(app);
  if (!binary) {
    throw new EngineeringNativeSessionError(
      `${app} binary not found on the host for embedded workbench launch`,
      501,
    );
  }

  const child = spawn(binary, nativeAppLaunchArgs(app, workspaceFilePath), {
    detached: true,
    env: {
      ...process.env,
      ...nativeAppSessionEnv(app, workspaceFilePath),
      DISPLAY: display,
      QT_X11_NO_MITSHM: "1",
      LIBGL_ALWAYS_SOFTWARE: process.env.LIBGL_ALWAYS_SOFTWARE || "1",
    },
    stdio: "ignore",
  });
  child.unref();
  if (!child.pid) {
    throw new EngineeringNativeSessionError(
      `${app} embedded workbench process did not start`,
      502,
    );
  }
  return child.pid;
}

function nativeAppLaunchArgs(
  app: EngineeringNativeExternalApp,
  workspaceFilePath: string,
): string[] {
  if (app !== "blender") return freeCadLaunchArgs(workspaceFilePath);

  const ext = extname(workspaceFilePath).toLowerCase();
  return ["--python-expr", blenderImportExpression(workspaceFilePath, ext)];
}

function freeCadLaunchArgs(workspaceFilePath: string): string[] {
  const profileRoot = nativeAppSessionProfileRoot("freecad", workspaceFilePath);
  ensureFreeCadSessionConfig(profileRoot, workspaceFilePath);
  const moduleRoot = ensureFreeCadStartupModule(profileRoot, workspaceFilePath);
  const ext = extname(workspaceFilePath).toLowerCase();
  const openTarget =
    ext === ".dxf"
      ? ensureFreeCadDxfOpenScript(profileRoot, workspaceFilePath)
      : ext === ".ifc" || ext === ".ifczip"
        ? ensureFreeCadIfcOpenScript(profileRoot, workspaceFilePath)
        : workspaceFilePath;
  return [
    "--module-path",
    moduleRoot,
    "--user-cfg",
    join(profileRoot, "user.cfg"),
    "--system-cfg",
    join(profileRoot, "system.cfg"),
    openTarget,
  ];
}

function nativeAppSessionEnv(
  app: EngineeringNativeExternalApp,
  workspaceFilePath: string,
): Record<string, string> {
  const profileRoot = nativeAppSessionProfileRoot(app, workspaceFilePath);
  const configRoot = join(profileRoot, "config");
  const cacheRoot = join(profileRoot, "cache");
  const dataRoot = join(profileRoot, "data");
  const tempRoot = join(profileRoot, "tmp");
  mkdirSync(configRoot, { recursive: true });
  mkdirSync(cacheRoot, { recursive: true });
  mkdirSync(dataRoot, { recursive: true });
  mkdirSync(tempRoot, { recursive: true });

  if (app === "blender") {
    return {
      XDG_CONFIG_HOME: configRoot,
      XDG_CACHE_HOME: cacheRoot,
      XDG_DATA_HOME: dataRoot,
      TMPDIR: tempRoot,
      TMP: tempRoot,
      TEMP: tempRoot,
      BLENDER_USER_CONFIG: configRoot,
      BLENDER_USER_SCRIPTS: join(profileRoot, "scripts"),
      BLENDER_USER_DATAFILES: dataRoot,
      LANG: "C.UTF-8",
      LANGUAGE: "zh_CN:zh",
      LC_ALL: "C.UTF-8",
    };
  }

  return {
    XDG_CONFIG_HOME: configRoot,
    XDG_CACHE_HOME: cacheRoot,
    XDG_DATA_HOME: dataRoot,
    TMPDIR: tempRoot,
    TMP: tempRoot,
    TEMP: tempRoot,
    APPIMAGE_EXTRACT_AND_RUN: "1",
    FREECAD_USER_HOME: profileRoot,
    LANG: "C.UTF-8",
    LANGUAGE: "zh_CN:zh",
    LC_ALL: "C.UTF-8",
  };
}

function nativeAppSessionProfileRoot(
  app: EngineeringNativeExternalApp,
  workspaceFilePath: string,
): string {
  return join(dirname(workspaceFilePath), `architoken-${app}-profile`);
}

function ensureFreeCadSessionConfig(
  profileRoot: string,
  workspaceFilePath: string,
): void {
  mkdirSync(profileRoot, { recursive: true });
  const ext = extname(workspaceFilePath).toLowerCase();
  const fileOpenSavePath = dirname(workspaceFilePath);
  const autoloadModule =
    ext === ".dxf" || ext === ".dwg" ? "DraftWorkbench" : "PartDesignWorkbench";
  const systemConfigPath = join(profileRoot, "system.cfg");
  if (!existsSync(systemConfigPath)) {
    writeFileSync(
      systemConfigPath,
      `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FCParameters>
  <FCParamGroup Name="Root"/>
</FCParameters>
`,
      "utf8",
    );
  }

  const userConfigPath = join(profileRoot, "user.cfg");
  writeFileSync(
    userConfigPath,
    `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FCParameters>
  <FCParamGroup Name="Root">
    <FCParamGroup Name="BaseApp">
      <FCParamGroup Name="Preferences">
        <FCParamGroup Name="General">
          <FCText Name="FileOpenSavePath">${escapeFreeCadConfigText(fileOpenSavePath)}</FCText>
          <FCText Name="AutoloadModule">${autoloadModule}</FCText>
          <FCText Name="Language">Chinese (Simplified)</FCText>
        </FCParamGroup>
        <FCParamGroup Name="Units">
          <FCInt Name="UserSchema" Value="0"/>
        </FCParamGroup>
        <FCParamGroup Name="Mod">
          <FCParamGroup Name="Start">
            <FCBool Name="ShowOnStartup" Value="0"/>
            <FCBool Name="ShowExamples" Value="0"/>
            <FCBool Name="CloseStart" Value="1"/>
            <FCBool Name="Migration2024Complete" Value="1"/>
            <FCBool Name="FirstStart2024" Value="0"/>
          </FCParamGroup>
          <FCParamGroup Name="Draft">
            <FCInt Name="DxfImportMode" Value="3"/>
            <FCBool Name="dxfImportAsDraft" Value="0"/>
            <FCBool Name="dxfImportAsPrimitives" Value="0"/>
            <FCBool Name="dxfImportAsShapes" Value="0"/>
            <FCBool Name="dxfImportAsFused" Value="1"/>
            <FCBool Name="dxfShowDialog" Value="0"/>
            <FCBool Name="dxfUseLegacyImporter" Value="0"/>
            <FCBool Name="dxftext" Value="1"/>
            <FCBool Name="dxflayout" Value="1"/>
            <FCBool Name="dxfImportPoints" Value="1"/>
            <FCBool Name="dxfGetOriginalColors" Value="0"/>
            <FCBool Name="dxfUseDraftVisGroups" Value="1"/>
          </FCParamGroup>
        </FCParamGroup>
        <FCParamGroup Name="View">
          <FCText Name="NavigationStyle">Gui::RevitNavigationStyle</FCText>
          <FCBool Name="Gradient" Value="0"/>
          <FCBool Name="Simple" Value="1"/>
        </FCParamGroup>
        <FCParamGroup Name="MainWindow">
          <FCText Name="QtStyle">FreeCAD</FCText>
          <FCText Name="StyleSheet">FreeCAD.qss</FCText>
          <FCText Name="Theme">FreeCAD Dark</FCText>
          <FCBool Name="StatusBar" Value="1"/>
        </FCParamGroup>
        <FCParamGroup Name="OutputWindow">
          <FCBool Name="RedirectPythonOutput" Value="1"/>
          <FCBool Name="RedirectPythonErrors" Value="1"/>
        </FCParamGroup>
      </FCParamGroup>
    </FCParamGroup>
  </FCParamGroup>
</FCParameters>
`,
    "utf8",
  );
}

function escapeFreeCadConfigText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function ensureFreeCadStartupModule(
  profileRoot: string,
  workspaceFilePath: string,
): string {
  const moduleRoot = join(profileRoot, "Mod");
  const moduleFolder = join(moduleRoot, "ArchITokenStartup");
  mkdirSync(moduleFolder, { recursive: true });
  writeFileSync(join(moduleFolder, "Init.py"), "", "utf8");
  writeFileSync(
    join(moduleFolder, "InitGui.py"),
    freeCadStartupModuleSource(workspaceFilePath),
    "utf8",
  );
  return moduleRoot;
}

function ensureFreeCadDxfOpenScript(
  profileRoot: string,
  workspaceFilePath: string,
): string {
  const scriptPath = join(profileRoot, "architoken-open-dxf.py");
  writeFileSync(
    scriptPath,
    freeCadDxfOpenScriptSource(workspaceFilePath),
    "utf8",
  );
  return scriptPath;
}

function ensureFreeCadIfcOpenScript(
  profileRoot: string,
  workspaceFilePath: string,
): string {
  const scriptPath = join(profileRoot, "architoken-open-ifc.py");
  writeFileSync(
    scriptPath,
    freeCadIfcOpenScriptSource(workspaceFilePath),
    "utf8",
  );
  return scriptPath;
}

function freeCadDxfOpenScriptSource(workspaceFilePath: string): string {
  return `# Generated by ArchIToken for deterministic FreeCAD DXF opening.
import FreeCAD

SOURCE = ${JSON.stringify(workspaceFilePath)}

params = FreeCAD.ParamGet("User parameter:BaseApp/Preferences/Mod/Draft")
params.SetBool("dxfShowDialog", False)
params.SetBool("dxfUseLegacyImporter", False)
params.SetInt("DxfImportMode", 3)
params.SetBool("dxfImportAsDraft", False)
params.SetBool("dxfImportAsPrimitives", False)
params.SetBool("dxfImportAsShapes", False)
params.SetBool("dxfImportAsFused", True)
params.SetBool("dxftext", True)
params.SetBool("dxflayout", True)
params.SetBool("dxfImportPoints", True)
params.SetBool("dxfGetOriginalColors", False)
params.SetBool("dxfUseDraftVisGroups", True)

import importDXF

importDXF.open(SOURCE)

try:
    import FreeCADGui
    from PySide import QtCore
except Exception as error:
    FreeCAD.Console.PrintWarning("ArchIToken DXF GUI bootstrap disabled: {}\\\\n".format(error))
else:
    def architoken_focus_dxf():
        try:
            doc = FreeCAD.ActiveDocument
            if doc is None:
                return
            try:
                doc.recompute()
            except Exception:
                pass
            try:
                FreeCADGui.activateWorkbench("DraftWorkbench")
            except Exception:
                pass
            try:
                FreeCADGui.Control.closeDialog()
            except Exception:
                pass
            try:
                from PySide import QtGui
                main_window = FreeCADGui.getMainWindow()
                for dock in main_window.findChildren(QtGui.QDockWidget):
                    title = dock.windowTitle().lower()
                    left_panel = "combo" in title or "组合" in title
                    if not left_panel:
                        dock.hide()
            except Exception:
                pass
            for obj in doc.Objects:
                try:
                    obj.ViewObject.Visibility = True
                    obj.ViewObject.LineColor = (0.0, 0.0, 0.0)
                    obj.ViewObject.PointColor = (0.0, 0.0, 0.0)
                    obj.ViewObject.ShapeColor = (0.0, 0.0, 0.0)
                    obj.ViewObject.TextColor = (0.0, 0.0, 0.0)
                except Exception:
                    pass
            try:
                view = FreeCADGui.ActiveDocument.ActiveView
                view.viewTop()
            except Exception:
                pass
            try:
                FreeCADGui.Selection.clearSelection()
                for obj in doc.Objects:
                    if getattr(obj, "Shape", None) is not None:
                        FreeCADGui.Selection.addSelection(obj)
                FreeCADGui.SendMsgToActiveView("ViewSelection")
                FreeCADGui.Selection.clearSelection()
            except Exception:
                pass
            try:
                FreeCADGui.SendMsgToActiveView("ViewFit")
            except Exception:
                pass
            try:
                FreeCADGui.runCommand("Std_ViewFitAll")
            except Exception:
                pass
        except Exception as error:
            FreeCAD.Console.PrintWarning("ArchIToken DXF focus failed: {}\\\\n".format(error))

    for delay in (500, 1500, 3500, 6500):
        QtCore.QTimer.singleShot(delay, architoken_focus_dxf)
`;
}

function freeCadIfcOpenScriptSource(workspaceFilePath: string): string {
  return `# Generated by ArchIToken for deterministic FreeCAD IFC opening.
import FreeCAD

SOURCE = ${JSON.stringify(workspaceFilePath)}

try:
    import importIFC
except Exception as error:
    FreeCAD.Console.PrintWarning("ArchIToken IFC importer module unavailable: {}\\\\n".format(error))
    importIFC = None

if importIFC is not None:
    try:
        importIFC.open(SOURCE)
    except Exception as error:
        FreeCAD.Console.PrintWarning("ArchIToken importIFC.open failed, falling back to openDocument: {}\\\\n".format(error))
        FreeCAD.openDocument(SOURCE)
else:
    FreeCAD.openDocument(SOURCE)

try:
    import FreeCADGui
    from PySide import QtCore
except Exception as error:
    FreeCAD.Console.PrintWarning("ArchIToken IFC GUI bootstrap disabled: {}\\\\n".format(error))
else:
    def architoken_focus_ifc():
        try:
            doc = FreeCAD.ActiveDocument
            if doc is None:
                return
            try:
                doc.recompute()
            except Exception:
                pass
            for workbench in ("BIMWorkbench", "ArchWorkbench", "PartDesignWorkbench"):
                try:
                    FreeCADGui.activateWorkbench(workbench)
                    break
                except Exception:
                    pass
            try:
                FreeCADGui.Control.closeDialog()
            except Exception:
                pass
            try:
                from PySide import QtGui
                main_window = FreeCADGui.getMainWindow()
                for dock in main_window.findChildren(QtGui.QDockWidget):
                    title = dock.windowTitle().lower()
                    left_panel = "combo" in title or "组合" in title or "model" in title or "模型" in title
                    if not left_panel:
                        dock.hide()
            except Exception:
                pass
            visible_objects = []
            for obj in doc.Objects:
                try:
                    obj.ViewObject.Visibility = True
                    obj.ViewObject.LineColor = (0.88, 0.90, 0.94)
                    obj.ViewObject.PointColor = (0.88, 0.90, 0.94)
                    obj.ViewObject.ShapeColor = (0.80, 0.84, 0.90)
                    visible_objects.append(obj)
                except Exception:
                    pass
            try:
                view = FreeCADGui.ActiveDocument.ActiveView
                view.viewAxonometric()
            except Exception:
                pass
            try:
                FreeCADGui.Selection.clearSelection()
                for obj in visible_objects[:512]:
                    FreeCADGui.Selection.addSelection(obj)
                FreeCADGui.SendMsgToActiveView("ViewSelection")
                FreeCADGui.Selection.clearSelection()
            except Exception:
                pass
            try:
                FreeCADGui.SendMsgToActiveView("ViewFit")
            except Exception:
                pass
            try:
                FreeCADGui.runCommand("Std_ViewFitAll")
            except Exception:
                pass
        except Exception as error:
            FreeCAD.Console.PrintWarning("ArchIToken IFC focus failed: {}\\\\n".format(error))

    for delay in (800, 1800, 3500, 6500, 10000):
        QtCore.QTimer.singleShot(delay, architoken_focus_ifc)
`;
}

function freeCadStartupModuleSource(workspaceFilePath: string): string {
  const ext = extname(workspaceFilePath).toLowerCase();
  return `# Generated by ArchIToken for this isolated FreeCAD session.
import FreeCAD

try:
    import FreeCADGui
    from PySide import QtCore
except Exception as error:
    FreeCAD.Console.PrintWarning("ArchIToken startup module disabled: {}\\n".format(error))
else:
    SOURCE_EXT = ${JSON.stringify(ext)}

    def architoken_focus_source_view():
        try:
            doc = FreeCAD.ActiveDocument
            if doc is None:
                return
            try:
                doc.recompute()
            except Exception:
                pass

            if SOURCE_EXT in (".dxf", ".dwg"):
                try:
                    FreeCADGui.activateWorkbench("DraftWorkbench")
                except Exception:
                    pass
                try:
                    FreeCADGui.ActiveDocument.ActiveView.viewTop()
                except Exception:
                    pass
            elif SOURCE_EXT in (".ifc", ".ifczip"):
                for workbench in ("BIMWorkbench", "ArchWorkbench"):
                    try:
                        FreeCADGui.activateWorkbench(workbench)
                        break
                    except Exception:
                        pass
            else:
                try:
                    FreeCADGui.ActiveDocument.ActiveView.viewAxonometric()
                except Exception:
                    pass

            try:
                FreeCADGui.SendMsgToActiveView("ViewFit")
            except Exception:
                pass
            try:
                FreeCADGui.runCommand("Std_ViewFitAll")
            except Exception:
                pass
        except Exception as error:
            FreeCAD.Console.PrintWarning("ArchIToken view fit failed: {}\\n".format(error))

    for delay in (800, 1800, 3500, 6500):
        QtCore.QTimer.singleShot(delay, architoken_focus_source_view)
`;
}

function blenderImportExpression(
  workspaceFilePath: string,
  ext: string,
): string {
  const quotedPath = JSON.stringify(workspaceFilePath);
  const bootstrap = [
    "import bpy",
    "import mathutils",
    "def architoken_configure_blender():",
    "    prefs = bpy.context.preferences",
    "    prefs.view.show_splash = False",
    "    prefs.view.language = 'zh_HANS'",
    "    prefs.view.use_translate_interface = True",
    "    prefs.view.use_translate_tooltips = True",
    "    prefs.view.use_translate_new_dataname = True",
    "    try:",
    "        bpy.app.translations.locale = 'zh_HANS'",
    "    except Exception:",
    "        pass",
    "    try:",
    "        bpy.ops.wm.save_userpref()",
    "    except Exception:",
    "        pass",
    "architoken_configure_blender()",
  ].join("\n");
  const fitView = [
    "bpy.ops.object.select_all(action='SELECT')",
    "objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']",
    "if objects:",
    "    corners = [obj.matrix_world @ mathutils.Vector(corner) for obj in objects for corner in obj.bound_box]",
    "    min_corner = mathutils.Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))",
    "    max_corner = mathutils.Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))",
    "    center = (min_corner + max_corner) * 0.5",
    "    distance = max((max_corner - min_corner).length * 1.5, 1.0)",
    "for area in bpy.context.window.screen.areas:",
    "    if area.type == 'VIEW_3D':",
    "        region = next((region for region in area.regions if region.type == 'WINDOW'), None)",
    "        space = next((space for space in area.spaces if space.type == 'VIEW_3D'), None)",
    "        if region and space:",
    "            if objects and space.region_3d:",
    "                space.region_3d.view_location = center",
    "                space.region_3d.view_distance = distance",
    "            with bpy.context.temp_override(area=area, region=region, space_data=space):",
    "                bpy.ops.view3d.view_selected(use_all_regions=False)",
    "        break",
  ].join("\n");
  if (ext === ".blend") {
    return `${bootstrap}\npath = ${quotedPath}\nbpy.ops.wm.open_mainfile(filepath=path)\narchitoken_configure_blender()\n${fitView}`;
  }
  if (ext === ".stl") {
    return `${bootstrap}\npath = ${quotedPath}\nbpy.ops.object.select_all(action='SELECT')\nbpy.ops.object.delete()\nbpy.ops.wm.stl_import(filepath=path)\n${fitView}`;
  }
  if (ext === ".obj") {
    return `${bootstrap}\npath = ${quotedPath}\nbpy.ops.object.select_all(action='SELECT')\nbpy.ops.object.delete()\nbpy.ops.wm.obj_import(filepath=path)\n${fitView}`;
  }
  if (ext === ".fbx") {
    return `${bootstrap}\npath = ${quotedPath}\nbpy.ops.object.select_all(action='SELECT')\nbpy.ops.object.delete()\nbpy.ops.import_scene.fbx(filepath=path)\n${fitView}`;
  }
  if (ext === ".glb" || ext === ".gltf") {
    return `${bootstrap}\npath = ${quotedPath}\nbpy.ops.object.select_all(action='SELECT')\nbpy.ops.object.delete()\nbpy.ops.import_scene.gltf(filepath=path)\n${fitView}`;
  }
  if ([".usd", ".usda", ".usdc", ".usdz"].includes(ext)) {
    return `${bootstrap}\npath = ${quotedPath}\nbpy.ops.object.select_all(action='SELECT')\nbpy.ops.object.delete()\nbpy.ops.wm.usd_import(filepath=path)\n${fitView}`;
  }
  if (ext === ".ply") {
    return `${bootstrap}\npath = ${quotedPath}\nbpy.ops.object.select_all(action='SELECT')\nbpy.ops.object.delete()\nbpy.ops.wm.ply_import(filepath=path)\n${fitView}`;
  }
  if (ext === ".dae") {
    return `${bootstrap}\npath = ${quotedPath}\nbpy.ops.object.select_all(action='SELECT')\nbpy.ops.object.delete()\nbpy.ops.wm.collada_import(filepath=path)\n${fitView}`;
  }
  return `${bootstrap}\nraise RuntimeError('ArchIToken: Blender native import is not registered for ${ext}')`;
}

export function engineeringNativeWorkbenchLaunchUrl(
  publicUrl: string,
  sessionId: string,
): string {
  const url = new URL("/vnc.html", trimTrailingSlash(publicUrl));
  url.searchParams.set("autoconnect", "1");
  url.searchParams.set("resize", "remote");
  url.searchParams.set("quality", "9");
  url.searchParams.set("compression", "0");
  url.searchParams.set("path", "websockify");
  url.searchParams.set("architokenSession", sessionId);
  return url.toString();
}

function configuredEngineeringNativeWorkbenchPublicUrl(): string {
  return trimTrailingSlash(
    process.env.ARCHITOKEN_ENGINEERING_NATIVE_WORKBENCH_PUBLIC_URL ||
      process.env.ARCHITOKEN_ENGINEERING_NATIVE_WORKBENCH_URL,
  );
}

function configuredEngineeringNativeWorkbenchApiUrl(): string {
  return trimTrailingSlash(
    process.env.ARCHITOKEN_ENGINEERING_NATIVE_WORKBENCH_API_URL ||
      process.env.ARCHITOKEN_ENGINEERING_NATIVE_WORKBENCH_URL,
  );
}

function engineeringNativeWorkspaceFilePath(
  metadata: LocalFileMetadata,
  app: EngineeringNativeExternalApp,
): string {
  return join(
    engineeringNativeWorkspaceFolder(engineeringNativeSessionId(metadata, app)),
    safeNativeWorkspaceFileName(metadata.originalName),
  );
}

function engineeringNativeSessionId(
  metadata: LocalFileMetadata,
  app: EngineeringNativeExternalApp,
): string {
  return [
    "native",
    app,
    metadata.fileId.replace(/[^a-zA-Z0-9_.-]/g, "_"),
    metadata.checksum.slice(0, 12),
  ].join("-");
}

function engineeringNativeWorkspaceFolder(sessionId: string): string {
  return join(configuredEngineeringNativeWorkspaceRoot(), sessionId);
}

function configuredEngineeringNativeWorkspaceRoot(): string {
  return resolve(
    process.env.ARCHITOKEN_ENGINEERING_NATIVE_SESSION_DIR?.trim() ||
      join(process.cwd(), "runtime", "engineering-native-sessions"),
  );
}

function ensureNativeAppSupportsExtension(
  app: EngineeringNativeExternalApp,
  ext: string,
): void {
  const route = engineeringNativeExternalAppsFor(ext).find(
    (candidate) => candidate.app === app,
  );
  if (route?.status !== "ready") {
    throw new EngineeringNativeSessionError(
      `${app} is not registered as a native opener for ${ext}`,
      409,
    );
  }
}

async function requireEngineeringNativeMetadata(
  fileId: string,
): Promise<LocalFileMetadata> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new EngineeringNativeSessionError("file not found", 404);
  }
  return metadata;
}

function safeNativeWorkspaceFileName(name: string): string {
  return (
    basename(name)
      .replace(/[\\/]/g, "_")
      .replace(/[^\p{L}\p{N}._ -]/gu, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160) || "engineering-source"
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function resolveCommandFromPath(command: string): string | null {
  const pathEntries = (process.env.PATH ?? "").split(":").filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = `${entry}/${command}`;
    if (isExecutableFile(candidate)) return candidate;
  }
  return null;
}

function isExecutableFile(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function engineeringNativePublicOriginFromRequest(
  requestUrl: string,
): string {
  const configured = trimTrailingSlash(process.env.ARCHITOKEN_PUBLIC_BASE_URL);
  if (configured) return configured;
  return new URL(requestUrl).origin;
}

function trimTrailingSlash(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

const freeCadNativeExtensions = new Set([
  ".step",
  ".stp",
  ".iges",
  ".igs",
  ".brep",
  ".stl",
  ".obj",
  ".fcstd",
  ".ifc",
  ".ifczip",
  ".dxf",
]);

const blenderNativeExtensions = new Set([
  ".blend",
  ".glb",
  ".gltf",
  ".stl",
  ".obj",
  ".fbx",
  ".dae",
  ".usd",
  ".usda",
  ".usdc",
  ".usdz",
  ".ply",
]);
