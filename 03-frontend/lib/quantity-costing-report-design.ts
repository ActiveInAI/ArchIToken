// lib/quantity-costing-report-design.ts
// License: Apache-2.0
// 计量造价报表设计器内核（对标 GCCP7.0 手册 2.10.2 报表设计）：
// 简便设计（页眉页脚/标题表眉样式/表头列设置）、文字与图片两种形式水印、
// 统一替换到单位工程、临时编辑（非破坏性单元格修改）。
// 超越点：页眉页脚支持变量占位符；设计可序列化落库 cost_report_templates.content。
import type {
  CostReviewReportSection,
  QuantityCostingProject,
} from "./quantity-costing";

export type CostReportWatermarkMode = "none" | "text" | "image";

export interface CostReportWatermark {
  mode: CostReportWatermarkMode;
  text: string;
  imageRef: string;
  opacityPct: number; // 10-100
  showOnPrint: boolean;
  showOnExport: boolean;
}

export interface CostReportTextStyle {
  fontFamily: string;
  fontSizePt: number; // 6-72
  bold: boolean;
  align: "left" | "center" | "right";
}

export interface CostReportHeaderFooter {
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
}

export interface CostReportColumnSetting {
  columnId: string;
  label: string;
  visible: boolean;
}

export interface CostReportSimpleDesign {
  designId: string;
  headerFooter: CostReportHeaderFooter;
  titleStyle: CostReportTextStyle;
  tableHeadStyle: CostReportTextStyle;
  columns: CostReportColumnSetting[];
  watermark: CostReportWatermark;
  updatedAt: string;
}

export interface CostReportDesignContext {
  projectName: string;
  unitProjectName: string;
  reviewer: string;
  date: string;
  pageNumber: number;
  totalPages: number;
}

export interface CostReportDesignPreview {
  headerLine: string;
  footerLine: string;
  titleSample: string;
  visibleColumnLabels: string[];
  watermarkLabel: string;
  issues: string[];
}

export interface CostReportDesignApplicationPlan {
  designId: string;
  targetNodeIds: string[];
  skippedNodeIds: string[];
  appliedCount: number;
  outputState: "professional_review_required";
}

export interface CostReportTempEdit {
  sectionId: string;
  rowIndex: number;
  field: string;
  value: string | number;
}

export interface CostReportTempEditResult {
  sections: CostReviewReportSection[];
  appliedCount: number;
  skippedCount: number;
}

const FONT_SIZE_MIN = 6;
const FONT_SIZE_MAX = 72;
const OPACITY_MIN = 10;
const OPACITY_MAX = 100;

export const COST_REPORT_DESIGN_TEMPLATE_KIND = "report_simple_design";
export const COST_REPORT_DESIGN_TEMPLATE_VERSION = 1;

export const costReportDefaultColumns: CostReportColumnSetting[] = [
  { columnId: "seq", label: "序号", visible: true },
  { columnId: "report_name", label: "报表名称", visible: true },
  { columnId: "data_source", label: "数据来源", visible: true },
  { columnId: "status", label: "状态", visible: true },
  { columnId: "submitted_total", label: "送审合计", visible: true },
  { columnId: "approved_total", label: "审定合计", visible: true },
  { columnId: "amount_delta", label: "增减金额", visible: true },
];

export function createDefaultReportDesign(
  now = new Date().toISOString(),
): CostReportSimpleDesign {
  return {
    designId: "system-report-simple-design",
    headerFooter: {
      headerLeft: "{项目名称}",
      headerCenter: "审核报表",
      headerRight: "{日期}",
      footerLeft: "审核人：{审核人}",
      footerCenter: "",
      footerRight: "第 {页码} 页 / 共 {总页数} 页",
    },
    titleStyle: { fontFamily: "仿宋", fontSizePt: 16, bold: true, align: "center" },
    tableHeadStyle: { fontFamily: "仿宋", fontSizePt: 10, bold: true, align: "center" },
    columns: costReportDefaultColumns.map((column) => ({ ...column })),
    watermark: {
      mode: "text",
      text: "ArchIToken 专业复核后使用",
      imageRef: "",
      opacityPct: 30,
      showOnPrint: true,
      showOnExport: true,
    },
    updatedAt: now,
  };
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

function normalizeTextStyle(style: CostReportTextStyle): CostReportTextStyle {
  return { ...style, fontSizePt: clamp(style.fontSizePt, FONT_SIZE_MIN, FONT_SIZE_MAX) };
}

export interface CostReportDesignPatch {
  headerFooter?: Partial<CostReportHeaderFooter>;
  titleStyle?: Partial<CostReportTextStyle>;
  tableHeadStyle?: Partial<CostReportTextStyle>;
  watermark?: Partial<CostReportWatermark>;
}

/** 简便设计：合并补丁并钳制字号/不透明度，超出范围静默归位而不是报错。 */
export function updateReportSimpleDesign(
  design: CostReportSimpleDesign,
  patch: CostReportDesignPatch,
  now = new Date().toISOString(),
): CostReportSimpleDesign {
  const watermark = { ...design.watermark, ...patch.watermark };
  return {
    ...design,
    headerFooter: { ...design.headerFooter, ...patch.headerFooter },
    titleStyle: normalizeTextStyle({ ...design.titleStyle, ...patch.titleStyle }),
    tableHeadStyle: normalizeTextStyle({ ...design.tableHeadStyle, ...patch.tableHeadStyle }),
    watermark: { ...watermark, opacityPct: clamp(watermark.opacityPct, OPACITY_MIN, OPACITY_MAX) },
    updatedAt: now,
  };
}

export function setReportColumnVisible(
  design: CostReportSimpleDesign,
  columnId: string,
  visible: boolean,
  now = new Date().toISOString(),
): CostReportSimpleDesign {
  return {
    ...design,
    columns: design.columns.map((column) =>
      column.columnId === columnId ? { ...column, visible } : column,
    ),
    updatedAt: now,
  };
}

/** 页眉页脚变量占位符解析；未知占位符原样保留，便于发现拼写错误。 */
export function resolveReportSlotText(
  slot: string,
  context: CostReportDesignContext,
): string {
  const variables: Record<string, string> = {
    项目名称: context.projectName,
    单位工程: context.unitProjectName,
    审核人: context.reviewer,
    日期: context.date,
    页码: String(context.pageNumber),
    总页数: String(context.totalPages),
  };
  return slot.replace(/\{([^{}]+)\}/g, (raw, name: string) => variables[name] ?? raw);
}

export function validateReportDesign(design: CostReportSimpleDesign): string[] {
  const issues: string[] = [];
  if (design.watermark.mode === "image" && !design.watermark.imageRef) {
    issues.push("图片水印未指定图片，导出时将退化为无水印。");
  }
  if (!design.columns.some((column) => column.visible)) {
    issues.push("报表内容没有任何可见列，导出结果将为空表。");
  }
  return issues;
}

export function describeReportWatermark(watermark: CostReportWatermark): string {
  if (watermark.mode === "none") return "无水印";
  if (watermark.mode === "image") {
    return watermark.imageRef
      ? `图片水印 ${watermark.imageRef} · 不透明度 ${watermark.opacityPct}%`
      : "图片水印（未选图）";
  }
  return `文字水印「${watermark.text}」 · 不透明度 ${watermark.opacityPct}%`;
}

/** 实时预览：解析变量后的页眉/页脚行、标题样例与可见列，供编辑区右侧实时查看效果。 */
export function buildReportDesignPreview(
  design: CostReportSimpleDesign,
  context: CostReportDesignContext,
): CostReportDesignPreview {
  const resolve = (slot: string) => resolveReportSlotText(slot, context);
  const headerLine = [
    resolve(design.headerFooter.headerLeft),
    resolve(design.headerFooter.headerCenter),
    resolve(design.headerFooter.headerRight),
  ]
    .filter(Boolean)
    .join(" | ");
  const footerLine = [
    resolve(design.headerFooter.footerLeft),
    resolve(design.headerFooter.footerCenter),
    resolve(design.headerFooter.footerRight),
  ]
    .filter(Boolean)
    .join(" | ");
  return {
    headerLine,
    footerLine,
    titleSample: `${design.titleStyle.fontFamily} ${design.titleStyle.fontSizePt}pt${design.titleStyle.bold ? " 加粗" : ""} ${design.titleStyle.align}`,
    visibleColumnLabels: design.columns
      .filter((column) => column.visible)
      .map((column) => column.label),
    watermarkLabel: describeReportWatermark(design.watermark),
    issues: validateReportDesign(design),
  };
}

/** 统一替换（手册 2.10.2 操作二）：把当前设计应用到勾选的单位工程，非单位工程节点跳过。 */
export function applyDesignToUnitProjects(
  project: QuantityCostingProject,
  design: CostReportSimpleDesign,
  targetNodeIds?: string[],
): CostReportDesignApplicationPlan {
  const unitProjectIds = new Set(
    project.treeNodes
      .filter((node) => node.nodeType === "unit_project")
      .map((node) => node.nodeId),
  );
  const requested = targetNodeIds?.length ? targetNodeIds : [...unitProjectIds];
  const targetIds = requested.filter((nodeId) => unitProjectIds.has(nodeId));
  const skippedNodeIds = requested.filter((nodeId) => !unitProjectIds.has(nodeId));
  return {
    designId: design.designId,
    targetNodeIds: targetIds,
    skippedNodeIds,
    appliedCount: targetIds.length,
    outputState: "professional_review_required",
  };
}

/** 临时编辑（手册 2.10.2 使用技巧 2）：非破坏性地套用单元格修改，原 sections 不动。 */
export function applyTemporaryReportEdits(
  sections: CostReviewReportSection[],
  edits: CostReportTempEdit[],
): CostReportTempEditResult {
  const next = sections.map((section) => ({
    ...section,
    rows: section.rows.map((row) => ({ ...row })),
  }));
  let appliedCount = 0;
  let skippedCount = 0;
  for (const edit of edits) {
    const section = next.find((candidate) => candidate.sectionId === edit.sectionId);
    const row = section?.rows[edit.rowIndex];
    if (!row || !(edit.field in row)) {
      skippedCount += 1;
      continue;
    }
    row[edit.field] = edit.value;
    appliedCount += 1;
  }
  return { sections: next, appliedCount, skippedCount };
}

/** 序列化为 cost_report_templates.content（JSONB）形态。 */
export function serializeReportDesignTemplate(design: CostReportSimpleDesign): {
  version: number;
  kind: string;
  design: CostReportSimpleDesign;
} {
  return {
    version: COST_REPORT_DESIGN_TEMPLATE_VERSION,
    kind: COST_REPORT_DESIGN_TEMPLATE_KIND,
    design,
  };
}

/** 从模板 content 还原设计；结构不符时返回 null，字段缺失回退默认值（容忍旧版本）。 */
export function parseReportDesignTemplate(
  content: unknown,
  now = new Date().toISOString(),
): CostReportSimpleDesign | null {
  if (typeof content !== "object" || content === null) return null;
  const candidate = content as { kind?: unknown; design?: unknown };
  if (candidate.kind !== COST_REPORT_DESIGN_TEMPLATE_KIND) return null;
  if (typeof candidate.design !== "object" || candidate.design === null) return null;
  const raw = candidate.design as Partial<CostReportSimpleDesign>;
  const fallback = createDefaultReportDesign(now);
  const patch: CostReportDesignPatch = {};
  if (raw.headerFooter && typeof raw.headerFooter === "object") {
    patch.headerFooter = raw.headerFooter;
  }
  if (raw.titleStyle && typeof raw.titleStyle === "object") {
    patch.titleStyle = raw.titleStyle;
  }
  if (raw.tableHeadStyle && typeof raw.tableHeadStyle === "object") {
    patch.tableHeadStyle = raw.tableHeadStyle;
  }
  if (raw.watermark && typeof raw.watermark === "object") {
    patch.watermark = raw.watermark;
  }
  return updateReportSimpleDesign(
    {
      ...fallback,
      designId: typeof raw.designId === "string" ? raw.designId : fallback.designId,
      columns: Array.isArray(raw.columns)
        ? raw.columns
            .filter(
              (column): column is CostReportColumnSetting =>
                typeof column === "object" &&
                column !== null &&
                typeof (column as CostReportColumnSetting).columnId === "string",
            )
            .map((column) => ({
              columnId: column.columnId,
              label: typeof column.label === "string" ? column.label : column.columnId,
              visible: column.visible !== false,
            }))
        : fallback.columns,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : fallback.updatedAt,
    },
    patch,
    typeof raw.updatedAt === "string" ? raw.updatedAt : now,
  );
}
