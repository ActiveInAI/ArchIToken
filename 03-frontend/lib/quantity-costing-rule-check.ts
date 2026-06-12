import {
  calculateQuotaUnitPrice,
  findQuotaItemByBoqCode,
  roundMoney,
  roundQuantity,
  validateBoqCode,
  type ComputedCostBoqItem,
  type CostingStandardRegistry,
  type QuantityCostingDashboard,
} from "./quantity-costing";
import {
  evaluateCostExpression,
  type CostExpressionVariable,
} from "./quantity-costing-expression";

export type CostRuleSeverity = "error" | "warning" | "info";

export interface CostRuleFinding {
  findingId: string;
  ruleId: string;
  ruleName: string;
  severity: CostRuleSeverity;
  targetType: "boq_item" | "summary";
  targetId: string;
  targetLabel: string;
  result: string;
  basis: string;
  suggestion: string;
}

export interface CostRuleCheckRuleResult {
  ruleId: string;
  ruleName: string;
  basis: string;
  checkedCount: number;
  findings: CostRuleFinding[];
  passed: boolean;
}

export interface CostRuleCheckReport {
  ruleResults: CostRuleCheckRuleResult[];
  findings: CostRuleFinding[];
  checkedRuleCount: number;
  passedRuleCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  conclusion: string;
}

export interface CostRuleCheckExpressionInput {
  itemId: string;
  approvedExpression: string;
  variables?: CostExpressionVariable[];
}

export interface CostRuleCheckOptions {
  unitPriceDeviationThreshold?: number;
  expressionInputs?: CostRuleCheckExpressionInput[];
  variables?: CostExpressionVariable[];
}

const balanceEpsilon = 0.005;
const quantityEpsilon = 0.00005;

interface RuleDefinition {
  ruleId: string;
  ruleName: string;
  basis: string;
}

const ruleDefinitions = {
  codeFormat: {
    ruleId: "QC-CODE-001",
    ruleName: "编码格式校验",
    basis: "GB/T50500-2024 清单编码 9 位规则",
  },
  codeDuplicate: {
    ruleId: "QC-CODE-002",
    ruleName: "编码重复校验",
    basis: "GB/T50500-2024 同一单位工程清单编码唯一",
  },
  quotaMatch: {
    ruleId: "QC-QUOTA-001",
    ruleName: "定额组价依据校验",
    basis: "国家/地方标准定额库匹配",
  },
  unitConsistency: {
    ruleId: "QC-UNIT-001",
    ruleName: "计量单位一致性校验",
    basis: "GB/T50500-2024 计量单位与定额库一致",
  },
  priceDeviation: {
    ruleId: "QC-PRICE-001",
    ruleName: "综合单价偏差校验",
    basis: "定额组价基准 ± 偏差阈值",
  },
  balance: {
    ruleId: "QC-BAL-001",
    ruleName: "核增核减平衡校验",
    basis: "核增-核减=增减金额平衡规则",
  },
  changeReason: {
    ruleId: "QC-REASON-001",
    ruleName: "增减说明完整性校验",
    basis: "编审差异规则: 变更项须有增减说明",
  },
  sourceReview: {
    ruleId: "QC-SRC-001",
    ruleName: "来源复核校验",
    basis: "标准/定额来源可追溯要求",
  },
  expressionConsistency: {
    ruleId: "QC-EXPR-001",
    ruleName: "计算式一致性校验",
    basis: "工程量明细计算式与审定工程量一致",
  },
} satisfies Record<string, RuleDefinition>;

function itemLabel(item: ComputedCostBoqItem): string {
  return `${item.displayCode || "(无编码)"} ${item.displayName}`.trim();
}

function buildRuleResult(
  definition: RuleDefinition,
  checkedCount: number,
  findings: CostRuleFinding[],
): CostRuleCheckRuleResult {
  return {
    ruleId: definition.ruleId,
    ruleName: definition.ruleName,
    basis: definition.basis,
    checkedCount,
    findings,
    passed: findings.length === 0,
  };
}

function createFinding(
  definition: RuleDefinition,
  severity: CostRuleSeverity,
  targetType: "boq_item" | "summary",
  targetId: string,
  targetLabel: string,
  result: string,
  suggestion: string,
): CostRuleFinding {
  return {
    findingId: `${definition.ruleId}-${targetId}`,
    ruleId: definition.ruleId,
    ruleName: definition.ruleName,
    severity,
    targetType,
    targetId,
    targetLabel,
    result,
    basis: definition.basis,
    suggestion,
  };
}

export function runCostingRuleChecks(
  dashboard: QuantityCostingDashboard,
  registry: CostingStandardRegistry,
  options: CostRuleCheckOptions = {},
): CostRuleCheckReport {
  const items = dashboard.computedItems;
  const threshold = options.unitPriceDeviationThreshold ?? 0.15;
  const ruleResults: CostRuleCheckRuleResult[] = [];

  const codeFormatFindings: CostRuleFinding[] = [];
  for (const item of items) {
    const sides: Array<["送审" | "审定", string]> = [
      ["送审", item.submittedCode],
      ["审定", item.approvedCode],
    ];
    for (const [sideLabel, code] of sides) {
      if (code.trim() !== "" && !validateBoqCode(code)) {
        codeFormatFindings.push(
          createFinding(
            ruleDefinitions.codeFormat,
            "error",
            "boq_item",
            `${item.itemId}-${sideLabel}`,
            itemLabel(item),
            `${sideLabel}编码 "${code}" 不符合 9 位数字规则`,
            "按 GB/T50500-2024 清单编码规则修正编码。",
          ),
        );
      }
    }
  }
  ruleResults.push(
    buildRuleResult(ruleDefinitions.codeFormat, items.length, codeFormatFindings),
  );

  const codeDuplicateFindings: CostRuleFinding[] = [];
  const codeGroups = new Map<string, ComputedCostBoqItem[]>();
  for (const item of items) {
    if (item.changeMark === "delete") {
      continue;
    }
    const code = item.approvedCode.trim() || item.submittedCode.trim();
    if (code === "") {
      continue;
    }
    const key = `${item.nodeId}::${code}`;
    codeGroups.set(key, [...(codeGroups.get(key) ?? []), item]);
  }
  for (const [key, group] of codeGroups) {
    if (group.length > 1) {
      codeDuplicateFindings.push(
        createFinding(
          ruleDefinitions.codeDuplicate,
          "warning",
          "boq_item",
          key,
          group.map(itemLabel).join("、"),
          `同一单位工程下编码重复 ${group.length} 次`,
          "拆分项目特征或调整清单编码顺序码。",
        ),
      );
    }
  }
  ruleResults.push(
    buildRuleResult(
      ruleDefinitions.codeDuplicate,
      codeGroups.size,
      codeDuplicateFindings,
    ),
  );

  const quotaMatchFindings: CostRuleFinding[] = [];
  const unitConsistencyFindings: CostRuleFinding[] = [];
  const priceDeviationFindings: CostRuleFinding[] = [];
  let quotaCheckedCount = 0;
  for (const item of items) {
    if (item.changeMark === "delete") {
      continue;
    }
    const code = item.approvedCode.trim() || item.submittedCode.trim();
    if (!validateBoqCode(code)) {
      continue;
    }
    quotaCheckedCount += 1;
    const quotaItem = findQuotaItemByBoqCode(registry, code);
    if (!quotaItem) {
      quotaMatchFindings.push(
        createFinding(
          ruleDefinitions.quotaMatch,
          "warning",
          "boq_item",
          item.itemId,
          itemLabel(item),
          `编码 ${code} 未匹配到定额库 ${registry.quotaLibraries
            .map((library) => library.quotaLibraryId)
            .join("、")}`,
          "补充定额组价依据或确认为补充清单项。",
        ),
      );
      continue;
    }
    if (
      item.unit.trim() !== "" &&
      quotaItem.unit.trim() !== "" &&
      item.unit.trim() !== quotaItem.unit.trim()
    ) {
      unitConsistencyFindings.push(
        createFinding(
          ruleDefinitions.unitConsistency,
          "error",
          "boq_item",
          item.itemId,
          itemLabel(item),
          `清单单位 "${item.unit}" 与定额单位 "${quotaItem.unit}" 不一致`,
          "统一计量单位后重新核对工程量与单价。",
        ),
      );
    }
    const breakdown = calculateQuotaUnitPrice(registry, quotaItem.quotaItemId);
    if (breakdown.unitPrice > 0 && item.approvedUnitPrice > 0) {
      const deviation =
        (item.approvedUnitPrice - breakdown.unitPrice) / breakdown.unitPrice;
      if (Math.abs(deviation) > threshold) {
        priceDeviationFindings.push(
          createFinding(
            ruleDefinitions.priceDeviation,
            "warning",
            "boq_item",
            item.itemId,
            itemLabel(item),
            `审定综合单价 ${roundMoney(item.approvedUnitPrice)} 偏离定额组价 ${roundMoney(
              breakdown.unitPrice,
            )} 达 ${(deviation * 100).toFixed(1)}%（阈值 ±${(threshold * 100).toFixed(0)}%）`,
            "复核人材机含量与市场价来源，必要时出具单价分析。",
          ),
        );
      }
    }
  }
  ruleResults.push(
    buildRuleResult(
      ruleDefinitions.quotaMatch,
      quotaCheckedCount,
      quotaMatchFindings,
    ),
  );
  ruleResults.push(
    buildRuleResult(
      ruleDefinitions.unitConsistency,
      quotaCheckedCount,
      unitConsistencyFindings,
    ),
  );
  ruleResults.push(
    buildRuleResult(
      ruleDefinitions.priceDeviation,
      quotaCheckedCount,
      priceDeviationFindings,
    ),
  );

  const balanceFindings: CostRuleFinding[] = [];
  const balanceGap = roundMoney(
    dashboard.summary.increaseAmount -
      dashboard.summary.decreaseAmount -
      dashboard.summary.amountDelta,
  );
  if (Math.abs(balanceGap) > balanceEpsilon) {
    balanceFindings.push(
      createFinding(
        ruleDefinitions.balance,
        "error",
        "summary",
        dashboard.project.projectId,
        dashboard.project.projectName,
        `核增 ${roundMoney(dashboard.summary.increaseAmount)} - 核减 ${roundMoney(
          dashboard.summary.decreaseAmount,
        )} 与增减金额 ${roundMoney(dashboard.summary.amountDelta)} 相差 ${balanceGap}`,
        "检查核增核减策略设置后重新分析。",
      ),
    );
  }
  ruleResults.push(buildRuleResult(ruleDefinitions.balance, 1, balanceFindings));

  const changeReasonFindings: CostRuleFinding[] = [];
  for (const item of items) {
    if (item.changeMark !== "none" && item.changeReason.trim() === "") {
      changeReasonFindings.push(
        createFinding(
          ruleDefinitions.changeReason,
          "warning",
          "boq_item",
          item.itemId,
          itemLabel(item),
          "存在增减变更但缺少增减说明",
          "批量生成增减说明或手工补充变更原因。",
        ),
      );
    }
  }
  ruleResults.push(
    buildRuleResult(
      ruleDefinitions.changeReason,
      items.length,
      changeReasonFindings,
    ),
  );

  const sourceReviewFindings: CostRuleFinding[] = [];
  for (const item of items) {
    if (item.sourceReviewRequired) {
      sourceReviewFindings.push(
        createFinding(
          ruleDefinitions.sourceReview,
          "info",
          "boq_item",
          item.itemId,
          itemLabel(item),
          "来源待复核，标准/定额依据未确认",
          "在标准族库确认来源后回填 sourceRef。",
        ),
      );
    }
  }
  ruleResults.push(
    buildRuleResult(
      ruleDefinitions.sourceReview,
      items.length,
      sourceReviewFindings,
    ),
  );

  const expressionFindings: CostRuleFinding[] = [];
  const expressionInputs = options.expressionInputs ?? [];
  for (const input of expressionInputs) {
    const item = items.find((candidate) => candidate.itemId === input.itemId);
    if (!item) {
      continue;
    }
    const evaluation = evaluateCostExpression(input.approvedExpression, [
      ...(options.variables ?? []),
      ...(input.variables ?? []),
    ]);
    if (evaluation.status === "failed") {
      expressionFindings.push(
        createFinding(
          ruleDefinitions.expressionConsistency,
          "error",
          "boq_item",
          item.itemId,
          itemLabel(item),
          `审定计算式无法解析: ${evaluation.error}`,
          "修正计算式语法后重新校验。",
        ),
      );
      continue;
    }
    if (evaluation.status === "manual_review_required") {
      expressionFindings.push(
        createFinding(
          ruleDefinitions.expressionConsistency,
          "warning",
          "boq_item",
          item.itemId,
          itemLabel(item),
          `审定计算式${evaluation.error}`,
          "补充变量定义或改为常数计算式。",
        ),
      );
      continue;
    }
    const gap = roundQuantity((evaluation.value ?? 0) - item.approvedQty);
    if (Math.abs(gap) > quantityEpsilon) {
      expressionFindings.push(
        createFinding(
          ruleDefinitions.expressionConsistency,
          "error",
          "boq_item",
          item.itemId,
          itemLabel(item),
          `计算式结果 ${evaluation.value} 与审定工程量 ${roundQuantity(
            item.approvedQty,
          )} 相差 ${gap}`,
          "同步计算式结果到审定工程量，或修正计算式。",
        ),
      );
    }
  }
  ruleResults.push(
    buildRuleResult(
      ruleDefinitions.expressionConsistency,
      expressionInputs.length,
      expressionFindings,
    ),
  );

  const findings = ruleResults.flatMap((result) => result.findings);
  const errorCount = findings.filter(
    (finding) => finding.severity === "error",
  ).length;
  const warningCount = findings.filter(
    (finding) => finding.severity === "warning",
  ).length;
  const infoCount = findings.filter(
    (finding) => finding.severity === "info",
  ).length;
  const passedRuleCount = ruleResults.filter((result) => result.passed).length;

  return {
    ruleResults,
    findings,
    checkedRuleCount: ruleResults.length,
    passedRuleCount,
    errorCount,
    warningCount,
    infoCount,
    conclusion:
      errorCount > 0
        ? `校验未通过: ${errorCount} 项需整改、${warningCount} 项待复核。`
        : warningCount > 0
          ? `校验基本通过: ${warningCount} 项待复核、${infoCount} 项提示。`
          : `校验通过: ${passedRuleCount}/${ruleResults.length} 项规则全部通过。`,
  };
}
