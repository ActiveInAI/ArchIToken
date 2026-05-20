import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AccentChoice, CustomizationState, Density } from "@/lib/insome/types";
import { DEFAULT_CUSTOMIZATION } from "@/lib/insome/types";

interface CustomizationStore extends CustomizationState {
  setAccent: (a: AccentChoice) => void;
  setDensity: (d: Density) => void;
  setFontScale: (s: number) => void;
  reset: () => void;
}

/**
 * Global application-level theme / density / font scale.
 * - Lives at the app root, NOT inside the Studio tree (Home also consumes it)
 * - Persisted to localStorage via zustand/middleware
 * - skipHydration + manual rehydrate-on-mount avoids SSR flash mismatch
 *   (see components/customization-applier.tsx)
 */
export const useCustomizationStore = create<CustomizationStore>()(
  persist(
    (set) => ({
      ...DEFAULT_CUSTOMIZATION,
      setAccent: (accent) => set({ accent }),
      setDensity: (density) => set({ density }),
      setFontScale: (fontScale) => set({ fontScale }),
      reset: () => set(DEFAULT_CUSTOMIZATION),
    }),
    {
      name: "insome-customization-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
