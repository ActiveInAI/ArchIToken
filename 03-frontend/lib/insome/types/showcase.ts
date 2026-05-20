export type ProductLine = "home" | "studio";

export type ShowcaseAspect = "16/10" | "4/3" | "3/2";

export interface ShowcaseScreen {
  readonly id: string;
  readonly titleKey: string;
  readonly captionKey: string;
  readonly svgPath: string;
  readonly aspect: ShowcaseAspect;
}

export interface ShowcaseRailConfig {
  readonly productLine: ProductLine;
  readonly eyebrowKey: string;
  readonly titleKey: string;
  readonly pillLabelKey: string;
  readonly screens: ReadonlyArray<ShowcaseScreen>;
}

export type ProductCardTheme = "light" | "dark";

export interface ProductCardConfig {
  readonly id: ProductLine;
  readonly theme: ProductCardTheme;
  readonly href: string;
  readonly numberKey: string;
  readonly audienceKey: string;
  readonly titlePrefixKey: string;
  readonly titleSuffixKey: string;
  readonly descriptionKey: string;
  readonly featureKeys: ReadonlyArray<string>;
  readonly ctaKey: string;
  readonly miniSvgPath: string;
}
