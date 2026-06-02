// lib/finance-management.ts - K2617 smart accounting platform model
// License: Apache-2.0

export type TailDifferenceAdjustmentMode =
  | "largest_entry_line"
  | "fixed_account";

export type VoucherSequenceMode =
  | "source_document_voucher_date"
  | "source_document_code"
  | "voucher_date";

export type VoucherResultView = "report" | "voucher_list" | "report_and_list";

export type VoucherDateSource = "source_business_date" | "system_current_date";

export type VoucherGenerationStatus = "generated" | "blocked";

export type ReconciliationResult = "balanced" | "unbalanced";

export type RelatedReconciliationOperation =
  | "link_detail_ledger"
  | "difference_analysis";

export type DifferenceCheckCode =
  | "document_without_voucher"
  | "voucher_missing_subject"
  | "manual_voucher"
  | "source_document_mismatch";

export type ComparisonOperator = "equals" | "not_equals" | "in";

export type ConditionLogic = "and" | "or";

export type VoucherResultSection = "report" | "voucher_list";

type FieldValue = string | number | boolean | null | undefined;

export interface FinanceManualSection {
  id: string;
  name: string;
  capabilities: string[];
}

export interface FieldCondition {
  field: string;
  operator: ComparisonOperator;
  value: string | number | boolean | Array<string | number | boolean>;
}

export interface FinanceAccountingParameters {
  tailDifferenceAdjustment: TailDifferenceAdjustmentMode;
  tailDifferenceAccount: string | null;
  voucherSequenceMode: VoucherSequenceMode;
  voucherResultView: VoucherResultView;
}

export interface FinanceEntrySubjectRule {
  id: string;
  accountChart: string;
  subjectInfluenceDescription: string;
  accountSubject: string;
  priority: number;
  conditions: FieldCondition[];
}

export interface FinanceEntryType {
  id: string;
  code: string;
  name: string;
  description: string;
  priority: number;
  accountRule: string;
  influenceFactors: string[];
  subjectRules: FinanceEntrySubjectRule[];
}

export interface VoucherBusinessCategory {
  id: string;
  name: string;
  condition: string;
  conditionLogic: ConditionLogic;
  conditions: FieldCondition[];
  mustGenerateGeneralLedgerVoucher: boolean;
}

export interface VoucherTemplateEntry {
  id: string;
  entryTypeId: string;
  summary: string;
  accountSubject: string;
  debitCredit: "debit" | "credit";
  generationCondition: string | null;
  generationConditions: FieldCondition[];
  accountingDimensionSource: string[];
}

export interface VoucherTemplate {
  id: string;
  name: string;
  sourceDocumentType: string;
  description: string;
  accountChart: string;
  applicableBookIds: string[];
  voucherWord: string;
  useLedgerDefaultVoucherWord: boolean;
  voucherDateSource: VoucherDateSource;
  accountingOrgSource: string;
  businessCategories: VoucherBusinessCategory[];
  entries: VoucherTemplateEntry[];
}

export interface FinanceLedgerBook {
  id: string;
  name: string;
  accountingSystem: string;
  accountingOrg: string;
  period: string;
  executionMode: string;
}

export interface VoucherSourceDocument {
  id: string;
  code: string;
  name: string;
  sourceSystem: string;
  sourceDocumentType: string;
  documentScope: string;
  businessDate: string;
  period: string;
  amount: number;
  headerFields: Record<string, FieldValue>;
  businessCategoryIds: string[];
  matchedFields: string[];
  status: "pending" | "ready" | "missing_category" | "missing_template";
}

export interface VoucherGenerationRecord {
  id: string;
  bookId: string;
  bookName: string;
  period: string;
  sourceDocumentId: string;
  sourceDocumentCode: string;
  sourceDocumentName: string;
  sourceDocumentType: string;
  templateName: string | null;
  businessCategoryName: string | null;
  generatedEntryIds: string[];
  voucherNo: string | null;
  status: VoucherGenerationStatus;
  resultView: VoucherResultView;
  resultSections: VoucherResultSection[];
  message: string;
}

export interface VoucherGenerationRun {
  records: VoucherGenerationRecord[];
  generatedCount: number;
  blockedCount: number;
  resultView: VoucherResultView;
  resultSections: VoucherResultSection[];
  auditSummary: string;
}

export interface ReconciliationPlanItem {
  id: string;
  name: string;
  balanceDirection: "debit" | "credit";
  accountSubject: string;
  accountingDimension: string;
  businessReport: string;
  sourceDocumentTypes: string[];
  counterpartyType: string | null;
  reportFilter: string;
  businessReportField: string;
}

export interface ReconciliationPlan {
  id: string;
  code: string;
  name: string;
  accountChart: string;
  applicableBookIds: string[];
  items: ReconciliationPlanItem[];
}

export interface ReconciliationAmountRow {
  itemId: string;
  bookId: string;
  period: string;
  accountSubject: string;
  beginningBalance: number;
  currentIncrease: number;
  currentDecrease: number;
  endingBalance: number;
}

export interface VoucherEvidence {
  id: string;
  bookId: string;
  period: string;
  sourceDocumentId: string;
  sourceDocumentType: string;
  sourceSystem: "purchase" | "inventory" | "production" | "general_ledger";
  accountSubjects: string[];
  generated: boolean;
}

export interface DifferenceCheck {
  code: DifferenceCheckCode;
  label: string;
  passed: boolean;
  evidence: string;
}

export interface ReconciliationLineResult {
  itemId: string;
  itemName: string;
  accountSubject: string;
  beginningDifference: number;
  increaseDifference: number;
  decreaseDifference: number;
  endingDifference: number;
  result: ReconciliationResult;
  relatedOperation: RelatedReconciliationOperation;
  checks: DifferenceCheck[];
}

export interface ReconciliationRun {
  planId: string;
  planName: string;
  bookId: string;
  bookName: string;
  period: string;
  lines: ReconciliationLineResult[];
  balancedCount: number;
  unbalancedCount: number;
  auditSummary: string;
}

export const financeManualSource = {
  id: "K2617",
  title: "金蝶云系统操作手册_智能会计平台",
  version: "V1.0",
  releaseDate: "2017-10-17",
  sourcePath: "/home/insome/下载/K2617 金蝶云系统操作手册_智能会计平台 V1.0.docx",
} as const;

export const financeManualSections: FinanceManualSection[] = [
  {
    id: "system_parameters",
    name: "系统参数",
    capabilities: ["尾差调整方式", "凭证顺序生成方式", "凭证生成结果展示"],
  },
  {
    id: "basic_settings",
    name: "基础设置",
    capabilities: ["分录类型", "凭证模板", "业务分类", "分录生成条件"],
  },
  {
    id: "voucher_generation",
    name: "业务处理 · 凭证生成",
    capabilities: ["账簿选择", "单据选择", "凭证生成报告列表"],
  },
  {
    id: "financial_reconciliation",
    name: "财务核对",
    capabilities: ["对账方案", "对账", "联查明细账", "对账分析"],
  },
];

export const tailDifferenceAdjustmentLabels: Record<
  TailDifferenceAdjustmentMode,
  string
> = {
  largest_entry_line: "调整至金额最大的分录行",
  fixed_account: "调整至固定科目",
};

export const voucherSequenceModeLabels: Record<VoucherSequenceMode, string> = {
  source_document_voucher_date: "来源单据、凭证日期",
  source_document_code: "来源单据、单据编码",
  voucher_date: "凭证日期",
};

export const voucherResultViewLabels: Record<VoucherResultView, string> = {
  report: "显示凭证生成报告",
  voucher_list: "显示凭证列表",
  report_and_list: "显示凭证生成报告和列表",
};

export const voucherDateSourceLabels: Record<VoucherDateSource, string> = {
  source_business_date: "单据头业务日期",
  system_current_date: "系统当前日期",
};

export const defaultFinanceAccountingParameters: FinanceAccountingParameters = {
  tailDifferenceAdjustment: "largest_entry_line",
  tailDifferenceAccount: null,
  voucherSequenceMode: "source_document_voucher_date",
  voucherResultView: "report_and_list",
};

export const financeEntryTypeReferenceCount = 38;

export const financeEntryTypes: FinanceEntryType[] = [
  {
    id: "entry-expense",
    code: "AOAE006",
    name: "费用",
    description: "根据业务对会计科目进行抽象,供凭证模板分录引用。",
    priority: 1,
    accountRule: "部门属性映射管理费用、销售费用、制造费用或研发支出",
    influenceFactors: ["部门属性", "费用承担部门", "辅助资料"],
    subjectRules: [
      {
        id: "expense-management",
        accountChart: "新会计准则科目表",
        subjectInfluenceDescription: "部门属性为采购部门或管理部门",
        accountSubject: "管理费用",
        priority: 1,
        conditions: [
          { field: "部门属性", operator: "in", value: ["采购部门", "管理部门"] },
        ],
      },
      {
        id: "expense-sales",
        accountChart: "新会计准则科目表",
        subjectInfluenceDescription: "部门属性为销售部门",
        accountSubject: "销售费用",
        priority: 2,
        conditions: [{ field: "部门属性", operator: "equals", value: "销售部门" }],
      },
      {
        id: "expense-manufacturing",
        accountChart: "新会计准则科目表",
        subjectInfluenceDescription: "部门属性为基本生产部门或辅助生产部门",
        accountSubject: "制造费用",
        priority: 3,
        conditions: [
          {
            field: "部门属性",
            operator: "in",
            value: ["基本生产部门", "辅助生产部门"],
          },
        ],
      },
      {
        id: "expense-rd",
        accountChart: "新会计准则科目表",
        subjectInfluenceDescription: "部门属性等于研发部门",
        accountSubject: "研发支出",
        priority: 4,
        conditions: [{ field: "部门属性", operator: "equals", value: "研发部门" }],
      },
    ],
  },
  {
    id: "entry-cash",
    code: "AOAC001",
    name: "现金",
    description: "现金结算方式对应的库存现金分录类型。",
    priority: 2,
    accountRule: "结算方式为现金",
    influenceFactors: ["结算方式", "币别", "收付款组织"],
    subjectRules: [
      {
        id: "cash-settlement",
        accountChart: "新会计准则科目表",
        subjectInfluenceDescription: "结算方式为现金",
        accountSubject: "库存现金",
        priority: 1,
        conditions: [{ field: "结算方式", operator: "equals", value: "现金" }],
      },
    ],
  },
  {
    id: "entry-bank-deposit",
    code: "AOAB002",
    name: "银行存款",
    description: "现金支票、转账支票、信用证和信汇对应的银行存款分录类型。",
    priority: 3,
    accountRule: "结算方式映射银行存款",
    influenceFactors: ["结算方式", "银行账号", "资金组织"],
    subjectRules: [
      {
        id: "bank-transfer",
        accountChart: "新会计准则科目表",
        subjectInfluenceDescription: "结算方式为银行类",
        accountSubject: "银行存款",
        priority: 1,
        conditions: [
          {
            field: "结算方式",
            operator: "in",
            value: ["现金支票", "转账支票", "信用证", "信汇", "银行转账"],
          },
        ],
      },
    ],
  },
  {
    id: "entry-payable-note",
    code: "AOAP003",
    name: "应付票据",
    description: "商业承兑汇票和银行承兑汇票付款分录类型。",
    priority: 4,
    accountRule: "票据类型映射应付票据",
    influenceFactors: ["结算方式", "票据类型", "供应商"],
    subjectRules: [
      {
        id: "payable-note",
        accountChart: "新会计准则科目表",
        subjectInfluenceDescription: "结算方式为票据",
        accountSubject: "应付票据",
        priority: 1,
        conditions: [{ field: "结算方式", operator: "equals", value: "票据" }],
      },
    ],
  },
  {
    id: "entry-receivable-note",
    code: "AOAR004",
    name: "应收票据",
    description: "商业承兑汇票和银行承兑汇票收款分录类型。",
    priority: 5,
    accountRule: "票据类型映射应收票据",
    influenceFactors: ["结算方式", "票据类型", "客户"],
    subjectRules: [
      {
        id: "receivable-note",
        accountChart: "新会计准则科目表",
        subjectInfluenceDescription: "结算方式为票据",
        accountSubject: "应收票据",
        priority: 1,
        conditions: [{ field: "结算方式", operator: "equals", value: "票据" }],
      },
    ],
  },
  {
    id: "entry-inventory",
    code: "AOAI005",
    name: "存货",
    description: "采购、入库、退料、盘盈盘亏等库存业务分录类型。",
    priority: 6,
    accountRule: "来源单据和物料属性映射原材料、库存商品或在制品",
    influenceFactors: ["来源单据", "物料分类", "库存组织"],
    subjectRules: [
      {
        id: "raw-material",
        accountChart: "新会计准则科目表",
        subjectInfluenceDescription: "采购入库材料",
        accountSubject: "原材料",
        priority: 1,
        conditions: [{ field: "来源单据", operator: "equals", value: "采购入库单" }],
      },
    ],
  },
  {
    id: "entry-cost",
    code: "AOAC007",
    name: "成本",
    description: "生产、施工、物流和项目成本归集分录类型。",
    priority: 7,
    accountRule: "项目、成本中心和成本类型映射合同履约成本",
    influenceFactors: ["项目", "成本中心", "成本类型"],
    subjectRules: [
      {
        id: "payable-cost",
        accountChart: "新会计准则科目表",
        subjectInfluenceDescription: "采购入库形成应付",
        accountSubject: "应付账款",
        priority: 1,
        conditions: [{ field: "来源单据", operator: "equals", value: "采购入库单" }],
      },
    ],
  },
  {
    id: "entry-settlement",
    code: "AOAS008",
    name: "结算",
    description: "进度款、结算审核、签证和索赔相关分录类型。",
    priority: 8,
    accountRule: "合同、结算节点和发票状态映射应收应付与收入成本",
    influenceFactors: ["合同", "结算节点", "发票状态"],
    subjectRules: [
      {
        id: "settlement-receivable",
        accountChart: "新会计准则科目表",
        subjectInfluenceDescription: "结算节点形成应收",
        accountSubject: "应收账款",
        priority: 1,
        conditions: [{ field: "结算状态", operator: "equals", value: "已确认" }],
      },
    ],
  },
];

export const financeEntryTypeCatalogSize = financeEntryTypeReferenceCount;

export const financeLedgerBooks: FinanceLedgerBook[] = [
  {
    id: "legal-entity-book",
    name: "法人账簿",
    accountingSystem: "财务会计核算体系",
    accountingOrg: "ora1224",
    period: "2013.12",
    executionMode: "单据同时生成业务和总账凭证",
  },
  {
    id: "profit-center-book",
    name: "利润中心账簿",
    accountingSystem: "财务会计核算体系",
    accountingOrg: "ora1224",
    period: "2013.12",
    executionMode: "单据同时生成业务和总账凭证",
  },
];

export const financeVoucherTemplates: VoucherTemplate[] = [
  {
    id: "payment-note-template",
    name: "付款单 - 凭证模板",
    sourceDocumentType: "付款单",
    description: "付款单 - 凭证模板_付款组织",
    accountChart: "新会计准则科目表",
    applicableBookIds: ["legal-entity-book", "profit-center-book"],
    voucherWord: "付",
    useLedgerDefaultVoucherWord: false,
    voucherDateSource: "source_business_date",
    accountingOrgSource: "单据头.付款组织",
    businessCategories: [
      {
        id: "supplier-payment",
        name: "供应商",
        condition: "结算组织与付款组织不同且非资金单据",
        conditionLogic: "and",
        conditions: [
          { field: "结算组织等于付款组织", operator: "equals", value: false },
          { field: "资金单据", operator: "equals", value: false },
        ],
        mustGenerateGeneralLedgerVoucher: true,
      },
      {
        id: "other-receivable",
        name: "其他应收款",
        condition: "内部利息付款单",
        conditionLogic: "and",
        conditions: [{ field: "付款业务类型", operator: "equals", value: "内部利息" }],
        mustGenerateGeneralLedgerVoucher: true,
      },
      {
        id: "cash-payment",
        name: "资金",
        condition: "资金上划付款单",
        conditionLogic: "and",
        conditions: [{ field: "付款业务类型", operator: "equals", value: "资金上划" }],
        mustGenerateGeneralLedgerVoucher: true,
      },
    ],
    entries: [
      {
        id: "payment-cash",
        entryTypeId: "entry-cash",
        summary: "结算方式为现金",
        accountSubject: "库存现金",
        debitCredit: "credit",
        generationCondition: "结算方式=现金",
        generationConditions: [{ field: "结算方式", operator: "equals", value: "现金" }],
        accountingDimensionSource: ["付款组织", "币别"],
      },
      {
        id: "payment-bank",
        entryTypeId: "entry-bank-deposit",
        summary: "现金支票、转账支票、信用证、信汇",
        accountSubject: "银行存款",
        debitCredit: "credit",
        generationCondition: "结算方式属于银行类",
        generationConditions: [
          {
            field: "结算方式",
            operator: "in",
            value: ["现金支票", "转账支票", "信用证", "信汇", "银行转账"],
          },
        ],
        accountingDimensionSource: ["付款组织", "银行账号"],
      },
      {
        id: "payment-note",
        entryTypeId: "entry-payable-note",
        summary: "商业承兑汇票或银行承兑汇票",
        accountSubject: "应付票据",
        debitCredit: "credit",
        generationCondition: "结算方式为票据",
        generationConditions: [{ field: "结算方式", operator: "equals", value: "票据" }],
        accountingDimensionSource: ["供应商", "业务类型"],
      },
    ],
  },
  {
    id: "purchase-inbound-template",
    name: "采购入库单 - 存货与应付模板",
    sourceDocumentType: "采购入库单",
    description: "采购入库单按单据字段匹配汇总生成总账凭证",
    accountChart: "新会计准则科目表",
    applicableBookIds: ["legal-entity-book", "profit-center-book"],
    voucherWord: "记",
    useLedgerDefaultVoucherWord: false,
    voucherDateSource: "source_business_date",
    accountingOrgSource: "单据头.采购组织",
    businessCategories: [
      {
        id: "material-inbound",
        name: "材料入库",
        condition: "来源系统=采购管理且单据范围=全部",
        conditionLogic: "and",
        conditions: [
          { field: "来源系统", operator: "equals", value: "采购管理" },
          { field: "单据范围", operator: "equals", value: "全部" },
        ],
        mustGenerateGeneralLedgerVoucher: true,
      },
    ],
    entries: [
      {
        id: "inbound-inventory",
        entryTypeId: "entry-inventory",
        summary: "采购入库确认存货",
        accountSubject: "原材料",
        debitCredit: "debit",
        generationCondition: null,
        generationConditions: [],
        accountingDimensionSource: ["物料", "库存组织", "项目"],
      },
      {
        id: "inbound-payable",
        entryTypeId: "entry-cost",
        summary: "采购入库确认应付",
        accountSubject: "应付账款",
        debitCredit: "credit",
        generationCondition: null,
        generationConditions: [],
        accountingDimensionSource: ["供应商", "采购组织", "项目"],
      },
    ],
  },
];

export const financeVoucherSourceDocuments: VoucherSourceDocument[] = [
  {
    id: "doc-payment-001",
    code: "FK-2013-1201",
    name: "供应商付款单",
    sourceSystem: "资金管理",
    sourceDocumentType: "付款单",
    documentScope: "全部",
    businessDate: "2013-12-10",
    period: "2013.12",
    amount: 1280000,
    headerFields: {
      来源系统: "资金管理",
      来源单据: "付款单",
      结算组织等于付款组织: false,
      资金单据: false,
      结算方式: "银行转账",
      付款业务类型: "供应商付款",
      付款组织: "ora1224",
      供应商: "重钢供应商",
      单据范围: "全部",
    },
    businessCategoryIds: [],
    matchedFields: ["供应商", "业务类型"],
    status: "ready",
  },
  {
    id: "doc-payment-002",
    code: "FK-2013-1202",
    name: "资金上划付款单",
    sourceSystem: "资金管理",
    sourceDocumentType: "付款单",
    documentScope: "全部",
    businessDate: "2013-12-11",
    period: "2013.12",
    amount: 216000,
    headerFields: {
      来源系统: "资金管理",
      来源单据: "付款单",
      结算组织等于付款组织: true,
      资金单据: true,
      结算方式: "现金",
      付款业务类型: "资金上划",
      付款组织: "ora1224",
      单据范围: "全部",
    },
    businessCategoryIds: [],
    matchedFields: ["结算方式"],
    status: "ready",
  },
  {
    id: "doc-inbound-001",
    code: "RK-2013-1201",
    name: "采购入库单",
    sourceSystem: "采购管理",
    sourceDocumentType: "采购入库单",
    documentScope: "全部",
    businessDate: "2013-12-12",
    period: "2013.12",
    amount: 473000,
    headerFields: {
      来源系统: "采购管理",
      来源单据: "采购入库单",
      单据范围: "全部",
      物料: "钢材",
      库存组织: "ora1224",
      项目: "重钢样板房",
      供应商: "重钢供应商",
    },
    businessCategoryIds: [],
    matchedFields: ["物料", "库存组织", "项目"],
    status: "ready",
  },
  {
    id: "doc-receipt-001",
    code: "SL-2013-1201",
    name: "采购收料单",
    sourceSystem: "采购管理",
    sourceDocumentType: "采购收料单",
    documentScope: "全部",
    businessDate: "2013-12-12",
    period: "2013.12",
    amount: 382000,
    headerFields: {
      来源系统: "采购管理",
      来源单据: "采购收料单",
      单据范围: "全部",
      项目: "重钢样板房",
    },
    businessCategoryIds: [],
    matchedFields: [],
    status: "missing_template",
  },
];

export const financeReconciliationPlan: ReconciliationPlan = {
  id: "ar-ap-reconciliation",
  code: "DZ-2013-001",
  name: "总账科目与业务报表对账方案",
  accountChart: "新会计准则科目表",
  applicableBookIds: ["legal-entity-book", "profit-center-book"],
  items: [
    {
      id: "ap",
      name: "应付款",
      balanceDirection: "credit",
      accountSubject: "应付账款",
      accountingDimension: "供应商 + 项目",
      businessReport: "应付明细表",
      sourceDocumentTypes: ["付款单", "采购入库单"],
      counterpartyType: "供应商",
      reportFilter: "项目=重钢样板房",
      businessReportField: "期末应付余额",
    },
    {
      id: "cash",
      name: "资金",
      balanceDirection: "debit",
      accountSubject: "银行存款",
      accountingDimension: "资金组织 + 银行账号",
      businessReport: "资金收付明细表",
      sourceDocumentTypes: ["付款单"],
      counterpartyType: null,
      reportFilter: "期间=2013.12",
      businessReportField: "本期减少",
    },
  ],
};

export const financeLedgerAmountRows: ReconciliationAmountRow[] = [
  {
    itemId: "ap",
    bookId: "legal-entity-book",
    period: "2013.12",
    accountSubject: "应付账款",
    beginningBalance: 1800000,
    currentIncrease: 473000,
    currentDecrease: 1280000,
    endingBalance: 993000,
  },
  {
    itemId: "cash",
    bookId: "legal-entity-book",
    period: "2013.12",
    accountSubject: "银行存款",
    beginningBalance: 3600000,
    currentIncrease: 0,
    currentDecrease: 1496000,
    endingBalance: 2104000,
  },
];

export const financeBusinessReportRows: ReconciliationAmountRow[] = [
  {
    itemId: "ap",
    bookId: "legal-entity-book",
    period: "2013.12",
    accountSubject: "应付账款",
    beginningBalance: 1800000,
    currentIncrease: 855000,
    currentDecrease: 1280000,
    endingBalance: 1375000,
  },
  {
    itemId: "cash",
    bookId: "legal-entity-book",
    period: "2013.12",
    accountSubject: "银行存款",
    beginningBalance: 3600000,
    currentIncrease: 0,
    currentDecrease: 1496000,
    endingBalance: 2104000,
  },
];

export const financeVoucherEvidence: VoucherEvidence[] = [
  {
    id: "v-ap-001",
    bookId: "legal-entity-book",
    period: "2013.12",
    sourceDocumentId: "doc-inbound-001",
    sourceDocumentType: "采购入库单",
    sourceSystem: "purchase",
    accountSubjects: ["原材料", "应付账款"],
    generated: true,
  },
  {
    id: "v-pay-001",
    bookId: "legal-entity-book",
    period: "2013.12",
    sourceDocumentId: "doc-payment-001",
    sourceDocumentType: "付款单",
    sourceSystem: "purchase",
    accountSubjects: ["银行存款"],
    generated: true,
  },
  {
    id: "v-manual-001",
    bookId: "legal-entity-book",
    period: "2013.12",
    sourceDocumentId: "manual-adjustment",
    sourceDocumentType: "总账手工凭证",
    sourceSystem: "general_ledger",
    accountSubjects: ["应付账款"],
    generated: true,
  },
  {
    id: "v-mismatch-001",
    bookId: "legal-entity-book",
    period: "2013.12",
    sourceDocumentId: "doc-receipt-001",
    sourceDocumentType: "采购收料单",
    sourceSystem: "purchase",
    accountSubjects: ["应付账款"],
    generated: true,
  },
];

export function validateAccountingParameters(
  parameters: FinanceAccountingParameters,
): string[] {
  if (
    parameters.tailDifferenceAdjustment === "fixed_account" &&
    !parameters.tailDifferenceAccount?.trim()
  ) {
    return ["尾差调整方式为固定科目时必须录入尾差调整科目。"];
  }

  return [];
}

export function getVoucherResultSections(
  resultView: VoucherResultView,
): VoucherResultSection[] {
  if (resultView === "report") {
    return ["report"];
  }
  if (resultView === "voucher_list") {
    return ["voucher_list"];
  }
  return ["report", "voucher_list"];
}

export function runVoucherGeneration(
  parameters: FinanceAccountingParameters,
  selectedBookIds: string[],
  selectedDocumentIds: string[],
  books = financeLedgerBooks,
  documents = financeVoucherSourceDocuments,
  templates = financeVoucherTemplates,
): VoucherGenerationRun {
  const parameterIssues = validateAccountingParameters(parameters);
  const resultSections = getVoucherResultSections(parameters.voucherResultView);
  const selectedBooks = books.filter((book) =>
    selectedBookIds.includes(book.id),
  );
  const selectedDocuments = documents.filter((document) =>
    selectedDocumentIds.includes(document.id),
  );

  const records = selectedBooks.flatMap((book) =>
    selectedDocuments.map((document) => {
      const template =
        templates.find(
          (candidate) =>
            candidate.sourceDocumentType === document.sourceDocumentType &&
            candidate.applicableBookIds.includes(book.id),
        ) ?? null;
      const matchedCategory = template
        ? findBusinessCategory(template, document)
        : null;
      const generatedEntries =
        template && matchedCategory
          ? template.entries.filter((entry) =>
              evaluateConditions(entry.generationConditions, document, "and"),
            )
          : [];
      const blockedReason =
        parameterIssues[0] ??
        (!template
          ? "来源单据未匹配凭证模板。"
          : !matchedCategory
            ? "来源单据未命中业务分类，不生成凭证。"
            : !matchedCategory.mustGenerateGeneralLedgerVoucher
              ? "业务分类未要求生成总账凭证。"
              : generatedEntries.length === 0
                ? "凭证模板没有满足分录生成条件的分录。"
                : null);

      if (blockedReason || !template || !matchedCategory) {
        return {
          id: `${book.id}:${document.id}`,
          bookId: book.id,
          bookName: book.name,
          period: book.period,
          sourceDocumentId: document.id,
          sourceDocumentCode: document.code,
          sourceDocumentName: document.name,
          sourceDocumentType: document.sourceDocumentType,
          templateName: template?.name ?? null,
          businessCategoryName: matchedCategory?.name ?? null,
          generatedEntryIds: [],
          voucherNo: null,
          status: "blocked" as const,
          resultView: parameters.voucherResultView,
          resultSections,
          message: blockedReason ?? "来源单据未完成凭证模板或业务分类匹配。",
        };
      }

      return {
        id: `${book.id}:${document.id}`,
        bookId: book.id,
        bookName: book.name,
        period: book.period,
        sourceDocumentId: document.id,
        sourceDocumentCode: document.code,
        sourceDocumentName: document.name,
        sourceDocumentType: document.sourceDocumentType,
        templateName: template.name,
        businessCategoryName: matchedCategory.name,
        generatedEntryIds: generatedEntries.map((entry) => entry.id),
        voucherNo: buildVoucherNo(parameters.voucherSequenceMode, document, book),
        status: "generated" as const,
        resultView: parameters.voucherResultView,
        resultSections,
        message: `${matchedCategory.name} 已生成 ${template.voucherWord} 字凭证。`,
      };
    }),
  );

  const generatedCount = records.filter(
    (record) => record.status === "generated",
  ).length;
  const blockedCount = records.length - generatedCount;

  return {
    records,
    generatedCount,
    blockedCount,
    resultView: parameters.voucherResultView,
    resultSections,
    auditSummary: `凭证生成完成: ${generatedCount} 条已生成, ${blockedCount} 条未生成。`,
  };
}

export function runReconciliation(
  plan: ReconciliationPlan,
  bookId: string,
  books = financeLedgerBooks,
  ledgerRows = financeLedgerAmountRows,
  businessRows = financeBusinessReportRows,
  vouchers = financeVoucherEvidence,
  documents = financeVoucherSourceDocuments,
): ReconciliationRun {
  const book = books.find((candidate) => candidate.id === bookId) ?? books[0];
  const period = book?.period ?? "";
  const lines = plan.items.map((item) => {
    const ledger = findAmountRow(ledgerRows, item, bookId, period);
    const business = findAmountRow(businessRows, item, bookId, period);
    const increaseDifference =
      ledger.currentIncrease - business.currentIncrease;
    const decreaseDifference =
      ledger.currentDecrease - business.currentDecrease;
    const endingDifference = ledger.endingBalance - business.endingBalance;
    const result: ReconciliationResult =
      endingDifference === 0 ? "balanced" : "unbalanced";
    const relatedOperation: RelatedReconciliationOperation =
      increaseDifference !== 0 || decreaseDifference !== 0
        ? "difference_analysis"
        : "link_detail_ledger";

    return {
      itemId: item.id,
      itemName: item.name,
      accountSubject: item.accountSubject,
      beginningDifference: ledger.beginningBalance - business.beginningBalance,
      increaseDifference,
      decreaseDifference,
      endingDifference,
      result,
      relatedOperation,
      checks: analyzeReconciliationDifference(
        item,
        bookId,
        period,
        vouchers,
        documents,
      ),
    };
  });
  const balancedCount = lines.filter(
    (line) => line.result === "balanced",
  ).length;
  const unbalancedCount = lines.length - balancedCount;

  return {
    planId: plan.id,
    planName: plan.name,
    bookId: book?.id ?? bookId,
    bookName: book?.name ?? bookId,
    period,
    lines,
    balancedCount,
    unbalancedCount,
    auditSummary: `财务核对完成: ${balancedCount} 项平衡, ${unbalancedCount} 项不平衡。`,
  };
}

export function analyzeReconciliationDifference(
  item: ReconciliationPlanItem,
  bookId: string,
  period: string,
  vouchers = financeVoucherEvidence,
  documents = financeVoucherSourceDocuments,
): DifferenceCheck[] {
  const relevantDocuments = documents.filter(
    (document) =>
      document.period === period &&
      item.sourceDocumentTypes.includes(document.sourceDocumentType),
  );
  const documentIds = new Set(relevantDocuments.map((document) => document.id));
  const scopedVouchers = vouchers.filter(
    (voucher) => voucher.bookId === bookId && voucher.period === period,
  );
  const relevantVouchers = scopedVouchers.filter(
    (voucher) =>
      documentIds.has(voucher.sourceDocumentId) ||
      voucher.accountSubjects.includes(item.accountSubject),
  );
  const missingVoucherDocument = relevantDocuments.find(
    (document) =>
      !scopedVouchers.some(
        (voucher) =>
          voucher.sourceDocumentId === document.id && voucher.generated,
      ),
  );
  const voucherMissingSubject = relevantVouchers.find(
    (voucher) =>
      documentIds.has(voucher.sourceDocumentId) &&
      voucher.generated &&
      !voucher.accountSubjects.includes(item.accountSubject),
  );
  const manualVoucher = relevantVouchers.find(
    (voucher) => voucher.sourceSystem === "general_ledger",
  );
  const mismatchedSourceDocument = relevantVouchers.find(
    (voucher) => !item.sourceDocumentTypes.includes(voucher.sourceDocumentType),
  );

  return [
    {
      code: "document_without_voucher",
      label: "单据未生成凭证",
      passed: !missingVoucherDocument,
      evidence: missingVoucherDocument
        ? `${missingVoucherDocument.code} 在 ${bookId}/${period} 未生成凭证。`
        : "指定账簿和期间内的过滤单据均已生成凭证。",
    },
    {
      code: "voucher_missing_subject",
      label: "单据生成的凭证不包含指定科目",
      passed: !voucherMissingSubject,
      evidence: voucherMissingSubject
        ? `${voucherMissingSubject.id} 未包含 ${item.accountSubject}。`
        : `过滤单据生成的凭证包含 ${item.accountSubject}。`,
    },
    {
      code: "manual_voucher",
      label: "凭证手工录入",
      passed: !manualVoucher,
      evidence: manualVoucher
        ? `${manualVoucher.id} 来源系统为总账。`
        : "未发现来源系统为总账的手工凭证。",
    },
    {
      code: "source_document_mismatch",
      label: "凭证的来源单据不是指定单据",
      passed: !mismatchedSourceDocument,
      evidence: mismatchedSourceDocument
        ? `${mismatchedSourceDocument.id} 来源单据为 ${mismatchedSourceDocument.sourceDocumentType}。`
        : "凭证来源单据属于对账方案指定单据。",
    },
  ];
}

function findBusinessCategory(
  template: VoucherTemplate,
  document: VoucherSourceDocument,
): VoucherBusinessCategory | null {
  return (
    template.businessCategories.find((category) =>
      document.businessCategoryIds.includes(category.id),
    ) ??
    template.businessCategories.find((category) =>
      evaluateConditions(category.conditions, document, category.conditionLogic),
    ) ??
    null
  );
}

function evaluateConditions(
  conditions: FieldCondition[],
  document: VoucherSourceDocument,
  logic: ConditionLogic,
): boolean {
  if (conditions.length === 0) {
    return true;
  }

  const results = conditions.map((condition) =>
    compareField(getFieldValue(document, condition.field), condition),
  );
  return logic === "or"
    ? results.some((result) => result)
    : results.every((result) => result);
}

function getFieldValue(
  document: VoucherSourceDocument,
  field: string,
): FieldValue {
  if (field === "来源系统") {
    return document.sourceSystem;
  }
  if (field === "来源单据") {
    return document.sourceDocumentType;
  }
  if (field === "单据范围") {
    return document.documentScope;
  }
  return document.headerFields[field];
}

function compareField(value: FieldValue, condition: FieldCondition): boolean {
  const expected = condition.value;
  if (condition.operator === "in") {
    const expectedValues = Array.isArray(expected) ? expected : [expected];
    return expectedValues.some(
      (candidate) => String(candidate) === String(value),
    );
  }
  if (condition.operator === "not_equals") {
    return String(value) !== String(expected);
  }
  return String(value) === String(expected);
}

function findAmountRow(
  rows: ReconciliationAmountRow[],
  item: ReconciliationPlanItem,
  bookId: string,
  period: string,
): ReconciliationAmountRow {
  return (
    rows.find(
      (row) =>
        row.itemId === item.id &&
        row.bookId === bookId &&
        row.period === period &&
        row.accountSubject === item.accountSubject,
    ) ?? {
      itemId: item.id,
      bookId,
      period,
      accountSubject: item.accountSubject,
      beginningBalance: 0,
      currentIncrease: 0,
      currentDecrease: 0,
      endingBalance: 0,
    }
  );
}

function buildVoucherNo(
  mode: VoucherSequenceMode,
  document: VoucherSourceDocument,
  book: FinanceLedgerBook,
): string {
  const dateToken = document.businessDate.replaceAll("-", "");
  const docToken = document.code.replace(/[^A-Z0-9]/gi, "");
  const bookToken = book.id === "legal-entity-book" ? "FR" : "PC";

  if (mode === "source_document_code") {
    return `${bookToken}-${docToken}`;
  }

  if (mode === "voucher_date") {
    return `${bookToken}-${dateToken}`;
  }

  return `${bookToken}-${docToken}-${dateToken}`;
}
