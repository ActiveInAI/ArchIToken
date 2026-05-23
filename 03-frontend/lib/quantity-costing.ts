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

export type CostNumericField =
  | "submittedTotal"
  | "approvedTotal"
  | "amountDelta"
  | "qtyDelta"
  | "unitPriceDelta"
  | "amountDeltaRatio";

export type CostNumericOperator = "abs_gte" | "gte" | "lte";

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
  return {
    ...item,
    submittedAmount,
    approvedAmount,
    amountDelta,
    changeMark: classifyAmountChange(submittedAmount, approvedAmount),
    sourceReviewRequired:
      item.sourceRef.trim() === "" || item.sourceRuleId.trim() === "",
  };
}

export function calculateOtherItem(item: CostOtherItem): ComputedCostOtherItem {
  return {
    ...item,
    amountDelta: roundMoney(item.approvedAmount - item.submittedAmount),
    changeMark: classifyAmountChange(item.submittedAmount, item.approvedAmount),
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
  return {
    ...rule,
    submittedAmount,
    approvedAmount,
    amountDelta: roundMoney(approvedAmount - submittedAmount),
    changeMark: classifyAmountChange(submittedAmount, approvedAmount),
    sourceReviewRequired:
      rule.sourceRef.trim() === "" || rule.sourceRuleId.trim() === "",
  };
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
    autoChangeReason: generateChangeReason(
      item,
      changeMark,
      qtyDelta,
      unitPriceDelta,
    ),
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

  if (direction === "submitted_to_approved") {
    return {
      item: {
        ...item,
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
      ...item,
      submittedCode: item.approvedCode,
      submittedName: item.approvedName,
      submittedFeature: item.approvedFeature,
      submittedQty: item.approvedQty,
      submittedUnitPrice: item.approvedUnitPrice,
    },
    blockedReason: null,
  };
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
      !containsText(item.autoChangeReason, filters.changeReasonContains)
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
];

export const quantityCostingPhase2FeeRules: CostFeeRule[] = [
  {
    feeId: "fee-tax-demo",
    name: "税金",
    submittedBaseAmount: 292780 + 10247.3 + 5270.04 + 50000,
    approvedBaseAmount: 307394 + 11680.97 + 5533.09 + 41800,
    submittedRate: 0.09,
    approvedRate: 0.09,
    sourceRuleId: "fee-rule-tax-demo",
    sourceRef: "",
  },
];

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

function containsText(value: string, keyword: string): boolean {
  return value
    .toLocaleLowerCase("zh-CN")
    .includes(keyword.toLocaleLowerCase("zh-CN"));
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
