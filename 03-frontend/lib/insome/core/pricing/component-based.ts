import type { Floorplan } from "@/lib/insome/floorplan";
import { estimatePriceSimple } from "./area-based";
import type { PriceEstimateDetailed, PricingConfig } from "./types";

/**
 * Designer-facing detailed estimate. Still area-driven (no real BOM), but
 * decomposes component counts for the BOM-ish panel in Studio.
 * TODO(phase-4.1): derive counts from real component library SKU mapping.
 */
export function estimatePriceDetailed(
  floorplan: Floorplan,
  config: PricingConfig = {},
): PriceEstimateDetailed {
  const simple = estimatePriceSimple(floorplan, config);
  const area = simple.totalAreaSqm;
  const wallCount = floorplan.walls.length;
  const doorCount = floorplan.openings.filter((o) => o.type === "door").length;
  const windowCount = floorplan.openings.filter((o) => o.type === "window").length;
  const columns = Math.max(4, Math.round(wallCount * 0.4));
  const beams = Math.max(6, Math.round(wallCount * 0.6));
  const joints = columns;
  return {
    ...simple,
    structureBreakdown: {
      columns,
      beams,
      joints,
      cost: simple.breakdown.structure,
    },
    envelopeBreakdown: {
      wallPanels: wallCount,
      doors: doorCount,
      windows: windowCount,
      cost: simple.breakdown.envelope,
    },
    interiorBreakdown: {
      flooringM2: area,
      ceilingM2: area,
      cost: simple.breakdown.interior,
    },
  };
}
