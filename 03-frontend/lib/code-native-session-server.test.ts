// lib/code-native-session-server.test.ts - Source-bound code editor session tests
// License: Apache-2.0

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCodeNativeSessionManifest,
  commitCodeServerSession,
} from "./code-native-session-server";
import {
  getLocalFileMetadata,
  saveLocalUpload,
} from "./local-file-runtime-server";

describe("code native session server", () => {
  let uploadDir: string;
  let previousUploadDir: string | undefined;
  let previousProvider: string | undefined;
  let previousCodeServerUrl: string | undefined;
  let previousWorkspaceDir: string | undefined;
  let previousWorkspaceMount: string | undefined;
  let previousPublicBaseUrl: string | undefined;

  beforeEach(async () => {
    previousUploadDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    previousProvider = process.env.ARCHITOKEN_CODE_EDITOR_PROVIDER;
    previousCodeServerUrl = process.env.CODE_SERVER_URL;
    previousWorkspaceDir = process.env.ARCHITOKEN_CODE_SERVER_WORKSPACE_DIR;
    previousWorkspaceMount = process.env.CODE_SERVER_WORKSPACE_MOUNT;
    previousPublicBaseUrl = process.env.ARCHITOKEN_PUBLIC_BASE_URL;
    uploadDir = await mkdtemp(join(tmpdir(), "architoken-code-native-"));
    process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = uploadDir;
    delete process.env.ARCHITOKEN_CODE_EDITOR_PROVIDER;
    delete process.env.CODE_SERVER_URL;
    process.env.ARCHITOKEN_CODE_SERVER_WORKSPACE_DIR = join(
      uploadDir,
      "code-workspaces",
    );
    process.env.CODE_SERVER_WORKSPACE_MOUNT = "/workspace";
    delete process.env.ARCHITOKEN_PUBLIC_BASE_URL;
  });

  afterEach(async () => {
    restoreEnv("ARCHITOKEN_LOCAL_UPLOADS_DIR", previousUploadDir);
    restoreEnv("ARCHITOKEN_CODE_EDITOR_PROVIDER", previousProvider);
    restoreEnv("CODE_SERVER_URL", previousCodeServerUrl);
    restoreEnv("ARCHITOKEN_CODE_SERVER_WORKSPACE_DIR", previousWorkspaceDir);
    restoreEnv("CODE_SERVER_WORKSPACE_MOUNT", previousWorkspaceMount);
    restoreEnv("ARCHITOKEN_PUBLIC_BASE_URL", previousPublicBaseUrl);
    await rm(uploadDir, { recursive: true, force: true });
  });

  it("builds a Monaco inline source-bound session by default", async () => {
    const saved = await saveLocalUpload({
      file: new File(['{"name":"demo"}'], "package.json", {
        type: "application/json",
      }),
      moduleId: "digital_archive",
    });

    const manifest = await buildCodeNativeSessionManifest(
      saved.fileId,
      "http://localhost:3000/api/local-files/example/code-session",
    );

    expect(manifest.viewer).toBe("monaco_inline_editor");
    expect(manifest.canEdit).toBe(true);
    expect(manifest.canSaveBack).toBe(true);
    expect(manifest.monaco?.version).toBe("0.55.1");
    expect(manifest.sourceOfRecord.substitutePreview).toBe(false);
    expect(manifest.sourceOfRecord.url).toBe(
      `http://localhost:3000/api/local-files/${saved.fileId}`,
    );
  });

  it("builds a code-server sidecar manifest when configured", async () => {
    process.env.ARCHITOKEN_CODE_EDITOR_PROVIDER = "code-server";
    process.env.CODE_SERVER_URL = "http://code-server.example:9981/";
    process.env.ARCHITOKEN_PUBLIC_BASE_URL = "http://architoken.example";
    const saved = await saveLocalUpload({
      file: new File(["fn main() {}"], "main.rs", { type: "text/rust" }),
      moduleId: "digital_archive",
    });

    const manifest = await buildCodeNativeSessionManifest(
      saved.fileId,
      "http://localhost:3000/api/local-files/example/code-session",
    );

    expect(manifest.viewer).toBe("code_server_sidecar");
    expect(manifest.codeServer?.version).toBe("4.121.0");
    expect(manifest.codeServer?.baseUrl).toBe(
      "http://code-server.example:9981",
    );
    expect(manifest.codeServer?.workspacePolicy).toBe(
      "session_workspace_required",
    );
    expect(manifest.canSaveBack).toBe(true);
    expect(manifest.codeServer?.workspaceFolder).toContain("/workspace/");
    expect(manifest.codeServer?.commitUrl).toBe(
      `http://architoken.example/api/local-files/${saved.fileId}/code-session/commit`,
    );
    expect(manifest.sourceOfRecord.url).toBe(
      `http://architoken.example/api/local-files/${saved.fileId}`,
    );
  });

  it("commits code-server workspace edits back to the local CDE object", async () => {
    process.env.ARCHITOKEN_CODE_EDITOR_PROVIDER = "code-server";
    process.env.CODE_SERVER_URL = "http://code-server.example:9981";
    const saved = await saveLocalUpload({
      file: new File(["fn main() {}"], "main.rs", { type: "text/rust" }),
      moduleId: "digital_archive",
    });
    const manifest = await buildCodeNativeSessionManifest(
      saved.fileId,
      "http://localhost:3000/api/local-files/example/code-session",
    );
    const sessionId = manifest.codeServer?.sessionId ?? "";
    await writeFile(
      join(
        process.env.ARCHITOKEN_CODE_SERVER_WORKSPACE_DIR ?? "",
        sessionId,
        "main.rs",
      ),
      'fn main() { println!("ok"); }\n',
      "utf8",
    );

    const result = await commitCodeServerSession(saved.fileId, { sessionId });
    const updated = await getLocalFileMetadata(saved.fileId);

    expect(result.updated).toBe(true);
    expect(result.version).toBe("v1.1");
    expect(result.schema).toBe("architoken.code_native_commit.v1");
    expect(result.workspaceChecksum).toBe(result.checksum);
    expect(result.artifact.role).toBe("code_server_workspace_writeback");
    expect(result.writeBack.checksum).toBe(result.checksum);
    expect(updated?.checksum).toBe(result.checksum);
    expect(updated?.tags).toContain("code-server-edit");
    expect(updated?.runtimeRecords?.at(-1)?.route).toBe(
      "code-session/commit",
    );
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
