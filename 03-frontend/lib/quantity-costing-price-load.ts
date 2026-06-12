import {
  roundMoney,
  roundQuantity,
  type CostingStandardRegistry,
} from "./quantity-costing";
import type { PriceQuoteRow } from "./quantity-costing-registry-import";

export type CostPriceLoadMatchType = "id" | "name" | "unmatched";

export interface CostPriceLoadPlanRow {
  rowId: string;
  resourceId: string | null;
  resourceName: string;
  unit: string;
  currentPrice: number | null;
  newPrice: number;
  priceDelta: number | null;
  deltaRatio: number | null;
  matchType: CostPriceLoadMatchType;
  sourceRef: string;
  selected: boolean;
}

export interface CostPriceLoadPlan {
  rows: CostPriceLoadPlanRow[];
  idMatchedCount: number;
  nameMatchedCount: number;
  unmatchedCount: number;
}

export interface CostPriceLoadApplication {
  registry: CostingStandardRegistry;
  appliedCount: number;
  skippedCount: number;
}

export function createPriceLoadPlan(
  registry: CostingStandardRegistry,
  quotes: PriceQuoteRow[],
): CostPriceLoadPlan {
  const rows = quotes.map((quote, index): CostPriceLoadPlanRow => {
    const byId =
      quote.resourceId !== ""
        ? registry.priceResources.find(
            (resource) => resource.resourceId === quote.resourceId,
          )
        : undefined;
    const byName =
      !byId && quote.name !== ""
        ? registry.priceResources.find(
            (resource) => resource.name.trim() === quote.name.trim(),
          )
        : undefined;
    const matched = byId ?? byName;
    const matchType: CostPriceLoadMatchType = byId
      ? "id"
      : byName
        ? "name"
        : "unmatched";
    const currentPrice = matched ? roundMoney(matched.unitPrice) : null;
    const newPrice = roundMoney(quote.unitPrice);
    const priceDelta =
      currentPrice !== null ? roundMoney(newPrice - currentPrice) : null;
    return {
      rowId: `price-load-${index + 1}`,
      resourceId: matched?.resourceId ?? (quote.resourceId || null),
      resourceName: matched?.name ?? quote.name ?? quote.resourceId,
      unit: matched?.unit ?? "",
      currentPrice,
      newPrice,
      priceDelta,
      deltaRatio:
        currentPrice !== null && currentPrice !== 0 && priceDelta !== null
          ? roundQuantity(priceDelta / currentPrice)
          : null,
      matchType,
      sourceRef: quote.sourceRef,
      selected: matchType !== "unmatched",
    };
  });

  return {
    rows,
    idMatchedCount: rows.filter((row) => row.matchType === "id").length,
    nameMatchedCount: rows.filter((row) => row.matchType === "name").length,
    unmatchedCount: rows.filter((row) => row.matchType === "unmatched").length,
  };
}

export function applyPriceLoadPlan(
  registry: CostingStandardRegistry,
  plan: CostPriceLoadPlan,
): CostPriceLoadApplication {
  const updates = new Map(
    plan.rows
      .filter(
        (row) =>
          row.selected && row.matchType !== "unmatched" && row.resourceId,
      )
      .map((row) => [row.resourceId as string, row]),
  );
  let appliedCount = 0;
  const priceResources = registry.priceResources.map((resource) => {
    const update = updates.get(resource.resourceId);
    if (!update) {
      return resource;
    }
    appliedCount += 1;
    return {
      ...resource,
      unitPrice: update.newPrice,
      sourceRef: update.sourceRef || resource.sourceRef,
      sourceVerified: update.sourceRef !== "" ? true : resource.sourceVerified,
    };
  });
  const updatedResourceIds = new Set(updates.keys());
  const quotaItems = registry.quotaItems.map((item) => ({
    ...item,
    resourceConsumptions: item.resourceConsumptions.map((consumption) =>
      updatedResourceIds.has(consumption.resourceId)
        ? { ...consumption }
        : consumption,
    ),
  }));
  return {
    registry: { ...registry, priceResources, quotaItems },
    appliedCount,
    skippedCount: plan.rows.length - appliedCount,
  };
}

export function buildPriceUpdatePayload(
  plan: CostPriceLoadPlan,
): Array<{
  resourceId: string;
  unitPrice: number;
  sourceRef: string;
  sourceVerified: boolean;
}> {
  return plan.rows
    .filter(
      (row) => row.selected && row.matchType !== "unmatched" && row.resourceId,
    )
    .map((row) => ({
      resourceId: row.resourceId as string,
      unitPrice: row.newPrice,
      sourceRef: row.sourceRef,
      sourceVerified: row.sourceRef !== "",
    }));
}
