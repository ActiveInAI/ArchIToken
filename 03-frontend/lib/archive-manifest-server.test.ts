// lib/archive-manifest-server.test.ts - External archive manifest tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import { parseSevenZipTechnicalList } from "./archive-manifest-server";

describe("archive-manifest-server", () => {
  it("parses 7z technical listing entries without extracting content", () => {
    const entries = parseSevenZipTechnicalList(
      `
Path = /tmp/package.7z
Type = 7z
Physical Size = 60748995

Path = docs/
Size = 0
Attributes = D drwxrwxr-x
Encrypted = -

Path = docs/测后删030.pptx
Size = 42300168
Packed Size = 60748670
Modified = 2026-05-19 17:57:56.2623106
Attributes = A -rw-rw-r--
Encrypted = -
Method = LZMA2:24

Path = ../escape.ifc
Size = 128
Attributes = A -rw-rw-r--
Encrypted = +
Method = LZMA2:24
`,
      "/tmp/package.7z",
    );

    expect(entries).toHaveLength(3);
    expect(entries[0]?.directory).toBe(true);
    expect(entries[1]?.kind).toBe("office");
    expect(entries[1]?.uncompressedSize).toBe(42300168);
    expect(entries[2]?.unsafe).toBe(true);
    expect(entries[2]?.encrypted).toBe(true);
  });

  it("parses SketchUp source package entries as real archive content", () => {
    const entries = parseSevenZipTechnicalList(
      `
Path = /tmp/model.skp
Type = zip
WARNINGS:
Headers Error
Offset = 69
Physical Size = 29139482

Path = meta/meta.dat
Size = 215
Packed Size = 156
Attributes = A
Method = Deflate

Path = materials/Layer_01/material.xml
Size = 390
Packed Size = 233
Attributes = A
Method = Deflate

Path = styles/Style/style.xml
Size = 4846
Packed Size = 657
Attributes = A
Method = Deflate

Path = model.dat
Size = 161264827
Packed Size = 29136671
Attributes = A
Method = Deflate
`,
      "/tmp/model.skp",
    );

    expect(entries.map((entry) => entry.name)).toEqual([
      "meta/meta.dat",
      "materials/Layer_01/material.xml",
      "styles/Style/style.xml",
      "model.dat",
    ]);
    expect(entries.find((entry) => entry.name === "model.dat")?.kind).toBe(
      "data",
    );
  });
});
