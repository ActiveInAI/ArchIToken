export interface StyleOption {
  readonly id: string;
  readonly labelKey: string;
}

export const STYLES: ReadonlyArray<StyleOption> = [
  { id: "modern", labelKey: "studio.create.step2.styles.modern" },
  { id: "scandinavian", labelKey: "studio.create.step2.styles.scandinavian" },
  { id: "craftsman", labelKey: "studio.create.step2.styles.craftsman" },
  { id: "mediterranean", labelKey: "studio.create.step2.styles.mediterranean" },
];

export const STORIES_OPTIONS: ReadonlyArray<1 | 2 | 3> = [1, 2, 3];

export const MIN_WIDTH_FT = 16;
export const MAX_WIDTH_FT = 120;
export const MIN_LENGTH_FT = 20;
export const MAX_LENGTH_FT = 160;
export const MIN_BEDROOMS = 0;
export const MAX_BEDROOMS = 8;
export const MIN_BATHROOMS = 1;
export const MAX_BATHROOMS = 6;
