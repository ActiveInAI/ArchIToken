// lib/engineering-native-session-server.test.ts - FreeCAD/Blender session save-back contracts
// License: Apache-2.0

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  commitEngineeringNativeSession,
  engineeringNativeWorkbenchLaunchUrl,
  engineeringNativeExternalAppsFor,
  materializeEngineeringNativeSession,
} from "./engineering-native-session-server";
import {
  getLocalFileMetadata,
  resolveLocalUploadStoragePath,
  saveLocalUpload,
} from "./local-file-runtime-server";

describe("engineering native sessions", () => {
  let uploadDir: string;
  let sessionDir: string;
  let previousUploadDir: string | undefined;
  let previousSessionDir: string | undefined;

  beforeEach(async () => {
    previousUploadDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    previousSessionDir = process.env.ARCHITOKEN_ENGINEERING_NATIVE_SESSION_DIR;
    uploadDir = await mkdtemp(join(tmpdir(), "architoken-native-upload-"));
    sessionDir = await mkdtemp(join(tmpdir(), "architoken-native-session-"));
    process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = uploadDir;
    process.env.ARCHITOKEN_ENGINEERING_NATIVE_SESSION_DIR = sessionDir;
  });

  afterEach(async () => {
    if (previousUploadDir === undefined) {
      delete process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    } else {
      process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = previousUploadDir;
    }
    if (previousSessionDir === undefined) {
      delete process.env.ARCHITOKEN_ENGINEERING_NATIVE_SESSION_DIR;
    } else {
      process.env.ARCHITOKEN_ENGINEERING_NATIVE_SESSION_DIR =
        previousSessionDir;
    }
    await rm(uploadDir, { recursive: true, force: true });
    await rm(sessionDir, { recursive: true, force: true });
  });

  it("commits a saved FreeCAD workspace copy as a bumped CDE local version", async () => {
    const saved = await saveLocalUpload({
      file: new File(["ISO-10303-21;ENDSEC;"], "part.step", {
        type: "model/step",
      }),
      moduleId: "digital_archive",
      parentId: "digital_archive-root",
    });

    const session = await materializeEngineeringNativeSession(
      saved,
      "freecad",
      {
        origin: "http://localhost:3000",
      },
    );
    await writeFile(
      session.workspaceFilePath,
      "ISO-10303-21;DATA;/* edited in FreeCAD */;ENDSEC;",
      "utf8",
    );

    const result = await commitEngineeringNativeSession(saved.fileId, {
      app: "freecad",
      sessionId: session.sessionId,
    });

    expect(result.updated).toBe(true);
    expect(result.version).toBe("v1.1");
    expect(result.checksum).toBe(result.workspaceChecksum);
    expect(result.workspaceFilePath).toBe(session.workspaceFilePath);
    expect(result.artifact.role).toBe(
      "engineering_native_workspace_writeback",
    );
    expect(result.artifact.checksum).toBe(result.checksum);
    expect(result.writeBack.checksum).toBe(result.checksum);
    expect(result.runtimeRecord.route).toBe("native-open/commit");
    await expect(
      readFile(
        resolveLocalUploadStoragePath(
          (await getLocalFileMetadata(saved.fileId))!,
        ),
      ),
    ).resolves.toEqual(
      Buffer.from("ISO-10303-21;DATA;/* edited in FreeCAD */;ENDSEC;"),
    );
  });

  it("publishes save-back metadata only for registered native importers", () => {
    const ifcApps = engineeringNativeExternalAppsFor(".ifc");
    const glbApps = engineeringNativeExternalAppsFor(".glb");

    expect(ifcApps.map((route) => route.app)).toEqual(["freecad"]);
    expect(glbApps.map((route) => route.app)).toContain("blender");
    expect(ifcApps[0]?.saveBack.route).toBe("native-open/commit");
    expect(ifcApps[0]?.note).toContain("controlled workspace copy");
    expect(engineeringNativeExternalAppsFor(".dwg")).toEqual([]);
  });

  it("builds a noVNC launch URL for an embedded project workbench", () => {
    expect(
      engineeringNativeWorkbenchLaunchUrl(
        "http://192.168.1.100:6090",
        "native-freecad-local-aabbcc",
      ),
    ).toContain("architokenSession=native-freecad-local-aabbcc");
  });
});
