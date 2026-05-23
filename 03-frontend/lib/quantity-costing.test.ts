// lib/quantity-costing.test.ts - Quantity costing review kernel tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  calculateCostingDashboard,
  calculateFeeSummaryItem,
  calculateMeasureItem,
  calculateOtherItem,
  calculateQuotaUnitPrice,
  computeBoqItem,
  convertBoqItemData,
  createNextReviewVersion,
  findQuotaItemByBoqCode,
  filterCostAnalysisItems,
  generateReviewReportSnapshot,
  mergeCostAnalysisItems,
  quantityCostingPhase1Project,
  quantityCostingPhase2FeeRules,
  quantityCostingPhase2MeasureItems,
  quantityCostingPhase2OtherItems,
  quantityCostingPhase2Registry,
  selectCostItemsByDeltaShare,
  validateBoqCode,
  type QuantityCostingBoqItem,
} from "./quantity-costing";

describe("quantity costing review kernel", () => {
  it("computes submitted and approved deltas with GCCP-style review marks", () => {
    const dashboard = calculateCostingDashboard(quantityCostingPhase1Project);

    expect(dashboard.summary.submittedTotal).toBe(292780);
    expect(dashboard.summary.approvedTotal).toBe(307394);
    expect(dashboard.summary.amountDelta).toBe(14614);
    expect(dashboard.summary.markCounts).toMatchObject({
      none: 1,
      add: 1,
      delete: 1,
      modify: 2,
    });

    const steel = dashboard.computedItems.find(
      (item) => item.itemId === "boq-steel-001",
    );
    expect(steel?.qtyDelta).toBe(1.4);
    expect(steel?.unitPriceDelta).toBe(120);
    expect(steel?.amountDelta).toBe(12784);
    expect(steel?.changeMark).toBe("modify");
    expect(steel?.autoChangeReason).toContain("调量调价");
  });

  it("keeps increase and decrease amounts balanced when increase is effective", () => {
    const dashboard = calculateCostingDashboard(quantityCostingPhase1Project);

    expect(dashboard.summary.increaseAmount).toBe(36454);
    expect(dashboard.summary.decreaseAmount).toBe(21840);
    expect(
      dashboard.summary.increaseAmount - dashboard.summary.decreaseAmount,
    ).toBe(dashboard.summary.amountDelta);
  });

  it("blocks submitted-to-approved conversion for review additions", () => {
    const addItem = quantityCostingPhase1Project.boqItems.find(
      (item) => item.itemId === "boq-bolt-001",
    );
    expect(addItem).toBeDefined();

    const result = convertBoqItemData(addItem!, "submitted_to_approved");
    expect(result.blockedReason).toContain("审增项不可执行");
    expect(result.item).toBe(addItem);
  });

  it("converts approved values back to submitted values for selected rows", () => {
    const steel = quantityCostingPhase1Project.boqItems.find(
      (item) => item.itemId === "boq-steel-001",
    );
    expect(steel).toBeDefined();

    const result = convertBoqItemData(steel!, "approved_to_submitted");
    expect(result.blockedReason).toBeNull();
    expect(result.item.submittedQty).toBe(27.2);
    expect(result.item.submittedUnitPrice).toBe(6920);
    expect(computeBoqItem(result.item).changeMark).toBe("none");
  });

  it("filters analysis rows by mark, text, and numeric delta", () => {
    const { computedItems } = calculateCostingDashboard(
      quantityCostingPhase1Project,
    );

    const changedSteelRows = filterCostAnalysisItems(computedItems, {
      featureContains: "节点板",
      mark: "modify",
      numeric: [{ field: "amountDelta", operator: "abs_gte", value: 10000 }],
    });

    expect(changedSteelRows.map((item) => item.itemId)).toEqual([
      "boq-steel-001",
    ]);
  });

  it("selects rows by accumulated absolute delta share", () => {
    const { computedItems } = calculateCostingDashboard(
      quantityCostingPhase1Project,
    );

    expect(selectCostItemsByDeltaShare(computedItems, 50)).toEqual([
      "boq-measure-001",
      "boq-bolt-001",
    ]);
    expect(selectCostItemsByDeltaShare(computedItems, 100)).toEqual([
      "boq-measure-001",
      "boq-bolt-001",
      "boq-steel-001",
      "boq-fire-001",
    ]);
  });

  it("merges analysis rows and keeps quantity hidden when units conflict", () => {
    const { computedItems } = calculateCostingDashboard(
      quantityCostingPhase1Project,
    );

    const groups = mergeCostAnalysisItems(computedItems, ["nodeId"]);
    const steelGroup = groups.find((group) => group.groupId === "node-steel");

    expect(steelGroup?.itemIds).toEqual([
      "boq-steel-001",
      "boq-bolt-001",
      "boq-fire-001",
    ]);
    expect(steelGroup?.unitConsistent).toBe(false);
    expect(steelGroup?.qtyDelta).toBeNull();
    expect(steelGroup?.amountDelta).toBe(36454);
  });

  it("creates the next review round from the approved baseline", () => {
    const next = createNextReviewVersion(
      quantityCostingPhase1Project,
      "第二审",
    );

    expect(next.versionId).toBe("review-r2");
    expect(next.reviewRound).toBe(2);
    expect(next.submittedVersionId).toBe("approved-r1");
    expect(next.status).toBe("reviewing");
  });

  it("generates professional-review-required report snapshots from selected rows", () => {
    const report = generateReviewReportSnapshot(quantityCostingPhase1Project, [
      "boq-steel-001",
      "boq-fire-001",
    ]);

    expect(report.outputState).toBe("professional_review_required");
    expect(report.selectedCount).toBe(2);
    expect(report.amountDelta).toBe(22504);
  });

  it("marks temporary rows independently from display color rules", () => {
    const temporaryItem: QuantityCostingBoqItem = {
      ...quantityCostingPhase1Project.boqItems[0]!,
      itemId: "boq-temp-001",
      temporary: true,
      ruleId: "",
    };

    const computed = computeBoqItem(temporaryItem);
    expect(computed.changeMark).toBe("temporary");
    expect(computed.sourceReviewRequired).toBe(true);
    expect(computed.autoChangeReason).toContain("临项");
  });

  it("validates 9-digit BOQ codes and resolves quota items from the registry", () => {
    expect(validateBoqCode("010515001")).toBe(true);
    expect(validateBoqCode("010515001-1")).toBe(false);
    expect(validateBoqCode("")).toBe(false);

    const quotaItem = findQuotaItemByBoqCode(
      quantityCostingPhase2Registry,
      "010515001",
    );
    expect(quotaItem?.quotaItemId).toBe("quota-steel-member-demo");
  });

  it("calculates resource, management, profit, and risk unit price components", () => {
    const breakdown = calculateQuotaUnitPrice(
      quantityCostingPhase2Registry,
      "quota-steel-member-demo",
    );

    expect(breakdown.directCost).toBe(9342);
    expect(breakdown.managementFee).toBe(747.36);
    expect(breakdown.profit).toBe(467.1);
    expect(breakdown.risk).toBe(186.84);
    expect(breakdown.unitPrice).toBe(10743.3);
    expect(
      breakdown.components.map((component) => component.componentType),
    ).toEqual(["labor", "material", "machine", "management", "profit", "risk"]);
    expect(breakdown.sourceReviewRequired).toBe(true);
    expect(breakdown.missingSourceRefs).toEqual(
      expect.arrayContaining([
        "quota-steel-member-demo",
        "quota-steel-member-demo-management",
        "quota-steel-member-demo-profit",
        "quota-steel-member-demo-risk",
      ]),
    );
  });

  it("calculates organization measure items with source review gating", () => {
    const safety = calculateMeasureItem(quantityCostingPhase2MeasureItems[0]!);
    const temporary = calculateMeasureItem(
      quantityCostingPhase2MeasureItems[1]!,
    );

    expect(safety.submittedAmount).toBe(10247.3);
    expect(safety.approvedAmount).toBe(11680.97);
    expect(safety.amountDelta).toBe(1433.67);
    expect(safety.changeMark).toBe("modify");
    expect(safety.sourceReviewRequired).toBe(true);

    expect(temporary.submittedAmount).toBe(5270.04);
    expect(temporary.approvedAmount).toBe(5533.09);
  });

  it("calculates other items and detects add/modify states", () => {
    const provisional = calculateOtherItem(quantityCostingPhase2OtherItems[0]!);
    const daywork = calculateOtherItem(quantityCostingPhase2OtherItems[1]!);

    expect(provisional.amountDelta).toBe(-15000);
    expect(provisional.changeMark).toBe("modify");
    expect(provisional.sourceReviewRequired).toBe(false);
    expect(daywork.amountDelta).toBe(6800);
    expect(daywork.changeMark).toBe("add");
  });

  it("calculates fee summary items without turning missing fee rules into conclusions", () => {
    const tax = calculateFeeSummaryItem(quantityCostingPhase2FeeRules[0]!);

    expect(tax.submittedAmount).toBe(32246.76);
    expect(tax.approvedAmount).toBe(32976.73);
    expect(tax.amountDelta).toBe(729.97);
    expect(tax.changeMark).toBe("modify");
    expect(tax.sourceReviewRequired).toBe(true);
  });
});
