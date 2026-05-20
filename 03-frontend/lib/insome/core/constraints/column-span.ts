import type { Floorplan } from "@/lib/insome/floorplan";
import { MAX_COLUMN_SPAN_M, TOLERANCE_M, type ConstraintViolation } from "./types";

/**
 * Simplified column-span check: max distance between ANY two wall endpoints
 * must be ≤ 12m. A rough proxy for real structural column spacing, sufficient
 * for the Phase 4.0 demo.
 */
export function checkColumnSpan(
  floorplan: Floorplan,
  maxSpanMeters: number = MAX_COLUMN_SPAN_M,
): ConstraintViolation[] {
  const upm = floorplan.scale.unitsPerMeter;
  const maxSpanUnits = maxSpanMeters * upm;
  let worstSqUnits = 0;
  let worstPairIds: [string, string] | null = null;
  const endpoints: Array<{ wallId: string; x: number; y: number }> = [];
  for (const w of floorplan.walls) {
    endpoints.push({ wallId: w.id, x: w.a.x, y: w.a.y });
    endpoints.push({ wallId: w.id, x: w.b.x, y: w.b.y });
  }
  for (let i = 0; i < endpoints.length; i++) {
    for (let j = i + 1; j < endpoints.length; j++) {
      const a = endpoints[i]!;
      const b = endpoints[j]!;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const sq = dx * dx + dy * dy;
      if (sq > worstSqUnits) {
        worstSqUnits = sq;
        worstPairIds = [a.wallId, b.wallId];
      }
    }
  }
  const worstUnits = Math.sqrt(worstSqUnits);
  if (worstUnits <= maxSpanUnits + TOLERANCE_M) return [];
  return [
    {
      code: "column-span-12000mm",
      severity: "error",
      labelKey: "constraint.warning.columnSpanExceeded",
      affectedIds: worstPairIds ?? [],
      details: {
        spanMm: Math.round((worstUnits / upm) * 1000),
        maxMm: Math.round(maxSpanMeters * 1000),
      },
    },
  ];
}
