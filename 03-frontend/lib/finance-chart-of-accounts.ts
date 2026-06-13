// lib/finance-chart-of-accounts.ts
// License: Apache-2.0
//
// Chart of accounts (会计科目表) for the finance module — 企业会计准则常用科目。
// Source of truth for account classification used by voucher entry validation
// and the financial statements (balance sheet / income statement). Pure data +
// lookup helpers, so classification is testable without a backend.

/** Top-level account category. */
export type AccountCategory =
  | "asset" // 资产
  | "liability" // 负债
  | "equity" // 所有者权益
  | "cost" // 成本
  | "revenue" // 收入(损益)
  | "expense"; // 费用/支出(损益)

/** Normal balance side of an account. */
export type BalanceDirection = "debit" | "credit";

/** One account in the chart of accounts. */
export interface ChartAccount {
  readonly code: string;
  readonly name: string;
  readonly category: AccountCategory;
  /** Normal (increase) side: debit for assets/costs/expenses, credit otherwise. */
  readonly direction: BalanceDirection;
}

/** 中文标签,用于报表/选择器展示。 */
export const ACCOUNT_CATEGORY_LABELS: Record<AccountCategory, string> = {
  asset: "资产",
  liability: "负债",
  equity: "所有者权益",
  cost: "成本",
  revenue: "收入",
  expense: "费用",
};

/** 常用会计科目(企业会计准则)。覆盖造价/工程业务的关键科目。 */
export const CHART_OF_ACCOUNTS: readonly ChartAccount[] = [
  // 资产类(1xxx,借方余额)
  { code: "1001", name: "库存现金", category: "asset", direction: "debit" },
  { code: "1002", name: "银行存款", category: "asset", direction: "debit" },
  { code: "1012", name: "其他货币资金", category: "asset", direction: "debit" },
  { code: "1122", name: "应收账款", category: "asset", direction: "debit" },
  { code: "1123", name: "预付账款", category: "asset", direction: "debit" },
  { code: "1221", name: "其他应收款", category: "asset", direction: "debit" },
  { code: "1403", name: "原材料", category: "asset", direction: "debit" },
  { code: "1408", name: "委托加工物资", category: "asset", direction: "debit" },
  { code: "1411", name: "周转材料", category: "asset", direction: "debit" },
  { code: "1601", name: "固定资产", category: "asset", direction: "debit" },
  { code: "1604", name: "在建工程", category: "asset", direction: "debit" },
  { code: "1605", name: "工程物资", category: "asset", direction: "debit" },
  // 负债类(2xxx,贷方余额)
  { code: "2201", name: "应付票据", category: "liability", direction: "credit" },
  { code: "2202", name: "应付账款", category: "liability", direction: "credit" },
  { code: "2203", name: "预收账款", category: "liability", direction: "credit" },
  { code: "2211", name: "应付职工薪酬", category: "liability", direction: "credit" },
  { code: "2221", name: "应交税费", category: "liability", direction: "credit" },
  { code: "2241", name: "其他应付款", category: "liability", direction: "credit" },
  { code: "2701", name: "长期应付款", category: "liability", direction: "credit" },
  // 所有者权益(4xxx,贷方余额)
  { code: "4001", name: "实收资本", category: "equity", direction: "credit" },
  { code: "4002", name: "资本公积", category: "equity", direction: "credit" },
  { code: "4101", name: "盈余公积", category: "equity", direction: "credit" },
  { code: "4103", name: "本年利润", category: "equity", direction: "credit" },
  { code: "4104", name: "利润分配", category: "equity", direction: "credit" },
  // 成本类(5xxx,借方余额)
  { code: "5001", name: "生产成本", category: "cost", direction: "debit" },
  { code: "5101", name: "制造费用", category: "cost", direction: "debit" },
  { code: "5401", name: "工程施工", category: "cost", direction: "debit" },
  { code: "5403", name: "机械作业", category: "cost", direction: "debit" },
  // 损益类 — 收入(6xxx,贷方余额)
  { code: "6001", name: "主营业务收入", category: "revenue", direction: "credit" },
  { code: "6051", name: "其他业务收入", category: "revenue", direction: "credit" },
  { code: "6111", name: "投资收益", category: "revenue", direction: "credit" },
  { code: "6301", name: "营业外收入", category: "revenue", direction: "credit" },
  // 损益类 — 成本费用(6xxx,借方余额)
  { code: "6401", name: "主营业务成本", category: "expense", direction: "debit" },
  { code: "6402", name: "其他业务成本", category: "expense", direction: "debit" },
  { code: "6403", name: "税金及附加", category: "expense", direction: "debit" },
  { code: "6601", name: "销售费用", category: "expense", direction: "debit" },
  { code: "6602", name: "管理费用", category: "expense", direction: "debit" },
  { code: "6603", name: "财务费用", category: "expense", direction: "debit" },
  { code: "6711", name: "营业外支出", category: "expense", direction: "debit" },
  { code: "6801", name: "所得税费用", category: "expense", direction: "debit" },
];

const ACCOUNT_BY_CODE: ReadonlyMap<string, ChartAccount> = new Map(
  CHART_OF_ACCOUNTS.map((account) => [account.code, account]),
);

/** Exact lookup of a registered account by code. */
export function lookupAccount(code: string): ChartAccount | undefined {
  return ACCOUNT_BY_CODE.get(code.trim());
}

/**
 * Classify an account by code. Falls back to the leading digit of the code
 * when the exact code isn't registered (1=资产 2=负债 3=共同 4=权益 5=成本
 * 6=损益), so sub-accounts like "1604.01" still classify. Returns null when
 * it cannot be determined.
 */
export function classifyAccount(code: string): AccountCategory | null {
  const trimmed = code.trim();
  const exact = ACCOUNT_BY_CODE.get(trimmed);
  if (exact) {
    return exact.category;
  }
  // Sub-account like "1604.01" → use the registered parent prefix first.
  const parent = CHART_OF_ACCOUNTS.find((account) =>
    trimmed.startsWith(account.code),
  );
  if (parent) {
    return parent.category;
  }
  switch (trimmed.charAt(0)) {
    case "1":
      return "asset";
    case "2":
      return "liability";
    case "4":
      return "equity";
    case "5":
      return "cost";
    case "6":
      // Ambiguous (收入 vs 费用) without a registered code → treat as expense.
      return "expense";
    default:
      return null;
  }
}
