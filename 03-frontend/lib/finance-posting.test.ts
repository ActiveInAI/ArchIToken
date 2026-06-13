// lib/finance-posting.test.ts
// License: Apache-2.0
import { describe, expect, it } from "vitest";

import type {
  CostVoucherDraft,
  CostVoucherPlan,
} from "./quantity-costing-finance-bridge";
import { postCostVoucherPlan, postToGeneralLedger } from "./finance-posting";

function draft(
  id: string,
  entries: CostVoucherDraft["entries"],
  status: CostVoucherDraft["generationStatus"] = "generated",
  skipReason: string | null = null,
): CostVoucherDraft {
  const debitTotal = entries
    .filter((e) => e.direction === "debit")
    .reduce((s, e) => s + e.amount, 0);
  const creditTotal = entries
    .filter((e) => e.direction === "credit")
    .reduce((s, e) => s + e.amount, 0);
  return {
    voucherId: id,
    sourceDocType: "cost_review_version",
    sourceDocId: "rv-1",
    description: `凭证 ${id}`,
    entries,
    debitTotal,
    creditTotal,
    tailDifference: 0,
    tailAdjustedEntryId: null,
    balanced: Math.abs(debitTotal - creditTotal) < 0.005,
    generationStatus: status,
    skipReason,
  };
}

function entry(
  accountCode: string,
  accountName: string,
  direction: "debit" | "credit",
  amount: number,
): CostVoucherDraft["entries"][number] {
  return {
    entryId: `${accountCode}-${direction}`,
    accountCode,
    accountName,
    direction,
    amount,
    summary: `${accountName} ${direction}`,
    sourceTable: "cost_boq_items",
    sourceNodeId: null,
  };
}

const plan: CostVoucherPlan = {
  planId: "plan-1",
  projectId: "proj-1",
  projectName: "渝北区某安置房项目",
  reviewVersionId: "rv-1",
  tailDifferenceMode: "fixed_account",
  vouchers: [
    draft("v1", [
      entry("1604", "在建工程", "debit", 100000),
      entry("2202", "应付账款—审定结算款", "credit", 100000),
    ]),
    draft("v2", [
      entry("1604", "在建工程", "debit", 50000),
      entry("2221", "应交税费", "credit", 50000),
    ]),
    draft("v3", [], "skipped", "无审定金额"),
  ],
  generatedCount: 2,
  skippedCount: 1,
  approvedTotal: 150000,
};

describe("postCostVoucherPlan — 草稿入库为正式凭证", () => {
  const result = postCostVoucherPlan(plan, { period: "2026-06" });

  it("posts generated drafts with sequential voucher numbers", () => {
    const posted = result.vouchers.filter((v) => v.status === "posted");
    expect(posted.map((v) => v.voucherNo)).toEqual(["记-001", "记-002"]);
    expect(result.postedCount).toBe(2);
  });

  it("carries skipped drafts through with their reason", () => {
    const skipped = result.vouchers.find((v) => v.status === "skipped");
    expect(result.skippedCount).toBe(1);
    expect(skipped?.skipReason).toBe("无审定金额");
    expect(skipped?.voucherNo).toBe("");
  });

  it("each posted voucher balances and the totals match", () => {
    expect(result.balanced).toBe(true);
    expect(result.totalDebit).toBe(150000);
    expect(result.totalCredit).toBe(150000);
  });

  it("honours a custom voucher word", () => {
    const custom = postCostVoucherPlan(plan, { period: "2026-06", voucherWord: "转" });
    expect(custom.vouchers[0]?.voucherNo).toBe("转-001");
  });
});

describe("postToGeneralLedger — 过账与试算平衡", () => {
  const posted = postCostVoucherPlan(plan, { period: "2026-06" });
  const ledger = postToGeneralLedger(posted.vouchers);

  it("aggregates entries by account code", () => {
    const ci = ledger.accounts.find((a) => a.accountCode === "1604");
    expect(ci?.debitTotal).toBe(150000);
    expect(ci?.closingBalance).toBe(150000);
  });

  it("produces a balanced trial balance (debit === credit)", () => {
    expect(ledger.debitTotal).toBe(150000);
    expect(ledger.creditTotal).toBe(150000);
    expect(ledger.balanced).toBe(true);
  });

  it("applies opening balances to closing", () => {
    const withOpening = postToGeneralLedger(posted.vouchers, { "1604": 20000 });
    const ci = withOpening.accounts.find((a) => a.accountCode === "1604");
    expect(ci?.closingBalance).toBe(170000);
  });

  it("ignores skipped vouchers", () => {
    expect(ledger.accounts.every((a) => a.accountCode !== "")).toBe(true);
  });
});
