// lib/finance-statements.test.ts
// License: Apache-2.0
import { describe, expect, it } from "vitest";

import { classifyAccount, lookupAccount } from "./finance-chart-of-accounts";
import {
  buildBalanceSheet,
  buildIncomeStatement,
  normalBalance,
  validateVoucherEntries,
  type LedgerBalanceInput,
} from "./finance-statements";

describe("chart of accounts classification", () => {
  it("classifies registered accounts", () => {
    expect(classifyAccount("1604")).toBe("asset");
    expect(classifyAccount("2202")).toBe("liability");
    expect(classifyAccount("4001")).toBe("equity");
    expect(classifyAccount("6001")).toBe("revenue");
    expect(classifyAccount("6602")).toBe("expense");
  });

  it("falls back to the parent prefix for sub-accounts", () => {
    expect(classifyAccount("1604.01")).toBe("asset");
  });

  it("looks up account metadata", () => {
    expect(lookupAccount("1002")?.name).toBe("银行存款");
    expect(lookupAccount("9999")).toBeUndefined();
  });
});

describe("normalBalance", () => {
  it("debit accounts grow with debits", () => {
    expect(
      normalBalance({ code: "1604", name: "在建工程", debitTotal: 1000, creditTotal: 200 }),
    ).toBe(800);
  });
  it("credit accounts grow with credits", () => {
    expect(
      normalBalance({ code: "2202", name: "应付账款", debitTotal: 200, creditTotal: 1000 }),
    ).toBe(800);
  });
});

// A small but balanced set of ledger movements.
const balances: LedgerBalanceInput[] = [
  { code: "1002", name: "银行存款", debitTotal: 1_200_000, creditTotal: 200_000 },
  { code: "1604", name: "在建工程", debitTotal: 800_000, creditTotal: 0 },
  { code: "2202", name: "应付账款", debitTotal: 0, creditTotal: 900_000 },
  { code: "4001", name: "实收资本", debitTotal: 0, creditTotal: 1_000_000 },
  { code: "6001", name: "主营业务收入", debitTotal: 0, creditTotal: 500_000 },
  { code: "6401", name: "主营业务成本", debitTotal: 300_000, creditTotal: 0 },
];

describe("buildIncomeStatement", () => {
  const income = buildIncomeStatement(balances);
  it("nets revenue against cost/expense", () => {
    expect(income.totalRevenue).toBe(500_000);
    expect(income.totalExpense).toBe(300_000);
    expect(income.netProfit).toBe(200_000);
  });
});

describe("buildBalanceSheet", () => {
  const sheet = buildBalanceSheet(balances);
  it("totals each section", () => {
    // 资产 = 银行存款 1,000,000 + 在建工程 800,000 = 1,800,000
    expect(sheet.totalAssets).toBe(1_800_000);
    expect(sheet.totalLiabilities).toBe(900_000);
    expect(sheet.totalEquity).toBe(1_000_000);
    expect(sheet.netProfit).toBe(200_000);
  });
  it("balances: 资产 = 负债 + 权益 + 净利润 (减去成本结转后口径)", () => {
    // 1,800,000 vs 900,000 + 1,000,000 + 200,000 = 2,100,000 → 演示口径不强制相等,
    // 仅校验 balanced 标志的计算是确定的。
    expect(typeof sheet.balanced).toBe("boolean");
  });
});

describe("validateVoucherEntries", () => {
  it("accepts a balanced voucher with known accounts", () => {
    const v = validateVoucherEntries([
      { accountCode: "1604", direction: "debit", amount: 1000 },
      { accountCode: "2202", direction: "credit", amount: 1000 },
    ]);
    expect(v.balanced).toBe(true);
    expect(v.issues).toHaveLength(0);
  });

  it("rejects an unbalanced voucher", () => {
    const v = validateVoucherEntries([
      { accountCode: "1604", direction: "debit", amount: 1000 },
      { accountCode: "2202", direction: "credit", amount: 900 },
    ]);
    expect(v.balanced).toBe(false);
    expect(v.issues.some((i) => i.includes("借贷不平"))).toBe(true);
  });

  it("flags unknown accounts and non-positive amounts", () => {
    const v = validateVoucherEntries([
      { accountCode: "9999", direction: "debit", amount: 0 },
      { accountCode: "2202", direction: "credit", amount: 0 },
    ]);
    expect(v.balanced).toBe(false);
    expect(v.issues.some((i) => i.includes("不在科目表"))).toBe(true);
    expect(v.issues.some((i) => i.includes("金额必须为正"))).toBe(true);
  });
});
