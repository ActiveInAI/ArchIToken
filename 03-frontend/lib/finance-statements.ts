// lib/finance-statements.ts
// License: Apache-2.0
//
// Financial statements (财务报表) + voucher validation, built from ledger
// balances and the chart of accounts. Pure functions so the accounting holds
// without a backend: the balance sheet must balance (资产 = 负债 + 权益 + 利润)
// and a voucher must have equal debits and credits.

import {
  type AccountCategory,
  classifyAccount,
  lookupAccount,
} from "./finance-chart-of-accounts";

const BALANCE_EPSILON = 0.005;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A ledger account's movement used to build statements. */
export interface LedgerBalanceInput {
  readonly code: string;
  readonly name: string;
  readonly openingBalance?: number;
  readonly debitTotal: number;
  readonly creditTotal: number;
}

/** One line on a statement (an account at its normal-direction balance). */
export interface StatementLine {
  readonly code: string;
  readonly name: string;
  readonly category: AccountCategory;
  readonly amount: number;
}

/**
 * An account's balance on its normal side: debit accounts (assets/costs/
 * expenses) are opening + debit − credit; credit accounts (liabilities/equity/
 * revenue) are opening + credit − debit.
 */
export function normalBalance(input: LedgerBalanceInput): number {
  const category = classifyAccount(input.code);
  const isDebit =
    category === "asset" || category === "cost" || category === "expense";
  const opening = input.openingBalance ?? 0;
  const net = input.debitTotal - input.creditTotal;
  return round2(isDebit ? opening + net : opening - net);
}

function toLine(input: LedgerBalanceInput): StatementLine {
  return {
    code: input.code,
    name: input.name,
    category: classifyAccount(input.code) ?? "expense",
    amount: normalBalance(input),
  };
}

/** 利润表(损益表). */
export interface IncomeStatement {
  readonly revenues: StatementLine[];
  readonly expenses: StatementLine[];
  readonly totalRevenue: number;
  readonly totalExpense: number;
  /** 净利润 = 收入 − (成本 + 费用). */
  readonly netProfit: number;
}

/** Build an income statement from ledger balances. */
export function buildIncomeStatement(
  balances: readonly LedgerBalanceInput[],
): IncomeStatement {
  const lines = balances.map(toLine);
  const revenues = lines.filter((l) => l.category === "revenue");
  const expenses = lines.filter(
    (l) => l.category === "expense" || l.category === "cost",
  );
  const totalRevenue = round2(revenues.reduce((s, l) => s + l.amount, 0));
  const totalExpense = round2(expenses.reduce((s, l) => s + l.amount, 0));
  return {
    revenues,
    expenses,
    totalRevenue,
    totalExpense,
    netProfit: round2(totalRevenue - totalExpense),
  };
}

/** 资产负债表. */
export interface BalanceSheet {
  readonly assets: StatementLine[];
  readonly liabilities: StatementLine[];
  readonly equity: StatementLine[];
  readonly totalAssets: number;
  readonly totalLiabilities: number;
  readonly totalEquity: number;
  /** 本期净利润(并入权益侧参与平衡). */
  readonly netProfit: number;
  /** 资产 == 负债 + 权益 + 净利润. */
  readonly balanced: boolean;
}

/** Build a balance sheet from ledger balances. */
export function buildBalanceSheet(
  balances: readonly LedgerBalanceInput[],
): BalanceSheet {
  const lines = balances.map(toLine);
  const assets = lines.filter((l) => l.category === "asset");
  const liabilities = lines.filter((l) => l.category === "liability");
  const equity = lines.filter((l) => l.category === "equity");
  const totalAssets = round2(assets.reduce((s, l) => s + l.amount, 0));
  const totalLiabilities = round2(
    liabilities.reduce((s, l) => s + l.amount, 0),
  );
  const totalEquity = round2(equity.reduce((s, l) => s + l.amount, 0));
  const { netProfit } = buildIncomeStatement(balances);
  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    netProfit,
    balanced:
      Math.abs(totalAssets - (totalLiabilities + totalEquity + netProfit)) <=
      BALANCE_EPSILON,
  };
}

/** A single voucher entry for validation. */
export interface VoucherEntryInput {
  readonly accountCode: string;
  readonly direction: "debit" | "credit";
  readonly amount: number;
}

/** Result of validating a voucher's entries. */
export interface VoucherValidation {
  readonly balanced: boolean;
  readonly debitTotal: number;
  readonly creditTotal: number;
  /** Issues found: unknown account, non-positive amount, unbalanced, empty. */
  readonly issues: string[];
}

/**
 * Validate a draft voucher: debits must equal credits, each line must have a
 * positive amount and a known account. Pure — drives in-form entry feedback.
 */
export function validateVoucherEntries(
  entries: readonly VoucherEntryInput[],
): VoucherValidation {
  const issues: string[] = [];
  if (entries.length === 0) {
    issues.push("凭证无分录");
  }
  for (const entry of entries) {
    if (!lookupAccount(entry.accountCode)) {
      issues.push(`科目 ${entry.accountCode} 不在科目表`);
    }
    if (!(entry.amount > 0)) {
      issues.push(`科目 ${entry.accountCode} 金额必须为正`);
    }
  }
  const debitTotal = round2(
    entries
      .filter((e) => e.direction === "debit")
      .reduce((s, e) => s + e.amount, 0),
  );
  const creditTotal = round2(
    entries
      .filter((e) => e.direction === "credit")
      .reduce((s, e) => s + e.amount, 0),
  );
  const balanced = Math.abs(debitTotal - creditTotal) <= BALANCE_EPSILON;
  if (!balanced) {
    issues.push(`借贷不平:借 ${debitTotal} ≠ 贷 ${creditTotal}`);
  }
  return { balanced: balanced && issues.length === 0, debitTotal, creditTotal, issues };
}
