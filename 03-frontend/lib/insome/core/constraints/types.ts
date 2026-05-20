export type ConstraintCode =
  | "grid-300mm"
  | "story-count-4"
  | "story-height-3600mm"
  | "column-span-12000mm";

export type ConstraintSeverity = "error" | "warning";

export interface ConstraintViolation {
  readonly code: ConstraintCode;
  readonly severity: ConstraintSeverity;
  readonly labelKey: string;
  readonly affectedIds: ReadonlyArray<string>;
  readonly details?: Record<string, number>;
}

export interface ConstraintResult {
  readonly passed: boolean;
  readonly violations: ReadonlyArray<ConstraintViolation>;
}

/**
 * Prefab constraints per INSOME design system:
 *   GRID   — all coords snap to 300mm modular grid
 *   STORY  — maximum 4 stories
 *   HEIGHT — each floor ≤ 3.6m clear
 *   SPAN   — no two wall endpoints further apart than 12m (simplified column span proxy)
 *
 * Demo phase: unit locked to "m". ft conversion logic kept for future.
 */
export const GRID_STEP_M = 0.3;
export const MAX_STORIES = 4;
export const MAX_STORY_HEIGHT_M = 3.6;
export const MAX_COLUMN_SPAN_M = 12;
export const TOLERANCE_M = 1e-6;
