import type { Floorplan } from "@/lib/insome/floorplan";
import { MAX_STORY_HEIGHT_M, TOLERANCE_M, type ConstraintViolation } from "./types";

export function checkStoryHeight(
  floorplan: Floorplan,
  maxHeightMeters: number = MAX_STORY_HEIGHT_M,
): ConstraintViolation[] {
  const upm = floorplan.scale.unitsPerMeter;
  const wallHeightUnits = floorplan.defaultWallHeight ?? 2.7 * upm;
  const heightM = wallHeightUnits / upm;
  if (heightM <= maxHeightMeters + TOLERANCE_M) return [];
  return [
    {
      code: "story-height-3600mm",
      severity: "error",
      labelKey: "constraint.warning.storyHeightExceeded",
      affectedIds: [floorplan.id],
      details: { heightMm: Math.round(heightM * 1000), maxMm: Math.round(maxHeightMeters * 1000) },
    },
  ];
}
