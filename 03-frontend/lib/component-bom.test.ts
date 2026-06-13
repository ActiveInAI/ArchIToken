// lib/component-bom.test.ts - Component BOM import workflow contracts
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  componentBomAcceptanceFixture,
  componentBomLines,
  componentBomSourceWorkbooks,
  createComponentBomExportPayload,
  createComponentBomWorkflowState,
  issuesForLine,
  runComponentBomAction,
} from "@/lib/component-bom";

describe("component BOM source workbook contract", () => {
  it("anchors the three real workbooks and source-derived counts", () => {
    expect(componentBomSourceWorkbooks.sjg157.path).toBe(
      "标准库/SJG157-2024-语义字典编码表.xlsx",
    );
    expect(componentBomSourceWorkbooks.namingRule.path).toBe(
      "标准库/装配式钢结构构件标准化命名规则V1.0.xlsx",
    );
    expect(componentBomSourceWorkbooks.bom.path).toBe("（待导入）");
    expect(componentBomAcceptanceFixture.counts.sjg157Categories).toBe(5678);
    expect(componentBomAcceptanceFixture.counts.namingRules).toBe(41);
    expect(componentBomAcceptanceFixture.counts.bomLines).toBe(14);
    expect(componentBomAcceptanceFixture.counts.categoryReferences).toBe(
      new Set(componentBomLines.map((line) => line.categoryCode)).size,
    );
    expect(componentBomAcceptanceFixture.summary.totalQuantity).toBe(470);
    expect(componentBomAcceptanceFixture.summary.totalWeightKg).toBe(0);
  });

  it("keeps the source import review-required and exposes validation warnings", () => {
    expect(componentBomAcceptanceFixture.reviewState).toBe(
      "professional_review_required",
    );
    expect(componentBomAcceptanceFixture.counts.validationErrors).toBe(0);
    expect(componentBomAcceptanceFixture.counts.validationWarnings).toBe(19);
    expect(
      issuesForLine(componentBomAcceptanceFixture.issues, 1).map(
        (issue) => issue.code,
      ),
    ).toEqual([
      "component_prefix_category_conflict",
      "length_token_source_mismatch",
      "weight_missing_in_source",
    ]);
    expect(
      componentBomAcceptanceFixture.issues.some(
        (issue) => issue.code === "naming_prefix_not_in_rulebook",
      ),
    ).toBe(true);
  });

  it("blocks publish before professional approval and exports source paths", () => {
    const state = createComponentBomWorkflowState();
    const validated = runComponentBomAction(
      state,
      "validate",
      new Date("2026-06-09T01:00:00.000Z"),
    );
    const blocked = runComponentBomAction(
      validated,
      "publish",
      new Date("2026-06-09T01:01:00.000Z"),
    );
    expect(blocked.workflowState).toBe("blocked");
    expect(blocked.blockedReason).toContain("未经专业批准");

    const approved = runComponentBomAction(
      validated,
      "approve",
      new Date("2026-06-09T01:02:00.000Z"),
    );
    const published = runComponentBomAction(
      approved,
      "publish",
      new Date("2026-06-09T01:03:00.000Z"),
    );
    expect(published.workflowState).toBe("published");

    const payload = createComponentBomExportPayload(
      componentBomAcceptanceFixture,
      published.workflowState,
      new Date("2026-06-09T01:04:00.000Z"),
    );
    expect(payload.schema).toBe("architoken.component_bom_export_payload.v1");
    expect(payload.sourcePaths).toEqual([
      componentBomSourceWorkbooks.sjg157.path,
      componentBomSourceWorkbooks.namingRule.path,
      componentBomSourceWorkbooks.bom.path,
    ]);
  });
});
