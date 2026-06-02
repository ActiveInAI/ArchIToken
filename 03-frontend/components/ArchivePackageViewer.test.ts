// components/ArchivePackageViewer.test.ts - ZIP central directory tests
// License: Apache-2.0

import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  maxInlinePreviewBytesForEntry,
  parseZipCentralDirectory,
  readZipEntryBytes,
} from "./ArchivePackageViewer";

const encoder = new TextEncoder();

describe("ArchivePackageViewer ZIP parser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists ZIP entries from the native central directory", () => {
    const archive = makeZip([
      { name: "docs/", data: "" },
      { name: "docs/readme.txt", data: "hello" },
      { name: "模型/构件.ifc", data: "ISO-10303-21;" },
    ]);

    const summary = parseZipCentralDirectory(archive);

    expect(summary.fileCount).toBe(2);
    expect(summary.directoryCount).toBe(1);
    expect(summary.entries.map((entry) => entry.name)).toEqual([
      "docs/",
      "docs/readme.txt",
      "模型/构件.ifc",
    ]);
    expect(summary.entries[1]?.methodLabel).toBe("store");
    expect(summary.entries[2]?.kind).toBe("bim");
    expect(summary.uncompressedBytes).toBe(18);
  });

  it("flags unsafe archive paths without extracting them", () => {
    const archive = makeZip([{ name: "../escape.txt", data: "bad" }]);

    const summary = parseZipCentralDirectory(archive);

    expect(summary.unsafePathCount).toBe(1);
    expect(summary.entries[0]?.unsafe).toBe(true);
    expect(summary.warnings.join(" ")).toContain("可疑路径");
  });

  it("classifies nested archives and package content", () => {
    const archive = makeZip([
      { name: "bundle/nested.ifczip", data: "PK" },
      { name: "bundle/drawing.dxf", data: "0\nSECTION" },
      { name: "bundle/report.xlsx", data: "sheet" },
    ]);

    const summary = parseZipCentralDirectory(archive);

    expect(summary.nestedArchiveCount).toBe(1);
    expect(summary.entries.map((entry) => entry.kind)).toEqual([
      "archive",
      "cad",
      "office",
    ]);
  });

  it("allows large Office entries to use native document preview before worker fallback", () => {
    const archive = makeZip([{ name: "deck.pptx", data: "slides" }]);
    const summary = parseZipCentralDirectory(archive);
    const entry = summary.entries[0];

    expect(entry?.kind).toBe("office");
    expect(entry ? maxInlinePreviewBytesForEntry(entry) : 0).toBeGreaterThan(
      40 * 1024 * 1024,
    );
  });

  it("reads deflated ZIP entries through the JSZip fallback when native deflate is missing", async () => {
    const archive = new JSZip();
    archive.file("cad/model.dxf", "0\nSECTION\n2\nENTITIES");
    const bytes = await archive.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
    });
    const summary = parseZipCentralDirectory(bytes);
    const entry = summary.entries.find((item) => item.name === "cad/model.dxf");

    expect(entry?.methodLabel).toBe("deflate");
    vi.stubGlobal("DecompressionStream", undefined);

    const extracted = entry ? await readZipEntryBytes(bytes, entry) : null;

    expect(new TextDecoder().decode(extracted ?? new Uint8Array())).toContain(
      "ENTITIES",
    );
  });
});

function makeZip(files: Array<{ name: string; data: string }>): ArrayBuffer {
  const chunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.data);
    const local = new Uint8Array(30 + nameBytes.length + dataBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, 0, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(dataBytes, 30 + nameBytes.length);
    chunks.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, 0, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralChunks.push(central);

    offset += local.length;
  }

  const centralOffset = offset;
  const centralSize = centralChunks.reduce(
    (total, chunk) => total + chunk.length,
    0,
  );
  chunks.push(...centralChunks);

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, centralOffset, true);
  chunks.push(eocd);

  const result = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.length, 0),
  );
  let writeOffset = 0;
  for (const chunk of chunks) {
    result.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }
  return result.buffer;
}
