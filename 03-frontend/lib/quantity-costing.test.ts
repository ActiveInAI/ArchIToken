// lib/quantity-costing.test.ts - Quantity costing review kernel tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  applyCostProjectImportPlan,
  addReportsToCostReportScheme,
  buildCostQuantityExpressionDetails,
  buildCostResourceComparisonRows,
  buildCostProjectImportPlan,
  buildReviewReportPreview,
  calculateCostingDashboard,
  calculateFeeSummaryItem,
  calculateIncreaseDecreaseByStrategy,
  calculateMeasureItem,
  calculateOtherItem,
  calculateQuotaUnitPrice,
  computeBoqItem,
  convertBoqItemData,
  isGeneratedBoqChangeReason,
  inferBoqManualChangeReason,
  convertFeeRuleData,
  convertMeasureItemData,
  convertReviewVersionToBudget,
  copyCostProjectNode,
  convertOtherItemData,
  createReportExportTasks,
  createReportExportTasksFromScheme,
  createReportSchemeApplicationPlan,
  createNextReviewVersion,
  deleteReviewVersion,
  findQuotaItemByBoqCode,
  filterCostAnalysisItems,
  generateReviewReportSnapshot,
  hasActiveCostAnalysisFilters,
  loadCostReportScheme,
  markCostProjectNodesDeleted,
  mergeCostAnalysisItems,
  quantityCostingSystemReportScheme,
  quantityCostingDefaultReportMetadata,
  quantityCostingImportedReviewNodes,
  quantityCostingPhase1Project,
  quantityCostingPhase2FeeRules,
  quantityCostingPhase2MeasureItems,
  quantityCostingPhase2OtherItems,
  quantityCostingPhase2Registry,
  selectCostAnalysisItemsByRule,
  selectCostItemsByDeltaShare,
  setBoqItemChangeReason,
  summarizeCostAnalysisByLevel,
  switchSubmittedReviewVersion,
  updateCostReportExportSettings,
  validateCostAnalysisMerge,
  validateBoqCode,
  clearGeneratedBoqChangeReasons,
  restoreSystemReportScheme,
  saveCostReportScheme,
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

  it("blocks merge analysis while filters are active", () => {
    const emptyFilters = {};
    const activeFilters = {
      mark: "modify" as const,
      numeric: [
        {
          field: "amountDelta" as const,
          operator: "abs_gte" as const,
          value: 1,
        },
      ],
    };

    expect(hasActiveCostAnalysisFilters(emptyFilters)).toBe(false);
    expect(hasActiveCostAnalysisFilters(activeFilters)).toBe(true);
    expect(validateCostAnalysisMerge(emptyFilters)).toEqual({
      allowed: true,
      blockedReason: null,
    });
    expect(validateCostAnalysisMerge(activeFilters)).toMatchObject({
      allowed: false,
    });
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
    expect(
      selectCostAnalysisItemsByRule(computedItems, {
        mode: "delta_rank",
        value: 2,
      }),
    ).toEqual(["boq-measure-001", "boq-bolt-001"]);
    expect(
      selectCostAnalysisItemsByRule(computedItems, {
        mode: "absolute_delta",
        value: 10000,
      }),
    ).toEqual(["boq-measure-001", "boq-bolt-001", "boq-steel-001"]);
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

  it("summarizes cost analysis by single project, unit project, and fee levels", () => {
    const { computedItems } = calculateCostingDashboard(
      quantityCostingPhase1Project,
    );

    const bySingle = summarizeCostAnalysisByLevel(
      quantityCostingPhase1Project,
      computedItems,
      "single_project",
    );
    const byUnit = summarizeCostAnalysisByLevel(
      quantityCostingPhase1Project,
      computedItems,
      "unit_project",
    );
    const byFee = summarizeCostAnalysisByLevel(
      quantityCostingPhase1Project,
      computedItems,
      "fee",
    );

    expect(bySingle).toHaveLength(1);
    expect(bySingle[0]?.nodeName).toBe("一期样板区");
    expect(bySingle[0]?.amountDelta).toBe(14614);
    expect(byUnit.map((row) => row.nodeName)).toEqual([
      "钢结构工程",
      "建筑装饰工程",
    ]);
    expect(byFee).toHaveLength(computedItems.length);
    expect(byFee[0]?.level).toBe("fee");
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

  it("matches imported approved project structures and adds unmatched units", () => {
    const plan = buildCostProjectImportPlan(
      quantityCostingPhase1Project.treeNodes,
      quantityCostingImportedReviewNodes,
      ["name", "specialty", "standardProfile", "quotaLibrary"],
      "review_gbq7",
    );

    expect(plan.autoMatchedCount).toBe(2);
    expect(plan.manualRequiredCount).toBe(1);
    expect(
      plan.rows.find((row) => row.importNodeId === "import-mep"),
    ).toMatchObject({
      action: "add",
      status: "unmatched",
    });

    const merged = applyCostProjectImportPlan(
      quantityCostingPhase1Project,
      quantityCostingImportedReviewNodes,
      plan,
    );
    expect(merged.treeNodes.some((node) => node.name === "安装工程")).toBe(
      true,
    );
  });

  it("copies project tree nodes and blocks deleting the current review version", () => {
    const copied = copyCostProjectNode(
      quantityCostingPhase1Project,
      "node-steel",
      "node-single",
    );
    expect(copied.treeNodes.at(-1)?.name).toBe("钢结构工程 副本");

    const batchDeleted = markCostProjectNodesDeleted(
      quantityCostingPhase1Project,
      ["node-steel", "node-decoration"],
    );
    expect(
      batchDeleted.treeNodes
        .filter((node) => node.auditState === "archived")
        .map((node) => node.nodeId),
    ).toEqual(["node-steel", "node-decoration"]);

    const switched = switchSubmittedReviewVersion(
      quantityCostingPhase1Project,
      "review-r1",
      "budget-v1",
    );
    expect(
      switched.versions.find((version) => version.versionId === "review-r1")
        ?.submittedVersionId,
    ).toBe("budget-v1");

    const deleted = deleteReviewVersion(
      quantityCostingPhase1Project,
      "review-r1",
    );
    expect(deleted.blockedReason).toContain("当前审核版本不可删除");
  });

  it("generates professional-review-required report snapshots from selected rows", () => {
    const report = generateReviewReportSnapshot(quantityCostingPhase1Project, [
      "boq-steel-001",
      "boq-fire-001",
    ]);

    expect(report.outputState).toBe("professional_review_required");
    expect(report.selectedCount).toBe(2);
    expect(report.amountDelta).toBe(22504);

    const preview = buildReviewReportPreview(
      quantityCostingPhase1Project,
      ["boq-steel-001", "boq-fire-001"],
      quantityCostingDefaultReportMetadata,
    );
    expect(preview.sections.map((section) => section.sectionId)).toEqual([
      "project-info",
      "fee-info",
      "delta-analysis",
    ]);
    expect(preview.editable).toBe(true);

    const tasks = createReportExportTasks(
      ["审核报告", "费用汇总表"],
      ["excel", "pdf", "print"],
    );
    expect(tasks).toHaveLength(6);
    expect(
      tasks.some((task) => task.outputState === "professional_review_required"),
    ).toBe(true);
  });

  it("saves, loads, restores, and runs report schemes", () => {
    const archived = saveCostReportScheme(
      quantityCostingSystemReportScheme,
      "项目审核报表方案",
    );
    const loaded = loadCostReportScheme(archived);
    const restored = restoreSystemReportScheme();
    const tasks = createReportExportTasksFromScheme(loaded);

    expect(archived.source).toBe("archived");
    expect(loaded.source).toBe("loaded");
    expect(restored.source).toBe("system");
    expect(tasks).toHaveLength(
      loaded.reportNames.length * loaded.formats.length,
    );
    expect(tasks.every((task) => task.schemeId === loaded.schemeId)).toBe(true);
  });

  it("updates report design settings and applies schemes to unit projects", () => {
    const withMoreReports = addReportsToCostReportScheme(
      quantityCostingSystemReportScheme,
      ["其他项目清单与计价表", "措施项目清单与计价表"],
    );
    const designed = updateCostReportExportSettings(withMoreReports, {
      includeWatermark: true,
      watermarkText: "内部复核水印",
      pageNumberMode: "custom",
      startPage: 3,
      totalPages: 12,
    });
    const plan = createReportSchemeApplicationPlan(
      quantityCostingPhase1Project,
      designed,
    );

    expect(designed.reportNames).toEqual(
      expect.arrayContaining(["其他项目清单与计价表", "措施项目清单与计价表"]),
    );
    expect(designed.exportSettings.watermarkText).toBe("内部复核水印");
    expect(designed.exportSettings.pageNumberMode).toBe("custom");
    expect(plan.targetNodeIds).toEqual(["node-steel", "node-decoration"]);
    expect(plan.outputState).toBe("professional_review_required");
  });

  it("allows manual change reasons and clearing generated descriptions", () => {
    const steel = quantityCostingPhase1Project.boqItems.find(
      (item) => item.itemId === "boq-steel-001",
    );
    expect(steel).toBeDefined();

    const manual = setBoqItemChangeReason(steel!, "工程量按复核图纸调整");
    expect(computeBoqItem(manual).changeReason).toBe("工程量按复核图纸调整");

    const [cleared] = clearGeneratedBoqChangeReasons([manual]);
    expect(computeBoqItem(cleared!).changeReason).toBe("");
    expect(computeBoqItem(cleared!).autoChangeReason).toContain("调量调价");
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

  it("builds resource comparison and quantity expression details", () => {
    const dashboard = calculateCostingDashboard(quantityCostingPhase1Project);
    const steel = dashboard.computedItems.find(
      (item) => item.itemId === "boq-steel-001",
    );
    const breakdown = calculateQuotaUnitPrice(
      quantityCostingPhase2Registry,
      "quota-steel-member-demo",
    );
    expect(steel).toBeDefined();

    const rows = buildCostResourceComparisonRows(breakdown, steel!);
    const quantityDetails = buildCostQuantityExpressionDetails(steel!);

    expect(rows).toHaveLength(6);
    expect(rows.some((row) => row.changeMark === "temporary")).toBe(true);
    expect(rows[0]?.approvedConsumption).toBeGreaterThan(
      rows[0]?.submittedConsumption ?? 0,
    );
    expect(quantityDetails.map((detail) => detail.variableCode)).toEqual([
      "GCL",
      "ZJJE",
    ]);
    expect(quantityDetails[0]?.resultDelta).toBe(1.4);
    expect(quantityDetails[1]?.resultDelta).toBe(12784);
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
    expect(safety.changeReason).toContain("修改");
    expect(safety.sourceReviewRequired).toBe(true);

    expect(temporary.submittedAmount).toBe(5270.04);
    expect(temporary.approvedAmount).toBe(5533.09);
  });

  it("converts measure, other, and fee data in both directions", () => {
    const measureForward = convertMeasureItemData(
      quantityCostingPhase2MeasureItems[0]!,
      "submitted_to_approved",
    );
    expect(measureForward.blockedReason).toBeNull();
    expect(calculateMeasureItem(measureForward.item).amountDelta).toBe(0);

    const measureBackward = convertMeasureItemData(
      quantityCostingPhase2MeasureItems[0]!,
      "approved_to_submitted",
    );
    expect(calculateMeasureItem(measureBackward.item).amountDelta).toBe(0);

    const otherForward = convertOtherItemData(
      quantityCostingPhase2OtherItems[0]!,
      "submitted_to_approved",
    );
    expect(calculateOtherItem(otherForward.item).amountDelta).toBe(0);

    const feeForward = convertFeeRuleData(
      quantityCostingPhase2FeeRules[0]!,
      "submitted_to_approved",
    );
    expect(calculateFeeSummaryItem(feeForward.rule).amountDelta).toBe(0);
  });

  it("calculates other items and detects add/modify states", () => {
    const provisional = calculateOtherItem(quantityCostingPhase2OtherItems[0]!);
    const daywork = calculateOtherItem(quantityCostingPhase2OtherItems[1]!);
    const service = calculateOtherItem(quantityCostingPhase2OtherItems[2]!);

    expect(provisional.amountDelta).toBe(-15000);
    expect(provisional.changeMark).toBe("modify");
    expect(provisional.sourceReviewRequired).toBe(false);
    expect(daywork.amountDelta).toBe(6800);
    expect(daywork.changeMark).toBe("add");
    expect(service.amountDelta).toBe(3000);
    expect(service.changeMark).toBe("modify");
  });

  it("calculates fee summary items without turning missing fee rules into conclusions", () => {
    const tax = calculateFeeSummaryItem(quantityCostingPhase2FeeRules[0]!);

    expect(tax.submittedAmount).toBe(33326.76);
    expect(tax.approvedAmount).toBe(34326.73);
    expect(tax.amountDelta).toBe(999.97);
    expect(tax.changeMark).toBe("modify");
    expect(tax.sourceReviewRequired).toBe(true);
  });

  it("calculates code, fee-code, and constant increase/decrease strategies", () => {
    const code = calculateIncreaseDecreaseByStrategy({
      strategyType: "code",
      label: "FBFXHJ",
      submittedAmount: 1000,
      approvedAmount: 1100,
      relatedIncreaseAmount: 180,
    });
    expect(code.increaseAmount).toBe(180);
    expect(code.decreaseAmount).toBe(80);
    expect(code.amountDelta).toBe(100);

    const feeCode = calculateIncreaseDecreaseByStrategy({
      strategyType: "fee_code",
      label: "税金",
      submittedAmount: 1000,
      approvedAmount: 1175.18,
      relatedIncreaseAmount: 1621.25,
      submittedBaseAmount: 1305.75,
      approvedBaseAmount: 1621.25,
      submittedRate: 0.09,
      approvedRate: 0.1,
    });
    expect(feeCode.increaseAmount).toBe(175.18);
    expect(feeCode.decreaseAmount).toBe(0);

    const constant = calculateIncreaseDecreaseByStrategy({
      strategyType: "constant",
      label: "常数费用",
      submittedAmount: 7350000,
      approvedAmount: 7300000,
    });
    expect(constant.increaseAmount).toBe(0);
    expect(constant.decreaseAmount).toBe(50000);
  });
});

describe("convertReviewVersionToBudget", () => {
  it("审定转预算: 双侧统一为审定值并保留删项痕迹清零", () => {
    const result = convertReviewVersionToBudget(
      quantityCostingPhase1Project,
      "approved",
    );
    expect(result.fileName).toBe(
      `[审定预算]${quantityCostingPhase1Project.projectName}`,
    );
    expect(result.sourceReviewVersionId).toBe("review-r1");
    expect(result.version.versionType).toBe("budget");
    expect(result.version.status).toBe("draft");

    const steel = result.boqItems.find((item) =>
      item.itemId.startsWith("boq-steel-001"),
    );
    expect(steel?.submittedQty).toBe(27.2);
    expect(steel?.approvedQty).toBe(27.2);
    expect(steel?.submittedUnitPrice).toBe(6920);
    expect(steel?.submittedFeature).toBe(steel?.approvedFeature);

    const converted = calculateCostingDashboard({
      ...quantityCostingPhase1Project,
      boqItems: result.boqItems,
    });
    expect(converted.summary.amountDelta).toBe(0);
    expect(converted.summary.markCounts.add).toBe(0);
    expect(converted.summary.markCounts.modify).toBe(0);
  });

  it("送审转预算: 丢弃送审侧为空的增项", () => {
    const result = convertReviewVersionToBudget(
      quantityCostingPhase1Project,
      "submitted",
    );
    expect(result.fileName).toBe(
      `[送审预算]${quantityCostingPhase1Project.projectName}`,
    );
    expect(result.droppedItemIds).toContain("boq-bolt-001");
    expect(
      result.boqItems.some((item) => item.itemId.startsWith("boq-bolt-001")),
    ).toBe(false);
    const scaffold = result.boqItems.find((item) =>
      item.itemId.startsWith("boq-measure-001"),
    );
    expect(scaffold?.approvedQty).toBe(520);
    expect(scaffold?.approvedUnitPrice).toBe(42);
  });
});

describe("change reason residue prevention", () => {
  it("识别自动生成的增减说明（【】文案与无增减）", () => {
    expect(
      isGeneratedBoqChangeReason("【调量调价】工程量与综合单价均发生变化。"),
    ).toBe(true);
    expect(isGeneratedBoqChangeReason("无增减。")).toBe(true);
    expect(isGeneratedBoqChangeReason("")).toBe(true);
    expect(isGeneratedBoqChangeReason("业主口头确认增加节点板复核")).toBe(
      false,
    );
  });

  it("快照恢复时自动文案不固化为手工覆盖，手工说明保留", () => {
    expect(
      inferBoqManualChangeReason("【增项】送审合价为空或为0,审定合价不为0。"),
    ).toBeUndefined();
    expect(inferBoqManualChangeReason("无增减。")).toBeUndefined();
    expect(inferBoqManualChangeReason("现场签证 #12 调整")).toBe(
      "现场签证 #12 调整",
    );
  });

  it("数据转换后旧增减说明不残留，按新数据重算为无增减", () => {
    const steel = quantityCostingPhase1Project.boqItems.find(
      (item) => item.itemId === "boq-steel-001",
    )!;
    const stale = {
      ...steel,
      manualChangeReason: "【调量调价】工程量与综合单价均发生变化。",
    };
    const result = convertBoqItemData(stale, "submitted_to_approved");
    expect(result.blockedReason).toBeNull();
    const computed = computeBoqItem(result.item);
    expect(computed.changeMark).toBe("none");
    expect(computed.changeReason).toBe("无增减。");
  });
});
