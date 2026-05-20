import type { Floorplan } from "@/lib/insome/floorplan";
import { homeFloorplanVariants } from "./floorplan-variants.home";

export type TemplateStyle = "modern" | "minimalist" | "classic" | "scandinavian";
export type TemplateHouseType = "1-bedroom" | "2-bedroom" | "3-bedroom" | "villa" | "loft";

export interface TemplateMeta {
  readonly id: string;
  readonly nameKey: string;
  readonly descriptionKey: string;
  readonly styleKey: TemplateStyle;
  readonly houseType: TemplateHouseType;
  readonly coverAccent: "warm" | "cool" | "neutral";
  readonly totalAreaSqm: number;
  readonly stories: number;
  readonly bedrooms: number;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly floorplan?: Floorplan | undefined;
}

/**
 * Phase 4.0 demo mock — 12 prefab templates. The first 3 are wired to real
 * Home variants (v1 / v2 / v3) so the "AI 修改一下" flow jumps into a real
 * editable floorplan. The remaining 9 are display-only cards.
 * TODO(phase-4.1): replace with GET /api/templates real data.
 */
export const mockTemplates: ReadonlyArray<TemplateMeta> = [
  {
    id: "t-modern-120",
    nameKey: "home.template.items.modern120.name",
    descriptionKey: "home.template.items.modern120.description",
    styleKey: "modern",
    houseType: "3-bedroom",
    coverAccent: "warm",
    totalAreaSqm: 120,
    stories: 1,
    bedrooms: 3,
    priceMin: 420_000,
    priceMax: 560_000,
    floorplan: homeFloorplanVariants[0],
  },
  {
    id: "t-minimalist-110",
    nameKey: "home.template.items.minimalist110.name",
    descriptionKey: "home.template.items.minimalist110.description",
    styleKey: "minimalist",
    houseType: "3-bedroom",
    coverAccent: "cool",
    totalAreaSqm: 110,
    stories: 1,
    bedrooms: 3,
    priceMin: 380_000,
    priceMax: 520_000,
    floorplan: homeFloorplanVariants[1],
  },
  {
    id: "t-loft-135",
    nameKey: "home.template.items.loft135.name",
    descriptionKey: "home.template.items.loft135.description",
    styleKey: "scandinavian",
    houseType: "loft",
    coverAccent: "neutral",
    totalAreaSqm: 135,
    stories: 2,
    bedrooms: 2,
    priceMin: 510_000,
    priceMax: 680_000,
    floorplan: homeFloorplanVariants[2],
  },
  { id: "t-villa-220", nameKey: "home.template.items.villa220.name", descriptionKey: "home.template.items.villa220.description", styleKey: "classic", houseType: "villa", coverAccent: "warm", totalAreaSqm: 220, stories: 2, bedrooms: 4, priceMin: 920_000, priceMax: 1_200_000 },
  { id: "t-cottage-80", nameKey: "home.template.items.cottage80.name", descriptionKey: "home.template.items.cottage80.description", styleKey: "scandinavian", houseType: "1-bedroom", coverAccent: "neutral", totalAreaSqm: 80, stories: 1, bedrooms: 1, priceMin: 280_000, priceMax: 340_000 },
  { id: "t-modern-95", nameKey: "home.template.items.modern95.name", descriptionKey: "home.template.items.modern95.description", styleKey: "modern", houseType: "2-bedroom", coverAccent: "cool", totalAreaSqm: 95, stories: 1, bedrooms: 2, priceMin: 320_000, priceMax: 430_000 },
  { id: "t-classic-180", nameKey: "home.template.items.classic180.name", descriptionKey: "home.template.items.classic180.description", styleKey: "classic", houseType: "villa", coverAccent: "warm", totalAreaSqm: 180, stories: 2, bedrooms: 3, priceMin: 720_000, priceMax: 920_000 },
  { id: "t-minimalist-75", nameKey: "home.template.items.minimalist75.name", descriptionKey: "home.template.items.minimalist75.description", styleKey: "minimalist", houseType: "2-bedroom", coverAccent: "neutral", totalAreaSqm: 75, stories: 1, bedrooms: 2, priceMin: 260_000, priceMax: 320_000 },
  { id: "t-scandi-130", nameKey: "home.template.items.scandi130.name", descriptionKey: "home.template.items.scandi130.description", styleKey: "scandinavian", houseType: "3-bedroom", coverAccent: "cool", totalAreaSqm: 130, stories: 1, bedrooms: 3, priceMin: 440_000, priceMax: 580_000 },
  { id: "t-modern-200", nameKey: "home.template.items.modern200.name", descriptionKey: "home.template.items.modern200.description", styleKey: "modern", houseType: "villa", coverAccent: "warm", totalAreaSqm: 200, stories: 2, bedrooms: 4, priceMin: 820_000, priceMax: 1_050_000 },
  { id: "t-loft-100", nameKey: "home.template.items.loft100.name", descriptionKey: "home.template.items.loft100.description", styleKey: "scandinavian", houseType: "loft", coverAccent: "neutral", totalAreaSqm: 100, stories: 2, bedrooms: 1, priceMin: 360_000, priceMax: 480_000 },
  { id: "t-classic-250", nameKey: "home.template.items.classic250.name", descriptionKey: "home.template.items.classic250.description", styleKey: "classic", houseType: "villa", coverAccent: "warm", totalAreaSqm: 250, stories: 3, bedrooms: 5, priceMin: 1_080_000, priceMax: 1_380_000 },
];

export function getTemplateById(id: string): TemplateMeta | undefined {
  return mockTemplates.find((t) => t.id === id);
}
