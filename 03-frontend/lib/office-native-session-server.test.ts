// lib/office-native-session-server.test.ts - Native Office editor session contract
// License: Apache-2.0

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCollaboraWopiCheckFileInfo,
  buildOfficeNativeSessionManifest,
  handleOnlyOfficeSaveCallback,
  readCollaboraWopiFileContents,
  writeCollaboraWopiFileContents,
} from "./office-native-session-server";
import {
  getLocalFileMetadata,
  saveLocalUpload,
} from "./local-file-runtime-server";

describe("office native session server", () => {
  let uploadDir: string;
  let previousUploadDir: string | undefined;
  let previousOnlyOfficeUrl: string | undefined;
  let previousCollaboraUrl: string | undefined;
  let previousOfficeEditorProvider: string | undefined;
  let previousPublicBaseUrl: string | undefined;
  let previousJwtSecret: string | undefined;
  let previousWopiSecret: string | undefined;
  let previousFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    previousUploadDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    previousOnlyOfficeUrl = process.env.ONLYOFFICE_DOCUMENT_SERVER_URL;
    previousCollaboraUrl = process.env.COLLABORA_ONLINE_URL;
    previousOfficeEditorProvider = process.env.ARCHITOKEN_OFFICE_EDITOR_PROVIDER;
    previousPublicBaseUrl = process.env.ARCHITOKEN_PUBLIC_BASE_URL;
    previousJwtSecret = process.env.ONLYOFFICE_JWT_SECRET;
    previousWopiSecret = process.env.COLLABORA_WOPI_TOKEN_SECRET;
    previousFetch = globalThis.fetch;
    uploadDir = await mkdtemp(join(tmpdir(), "architoken-office-native-"));
    process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = uploadDir;
    delete process.env.ONLYOFFICE_DOCUMENT_SERVER_URL;
    delete process.env.COLLABORA_ONLINE_URL;
    delete process.env.ARCHITOKEN_OFFICE_EDITOR_PROVIDER;
    delete process.env.ARCHITOKEN_PUBLIC_BASE_URL;
    delete process.env.ONLYOFFICE_JWT_SECRET;
    delete process.env.COLLABORA_WOPI_TOKEN_SECRET;
  });

  afterEach(async () => {
    if (previousUploadDir === undefined) {
      delete process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    } else {
      process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = previousUploadDir;
    }
    if (previousOnlyOfficeUrl === undefined) {
      delete process.env.ONLYOFFICE_DOCUMENT_SERVER_URL;
    } else {
      process.env.ONLYOFFICE_DOCUMENT_SERVER_URL = previousOnlyOfficeUrl;
    }
    if (previousCollaboraUrl === undefined) {
      delete process.env.COLLABORA_ONLINE_URL;
    } else {
      process.env.COLLABORA_ONLINE_URL = previousCollaboraUrl;
    }
    if (previousOfficeEditorProvider === undefined) {
      delete process.env.ARCHITOKEN_OFFICE_EDITOR_PROVIDER;
    } else {
      process.env.ARCHITOKEN_OFFICE_EDITOR_PROVIDER =
        previousOfficeEditorProvider;
    }
    if (previousPublicBaseUrl === undefined) {
      delete process.env.ARCHITOKEN_PUBLIC_BASE_URL;
    } else {
      process.env.ARCHITOKEN_PUBLIC_BASE_URL = previousPublicBaseUrl;
    }
    if (previousJwtSecret === undefined) {
      delete process.env.ONLYOFFICE_JWT_SECRET;
    } else {
      process.env.ONLYOFFICE_JWT_SECRET = previousJwtSecret;
    }
    if (previousWopiSecret === undefined) {
      delete process.env.COLLABORA_WOPI_TOKEN_SECRET;
    } else {
      process.env.COLLABORA_WOPI_TOKEN_SECRET = previousWopiSecret;
    }
    globalThis.fetch = previousFetch;
    await rm(uploadDir, { recursive: true, force: true });
  });

  it("fails closed until a native Office editor service is configured", async () => {
    const saved = await saveLocalUpload({
      file: new File(["fake xlsx"], "pricing.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      moduleId: "construction_management",
    });

    const manifest = await buildOfficeNativeSessionManifest(
      saved.fileId,
      "http://localhost:3000/api/local-files/example/office-session",
    );

    expect(manifest.viewer).toBe("office_runtime_required");
    expect(manifest.canEdit).toBe(false);
    expect(manifest.sourceOfRecord.substitutePreview).toBe(false);
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "onlyoffice-documentserver",
      )?.status,
    ).toBe("missing");
  });

  it("builds a source-bound OnlyOffice edit session with save callback", async () => {
    process.env.ARCHITOKEN_OFFICE_EDITOR_PROVIDER = "onlyoffice";
    process.env.ONLYOFFICE_DOCUMENT_SERVER_URL =
      "http://documentserver.example";
    process.env.ARCHITOKEN_PUBLIC_BASE_URL = "http://architoken.example";
    process.env.ONLYOFFICE_JWT_SECRET = "test-secret";
    const saved = await saveLocalUpload({
      file: new File(["fake xlsx"], "pricing.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      moduleId: "construction_management",
    });

    const manifest = await buildOfficeNativeSessionManifest(
      saved.fileId,
      "http://localhost:3000/api/local-files/example/office-session",
    );

    expect(manifest.viewer).toBe("onlyoffice_editor");
    expect(manifest.canEdit).toBe(true);
    expect(manifest.onlyoffice?.apiScriptUrl).toBe(
      "http://documentserver.example/web-apps/apps/api/documents/api.js",
    );
    expect(manifest.onlyoffice?.config.documentType).toBe("cell");
    expect(manifest.onlyoffice?.config.document.url).toBe(
      `http://architoken.example/api/local-files/${saved.fileId}`,
    );
    expect(manifest.onlyoffice?.config.editorConfig.callbackUrl).toBe(
      `http://architoken.example/api/local-files/${saved.fileId}/office-session/callback`,
    );
    expect(manifest.onlyoffice?.config.token).toEqual(expect.any(String));
  });

  it("builds a source-bound OnlyOffice PDF editor session", async () => {
    process.env.ARCHITOKEN_OFFICE_EDITOR_PROVIDER = "onlyoffice";
    process.env.ONLYOFFICE_DOCUMENT_SERVER_URL =
      "http://documentserver.example";
    process.env.ARCHITOKEN_PUBLIC_BASE_URL = "http://architoken.example";
    const saved = await saveLocalUpload({
      file: new File(["%PDF-1.7 fake"], "submittal.pdf", {
        type: "application/pdf",
      }),
      moduleId: "construction_management",
    });

    const manifest = await buildOfficeNativeSessionManifest(
      saved.fileId,
      "http://localhost:3000/api/local-files/example/office-session",
    );

    expect(manifest.viewer).toBe("onlyoffice_editor");
    expect(manifest.canEdit).toBe(true);
    expect(manifest.canSaveBack).toBe(true);
    expect(manifest.onlyoffice?.config.documentType).toBe("pdf");
    expect(manifest.onlyoffice?.config.document.fileType).toBe("pdf");
    expect(manifest.onlyoffice?.config.document.url).toBe(
      `http://architoken.example/api/local-files/${saved.fileId}`,
    );
  });

  it.each([
    ["legacy.doc", "application/msword", "word", "DOC"],
    ["legacy.xls", "application/vnd.ms-excel", "cell", "XLS"],
    ["legacy.ppt", "application/vnd.ms-powerpoint", "slide", "PPT"],
  ] as const)(
    "routes %s through the matching OnlyOffice editor",
    async (name, mimeType, documentType, legacyLabel) => {
      process.env.ONLYOFFICE_DOCUMENT_SERVER_URL =
        "http://documentserver.example";
      process.env.ARCHITOKEN_OFFICE_EDITOR_PROVIDER = "onlyoffice";
      process.env.ARCHITOKEN_PUBLIC_BASE_URL = "http://architoken.example";
      const saved = await saveLocalUpload({
        file: new File(["legacy office bytes"], name, { type: mimeType }),
        moduleId: "construction_management",
      });

      const manifest = await buildOfficeNativeSessionManifest(
        saved.fileId,
        "http://localhost:3000/api/local-files/example/office-session",
      );

      expect(manifest.viewer).toBe("onlyoffice_editor");
      expect(manifest.canEdit).toBe(true);
      expect(manifest.canSaveBack).toBe(true);
      expect(manifest.onlyoffice?.config.documentType).toBe(documentType);
      expect(manifest.onlyoffice?.config.document.fileType).toBe(
        name.split(".").at(-1),
      );
      expect(manifest.notes.join(" ")).toContain(legacyLabel);
    },
  );

  it("builds a Collabora WOPI edit session and serves WOPI contents", async () => {
    process.env.ARCHITOKEN_OFFICE_EDITOR_PROVIDER = "collabora";
    process.env.COLLABORA_ONLINE_URL = "http://collabora.example";
    process.env.COLLABORA_WOPI_TOKEN_SECRET = "wopi-secret";
    process.env.ARCHITOKEN_PUBLIC_BASE_URL = "http://architoken.example";
    const saved = await saveLocalUpload({
      file: new File(["collabora xlsx"], "cost.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      moduleId: "construction_management",
    });

    const manifest = await buildOfficeNativeSessionManifest(
      saved.fileId,
      "http://localhost:3000/api/local-files/example/office-session",
    );

    expect(manifest.viewer).toBe("collabora_wopi_editor");
    expect(manifest.canEdit).toBe(true);
    expect(manifest.canSaveBack).toBe(true);
    expect(manifest.collabora?.wopiSrc).toBe(
      `http://architoken.example/api/wopi/files/${saved.fileId}`,
    );
    expect(manifest.collabora?.editorUrl).toContain(
      "http://collabora.example/browser/dist/cool.html?",
    );
    expect(manifest.collabora?.editorUrl).toContain("WOPISrc=");
    const collaboraUrl = new URL(manifest.collabora?.editorUrl ?? "");
    expect(collaboraUrl.searchParams.get("ui_defaults")).toBe(
      "UIMode=notebookbar;TextSidebar=false;SpreadsheetSidebar=false;PresentationSidebar=false",
    );
    expect(
      manifest.adapters.find((adapter) => adapter.id === "collabora-online-wopi")
        ?.status,
    ).toBe("available");

    const wopiUrl = `${manifest.collabora?.wopiSrc}?access_token=${manifest.collabora?.accessToken}`;
    const checkInfo = await buildCollaboraWopiCheckFileInfo(
      saved.fileId,
      new Request(wopiUrl),
    );
    expect(checkInfo.BaseFileName).toBe("cost.xlsx");
    expect(checkInfo.SupportsUpdate).toBe(true);
    expect(checkInfo.UserCanWrite).toBe(true);

    const contents = await readCollaboraWopiFileContents(
      saved.fileId,
      new Request(`${wopiUrl}&access_token_ttl=0`),
    );
    expect(new TextDecoder().decode(contents.bytes)).toBe("collabora xlsx");

    const mutation = await writeCollaboraWopiFileContents(
      saved.fileId,
      new Request(wopiUrl, {
        method: "POST",
      }),
      new TextEncoder().encode("edited by collabora"),
    );
    expect(mutation.updated).toBe(true);
    expect(mutation.checksum).toEqual(expect.any(String));
    expect(mutation.artifact?.role).toBe("collabora_wopi_putfile_binary");
    expect(mutation.writeBack?.checksum).toBe(mutation.checksum);
    expect(mutation.runtimeRecord?.route).toBe("collabora-wopi/putfile");
    const updated = await getLocalFileMetadata(saved.fileId);
    expect(updated?.size).toBe("edited by collabora".length);
    expect(updated?.tags).toContain("collabora-wopi-saveback");
    expect(updated?.runtimeRecords?.at(-1)?.artifact?.checksum).toBe(
      updated?.checksum,
    );
  });

  it("saves edited Office bytes from an OnlyOffice callback", async () => {
    const saved = await saveLocalUpload({
      file: new File(["old"], "contract.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      moduleId: "construction_management",
    });
    globalThis.fetch = (async () =>
      new Response(new TextEncoder().encode("new office bytes"), {
        status: 200,
        headers: { "content-type": saved.mimeType },
      })) as typeof fetch;

    const result = await handleOnlyOfficeSaveCallback(saved.fileId, {
      status: 2,
      url: "http://documentserver.example/cache/edited.docx",
    });

    expect(result.onlyOfficeError).toBe(0);
    expect(result.updated).toBe(true);
    expect(result.checksum).toEqual(expect.any(String));
    expect(result.artifact?.role).toBe("onlyoffice_saveback_binary");
    expect(result.writeBack?.checksum).toBe(result.checksum);
    expect(result.runtimeRecord?.route).toBe("office-session/callback");
    const updated = await getLocalFileMetadata(saved.fileId);
    expect(updated?.size).toBe("new office bytes".length);
    expect(updated?.tags).toContain("office-native-edit");
    expect(updated?.runtimeRecords?.at(-1)?.artifact?.checksum).toBe(
      updated?.checksum,
    );
  });
});
