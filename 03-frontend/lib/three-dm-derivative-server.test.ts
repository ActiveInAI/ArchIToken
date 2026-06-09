// lib/three-dm-derivative-server.test.ts - 3DM to IFC derivative adapter contract
// License: Apache-2.0

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildThreeDmDerivativeManifest,
  readThreeDmDerivativeBytes,
} from "./three-dm-derivative-server";
import { saveLocalUpload } from "./local-file-runtime-server";

describe("3DM derivative server", () => {
  let uploadDir: string;
  let previousUploadDir: string | undefined;
  let previousPath: string | undefined;
  let previousRhinoAdapterUrl: string | undefined;
  let previousSpeckleRhinoAdapterUrl: string | undefined;
  let previousLicensedAdapterUrl: string | undefined;
  let previousRhinoAdapterPath: string | undefined;
  let previousCommand: string | undefined;
  let previousCommandArgs: string | undefined;
  let previousRhinoCommand: string | undefined;
  let previousRhinoCommandArgs: string | undefined;
  let previousThreeDmCommand: string | undefined;
  let previousThreeDmCommandArgs: string | undefined;
  let previousRhinoToIfcCommand: string | undefined;
  let previousRhinoToIfcCommandArgs: string | undefined;
  let previousThreeDm2IfcBin: string | undefined;
  let previousThreeDmToIfcBin: string | undefined;
  let previousRhinoToIfcBin: string | undefined;
  let previousRhinoComputeExportIfcBin: string | undefined;
  let previousDisableRepoWorker: string | undefined;
  let previousFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    previousUploadDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    previousPath = process.env.PATH;
    previousRhinoAdapterUrl = process.env.RHINO_ADAPTER_URL;
    previousSpeckleRhinoAdapterUrl = process.env.SPECKLE_RHINO_ADAPTER_URL;
    previousLicensedAdapterUrl = process.env.LICENSED_BIM_ADAPTER_URL;
    previousRhinoAdapterPath = process.env.RHINO_ADAPTER_PATH;
    previousCommand = process.env.PANAEC_3DM_TO_IFC_COMMAND;
    previousCommandArgs = process.env.PANAEC_3DM_TO_IFC_ARGS;
    previousRhinoCommand = process.env.RHINO_3DM_TO_IFC_COMMAND;
    previousRhinoCommandArgs = process.env.RHINO_3DM_TO_IFC_ARGS;
    previousThreeDmCommand = process.env.THREEDM_TO_IFC_COMMAND;
    previousThreeDmCommandArgs = process.env.THREEDM_TO_IFC_ARGS;
    previousRhinoToIfcCommand = process.env.RHINO_TO_IFC_COMMAND;
    previousRhinoToIfcCommandArgs = process.env.RHINO_TO_IFC_ARGS;
    previousThreeDm2IfcBin = process.env.THREEDM2IFC_BIN;
    previousThreeDmToIfcBin = process.env.THREEDM_TO_IFC_BIN;
    previousRhinoToIfcBin = process.env.RHINO_TO_IFC_BIN;
    previousRhinoComputeExportIfcBin = process.env.RHINO_COMPUTE_EXPORT_IFC_BIN;
    previousDisableRepoWorker =
      process.env.ARCHITOKEN_DISABLE_REPO_3DM_IFC_WORKER;
    previousFetch = globalThis.fetch;

    uploadDir = await mkdtemp(join(tmpdir(), "architoken-3dm-derivatives-"));
    const emptyPath = join(uploadDir, "empty-path");
    await mkdir(emptyPath);
    process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = uploadDir;
    process.env.PATH = emptyPath;
    delete process.env.RHINO_ADAPTER_URL;
    delete process.env.SPECKLE_RHINO_ADAPTER_URL;
    delete process.env.LICENSED_BIM_ADAPTER_URL;
    delete process.env.RHINO_ADAPTER_PATH;
    delete process.env.PANAEC_3DM_TO_IFC_COMMAND;
    delete process.env.PANAEC_3DM_TO_IFC_ARGS;
    delete process.env.RHINO_3DM_TO_IFC_COMMAND;
    delete process.env.RHINO_3DM_TO_IFC_ARGS;
    delete process.env.THREEDM_TO_IFC_COMMAND;
    delete process.env.THREEDM_TO_IFC_ARGS;
    delete process.env.RHINO_TO_IFC_COMMAND;
    delete process.env.RHINO_TO_IFC_ARGS;
    delete process.env.THREEDM2IFC_BIN;
    delete process.env.THREEDM_TO_IFC_BIN;
    delete process.env.RHINO_TO_IFC_BIN;
    delete process.env.RHINO_COMPUTE_EXPORT_IFC_BIN;
    process.env.ARCHITOKEN_DISABLE_REPO_3DM_IFC_WORKER = "1";
  });

  afterEach(async () => {
    restoreEnv("ARCHITOKEN_LOCAL_UPLOADS_DIR", previousUploadDir);
    restoreEnv("PATH", previousPath);
    restoreEnv("RHINO_ADAPTER_URL", previousRhinoAdapterUrl);
    restoreEnv("SPECKLE_RHINO_ADAPTER_URL", previousSpeckleRhinoAdapterUrl);
    restoreEnv("LICENSED_BIM_ADAPTER_URL", previousLicensedAdapterUrl);
    restoreEnv("RHINO_ADAPTER_PATH", previousRhinoAdapterPath);
    restoreEnv("PANAEC_3DM_TO_IFC_COMMAND", previousCommand);
    restoreEnv("PANAEC_3DM_TO_IFC_ARGS", previousCommandArgs);
    restoreEnv("RHINO_3DM_TO_IFC_COMMAND", previousRhinoCommand);
    restoreEnv("RHINO_3DM_TO_IFC_ARGS", previousRhinoCommandArgs);
    restoreEnv("THREEDM_TO_IFC_COMMAND", previousThreeDmCommand);
    restoreEnv("THREEDM_TO_IFC_ARGS", previousThreeDmCommandArgs);
    restoreEnv("RHINO_TO_IFC_COMMAND", previousRhinoToIfcCommand);
    restoreEnv("RHINO_TO_IFC_ARGS", previousRhinoToIfcCommandArgs);
    restoreEnv("THREEDM2IFC_BIN", previousThreeDm2IfcBin);
    restoreEnv("THREEDM_TO_IFC_BIN", previousThreeDmToIfcBin);
    restoreEnv("RHINO_TO_IFC_BIN", previousRhinoToIfcBin);
    restoreEnv(
      "RHINO_COMPUTE_EXPORT_IFC_BIN",
      previousRhinoComputeExportIfcBin,
    );
    restoreEnv(
      "ARCHITOKEN_DISABLE_REPO_3DM_IFC_WORKER",
      previousDisableRepoWorker,
    );
    globalThis.fetch = previousFetch;
    await rm(uploadDir, { recursive: true, force: true });
  });

  it("fails closed until a real 3DM to IFC adapter is configured", async () => {
    const saved = await saveLocalUpload({
      file: new File(["Rhino 3DM placeholder"], "model.3dm", {
        type: "model/vnd.3dm",
      }),
      moduleId: "construction_management",
    });

    const manifest = await buildThreeDmDerivativeManifest(saved.fileId);
    expect(manifest.schema).toBe("architoken.3dm_derivative_manifest.v1");
    expect(manifest.viewer).toBe("licensed_adapter_required");
    expect(manifest.permissions.canView).toBe(false);
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "panaec-3dm-ifc-command-adapter",
      )?.status,
    ).toBe("missing");
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "speckle-ifc-exporter-rhino",
      )?.sourceUrl,
    ).toBe("https://github.com/specklesystems/IFC-Exporter-Rhino");
    expect(manifest.notes[0]).toContain("不会用浏览器 mesh");

    await expect(
      readThreeDmDerivativeBytes(saved.fileId, "ifc"),
    ).rejects.toMatchObject({
      status: expect.any(Number),
    });
  });

  it("uses a configured PanAEC Engine 3DM to IFC command adapter", async () => {
    const commandScript = join(uploadDir, "3dm-ifc-command-adapter.mjs");
    await writeFile(
      commandScript,
      [
        "import { writeFile } from 'node:fs/promises';",
        "const output = process.argv[process.argv.indexOf('--output') + 1];",
        `await writeFile(output, ${JSON.stringify(minimalIfcText())});`,
      ].join("\n"),
    );
    process.env.PANAEC_3DM_TO_IFC_COMMAND = process.execPath;
    process.env.PANAEC_3DM_TO_IFC_ARGS = JSON.stringify([
      commandScript,
      "--input",
      "{source}",
      "--output",
      "{output}",
    ]);

    const saved = await saveLocalUpload({
      file: new File(["Rhino source bytes"], "rhino-model.3dm", {
        type: "model/vnd.3dm",
      }),
      moduleId: "construction_management",
    });

    const manifest = await buildThreeDmDerivativeManifest(saved.fileId);
    expect(manifest.viewer).toBe("panaec_3dm_ifc_model");
    expect(manifest.permissions.canView).toBe(true);
    expect(manifest.ifcArtifact?.mediaType).toBe("application/p21");
    expect(manifest.cacheKey).toContain("v4-openbim-presentation-ifc");
    expect(manifest.appearancePolicy.syntheticMaterialColors).toBe(false);
    expect(manifest.ifcArtifact?.cacheKey).toContain(
      "v4-openbim-presentation-ifc",
    );
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "panaec-3dm-ifc-command-adapter",
      )?.status,
    ).toBe("available");

    const bytes = await readThreeDmDerivativeBytes(saved.fileId, "ifc");
    expect(bytes.engine).toBe("PanAEC Engine");
    expect(bytes.mediaType).toBe("application/p21");
    expect(bytes.bytes.toString("utf8")).toContain("FILE_SCHEMA");
  });

  it("discovers the repository rhino3dm/OpenNURBS worker without env command wiring", async () => {
    delete process.env.ARCHITOKEN_DISABLE_REPO_3DM_IFC_WORKER;

    const saved = await saveLocalUpload({
      file: new File(["not a valid 3dm"], "repo-worker.3dm", {
        type: "model/vnd.3dm",
      }),
      moduleId: "construction_management",
    });

    const manifest = await buildThreeDmDerivativeManifest(saved.fileId);
    const commandAdapter = manifest.adapters.find(
      (adapter) => adapter.id === "panaec-3dm-ifc-command-adapter",
    );
    expect(commandAdapter?.status).toBe("available");
    expect(commandAdapter?.licenseBoundary).toBe("open_source_process");
    expect(commandAdapter?.command).toContain("panaec-3dm-to-ifc");
    expect(manifest.viewer).toBe("licensed_adapter_required");
    expect(manifest.notes.join(" ")).toContain("3DM 转 IFC 尝试失败");
  });

  it("accepts IFC artifacts from a configured Rhino HTTP adapter", async () => {
    process.env.RHINO_ADAPTER_URL = "http://rhino-sidecar.test";
    const ifcBase64 = Buffer.from(minimalIfcText(), "utf8").toString("base64");
    const fetchCalls: Array<[string, RequestInit]> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      fetchCalls.push([String(input), init ?? {}]);
      return new Response(
        JSON.stringify({
          artifacts: [
            {
              name: "rhino.ifc",
              role: "openbim_ifc",
              mediaType: "application/p21",
              contentBase64: ifcBase64,
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    };
    globalThis.fetch = fetchMock;

    const saved = await saveLocalUpload({
      file: new File(["Rhino source bytes"], "http-sidecar.3dm", {
        type: "model/vnd.3dm",
      }),
      moduleId: "construction_management",
    });

    const manifest = await buildThreeDmDerivativeManifest(saved.fileId);
    expect(manifest.viewer).toBe("panaec_3dm_ifc_model");
    expect(manifest.ifcArtifact?.mediaType).toBe("application/p21");
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "panaec-rhino-adapter",
      )?.status,
    ).toBe("available");
    expect(fetchCalls).toHaveLength(1);
    const firstFetchCall = fetchCalls[0];
    expect(firstFetchCall).toBeDefined();
    const [, requestInit] = firstFetchCall as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body));
    expect(body.sourceFormat).toBe("3dm");
    expect(body.targetFormat).toBe("ifc");
    expect(body.targetSchema).toBe("IFC4");
    expect(body.outputFormats).toEqual(["ifc", "properties-index"]);
    expect(body.appearancePolicy.syntheticMaterialColors).toBe(false);

    const bytes = await readThreeDmDerivativeBytes(saved.fileId, "ifc");
    expect(bytes.bytes.toString("utf8")).toContain("FILE_SCHEMA");
  });

  it("reuses canonical 3DM IFC derivatives from the shared derivatives cache", async () => {
    const saved = await saveLocalUpload({
      file: new File(["Rhino source bytes"], "cached.3dm", {
        type: "model/vnd.3dm",
      }),
      moduleId: "construction_management",
    });
    const cacheDir = join(
      uploadDir,
      "derivatives",
      "3dm",
      "v4-openbim-presentation-ifc",
      saved.checksum.slice(0, 16),
    );
    await mkdir(cacheDir, { recursive: true });
    await writeFile(join(cacheDir, "viewer.ifc"), minimalIfcText());

    const manifest = await buildThreeDmDerivativeManifest(saved.fileId);
    expect(manifest.viewer).toBe("panaec_3dm_ifc_model");
    expect(manifest.permissions.canView).toBe(true);
    expect(manifest.ifcArtifact?.cacheHit).toBe(true);

    const bytes = await readThreeDmDerivativeBytes(saved.fileId, "ifc");
    expect(bytes.bytes.toString("utf8")).toContain("FILE_SCHEMA");
  });

  it("does not reuse older 3DM IFC cache after the openBIM presentation policy changes", async () => {
    const saved = await saveLocalUpload({
      file: new File(["Rhino source bytes"], "old-cache.3dm", {
        type: "model/vnd.3dm",
      }),
      moduleId: "construction_management",
    });
    const cacheDir = join(
      uploadDir,
      "derivatives",
      "3dm",
      "v3-readable-material-ifc",
      saved.checksum.slice(0, 16),
    );
    await mkdir(cacheDir, { recursive: true });
    await writeFile(join(cacheDir, "viewer.ifc"), minimalIfcText());

    const manifest = await buildThreeDmDerivativeManifest(saved.fileId);
    expect(manifest.viewer).toBe("licensed_adapter_required");
    expect(manifest.permissions.canView).toBe(false);
    expect(manifest.cacheKey).toContain("v4-openbim-presentation-ifc");
    expect(manifest.ifcArtifact).toBeUndefined();
  });
});

function restoreEnv(name: string, previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = previous;
}

function minimalIfcText(): string {
  return [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');",
    "FILE_NAME('model.ifc','2026-06-08T00:00:00',('architoken'),('architoken'),'3dm-to-ifc-test','ArchIToken','');",
    "FILE_SCHEMA(('IFC4'));",
    "ENDSEC;",
    "DATA;",
    "#1=IFCPROJECT('0V5wYb1W9D_x3dmIfc00001',$,'3DM IFC Project',$,$,$,$,$,$);",
    "ENDSEC;",
    "END-ISO-10303-21;",
  ].join("\n");
}
