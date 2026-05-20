import type { Floorplan } from "@/lib/insome/floorplan";
import { floorplanRoomBounds } from "@/lib/insome/floorplan";
import type { PriceEstimate, PricingConfig } from "./types";
import { PRICING_COEFFICIENTS } from "./coefficients";

function totalAreaSqm(floorplan: Floorplan): number {
  const upm = floorplan.scale.unitsPerMeter;
  let totalUnitsSq = 0;
  for (const r of floorplan.rooms) {
    const b = floorplanRoomBounds(floorplan, r.id);
    if (!b) continue;
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    totalUnitsSq += w * h;
  }
  return totalUnitsSq / (upm * upm);
}

/** Homeowner-facing simple estimate. Total price only, no component breakdown. */
export function estimatePriceSimple(
  floorplan: Floorplan,
  config: PricingConfig = {},
): PriceEstimate {
  const currency = config.currency ?? "CNY";
  const areaSqm = totalAreaSqm(floorplan);
  const stories = floorplan.stories ?? 1;
  const effectiveArea = areaSqm * stories;
  const structure = Math.round(effectiveArea * PRICING_COEFFICIENTS.structurePerSqm);
  const envelope = Math.round(effectiveArea * PRICING_COEFFICIENTS.envelopePerSqm);
  const interior = Math.round(effectiveArea * PRICING_COEFFICIENTS.interiorPerSqm);
  const total = structure + envelope + interior;
  return {
    breakdown: {
      structure,
      envelope,
      interior,
      total,
      currency,
      confidence: "low",
      disclaimerKey: "pricing.disclaimer.estimate",
    },
    pricePerSqm: effectiveArea > 0 ? Math.round(total / effectiveArea) : 0,
    totalAreaSqm: effectiveArea,
  };
}
