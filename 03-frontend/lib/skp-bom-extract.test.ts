// lib/skp-bom-extract.test.ts
// License: Apache-2.0

import { describe, expect, it } from "vitest";

import {
  buildSkpBomManifest,
  collectSkpComponentNames,
  hSectionUnitWeightKgPerM,
  parseSkpComponentName,
  renderSkpBomCsv,
  scanUtf8Strings,
} from "./skp-bom-extract";

const source = {
  fileId: "test-file-id",
  originalName: "茶园结构V5.0.2.skp",
  checksum: "0".repeat(64),
  size: 1024,
  version: "v1.0",
};

describe("scanUtf8Strings", () => {
  it("extracts ascii and CJK utf-8 runs separated by binary bytes", () => {
    const encoder = new TextEncoder();
    const name1 = encoder.encode("Beam_Main_H194x150x6.5x9_L4850_V0");
    const name2 = encoder.encode("组件#32");
    const bytes = new Uint8Array([
      0x00,
      0x21,
      0x00,
      0x00,
      0x00,
      ...name1,
      0x00,
      0x07,
      0x00,
      0x00,
      0x00,
      ...name2,
      0xff,
    ]);
    const found = scanUtf8Strings(bytes);
    expect(found).toContain("Beam_Main_H194x150x6.5x9_L4850_V0");
    expect(found).toContain("组件#32");
  });

  it("rejects truncated multi-byte sequences instead of merging runs", () => {
    // 0xe7 0xbb starts 组 but third byte is invalid -> not a run
    const bytes = new Uint8Array([0xe7, 0xbb, 0x00, 0x41, 0x42, 0x43, 0x44]);
    const found = scanUtf8Strings(bytes);
    expect(found).toContain("ABCD");
    expect(found.size).toBe(1);
  });
});

describe("collectSkpComponentNames", () => {
  it("keeps rulebook, auxiliary, section-tokened and generic names", () => {
    const { componentNames, skipped2dSymbols } = collectSkpComponentNames([
      "Column_Main_H150x150x7x10_L5600_ WithBase_V0",
      "Anchor_Bolt_M24_Set",
      "Wsher_Square_60*60*8",
      "组件#598",
      "Custom_H200x200x8x12_L4200_V0",
      "$DorLib2D$00000001",
      "Metal_06_1K",
      "materials/Metal_06_1K/material.xml",
      "OLYMPUS DIGITAL CAMERA",
    ]);
    expect(componentNames).toEqual([
      "Anchor_Bolt_M24_Set",
      "Column_Main_H150x150x7x10_L5600_ WithBase_V0",
      "Custom_H200x200x8x12_L4200_V0",
      "Wsher_Square_60*60*8",
      "组件#598",
    ]);
    expect(skipped2dSymbols).toEqual(["$DorLib2D$00000001"]);
  });
});

describe("parseSkpComponentName", () => {
  it("parses section, length and make-unique copy suffix", () => {
    const parsed = parseSkpComponentName("Beam_Main_H194x150x6.5x9_L4850_V0  #9");
    expect(parsed).toMatchObject({
      baseName: "Beam_Main_H194x150x6.5x9_L4850_V0",
      copyIndex: 9,
      prefix: "Beam",
      sectionSize: "H194X150X6.5X9",
      lengthMm: 4850,
    });
  });

  it("treats 组件#N as a definition name, not a copy", () => {
    const parsed = parseSkpComponentName("组件#32");
    expect(parsed.copyIndex).toBeNull();
    expect(parsed.baseName).toBe("组件#32");
  });
});

describe("hSectionUnitWeightKgPerM", () => {
  it("computes welded H-section theoretical weight", () => {
    // H200x200x8x12: A = 2*200*12 + (200-24)*8 = 6208 mm^2 -> 48.73 kg/m
    expect(hSectionUnitWeightKgPerM("H200X200X8X12")).toBeCloseTo(48.73, 2);
  });

  it("rejects degenerate sections", () => {
    expect(hSectionUnitWeightKgPerM("H20X200X8X12")).toBeNull();
    expect(hSectionUnitWeightKgPerM("not-a-section")).toBeNull();
  });
});

describe("buildSkpBomManifest (definition_copies)", () => {
  it("groups make-unique copies and computes weights", () => {
    const manifest = buildSkpBomManifest({
      components: [
        { name: "Column_Main_H150x150x7x10_L5600_ WithBase_V0" },
        { name: "Column_Main_H150x150x7x10_L5600_ WithBase_V0#1" },
        { name: "Column_Main_H150x150x7x10_L5600_ WithBase_V0#2" },
        { name: "组件#32" },
      ],
      quantityBasis: "definition_copies",
      source,
    });

    expect(manifest.adapter).toBe("skp_component_name_scan");
    expect(manifest.summary.lineCount).toBe(2);
    const column = manifest.lines[0]!;
    expect(column.componentName).toBe(
      "Column_Main_H150x150x7x10_L5600_ WithBase_V0",
    );
    expect(column.quantity).toBe(3);
    expect(column.categoryCode).toBe("30-03.95.03.15");
    expect(column.sectionSize).toBe("H150X150X7X10");
    expect(column.lengthMm).toBe(5600);
    // H150x150x7x10: A = 2*150*10 + 130*7 = 3910 mm^2 -> 30.69 kg/m * 5.6 m
    expect(column.unitWeightKg).toBeCloseTo(171.88, 1);
    expect(column.totalWeightKg).toBeCloseTo(515.63, 1);

    const generic = manifest.lines[1]!;
    expect(generic.componentName).toBe("组件#32");
    expect(generic.categoryName).toBe("未分类组件");
    expect(generic.weightBasis).toBe("missing_in_source");

    expect(
      manifest.issues.some(
        (issue) => issue.code === "naming_prefix_not_in_rulebook",
      ),
    ).toBe(true);
  });

  it("emits an error when nothing is found", () => {
    const manifest = buildSkpBomManifest({
      components: [],
      quantityBasis: "definition_copies",
      source,
    });
    expect(manifest.summary.lineCount).toBe(0);
    expect(manifest.issues[0]?.code).toBe("no_component_names_found");
  });
});

describe("buildSkpBomManifest (sdk_instance_count)", () => {
  it("uses real instance counts, sums copies and drops unplaced definitions", () => {
    const manifest = buildSkpBomManifest({
      components: [
        { name: "Beam_Main_H194x150x6.5x9_L4850_V0", instances: 2 },
        { name: "Beam_Main_H194x150x6.5x9_L4850_V0  #1", instances: 3 },
        { name: "Wsher_Square_60*60*8", instances: 580 },
        { name: "组件#999", instances: 0 },
      ],
      quantityBasis: "sdk_instance_count",
      source,
    });

    expect(manifest.adapter).toBe("skp_sdk_instance_scan");
    expect(manifest.quantityBasis).toBe("sdk_instance_count");
    expect(manifest.summary.unplacedDefinitionCount).toBe(1);
    expect(manifest.summary.lineCount).toBe(2);

    const beam = manifest.lines.find((line) =>
      line.componentName.startsWith("Beam_Main"),
    )!;
    expect(beam.quantity).toBe(5);
    expect(beam.quantityBasis).toBe("sdk_instance_count");
    expect(beam.totalWeightKg).toBeCloseTo((beam.unitWeightKg ?? 0) * 5, 2);

    const washer = manifest.lines.find((line) =>
      line.componentName.startsWith("Wsher"),
    )!;
    expect(washer.quantity).toBe(580);
  });
});

describe("renderSkpBomCsv", () => {
  it("renders a UTF-8 BOM prefixed csv with summary row", () => {
    const manifest = buildSkpBomManifest({
      components: [
        { name: "Column_Main_H200X200X8X12_L4200_F1_V0", instances: 6 },
      ],
      quantityBasis: "sdk_instance_count",
      source,
    });
    const csv = renderSkpBomCsv(manifest);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const rowLines = csv.slice(1).trimEnd().split("\r\n");
    expect(rowLines).toHaveLength(3);
    expect(rowLines[0]).toContain("构件名称");
    expect(rowLines[1]).toContain("Column_Main_H200X200X8X12_L4200_F1_V0");
    expect(rowLines[1]).toContain("SDK实例计数");
    expect(rowLines[2]).toContain("合计");
  });
});
