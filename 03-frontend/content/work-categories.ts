export type WorkCategory = "all" | "architecture" | "interior";

export const WORK_CATEGORIES: ReadonlyArray<WorkCategory> = ["all", "architecture", "interior"];

export type WorkStyleFilter =
  | "all"
  | "modern"
  | "minimalist"
  | "classic"
  | "scandinavian"
  | "industrial";

export const WORK_STYLE_FILTERS: ReadonlyArray<WorkStyleFilter> = [
  "all",
  "modern",
  "minimalist",
  "classic",
  "scandinavian",
  "industrial",
];

export type WorkBedroomsFilter = "all" | "1" | "2" | "3" | "4+";

export const WORK_BEDROOMS_FILTERS: ReadonlyArray<WorkBedroomsFilter> = [
  "all",
  "1",
  "2",
  "3",
  "4+",
];

export type WorkPriceFilter = "all" | "lt-50" | "50-150" | "150-300" | "gt-300";

export const WORK_PRICE_FILTERS: ReadonlyArray<WorkPriceFilter> = [
  "all",
  "lt-50",
  "50-150",
  "150-300",
  "gt-300",
];

export type WorkLevelFilter = "all" | "1" | "2" | "3" | "4";

export const WORK_LEVEL_FILTERS: ReadonlyArray<WorkLevelFilter> = ["all", "1", "2", "3", "4"];
