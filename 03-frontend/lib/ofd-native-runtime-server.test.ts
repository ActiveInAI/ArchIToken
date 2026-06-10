// lib/ofd-native-runtime-server.test.ts - PanAEC native OFD runtime contract
// License: Apache-2.0

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveLocalUpload } from "./local-file-runtime-server";
import { buildOfdNativeManifest } from "./ofd-native-runtime-server";

describe("OFD native runtime server", () => {
  let uploadDir: string;
  let previousUploadDir: string | undefined;
  let previousPublicBaseUrl: string | undefined;

  beforeEach(async () => {
    previousUploadDir = process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    previousPublicBaseUrl = process.env.ARCHITOKEN_PUBLIC_BASE_URL;
    uploadDir = await mkdtemp(join(tmpdir(), "architoken-ofd-native-"));
    process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = uploadDir;
    process.env.ARCHITOKEN_PUBLIC_BASE_URL = "http://architoken.example";
  });

  afterEach(async () => {
    if (previousUploadDir === undefined) {
      delete process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR;
    } else {
      process.env.ARCHITOKEN_LOCAL_UPLOADS_DIR = previousUploadDir;
    }
    if (previousPublicBaseUrl === undefined) {
      delete process.env.ARCHITOKEN_PUBLIC_BASE_URL;
    } else {
      process.env.ARCHITOKEN_PUBLIC_BASE_URL = previousPublicBaseUrl;
    }
    await rm(uploadDir, { recursive: true, force: true });
  });

  it("opens the OFD source package without creating derivative display roles", async () => {
    const zip = new JSZip();
    zip.file(
      "OFD.xml",
      '<ofd:OFD xmlns:ofd="http://www.ofdspec.org/2016"><ofd:DocBody><ofd:DocRoot>Doc_0/Document.xml</ofd:DocRoot></ofd:DocBody></ofd:OFD>',
    );
    zip.file(
      "Doc_0/Document.xml",
      '<Document><CommonData><PageArea><PhysicalBox>0 0 210 297</PhysicalBox></PageArea><PublicRes>PublicRes.xml</PublicRes></CommonData><Pages><Page ID="1" BaseLoc="Pages/Page_0/Content.xml"/></Pages></Document>',
    );
    zip.file(
      "Doc_0/Pages/Page_0/Content.xml",
      '<Page><Content><Layer><TextObject ID="T1" Boundary="0 0 40 8" Size="5"><TextCode X="0" Y="5">电子发票</TextCode></TextObject></Layer></Content></Page>',
    );
    zip.file("Doc_0/PublicRes.xml", '<Res><ColorSpace ID="CS1"/></Res>');
    zip.file("Doc_0/Signs/Signatures.xml", "<Signatures />");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const fileBytes = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const saved = await saveLocalUpload({
      file: new File([fileBytes], "invoice.ofd", { type: "application/ofd" }),
      moduleId: "digital_archive",
    });

    const manifest = await buildOfdNativeManifest(
      saved.fileId,
      "http://localhost:3000/api/local-files/example/ofd-native",
    );

    expect(manifest.schema).toBe("architoken.ofd_native_manifest.v1");
    expect(manifest.viewer).toBe("ofd_native_package_viewer");
    expect(manifest.sourceOfRecord.substitutePreview).toBe(false);
    expect(manifest.derivativeRoles).toEqual([]);
    expect(manifest.canRenderFixedLayout).toBe(true);
    expect(manifest.renderedPages).toHaveLength(1);
    expect(manifest.renderedPages[0]?.width).toBe(210);
    expect(manifest.renderedPages[0]?.height).toBe(297);
    expect(manifest.renderedPages[0]?.objects[0]).toMatchObject({
      text: "电子发票",
      x: 0,
      y: 5,
      fontFamily: "sans-serif",
    });
    expect(manifest.documents).toContain("Doc_0/Document.xml");
    expect(manifest.pages).toContain("Doc_0/Pages/Page_0/Content.xml");
    expect(manifest.resources).toContain("Doc_0/PublicRes.xml");
    expect(manifest.signatures).toContain("Doc_0/Signs/Signatures.xml");
    expect(
      manifest.textSnippets.map((snippet) => snippet.text).join(" "),
    ).toContain("电子发票");
  });
});
