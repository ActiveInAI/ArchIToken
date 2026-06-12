import { describe, expect, it } from "vitest";

import { checkFloorplanCompliance } from "./floorplan-compliance";
import {
  createPlanCandidates,
  initialIntent,
  normalizePlanFromBlocks,
  parsePromptToIntent,
  rectBlock,
} from "./floorplan-layout";

function bestPlan(prompt: string) {
  const candidates = createPlanCandidates(
    parsePromptToIntent(prompt, initialIntent),
  );
  const best = candidates.reduce((acc, item) =>
    item.score > acc.score ? item : acc,
  );
  return best.plan;
}

describe("checkFloorplanCompliance", () => {
  it("passes generated rect, two-floor and L-shaped plans without errors", () => {
    for (const prompt of [
      "生成120平三室两厅的户型",
      "生成80平两室一厅的户型",
      "生成一个L形100平三室两厅的户型",
      "生成110平三室两厅双卫两层的户型",
    ]) {
      const report = checkFloorplanCompliance(bestPlan(prompt));
      expect(report.passed, `${prompt}: ${JSON.stringify(report.issues)}`).toBe(
        true,
      );
      expect(report.issueCounts.error).toBe(0);
      expect(report.issueCounts.warning).toBe(0);
    }
  });

  it("always demands professional review and cites its basis", () => {
    const report = checkFloorplanCompliance(bestPlan("生成90平三室一厅的户型"));
    expect(report.reviewState).toBe("professional_review_required");
    expect(report.basis).toContain("GB 50096");
    expect(
      report.issues.some((issue) => issue.id === "compliance-review-required"),
    ).toBe(true);
  });

  it("flags an isolated bedroom with no door to circulation", () => {
    const base = bestPlan("生成80平两室一厅的户型");
    const isolated = normalizePlanFromBlocks(base, [
      rectBlock("R_次卧_孤岛", "次卧", 0, 0, 3300, 3300, 1),
      rectBlock("R_厨房", "厨房", 3300, 0, 6000, 3300, 1),
    ]);
    const report = checkFloorplanCompliance(isolated);
    expect(report.passed).toBe(false);
    expect(
      report.issues.some(
        (issue) =>
          issue.severity === "error" && issue.id.startsWith("door-missing-"),
      ),
    ).toBe(true);
  });

  it("flags undersized rooms", () => {
    const base = bestPlan("生成80平两室一厅的户型");
    const cramped = normalizePlanFromBlocks(base, [
      rectBlock("R_客厅", "客厅", 0, 0, 2400, 2400, 1),
      rectBlock("R_主卧", "主卧", 2400, 0, 4800, 2400, 1),
    ]);
    const report = checkFloorplanCompliance(cramped);
    expect(
      report.issues.some(
        (issue) => issue.severity === "error" && issue.id.startsWith("area-"),
      ),
    ).toBe(true);
  });
});
