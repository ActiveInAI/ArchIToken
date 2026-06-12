// lib/quantity-costing.ts - Quantity costing review workflow kernel
// License: Apache-2.0

export type CostProjectNodeType =
  | "project"
  | "single_project"
  | "unit_project"
  | "specialty";

export type CostVersionType =
  | "estimate"
  | "budget"
  | "progress_measurement"
  | "settlement"
  | "review";

export type CostVersionStatus =
  | "draft"
  | "submitted"
  | "reviewing"
  | "approved"
  | "archived";

export type CostChangeMark = "none" | "add" | "delete" | "modify" | "temporary";

export type CostDataConversionDirection =
  | "submitted_to_approved"
  | "approved_to_submitted";

export type CostProjectMatchRule =
  | "name"
  | "specialty"
  | "standardProfile"
  | "quotaLibrary";

export type CostProjectMatchAction = "match" | "add" | "replace" | "skip";

export type CostProjectMatchStatus =
  | "auto_matched"
  | "manual_required"
  | "unmatched"
  | "ignored";

export type CostImportSourceType =
  | "budget_gbq7"
  | "budget_gbq6"
  | "budget_qbq5"
  | "review_gbq7";

export type CostIncreaseStrategyType = "code" | "fee_code" | "constant";

export type CostNumericField =
  | "submittedTotal"
  | "approvedTotal"
  | "amountDelta"
  | "qtyDelta"
  | "unitPriceDelta"
  | "amountDeltaRatio";

export type CostNumericOperator = "abs_gte" | "gte" | "lte";

export type CostAnalysisSelectionMode =
  | "top_delta_share"
  | "delta_rank"
  | "absolute_delta"
  | "delta_ratio";

export type CostAnalysisExpandLevel = "single_project" | "unit_project" | "fee";

export type CostSourceStatus = "active" | "source_pending" | "retired";

export type CostResourceType = "labor" | "material" | "machine";

export type CostComponentType =
  | CostResourceType
  | "management"
  | "profit"
  | "risk"
  | "fee"
  | "tax";

export type CostMeasureType = "organization" | "technical";

export type CostOtherItemType =
  | "provisional_sum"
  | "daywork"
  | "general_contract_service";

export interface CostProjectTreeNode {
  nodeId: string;
  projectId: string;
  parentId: string | null;
  nodeType: CostProjectNodeType;
  name: string;
  specialty: string;
  sortOrder: number;
  standardProfileId: string;
  quotaLibraryId: string;
  auditState: "draft" | "reviewing" | "approved" | "archived";
}

export interface QuantityCostingVersion {
  versionId: string;
  projectId: string;
  versionType: CostVersionType;
  reviewRound: number;
  submittedVersionId: string | null;
  approvedVersionId: string | null;
  description: string;
  status: CostVersionStatus;
  createdBy: string;
  createdAt: string;
  sourceFileIds: string[];
  auditEventIds: string[];
}

export interface CostProjectImportMatchRow {
  rowId: string;
  currentNodeId: string | null;
  importNodeId: string;
  currentName: string | null;
  importName: string;
  action: CostProjectMatchAction;
  status: CostProjectMatchStatus;
  confidence: number;
  ruleHits: CostProjectMatchRule[];
}

export interface CostProjectImportPlan {
  sourceType: CostImportSourceType;
  rules: CostProjectMatchRule[];
  rows: CostProjectImportMatchRow[];
  autoMatchedCount: number;
  manualRequiredCount: number;
  readyToImport: boolean;
}

export interface QuantityCostingBoqItem {
  itemId: string;
  projectId: string;
  nodeId: string;
  submittedCode: string;
  approvedCode: string;
  submittedName: string;
  approvedName: string;
  submittedFeature: string;
  approvedFeature: string;
  unit: string;
  submittedQty: number;
  approvedQty: number;
  submittedUnitPrice: number;
  approvedUnitPrice: number;
  sourceRef: string;
  ruleId: string;
  elementId?: string;
  manualReviewRequired?: boolean;
  manualChangeReason?: string;
  temporary?: boolean;
}

export interface ComputedCostBoqItem extends QuantityCostingBoqItem {
  displayCode: string;
  displayName: string;
  qtyDelta: number;
  unitPriceDelta: number;
  submittedTotal: number;
  approvedTotal: number;
  amountDelta: number;
  amountDeltaRatio: number;
  increaseAmount: number;
  decreaseAmount: number;
  changeMark: CostChangeMark;
  autoChangeReason: string;
  changeReason: string;
  sourceReviewRequired: boolean;
}

export interface QuantityCostingProject {
  projectId: string;
  projectName: string;
  jurisdiction: string;
  standardProfileId: string;
  quotaLibraryId: string;
  currentNodeId: string;
  treeNodes: CostProjectTreeNode[];
  versions: QuantityCostingVersion[];
  boqItems: QuantityCostingBoqItem[];
}

export interface CostSummary {
  submittedTotal: number;
  approvedTotal: number;
  amountDelta: number;
  increaseAmount: number;
  decreaseAmount: number;
  sourceReviewCount: number;
  markCounts: Record<CostChangeMark, number>;
}

export interface QuantityCostingDashboard {
  project: QuantityCostingProject;
  computedItems: ComputedCostBoqItem[];
  summary: CostSummary;
}

export interface CostAnalysisFilters {
  nameContains?: string;
  featureContains?: string;
  changeReasonContains?: string;
  mark?: CostChangeMark;
  numeric?: Array<{
    field: CostNumericField;
    operator: CostNumericOperator;
    value: number;
  }>;
}

export interface MergedCostAnalysisGroup {
  groupId: string;
  name: string;
  itemIds: string[];
  unit: string | null;
  unitConsistent: boolean;
  approvedUnitPrice: number | null;
  approvedUnitPriceConsistent: boolean;
  qtyDelta: number | null;
  submittedTotal: number;
  approvedTotal: number;
  amountDelta: number;
  changeMarks: CostChangeMark[];
}

export interface CostAnalysisSummaryRow {
  rowId: string;
  level: CostAnalysisExpandLevel;
  nodeId: string;
  nodeName: string;
  itemIds: string[];
  submittedTotal: number;
  approvedTotal: number;
  amountDelta: number;
  amountDeltaRatio: number;
  increaseAmount: number;
  decreaseAmount: number;
  changeMarks: CostChangeMark[];
  sourceReviewCount: number;
}

export interface CostReviewReportSnapshot {
  projectId: string;
  projectName: string;
  selectedItemIds: string[];
  selectedCount: number;
  submittedTotal: number;
  approvedTotal: number;
  amountDelta: number;
  increaseAmount: number;
  decreaseAmount: number;
  outputState: "professional_review_required";
}

export interface CostIncreaseStrategyInput {
  strategyType: CostIncreaseStrategyType;
  label: string;
  submittedAmount: number;
  approvedAmount: number;
  relatedIncreaseAmount?: number;
  submittedBaseAmount?: number;
  approvedBaseAmount?: number;
  submittedRate?: number;
  approvedRate?: number;
}

export interface CostIncreaseStrategyResult {
  strategyType: CostIncreaseStrategyType;
  label: string;
  amountDelta: number;
  increaseAmount: number;
  decreaseAmount: number;
  formulaSummary: string;
}

export interface CostAnalysisSelectionRule {
  mode: CostAnalysisSelectionMode;
  value: number;
}

export interface CostReviewReportMetadata {
  projectName: string;
  owner: string;
  contractor: string;
  designer: string;
  supervisor: string;
  reviewer: string;
}

export interface CostReviewReportSection {
  sectionId: string;
  title: string;
  rows: Array<Record<string, string | number>>;
}

export interface CostReviewReportPreview extends CostReviewReportSnapshot {
  metadata: CostReviewReportMetadata;
  sections: CostReviewReportSection[];
  editable: boolean;
}

export type CostReportTaskFormat = "excel" | "pdf" | "print" | "word";

export type CostReportSchemeSource = "system" | "archived" | "loaded";

export interface CostReportExportSettings {
  includeFilteredRowsOnly: boolean;
  includeWatermark: boolean;
  watermarkText: string;
  pageNumberMode: "continuous" | "custom";
  startPage: number;
  totalPages: number | null;
}

export interface CostReportScheme {
  schemeId: string;
  name: string;
  reportNames: string[];
  formats: CostReportTaskFormat[];
  source: CostReportSchemeSource;
  updatedAt: string;
  exportSettings: CostReportExportSettings;
}

export interface CostReportSchemeApplicationPlan {
  schemeId: string;
  targetNodeIds: string[];
  appliedCount: number;
  outputState: "professional_review_required";
}

export interface CostReportTask {
  taskId: string;
  name: string;
  format: CostReportTaskFormat;
  sourceTab: string;
  schemeId?: string;
  outputState: "queued" | "professional_review_required";
}

export interface CostStandardEntry {
  standardId: string;
  name: string;
  jurisdiction: string;
  sourceRef: string;
  effectiveFrom: string;
  status: CostSourceStatus;
  sourceVerified: boolean;
}

export interface CostQuotaLibrary {
  quotaLibraryId: string;
  name: string;
  jurisdiction: string;
  specialty: string;
  version: string;
  standardId: string;
  sourceRef: string;
  status: CostSourceStatus;
  sourceVerified: boolean;
}

export interface CostQuotaResourceConsumption {
  resourceId: string;
  resourceType: CostResourceType;
  name: string;
  unit: string;
  consumption: number;
}

export interface CostQuotaItem {
  quotaItemId: string;
  quotaLibraryId: string;
  boqCode: string;
  name: string;
  unit: string;
  sourceRef: string;
  sourceStatus: CostSourceStatus;
  resourceConsumptions: CostQuotaResourceConsumption[];
  managementRate: number;
  profitRate: number;
  riskRate: number;
}

export interface CostPriceSnapshotResource {
  resourceId: string;
  resourceType: CostResourceType;
  name: string;
  unit: string;
  unitPrice: number;
  sourceRef: string;
  sourceVerified: boolean;
}

export interface CostingStandardRegistry {
  standards: CostStandardEntry[];
  quotaLibraries: CostQuotaLibrary[];
  quotaItems: CostQuotaItem[];
  priceResources: CostPriceSnapshotResource[];
}

export interface CostUnitPriceComponent {
  componentId: string;
  componentType: CostComponentType;
  name: string;
  baseAmount: number;
  rate: number | null;
  amount: number;
  sourceRef: string;
  sourceVerified: boolean;
}

export interface CostUnitPriceBreakdown {
  quotaItemId: string;
  name: string;
  unit: string;
  directCost: number;
  managementFee: number;
  profit: number;
  risk: number;
  unitPrice: number;
  components: CostUnitPriceComponent[];
  sourceReviewRequired: boolean;
  missingSourceRefs: string[];
}

export interface CostMeasureItem {
  itemId: string;
  name: string;
  measureType: CostMeasureType;
  submittedBaseAmount: number;
  approvedBaseAmount: number;
  submittedRate: number;
  approvedRate: number;
  sourceRuleId: string;
  sourceRef: string;
}

export interface ComputedCostMeasureItem extends CostMeasureItem {
  submittedAmount: number;
  approvedAmount: number;
  amountDelta: number;
  changeMark: CostChangeMark;
  changeReason: string;
  sourceReviewRequired: boolean;
}

export interface CostOtherItem {
  itemId: string;
  name: string;
  otherType: CostOtherItemType;
  submittedAmount: number;
  approvedAmount: number;
  sourceRuleId: string;
  sourceRef: string;
}

export interface ComputedCostOtherItem extends CostOtherItem {
  amountDelta: number;
  changeMark: CostChangeMark;
  changeReason: string;
  sourceReviewRequired: boolean;
}

export interface CostFeeRule {
  feeId: string;
  name: string;
  submittedBaseAmount: number;
  approvedBaseAmount: number;
  submittedRate: number;
  approvedRate: number;
  sourceRuleId: string;
  sourceRef: string;
}

export interface ComputedCostFeeSummaryItem extends CostFeeRule {
  submittedAmount: number;
  approvedAmount: number;
  amountDelta: number;
  changeMark: CostChangeMark;
  changeReason: string;
  sourceReviewRequired: boolean;
}

export interface CostResourceComparisonRow {
  rowId: string;
  componentType: CostComponentType;
  name: string;
  unit: string;
  standardConsumption: number;
  submittedConsumption: number;
  approvedConsumption: number;
  submittedUnitPrice: number;
  approvedUnitPrice: number;
  consumptionDelta: number;
  unitPriceDelta: number;
  changeMark: CostChangeMark;
  sourceRef: string;
  sourceReviewRequired: boolean;
}

export interface CostQuantityExpressionDetail {
  lineId: string;
  description: string;
  submittedExpression: string;
  approvedExpression: string;
  submittedResult: number;
  approvedResult: number;
  resultDelta: number;
  variableCode: string;
  sourceRef: string;
  sourceReviewRequired: boolean;
}

const moneyPrecision = 100;
const quantityPrecision = 10000;
const epsilon = 0.000001;

export const costChangeMarkLabels: Record<CostChangeMark, string> = {
  none: "无",
  add: "增",
  delete: "删",
  modify: "改",
  temporary: "临",
};

export function roundMoney(value: number): number {
  return normalizeZero(
    Math.round((value + Number.EPSILON) * moneyPrecision) / moneyPrecision,
  );
}

export function roundQuantity(value: number): number {
  return normalizeZero(
    Math.round((value + Number.EPSILON) * quantityPrecision) /
      quantityPrecision,
  );
}

export function formatMoney(value: number): string {
  return `¥${roundMoney(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function validateBoqCode(code: string): boolean {
  return /^\d{9}$/.test(code);
}

export function findQuotaItemByBoqCode(
  registry: CostingStandardRegistry,
  boqCode: string,
): CostQuotaItem | null {
  if (!validateBoqCode(boqCode)) {
    return null;
  }
  return registry.quotaItems.find((item) => item.boqCode === boqCode) ?? null;
}

export function calculateQuotaUnitPrice(
  registry: CostingStandardRegistry,
  quotaItemId: string,
): CostUnitPriceBreakdown {
  const quotaItem = registry.quotaItems.find(
    (item) => item.quotaItemId === quotaItemId,
  );
  if (!quotaItem) {
    throw new Error(`Unknown quota item: ${quotaItemId}`);
  }

  const resourceComponents = quotaItem.resourceConsumptions.map(
    (consumption): CostUnitPriceComponent => {
      const price = registry.priceResources.find(
        (item) => item.resourceId === consumption.resourceId,
      );
      const unitPrice = price?.unitPrice ?? 0;
      const amount = roundMoney(consumption.consumption * unitPrice);
      return {
        componentId: `${quotaItem.quotaItemId}-${consumption.resourceId}`,
        componentType: consumption.resourceType,
        name: consumption.name,
        baseAmount: roundQuantity(consumption.consumption),
        rate: null,
        amount,
        sourceRef: price?.sourceRef ?? "",
        sourceVerified: price?.sourceVerified ?? false,
      };
    },
  );
  const directCost = roundMoney(
    resourceComponents.reduce((sum, component) => sum + component.amount, 0),
  );
  const managementFee = roundMoney(directCost * quotaItem.managementRate);
  const profit = roundMoney(directCost * quotaItem.profitRate);
  const risk = roundMoney(directCost * quotaItem.riskRate);
  const feeComponents: CostUnitPriceComponent[] = [
    {
      componentId: `${quotaItem.quotaItemId}-management`,
      componentType: "management",
      name: "管理费",
      baseAmount: directCost,
      rate: quotaItem.managementRate,
      amount: managementFee,
      sourceRef: quotaItem.sourceRef,
      sourceVerified: quotaItem.sourceStatus === "active",
    },
    {
      componentId: `${quotaItem.quotaItemId}-profit`,
      componentType: "profit",
      name: "利润",
      baseAmount: directCost,
      rate: quotaItem.profitRate,
      amount: profit,
      sourceRef: quotaItem.sourceRef,
      sourceVerified: quotaItem.sourceStatus === "active",
    },
    {
      componentId: `${quotaItem.quotaItemId}-risk`,
      componentType: "risk",
      name: "风险",
      baseAmount: directCost,
      rate: quotaItem.riskRate,
      amount: risk,
      sourceRef: quotaItem.sourceRef,
      sourceVerified: quotaItem.sourceStatus === "active",
    },
  ];
  const components = [...resourceComponents, ...feeComponents];
  const missingSourceRefs = components
    .filter(
      (component) =>
        !component.sourceVerified || component.sourceRef.trim() === "",
    )
    .map((component) => component.componentId);

  if (
    quotaItem.sourceStatus !== "active" ||
    quotaItem.sourceRef.trim() === ""
  ) {
    missingSourceRefs.push(quotaItem.quotaItemId);
  }

  return {
    quotaItemId: quotaItem.quotaItemId,
    name: quotaItem.name,
    unit: quotaItem.unit,
    directCost,
    managementFee,
    profit,
    risk,
    unitPrice: roundMoney(directCost + managementFee + profit + risk),
    components,
    sourceReviewRequired: missingSourceRefs.length > 0,
    missingSourceRefs: [...new Set(missingSourceRefs)],
  };
}

export function calculateMeasureItem(
  item: CostMeasureItem,
): ComputedCostMeasureItem {
  const submittedAmount = roundMoney(
    item.submittedBaseAmount * item.submittedRate,
  );
  const approvedAmount = roundMoney(
    item.approvedBaseAmount * item.approvedRate,
  );
  const amountDelta = roundMoney(approvedAmount - submittedAmount);
  const changeMark = classifyAmountChange(submittedAmount, approvedAmount);
  return {
    ...item,
    submittedAmount,
    approvedAmount,
    amountDelta,
    changeMark,
    changeReason: generateAmountChangeReason(changeMark),
    sourceReviewRequired:
      item.sourceRef.trim() === "" || item.sourceRuleId.trim() === "",
  };
}

export function calculateOtherItem(item: CostOtherItem): ComputedCostOtherItem {
  const changeMark = classifyAmountChange(
    item.submittedAmount,
    item.approvedAmount,
  );
  return {
    ...item,
    amountDelta: roundMoney(item.approvedAmount - item.submittedAmount),
    changeMark,
    changeReason: generateAmountChangeReason(changeMark),
    sourceReviewRequired:
      item.sourceRef.trim() === "" || item.sourceRuleId.trim() === "",
  };
}

export function calculateFeeSummaryItem(
  rule: CostFeeRule,
): ComputedCostFeeSummaryItem {
  const submittedAmount = roundMoney(
    rule.submittedBaseAmount * rule.submittedRate,
  );
  const approvedAmount = roundMoney(
    rule.approvedBaseAmount * rule.approvedRate,
  );
  const changeMark = classifyAmountChange(submittedAmount, approvedAmount);
  return {
    ...rule,
    submittedAmount,
    approvedAmount,
    amountDelta: roundMoney(approvedAmount - submittedAmount),
    changeMark,
    changeReason: generateAmountChangeReason(changeMark),
    sourceReviewRequired:
      rule.sourceRef.trim() === "" || rule.sourceRuleId.trim() === "",
  };
}

export function buildCostResourceComparisonRows(
  breakdown: CostUnitPriceBreakdown,
  item: ComputedCostBoqItem | null,
): CostResourceComparisonRow[] {
  const submittedFactor =
    item && item.submittedUnitPrice > 0
      ? item.submittedUnitPrice / Math.max(breakdown.unitPrice, epsilon)
      : 1;
  const approvedFactor =
    item && item.approvedUnitPrice > 0
      ? item.approvedUnitPrice / Math.max(breakdown.unitPrice, epsilon)
      : submittedFactor;

  return breakdown.components.map((component) => {
    const standardConsumption = roundQuantity(component.baseAmount);
    const submittedConsumption = roundQuantity(
      component.baseAmount * submittedFactor,
    );
    const approvedConsumption = roundQuantity(
      component.baseAmount * approvedFactor,
    );
    const submittedUnitPrice = roundMoney(component.amount * submittedFactor);
    const approvedUnitPrice = roundMoney(component.amount * approvedFactor);
    const consumptionDelta = roundQuantity(
      approvedConsumption - submittedConsumption,
    );
    const unitPriceDelta = roundMoney(approvedUnitPrice - submittedUnitPrice);
    const changeMark =
      component.sourceVerified === false || component.sourceRef.trim() === ""
        ? "temporary"
        : classifyAmountChange(submittedUnitPrice, approvedUnitPrice);

    return {
      rowId: component.componentId,
      componentType: component.componentType,
      name: component.name,
      unit: breakdown.unit,
      standardConsumption,
      submittedConsumption,
      approvedConsumption,
      submittedUnitPrice,
      approvedUnitPrice,
      consumptionDelta,
      unitPriceDelta,
      changeMark,
      sourceRef: component.sourceRef,
      sourceReviewRequired:
        component.sourceVerified === false || component.sourceRef.trim() === "",
    };
  });
}

export function buildCostQuantityExpressionDetails(
  item: ComputedCostBoqItem,
): CostQuantityExpressionDetail[] {
  const submittedQty = roundQuantity(item.submittedQty);
  const approvedQty = roundQuantity(item.approvedQty);
  const qtyDelta = roundQuantity(item.qtyDelta);

  return [
    {
      lineId: `${item.itemId}-quantity`,
      description: "清单工程量",
      submittedExpression: `${submittedQty}`,
      approvedExpression:
        qtyDelta === 0
          ? `${submittedQty}`
          : `${submittedQty}${qtyDelta > 0 ? "+" : ""}${qtyDelta}`,
      submittedResult: submittedQty,
      approvedResult: approvedQty,
      resultDelta: qtyDelta,
      variableCode: "GCL",
      sourceRef: item.sourceRef,
      sourceReviewRequired: item.sourceReviewRequired,
    },
    {
      lineId: `${item.itemId}-amount`,
      description: "清单增减金额",
      submittedExpression: `${submittedQty}*${roundMoney(item.submittedUnitPrice)}`,
      approvedExpression: `${approvedQty}*${roundMoney(item.approvedUnitPrice)}`,
      submittedResult: item.submittedTotal,
      approvedResult: item.approvedTotal,
      resultDelta: item.amountDelta,
      variableCode: "ZJJE",
      sourceRef: item.sourceRef,
      sourceReviewRequired: item.sourceReviewRequired,
    },
  ];
}

export function computeBoqItem(
  item: QuantityCostingBoqItem,
  increaseEffective = true,
): ComputedCostBoqItem {
  const submittedTotal = roundMoney(
    item.submittedQty * item.submittedUnitPrice,
  );
  const approvedTotal = roundMoney(item.approvedQty * item.approvedUnitPrice);
  const amountDelta = roundMoney(approvedTotal - submittedTotal);
  const qtyDelta = roundQuantity(item.approvedQty - item.submittedQty);
  const unitPriceDelta = roundMoney(
    item.approvedUnitPrice - item.submittedUnitPrice,
  );
  const amountDeltaRatio =
    submittedTotal === 0
      ? approvedTotal === 0
        ? 0
        : 1
      : roundQuantity(amountDelta / submittedTotal);
  const changeMark = classifyBoqChange({
    item,
    submittedTotal,
    approvedTotal,
    amountDelta,
    qtyDelta,
    unitPriceDelta,
  });
  const increaseDecrease = calculateIncreaseDecrease(
    amountDelta,
    increaseEffective,
  );
  const sourceReviewRequired =
    item.manualReviewRequired === true ||
    item.sourceRef.trim() === "" ||
    item.ruleId.trim() === "";
  const autoChangeReason = generateChangeReason(
    item,
    changeMark,
    qtyDelta,
    unitPriceDelta,
  );

  return {
    ...item,
    displayCode: item.approvedCode || item.submittedCode,
    displayName: item.approvedName || item.submittedName,
    qtyDelta,
    unitPriceDelta,
    submittedTotal,
    approvedTotal,
    amountDelta,
    amountDeltaRatio,
    increaseAmount: increaseDecrease.increaseAmount,
    decreaseAmount: increaseDecrease.decreaseAmount,
    changeMark,
    autoChangeReason,
    changeReason: item.manualChangeReason ?? autoChangeReason,
    sourceReviewRequired,
  };
}

export function calculateCostingDashboard(
  project: QuantityCostingProject,
  increaseEffective = true,
): QuantityCostingDashboard {
  const computedItems = project.boqItems.map((item) =>
    computeBoqItem(item, increaseEffective),
  );
  return {
    project,
    computedItems,
    summary: summarizeComputedItems(computedItems),
  };
}

export function calculateIncreaseDecrease(
  amountDelta: number,
  increaseEffective = true,
) {
  if (!increaseEffective) {
    return {
      increaseAmount: 0,
      decreaseAmount: 0,
    };
  }

  if (amountDelta > 0) {
    return {
      increaseAmount: roundMoney(amountDelta),
      decreaseAmount: 0,
    };
  }

  if (amountDelta < 0) {
    return {
      increaseAmount: 0,
      decreaseAmount: roundMoney(Math.abs(amountDelta)),
    };
  }

  return {
    increaseAmount: 0,
    decreaseAmount: 0,
  };
}

export function calculateIncreaseDecreaseByStrategy(
  input: CostIncreaseStrategyInput,
  increaseEffective = true,
): CostIncreaseStrategyResult {
  const amountDelta = roundMoney(input.approvedAmount - input.submittedAmount);
  if (!increaseEffective) {
    return {
      strategyType: input.strategyType,
      label: input.label,
      amountDelta,
      increaseAmount: 0,
      decreaseAmount: 0,
      formulaSummary: "核增无效: 仅保留增减金额,不拆核增核减。",
    };
  }

  if (input.strategyType === "constant") {
    const result = calculateIncreaseDecrease(amountDelta, true);
    return {
      strategyType: input.strategyType,
      label: input.label,
      amountDelta,
      ...result,
      formulaSummary: "常数型: 审定金额-送审金额大于0为核增,小于0为核减。",
    };
  }

  if (input.strategyType === "fee_code") {
    const submittedBase = input.submittedBaseAmount ?? 0;
    const approvedBase = input.approvedBaseAmount ?? submittedBase;
    const submittedRate = input.submittedRate ?? 0;
    const approvedRate = input.approvedRate ?? submittedRate;
    const baseIncrease =
      input.relatedIncreaseAmount ?? Math.max(approvedBase - submittedBase, 0);
    const rateDelta = Math.max(approvedRate - submittedRate, 0);
    const increaseAmount = roundMoney(
      baseIncrease * approvedRate + submittedBase * rateDelta,
    );
    return balanceIncreaseDecrease(input, amountDelta, increaseAmount, [
      "费用代号型",
      `核增基数 ${roundMoney(baseIncrease)}`,
      `审定费率 ${formatRateForFormula(approvedRate)}`,
      `费率差 ${formatRateForFormula(rateDelta)}`,
    ]);
  }

  return balanceIncreaseDecrease(
    input,
    amountDelta,
    roundMoney(input.relatedIncreaseAmount ?? Math.max(amountDelta, 0)),
    ["代码型", "按对应核增代码统计核增部分"],
  );
}

export function buildCostProjectImportPlan(
  currentNodes: CostProjectTreeNode[],
  importNodes: CostProjectTreeNode[],
  rules: CostProjectMatchRule[],
  sourceType: CostImportSourceType,
): CostProjectImportPlan {
  const activeRules = rules.length > 0 ? rules : (["name"] as const);
  const rows = importNodes.map((importNode): CostProjectImportMatchRow => {
    const candidates = currentNodes
      .map((currentNode) => {
        const ruleHits = activeRules.filter((rule) =>
          costProjectMatchRuleHit(rule, currentNode, importNode),
        );
        return {
          currentNode,
          ruleHits,
          confidence: roundQuantity(ruleHits.length / activeRules.length),
        };
      })
      .sort((left, right) => right.confidence - left.confidence);
    const best = candidates[0];
    const matched =
      best && best.confidence >= 1
        ? best
        : candidates.find((candidate) => candidate.ruleHits.includes("name"));

    return {
      rowId: `${sourceType}-${importNode.nodeId}`,
      currentNodeId: matched?.currentNode.nodeId ?? null,
      importNodeId: importNode.nodeId,
      currentName: matched?.currentNode.name ?? null,
      importName: importNode.name,
      action: matched ? "match" : "add",
      status: matched
        ? matched.confidence >= 1
          ? "auto_matched"
          : "manual_required"
        : "unmatched",
      confidence: matched?.confidence ?? 0,
      ruleHits: matched?.ruleHits ?? [],
    };
  });

  const autoMatchedCount = rows.filter(
    (row) => row.status === "auto_matched",
  ).length;
  const manualRequiredCount = rows.filter(
    (row) => row.status === "manual_required" || row.status === "unmatched",
  ).length;

  return {
    sourceType,
    rules: [...activeRules],
    rows,
    autoMatchedCount,
    manualRequiredCount,
    readyToImport: rows.some((row) => row.action !== "skip"),
  };
}

export function applyCostProjectImportPlan(
  project: QuantityCostingProject,
  importNodes: CostProjectTreeNode[],
  plan: CostProjectImportPlan,
): QuantityCostingProject {
  const nodeById = new Map(
    project.treeNodes.map((node) => [node.nodeId, node]),
  );
  const importNodeById = new Map(
    importNodes.map((node) => [node.nodeId, node]),
  );

  for (const row of plan.rows) {
    if (row.action === "skip") {
      continue;
    }
    const importNode = importNodeById.get(row.importNodeId);
    if (!importNode) {
      continue;
    }
    if (row.action === "replace" && row.currentNodeId) {
      const current = nodeById.get(row.currentNodeId);
      if (current) {
        nodeById.set(row.currentNodeId, {
          ...current,
          name: importNode.name,
          specialty: importNode.specialty,
          standardProfileId: importNode.standardProfileId,
          quotaLibraryId: importNode.quotaLibraryId,
          auditState: "reviewing",
        });
      }
      continue;
    }
    if (row.action === "match" && row.currentNodeId) {
      const current = nodeById.get(row.currentNodeId);
      if (current) {
        nodeById.set(row.currentNodeId, {
          ...current,
          auditState: "reviewing",
        });
      }
      continue;
    }
    const addedNodeId = `imported-${importNode.nodeId}`;
    nodeById.set(addedNodeId, {
      ...importNode,
      nodeId: addedNodeId,
      projectId: project.projectId,
      parentId: project.currentNodeId,
      sortOrder: nodeById.size + 1,
      auditState: "reviewing",
    });
  }

  return {
    ...project,
    treeNodes: [...nodeById.values()].sort(
      (left, right) => left.sortOrder - right.sortOrder,
    ),
  };
}

export function copyCostProjectNode(
  project: QuantityCostingProject,
  nodeId: string,
  targetParentId: string,
): QuantityCostingProject {
  const source = project.treeNodes.find((node) => node.nodeId === nodeId);
  const target = project.treeNodes.find(
    (node) => node.nodeId === targetParentId,
  );
  if (!source || !target || source.nodeId === target.nodeId) {
    return project;
  }
  const copiedNodeId = `${source.nodeId}-copy-${project.treeNodes.length + 1}`;
  return {
    ...project,
    treeNodes: [
      ...project.treeNodes,
      {
        ...source,
        nodeId: copiedNodeId,
        parentId: target.nodeId,
        name: `${source.name} 副本`,
        sortOrder: project.treeNodes.length + 1,
        auditState: "draft",
      },
    ],
  };
}

export function markCostProjectNodeDeleted(
  project: QuantityCostingProject,
  nodeId: string,
): QuantityCostingProject {
  return markCostProjectNodesDeleted(project, [nodeId]);
}

export function markCostProjectNodesDeleted(
  project: QuantityCostingProject,
  nodeIds: string[],
): QuantityCostingProject {
  const deletingNodeIds = new Set(nodeIds);
  return {
    ...project,
    treeNodes: project.treeNodes.map((node) =>
      deletingNodeIds.has(node.nodeId)
        ? {
            ...node,
            auditState: "archived",
            name: node.name.includes("已删除")
              ? node.name
              : `${node.name}（已删除）`,
          }
        : node,
    ),
  };
}

export function switchSubmittedReviewVersion(
  project: QuantityCostingProject,
  currentReviewVersionId: string,
  submittedVersionId: string,
): QuantityCostingProject {
  return {
    ...project,
    versions: project.versions.map((version) =>
      version.versionId === currentReviewVersionId &&
      version.versionType === "review"
        ? { ...version, submittedVersionId }
        : version,
    ),
  };
}

export function deleteReviewVersion(
  project: QuantityCostingProject,
  versionId: string,
): { project: QuantityCostingProject; blockedReason: string | null } {
  const reviews = project.versions.filter(
    (version) => version.versionType === "review",
  );
  const deleting = project.versions.find(
    (version) => version.versionId === versionId,
  );
  const currentReview = reviews.at(-1);
  if (!deleting || deleting.versionType !== "review") {
    return { project, blockedReason: "只能删除审核版本。" };
  }
  if (currentReview?.versionId === versionId) {
    return { project, blockedReason: "当前审核版本不可删除。" };
  }
  return {
    project: {
      ...project,
      versions: project.versions.filter(
        (version) => version.versionId !== versionId,
      ),
    },
    blockedReason: null,
  };
}

/// 手册 §2.7.4: 自动生成的增减说明用【】包括（如【调量调价】…），
/// "无增减。" 为同值清单的自动文案。两类都不是手工填写的说明。
export function isGeneratedBoqChangeReason(reason: string): boolean {
  const trimmed = reason.trim();
  if (trimmed === "" || trimmed === "无增减。" || trimmed === "无增减") {
    return true;
  }
  return /^【(增项|减项|调项|调量|调价|调量调价|临项)】/.test(trimmed);
}

/// 从持久化快照恢复时甄别增减说明：自动生成文案随当前数据实时重算，
/// 只有手工填写的说明才作为覆盖保留——否则数据转换/回写后旧文案会残留。
export function inferBoqManualChangeReason(
  storedReason: string,
): string | undefined {
  return isGeneratedBoqChangeReason(storedReason) ? undefined : storedReason;
}

export function convertBoqItemData(
  item: QuantityCostingBoqItem,
  direction: CostDataConversionDirection,
) {
  const computed = computeBoqItem(item);

  if (direction === "submitted_to_approved" && computed.changeMark === "add") {
    return {
      item,
      blockedReason: "审增项不可执行送审同步到审定,需要保留审定新增依据。",
    };
  }

  // 数据转换后送审/审定一致，旧增减说明（无论自动或手工）随之失效，
  // 丢弃手工覆盖让内核按新数据重算（同值 → "无增减。"）。
  const { manualChangeReason: _staleReason, ...rest } = item;
  void _staleReason;

  if (direction === "submitted_to_approved") {
    return {
      item: {
        ...rest,
        approvedCode: item.submittedCode,
        approvedName: item.submittedName,
        approvedFeature: item.submittedFeature,
        approvedQty: item.submittedQty,
        approvedUnitPrice: item.submittedUnitPrice,
      },
      blockedReason: null,
    };
  }

  return {
    item: {
      ...rest,
      submittedCode: item.approvedCode,
      submittedName: item.approvedName,
      submittedFeature: item.approvedFeature,
      submittedQty: item.approvedQty,
      submittedUnitPrice: item.approvedUnitPrice,
    },
    blockedReason: null,
  };
}

export function convertMeasureItemData(
  item: CostMeasureItem,
  direction: CostDataConversionDirection,
): { item: CostMeasureItem; blockedReason: string | null } {
  if (direction === "submitted_to_approved") {
    return {
      item: {
        ...item,
        approvedBaseAmount: item.submittedBaseAmount,
        approvedRate: item.submittedRate,
      },
      blockedReason: null,
    };
  }

  return {
    item: {
      ...item,
      submittedBaseAmount: item.approvedBaseAmount,
      submittedRate: item.approvedRate,
    },
    blockedReason: null,
  };
}

export function convertOtherItemData(
  item: CostOtherItem,
  direction: CostDataConversionDirection,
): { item: CostOtherItem; blockedReason: string | null } {
  if (direction === "submitted_to_approved") {
    return {
      item: {
        ...item,
        approvedAmount: item.submittedAmount,
      },
      blockedReason: null,
    };
  }

  return {
    item: {
      ...item,
      submittedAmount: item.approvedAmount,
    },
    blockedReason: null,
  };
}

export function convertFeeRuleData(
  rule: CostFeeRule,
  direction: CostDataConversionDirection,
): { rule: CostFeeRule; blockedReason: string | null } {
  if (direction === "submitted_to_approved") {
    return {
      rule: {
        ...rule,
        approvedBaseAmount: rule.submittedBaseAmount,
        approvedRate: rule.submittedRate,
      },
      blockedReason: null,
    };
  }

  return {
    rule: {
      ...rule,
      submittedBaseAmount: rule.approvedBaseAmount,
      submittedRate: rule.approvedRate,
    },
    blockedReason: null,
  };
}

export function setBoqItemChangeReason(
  item: QuantityCostingBoqItem,
  reason: string,
): QuantityCostingBoqItem {
  return {
    ...item,
    manualChangeReason: reason,
  };
}

export function clearGeneratedBoqChangeReasons(
  items: QuantityCostingBoqItem[],
): QuantityCostingBoqItem[] {
  return items.map((item) => ({
    ...item,
    manualChangeReason: "",
  }));
}

export function createNextReviewVersion(
  project: QuantityCostingProject,
  description: string,
): QuantityCostingVersion {
  const maxRound = Math.max(
    0,
    ...project.versions.map((version) => version.reviewRound),
  );
  const previousReview = [...project.versions]
    .reverse()
    .find((version) => version.versionType === "review");
  const nextRound = maxRound + 1;

  return {
    versionId: `review-r${nextRound}`,
    projectId: project.projectId,
    versionType: "review",
    reviewRound: nextRound,
    submittedVersionId:
      previousReview?.approvedVersionId ??
      previousReview?.versionId ??
      "budget-v1",
    approvedVersionId: `approved-r${nextRound}`,
    description,
    status: "reviewing",
    createdBy: "造价工程师",
    createdAt: "2026-05-23T00:00:00.000Z",
    sourceFileIds: ["budget-xlsx-v1"],
    auditEventIds: [`audit-review-r${nextRound}`],
  };
}

export interface CostBudgetConversionResult {
  version: QuantityCostingVersion;
  boqItems: QuantityCostingBoqItem[];
  fileName: string;
  sourceReviewVersionId: string | null;
  droppedItemIds: string[];
}

export function convertReviewVersionToBudget(
  project: QuantityCostingProject,
  source: "approved" | "submitted",
): CostBudgetConversionResult {
  const sourceReview = [...project.versions]
    .reverse()
    .find((version) => version.versionType === "review");
  const sideLabel = source === "approved" ? "审定" : "送审";
  const droppedItemIds: string[] = [];
  const boqItems = project.boqItems
    .filter((item) => {
      const code =
        source === "approved" ? item.approvedCode : item.submittedCode;
      const total =
        source === "approved"
          ? item.approvedQty * item.approvedUnitPrice
          : item.submittedQty * item.submittedUnitPrice;
      const keep = code.trim() !== "" || roundMoney(total) !== 0;
      if (!keep) {
        droppedItemIds.push(item.itemId);
      }
      return keep;
    })
    .map((item): QuantityCostingBoqItem => {
      const code =
        source === "approved" ? item.approvedCode : item.submittedCode;
      const name =
        source === "approved" ? item.approvedName : item.submittedName;
      const feature =
        source === "approved" ? item.approvedFeature : item.submittedFeature;
      const qty = source === "approved" ? item.approvedQty : item.submittedQty;
      const unitPrice =
        source === "approved"
          ? item.approvedUnitPrice
          : item.submittedUnitPrice;
      const { manualChangeReason: _droppedReason, ...rest } = item;
      void _droppedReason;
      return {
        ...rest,
        itemId: `${item.itemId}-${source}-budget`,
        submittedCode: code,
        approvedCode: code,
        submittedName: name,
        approvedName: name,
        submittedFeature: feature,
        approvedFeature: feature,
        submittedQty: qty,
        approvedQty: qty,
        submittedUnitPrice: unitPrice,
        approvedUnitPrice: unitPrice,
        temporary: false,
      };
    });

  const round = sourceReview?.reviewRound ?? 0;
  const version: QuantityCostingVersion = {
    versionId: `budget-from-${source}-r${round}`,
    projectId: project.projectId,
    versionType: "budget",
    reviewRound: 0,
    submittedVersionId: null,
    approvedVersionId: null,
    description: `[${sideLabel}转预算] 来源第 ${round} 审`,
    status: "draft",
    createdBy: "造价工程师",
    createdAt: "2026-05-23T00:00:00.000Z",
    sourceFileIds: sourceReview?.sourceFileIds ?? [],
    auditEventIds: [`audit-budget-from-${source}-r${round}`],
  };

  return {
    version,
    boqItems,
    fileName: `[${sideLabel}预算]${project.projectName}`,
    sourceReviewVersionId: sourceReview?.versionId ?? null,
    droppedItemIds,
  };
}

export function filterCostAnalysisItems(
  items: ComputedCostBoqItem[],
  filters: CostAnalysisFilters,
): ComputedCostBoqItem[] {
  return items.filter((item) => {
    if (
      filters.nameContains &&
      !containsText(
        `${item.submittedName} ${item.approvedName}`,
        filters.nameContains,
      )
    ) {
      return false;
    }
    if (
      filters.featureContains &&
      !containsText(
        `${item.submittedFeature} ${item.approvedFeature}`,
        filters.featureContains,
      )
    ) {
      return false;
    }
    if (
      filters.changeReasonContains &&
      !containsText(item.changeReason, filters.changeReasonContains)
    ) {
      return false;
    }
    if (filters.mark && item.changeMark !== filters.mark) {
      return false;
    }

    return (filters.numeric ?? []).every((condition) => {
      const value = item[condition.field];
      if (condition.operator === "abs_gte") {
        return Math.abs(value) >= condition.value;
      }
      if (condition.operator === "gte") {
        return value >= condition.value;
      }
      return value <= condition.value;
    });
  });
}

export function hasActiveCostAnalysisFilters(
  filters: CostAnalysisFilters,
): boolean {
  return Boolean(
    filters.nameContains?.trim() ||
    filters.featureContains?.trim() ||
    filters.changeReasonContains?.trim() ||
    filters.mark ||
    (filters.numeric?.length ?? 0) > 0,
  );
}

export function validateCostAnalysisMerge(filters: CostAnalysisFilters): {
  allowed: boolean;
  blockedReason: string | null;
} {
  if (hasActiveCostAnalysisFilters(filters)) {
    return {
      allowed: false,
      blockedReason: "过滤状态下不支持合并分析,请先取消过滤。",
    };
  }

  return {
    allowed: true,
    blockedReason: null,
  };
}

export function summarizeCostAnalysisByLevel(
  project: QuantityCostingProject,
  items: ComputedCostBoqItem[],
  level: CostAnalysisExpandLevel,
): CostAnalysisSummaryRow[] {
  if (level === "fee") {
    return items.map((item) =>
      costAnalysisSummaryFromItems(project, item.itemId, [item]),
    );
  }

  const groups = new Map<string, ComputedCostBoqItem[]>();

  for (const item of items) {
    const targetNode =
      findCostProjectAncestor(project.treeNodes, item.nodeId, level) ??
      project.treeNodes.find((node) => node.nodeId === item.nodeId);
    const rowId = targetNode?.nodeId ?? item.nodeId;
    const bucket = groups.get(rowId) ?? [];
    bucket.push(item);
    groups.set(rowId, bucket);
  }

  return [...groups.entries()]
    .map(([rowId, groupItems]) =>
      costAnalysisSummaryFromItems(project, rowId, groupItems),
    )
    .sort(
      (left, right) => Math.abs(right.amountDelta) - Math.abs(left.amountDelta),
    );
}

export function selectCostItemsByDeltaShare(
  items: ComputedCostBoqItem[],
  percent: number,
): string[] {
  if (percent <= 0) {
    return [];
  }

  const sorted = [...items]
    .filter((item) => Math.abs(item.amountDelta) > epsilon)
    .sort((a, b) => Math.abs(b.amountDelta) - Math.abs(a.amountDelta));
  const totalAbsDelta = sorted.reduce(
    (sum, item) => sum + Math.abs(item.amountDelta),
    0,
  );
  const target = (totalAbsDelta * Math.min(percent, 100)) / 100;
  const selectedIds: string[] = [];
  let running = 0;

  for (const item of sorted) {
    if (running >= target && selectedIds.length > 0) {
      break;
    }
    selectedIds.push(item.itemId);
    running += Math.abs(item.amountDelta);
  }

  return selectedIds;
}

export function selectCostAnalysisItemsByRule(
  items: ComputedCostBoqItem[],
  rule: CostAnalysisSelectionRule,
): string[] {
  const changed = [...items]
    .filter((item) => Math.abs(item.amountDelta) > epsilon)
    .sort(
      (left, right) => Math.abs(right.amountDelta) - Math.abs(left.amountDelta),
    );

  if (rule.mode === "top_delta_share") {
    return selectCostItemsByDeltaShare(items, rule.value);
  }

  if (rule.mode === "delta_rank") {
    return changed
      .slice(0, Math.max(0, Math.floor(rule.value)))
      .map((item) => item.itemId);
  }

  if (rule.mode === "absolute_delta") {
    return changed
      .filter((item) => Math.abs(item.amountDelta) >= rule.value)
      .map((item) => item.itemId);
  }

  return changed
    .filter((item) => Math.abs(item.amountDeltaRatio) >= rule.value)
    .map((item) => item.itemId);
}

export function mergeCostAnalysisItems(
  items: ComputedCostBoqItem[],
  conditions: Array<
    "nodeId" | "approvedCode" | "approvedName" | "approvedFeature" | "unit"
  >,
): MergedCostAnalysisGroup[] {
  const groups = new Map<string, ComputedCostBoqItem[]>();

  for (const item of items) {
    const key = conditions.map((condition) => item[condition]).join("::");
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }

  return [...groups.entries()].map(([groupId, groupItems]) => {
    const first = groupItems[0]!;
    const units = new Set(groupItems.map((item) => item.unit));
    const approvedUnitPrices = new Set(
      groupItems.map((item) => item.approvedUnitPrice),
    );
    const changeMarks = [...new Set(groupItems.map((item) => item.changeMark))];

    return {
      groupId,
      name: first.approvedName || `${first.submittedName}等`,
      itemIds: groupItems.map((item) => item.itemId),
      unit: units.size === 1 ? first.unit : null,
      unitConsistent: units.size === 1,
      approvedUnitPrice:
        approvedUnitPrices.size === 1 ? first.approvedUnitPrice : null,
      approvedUnitPriceConsistent: approvedUnitPrices.size === 1,
      qtyDelta:
        units.size === 1
          ? roundQuantity(
              groupItems.reduce((sum, item) => sum + item.qtyDelta, 0),
            )
          : null,
      submittedTotal: roundMoney(
        groupItems.reduce((sum, item) => sum + item.submittedTotal, 0),
      ),
      approvedTotal: roundMoney(
        groupItems.reduce((sum, item) => sum + item.approvedTotal, 0),
      ),
      amountDelta: roundMoney(
        groupItems.reduce((sum, item) => sum + item.amountDelta, 0),
      ),
      changeMarks,
    };
  });
}

export function generateReviewReportSnapshot(
  project: QuantityCostingProject,
  selectedItemIds: string[],
): CostReviewReportSnapshot {
  const selected = calculateCostingDashboard(project).computedItems.filter(
    (item) => selectedItemIds.includes(item.itemId),
  );
  const summary = summarizeComputedItems(selected);

  return {
    projectId: project.projectId,
    projectName: project.projectName,
    selectedItemIds,
    selectedCount: selected.length,
    submittedTotal: summary.submittedTotal,
    approvedTotal: summary.approvedTotal,
    amountDelta: summary.amountDelta,
    increaseAmount: summary.increaseAmount,
    decreaseAmount: summary.decreaseAmount,
    outputState: "professional_review_required",
  };
}

export function buildReviewReportPreview(
  project: QuantityCostingProject,
  selectedItemIds: string[],
  metadata: CostReviewReportMetadata,
): CostReviewReportPreview {
  const snapshot = generateReviewReportSnapshot(project, selectedItemIds);
  const selected = calculateCostingDashboard(project).computedItems.filter(
    (item) => selectedItemIds.includes(item.itemId),
  );

  return {
    ...snapshot,
    metadata,
    editable: true,
    sections: [
      {
        sectionId: "project-info",
        title: "项目信息",
        rows: [
          {
            工程名称: metadata.projectName,
            建设单位: metadata.owner,
            施工单位: metadata.contractor,
            设计单位: metadata.designer,
            监理单位: metadata.supervisor,
            审核人: metadata.reviewer,
          },
        ],
      },
      {
        sectionId: "fee-info",
        title: "费用信息",
        rows: [
          {
            送审合计: snapshot.submittedTotal,
            审定合计: snapshot.approvedTotal,
            增减金额: snapshot.amountDelta,
            核增金额: snapshot.increaseAmount,
            核减金额: snapshot.decreaseAmount,
          },
        ],
      },
      {
        sectionId: "delta-analysis",
        title: "详细分析",
        rows: selected.map((item) => ({
          编码: item.displayCode,
          名称: item.displayName,
          单位: item.unit,
          工程量差: item.qtyDelta,
          增减金额: item.amountDelta,
          增减说明: item.changeReason,
        })),
      },
    ],
  };
}

export function createReportExportTasks(
  selectedReportNames: string[],
  formats: CostReportTaskFormat[],
  schemeId?: string,
): CostReportTask[] {
  return selectedReportNames.flatMap((name, reportIndex) =>
    formats.map((format) => ({
      taskId: `cost-report-${reportIndex + 1}-${format}`,
      name,
      format,
      sourceTab: name.includes("审核") ? "审核报告" : "报表",
      ...(schemeId ? { schemeId } : {}),
      outputState:
        format === "print" ? "queued" : "professional_review_required",
    })),
  );
}

export function createReportExportTasksFromScheme(
  scheme: CostReportScheme,
): CostReportTask[] {
  return createReportExportTasks(
    scheme.reportNames,
    scheme.formats,
    scheme.schemeId,
  );
}

export function saveCostReportScheme(
  scheme: CostReportScheme,
  name: string,
  savedAt = "2026-06-02T00:00:00.000Z",
): CostReportScheme {
  return {
    ...scheme,
    schemeId: `archived-${scheme.schemeId}`,
    name,
    source: "archived",
    updatedAt: savedAt,
  };
}

export function loadCostReportScheme(
  scheme: CostReportScheme,
  loadedAt = "2026-06-02T00:00:00.000Z",
): CostReportScheme {
  return {
    ...scheme,
    source: "loaded",
    updatedAt: loadedAt,
  };
}

export function restoreSystemReportScheme(): CostReportScheme {
  return { ...quantityCostingSystemReportScheme };
}

export function updateCostReportExportSettings(
  scheme: CostReportScheme,
  settings: Partial<CostReportExportSettings>,
): CostReportScheme {
  return {
    ...scheme,
    exportSettings: {
      ...scheme.exportSettings,
      ...settings,
    },
  };
}

export function addReportsToCostReportScheme(
  scheme: CostReportScheme,
  reportNames: string[],
): CostReportScheme {
  return {
    ...scheme,
    reportNames: [...new Set([...scheme.reportNames, ...reportNames])],
  };
}

export function createReportSchemeApplicationPlan(
  project: QuantityCostingProject,
  scheme: CostReportScheme,
  targetNodeIds?: string[],
): CostReportSchemeApplicationPlan {
  const defaultTargets = project.treeNodes
    .filter((node) => node.nodeType === "unit_project")
    .map((node) => node.nodeId);
  const targetIds = targetNodeIds?.length ? targetNodeIds : defaultTargets;

  return {
    schemeId: scheme.schemeId,
    targetNodeIds: targetIds,
    appliedCount: targetIds.length,
    outputState: "professional_review_required",
  };
}

export const quantityCostingPhase2Registry: CostingStandardRegistry = {
  standards: [
    {
      standardId: "GB/T50500-2024",
      name: "建设工程工程量清单计价标准",
      jurisdiction: "CN",
      sourceRef:
        "https://www.mohurd.gov.cn/gongkai/zc/wjk/art/2024/art_6186304e164c4c4982904f8734983235.html",
      effectiveFrom: "2025-09-01",
      status: "active",
      sourceVerified: true,
    },
    {
      standardId: "CN-SC-local-quota-pending",
      name: "四川省地方消耗量定额待接入",
      jurisdiction: "CN-SC",
      sourceRef: "",
      effectiveFrom: "",
      status: "source_pending",
      sourceVerified: false,
    },
  ],
  quotaLibraries: [
    {
      quotaLibraryId: "SC-local-quota-placeholder",
      name: "四川省地方消耗量定额占位库",
      jurisdiction: "CN-SC",
      specialty: "钢结构",
      version: "source-pending",
      standardId: "CN-SC-local-quota-pending",
      sourceRef: "",
      status: "source_pending",
      sourceVerified: false,
    },
  ],
  quotaItems: [
    {
      quotaItemId: "quota-steel-member-demo",
      quotaLibraryId: "SC-local-quota-placeholder",
      boqCode: "010515001",
      name: "钢构件组价示例",
      unit: "t",
      sourceRef: "",
      sourceStatus: "source_pending",
      resourceConsumptions: [
        {
          resourceId: "labor-steel-install",
          resourceType: "labor",
          name: "钢构件安装人工",
          unit: "工日",
          consumption: 12,
        },
        {
          resourceId: "material-q355b-steel",
          resourceType: "material",
          name: "Q355B 钢材",
          unit: "t",
          consumption: 1.03,
        },
        {
          resourceId: "machine-crane-shift",
          resourceType: "machine",
          name: "汽车吊台班",
          unit: "台班",
          consumption: 0.35,
        },
      ],
      managementRate: 0.08,
      profitRate: 0.05,
      riskRate: 0.02,
    },
  ],
  priceResources: [
    {
      resourceId: "labor-steel-install",
      resourceType: "labor",
      name: "钢构件安装人工",
      unit: "工日",
      unitPrice: 280,
      sourceRef: "project-price-snapshot-demo",
      sourceVerified: true,
    },
    {
      resourceId: "material-q355b-steel",
      resourceType: "material",
      name: "Q355B 钢材",
      unit: "t",
      unitPrice: 5400,
      sourceRef: "project-price-snapshot-demo",
      sourceVerified: true,
    },
    {
      resourceId: "machine-crane-shift",
      resourceType: "machine",
      name: "汽车吊台班",
      unit: "台班",
      unitPrice: 1200,
      sourceRef: "project-price-snapshot-demo",
      sourceVerified: true,
    },
  ],
};

export const quantityCostingPhase2MeasureItems: CostMeasureItem[] = [
  {
    itemId: "measure-safety-civilized",
    name: "安全文明施工费",
    measureType: "organization",
    submittedBaseAmount: 292780,
    approvedBaseAmount: 307394,
    submittedRate: 0.035,
    approvedRate: 0.038,
    sourceRuleId: "fee-rule-safety-civilized-demo",
    sourceRef: "",
  },
  {
    itemId: "measure-temporary-facility",
    name: "临时设施费",
    measureType: "organization",
    submittedBaseAmount: 292780,
    approvedBaseAmount: 307394,
    submittedRate: 0.018,
    approvedRate: 0.018,
    sourceRuleId: "fee-rule-temporary-facility-demo",
    sourceRef: "",
  },
];

export const quantityCostingPhase2OtherItems: CostOtherItem[] = [
  {
    itemId: "other-provisional-sum",
    name: "暂列金额",
    otherType: "provisional_sum",
    submittedAmount: 50000,
    approvedAmount: 35000,
    sourceRuleId: "other-rule-provisional-sum-demo",
    sourceRef: "project-contract-demo",
  },
  {
    itemId: "other-daywork",
    name: "计日工",
    otherType: "daywork",
    submittedAmount: 0,
    approvedAmount: 6800,
    sourceRuleId: "other-rule-daywork-demo",
    sourceRef: "project-contract-demo",
  },
  {
    itemId: "other-general-contract-service",
    name: "总承包服务费",
    otherType: "general_contract_service",
    submittedAmount: 12000,
    approvedAmount: 15000,
    sourceRuleId: "other-rule-general-contract-service-demo",
    sourceRef: "project-contract-demo",
  },
];

export const quantityCostingPhase2FeeRules: CostFeeRule[] = [
  {
    feeId: "fee-tax-demo",
    name: "税金",
    submittedBaseAmount: 292780 + 10247.3 + 5270.04 + 62000,
    approvedBaseAmount: 307394 + 11680.97 + 5533.09 + 56800,
    submittedRate: 0.09,
    approvedRate: 0.09,
    sourceRuleId: "fee-rule-tax-demo",
    sourceRef: "",
  },
];

export const quantityCostingDefaultReportMetadata: CostReviewReportMetadata = {
  projectName: "锦屏应舍美居重钢样板工程",
  owner: "建设单位待录入",
  contractor: "施工单位待录入",
  designer: "设计单位待录入",
  supervisor: "监理单位待录入",
  reviewer: "注册造价工程师",
};

export const quantityCostingSystemReportScheme: CostReportScheme = {
  schemeId: "system-cost-review-default",
  name: "系统审核报表方案",
  reportNames: [
    "分部分项工程量清单与计价表",
    "单位工程费用汇总表",
    "项目审核认证单",
    "增减分析表",
    "审核报告",
  ],
  formats: ["excel", "pdf"],
  source: "system",
  updatedAt: "2026-06-02T00:00:00.000Z",
  exportSettings: {
    includeFilteredRowsOnly: false,
    includeWatermark: true,
    watermarkText: "ArchIToken 专业复核后使用",
    pageNumberMode: "continuous",
    startPage: 1,
    totalPages: null,
  },
};

export const quantityCostingPhase1Project: QuantityCostingProject = {
  projectId: "qc-demo-heavy-steel",
  projectName: "锦屏应舍美居重钢样板工程",
  jurisdiction: "CN-SC",
  standardProfileId: "GB/T50500-2024",
  quotaLibraryId: "SC-local-quota-placeholder",
  currentNodeId: "node-steel",
  treeNodes: [
    {
      nodeId: "node-project",
      projectId: "qc-demo-heavy-steel",
      parentId: null,
      nodeType: "project",
      name: "锦屏应舍美居重钢样板工程",
      specialty: "项目工程",
      sortOrder: 1,
      standardProfileId: "GB/T50500-2024",
      quotaLibraryId: "SC-local-quota-placeholder",
      auditState: "reviewing",
    },
    {
      nodeId: "node-single",
      projectId: "qc-demo-heavy-steel",
      parentId: "node-project",
      nodeType: "single_project",
      name: "一期样板区",
      specialty: "单项工程",
      sortOrder: 2,
      standardProfileId: "GB/T50500-2024",
      quotaLibraryId: "SC-local-quota-placeholder",
      auditState: "reviewing",
    },
    {
      nodeId: "node-steel",
      projectId: "qc-demo-heavy-steel",
      parentId: "node-single",
      nodeType: "unit_project",
      name: "钢结构工程",
      specialty: "钢结构",
      sortOrder: 3,
      standardProfileId: "GB/T50500-2024",
      quotaLibraryId: "SC-local-quota-placeholder",
      auditState: "reviewing",
    },
    {
      nodeId: "node-decoration",
      projectId: "qc-demo-heavy-steel",
      parentId: "node-single",
      nodeType: "unit_project",
      name: "建筑装饰工程",
      specialty: "建筑装饰",
      sortOrder: 4,
      standardProfileId: "GB/T50500-2024",
      quotaLibraryId: "SC-local-quota-placeholder",
      auditState: "draft",
    },
  ],
  versions: [
    {
      versionId: "budget-v1",
      projectId: "qc-demo-heavy-steel",
      versionType: "budget",
      reviewRound: 0,
      submittedVersionId: null,
      approvedVersionId: null,
      description: "送审预算 V1",
      status: "submitted",
      createdBy: "商务专员",
      createdAt: "2026-05-20T09:00:00.000Z",
      sourceFileIds: ["budget-xlsx-v1"],
      auditEventIds: ["audit-budget-v1"],
    },
    {
      versionId: "review-r1",
      projectId: "qc-demo-heavy-steel",
      versionType: "review",
      reviewRound: 1,
      submittedVersionId: "budget-v1",
      approvedVersionId: "approved-r1",
      description: "第一审",
      status: "reviewing",
      createdBy: "注册造价工程师",
      createdAt: "2026-05-23T09:00:00.000Z",
      sourceFileIds: ["budget-xlsx-v1", "approved-import-r1"],
      auditEventIds: ["audit-review-r1"],
    },
  ],
  boqItems: [
    {
      itemId: "boq-site-001",
      projectId: "qc-demo-heavy-steel",
      nodeId: "node-decoration",
      submittedCode: "010101001",
      approvedCode: "010101001",
      submittedName: "平整场地",
      approvedName: "平整场地",
      submittedFeature: "场地清理、场内平整",
      approvedFeature: "场地清理、场内平整",
      unit: "m2",
      submittedQty: 520,
      approvedQty: 520,
      submittedUnitPrice: 8.5,
      approvedUnitPrice: 8.5,
      sourceRef: "GB/T50500-2024",
      ruleId: "qc-rule-site-leveling",
      elementId: "ifc-site",
    },
    {
      itemId: "boq-steel-001",
      projectId: "qc-demo-heavy-steel",
      nodeId: "node-steel",
      submittedCode: "010515001",
      approvedCode: "010515001",
      submittedName: "钢构件",
      approvedName: "钢构件",
      submittedFeature: "Q355B 主梁、钢柱",
      approvedFeature: "Q355B 主梁、钢柱,含节点板复核",
      unit: "t",
      submittedQty: 25.8,
      approvedQty: 27.2,
      submittedUnitPrice: 6800,
      approvedUnitPrice: 6920,
      sourceRef: "GB/T50500-2024",
      ruleId: "qc-rule-steel-member",
      elementId: "ifc-steel-members",
    },
    {
      itemId: "boq-measure-001",
      projectId: "qc-demo-heavy-steel",
      nodeId: "node-decoration",
      submittedCode: "011702001",
      approvedCode: "011702001",
      submittedName: "综合脚手架",
      approvedName: "综合脚手架",
      submittedFeature: "外脚手架",
      approvedFeature: "现场条件不采用",
      unit: "m2",
      submittedQty: 520,
      approvedQty: 0,
      submittedUnitPrice: 42,
      approvedUnitPrice: 42,
      sourceRef: "GB/T50500-2024",
      ruleId: "qc-rule-scaffold",
    },
    {
      itemId: "boq-bolt-001",
      projectId: "qc-demo-heavy-steel",
      nodeId: "node-steel",
      submittedCode: "",
      approvedCode: "010606001",
      submittedName: "",
      approvedName: "高强螺栓",
      submittedFeature: "",
      approvedFeature: "10.9S 摩擦型高强螺栓",
      unit: "套",
      submittedQty: 0,
      approvedQty: 1860,
      submittedUnitPrice: 0,
      approvedUnitPrice: 7.5,
      sourceRef: "GB/T50500-2024",
      ruleId: "qc-rule-high-strength-bolt",
      elementId: "ifc-bolts",
    },
    {
      itemId: "boq-fire-001",
      projectId: "qc-demo-heavy-steel",
      nodeId: "node-steel",
      submittedCode: "011407001",
      approvedCode: "011407001",
      submittedName: "金属面防火涂料",
      approvedName: "金属面防火涂料",
      submittedFeature: "薄型防火涂料",
      approvedFeature: "薄型防火涂料,耐火极限复核",
      unit: "m2",
      submittedQty: 1980,
      approvedQty: 2100,
      submittedUnitPrice: 46,
      approvedUnitPrice: 48,
      sourceRef: "GB/T50500-2024",
      ruleId: "qc-rule-fireproof-coating",
      elementId: "ifc-fireproof-coating",
    },
  ],
};

export const quantityCostingImportedReviewNodes: CostProjectTreeNode[] = [
  {
    nodeId: "import-single",
    projectId: "qc-import-review",
    parentId: null,
    nodeType: "single_project",
    name: "一期样板区",
    specialty: "单项工程",
    sortOrder: 1,
    standardProfileId: "GB/T50500-2024",
    quotaLibraryId: "SC-local-quota-placeholder",
    auditState: "reviewing",
  },
  {
    nodeId: "import-steel",
    projectId: "qc-import-review",
    parentId: "import-single",
    nodeType: "unit_project",
    name: "钢结构工程",
    specialty: "钢结构",
    sortOrder: 2,
    standardProfileId: "GB/T50500-2024",
    quotaLibraryId: "SC-local-quota-placeholder",
    auditState: "reviewing",
  },
  {
    nodeId: "import-mep",
    projectId: "qc-import-review",
    parentId: "import-single",
    nodeType: "unit_project",
    name: "安装工程",
    specialty: "机电安装",
    sortOrder: 3,
    standardProfileId: "GB/T50500-2024",
    quotaLibraryId: "SC-local-quota-placeholder",
    auditState: "reviewing",
  },
];

function costAnalysisSummaryFromItems(
  project: QuantityCostingProject,
  rowId: string,
  items: ComputedCostBoqItem[],
): CostAnalysisSummaryRow {
  const first = items[0]!;
  const node = project.treeNodes.find((item) => item.nodeId === rowId);
  const summary = summarizeComputedItems(items);
  return {
    rowId,
    level: node
      ? node.nodeType === "single_project"
        ? "single_project"
        : "unit_project"
      : "fee",
    nodeId: node?.nodeId ?? first.nodeId,
    nodeName: node?.name ?? first.displayName,
    itemIds: items.map((item) => item.itemId),
    submittedTotal: summary.submittedTotal,
    approvedTotal: summary.approvedTotal,
    amountDelta: summary.amountDelta,
    amountDeltaRatio:
      summary.submittedTotal === 0
        ? summary.approvedTotal === 0
          ? 0
          : 1
        : roundQuantity(summary.amountDelta / summary.submittedTotal),
    increaseAmount: summary.increaseAmount,
    decreaseAmount: summary.decreaseAmount,
    changeMarks: [
      ...new Set(items.map((item) => item.changeMark)),
    ] as CostChangeMark[],
    sourceReviewCount: summary.sourceReviewCount,
  };
}

function findCostProjectAncestor(
  nodes: CostProjectTreeNode[],
  nodeId: string,
  nodeType: CostProjectNodeType,
): CostProjectTreeNode | null {
  const nodeById = new Map(nodes.map((node) => [node.nodeId, node]));
  let current = nodeById.get(nodeId) ?? null;

  while (current) {
    if (current.nodeType === nodeType) {
      return current;
    }
    current = current.parentId
      ? (nodeById.get(current.parentId) ?? null)
      : null;
  }

  return null;
}

function summarizeComputedItems(items: ComputedCostBoqItem[]): CostSummary {
  const markCounts: Record<CostChangeMark, number> = {
    none: 0,
    add: 0,
    delete: 0,
    modify: 0,
    temporary: 0,
  };

  for (const item of items) {
    markCounts[item.changeMark] += 1;
  }

  return {
    submittedTotal: roundMoney(
      items.reduce((sum, item) => sum + item.submittedTotal, 0),
    ),
    approvedTotal: roundMoney(
      items.reduce((sum, item) => sum + item.approvedTotal, 0),
    ),
    amountDelta: roundMoney(
      items.reduce((sum, item) => sum + item.amountDelta, 0),
    ),
    increaseAmount: roundMoney(
      items.reduce((sum, item) => sum + item.increaseAmount, 0),
    ),
    decreaseAmount: roundMoney(
      items.reduce((sum, item) => sum + item.decreaseAmount, 0),
    ),
    sourceReviewCount: items.filter((item) => item.sourceReviewRequired).length,
    markCounts,
  };
}

function classifyBoqChange({
  item,
  submittedTotal,
  approvedTotal,
  amountDelta,
  qtyDelta,
  unitPriceDelta,
}: {
  item: QuantityCostingBoqItem;
  submittedTotal: number;
  approvedTotal: number;
  amountDelta: number;
  qtyDelta: number;
  unitPriceDelta: number;
}): CostChangeMark {
  if (item.temporary) {
    return "temporary";
  }
  if (isZero(submittedTotal) && !isZero(approvedTotal)) {
    return "add";
  }
  if (!isZero(submittedTotal) && isZero(approvedTotal)) {
    return "delete";
  }
  if (
    textChanged(item.submittedCode, item.approvedCode) ||
    textChanged(item.submittedName, item.approvedName) ||
    textChanged(item.submittedFeature, item.approvedFeature) ||
    !isZero(qtyDelta) ||
    !isZero(unitPriceDelta) ||
    !isZero(amountDelta)
  ) {
    return "modify";
  }
  return "none";
}

function classifyAmountChange(
  submittedAmount: number,
  approvedAmount: number,
): CostChangeMark {
  if (isZero(submittedAmount) && !isZero(approvedAmount)) {
    return "add";
  }
  if (!isZero(submittedAmount) && isZero(approvedAmount)) {
    return "delete";
  }
  if (!isZero(roundMoney(approvedAmount - submittedAmount))) {
    return "modify";
  }
  return "none";
}

function generateChangeReason(
  item: QuantityCostingBoqItem,
  changeMark: CostChangeMark,
  qtyDelta: number,
  unitPriceDelta: number,
): string {
  if (changeMark === "temporary") {
    return "【临项】标准、定额或项目依据待补充。";
  }
  if (changeMark === "add") {
    return "【增项】送审合价为空或为 0,审定合价不为 0。";
  }
  if (changeMark === "delete") {
    return "【减项】送审合价不为 0,审定合价为空或为 0。";
  }
  if (changeMark === "none") {
    return "无增减。";
  }
  if (textChanged(item.submittedCode, item.approvedCode)) {
    return "【调项】送审与审定清单编码不同。";
  }
  if (!isZero(qtyDelta) && !isZero(unitPriceDelta)) {
    return "【调量调价】工程量与综合单价均发生变化。";
  }
  if (!isZero(qtyDelta)) {
    return "【调量】送审与审定工程量不同。";
  }
  if (!isZero(unitPriceDelta)) {
    return "【调价】送审与审定综合单价不同。";
  }
  return "【修改】名称、项目特征或构成发生变化。";
}

function generateAmountChangeReason(changeMark: CostChangeMark): string {
  if (changeMark === "add") {
    return "【增项】送审金额为空或为 0,审定金额不为 0。";
  }
  if (changeMark === "delete") {
    return "【减项】送审金额不为 0,审定金额为空或为 0。";
  }
  if (changeMark === "modify") {
    return "【修改】送审金额与审定金额不同。";
  }
  if (changeMark === "temporary") {
    return "【临项】计价依据或项目来源待补充。";
  }
  return "无增减。";
}

function containsText(value: string, keyword: string): boolean {
  return value
    .toLocaleLowerCase("zh-CN")
    .includes(keyword.toLocaleLowerCase("zh-CN"));
}

function balanceIncreaseDecrease(
  input: CostIncreaseStrategyInput,
  amountDelta: number,
  increaseAmount: number,
  formulaParts: string[],
): CostIncreaseStrategyResult {
  const normalizedIncrease = Math.max(roundMoney(increaseAmount), 0);
  const decreaseAmount =
    amountDelta >= 0
      ? Math.max(roundMoney(normalizedIncrease - amountDelta), 0)
      : roundMoney(normalizedIncrease + Math.abs(amountDelta));

  return {
    strategyType: input.strategyType,
    label: input.label,
    amountDelta,
    increaseAmount: normalizedIncrease,
    decreaseAmount,
    formulaSummary: formulaParts.join(" · "),
  };
}

function costProjectMatchRuleHit(
  rule: CostProjectMatchRule,
  currentNode: CostProjectTreeNode,
  importNode: CostProjectTreeNode,
): boolean {
  if (rule === "name") {
    return (
      normalizeMatchText(currentNode.name) ===
      normalizeMatchText(importNode.name)
    );
  }
  if (rule === "specialty") {
    return (
      normalizeMatchText(currentNode.specialty) ===
      normalizeMatchText(importNode.specialty)
    );
  }
  if (rule === "standardProfile") {
    return currentNode.standardProfileId === importNode.standardProfileId;
  }
  return currentNode.quotaLibraryId === importNode.quotaLibraryId;
}

function normalizeMatchText(value: string): string {
  return value.replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
}

function formatRateForFormula(value: number): string {
  return `${roundMoney(value * 100)}%`;
}

function textChanged(left: string, right: string): boolean {
  return left.trim() !== right.trim();
}

function isZero(value: number): boolean {
  return Math.abs(value) < epsilon;
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
