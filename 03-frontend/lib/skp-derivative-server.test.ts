// lib/skp-derivative-server.test.ts - SKP derivative adapter contract
// License: Apache-2.0

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildSkpDerivativeManifest,
  readSkpDerivativeBytes,
} from "./skp-derivative-server";
import { saveLocalUpload } from "./local-file-runtime-server";

const minimalGlbBase64 = Buffer.from(minimalGlbBytes()).toString("base64");

describe("SKP derivative server", () => {
  let uploadDir: string;
  let previousUploadDir: string | undefined;
  let previousSketchupAdapterUrl: string | undefined;
  let previousArchitokenSkpAdapterUrl: string | undefined;
  let previousSketchupAdapterPath: string | undefined;
  let previousLicensedAdapterUrl: string | undefined;
  let previousCommand: string | undefined;
  let previousCommandArgs: string | undefined;
  let previousSkp2GlbBin: string | undefined;
  let previousSkpToGlbBin: string | undefined;
  let previousSketchupToGltfBin: string | undefined;
  let previousSkpToIfcCommand: string | undefined;
  let previousSkpToIfcArgs: string | undefined;
  let previousSkp2IfcBin: string | undefined;
  let previousSkpToIfcBin: string | undefined;
  let previousSketchupToIfcBin: string | undefined;
  let previousFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    previousUploadDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    previousSketchupAdapterUrl = process.env.SKETCHUP_ADAPTER_URL;
    previousArchitokenSkpAdapterUrl = process.env.ARCHITOKEN_SKP_ADAPTER_URL;
    previousSketchupAdapterPath = process.env.SKETCHUP_ADAPTER_PATH;
    previousLicensedAdapterUrl = process.env.LICENSED_BIM_ADAPTER_URL;
    previousCommand = process.env.PANAEC_SKP_CONVERTER_COMMAND;
    previousCommandArgs = process.env.PANAEC_SKP_CONVERTER_ARGS;
    previousSkp2GlbBin = process.env.SKP2GLB_BIN;
    previousSkpToGlbBin = process.env.SKP_TO_GLB_BIN;
    previousSketchupToGltfBin = process.env.SKETCHUP_TO_GLTF_BIN;
    previousSkpToIfcCommand = process.env.PANAEC_SKP_TO_IFC_COMMAND;
    previousSkpToIfcArgs = process.env.PANAEC_SKP_TO_IFC_ARGS;
    previousSkp2IfcBin = process.env.SKP2IFC_BIN;
    previousSkpToIfcBin = process.env.SKP_TO_IFC_BIN;
    previousSketchupToIfcBin = process.env.SKETCHUP_TO_IFC_BIN;
    previousFetch = globalThis.fetch;
    uploadDir = await mkdtemp(join(tmpdir(), "architoken-skp-derivatives-"));
    process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = uploadDir;
    delete process.env.SKETCHUP_ADAPTER_URL;
    delete process.env.ARCHITOKEN_SKP_ADAPTER_URL;
    delete process.env.SKETCHUP_ADAPTER_PATH;
    delete process.env.LICENSED_BIM_ADAPTER_URL;
    delete process.env.PANAEC_SKP_CONVERTER_COMMAND;
    delete process.env.PANAEC_SKP_CONVERTER_ARGS;
    delete process.env.SKP2GLB_BIN;
    delete process.env.SKP_TO_GLB_BIN;
    delete process.env.SKETCHUP_TO_GLTF_BIN;
    delete process.env.PANAEC_SKP_TO_IFC_COMMAND;
    delete process.env.PANAEC_SKP_TO_IFC_ARGS;
    delete process.env.SKP2IFC_BIN;
    delete process.env.SKP_TO_IFC_BIN;
    delete process.env.SKETCHUP_TO_IFC_BIN;
  });

  afterEach(async () => {
    if (previousUploadDir === undefined) {
      delete process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    } else {
      process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = previousUploadDir;
    }
    if (previousSketchupAdapterUrl === undefined) {
      delete process.env.SKETCHUP_ADAPTER_URL;
    } else {
      process.env.SKETCHUP_ADAPTER_URL = previousSketchupAdapterUrl;
    }
    if (previousArchitokenSkpAdapterUrl === undefined) {
      delete process.env.ARCHITOKEN_SKP_ADAPTER_URL;
    } else {
      process.env.ARCHITOKEN_SKP_ADAPTER_URL =
        previousArchitokenSkpAdapterUrl;
    }
    if (previousSketchupAdapterPath === undefined) {
      delete process.env.SKETCHUP_ADAPTER_PATH;
    } else {
      process.env.SKETCHUP_ADAPTER_PATH = previousSketchupAdapterPath;
    }
    if (previousLicensedAdapterUrl === undefined) {
      delete process.env.LICENSED_BIM_ADAPTER_URL;
    } else {
      process.env.LICENSED_BIM_ADAPTER_URL = previousLicensedAdapterUrl;
    }
    if (previousCommand === undefined) {
      delete process.env.PANAEC_SKP_CONVERTER_COMMAND;
    } else {
      process.env.PANAEC_SKP_CONVERTER_COMMAND = previousCommand;
    }
    if (previousCommandArgs === undefined) {
      delete process.env.PANAEC_SKP_CONVERTER_ARGS;
    } else {
      process.env.PANAEC_SKP_CONVERTER_ARGS = previousCommandArgs;
    }
    if (previousSkp2GlbBin === undefined) {
      delete process.env.SKP2GLB_BIN;
    } else {
      process.env.SKP2GLB_BIN = previousSkp2GlbBin;
    }
    if (previousSkpToGlbBin === undefined) {
      delete process.env.SKP_TO_GLB_BIN;
    } else {
      process.env.SKP_TO_GLB_BIN = previousSkpToGlbBin;
    }
    if (previousSketchupToGltfBin === undefined) {
      delete process.env.SKETCHUP_TO_GLTF_BIN;
    } else {
      process.env.SKETCHUP_TO_GLTF_BIN = previousSketchupToGltfBin;
    }
    if (previousSkpToIfcCommand === undefined) {
      delete process.env.PANAEC_SKP_TO_IFC_COMMAND;
    } else {
      process.env.PANAEC_SKP_TO_IFC_COMMAND = previousSkpToIfcCommand;
    }
    if (previousSkpToIfcArgs === undefined) {
      delete process.env.PANAEC_SKP_TO_IFC_ARGS;
    } else {
      process.env.PANAEC_SKP_TO_IFC_ARGS = previousSkpToIfcArgs;
    }
    if (previousSkp2IfcBin === undefined) {
      delete process.env.SKP2IFC_BIN;
    } else {
      process.env.SKP2IFC_BIN = previousSkp2IfcBin;
    }
    if (previousSkpToIfcBin === undefined) {
      delete process.env.SKP_TO_IFC_BIN;
    } else {
      process.env.SKP_TO_IFC_BIN = previousSkpToIfcBin;
    }
    if (previousSketchupToIfcBin === undefined) {
      delete process.env.SKETCHUP_TO_IFC_BIN;
    } else {
      process.env.SKETCHUP_TO_IFC_BIN = previousSketchupToIfcBin;
    }
    globalThis.fetch = previousFetch;
    await rm(uploadDir, { recursive: true, force: true });
  });

  it("fails closed until a licensed PanAEC Engine SKP adapter is configured", async () => {
    const saved = await saveLocalUpload({
      file: new File(["SketchUp placeholder"], "model.skp", {
        type: "model/vnd.sketchup.skp",
      }),
      moduleId: "construction_management",
    });

    const manifest = await buildSkpDerivativeManifest(saved.fileId);
    expect(manifest.schema).toBe("architoken.skp_derivative_manifest.v1");
    expect(manifest.viewer).toBe("licensed_adapter_required");
    expect(manifest.permissions.canView).toBe(false);
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "panaec-sketchup-adapter",
      )?.status,
    ).toBe("missing");
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "panaec-skp-command-adapter",
      )?.status,
    ).toBe("missing");
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "panaec-skp-ifc-command-adapter",
      )?.status,
    ).toBe("missing");
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "sketchup-ifc-manager-sidecar",
      )?.licenseBoundary,
    ).toBe("isolated_copyleft_sidecar");
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "yulio-sketchup-gltf-exporter-sidecar",
      )?.sourceUrl,
    ).toBe("https://github.com/YulioTech/SketchUp-glTF-Exporter-Ruby");
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "panaec-sketchup-adapter",
      )?.sourceUrl,
    ).toBe("https://github.com/specklesystems/speckle-sketchup");
    expect(manifest.notes[0]).toContain("不会用字节预览");

    await expect(
      readSkpDerivativeBytes(saved.fileId, "glb"),
    ).rejects.toMatchObject({
      status: expect.any(Number),
    });
  });

  it("does not mark built-in SKP HTTP bridge commands ready without a sidecar URL", async () => {
    process.env.PANAEC_SKP_TO_IFC_COMMAND = join(
      process.cwd(),
      "..",
      "06-workers",
      "scripts",
      "panaec-skp-to-ifc",
    );
    process.env.PANAEC_SKP_CONVERTER_COMMAND = join(
      process.cwd(),
      "..",
      "06-workers",
      "scripts",
      "panaec-skp-to-glb",
    );

    const saved = await saveLocalUpload({
      file: new File(["SketchUp source bytes"], "bridge.skp", {
        type: "model/vnd.sketchup.skp",
      }),
      moduleId: "construction_management",
    });

    const manifest = await buildSkpDerivativeManifest(saved.fileId);
    expect(manifest.viewer).toBe("licensed_adapter_required");
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "panaec-skp-ifc-command-adapter",
      )?.status,
    ).toBe("missing");
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "panaec-skp-command-adapter",
      )?.status,
    ).toBe("missing");
  });

  it("uses a configured PanAEC Engine SKP command adapter to persist a real derivative", async () => {
    const commandScript = join(uploadDir, "skp-command-adapter.mjs");
    await writeFile(
      commandScript,
      [
        "import { writeFile } from 'node:fs/promises';",
        "const output = process.argv[process.argv.indexOf('--output') + 1];",
        `await writeFile(output, Buffer.from('${minimalGlbBase64}', 'base64'));`,
      ].join("\n"),
    );
    process.env.PANAEC_SKP_CONVERTER_COMMAND = process.execPath;
    process.env.PANAEC_SKP_CONVERTER_ARGS = JSON.stringify([
      commandScript,
      "--input",
      "{source}",
      "--output",
      "{output}",
    ]);

    const saved = await saveLocalUpload({
      file: new File(["SketchUp source bytes"], "hotel.skp", {
        type: "model/vnd.sketchup.skp",
      }),
      moduleId: "construction_management",
    });

    const manifest = await buildSkpDerivativeManifest(saved.fileId);
    expect(manifest.viewer).toBe("panaec_skp_model");
    expect(manifest.permissions.canView).toBe(true);
    expect(manifest.derivativeArtifact?.engine).toBe("PanAEC Engine");
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "panaec-skp-command-adapter",
      )?.status,
    ).toBe("available");

    const bytes = await readSkpDerivativeBytes(saved.fileId, "glb");
    expect(bytes.engine).toBe("PanAEC Engine");
    expect(bytes.mediaType).toBe("model/gltf-binary");
    expect(bytes.bytes.subarray(0, 4).toString("ascii")).toBe("glTF");
  });

  it("uses a configured PanAEC Engine SKP to IFC command adapter when GLB is unavailable", async () => {
    const commandScript = join(uploadDir, "skp-ifc-command-adapter.mjs");
    await writeFile(
      commandScript,
      [
        "import { writeFile } from 'node:fs/promises';",
        "const output = process.argv[process.argv.indexOf('--output') + 1];",
        `await writeFile(output, ${JSON.stringify(minimalIfcText())});`,
      ].join("\n"),
    );
    process.env.PANAEC_SKP_TO_IFC_COMMAND = process.execPath;
    process.env.PANAEC_SKP_TO_IFC_ARGS = JSON.stringify([
      commandScript,
      "--input",
      "{source}",
      "--output",
      "{output}",
    ]);

    const saved = await saveLocalUpload({
      file: new File(["SketchUp source bytes"], "ifc-only.skp", {
        type: "model/vnd.sketchup.skp",
      }),
      moduleId: "construction_management",
    });

    const manifest = await buildSkpDerivativeManifest(saved.fileId);
    expect(manifest.viewer).toBe("panaec_skp_ifc_model");
    expect(manifest.permissions.canView).toBe(true);
    expect(manifest.ifcArtifact?.mediaType).toBe("application/p21");
    expect(manifest.derivativeArtifact).toBeUndefined();
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "panaec-skp-ifc-command-adapter",
      )?.status,
    ).toBe("available");

    const bytes = await readSkpDerivativeBytes(saved.fileId, "ifc");
    expect(bytes.engine).toBe("PanAEC Engine");
    expect(bytes.mediaType).toBe("application/p21");
    expect(bytes.bytes.toString("utf8")).toContain("FILE_SCHEMA");
  });

  it("accepts IFC artifacts from a configured SketchUp sidecar HTTP adapter", async () => {
    process.env.SKETCHUP_ADAPTER_URL = "http://sketchup-sidecar.test";
    const ifcBase64 = Buffer.from(minimalIfcText(), "utf8").toString("base64");
    const fetchCalls: Array<[string, RequestInit]> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      fetchCalls.push([String(input), init ?? {}]);
      return new Response(
        JSON.stringify({
          artifacts: [
            {
              name: "sidecar.ifc",
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
      file: new File(["SketchUp source bytes"], "http-sidecar.skp", {
        type: "model/vnd.sketchup.skp",
      }),
      moduleId: "construction_management",
    });

    const manifest = await buildSkpDerivativeManifest(saved.fileId);
    expect(manifest.viewer).toBe("panaec_skp_ifc_model");
    expect(manifest.ifcArtifact?.mediaType).toBe("application/p21");
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "sketchup-ruby-model-export-ifc",
      )?.status,
    ).toBe("available");
    // 新决策顺序先尝试现场 GLB 转换（第 1 次调用，产物非 GLB 而失败），
    // 再回到现场 IFC 转换（第 2 次调用）。
    expect(fetchCalls).toHaveLength(2);
    const ifcFetchCall = fetchCalls[1];
    expect(ifcFetchCall).toBeDefined();
    const [, requestInit] = ifcFetchCall as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body));
    expect(body.outputFormats).toEqual(["ifc", "properties-index"]);

    const bytes = await readSkpDerivativeBytes(saved.fileId, "ifc");
    expect(bytes.bytes.toString("utf8")).toContain("FILE_SCHEMA");
  });

  it("prefers real SKP to IFC output over same-module GLB fallback", async () => {
    const commandScript = join(uploadDir, "skp-ifc-priority-adapter.mjs");
    await writeFile(
      commandScript,
      [
        "import { writeFile } from 'node:fs/promises';",
        "const output = process.argv[process.argv.indexOf('--output') + 1];",
        `await writeFile(output, ${JSON.stringify(minimalIfcText())});`,
      ].join("\n"),
    );
    process.env.PANAEC_SKP_TO_IFC_COMMAND = process.execPath;
    process.env.PANAEC_SKP_TO_IFC_ARGS = JSON.stringify([
      commandScript,
      "--input",
      "{source}",
      "--output",
      "{output}",
    ]);

    const savedSkp = await saveLocalUpload({
      file: new File(["SketchUp source bytes"], "priority.skp", {
        type: "model/vnd.sketchup.skp",
      }),
      moduleId: "construction_management",
    });
    await saveLocalUpload({
      file: new File([minimalGlbBlobPart()], "priority.glb", {
        type: "model/gltf-binary",
      }),
      moduleId: "construction_management",
    });

    const manifest = await buildSkpDerivativeManifest(savedSkp.fileId);
    expect(manifest.viewer).toBe("panaec_skp_ifc_model");
    expect(manifest.ifcArtifact?.mediaType).toBe("application/p21");
    expect(manifest.derivativeArtifact).toBeUndefined();
  });

  it("uses same-module GLB as the last fallback when SKP conversion is unavailable", async () => {
    const savedSkp = await saveLocalUpload({
      file: new File(["SketchUp source bytes"], "hotel.skp", {
        type: "model/vnd.sketchup.skp",
      }),
      moduleId: "construction_management",
    });
    await saveLocalUpload({
      file: new File([minimalGlbBlobPart()], "hotel.glb", {
        type: "model/gltf-binary",
      }),
      moduleId: "construction_management",
    });

    const manifest = await buildSkpDerivativeManifest(savedSkp.fileId);
    expect(manifest.viewer).toBe("panaec_skp_model");
    expect(manifest.permissions.canView).toBe(true);
    expect(manifest.permissions.requiresLicensedAdapter).toBe(false);
    expect(manifest.notes[0]).toContain("GLB");

    const bytes = await readSkpDerivativeBytes(savedSkp.fileId, "glb");
    expect(bytes.mediaType).toBe("model/gltf-binary");
    expect(bytes.bytes.subarray(0, 4).toString("ascii")).toBe("glTF");
  });

  it("refuses to bind a same-folder GLB whose name does not match the SKP", async () => {
    // 旧的"同目录唯一 GLB"松散绑定曾把无关模型几何当作本 SKP 的派生展示，
    // 已被移除：名字不匹配且无显式标签时必须如实报告无可用派生。
    const savedSkp = await saveLocalUpload({
      file: new File(["SketchUp source bytes"], "source-035.skp", {
        type: "model/vnd.sketchup.skp",
      }),
      moduleId: "construction_management",
      parentId: "manual-fallback-folder",
    });
    await saveLocalUpload({
      file: new File([minimalGlbBlobPart()], "uploaded-003.glb", {
        type: "model/gltf-binary",
      }),
      moduleId: "construction_management",
      parentId: "manual-fallback-folder",
    });

    const manifest = await buildSkpDerivativeManifest(savedSkp.fileId);
    expect(manifest.viewer).toBe("licensed_adapter_required");
    expect(manifest.permissions.canView).toBe(false);
    expect(manifest.derivativeArtifact).toBeUndefined();

    await expect(readSkpDerivativeBytes(savedSkp.fileId, "glb")).rejects.toThrow();
  });

  it("reuses canonical SKP GLB derivatives from the shared derivatives cache", async () => {
    const saved = await saveLocalUpload({
      file: new File(["SketchUp source bytes"], "hotel.skp", {
        type: "model/vnd.sketchup.skp",
      }),
      moduleId: "construction_management",
    });
    const cacheDir = join(
      uploadDir,
      "derivatives",
      "skp",
      "v1-real-glb",
      saved.checksum.slice(0, 16),
    );
    await mkdir(cacheDir, { recursive: true });
    await writeFile(join(cacheDir, "viewer.glb"), minimalGlbBytes());

    const manifest = await buildSkpDerivativeManifest(saved.fileId);
    expect(manifest.viewer).toBe("panaec_skp_model");
    expect(manifest.permissions.canView).toBe(true);
    expect(manifest.derivativeArtifact?.cacheHit).toBe(true);

    const bytes = await readSkpDerivativeBytes(saved.fileId, "glb");
    expect(bytes.bytes.subarray(0, 4).toString("ascii")).toBe("glTF");
  });

  it("reuses legacy worker GLB derivatives from file-id checksum directories", async () => {
    const saved = await saveLocalUpload({
      file: new File(["SketchUp source bytes"], "school.skp", {
        type: "model/vnd.sketchup.skp",
      }),
      moduleId: "construction_management",
    });
    const legacyWorkerDir = join(
      uploadDir,
      "derivatives",
      saved.fileId,
      saved.checksum.slice(0, 16),
      "glb",
    );
    await mkdir(legacyWorkerDir, { recursive: true });
    await writeFile(join(legacyWorkerDir, "school.glb"), minimalGlbBytes());

    const manifest = await buildSkpDerivativeManifest(saved.fileId);
    expect(manifest.viewer).toBe("panaec_skp_model");
    expect(manifest.permissions.canView).toBe(true);
    expect(manifest.derivativeArtifact?.cacheHit).toBe(true);

    const bytes = await readSkpDerivativeBytes(saved.fileId, "glb");
    expect(bytes.mediaType).toBe("model/gltf-binary");
    expect(bytes.bytes.subarray(0, 4).toString("ascii")).toBe("glTF");
  });

  it("reuses checksum-matched GLB derivatives from another upload file id", async () => {
    const source = "SketchUp duplicated source bytes";
    const first = await saveLocalUpload({
      file: new File([source], "first-school.skp", {
        type: "model/vnd.sketchup.skp",
      }),
      moduleId: "construction_management",
    });
    const second = await saveLocalUpload({
      file: new File([source], "second-school.skp", {
        type: "model/vnd.sketchup.skp",
      }),
      moduleId: "construction_management",
    });
    const legacyWorkerDir = join(
      uploadDir,
      "derivatives",
      first.fileId,
      first.checksum.slice(0, 16),
      "glb",
    );
    await mkdir(legacyWorkerDir, { recursive: true });
    await writeFile(join(legacyWorkerDir, "school.glb"), minimalGlbBytes());

    const manifest = await buildSkpDerivativeManifest(second.fileId);
    expect(manifest.viewer).toBe("panaec_skp_model");
    expect(manifest.permissions.canView).toBe(true);
    expect(manifest.derivativeArtifact?.cacheHit).toBe(true);

    const bytes = await readSkpDerivativeBytes(second.fileId, "glb");
    expect(bytes.mediaType).toBe("model/gltf-binary");
    expect(bytes.bytes.subarray(0, 4).toString("ascii")).toBe("glTF");
  });
});

function minimalGlbBytes(): Uint8Array {
  const json = Buffer.from('{"asset":{"version":"2.0"}}  ', "utf8");
  const bytes = Buffer.alloc(12 + 8 + json.byteLength);
  bytes.write("glTF", 0, "ascii");
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.byteLength, 8);
  bytes.writeUInt32LE(json.byteLength, 12);
  bytes.write("JSON", 16, "ascii");
  json.copy(bytes, 20);
  return bytes;
}

function minimalGlbBlobPart(): ArrayBuffer {
  const bytes = minimalGlbBytes();
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function minimalIfcText(): string {
  return [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');",
    "FILE_NAME('model.ifc','2026-05-23T00:00:00',('architoken'),('architoken'),'skp-to-ifc-test','ArchIToken','');",
    "FILE_SCHEMA(('IFC4'));",
    "ENDSEC;",
    "DATA;",
    "#1=IFCPROJECT('0V5wYb1W9D_xSkpIfc00001',$,'SKP IFC Project',$,$,$,$,$,$);",
    "ENDSEC;",
    "END-ISO-10303-21;",
  ].join("\n");
}
