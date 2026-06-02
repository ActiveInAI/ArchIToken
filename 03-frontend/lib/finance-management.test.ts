// lib/finance-management.test.ts - K2617 smart accounting platform rules
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  defaultFinanceAccountingParameters,
  financeEntryTypeCatalogSize,
  financeEntryTypeReferenceCount,
  financeEntryTypes,
  financeLedgerBooks,
  financeManualSections,
  financeManualSource,
  financeReconciliationPlan,
  financeVoucherTemplates,
  getVoucherResultSections,
  runReconciliation,
  runVoucherGeneration,
  validateAccountingParameters,
} from "./finance-management";

describe("finance management K2617 smart accounting platform", () => {
  it("models the K2617 manual as the module source and four functional areas", () => {
    expect(financeManualSource.id).toBe("K2617");
    expect(financeManualSource.version).toBe("V1.0");
    expect(financeManualSections.map((section) => section.id)).toEqual([
      "system_parameters",
      "basic_settings",
      "voucher_generation",
      "financial_reconciliation",
    ]);
  });

  it("keeps entry type metadata aligned to the manual's 38 reference types", () => {
    expect(financeEntryTypeReferenceCount).toBe(38);
    expect(financeEntryTypeCatalogSize).toBe(38);
    expect(financeEntryTypes.length).toBeLessThanOrEqual(38);
    expect(new Set(financeEntryTypes.map((entry) => entry.id)).size).toBe(
      financeEntryTypes.length,
    );
    expect(
      financeEntryTypes.find((entry) => entry.code === "AOAE006"),
    ).toMatchObject({
      name: "费用",
      subjectRules: expect.arrayContaining([
        expect.objectContaining({ accountSubject: "管理费用" }),
      ]),
    });
  });

  it("validates system parameters from the manual", () => {
    expect(
      validateAccountingParameters({
        ...defaultFinanceAccountingParameters,
        tailDifferenceAdjustment: "fixed_account",
        tailDifferenceAccount: null,
      }),
    ).toEqual(["尾差调整方式为固定科目时必须录入尾差调整科目。"]);

    expect(
      validateAccountingParameters({
        ...defaultFinanceAccountingParameters,
        tailDifferenceAdjustment: "fixed_account",
        tailDifferenceAccount: "营业外收入-尾差调整",
      }),
    ).toEqual([]);

    expect(getVoucherResultSections("report")).toEqual(["report"]);
    expect(getVoucherResultSections("voucher_list")).toEqual(["voucher_list"]);
    expect(getVoucherResultSections("report_and_list")).toEqual([
      "report",
      "voucher_list",
    ]);
  });

  it("defines voucher templates with source document, book, category, and entry conditions", () => {
    const paymentTemplate = financeVoucherTemplates.find(
      (template) => template.sourceDocumentType === "付款单",
    );

    expect(paymentTemplate).toMatchObject({
      accountChart: "新会计准则科目表",
      accountingOrgSource: "单据头.付款组织",
      voucherWord: "付",
      voucherDateSource: "source_business_date",
    });
    expect(paymentTemplate?.businessCategories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "供应商",
          mustGenerateGeneralLedgerVoucher: true,
        }),
      ]),
    );
    expect(paymentTemplate?.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "payment-bank",
          generationCondition: "结算方式属于银行类",
          accountingDimensionSource: ["付款组织", "银行账号"],
        }),
      ]),
    );
  });

  it("generates vouchers across selected books and blocks unmapped source documents", () => {
    const run = runVoucherGeneration(
      defaultFinanceAccountingParameters,
      financeLedgerBooks.map((book) => book.id),
      ["doc-payment-001", "doc-receipt-001"],
    );

    expect(run.records).toHaveLength(4);
    expect(run.generatedCount).toBe(2);
    expect(run.blockedCount).toBe(2);
    expect(run.resultSections).toEqual(["report", "voucher_list"]);
    expect(
      run.records.filter((record) => record.status === "generated"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceDocumentCode: "FK-2013-1201",
          businessCategoryName: "供应商",
          generatedEntryIds: ["payment-bank"],
        }),
      ]),
    );
    expect(
      run.records.filter((record) => record.status === "blocked"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceDocumentCode: "SL-2013-1201",
          message: "来源单据未匹配凭证模板。",
        }),
      ]),
    );
  });

  it("honors the voucher sequence parameter", () => {
    const run = runVoucherGeneration(
      {
        ...defaultFinanceAccountingParameters,
        voucherSequenceMode: "source_document_code",
        voucherResultView: "voucher_list",
      },
      ["legal-entity-book"],
      ["doc-payment-001"],
    );

    expect(run.resultSections).toEqual(["voucher_list"]);
    expect(run.records[0]).toMatchObject({
      voucherNo: "FR-FK20131201",
      resultView: "voucher_list",
    });
  });

  it("runs reconciliation and exposes difference analysis only where differences exist", () => {
    const run = runReconciliation(
      financeReconciliationPlan,
      "legal-entity-book",
    );

    expect(run.period).toBe("2013.12");
    expect(run.unbalancedCount).toBe(1);
    expect(
      run.lines.find((line) => line.itemId === "ap"),
    ).toMatchObject({
      result: "unbalanced",
      relatedOperation: "difference_analysis",
      increaseDifference: -382000,
      endingDifference: -382000,
    });
    expect(
      run.lines.find((line) => line.itemId === "cash"),
    ).toMatchObject({
      result: "balanced",
      relatedOperation: "link_detail_ledger",
    });
  });

  it("classifies reconciliation differences using K2617 analysis checks", () => {
    const run = runReconciliation(
      financeReconciliationPlan,
      "legal-entity-book",
    );
    const payableLine = run.lines.find((line) => line.itemId === "ap");

    expect(payableLine?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "document_without_voucher",
          passed: false,
        }),
        expect.objectContaining({
          code: "voucher_missing_subject",
          passed: false,
        }),
        expect.objectContaining({
          code: "manual_voucher",
          passed: false,
        }),
        expect.objectContaining({
          code: "source_document_mismatch",
          passed: false,
        }),
      ]),
    );
  });
});
