import type { RoomGrade } from "@/lib/insome/floorplan";

export interface MaterialOption {
  readonly id: string;
  readonly labelKey: string;
}

export interface GradeOption {
  readonly id: RoomGrade;
  readonly labelKey: string;
}

export interface ColorSwatch {
  readonly id: string;
  readonly hex: string;
}

export const materialOptions: ReadonlyArray<MaterialOption> = [
  { id: "ceramicTile", labelKey: "material.ceramicTile" },
  { id: "engineeredWood", labelKey: "material.engineeredWood" },
  { id: "concrete", labelKey: "material.concrete" },
  { id: "carpet", labelKey: "material.carpet" },
];

export const gradeOptions: ReadonlyArray<GradeOption> = [
  { id: "standard", labelKey: "grade.standard" },
  { id: "premium", labelKey: "grade.premium" },
  { id: "luxury", labelKey: "grade.luxury" },
];

export const colorSwatches: ReadonlyArray<ColorSwatch> = [
  { id: "fafafa", hex: "#FAFAFA" },
  { id: "e5e5e5", hex: "#E5E5E5" },
  { id: "0a0a0a", hex: "#0A0A0A" },
  { id: "ff4b1f", hex: "#FF4B1F" },
  { id: "d4ff3a", hex: "#D4FF3A" },
];

export const DEFAULT_MATERIAL = materialOptions[0]!.id;
export const DEFAULT_GRADE: RoomGrade = "premium";
export const DEFAULT_COLOR = colorSwatches[0]!.hex;
