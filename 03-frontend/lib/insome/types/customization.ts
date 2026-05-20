export type AccentChoice = "signal" | "lime";
export type Density = "compact" | "comfortable" | "spacious";

export interface CustomizationState {
  readonly accent: AccentChoice;
  readonly density: Density;
  readonly fontScale: number;
}

export const DEFAULT_CUSTOMIZATION: CustomizationState = {
  accent: "signal",
  density: "comfortable",
  fontScale: 1.0,
};

export const FONT_SCALE_STEPS: ReadonlyArray<number> = [0.875, 1.0, 1.125, 1.25];
