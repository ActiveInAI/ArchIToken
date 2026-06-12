// lib/quantity-costing-finance-bridge.test.ts - Costing finance bridge tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  calculateCostingDashboard,
  calculateFeeSummaryItem,
  calculateMeasureItem,
  calculateOtherItem,
  quantityCostingPhase1Project,
  quantityCostingPhase2FeeRules,
  quantityCostingPhase2MeasureItems,
  quantityCostingPhase2OtherItems,
} from "./quantity-costing";
import {
  buildCostVoucherPlan,
  reconcileCostVoucherPlan,
  type CostLedgerAccountSnapshot,
} from "./quantity-costing-finance-bridge";

function buildPlan() {
  const dashboard = calculateCostingDashboard(quantityCostingPhase1Project);
  return buildCostVoucherPlan({
    dashboard,
    measureItems: quantityCostingPhase2MeasureItems.map((item) =>
      calculateMeasureItem(item),
    ),
    otherItems: quantityCostingPhase2OtherItems.map((item) =>
      calculateOtherItem(item),
    ),
    feeSummaryItems: quantityCostingPhase2FeeRules.map((rule) =>
      calculateFeeSummaryItem(rule),
    ),
    reviewVersionId: "review-r1",
  });
}

describe("buildCostVoucherPlan", () => {
  it("按单位工程生成借贷平衡的凭证草稿", () => {
    const plan = buildPlan();
    expect(plan.generatedCount).toBeGreaterThan(0);
    for (const voucher of plan.vouchers) {
      if (voucher.generationStatus === "generated") {
        expect(voucher.balanced).toBe(true);
        expect(voucher.debitTotal).toBe(voucher.creditTotal);
        expect(voucher.sourceDocType).toBe("cost_review_version");
      }
    }
  });

  it("凭证借方合计等于审定金额口径", () => {
    const dashboard = calculateCostingDashboard(quantityCostingPhase1Project);
    const plan = buildPlan();
    const boqVoucherDebit = plan.vouchers
      .filter(
        (voucher) =>
          voucher.generationStatus === "generated" &&
          voucher.voucherId !== "voucher-project-summary",
      )
      .reduce((sum, voucher) => sum + voucher.debitTotal, 0);
    expect(boqVoucherDebit).toBeCloseTo(dashboard.summary.approvedTotal, 2);
  });

  it("审定金额为 0 的单位工程跳过并记录原因", () => {
    const emptyDashboard = calculateCostingDashboard({
      ...quantityCostingPhase1Project,
      boqItems: [],
    });
    const plan = buildCostVoucherPlan({
      dashboard: emptyDashboard,
      measureItems: [],
      otherItems: [],
      feeSummaryItems: [],
      reviewVersionId: "review-r1",
    });
    expect(plan.generatedCount).toBe(0);
    expect(plan.skippedCount).toBeGreaterThan(0);
    expect(plan.vouchers[0]?.skipReason).toContain("未生成凭证");
  });

  it("固定科目尾差调整模式生成调整分录", () => {
    const dashboard = calculateCostingDashboard(quantityCostingPhase1Project);
    const plan = buildCostVoucherPlan({
      dashboard,
      measureItems: [],
      otherItems: [],
      feeSummaryItems: [],
      reviewVersionId: "review-r1",
      tailDifferenceMode: "fixed_account",
      fixedTailAccountCode: "660301",
    });
    expect(plan.tailDifferenceMode).toBe("fixed_account");
  });
});

describe("reconcileCostVoucherPlan", () => {
  it("账簿与凭证计划一致时对账平衡", () => {
    const plan = buildPlan();
    const ledger: CostLedgerAccountSnapshot[] = [];
    for (const voucher of plan.vouchers) {
      if (voucher.generationStatus !== "generated") {
        continue;
      }
      for (const entry of voucher.entries) {
        const existing = ledger.find(
          (account) => account.accountCode === entry.accountCode,
        );
        if (existing) {
          existing.periodIncrease += entry.amount;
        } else {
          ledger.push({
            accountCode: entry.accountCode,
            accountName: entry.accountName,
            openingBalance: 0,
            periodIncrease: entry.amount,
            periodDecrease: 0,
            manualEntryCount: 0,
            sourceDocTypes: ["cost_review_version"],
          });
        }
      }
    }
    const report = reconcileCostVoucherPlan(plan, ledger);
    expect(report.unbalancedCount).toBe(0);
    expect(report.conclusion).toContain("对账平衡");
  });

  it("手工凭证与来源单据不符进入差异分析", () => {
    const plan = buildPlan();
    const target = plan.vouchers.find(
      (voucher) => voucher.generationStatus === "generated",
    );
    const entry = target!.entries[0]!;
    const expectedTotal = plan.vouchers
      .filter((voucher) => voucher.generationStatus === "generated")
      .flatMap((voucher) => voucher.entries)
      .filter((candidate) => candidate.accountCode === entry.accountCode)
      .reduce((sum, candidate) => sum + candidate.amount, 0);
    const ledger: CostLedgerAccountSnapshot[] = [
      {
        accountCode: entry.accountCode,
        accountName: entry.accountName,
        openingBalance: 1000,
        periodIncrease: expectedTotal + 500,
        periodDecrease: 0,
        manualEntryCount: 2,
        sourceDocTypes: ["manual_journal"],
      },
    ];
    const report = reconcileCostVoucherPlan(plan, ledger);
    const row = report.rows.find(
      (item) => item.accountCode === entry.accountCode,
    );
    expect(row?.result).toBe("不平衡");
    expect(row?.difference).toBe(500);
    expect(row?.closingBalance).toBe(1000 + expectedTotal + 500);
    expect(
      row?.differenceAnalysis.some((reason) => reason.includes("手工录入")),
    ).toBe(true);
    expect(
      row?.differenceAnalysis.some((reason) => reason.includes("来源单据不符")),
    ).toBe(true);
  });

  it("凭证计划有而账簿无的科目提示缺科目", () => {
    const plan = buildPlan();
    const report = reconcileCostVoucherPlan(plan, []);
    expect(report.unbalancedCount).toBeGreaterThan(0);
    expect(
      report.rows.every((row) =>
        row.result === "平衡"
          ? true
          : row.differenceAnalysis.length > 0,
      ),
    ).toBe(true);
  });
});
