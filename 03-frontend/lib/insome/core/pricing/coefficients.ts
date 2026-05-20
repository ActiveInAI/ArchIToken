/**
 * Demo pricing coefficients. Hardcoded for Phase 4.0.
 * TODO(phase-4.1): replace with live component library prices via API.
 */
export const PRICING_COEFFICIENTS = {
  structurePerSqm: 800,  // CNY/m² — columns + beams + joints prorated
  envelopePerSqm: 1200,  // CNY/m² — wall panels + openings
  interiorPerSqm: 1500,  // CNY/m² — basic interior finish
} as const;
