// app/api/local-files/[fileId]/pdf-operation/route.test.ts - PDF runtime evidence contracts
// License: Apache-2.0

import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getLocalFileMetadata,
  saveLocalUpload,
} from "@/lib/local-file-runtime-server";
import { POST } from "./route";

describe("PDF operation route", () => {
  let uploadDir: string;
  let workerDir: string;
  let workerBinary: string;
  let previousUploadDir: string | undefined;
  let previousWorkersDir: string | undefined;
  let previousWorkerBinary: string | undefined;

  beforeEach(async () => {
    previousUploadDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    previousWorkersDir = process.env.ARCHITOKEN_WORKERS_DIR;
    previousWorkerBinary = process.env.ARCHITOKEN_WORKER_CLI_BINARY;
    uploadDir = await mkdtemp(join(tmpdir(), "architoken-pdf-upload-"));
    workerDir = await mkdtemp(join(tmpdir(), "architoken-pdf-worker-"));
    workerBinary = join(workerDir, "worker.js");
    process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = uploadDir;
    process.env.ARCHITOKEN_WORKERS_DIR = workerDir;
    process.env.ARCHITOKEN_WORKER_CLI_BINARY = workerBinary;
  });

  afterEach(async () => {
    restoreEnv("ARCHITOKEN_LOCAL_UPLOADS_DIR", previousUploadDir);
    restoreEnv("ARCHITOKEN_WORKERS_DIR", previousWorkersDir);
    restoreEnv("ARCHITOKEN_WORKER_CLI_BINARY", previousWorkerBinary);
    await rm(uploadDir, { recursive: true, force: true });
    await rm(workerDir, { recursive: true, force: true });
  });

  it("persists a real PDF artifact and records checksum/write-back evidence", async () => {
    await writeWorkerScript(workerBinary, true);
    const saved = await saveLocalUpload({
      file: new File(["%PDF-1.7 source"], "source.pdf", {
        type: "application/pdf",
      }),
      moduleId: "digital_archive",
    });

    const response = await POST(
      new Request(
        `http://localhost:3000/api/local-files/${saved.fileId}/pdf-operation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdfOperation: "merge-pdfs",
            saveMode: "new_file",
          }),
        },
      ),
      { params: Promise.resolve({ fileId: saved.fileId }) },
    );
    const payload = (await response.json()) as {
      artifacts?: Array<{ checksum?: string; role?: string }>;
      savedFile?: { fileId?: string; checksum?: string } | null;
      writeBack?: { mode?: string; checksum?: string } | null;
      runtimeRecord?: { route?: string; artifact?: { checksum?: string } };
    };

    expect(response.status).toBe(200);
    expect(payload.artifacts?.[0]?.role).toBe("pdf_derivative");
    expect(payload.artifacts?.[0]?.checksum).toEqual(expect.any(String));
    expect(payload.savedFile?.checksum).toEqual(expect.any(String));
    expect(payload.writeBack?.mode).toBe("new_file");
    expect(payload.runtimeRecord?.route).toBe("pdf-operation");
    expect(payload.runtimeRecord?.artifact?.checksum).toBe(
      payload.artifacts?.[0]?.checksum,
    );
    expect(
      (await getLocalFileMetadata(saved.fileId))?.runtimeRecords?.at(-1)
        ?.writeBack?.fileId,
    ).toBe(payload.savedFile?.fileId);
  });

  it("fails closed when a worker reports completed without artifact evidence", async () => {
    await writeWorkerScript(workerBinary, false);
    const saved = await saveLocalUpload({
      file: new File(["%PDF-1.7 source"], "source.pdf", {
        type: "application/pdf",
      }),
      moduleId: "digital_archive",
    });

    const response = await POST(
      new Request(
        `http://localhost:3000/api/local-files/${saved.fileId}/pdf-operation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfOperation: "merge-pdfs" }),
        },
      ),
      { params: Promise.resolve({ fileId: saved.fileId }) },
    );
    const payload = (await response.json()) as {
      failureEvidence?: { code?: string };
      runtimeRecord?: {
        status?: string;
        failureEvidence?: { code?: string };
      };
    };

    expect(response.status).toBe(500);
    expect(payload.failureEvidence?.code).toBe("pdf_operation_missing_artifact");
    expect(payload.runtimeRecord?.status).toBe("failed");
    expect(payload.runtimeRecord?.failureEvidence?.code).toBe(
      "pdf_operation_missing_artifact",
    );
  });
});

async function writeWorkerScript(path: string, withArtifact: boolean) {
  await writeFile(
    path,
    `#!/usr/bin/env node
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const jobArgIndex = process.argv.indexOf("--job");
const job = JSON.parse(fs.readFileSync(process.argv[jobArgIndex + 1], "utf8"));
const outputDir = job.input.outputDir;
fs.mkdirSync(outputDir, { recursive: true });
if (${JSON.stringify(withArtifact)}) {
  const artifactPath = path.join(outputDir, "merged.pdf");
  const bytes = Buffer.from("%PDF-1.7\\\\nreal artifact\\\\n", "utf8");
  fs.writeFileSync(artifactPath, bytes);
  console.log(JSON.stringify({
    status: "completed",
    artifacts: [{
      name: "merged.pdf",
      media_type: "application/pdf",
      role: "pdf_derivative",
      metadata: {
        path: artifactPath,
        sizeBytes: bytes.byteLength,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex")
      }
    }]
  }));
} else {
  console.log(JSON.stringify({ status: "completed", artifacts: [] }));
}
`,
    "utf8",
  );
  await chmod(path, 0o755);
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
