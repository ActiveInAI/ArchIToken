import type { Opening } from "@/lib/insome/floorplan";

export const UNIT_DEFAULTS_M = {
  wallHeight: 2.7,
  floorThickness: 0.1,
  doorHeight: 2.1,
  windowHeight: 1.5,
  openingHeight: 2.1,
  windowSill: 0.9,
};

export const UNIT_DEFAULTS_FT = {
  wallHeight: 9,
  floorThickness: 4 / 12,
  doorHeight: 7,
  windowHeight: 4,
  openingHeight: 7,
  windowSill: 3,
};

export type UnitDefaults = typeof UNIT_DEFAULTS_M;

/** Convert a default in meters/feet to floorplan units (both m and ft floorplans use unitsPerMeter). */
export function resolveOpeningHeight(
  o: Opening,
  d: UnitDefaults,
  unitsPerMeter: number,
): number {
  if (o.height !== undefined) return o.height;
  const k = o.type === "door" ? d.doorHeight
    : o.type === "window" ? d.windowHeight
    : d.openingHeight;
  return k * unitsPerMeter;
}

export function resolveOpeningSill(
  o: Opening,
  d: UnitDefaults,
  unitsPerMeter: number,
): number {
  if (o.sillHeight !== undefined) return o.sillHeight;
  if (o.type !== "window") return 0;
  return d.windowSill * unitsPerMeter;
}
