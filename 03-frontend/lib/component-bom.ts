// lib/component-bom.ts - Component material BOM import workflow model
// License: Apache-2.0

export type ComponentBomReviewState =
  | "not_imported"
  | "source_imported"
  | "validated"
  | "professional_review_required"
  | "submitted_for_review"
  | "approved"
  | "published"
  | "exported"
  | "blocked";

export type ComponentBomIssueSeverity = "error" | "warning" | "info";

export interface ComponentBomSourceWorkbook {
  key: "sjg157" | "namingRule" | "bom";
  name: string;
  path: string;
  primarySheet: string;
  expectedRows: number;
  schema: string;
}

export interface ComponentBomLine {
  lineNo: number;
  sourceSheet: string;
  sourceRow: number;
  sourceRange: string;
  categoryName: string;
  categoryCode: string;
  componentName: string;
  sectionSize: string;
  lengthMm: number;
  positionRef: string;
  materialGrade: string;
  specification: string;
  drawingNo: string;
  floorLevel: string;
  unit: string;
  setQuantity: number;
  totalQuantity: number;
  unitWeightKg: number | null;
  totalWeightKg: number | null;
  remark: string;
  reviewState: "professional_review_required";
  weightState: "provided" | "missing_in_source";
}

export interface ComponentBomValidationIssue {
  id: string;
  severity: ComponentBomIssueSeverity;
  code: string;
  message: string;
  lineNo: number;
  componentName: string;
  categoryCode: string;
  source: {
    path: string;
    sheet: string;
    row: number;
    column: string;
    range: string;
  };
}

export interface ComponentBomSummary {
  sourceSheet: string;
  workbookDimension: string;
  lineCount: number;
  totalQuantity: number;
  totalWeightKg: number;
  sourceTotalRow: number;
  sourceTotalQuantity: number;
  sourceTotalWeightKg: number;
}

export interface ComponentBomImportManifest {
  schema: "architoken.component_bom_import_manifest.v1";
  moduleId: "detailed_design";
  adapter: "component_bom";
  workerOperation: "component_bom_import";
  reviewState: ComponentBomReviewState;
  validationState: ComponentBomReviewState;
  sourceFiles: typeof componentBomSourceWorkbooks;
  counts: {
    sjg157Categories: number;
    namingRules: number;
    bomLines: number;
    categoryReferences: number;
    validationErrors: number;
    validationWarnings: number;
    validationIssues: number;
  };
  summary: ComponentBomSummary;
  lines: ComponentBomLine[];
  issues: ComponentBomValidationIssue[];
}

export interface ComponentBomWorkflowState {
  manifest: ComponentBomImportManifest;
  workflowState: ComponentBomReviewState;
  lastMessage: string;
  auditTrail: string[];
  exportPayload?: ComponentBomExportPayload | undefined;
  blockedReason?: string | undefined;
}

export type ComponentBomWorkflowAction =
  | "import_sources"
  | "validate"
  | "submit_review"
  | "approve"
  | "publish"
  | "export";

export interface ComponentBomExportPayload {
  schema: "architoken.component_bom_export_payload.v1";
  generatedAt: string;
  reviewState: ComponentBomReviewState;
  sourcePaths: string[];
  lineCount: number;
  totalQuantity: number;
  totalWeightKg: number;
  validationWarnings: number;
  validationErrors: number;
}

export const componentBomSourceWorkbooks = {
  sjg157: {
    key: "sjg157",
    name: "建筑工程信息模型语义字典编码表_SJG157-2024.xlsx",
    path: "标准库/SJG157-2024-语义字典编码表.xlsx",
    primarySheet: "全部类目索引",
    expectedRows: 5678,
    schema: "architoken.sjg157_category.v1",
  },
  namingRule: {
    key: "namingRule",
    name: "装配式钢结构建筑构件标准化命名规则V1.0.xlsx",
    path: "标准库/装配式钢结构构件标准化命名规则V1.0.xlsx",
    primarySheet: "主体/围护/机电/紧固件/连接件/楼梯/版本号",
    expectedRows: 41,
    schema: "architoken.component_naming_rule.v1",
  },
  bom: {
    key: "bom",
    name: "（待导入）构件物料清单.xlsx",
    path: "（待导入）",
    primarySheet: "物料清单",
    expectedRows: 0,
    schema: "architoken.component_bom_line.v1",
  },
} as const satisfies Record<string, ComponentBomSourceWorkbook>;

export const componentBomSummary: ComponentBomSummary = {
  sourceSheet: "物料清单",
  workbookDimension: "A1:Q26",
  lineCount: 14,
  totalQuantity: 470,
  totalWeightKg: 0,
  sourceTotalRow: 21,
  sourceTotalQuantity: 470,
  sourceTotalWeightKg: 0,
};

export const componentBomLines: ComponentBomLine[] = [
  {
    lineNo: 1,
    sourceSheet: "物料清单",
    sourceRow: 6,
    sourceRange: "A6:Q6",
    categoryName: "铜管",
    categoryCode: "30-03.70.20",
    componentName: "Column_Main_H150X150X7X10_L5694_F1立柱_V0",
    sectionSize: "150X150X7X10",
    lengthMm: 5475,
    positionRef: "F1立柱",
    materialGrade: "Q355D",
    specification: "H150X150X7X10_L5694",
    drawingNo: "10118058",
    floorLevel: "1",
    unit: "PCS",
    setQuantity: 4,
    totalQuantity: 4,
    unitWeightKg: null,
    totalWeightKg: null,
    remark: "",
    reviewState: "professional_review_required",
    weightState: "missing_in_source",
  },
  {
    lineNo: 2,
    sourceSheet: "物料清单",
    sourceRow: 7,
    sourceRange: "A7:Q7",
    categoryName: "焊接H型钢柱",
    categoryCode: "30-03.95.03.15",
    componentName: "Column_Main_H200X200X8X12_L4200_F1_V0",
    sectionSize: "200X200X8X12",
    lengthMm: 4200,
    positionRef: "F1",
    materialGrade: "Q355D",
    specification: "H200X200X8X12_L4200",
    drawingNo: "10118059",
    floorLevel: "1",
    unit: "PCS",
    setQuantity: 6,
    totalQuantity: 6,
    unitWeightKg: null,
    totalWeightKg: null,
    remark: "",
    reviewState: "professional_review_required",
    weightState: "missing_in_source",
  },
  {
    lineNo: 3,
    sourceSheet: "物料清单",
    sourceRow: 8,
    sourceRange: "A8:Q8",
    categoryName: "焊接H型钢柱",
    categoryCode: "30-03.95.03.15",
    componentName: "Column_Main_H250X250X9X14_L4200_F2_V0",
    sectionSize: "250X250X9X14",
    lengthMm: 4200,
    positionRef: "F2",
    materialGrade: "Q355D",
    specification: "H250X250X9X14_L4200",
    drawingNo: "10118060",
    floorLevel: "2",
    unit: "PCS",
    setQuantity: 8,
    totalQuantity: 8,
    unitWeightKg: null,
    totalWeightKg: null,
    remark: "",
    reviewState: "professional_review_required",
    weightState: "missing_in_source",
  },
  {
    lineNo: 4,
    sourceSheet: "物料清单",
    sourceRow: 9,
    sourceRange: "A9:Q9",
    categoryName: "目字形钢柱",
    categoryCode: "30-03.95.03.40",
    componentName: "Beam_Main_H194X150X6.5X9_L6200_F1_V0",
    sectionSize: "194X150X6.5X9",
    lengthMm: 6200,
    positionRef: "F1",
    materialGrade: "Q355D",
    specification: "H194X150X6.5X9_L6200",
    drawingNo: "20118061",
    floorLevel: "1",
    unit: "PCS",
    setQuantity: 12,
    totalQuantity: 12,
    unitWeightKg: null,
    totalWeightKg: null,
    remark: "",
    reviewState: "professional_review_required",
    weightState: "missing_in_source",
  },
  {
    lineNo: 5,
    sourceSheet: "物料清单",
    sourceRow: 10,
    sourceRange: "A10:Q10",
    categoryName: "焊接H型钢梁",
    categoryCode: "30-03.95.09.15",
    componentName: "Beam_Sub_H150X100X5X7_L4500_F1_V0",
    sectionSize: "150X100X5X7",
    lengthMm: 4500,
    positionRef: "F1",
    materialGrade: "Q355D",
    specification: "H150X100X5X7_L4500",
    drawingNo: "20118062",
    floorLevel: "1",
    unit: "PCS",
    setQuantity: 10,
    totalQuantity: 10,
    unitWeightKg: null,
    totalWeightKg: null,
    remark: "",
    reviewState: "professional_review_required",
    weightState: "missing_in_source",
  },
  {
    lineNo: 6,
    sourceSheet: "物料清单",
    sourceRow: 11,
    sourceRange: "A11:Q11",
    categoryName: "目字形钢柱",
    categoryCode: "30-03.95.03.40",
    componentName: "Beam_Main_H300X150X6.5X9_L7500_F2_V0",
    sectionSize: "300X150X6.5X9",
    lengthMm: 7500,
    positionRef: "F2",
    materialGrade: "Q355D",
    specification: "H300X150X6.5X9_L7500",
    drawingNo: "20118063",
    floorLevel: "1",
    unit: "PCS",
    setQuantity: 6,
    totalQuantity: 6,
    unitWeightKg: null,
    totalWeightKg: null,
    remark: "",
    reviewState: "professional_review_required",
    weightState: "missing_in_source",
  },
  {
    lineNo: 7,
    sourceSheet: "物料清单",
    sourceRow: 12,
    sourceRange: "A12:Q12",
    categoryName: "C型钢檩条",
    categoryCode: "30-03.95.33.20.15",
    componentName: "Purlin_Roof_C180X70X20X2.5_L6000_V0",
    sectionSize: "C180X70X20X2.5",
    lengthMm: 6000,
    positionRef: "Roof",
    materialGrade: "Q235B",
    specification: "C180x70x20x2.5_L6000",
    drawingNo: "30118064",
    floorLevel: "1",
    unit: "PCS",
    setQuantity: 30,
    totalQuantity: 30,
    unitWeightKg: null,
    totalWeightKg: null,
    remark: "",
    reviewState: "professional_review_required",
    weightState: "missing_in_source",
  },
  {
    lineNo: 8,
    sourceSheet: "物料清单",
    sourceRow: 13,
    sourceRange: "A13:Q13",
    categoryName: "C型钢檩条",
    categoryCode: "30-03.95.33.20.15",
    componentName: "Purlin_Wall_C180X70X20X2.5_L5500_V0",
    sectionSize: "C180X70X20X2.5",
    lengthMm: 5500,
    positionRef: "Wall",
    materialGrade: "Q235B",
    specification: "C180x70x20x2.5_L5500",
    drawingNo: "30118065",
    floorLevel: "1",
    unit: "PCS",
    setQuantity: 25,
    totalQuantity: 25,
    unitWeightKg: null,
    totalWeightKg: null,
    remark: "",
    reviewState: "professional_review_required",
    weightState: "missing_in_source",
  },
  {
    lineNo: 9,
    sourceSheet: "物料清单",
    sourceRow: 14,
    sourceRange: "A14:Q14",
    categoryName: "钢拉条",
    categoryCode: "30-03.95.33.30",
    componentName: "Connect_TieRod_D12_L1200_F1_V0",
    sectionSize: "D12",
    lengthMm: 1200,
    positionRef: "F1",
    materialGrade: "Q235B",
    specification: "D12_L1200",
    drawingNo: "40118066",
    floorLevel: "1",
    unit: "SET",
    setQuantity: 48,
    totalQuantity: 48,
    unitWeightKg: null,
    totalWeightKg: null,
    remark: "",
    reviewState: "professional_review_required",
    weightState: "missing_in_source",
  },
  {
    lineNo: 10,
    sourceSheet: "物料清单",
    sourceRow: 15,
    sourceRange: "A15:Q15",
    categoryName: "钢拉条",
    categoryCode: "30-03.95.33.30",
    componentName: "Connect_KneeBrace_L50X50X5_L600_F1_V0",
    sectionSize: "L50X50X5",
    lengthMm: 600,
    positionRef: "F1",
    materialGrade: "Q235B",
    specification: "L50x50x5_L600",
    drawingNo: "50118067",
    floorLevel: "1",
    unit: "SET",
    setQuantity: 32,
    totalQuantity: 32,
    unitWeightKg: null,
    totalWeightKg: null,
    remark: "",
    reviewState: "professional_review_required",
    weightState: "missing_in_source",
  },
  {
    lineNo: 11,
    sourceSheet: "物料清单",
    sourceRow: 16,
    sourceRange: "A16:Q16",
    categoryName: "箱型钢柱",
    categoryCode: "30-03.95.03.10",
    componentName: "Column_Main_S200X200X8X12_H3600_F1_V0",
    sectionSize: "S200X200X8X12",
    lengthMm: 3600,
    positionRef: "F1",
    materialGrade: "Q355D",
    specification: "S200x200x8x12_H3600",
    drawingNo: "10118068",
    floorLevel: "1",
    unit: "PCS",
    setQuantity: 5,
    totalQuantity: 5,
    unitWeightKg: null,
    totalWeightKg: null,
    remark: "",
    reviewState: "professional_review_required",
    weightState: "missing_in_source",
  },
  {
    lineNo: 12,
    sourceSheet: "物料清单",
    sourceRow: 17,
    sourceRange: "A17:Q17",
    categoryName: "螺栓",
    categoryCode: "30-03.95.42.20.10",
    componentName: "Fastener_HighStr_M20_L80_V0",
    sectionSize: "M20",
    lengthMm: 80,
    positionRef: "全楼",
    materialGrade: "10.9S",
    specification: "M20_L80",
    drawingNo: "60118069",
    floorLevel: "1",
    unit: "SET",
    setQuantity: 200,
    totalQuantity: 200,
    unitWeightKg: null,
    totalWeightKg: null,
    remark: "",
    reviewState: "professional_review_required",
    weightState: "missing_in_source",
  },
  {
    lineNo: 13,
    sourceSheet: "物料清单",
    sourceRow: 18,
    sourceRange: "A18:Q18",
    categoryName: "钢结构锚栓",
    categoryCode: "30-03.95.42.20.20",
    componentName: "Fastener_Anchor_M24_L400_V0",
    sectionSize: "M24",
    lengthMm: 400,
    positionRef: "F0",
    materialGrade: "Q355D",
    specification: "M24_L400",
    drawingNo: "60118070",
    floorLevel: "1",
    unit: "SET",
    setQuantity: 64,
    totalQuantity: 64,
    unitWeightKg: null,
    totalWeightKg: null,
    remark: "",
    reviewState: "professional_review_required",
    weightState: "missing_in_source",
  },
  {
    lineNo: 14,
    sourceSheet: "物料清单",
    sourceRow: 19,
    sourceRange: "A19:Q19",
    categoryName: "镀锌钢板",
    categoryCode: "30-03.40.10.20",
    componentName: "Plate_Galv_T6_L3000XW1500_F1_V0",
    sectionSize: "T6",
    lengthMm: 3000,
    positionRef: "F1",
    materialGrade: "",
    specification: "T6_3000x1500",
    drawingNo: "70118071",
    floorLevel: "1",
    unit: "PCS",
    setQuantity: 20,
    totalQuantity: 20,
    unitWeightKg: null,
    totalWeightKg: null,
    remark: "",
    reviewState: "professional_review_required",
    weightState: "missing_in_source",
  },
];

// 内置兜底前缀白名单。运行时优先采用 component_bom_naming_rules 表导入的
// 真源前缀（见 lib/component-naming-rules.ts），二者已 1:1 对齐；DB 不可达时回退到此。
export const DEFAULT_NAMING_PREFIXES: ReadonlySet<string> = new Set([
  "Beam",
  "Column",
  "Purlin",
  "Gutter",
  "FixPart",
  "Mech",
  "Bath",
  "Fastener",
  "Connect",
  "StairBeam",
  "StairTread",
  "StairHandrail",
  "StairGlass",
  "StairPost",
  "StairPlatform",
]);

const lengthTokenPattern = /(?:^|_)L(?<length>\d+(?:\.\d+)?)(?:_|$)/i;

export function createComponentBomValidationIssues(
  lines: ComponentBomLine[],
  options: { allowedPrefixes?: ReadonlySet<string> } = {},
): ComponentBomValidationIssue[] {
  const allowedPrefixes =
    options.allowedPrefixes && options.allowedPrefixes.size > 0
      ? options.allowedPrefixes
      : DEFAULT_NAMING_PREFIXES;
  const issues: ComponentBomValidationIssue[] = [];
  for (const line of lines) {
    const prefix = line.componentName.includes("_")
      ? (line.componentName.split("_", 1)[0] ?? "")
      : line.componentName;
    const source = {
      path: componentBomSourceWorkbooks.bom.path,
      sheet: line.sourceSheet,
      row: line.sourceRow,
      range: line.sourceRange,
    };

    if (prefix && !allowedPrefixes.has(prefix)) {
      issues.push({
        id: `line-${line.lineNo}-naming-prefix-not-in-rulebook`,
        severity: "warning",
        code: "naming_prefix_not_in_rulebook",
        message: `命名前缀 ${prefix} 未在命名规则表中声明`,
        lineNo: line.lineNo,
        componentName: line.componentName,
        categoryCode: line.categoryCode,
        source: { ...source, column: "D" },
      });
    }

    if (prefixCategoryConflict(prefix, line.categoryName)) {
      issues.push({
        id: `line-${line.lineNo}-component-prefix-category-conflict`,
        severity: "warning",
        code: "component_prefix_category_conflict",
        message: `命名前缀 ${prefix} 与类目 ${line.categoryName} 不一致`,
        lineNo: line.lineNo,
        componentName: line.componentName,
        categoryCode: line.categoryCode,
        source: { ...source, column: "B:D" },
      });
    }

    const lengthToken = extractLengthToken(line.componentName) ?? extractLengthToken(line.specification);
    if (lengthToken !== null && Math.abs(lengthToken - line.lengthMm) > 0.001) {
      issues.push({
        id: `line-${line.lineNo}-length-token-source-mismatch`,
        severity: "warning",
        code: "length_token_source_mismatch",
        message: `名称/规格长度 L${formatNumber(lengthToken)} 与源表长度 ${formatNumber(line.lengthMm)} 不一致`,
        lineNo: line.lineNo,
        componentName: line.componentName,
        categoryCode: line.categoryCode,
        source: { ...source, column: "D:F" },
      });
    }

    if (line.weightState === "missing_in_source") {
      issues.push({
        id: `line-${line.lineNo}-weight-missing-in-source`,
        severity: "warning",
        code: "weight_missing_in_source",
        message: "源表重量列为空，系统不自动伪造重量",
        lineNo: line.lineNo,
        componentName: line.componentName,
        categoryCode: line.categoryCode,
        source: { ...source, column: "O:P" },
      });
    }
  }
  return issues;
}

export function summarizeComponentBomLines(lines: ComponentBomLine[]): ComponentBomSummary {
  return {
    ...componentBomSummary,
    lineCount: lines.length,
    totalQuantity: lines.reduce((sum, line) => sum + line.totalQuantity, 0),
    totalWeightKg: lines.reduce((sum, line) => sum + (line.totalWeightKg ?? 0), 0),
  };
}

export function createComponentBomImportManifest(
  lines: ComponentBomLine[] = componentBomLines,
): ComponentBomImportManifest {
  const issues = createComponentBomValidationIssues(lines);
  const validationErrors = issues.filter((issue) => issue.severity === "error").length;
  const validationWarnings = issues.filter((issue) => issue.severity === "warning").length;
  return {
    schema: "architoken.component_bom_import_manifest.v1",
    moduleId: "detailed_design",
    adapter: "component_bom",
    workerOperation: "component_bom_import",
    reviewState: "professional_review_required",
    validationState: validationErrors > 0 ? "blocked" : "professional_review_required",
    sourceFiles: componentBomSourceWorkbooks,
    counts: {
      sjg157Categories: componentBomSourceWorkbooks.sjg157.expectedRows,
      namingRules: componentBomSourceWorkbooks.namingRule.expectedRows,
      bomLines: lines.length,
      categoryReferences: new Set(lines.map((line) => line.categoryCode)).size,
      validationErrors,
      validationWarnings,
      validationIssues: issues.length,
    },
    summary: summarizeComponentBomLines(lines),
    lines: lines.map((line) => ({ ...line })),
    issues,
  };
}

export const componentBomAcceptanceFixture = createComponentBomImportManifest();

export function createComponentBomWorkflowState(): ComponentBomWorkflowState {
  // 初始为空:无真实导入时不展示 demo BOM。导入构件源表后填充真实清单。
  const manifest = createComponentBomImportManifest([]);
  return {
    manifest,
    workflowState: "professional_review_required",
    lastMessage: "暂无导入批次——导入构件 BOM 源表后形成待复核批次。",
    auditTrail: [],
  };
}

export function runComponentBomAction(
  state: ComponentBomWorkflowState,
  action: ComponentBomWorkflowAction,
  now = new Date(),
): ComponentBomWorkflowState {
  const stamp = now.toISOString();
  const audit = (message: string) => [...state.auditTrail, `${stamp}: ${message}`];

  if (action === "import_sources") {
    const manifest = createComponentBomImportManifest(state.manifest.lines);
    return {
      ...state,
      manifest,
      workflowState: "source_imported",
      lastMessage: "已导入三份源表并保留源行证据。",
      blockedReason: undefined,
      auditTrail: audit("import_sources"),
    };
  }

  if (action === "validate") {
    const manifest = createComponentBomImportManifest(state.manifest.lines);
    return {
      ...state,
      manifest,
      workflowState: manifest.counts.validationErrors > 0 ? "blocked" : "professional_review_required",
      lastMessage: `校验完成：${manifest.counts.validationErrors} 个错误，${manifest.counts.validationWarnings} 个警告。`,
      blockedReason:
        manifest.counts.validationErrors > 0
          ? "存在错误级校验问题，不能提交专业复核。"
          : undefined,
      auditTrail: audit("validate"),
    };
  }

  if (action === "submit_review") {
    if (state.manifest.counts.validationErrors > 0) {
      return {
        ...state,
        workflowState: "blocked",
        blockedReason: "存在错误级校验问题，不能提交专业复核。",
        lastMessage: "提交被阻止。",
        auditTrail: audit("submit_review_blocked"),
      };
    }
    return {
      ...state,
      workflowState: "submitted_for_review",
      lastMessage: "已提交专业复核，仍不可下游发布。",
      blockedReason: undefined,
      auditTrail: audit("submit_review"),
    };
  }

  if (action === "approve") {
    return {
      ...state,
      workflowState: "approved",
      lastMessage: "专业复核状态已记录为 approved。",
      blockedReason: undefined,
      auditTrail: audit("approve"),
    };
  }

  if (action === "publish") {
    if (state.workflowState !== "approved") {
      return {
        ...state,
        workflowState: "blocked",
        blockedReason: "BOM 未经专业批准，不能发布到采购、加工、施工或归档下游。",
        lastMessage: "发布被阻止。",
        auditTrail: audit("publish_blocked"),
      };
    }
    return {
      ...state,
      workflowState: "published",
      lastMessage: "已发布批准版 BOM 下游引用。",
      blockedReason: undefined,
      auditTrail: audit("publish"),
    };
  }

  const exportPayload = createComponentBomExportPayload(state.manifest, state.workflowState, now);
  return {
    ...state,
    workflowState: "exported",
    exportPayload,
    lastMessage: "已生成导出 payload。",
    blockedReason: undefined,
    auditTrail: audit("export"),
  };
}

export function createComponentBomExportPayload(
  manifest: ComponentBomImportManifest,
  reviewState: ComponentBomReviewState,
  now = new Date(),
): ComponentBomExportPayload {
  return {
    schema: "architoken.component_bom_export_payload.v1",
    generatedAt: now.toISOString(),
    reviewState,
    sourcePaths: Object.values(manifest.sourceFiles).map((source) => source.path),
    lineCount: manifest.counts.bomLines,
    totalQuantity: manifest.summary.totalQuantity,
    totalWeightKg: manifest.summary.totalWeightKg,
    validationWarnings: manifest.counts.validationWarnings,
    validationErrors: manifest.counts.validationErrors,
  };
}

export function issuesForLine(
  issues: ComponentBomValidationIssue[],
  lineNo: number,
): ComponentBomValidationIssue[] {
  return issues.filter((issue) => issue.lineNo === lineNo);
}

function prefixCategoryConflict(prefix: string, categoryName: string): boolean {
  const expectedTerms: Record<string, string[]> = {
    Column: ["柱"],
    Beam: ["梁"],
    Purlin: ["檩"],
    Fastener: ["螺", "栓", "锚"],
    Plate: ["板"],
    Gutter: ["沟"],
  };
  const terms = expectedTerms[prefix];
  return Boolean(terms && !terms.some((term) => categoryName.includes(term)));
}

function extractLengthToken(value: string): number | null {
  const match = lengthTokenPattern.exec(value);
  if (!match?.groups?.length) return null;
  const parsed = Number(match.groups.length);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
