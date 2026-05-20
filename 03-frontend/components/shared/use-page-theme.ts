"use client";

import { useEffect } from "react";

type PageTheme = "light" | "dark";

export function usePageTheme(theme: PageTheme): void {
  useEffect(() => {
    document.documentElement.dataset.insomeTheme = theme;
    return () => {
      delete document.documentElement.dataset.insomeTheme;
    };
  }, [theme]);
}
