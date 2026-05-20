import type { Floorplan } from "@/lib/insome/floorplan";
import { checkModularGrid } from "./modular-grid";
import { checkStoryCount } from "./story-count";
import { checkStoryHeight } from "./story-height";
import { checkColumnSpan } from "./column-span";
import type { ConstraintResult } from "./types";

export function checkAllConstraints(floorplan: Floorplan): ConstraintResult {
  const violations = [
    ...checkModularGrid(floorplan),
    ...checkStoryCount(floorplan),
    ...checkStoryHeight(floorplan),
    ...checkColumnSpan(floorplan),
  ];
  return {
    passed: violations.every((v) => v.severity !== "error"),
    violations,
  };
}
