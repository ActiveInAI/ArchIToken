// lib/quantity-costing-report-export.test.ts - Report export workbook tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  calculateCostingDashboard,
  calculateFeeSummaryItem,
  calculateMeasureItem,
  calculateOtherItem,
  quantityCostingDefaultReportMetadata,
  quantityCostingPhase1Project,
  quantityCostingPhase2FeeRules,
  quantityCostingPhase2MeasureItems,
  quantityCostingPhase2OtherItems,
  quantityCostingSystemReportScheme,
} from "./quantity-costing";
import {
  createDefaultReportDesign,
  setReportColumnVisible,
  updateReportSimpleDesign,
} from "./quantity-costing-report-design";
import {
  buildCostReportExportWorkbook,
  buildCostReportWordHtml,
  type CostReportExportInput,
} from "./quantity-costing-report-export";

function buildInput(
  overrides: Partial<CostReportExportInput> = {},
): CostReportExportInput {
  return {
    scheme: quantityCostingSystemReportScheme,
    design: createDefaultReportDesign("2026-06-12T00:00:00.000Z"),
    dashboard: calculateCostingDashboard(quantityCostingPhase1Project),
    measureItems: quantityCostingPhase2MeasureItems.map((item) =>
      calculateMeasureItem(item),
    ),
    otherItems: quantityCostingPhase2OtherItems.map((item) =>
      calculateOtherItem(item),
    ),
    feeSummaryItems: quantityCostingPhase2FeeRules.map((rule) =>
      calculateFeeSummaryItem(rule),
    ),
    metadata: quantityCostingDefaultReportMetadata,
    approval: null,
    reportOutputStateLabel: "专业复核中",
    exportDate: "2026-06-12",
    ...overrides,
  };
}

describe("buildCostReportExportWorkbook", () => {
  it("按方案生成报表清单+各报表工作簿，文件名带审核前缀", () => {
    const workbook = buildCostReportExportWorkbook(buildInput());
    expect(workbook.fileName).toBe(
      "[审核]锦屏应舍美居重钢样板工程-报表.xlsx",
    );
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual([
      "报表清单",
      "分部分项工程量清单与计价表",
      "单位工程费用汇总表",
      "项目审核认证单",
      "增减分析表",
      "审核报告",
    ]);
  });

  it("页眉页脚与水印按设计渲染到每张工作表", () => {
    const workbook = buildCostReportExportWorkbook(buildInput());
    for (const sheet of workbook.sheets) {
      expect(sheet.rows[0]?.[0]).toBe(workbook.headerLine);
      expect(String(sheet.rows[1]?.[0])).toContain("水印:");
      expect(sheet.rows[sheet.rows.length - 1]?.[0]).toBe(
        workbook.footerLine,
      );
    }
    expect(workbook.headerLine).toContain("审核报表");
    expect(workbook.footerLine).toContain("第 1 页");
  });

  it("隐藏列从报表清单导出中剔除", () => {
    const design = setReportColumnVisible(
      createDefaultReportDesign("2026-06-12T00:00:00.000Z"),
      "seq",
      false,
    );
    const workbook = buildCostReportExportWorkbook(buildInput({ design }));
    const overview = workbook.sheets[0]!;
    const headerRow = overview.rows.find((row) => row.includes("报表名称"));
    expect(headerRow).toBeDefined();
    expect(headerRow).not.toContain("序号");
  });

  it("分部分项表含全部清单与合计行，认证单含审批留痕", () => {
    const workbook = buildCostReportExportWorkbook(
      buildInput({
        approval: {
          approvalKey: "approval-1",
          title: "审核认证单",
          professionalRole: "注册造价工程师",
          approverLabel: "注册造价工程师",
          status: "approved",
          decision: "核增核减口径符合，同意出具。",
          evidenceRefs: [],
          reportKey: "rpt-1",
          createdAt: "2026-06-12T00:00:00.000Z",
          updatedAt: "2026-06-12T00:00:00.000Z",
        },
      }),
    );
    const boqSheet = workbook.sheets[1]!;
    const dataRows = boqSheet.rows.filter(
      (row) => typeof row[0] === "number",
    );
    expect(dataRows).toHaveLength(5);
    const totalRow = boqSheet.rows.find((row) => row[3] === "合计");
    expect(totalRow?.[7]).toBe(292780);
    expect(totalRow?.[10]).toBe(307394);

    const certSheet = workbook.sheets[3]!;
    const approvalRow = certSheet.rows.find((row) => row[0] === "专业审批");
    expect(String(approvalRow?.[1])).toContain("approved");
    expect(String(approvalRow?.[1])).toContain("同意出具");
  });

  it("关闭水印导出后不再包含水印行", () => {
    const input = buildInput();
    const workbook = buildCostReportExportWorkbook({
      ...input,
      design: updateReportSimpleDesign(input.design, {
        watermark: { ...input.design.watermark, showOnExport: false },
      }),
    });
    for (const sheet of workbook.sheets) {
      expect(
        sheet.rows.some((row) => String(row[0]).startsWith("水印:")),
      ).toBe(false);
    }
  });
});

describe("buildCostReportWordHtml", () => {
  it("生成包含全部工作表的 Word HTML 并转义特殊字符", () => {
    const workbook = buildCostReportExportWorkbook(buildInput());
    const html = buildCostReportWordHtml(workbook);
    expect(html).toContain("<h2>报表清单</h2>");
    expect(html).toContain("<h2>审核报告</h2>");
    expect(html).toContain("锦屏应舍美居重钢样板工程");
    expect(html).not.toContain("<script");
  });
});
