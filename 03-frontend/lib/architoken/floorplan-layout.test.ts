import { describe, expect, it } from "vitest";
import {
  buildFurniture,
  buildPlanCdePayload,
  createPlanCandidates,
  evaluatePlan,
  generatePlan,
  initialIntent,
  parsePromptToIntent,
} from "./floorplan-layout";
import {
  generateResidentialProposals,
  summarizeFloorplan,
} from "@/lib/insome/floorplan/variants/residential-generator";

describe("floorplan-layout kernel", () => {
  it("parses a residential prompt into a reusable design intent", () => {
    const intent = parsePromptToIntent(
      "135 平四室两厅双卫，客厅朝南，大餐厅",
      initialIntent,
    );

    expect(intent.totalAreaSqm).toBe(135);
    expect(intent.floors).toBe(2);
    expect(intent.publicSplit).toBe("lk_sep");
    expect(intent.rooms.次卧.count).toBe(3);
    expect(intent.rooms.主卫.count).toBe(1);
  });

  it("creates Generate/Fit/Furnish candidates with evaluation gates", () => {
    const candidates = createPlanCandidates(initialIntent);

    expect(candidates.map((candidate) => candidate.command)).toEqual([
      "Generate",
      "Generate",
      "Fit",
      "Furnish",
    ]);
    expect(candidates.every((candidate) => candidate.score > 0)).toBe(true);
    expect(candidates[0]?.evaluation.gates.map((gate) => gate.name)).toEqual([
      "Planner",
      "Generator",
      "Evaluator",
      "RuleChecker",
      "SchemaValidator",
      "Approver",
    ]);
  });

  it("fits generated plans to a supplied rectangular boundary", () => {
    const intent = {
      ...initialIntent,
      boundary: {
        polygon: [
          { x: 0, y: 0 },
          { x: 15_000, y: 0 },
          { x: 15_000, y: 9_000 },
          { x: 0, y: 9_000 },
        ],
        entrance: { x: 7_500, y: 9_000 },
      },
    };
    const plan = generatePlan(intent);

    expect(plan.summary.envelope).toEqual([15_000, 9_000]);
    expect(plan.blocks.length).toBeGreaterThan(0);
  });

  it("packages CDE payloads with professional review and evaluator evidence", () => {
    const plan = generatePlan(initialIntent);
    const furniture = buildFurniture(plan);
    const evaluation = evaluatePlan(plan, initialIntent, furniture);
    const payload = buildPlanCdePayload({
      moduleId: "detailed_design",
      mode: "furnish",
      intent: initialIntent,
      plan,
      activeCandidate: null,
      candidates: [],
      furniture,
      constructionColumn: true,
    });

    expect(evaluation.reviewState).toBe("professional_review_required");
    expect(payload.schema).toBe("architoken.floorplan_candidate_manifest.v1");
    expect(payload.evaluation.schema).toBe("architoken.floorplan_evaluation_report.v1");
  });

  it("feeds concept design floorplan proposals through the same kernel", () => {
    const plans = generateResidentialProposals({
      widthFt: 38,
      lengthFt: 48,
      stories: 2,
      style: "modern-light-steel",
      bedrooms: 3,
      bathrooms: 2,
    });

    expect(plans.length).toBe(4);
    expect(plans[0]?.rooms.length).toBeGreaterThan(0);
    expect(plans[0] ? summarizeFloorplan(plans[0]).areaSqft : 0).toBeGreaterThan(0);
  });
});
