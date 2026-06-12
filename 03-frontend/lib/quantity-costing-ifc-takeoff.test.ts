// lib/quantity-costing-ifc-takeoff.test.ts - IFC takeoff → BOQ mapping tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  mapIfcManifestToBoqItems,
  type IfcTakeoffManifest,
} from "./quantity-costing-ifc-takeoff";
import { computeBoqItem } from "./quantity-costing";

const manifest: IfcTakeoffManifest = {
  summary: {
    lineCount: 4,
    elementCount: 20,
    totalWeightKg: 12000,
    geometryFailures: 0,
    byClass: { IfcColumn: 8, IfcBeam: 10, IfcBuildingElementProxy: 2 },
  },
  lines: [
    {
      lineNo: 1,
      category: "钢柱",
      ifcClass: "IfcColumn",
      sectionLabel: "H306X151X8X12",
      lengthMm: 3000,
      quantity: 5,
      unitWeightKg: 200,
      totalWeightKg: 1000,
      storeys: { "1F": 5 },
      globalIds: ["g-col-1", "g-col-2"],
    },
    {
      lineNo: 2,
      category: "钢柱",
      ifcClass: "IfcColumn",
      sectionLabel: "H400X200X8X13",
      lengthMm: 3000,
      quantity: 3,
      unitWeightKg: 400,
      totalWeightKg: 1200,
      storeys: { "2F": 3 },
      globalIds: ["g-col-3"],
    },
    {
      lineNo: 3,
      category: "钢梁",
      ifcClass: "IfcBeam",
      sectionLabel: "H500X200X10X16",
      lengthMm: 6000,
      quantity: 10,
      unitWeightKg: 980,
      totalWeightKg: 9800,
      storeys: { "1F": 6, "2F": 4 },
      globalIds: ["g-beam-1"],
    },
    {
      lineNo: 4,
      category: "未分类构件",
      ifcClass: "IfcBuildingElementProxy",
      sectionLabel: "",
      lengthMm: 500,
      quantity: 2,
      unitWeightKg: null,
      totalWeightKg: null,
      storeys: {},
      globalIds: ["g-proxy-1"],
    },
  ],
};

// 真实 SJG 157-2024 钢结构小类（30-03.95，与数据库导入一致）
const sjg157Steel = [
  { code: "30-03.95.03", nameZh: "钢柱", ifcEntity: "IfcColumn", levelName: "小类" },
  { code: "30-03.95.09", nameZh: "钢梁", ifcEntity: "IfcBeam", levelName: "小类" },
  { code: "30-03.95.36", nameZh: "拉索", ifcEntity: "IfcMember", levelName: "小类" },
  { code: "30-03.95.39", nameZh: "钢支撑", ifcEntity: "IfcMember", levelName: "小类" },
];

describe("mapIfcManifestToBoqItems", () => {
  const result = mapIfcManifestToBoqItems(manifest, {
    projectId: "qc-ifc",
    nodeId: "node-steel",
    sourceFileName: "茶园结构.ifc",
    semanticCategories: sjg157Steel,
  });

  it("按 SJG157 精确匹配 name_zh 填入字典编码", () => {
    const column = result.boqItems.find((i) => i.approvedName === "钢柱")!;
    expect(column.approvedCode).toBe("30-03.95.03");
    expect(column.submittedCode).toBe("30-03.95.03");
    expect(column.unit).toBe("t");
    // 钢柱合计重量 (1000+1200)/1000 = 2.2 t
    expect(column.approvedQty).toBe(2.2);
    const beam = result.boqItems.find((i) => i.approvedName === "钢梁")!;
    expect(beam.approvedCode).toBe("30-03.95.09");
    expect(result.sjg157MatchedCount).toBe(2);
  });

  it("无 SJG157 精确匹配的构件编码留空待人工套码（不臆造）", () => {
    const proxy = result.boqItems.find((i) => i.approvedName === "未分类构件")!;
    expect(proxy.approvedCode).toBe("");
    expect(proxy.manualReviewRequired).toBe(true);
    expect(proxy.temporary).toBe(true);
  });

  it("工程量取几何实测理论重量(t)，含截面/楼层特征", () => {
    const beam = result.boqItems.find((i) => i.approvedName === "钢梁")!;
    expect(beam.approvedQty).toBe(9.8);
    expect(beam.approvedFeature).toContain("H500X200X10X16×10");
    expect(beam.approvedFeature).toContain("楼层 1F、2F");
    expect(beam.approvedFeature).toContain("构件 10 件");
    expect(beam.sourceRef).toBe("IFC几何实测:茶园结构.ifc");
    expect(beam.elementId).toBe("g-beam-1");
  });

  it("多截面钢柱汇总后特征列出全部规格按数量降序", () => {
    const column = result.boqItems.find((i) => i.approvedName === "钢柱")!;
    expect(column.approvedFeature).toContain("H306X151X8X12×5");
    expect(column.approvedFeature).toContain("H400X200X8X13×3");
    expect(column.approvedFeature.indexOf("×5")).toBeLessThan(
      column.approvedFeature.indexOf("×3"),
    );
  });

  it("未提供 SJG157 字典时编码全留空", () => {
    const noDict = mapIfcManifestToBoqItems(manifest, {
      projectId: "p",
      nodeId: "n",
      sourceFileName: "x.ifc",
    });
    expect(noDict.boqItems.every((i) => i.approvedCode === "")).toBe(true);
    expect(noDict.sjg157MatchedCount).toBe(0);
    expect(noDict.boqItems.every((i) => i.manualReviewRequired === true)).toBe(
      true,
    );
  });

  it("汇总总重与清单项数正确，映射后可参与造价计算", () => {
    expect(result.totalWeightTon).toBe(12);
    expect(result.mappedClassCount).toBe(3);
    expect(result.unweightedElementCount).toBe(2);
    const computed = computeBoqItem(result.boqItems[0]!);
    expect(computed.changeMark).toBe("none");
  });
});
