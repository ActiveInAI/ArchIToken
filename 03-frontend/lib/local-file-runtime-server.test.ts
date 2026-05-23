// lib/local-file-runtime-server.test.ts - Local upload persistence contract
// License: Apache-2.0

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteLocalUpload,
  getLocalUploadsIndexPath,
  getLocalFileMetadata,
  readLocalFileIndex,
  resolveLocalUploadStoragePath,
  saveLocalUpload,
} from "./local-file-runtime-server";

describe("local file runtime server", () => {
  let uploadDir: string;
  let previousUploadDir: string | undefined;

  beforeEach(async () => {
    previousUploadDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    uploadDir = await mkdtemp(join(tmpdir(), "architoken-local-files-"));
    process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = uploadDir;
  });

  afterEach(async () => {
    if (previousUploadDir === undefined) {
      delete process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    } else {
      process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = previousUploadDir;
    }
    await rm(uploadDir, { recursive: true, force: true });
  });

  it("deduplicates identical uploads and deletes the persisted object", async () => {
    const firstFile = new File(["hello office"], "demo.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const secondFile = new File(["hello office"], "demo.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const first = await saveLocalUpload({
      file: firstFile,
      moduleId: "detailed_design",
      parentId: "folder-a",
    });
    const second = await saveLocalUpload({
      file: secondFile,
      moduleId: "detailed_design",
      parentId: "folder-a",
    });

    expect(second.fileId).toBe(first.fileId);
    expect(first.status).toBe("uploaded");
    expect(second.status).toBe("uploaded");
    expect((await readLocalFileIndex()).files).toHaveLength(1);
    await expect(
      readFile(resolveLocalUploadStoragePath(first)),
    ).resolves.toBeInstanceOf(Buffer);

    const deleted = await deleteLocalUpload(first.fileId);
    expect(deleted?.fileId).toBe(first.fileId);
    expect(await getLocalFileMetadata(first.fileId)).toBeNull();
    expect((await readLocalFileIndex()).files).toHaveLength(0);
    await expect(
      readFile(resolveLocalUploadStoragePath(first)),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("normalizes legacy schema-validating upload metadata to uploaded", async () => {
    await writeFile(
      getLocalUploadsIndexPath(),
      JSON.stringify({
        files: [
          {
            fileId: "local-legacy",
            originalName: "legacy.pdf",
            moduleId: "digital_archive",
            parentId: "digital_archive-root",
            size: 1024,
            mimeType: "application/pdf",
            ext: ".pdf",
            storagePath: join(uploadDir, "local-legacy.pdf"),
            createdAt: "2026-05-22T01:00:00.000Z",
            owner: "当前用户",
            status: "schema_validating",
            version: "v1.0",
            tags: ["local-upload", "pdf"],
            checksum: "sha256:legacy",
          },
        ],
      }),
      "utf8",
    );

    const index = await readLocalFileIndex();
    expect(index.files[0]?.status).toBe("uploaded");
    expect(index.files[0]?.tags).toContain("legacy-status-normalized");
  });
});
