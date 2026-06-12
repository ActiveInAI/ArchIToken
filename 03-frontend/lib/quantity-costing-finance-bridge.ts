import {
  roundMoney,
  type ComputedCostFeeSummaryItem,
  type ComputedCostMeasureItem,
  type ComputedCostOtherItem,
  type QuantityCostingDashboard,
} from "./quantity-costing";

export type CostTailDifferenceMode = "largest_entry" | "fixed_account";

export type CostVoucherEntryDirection = "debit" | "credit";

export interface CostVoucherEntry {
  entryId: string;
  accountCode: string;
  accountName: string;
  direction: CostVoucherEntryDirection;
  amount: number;
  summary: string;
  sourceTable:
    | "cost_boq_items"
    | "cost_measure_items"
    | "cost_other_items"
    | "cost_fee_summary_items";
  sourceNodeId: string | null;
}

export interface CostVoucherDraft {
  voucherId: string;
  sourceDocType: "cost_review_version";
  sourceDocId: string;
  description: string;
  entries: CostVoucherEntry[];
  debitTotal: number;
  creditTotal: number;
  tailDifference: number;
  tailAdjustedEntryId: string | null;
  balanced: boolean;
  generationStatus: "generated" | "skipped";
  skipReason: string | null;
}

export interface CostVoucherPlan {
  planId: string;
  projectId: string;
  projectName: string;
  reviewVersionId: string;
  tailDifferenceMode: CostTailDifferenceMode;
  vouchers: CostVoucherDraft[];
  generatedCount: number;
  skippedCount: number;
  approvedTotal: number;
}

export interface CostVoucherPlanInput {
  dashboard: QuantityCostingDashboard;
  measureItems: ComputedCostMeasureItem[];
  otherItems: ComputedCostOtherItem[];
  feeSummaryItems: ComputedCostFeeSummaryItem[];
  reviewVersionId: string;
  tailDifferenceMode?: CostTailDifferenceMode;
  fixedTailAccountCode?: string;
  fixedTailAccountName?: string;
}

export interface CostLedgerAccountSnapshot {
  accountCode: string;
  accountName: string;
  openingBalance: number;
  periodIncrease: number;
  periodDecrease: number;
  manualEntryCount: number;
  sourceDocTypes: string[];
}

export type CostReconciliationResult = "平衡" | "不平衡";

export interface CostReconciliationRow {
  accountCode: string;
  accountName: string;
  openingBalance: number;
  expectedIncrease: number;
  ledgerIncrease: number;
  ledgerDecrease: number;
  closingBalance: number;
  difference: number;
  result: CostReconciliationResult;
  differenceAnalysis: string[];
}

export interface CostReconciliationReport {
  rows: CostReconciliationRow[];
  balancedCount: number;
  unbalancedCount: number;
  conclusion: string;
}

const constructionInProgressAccount = {
  code: "1604",
  name: "在建工程",
};
const payableAccount = {
  code: "2202",
  name: "应付账款—审定结算款",
};

const reconciliationEpsilon = 0.005;

function buildDebitEntries(
  input: CostVoucherPlanInput,
  unitNodeId: string,
  unitName: string,
): CostVoucherEntry[] {
  const boqAmount = roundMoney(
    input.dashboard.computedItems
      .filter((item) => item.nodeId === unitNodeId)
      .reduce((sum, item) => sum + item.approvedTotal, 0),
  );
  const entries: CostVoucherEntry[] = [];
  if (boqAmount !== 0) {
    entries.push({
      entryId: `${unitNodeId}-boq`,
      accountCode: `${constructionInProgressAccount.code}.01`,
      accountName: `${constructionInProgressAccount.name}—分部分项`,
      direction: "debit",
      amount: boqAmount,
      summary: `${unitName} 分部分项审定金额`,
      sourceTable: "cost_boq_items",
      sourceNodeId: unitNodeId,
    });
  }
  return entries;
}

function buildProjectLevelDebitEntries(
  input: CostVoucherPlanInput,
): CostVoucherEntry[] {
  const entries: CostVoucherEntry[] = [];
  const measureAmount = roundMoney(
    input.measureItems.reduce((sum, item) => sum + item.approvedAmount, 0),
  );
  if (measureAmount !== 0) {
    entries.push({
      entryId: "project-measure",
      accountCode: `${constructionInProgressAccount.code}.02`,
      accountName: `${constructionInProgressAccount.name}—措施项目`,
      direction: "debit",
      amount: measureAmount,
      summary: "措施项目审定金额",
      sourceTable: "cost_measure_items",
      sourceNodeId: null,
    });
  }
  const otherAmount = roundMoney(
    input.otherItems.reduce((sum, item) => sum + item.approvedAmount, 0),
  );
  if (otherAmount !== 0) {
    entries.push({
      entryId: "project-other",
      accountCode: `${constructionInProgressAccount.code}.03`,
      accountName: `${constructionInProgressAccount.name}—其他项目`,
      direction: "debit",
      amount: otherAmount,
      summary: "其他项目审定金额",
      sourceTable: "cost_other_items",
      sourceNodeId: null,
    });
  }
  const feeAmount = roundMoney(
    input.feeSummaryItems.reduce((sum, item) => sum + item.approvedAmount, 0),
  );
  if (feeAmount !== 0) {
    entries.push({
      entryId: "project-fee",
      accountCode: "2221",
      accountName: "应交税费—审定税金",
      direction: "debit",
      amount: feeAmount,
      summary: "费用汇总审定税费",
      sourceTable: "cost_fee_summary_items",
      sourceNodeId: null,
    });
  }
  return entries;
}

function applyTailDifference(
  entries: CostVoucherEntry[],
  tailDifference: number,
  mode: CostTailDifferenceMode,
  fixedAccountCode: string,
  fixedAccountName: string,
): { entries: CostVoucherEntry[]; tailAdjustedEntryId: string | null } {
  if (tailDifference === 0) {
    return { entries, tailAdjustedEntryId: null };
  }
  if (mode === "fixed_account") {
    const adjustment: CostVoucherEntry = {
      entryId: "tail-adjustment",
      accountCode: fixedAccountCode,
      accountName: fixedAccountName,
      direction: tailDifference > 0 ? "credit" : "debit",
      amount: roundMoney(Math.abs(tailDifference)),
      summary: "尾差调整（固定科目）",
      sourceTable: "cost_fee_summary_items",
      sourceNodeId: null,
    };
    return {
      entries: [...entries, adjustment],
      tailAdjustedEntryId: adjustment.entryId,
    };
  }
  const debitEntries = entries.filter((entry) => entry.direction === "debit");
  if (debitEntries.length === 0) {
    return { entries, tailAdjustedEntryId: null };
  }
  const largest = debitEntries.reduce((left, right) =>
    right.amount > left.amount ? right : left,
  );
  const adjusted = entries.map((entry) =>
    entry.entryId === largest.entryId
      ? { ...entry, amount: roundMoney(entry.amount - tailDifference) }
      : entry,
  );
  return { entries: adjusted, tailAdjustedEntryId: largest.entryId };
}

export function buildCostVoucherPlan(
  input: CostVoucherPlanInput,
): CostVoucherPlan {
  const mode = input.tailDifferenceMode ?? "largest_entry";
  const fixedAccountCode = input.fixedTailAccountCode ?? "6603";
  const fixedAccountName = input.fixedTailAccountName ?? "财务费用—尾差调整";
  const project = input.dashboard.project;
  const unitNodes = project.treeNodes.filter(
    (node) => node.nodeType === "unit_project",
  );

  const vouchers: CostVoucherDraft[] = [];
  for (const node of unitNodes) {
    const debitEntries = buildDebitEntries(input, node.nodeId, node.name);
    if (debitEntries.length === 0) {
      vouchers.push({
        voucherId: `voucher-${node.nodeId}`,
        sourceDocType: "cost_review_version",
        sourceDocId: input.reviewVersionId,
        description: `${node.name} 审定结算凭证`,
        entries: [],
        debitTotal: 0,
        creditTotal: 0,
        tailDifference: 0,
        tailAdjustedEntryId: null,
        balanced: true,
        generationStatus: "skipped",
        skipReason: "单位工程审定金额为 0，未生成凭证。",
      });
      continue;
    }
    const debitTotal = roundMoney(
      debitEntries.reduce((sum, entry) => sum + entry.amount, 0),
    );
    const creditEntry: CostVoucherEntry = {
      entryId: `${node.nodeId}-payable`,
      accountCode: payableAccount.code,
      accountName: payableAccount.name,
      direction: "credit",
      amount: debitTotal,
      summary: `${node.name} 审定结算应付`,
      sourceTable: "cost_boq_items",
      sourceNodeId: node.nodeId,
    };
    const rawEntries = [...debitEntries, creditEntry];
    const creditTotal = creditEntry.amount;
    const tailDifference = roundMoney(debitTotal - creditTotal);
    const { entries, tailAdjustedEntryId } = applyTailDifference(
      rawEntries,
      tailDifference,
      mode,
      fixedAccountCode,
      fixedAccountName,
    );
    const finalDebit = roundMoney(
      entries
        .filter((entry) => entry.direction === "debit")
        .reduce((sum, entry) => sum + entry.amount, 0),
    );
    const finalCredit = roundMoney(
      entries
        .filter((entry) => entry.direction === "credit")
        .reduce((sum, entry) => sum + entry.amount, 0),
    );
    vouchers.push({
      voucherId: `voucher-${node.nodeId}`,
      sourceDocType: "cost_review_version",
      sourceDocId: input.reviewVersionId,
      description: `${node.name} 审定结算凭证`,
      entries,
      debitTotal: finalDebit,
      creditTotal: finalCredit,
      tailDifference,
      tailAdjustedEntryId,
      balanced: Math.abs(finalDebit - finalCredit) <= reconciliationEpsilon,
      generationStatus: "generated",
      skipReason: null,
    });
  }

  const projectEntries = buildProjectLevelDebitEntries(input);
  if (projectEntries.length > 0) {
    const debitTotal = roundMoney(
      projectEntries.reduce((sum, entry) => sum + entry.amount, 0),
    );
    const creditEntry: CostVoucherEntry = {
      entryId: "project-payable",
      accountCode: payableAccount.code,
      accountName: payableAccount.name,
      direction: "credit",
      amount: debitTotal,
      summary: `${project.projectName} 措施/其他/税费审定应付`,
      sourceTable: "cost_fee_summary_items",
      sourceNodeId: null,
    };
    vouchers.push({
      voucherId: "voucher-project-summary",
      sourceDocType: "cost_review_version",
      sourceDocId: input.reviewVersionId,
      description: `${project.projectName} 措施/其他/税费审定凭证`,
      entries: [...projectEntries, creditEntry],
      debitTotal,
      creditTotal: debitTotal,
      tailDifference: 0,
      tailAdjustedEntryId: null,
      balanced: true,
      generationStatus: "generated",
      skipReason: null,
    });
  }

  const generated = vouchers.filter(
    (voucher) => voucher.generationStatus === "generated",
  );
  return {
    planId: `voucher-plan-${input.reviewVersionId}`,
    projectId: project.projectId,
    projectName: project.projectName,
    reviewVersionId: input.reviewVersionId,
    tailDifferenceMode: mode,
    vouchers,
    generatedCount: generated.length,
    skippedCount: vouchers.length - generated.length,
    approvedTotal: roundMoney(
      generated.reduce((sum, voucher) => sum + voucher.debitTotal, 0),
    ),
  };
}

export function reconcileCostVoucherPlan(
  plan: CostVoucherPlan,
  ledgerAccounts: CostLedgerAccountSnapshot[],
): CostReconciliationReport {
  const expectedByAccount = new Map<string, { name: string; amount: number }>();
  for (const voucher of plan.vouchers) {
    if (voucher.generationStatus !== "generated") {
      continue;
    }
    for (const entry of voucher.entries) {
      const current = expectedByAccount.get(entry.accountCode);
      expectedByAccount.set(entry.accountCode, {
        name: entry.accountName,
        amount: roundMoney((current?.amount ?? 0) + entry.amount),
      });
    }
  }

  const skippedVouchers = plan.vouchers.filter(
    (voucher) => voucher.generationStatus === "skipped",
  );

  const accountCodes = new Set<string>([
    ...expectedByAccount.keys(),
    ...ledgerAccounts.map((account) => account.accountCode),
  ]);

  const rows: CostReconciliationRow[] = [...accountCodes].map((accountCode) => {
    const expected = expectedByAccount.get(accountCode);
    const ledger = ledgerAccounts.find(
      (account) => account.accountCode === accountCode,
    );
    const expectedIncrease = expected?.amount ?? 0;
    const ledgerIncrease = ledger?.periodIncrease ?? 0;
    const ledgerDecrease = ledger?.periodDecrease ?? 0;
    const openingBalance = ledger?.openingBalance ?? 0;
    const closingBalance = roundMoney(
      openingBalance + ledgerIncrease - ledgerDecrease,
    );
    const difference = roundMoney(ledgerIncrease - expectedIncrease);
    const balanced = Math.abs(difference) <= reconciliationEpsilon;

    const differenceAnalysis: string[] = [];
    if (!balanced) {
      if (skippedVouchers.length > 0) {
        differenceAnalysis.push(
          `单据未生成凭证: ${skippedVouchers.length} 张凭证被跳过（${skippedVouchers
            .map((voucher) => voucher.skipReason ?? voucher.voucherId)
            .join("；")}）`,
        );
      }
      if (!expected && ledger) {
        differenceAnalysis.push(
          "凭证不包含指定科目: 账簿存在该科目发生额，但凭证计划未生成对应分录",
        );
      }
      if (expected && !ledger) {
        differenceAnalysis.push(
          "凭证不包含指定科目: 凭证计划生成了分录，但账簿未见该科目发生额",
        );
      }
      if (ledger && ledger.manualEntryCount > 0) {
        differenceAnalysis.push(
          `凭证手工录入: 账簿存在 ${ledger.manualEntryCount} 笔总账手工凭证`,
        );
      }
      if (
        ledger &&
        ledger.sourceDocTypes.length > 0 &&
        !ledger.sourceDocTypes.includes("cost_review_version")
      ) {
        differenceAnalysis.push(
          `凭证来源单据不符: 账簿来源为 ${ledger.sourceDocTypes.join("、")}，非审定结算单据`,
        );
      }
      if (differenceAnalysis.length === 0) {
        differenceAnalysis.push("差异原因未定位，请联查明细账。");
      }
    }

    return {
      accountCode,
      accountName: expected?.name ?? ledger?.accountName ?? accountCode,
      openingBalance,
      expectedIncrease,
      ledgerIncrease,
      ledgerDecrease,
      closingBalance,
      difference,
      result: balanced ? ("平衡" as const) : ("不平衡" as const),
      differenceAnalysis,
    };
  });

  const balancedCount = rows.filter((row) => row.result === "平衡").length;
  const unbalancedCount = rows.length - balancedCount;
  return {
    rows,
    balancedCount,
    unbalancedCount,
    conclusion:
      unbalancedCount === 0
        ? `对账平衡: ${balancedCount}/${rows.length} 个科目全部平衡。`
        : `对账不平衡: ${unbalancedCount} 个科目存在差异，需差异分析。`,
  };
}
