import {
  costChangeMarkLabels,
  roundMoney,
  summarizeCostAnalysisByLevel,
  type ComputedCostFeeSummaryItem,
  type ComputedCostMeasureItem,
  type ComputedCostOtherItem,
  type CostReportScheme,
  type CostReviewReportMetadata,
  type QuantityCostingDashboard,
} from "./quantity-costing";
import {
  buildReportDesignPreview,
  type CostReportDesignContext,
  type CostReportSimpleDesign,
} from "./quantity-costing-report-design";
import type { CostApprovalRecord } from "./quantity-costing-approval";

export type CostReportExportCell = string | number;

export interface CostReportExportSheet {
  name: string;
  rows: CostReportExportCell[][];
}

export interface CostReportExportWorkbook {
  fileName: string;
  sheets: CostReportExportSheet[];
  watermarkLabel: string;
  headerLine: string;
  footerLine: string;
  designIssues: string[];
}

export interface CostReportExportInput {
  scheme: CostReportScheme;
  design: CostReportSimpleDesign;
  dashboard: QuantityCostingDashboard;
  measureItems: ComputedCostMeasureItem[];
  otherItems: ComputedCostOtherItem[];
  feeSummaryItems: ComputedCostFeeSummaryItem[];
  metadata: CostReviewReportMetadata;
  approval: CostApprovalRecord | null;
  reportOutputStateLabel: string;
  exportDate: string;
}

const sheetNameLimit = 31;

function sanitizeSheetName(name: string, index: number): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, " ").trim();
  const truncated = cleaned.slice(0, sheetNameLimit);
  return truncated === "" ? `Sheet${index + 1}` : truncated;
}

function decorateSheet(
  rows: CostReportExportCell[][],
  input: CostReportExportInput,
  preview: { headerLine: string; footerLine: string; watermarkLabel: string },
): CostReportExportCell[][] {
  const decorated: CostReportExportCell[][] = [];
  if (preview.headerLine !== "") {
    decorated.push([preview.headerLine]);
  }
  if (
    input.scheme.exportSettings.includeWatermark &&
    input.design.watermark.mode !== "none" &&
    input.design.watermark.showOnExport
  ) {
    decorated.push([`水印: ${preview.watermarkLabel}`]);
  }
  decorated.push(...rows);
  if (preview.footerLine !== "") {
    decorated.push([preview.footerLine]);
  }
  return decorated;
}

function buildSchemeOverviewRows(
  input: CostReportExportInput,
): CostReportExportCell[][] {
  const visibleColumns = input.design.columns.filter(
    (column) => column.visible,
  );
  const summary = input.dashboard.summary;
  const header = visibleColumns.map((column) => column.label);
  const rows = input.scheme.reportNames.map((name, index) => {
    const byColumn: Record<string, CostReportExportCell> = {
      seq: index + 1,
      report_name: name,
      data_source: "编审一体数据",
      status: input.reportOutputStateLabel,
      submitted_total: roundMoney(summary.submittedTotal),
      approved_total: roundMoney(summary.approvedTotal),
      amount_delta: roundMoney(summary.amountDelta),
    };
    return visibleColumns.map((column) => byColumn[column.columnId] ?? "");
  });
  return [header, ...rows];
}

function buildBoqSheetRows(
  input: CostReportExportInput,
): CostReportExportCell[][] {
  const header = [
    "序号",
    "标记",
    "编码",
    "名称",
    "单位",
    "送审工程量",
    "送审综合单价",
    "送审合价",
    "审定工程量",
    "审定综合单价",
    "审定合价",
    "增减金额",
    "增减说明",
  ];
  const rows = input.dashboard.computedItems.map((item, index) => [
    index + 1,
    costChangeMarkLabels[item.changeMark],
    item.displayCode,
    item.displayName,
    item.unit,
    item.submittedQty,
    item.submittedUnitPrice,
    item.submittedTotal,
    item.approvedQty,
    item.approvedUnitPrice,
    item.approvedTotal,
    item.amountDelta,
    item.changeReason,
  ]);
  const summary = input.dashboard.summary;
  rows.push([
    "",
    "",
    "",
    "合计",
    "",
    "",
    "",
    summary.submittedTotal,
    "",
    "",
    summary.approvedTotal,
    summary.amountDelta,
    `核增 ${summary.increaseAmount} / 核减 ${summary.decreaseAmount}`,
  ]);
  return [header, ...rows];
}

function buildUnitSummaryRows(
  input: CostReportExportInput,
): CostReportExportCell[][] {
  const header = [
    "范围",
    "清单数",
    "送审合计",
    "审定合计",
    "增减金额",
    "核增",
    "核减",
  ];
  const unitRows = summarizeCostAnalysisByLevel(
    input.dashboard.project,
    input.dashboard.computedItems,
    "unit_project",
  ).map((row) => [
    row.nodeName,
    row.itemIds.length,
    row.submittedTotal,
    row.approvedTotal,
    row.amountDelta,
    row.increaseAmount,
    row.decreaseAmount,
  ]);
  const measureTotal = roundMoney(
    input.measureItems.reduce((sum, item) => sum + item.approvedAmount, 0),
  );
  const otherTotal = roundMoney(
    input.otherItems.reduce((sum, item) => sum + item.approvedAmount, 0),
  );
  const feeTotal = roundMoney(
    input.feeSummaryItems.reduce((sum, item) => sum + item.approvedAmount, 0),
  );
  return [
    header,
    ...unitRows,
    ["措施项目(审定)", input.measureItems.length, "", measureTotal, "", "", ""],
    ["其他项目(审定)", input.otherItems.length, "", otherTotal, "", "", ""],
    ["费用汇总(审定)", input.feeSummaryItems.length, "", feeTotal, "", "", ""],
  ];
}

function buildCertificationRows(
  input: CostReportExportInput,
): CostReportExportCell[][] {
  const summary = input.dashboard.summary;
  const approval = input.approval;
  return [
    ["项目名称", input.metadata.projectName],
    ["建设单位", input.metadata.owner],
    ["施工单位", input.metadata.contractor],
    ["设计单位", input.metadata.designer],
    ["监理单位", input.metadata.supervisor],
    ["审核人", input.metadata.reviewer],
    ["送审金额", summary.submittedTotal],
    ["审定金额", summary.approvedTotal],
    ["增减金额", summary.amountDelta],
    ["核增金额", summary.increaseAmount],
    ["核减金额", summary.decreaseAmount],
    [
      "专业审批",
      approval
        ? `${approval.professionalRole} · ${approval.status} · ${approval.decision}`
        : "未发起审批",
    ],
    ["报告状态", input.reportOutputStateLabel],
    ["出具日期", input.exportDate],
  ];
}

function buildDeltaAnalysisRows(
  input: CostReportExportInput,
): CostReportExportCell[][] {
  const header = ["编码", "名称", "标记", "增减金额", "核增", "核减", "增减说明"];
  const rows = input.dashboard.computedItems
    .filter((item) => item.changeMark !== "none")
    .map((item) => [
      item.displayCode,
      item.displayName,
      costChangeMarkLabels[item.changeMark],
      item.amountDelta,
      item.increaseAmount,
      item.decreaseAmount,
      item.changeReason,
    ]);
  return [header, ...rows];
}

function buildReviewConclusionRows(
  input: CostReportExportInput,
): CostReportExportCell[][] {
  const summary = input.dashboard.summary;
  const ratio =
    summary.submittedTotal === 0
      ? 0
      : summary.amountDelta / summary.submittedTotal;
  return [
    ["审核结论"],
    [
      `送审金额 ${roundMoney(summary.submittedTotal)} 元，审定金额 ${roundMoney(
        summary.approvedTotal,
      )} 元，增减金额 ${roundMoney(summary.amountDelta)} 元（${(ratio * 100).toFixed(2)}%）。`,
    ],
    [
      `其中核增 ${roundMoney(summary.increaseAmount)} 元，核减 ${roundMoney(
        summary.decreaseAmount,
      )} 元，待来源复核 ${summary.sourceReviewCount} 项。`,
    ],
    [
      `变更构成: 增项 ${summary.markCounts.add} 项、删项 ${summary.markCounts.delete} 项、修改 ${summary.markCounts.modify} 项、临项 ${summary.markCounts.temporary} 项。`,
    ],
  ];
}

const sheetBuilders: Record<
  string,
  (input: CostReportExportInput) => CostReportExportCell[][]
> = {
  分部分项工程量清单与计价表: buildBoqSheetRows,
  单位工程费用汇总表: buildUnitSummaryRows,
  项目审核认证单: buildCertificationRows,
  增减分析表: buildDeltaAnalysisRows,
  审核报告: buildReviewConclusionRows,
};

export function buildCostReportExportWorkbook(
  input: CostReportExportInput,
): CostReportExportWorkbook {
  const context: CostReportDesignContext = {
    projectName: input.dashboard.project.projectName,
    unitProjectName:
      input.dashboard.project.treeNodes.find(
        (node) => node.nodeType === "unit_project",
      )?.name ?? "",
    reviewer: input.metadata.reviewer,
    date: input.exportDate,
    pageNumber: input.scheme.exportSettings.startPage,
    totalPages:
      input.scheme.exportSettings.totalPages ??
      input.scheme.reportNames.length + 1,
  };
  const preview = buildReportDesignPreview(input.design, context);

  const sheets: CostReportExportSheet[] = [
    {
      name: "报表清单",
      rows: decorateSheet(buildSchemeOverviewRows(input), input, preview),
    },
  ];
  input.scheme.reportNames.forEach((reportName, index) => {
    const builder = sheetBuilders[reportName] ?? buildReviewConclusionRows;
    sheets.push({
      name: sanitizeSheetName(reportName, index + 1),
      rows: decorateSheet(builder(input), input, preview),
    });
  });

  return {
    fileName: `[审核]${input.dashboard.project.projectName}-报表.xlsx`,
    sheets,
    watermarkLabel: preview.watermarkLabel,
    headerLine: preview.headerLine,
    footerLine: preview.footerLine,
    designIssues: preview.issues,
  };
}

export function buildCostReportWordHtml(
  workbook: CostReportExportWorkbook,
): string {
  const escapeHtml = (value: CostReportExportCell): string =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const sections = workbook.sheets
    .map((sheet) => {
      const rows = sheet.rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
        )
        .join("");
      return `<h2>${escapeHtml(sheet.name)}</h2><table border="1" cellspacing="0" cellpadding="4">${rows}</table>`;
    })
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(
    workbook.fileName,
  )}</title></head><body>${sections}</body></html>`;
}
