import type { ProductCardConfig, ShowcaseRailConfig } from "@/lib/insome/types";
import { homeShowcaseScreens } from "./showcase.home";
import { studioShowcaseScreens } from "./showcase.studio";

// TODO(phase-4): decorate cards with live project counts / last-activity from /api/projects once the backend is wired
export const productCards: ReadonlyArray<ProductCardConfig> = [
  {
    id: "home",
    theme: "light",
    href: "/home",
    numberKey: "number",
    audienceKey: "audience",
    titlePrefixKey: "titlePrefix",
    titleSuffixKey: "titleSuffix",
    descriptionKey: "description",
    featureKeys: ["feature1", "feature2", "feature3", "feature4"],
    ctaKey: "cta",
    miniSvgPath: "/assets/showcase/mini-home.svg",
  },
  {
    id: "studio",
    theme: "dark",
    href: "/studio",
    numberKey: "number",
    audienceKey: "audience",
    titlePrefixKey: "titlePrefix",
    titleSuffixKey: "titleSuffix",
    descriptionKey: "description",
    featureKeys: ["feature1", "feature2", "feature3", "feature4"],
    ctaKey: "cta",
    miniSvgPath: "/assets/showcase/mini-studio.svg",
  },
];

export const showcaseRails: ReadonlyArray<ShowcaseRailConfig> = [
  {
    productLine: "home",
    eyebrowKey: "homeEyebrow",
    titleKey: "homeTitle",
    pillLabelKey: "pillHome",
    screens: homeShowcaseScreens,
  },
  {
    productLine: "studio",
    eyebrowKey: "studioEyebrow",
    titleKey: "studioTitle",
    pillLabelKey: "pillStudio",
    screens: studioShowcaseScreens,
  },
];
