"use client";

import { useEffect } from "react";
import { useCustomizationStore } from "@/stores/customization.store";

/**
 * Apply the persisted customization state to <html> on the client.
 *
 * Why a separate component:
 * - zustand/persist is created with `skipHydration: true` to avoid SSR
 *   `localStorage` access + hydration mismatch flashes.
 * - This component calls `rehydrate()` once after mount, then mirrors the
 *   latest values to `document.documentElement` data-attributes / inline
 *   font-size so the rest of the app's CSS tokens pick them up.
 */
export function CustomizationApplier() {
  const accent = useCustomizationStore((s) => s.accent);
  const density = useCustomizationStore((s) => s.density);
  const fontScale = useCustomizationStore((s) => s.fontScale);

  useEffect(() => {
    useCustomizationStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accent;
    root.dataset.density = density;
    root.style.fontSize = `${16 * fontScale}px`;
  }, [accent, density, fontScale]);

  return null;
}
