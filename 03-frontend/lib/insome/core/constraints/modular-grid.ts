import type { Floorplan } from "@/lib/insome/floorplan";
import { GRID_STEP_M, TOLERANCE_M, type ConstraintViolation } from "./types";

/** Convert a floorplan-unit value to meters using Floorplan.scale. */
function toMeters(valueUnits: number, unitsPerMeter: number): number {
  return valueUnits / unitsPerMeter;
}

/** A value is on the 300mm grid if its meter equivalent is an integer multiple of 0.3m (tolerance 1e-6). */
function offGrid(valueMeters: number, stepM: number): boolean {
  const ratio = valueMeters / stepM;
  return Math.abs(ratio - Math.round(ratio)) > TOLERANCE_M / stepM;
}

export function checkModularGrid(
  floorplan: Floorplan,
  stepMeters: number = GRID_STEP_M,
): ConstraintViolation[] {
  const upm = floorplan.scale.unitsPerMeter;
  const offending: string[] = [];

  for (const w of floorplan.walls) {
    if (
      offGrid(toMeters(w.a.x, upm), stepMeters) ||
      offGrid(toMeters(w.a.y, upm), stepMeters) ||
      offGrid(toMeters(w.b.x, upm), stepMeters) ||
      offGrid(toMeters(w.b.y, upm), stepMeters)
    ) {
      offending.push(w.id);
    }
  }
  for (const o of floorplan.openings) {
    if (
      offGrid(toMeters(o.offset, upm), stepMeters) ||
      offGrid(toMeters(o.width, upm), stepMeters)
    ) {
      offending.push(o.id);
    }
  }
  if (offending.length === 0) return [];
  return [
    {
      code: "grid-300mm",
      severity: "error",
      labelKey: "constraint.warning.gridMismatch",
      affectedIds: offending,
      details: { stepMm: stepMeters * 1000, count: offending.length },
    },
  ];
}
