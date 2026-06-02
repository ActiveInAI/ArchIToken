// lib/steel-platform.test.ts - Steel platform kernel contract tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import { generatePlan, initialIntent } from "@/lib/architoken/floorplan-layout";
import {
  createSteelPlatformPackage,
  steelPlatformDefaultSettings,
} from "@/lib/steel-platform";

describe("steel platform detailed-design kernel", () => {
  it("derives review-required steel layout and BOM from a generated plan", () => {
    const plan = generatePlan(initialIntent);
    const designPackage = createSteelPlatformPackage(
      plan,
      {
        ...steelPlatformDefaultSettings,
        maxSpanMm: 4800,
      },
      {
        openings: [
          {
            id: "OP-1",
            wallSide: "south",
            centerMm: 2400,
            widthMm: 1200,
            heightMm: 1500,
            sillMm: 900,
            openingType: "window",
            frameType: "4-edge",
            floor: 1,
          },
        ],
        interiorDoors: [{ wallId: "IW-F1-1", positionMm: 2400, flip: 0 }],
      },
    );

    expect(designPackage.schema).toBe(
      "architoken.steel_platform_design_package.v1",
    );
    expect(designPackage.reviewState).toBe("professional_review_required");
    expect(designPackage.structuralLayout.columns.length).toBeGreaterThan(0);
    expect(designPackage.structuralLayout.mainBeams.length).toBeGreaterThan(0);
    expect(designPackage.structuralLayout.wallBays.length).toBeGreaterThan(0);
    expect(
      designPackage.structuralLayout.constructionColumnGroups.length,
    ).toBeGreaterThan(0);
    expect(designPackage.structuralLayout.interiorWalls.length).toBeGreaterThan(
      0,
    );
    expect(
      designPackage.structuralLayout.exteriorOpenings[0]?.bayId,
    ).toBeTruthy();
    expect(designPackage.bom.summary.totalSteelT).toBeGreaterThan(0);
    expect(designPackage.bom.rows.some((row) => row.item === "门窗洞口")).toBe(
      true,
    );
    expect(designPackage.aiGateChain.map((gate) => gate.name)).toEqual([
      "Planner",
      "Generator",
      "Evaluator",
      "RuleChecker",
      "SchemaValidator",
      "Approver",
    ]);
    expect(designPackage.ruleChecks.at(-1)?.status).toBe(
      "professional_review_required",
    );
  });
});
