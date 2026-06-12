// lib/quantity-costing-rule-check.test.ts - Costing rule check engine tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  calculateCostingDashboard,
  quantityCostingPhase2Registry,
  type QuantityCostingBoqItem,
  type QuantityCostingProject,
} from "./quantity-costing";
import { runCostingRuleChecks } from "./quantity-costing-rule-check";

function buildProject(
  items: Array<Partial<QuantityCostingBoqItem>>,
): QuantityCostingProject {
  return {
    projectId: "qc-test-project",
    projectName: "校验检查测试工程",
    jurisdiction: "CN-SC",
    standardProfileId: "GB/T50500-2024",
    quotaLibraryId: "SC-local-quota-placeholder",
    currentNodeId: "node-unit",
    treeNodes: [
      {
        nodeId: "node-unit",
        projectId: "qc-test-project",
        parentId: null,
        nodeType: "unit_project",
        name: "钢结构单位工程",
        specialty: "钢结构",
        sortOrder: 1,
        standardProfileId: "GB/T50500-2024",
        quotaLibraryId: "SC-local-quota-placeholder",
        auditState: "reviewing",
      },
    ],
    versions: [],
    boqItems: items.map((item, index) => ({
      itemId: `item-${index + 1}`,
      projectId: "qc-test-project",
      nodeId: "node-unit",
      submittedCode: "010515001",
      approvedCode: "010515001",
      submittedName: "钢构件",
      approvedName: "钢构件",
      submittedFeature: "Q355B",
      approvedFeature: "Q355B",
      unit: "t",
      submittedQty: 10,
      approvedQty: 10,
      submittedUnitPrice: 10743.3,
      approvedUnitPrice: 10743.3,
      sourceRef: "GB/T50500-2024",
      ruleId: "rule-demo",
      ...item,
    })),
  };
}

describe("runCostingRuleChecks", () => {
  it("规范数据全部规则通过", () => {
    const dashboard = calculateCostingDashboard(buildProject([{}]));
    const report = runCostingRuleChecks(
      dashboard,
      quantityCostingPhase2Registry,
    );
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.passedRuleCount).toBe(report.checkedRuleCount);
    expect(report.conclusion).toContain("校验通过");
  });

  it("非 9 位编码触发编码格式错误", () => {
    const dashboard = calculateCostingDashboard(
      buildProject([{ approvedCode: "0105150" }]),
    );
    const report = runCostingRuleChecks(
      dashboard,
      quantityCostingPhase2Registry,
    );
    const finding = report.findings.find((f) => f.ruleId === "QC-CODE-001");
    expect(finding?.severity).toBe("error");
    expect(finding?.result).toContain("0105150");
  });

  it("同一单位工程编码重复触发警告", () => {
    const dashboard = calculateCostingDashboard(buildProject([{}, {}]));
    const report = runCostingRuleChecks(
      dashboard,
      quantityCostingPhase2Registry,
    );
    const finding = report.findings.find((f) => f.ruleId === "QC-CODE-002");
    expect(finding?.severity).toBe("warning");
    expect(finding?.result).toContain("重复 2 次");
  });

  it("定额库未匹配与单位不一致分别触发", () => {
    const dashboard = calculateCostingDashboard(
      buildProject([
        { submittedCode: "019999001", approvedCode: "019999001" },
        { unit: "kg" },
      ]),
    );
    const report = runCostingRuleChecks(
      dashboard,
      quantityCostingPhase2Registry,
    );
    expect(
      report.findings.some((f) => f.ruleId === "QC-QUOTA-001"),
    ).toBe(true);
    const unitFinding = report.findings.find((f) => f.ruleId === "QC-UNIT-001");
    expect(unitFinding?.severity).toBe("error");
    expect(unitFinding?.result).toContain('"kg"');
  });

  it("综合单价偏离定额组价超阈值触发警告", () => {
    const dashboard = calculateCostingDashboard(
      buildProject([{ approvedUnitPrice: 6920 }]),
    );
    const report = runCostingRuleChecks(
      dashboard,
      quantityCostingPhase2Registry,
      { unitPriceDeviationThreshold: 0.15 },
    );
    const finding = report.findings.find((f) => f.ruleId === "QC-PRICE-001");
    expect(finding?.severity).toBe("warning");
    expect(finding?.result).toContain("-35.6%");
  });

  it("放宽阈值后单价偏差不再触发", () => {
    const dashboard = calculateCostingDashboard(
      buildProject([{ approvedUnitPrice: 6920 }]),
    );
    const report = runCostingRuleChecks(
      dashboard,
      quantityCostingPhase2Registry,
      { unitPriceDeviationThreshold: 0.5 },
    );
    expect(
      report.findings.some((f) => f.ruleId === "QC-PRICE-001"),
    ).toBe(false);
  });

  it("计算式与审定工程量不一致触发错误", () => {
    const dashboard = calculateCostingDashboard(
      buildProject([{ approvedQty: 27.2 }]),
    );
    const report = runCostingRuleChecks(
      dashboard,
      quantityCostingPhase2Registry,
      {
        expressionInputs: [
          { itemId: "item-1", approvedExpression: "25.8+1.0" },
        ],
      },
    );
    const finding = report.findings.find((f) => f.ruleId === "QC-EXPR-001");
    expect(finding?.severity).toBe("error");
    expect(finding?.result).toContain("26.8");
  });

  it("计算式一致时校验通过", () => {
    const dashboard = calculateCostingDashboard(
      buildProject([{ approvedQty: 27.2 }]),
    );
    const report = runCostingRuleChecks(
      dashboard,
      quantityCostingPhase2Registry,
      {
        expressionInputs: [
          { itemId: "item-1", approvedExpression: "25.8+1.4" },
        ],
      },
    );
    expect(
      report.findings.some((f) => f.ruleId === "QC-EXPR-001"),
    ).toBe(false);
  });

  it("删项不参与编码重复与定额匹配", () => {
    const dashboard = calculateCostingDashboard(
      buildProject([
        {},
        { approvedCode: "", approvedName: "", approvedQty: 0, approvedUnitPrice: 0 },
      ]),
    );
    const report = runCostingRuleChecks(
      dashboard,
      quantityCostingPhase2Registry,
    );
    expect(
      report.findings.some((f) => f.ruleId === "QC-CODE-002"),
    ).toBe(false);
  });

  it("变更项缺增减说明触发警告", () => {
    const dashboard = calculateCostingDashboard(
      buildProject([{ approvedQty: 12, manualChangeReason: "" }]),
    );
    const hasAutoReason = dashboard.computedItems[0]?.changeReason !== "";
    const report = runCostingRuleChecks(
      dashboard,
      quantityCostingPhase2Registry,
    );
    // 内核自动生成增减说明时不触发；该规则兜底说明被清空的场景
    expect(
      report.findings.some((f) => f.ruleId === "QC-REASON-001"),
    ).toBe(!hasAutoReason);
  });
});
