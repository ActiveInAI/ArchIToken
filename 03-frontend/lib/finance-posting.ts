// lib/finance-posting.ts
// License: Apache-2.0
//
// Cost → Finance posting chain (issue: 造价→财务凭证贯通).
//
// The quantity-costing side already produces voucher drafts
// (`buildCostVoucherPlan` in quantity-costing-finance-bridge.ts). This module
// is the finance side of that chain: it takes a cost voucher plan, *posts* its
// generated drafts as numbered formal vouchers in an accounting period, then
// rolls them up into a general ledger with a trial balance. Everything here is
// pure so the accounting logic is verified without a backend.

import type {
  CostVoucherEntryDirection,
  CostVoucherPlan,
} from "./quantity-costing-finance-bridge";

/** Tolerance for debit/credit balance comparisons (rounding noise). */
const BALANCE_EPSILON = 0.005;

/** A posted formal voucher's status. */
export type PostedVoucherStatus = "posted" | "skipped";

/** One line of a posted voucher. */
export interface PostedVoucherEntry {
  readonly accountCode: string;
  readonly accountName: string;
  readonly direction: CostVoucherEntryDirection;
  readonly amount: number;
  readonly summary: string;
}

/** A formal voucher posted into an accounting period. */
export interface PostedVoucher {
  /** Sequential voucher number, e.g. "记-001". */
  readonly voucherNo: string;
  /** Accounting period, e.g. "2026-06". */
  readonly period: string;
  /** Source cost-voucher draft id this was posted from. */
  readonly sourceVoucherId: string;
  /** Human-readable description carried from the draft. */
  readonly description: string;
  readonly entries: PostedVoucherEntry[];
  readonly debitTotal: number;
  readonly creditTotal: number;
  readonly balanced: boolean;
  readonly status: PostedVoucherStatus;
  /** Why a draft was skipped (status === "skipped"), else null. */
  readonly skipReason: string | null;
}

/** Options controlling how a cost plan is posted. */
export interface PostCostPlanOptions {
  /** Accounting period the vouchers post into, e.g. "2026-06". */
  readonly period: string;
  /** Voucher word prefix; defaults to "记". */
  readonly voucherWord?: string;
}

/** Result of posting a cost voucher plan. */
export interface PostCostPlanResult {
  readonly vouchers: PostedVoucher[];
  readonly postedCount: number;
  readonly skippedCount: number;
  readonly totalDebit: number;
  readonly totalCredit: number;
  /** Whether every posted voucher balances (debit === credit). */
  readonly balanced: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Post a cost voucher plan into formal, numbered vouchers for a period.
 * Generated drafts become posted vouchers (sequentially numbered); skipped
 * drafts are carried through as skipped with their reason. Pure.
 */
export function postCostVoucherPlan(
  plan: CostVoucherPlan,
  options: PostCostPlanOptions,
): PostCostPlanResult {
  const word = options.voucherWord?.trim() || "记";
  let sequence = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  let allBalanced = true;

  const vouchers: PostedVoucher[] = plan.vouchers.map((draft) => {
    if (draft.generationStatus === "skipped") {
      return {
        voucherNo: "",
        period: options.period,
        sourceVoucherId: draft.voucherId,
        description: draft.description,
        entries: [],
        debitTotal: 0,
        creditTotal: 0,
        balanced: true,
        status: "skipped" as const,
        skipReason: draft.skipReason,
      };
    }

    sequence += 1;
    const entries: PostedVoucherEntry[] = draft.entries.map((entry) => ({
      accountCode: entry.accountCode,
      accountName: entry.accountName,
      direction: entry.direction,
      amount: entry.amount,
      summary: entry.summary,
    }));
    const debitTotal = round2(
      entries
        .filter((e) => e.direction === "debit")
        .reduce((sum, e) => sum + e.amount, 0),
    );
    const creditTotal = round2(
      entries
        .filter((e) => e.direction === "credit")
        .reduce((sum, e) => sum + e.amount, 0),
    );
    const balanced = Math.abs(debitTotal - creditTotal) <= BALANCE_EPSILON;
    if (!balanced) {
      allBalanced = false;
    }
    totalDebit = round2(totalDebit + debitTotal);
    totalCredit = round2(totalCredit + creditTotal);

    return {
      voucherNo: `${word}-${String(sequence).padStart(3, "0")}`,
      period: options.period,
      sourceVoucherId: draft.voucherId,
      description: draft.description,
      entries,
      debitTotal,
      creditTotal,
      balanced,
      status: "posted" as const,
      skipReason: null,
    };
  });

  return {
    vouchers,
    postedCount: sequence,
    skippedCount: vouchers.filter((v) => v.status === "skipped").length,
    totalDebit,
    totalCredit,
    balanced: allBalanced,
  };
}

/** One account row in the general ledger after posting. */
export interface GeneralLedgerAccount {
  readonly accountCode: string;
  readonly accountName: string;
  readonly openingBalance: number;
  readonly debitTotal: number;
  readonly creditTotal: number;
  /** Closing balance = opening + debit − credit (debit-positive convention). */
  readonly closingBalance: number;
}

/** Trial balance over the general ledger. */
export interface TrialBalance {
  readonly accounts: GeneralLedgerAccount[];
  readonly debitTotal: number;
  readonly creditTotal: number;
  /** Whether total debits equal total credits (the trial balance holds). */
  readonly balanced: boolean;
}

/**
 * Roll posted vouchers up into a general ledger and trial balance. Accounts are
 * aggregated by code; closing balance uses the debit-positive convention
 * (opening + debit − credit). Skipped vouchers contribute nothing. Pure.
 */
export function postToGeneralLedger(
  vouchers: readonly PostedVoucher[],
  openingBalances: Record<string, number> = {},
): TrialBalance {
  const byCode = new Map<string, GeneralLedgerAccount>();

  for (const voucher of vouchers) {
    if (voucher.status !== "posted") {
      continue;
    }
    for (const entry of voucher.entries) {
      const existing = byCode.get(entry.accountCode);
      const opening = existing
        ? existing.openingBalance
        : (openingBalances[entry.accountCode] ?? 0);
      const debitTotal =
        (existing?.debitTotal ?? 0) +
        (entry.direction === "debit" ? entry.amount : 0);
      const creditTotal =
        (existing?.creditTotal ?? 0) +
        (entry.direction === "credit" ? entry.amount : 0);
      byCode.set(entry.accountCode, {
        accountCode: entry.accountCode,
        accountName: entry.accountName,
        openingBalance: opening,
        debitTotal: round2(debitTotal),
        creditTotal: round2(creditTotal),
        closingBalance: round2(opening + debitTotal - creditTotal),
      });
    }
  }

  const accounts = [...byCode.values()].sort((a, b) =>
    a.accountCode.localeCompare(b.accountCode),
  );
  const debitTotal = round2(accounts.reduce((s, a) => s + a.debitTotal, 0));
  const creditTotal = round2(accounts.reduce((s, a) => s + a.creditTotal, 0));

  return {
    accounts,
    debitTotal,
    creditTotal,
    balanced: Math.abs(debitTotal - creditTotal) <= BALANCE_EPSILON,
  };
}
