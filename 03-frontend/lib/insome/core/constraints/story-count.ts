import type { Floorplan } from "@/lib/insome/floorplan";
import { MAX_STORIES, type ConstraintViolation } from "./types";

export function checkStoryCount(
  floorplan: Floorplan,
  maxStories: number = MAX_STORIES,
): ConstraintViolation[] {
  const stories = floorplan.stories ?? 1;
  if (stories <= maxStories) return [];
  return [
    {
      code: "story-count-4",
      severity: "error",
      labelKey: "constraint.warning.storyCountExceeded",
      affectedIds: [floorplan.id],
      details: { stories, maxStories },
    },
  ];
}
