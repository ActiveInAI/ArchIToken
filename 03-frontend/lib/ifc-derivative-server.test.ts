// lib/ifc-derivative-server.test.ts - IFC derivative cache contract
// License: Apache-2.0

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildIfcDerivativeManifest,
  probeIfcDerivativeAdapters,
  readIfcDerivativeBytes,
} from "./ifc-derivative-server";
import { saveLocalUpload } from "./local-file-runtime-server";

const minimalIfc = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('architoken-test.ifc','2026-05-19T00:00:00',('ArchIToken'),('ArchIToken'),'','','');
FILE_SCHEMA(('IFC4X3_ADD2'));
ENDSEC;
DATA;
#1=IFCPROJECT('0A00000000000000000000',$,'ArchIToken Test',$,$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;
`;

describe("IFC derivative server", () => {
  let uploadDir: string;
  let previousUploadDir: string | undefined;

  beforeEach(async () => {
    previousUploadDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    uploadDir = await mkdtemp(join(tmpdir(), "architoken-ifc-derivatives-"));
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

  it("creates a checksum-keyed manifest and pending properties index", async () => {
    const saved = await saveLocalUpload({
      file: new File([minimalIfc], "building.ifc", { type: "application/p21" }),
      moduleId: "detailed_design",
    });

    const first = await buildIfcDerivativeManifest(saved.fileId);
    expect(first.schema).toBe("architoken.ifc_derivative_cache.v1");
    expect(first.sourceChecksum).toBe(saved.checksum);
    expect(first.cacheHit).toBe(false);
    expect(first.properties.status).toBe("pending_worker");
    expect(first.derivatives.map((derivative) => derivative.kind)).toEqual([
      "openusd",
      "tiles",
      "glb",
      "fragments",
    ]);
    expect(
      first.derivatives.every(
        (derivative) => derivative.status === "pending_worker",
      ),
    ).toBe(true);

    const index = await readIfcDerivativeBytes(
      saved.fileId,
      "properties-index",
    );
    expect(index.mediaType).toBe("application/json");
    expect(index.etag).toContain(saved.checksum);
    expect(JSON.parse(index.bytes.toString("utf8"))).toMatchObject({
      schema: "architoken.ifc_properties_index.v1",
      status: "pending_worker",
      totalRows: 0,
    });

    const second = await buildIfcDerivativeManifest(saved.fileId);
    expect(second.cacheHit).toBe(true);
    expect(second.etag).toBe(first.etag);
  });

  it("records IfcOpenShell and ThatOpen worker adapter boundaries", async () => {
    const adapters = await probeIfcDerivativeAdapters();
    expect(adapters.map((adapter) => adapter.id)).toEqual(
      expect.arrayContaining([
        "prengine-openusd",
        "cesium-ion-3dtiles",
        "ifcopenshell-ifcconvert",
        "ifcopenshell-python",
        "louistrue-ifcliteviewer",
        "thatopen-fragments-service",
        "thatopen-web-ifc-viewer",
      ]),
    );
    expect(
      adapters.find((adapter) => adapter.id === "prengine-openusd")
        ?.capability,
    ).toBe("openusd_derivative");
    const ifcConvert = adapters.find(
      (adapter) => adapter.id === "ifcopenshell-ifcconvert",
    );
    expect(ifcConvert?.licenseBoundary).toBe("isolated_sidecar");
    expect(ifcConvert?.priority).toBe(20);
    expect(ifcConvert?.role).toBe("diagnostic");
    expect(ifcConvert?.capability).toBe("isolated_visual_reference");
    expect(
      adapters.find((adapter) => adapter.id === "cesium-ion-3dtiles")
        ?.capability,
    ).toBe("tiles3d_derivative");
  });
});
