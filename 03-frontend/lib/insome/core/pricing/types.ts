export type Currency = "CNY" | "USD";

export interface PriceBreakdown {
  readonly structure: number;
  readonly envelope: number;
  readonly interior: number;
  readonly total: number;
  readonly currency: Currency;
  readonly confidence: "low" | "medium";
  readonly disclaimerKey: string;
}

export interface PriceEstimate {
  readonly breakdown: PriceBreakdown;
  readonly pricePerSqm: number;
  readonly totalAreaSqm: number;
}

export interface StructureBreakdownDetail {
  readonly columns: number;
  readonly beams: number;
  readonly joints: number;
  readonly cost: number;
}
export interface EnvelopeBreakdownDetail {
  readonly wallPanels: number;
  readonly doors: number;
  readonly windows: number;
  readonly cost: number;
}
export interface InteriorBreakdownDetail {
  readonly flooringM2: number;
  readonly ceilingM2: number;
  readonly cost: number;
}

export interface PriceEstimateDetailed extends PriceEstimate {
  readonly structureBreakdown: StructureBreakdownDetail;
  readonly envelopeBreakdown: EnvelopeBreakdownDetail;
  readonly interiorBreakdown: InteriorBreakdownDetail;
}

export interface PricingConfig {
  readonly currency?: Currency;
}
