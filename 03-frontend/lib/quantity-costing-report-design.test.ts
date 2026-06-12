import { describe, expect, it } from "vitest";
import type { CostReviewReportSection } from "./quantity-costing";
import { quantityCostingPhase1Project } from "./quantity-costing";
import {
  applyDesignToUnitProjects,
  applyTemporaryReportEdits,
  buildReportDesignPreview,
  createDefaultReportDesign,
  describeReportWatermark,
  parseReportDesignTemplate,
  resolveReportSlotText,
  serializeReportDesignTemplate,
  setReportColumnVisible,
  updateReportSimpleDesign,
  validateReportDesign,
  type CostReportDesignContext,
} from "./quantity-costing-report-design";

const AT = "2026-06-12T00:00:00.000Z";

const context: CostReportDesignContext = {
  projectName: "锦屏应舍美居重钢样板工程",
  unitProjectName: "钢结构单位工程",
  reviewer: "注册造价工程师",
  date: "2026-06-12",
  pageNumber: 3,
  totalPages: 12,
};

describe("createDefaultReportDesign", () => {
  it("starts with text watermark, full columns and no validation issues", () => {
    const design = createDefaultReportDesign(AT);
    expect(design.watermark.mode).toBe("text");
    expect(design.columns).toHaveLength(7);
    expect(design.columns.every((column) => column.visible)).toBe(true);
    expect(validateReportDesign(design)).toEqual([]);
    expect(design.updatedAt).toBe(AT);
  });
});

describe("updateReportSimpleDesign", () => {
  it("merges header/footer and style patches", () => {
    const design = updateReportSimpleDesign(
      createDefaultReportDesign(AT),
      {
        headerFooter: { headerCenter: "结算审核报表" },
        titleStyle: { fontSizePt: 20, align: "left" },
      },
      AT,
    );
    expect(design.headerFooter.headerCenter).toBe("结算审核报表");
    expect(design.headerFooter.headerLeft).toBe("{项目名称}");
    expect(design.titleStyle.fontSizePt).toBe(20);
    expect(design.titleStyle.align).toBe("left");
  });

  it("clamps font size and watermark opacity silently", () => {
    const design = updateReportSimpleDesign(
      createDefaultReportDesign(AT),
      {
        titleStyle: { fontSizePt: 500 },
        tableHeadStyle: { fontSizePt: 1 },
        watermark: { opacityPct: 0 },
      },
      AT,
    );
    expect(design.titleStyle.fontSizePt).toBe(72);
    expect(design.tableHeadStyle.fontSizePt).toBe(6);
    expect(design.watermark.opacityPct).toBe(10);
  });
});

describe("watermark", () => {
  it("supports text and image forms plus none", () => {
    const base = createDefaultReportDesign(AT);
    expect(describeReportWatermark(base.watermark)).toContain("文字水印");
    const image = updateReportSimpleDesign(
      base,
      { watermark: { mode: "image", imageRef: "company-seal.png" } },
      AT,
    );
    expect(describeReportWatermark(image.watermark)).toContain("company-seal.png");
    const none = updateReportSimpleDesign(base, { watermark: { mode: "none" } }, AT);
    expect(describeReportWatermark(none.watermark)).toBe("无水印");
  });

  it("flags image watermark without image as a validation issue", () => {
    const design = updateReportSimpleDesign(
      createDefaultReportDesign(AT),
      { watermark: { mode: "image", imageRef: "" } },
      AT,
    );
    expect(validateReportDesign(design)).toHaveLength(1);
    expect(validateReportDesign(design)[0]).toContain("图片水印");
  });
});

describe("resolveReportSlotText", () => {
  it("interpolates known variables and keeps unknown placeholders", () => {
    expect(resolveReportSlotText("{项目名称} 第 {页码}/{总页数} 页", context)).toBe(
      "锦屏应舍美居重钢样板工程 第 3/12 页",
    );
    expect(resolveReportSlotText("{不存在的变量}", context)).toBe("{不存在的变量}");
  });
});

describe("buildReportDesignPreview", () => {
  it("renders resolved header/footer and visible columns", () => {
    const design = setReportColumnVisible(createDefaultReportDesign(AT), "seq", false, AT);
    const preview = buildReportDesignPreview(design, context);
    expect(preview.headerLine).toBe("锦屏应舍美居重钢样板工程 | 审核报表 | 2026-06-12");
    expect(preview.footerLine).toContain("第 3 页 / 共 12 页");
    expect(preview.visibleColumnLabels).not.toContain("序号");
    expect(preview.visibleColumnLabels).toContain("报表名称");
    expect(preview.issues).toEqual([]);
  });

  it("reports empty table when all columns hidden", () => {
    let design = createDefaultReportDesign(AT);
    for (const column of design.columns) {
      design = setReportColumnVisible(design, column.columnId, false, AT);
    }
    const preview = buildReportDesignPreview(design, context);
    expect(preview.visibleColumnLabels).toEqual([]);
    expect(preview.issues.some((issue) => issue.includes("可见列"))).toBe(true);
  });
});

describe("applyDesignToUnitProjects", () => {
  it("targets all unit projects by default", () => {
    const plan = applyDesignToUnitProjects(
      quantityCostingPhase1Project,
      createDefaultReportDesign(AT),
    );
    expect(plan.appliedCount).toBeGreaterThan(0);
    expect(plan.appliedCount).toBe(plan.targetNodeIds.length);
    expect(plan.skippedNodeIds).toEqual([]);
    expect(plan.outputState).toBe("professional_review_required");
  });

  it("skips non-unit-project nodes from an explicit selection", () => {
    const unitId = quantityCostingPhase1Project.treeNodes.find(
      (node) => node.nodeType === "unit_project",
    )?.nodeId;
    const otherId = quantityCostingPhase1Project.treeNodes.find(
      (node) => node.nodeType !== "unit_project",
    )?.nodeId;
    expect(unitId).toBeDefined();
    expect(otherId).toBeDefined();
    const plan = applyDesignToUnitProjects(
      quantityCostingPhase1Project,
      createDefaultReportDesign(AT),
      [unitId!, otherId!],
    );
    expect(plan.targetNodeIds).toEqual([unitId]);
    expect(plan.skippedNodeIds).toEqual([otherId]);
  });
});

describe("applyTemporaryReportEdits", () => {
  const sections: CostReviewReportSection[] = [
    {
      sectionId: "summary",
      title: "汇总",
      rows: [
        { item: "钢结构", amount: 100 },
        { item: "幕墙", amount: 50 },
      ],
    },
  ];

  it("applies edits without mutating the original sections", () => {
    const result = applyTemporaryReportEdits(sections, [
      { sectionId: "summary", rowIndex: 1, field: "amount", value: 66 },
    ]);
    expect(result.appliedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.sections[0]?.rows[1]?.amount).toBe(66);
    expect(sections[0]?.rows[1]?.amount).toBe(50);
  });

  it("skips unknown sections, rows and fields", () => {
    const result = applyTemporaryReportEdits(sections, [
      { sectionId: "missing", rowIndex: 0, field: "amount", value: 1 },
      { sectionId: "summary", rowIndex: 9, field: "amount", value: 1 },
      { sectionId: "summary", rowIndex: 0, field: "nope", value: 1 },
    ]);
    expect(result.appliedCount).toBe(0);
    expect(result.skippedCount).toBe(3);
  });
});

describe("template serialization", () => {
  it("round-trips a customized design through cost_report_templates content", () => {
    const design = updateReportSimpleDesign(
      createDefaultReportDesign(AT),
      {
        headerFooter: { headerCenter: "竣工结算审核" },
        watermark: { mode: "image", imageRef: "seal.png", opacityPct: 55 },
      },
      AT,
    );
    const parsed = parseReportDesignTemplate(serializeReportDesignTemplate(design), AT);
    expect(parsed).toEqual(design);
  });

  it("rejects foreign content and tolerates missing fields", () => {
    expect(parseReportDesignTemplate(null, AT)).toBeNull();
    expect(parseReportDesignTemplate({ kind: "other" }, AT)).toBeNull();
    const sparse = parseReportDesignTemplate(
      { kind: "report_simple_design", version: 1, design: { designId: "tpl-1" } },
      AT,
    );
    expect(sparse?.designId).toBe("tpl-1");
    expect(sparse?.columns).toHaveLength(7);
    expect(sparse?.watermark.mode).toBe("text");
  });
});
