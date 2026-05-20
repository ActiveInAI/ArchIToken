"use client";

import { usePageTheme } from "./use-page-theme";

interface PageThemeMountProps {
  readonly theme: "dark" | "light";
}

export function PageThemeMount({ theme }: PageThemeMountProps) {
  usePageTheme(theme);
  return null;
}
