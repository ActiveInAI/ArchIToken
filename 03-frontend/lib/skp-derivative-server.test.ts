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

  beforeEach(async () => {
    previousUploadDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    previousSketchupAdapterUrl = process.env.SKETCHUP_ADAPTER_URL;
    previousLicensedAdapterUrl = process.env.LICENSED_BIM_ADAPTER_URL;
    previousCommand = process.env.PRENGINE_SKP_CONVERTER_COMMAND;
    previousCommandArgs = process.env.PRENGINE_SKP_CONVERTER_ARGS;
    previousSkp2GlbBin = process.env.SKP2GLB_BIN;
    previousSkpToGlbBin = process.env.SKP_TO_GLB_BIN;
    previousSketchupToGltfBin = process.env.SKETCHUP_TO_GLTF_BIN;
    previousSkpToIfcCommand = process.env.PRENGINE_SKP_TO_IFC_COMMAND;
    previousSkpToIfcArgs = process.env.PRENGINE_SKP_TO_IFC_ARGS;
    previousSkp2IfcBin = process.env.SKP2IFC_BIN;
    previousSkpToIfcBin = process.env.SKP_TO_IFC_BIN;
    previousSketchupToIfcBin = process.env.SKETCHUP_TO_IFC_BIN;
    uploadDir = await mkdtemp(join(tmpdir(), "architoken-skp-derivatives-"));
    process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = uploadDir;
    delete process.env.SKETCHUP_ADAPTER_URL;
    delete process.env.LICENSED_BIM_ADAPTER_URL;
    delete process.env.PRENGINE_SKP_CONVERTER_COMMAND;
    delete process.env.PRENGINE_SKP_CONVERTER_ARGS;
    delete process.env.SKP2GLB_BIN;
    delete process.env.SKP_TO_GLB_BIN;
    delete process.env.SKETCHUP_TO_GLTF_BIN;
    delete process.env.PRENGINE_SKP_TO_IFC_COMMAND;
    delete process.env.PRENGINE_SKP_TO_IFC_ARGS;
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
    if (previousLicensedAdapterUrl === undefined) {
      delete process.env.LICENSED_BIM_ADAPTER_URL;
    } else {
      process.env.LICENSED_BIM_ADAPTER_URL = previousLicensedAdapterUrl;
    }
    if (previousCommand === undefined) {
      delete process.env.PRENGINE_SKP_CONVERTER_COMMAND;
    } else {
      process.env.PRENGINE_SKP_CONVERTER_COMMAND = previousCommand;
    }
    if (previousCommandArgs === undefined) {
      delete process.env.PRENGINE_SKP_CONVERTER_ARGS;
    } else {
      process.env.PRENGINE_SKP_CONVERTER_ARGS = previousCommandArgs;
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
      delete process.env.PRENGINE_SKP_TO_IFC_COMMAND;
    } else {
      process.env.PRENGINE_SKP_TO_IFC_COMMAND = previousSkpToIfcCommand;
    }
    if (previousSkpToIfcArgs === undefined) {
      delete process.env.PRENGINE_SKP_TO_IFC_ARGS;
    } else {
      process.env.PRENGINE_SKP_TO_IFC_ARGS = previousSkpToIfcArgs;
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
    await rm(uploadDir, { recursive: true, force: true });
  });

  it("fails closed until a licensed Prengine SKP adapter is configured", async () => {
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
        (adapter) => adapter.id === "prengine-sketchup-adapter",
      )?.status,
    ).toBe("missing");
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "prengine-skp-command-adapter",
      )?.status,
    ).toBe("missing");
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "prengine-skp-ifc-command-adapter",
      )?.status,
    ).toBe("missing");
    expect(manifest.notes[0]).toContain("不会用字节预览");

    await expect(
      readSkpDerivativeBytes(saved.fileId, "glb"),
    ).rejects.toMatchObject({
      status: expect.any(Number),
    });
  });

  it("uses a configured Prengine SKP command adapter to persist a real derivative", async () => {
    const commandScript = join(uploadDir, "skp-command-adapter.mjs");
    await writeFile(
      commandScript,
      [
        "import { writeFile } from 'node:fs/promises';",
        "const output = process.argv[process.argv.indexOf('--output') + 1];",
        `await writeFile(output, Buffer.from('${minimalGlbBase64}', 'base64'));`,
      ].join("\n"),
    );
    process.env.PRENGINE_SKP_CONVERTER_COMMAND = process.execPath;
    process.env.PRENGINE_SKP_CONVERTER_ARGS = JSON.stringify([
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
    expect(manifest.viewer).toBe("prengine_skp_model");
    expect(manifest.permissions.canView).toBe(true);
    expect(manifest.derivativeArtifact?.engine).toBe("Prengine");
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "prengine-skp-command-adapter",
      )?.status,
    ).toBe("available");

    const bytes = await readSkpDerivativeBytes(saved.fileId, "glb");
    expect(bytes.engine).toBe("Prengine");
    expect(bytes.mediaType).toBe("model/gltf-binary");
    expect(bytes.bytes.subarray(0, 4).toString("ascii")).toBe("glTF");
  });

  it("uses a configured Prengine SKP to IFC command adapter when GLB is unavailable", async () => {
    const commandScript = join(uploadDir, "skp-ifc-command-adapter.mjs");
    await writeFile(
      commandScript,
      [
        "import { writeFile } from 'node:fs/promises';",
        "const output = process.argv[process.argv.indexOf('--output') + 1];",
        `await writeFile(output, ${JSON.stringify(minimalIfcText())});`,
      ].join("\n"),
    );
    process.env.PRENGINE_SKP_TO_IFC_COMMAND = process.execPath;
    process.env.PRENGINE_SKP_TO_IFC_ARGS = JSON.stringify([
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
    expect(manifest.viewer).toBe("prengine_skp_ifc_model");
    expect(manifest.permissions.canView).toBe(true);
    expect(manifest.ifcArtifact?.mediaType).toBe("application/p21");
    expect(manifest.derivativeArtifact).toBeUndefined();
    expect(
      manifest.adapters.find(
        (adapter) => adapter.id === "prengine-skp-ifc-command-adapter",
      )?.status,
    ).toBe("available");

    const bytes = await readSkpDerivativeBytes(saved.fileId, "ifc");
    expect(bytes.engine).toBe("Prengine");
    expect(bytes.mediaType).toBe("application/p21");
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
    process.env.PRENGINE_SKP_TO_IFC_COMMAND = process.execPath;
    process.env.PRENGINE_SKP_TO_IFC_ARGS = JSON.stringify([
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
    expect(manifest.viewer).toBe("prengine_skp_ifc_model");
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
    expect(manifest.viewer).toBe("prengine_skp_model");
    expect(manifest.permissions.canView).toBe(true);
    expect(manifest.permissions.requiresLicensedAdapter).toBe(false);
    expect(manifest.notes[0]).toContain("GLB");

    const bytes = await readSkpDerivativeBytes(savedSkp.fileId, "glb");
    expect(bytes.mediaType).toBe("model/gltf-binary");
    expect(bytes.bytes.subarray(0, 4).toString("ascii")).toBe("glTF");
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
    expect(manifest.viewer).toBe("prengine_skp_model");
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
    expect(manifest.viewer).toBe("prengine_skp_model");
    expect(manifest.permissions.canView).toBe(true);
    expect(manifest.derivativeArtifact?.cacheHit).toBe(true);

    const bytes = await readSkpDerivativeBytes(saved.fileId, "glb");
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
