import type { FloorplanScheme } from "@/lib/insome/floorplan";

export interface AppearanceSchemeDef {
  readonly id: FloorplanScheme | "gradient";
  readonly labelKey: string;
  readonly swatch: ReadonlyArray<string>;
}

export const APPEARANCE_SCHEMES: ReadonlyArray<AppearanceSchemeDef> = [
  {
    id: "standard",
    labelKey: "studio.appearance.scheme.standard",
    swatch: ["#0A0A0A", "#D4FF3A", "#FAFAFA"],
  },
  {
    id: "pastel",
    labelKey: "studio.appearance.scheme.pastel",
    swatch: ["#F5E4D3", "#FFD4B0", "#0A0A0A"],
  },
  {
    id: "contrast",
    labelKey: "studio.appearance.scheme.contrast",
    swatch: ["#FFB800", "#FF4B1F", "#0A0A0A"],
  },
  {
    id: "gradient",
    labelKey: "studio.appearance.scheme.gradient",
    swatch: ["#D4FF3A", "#3A9BFF", "#FF4B1F"],
  },
];
