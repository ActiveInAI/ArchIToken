import { create } from "zustand";

export const DEFAULT_CHAT_PCT = 22;
export const DEFAULT_CANVAS_PCT = 58;
export const DEFAULT_PROPERTIES_PCT = 20;

interface WorkspaceLayoutState {
  readonly chatPct: number;
  readonly canvasPct: number;
  readonly propertiesPct: number;
  resetDefaults: () => void;
  setPanelSizes: (sizes: { chatPct: number; canvasPct: number; propertiesPct: number }) => void;
}

/**
 * Persistence is delegated to react-resizable-panels via autoSaveId="insome-home-workspace";
 * this store keeps the current runtime values only so other UI (e.g., keyboard reset handler)
 * can read/write them programmatically without coupling to the panel lib internals.
 */
export const useWorkspaceLayoutStore = create<WorkspaceLayoutState>((set) => ({
  chatPct: DEFAULT_CHAT_PCT,
  canvasPct: DEFAULT_CANVAS_PCT,
  propertiesPct: DEFAULT_PROPERTIES_PCT,
  resetDefaults: () =>
    set({
      chatPct: DEFAULT_CHAT_PCT,
      canvasPct: DEFAULT_CANVAS_PCT,
      propertiesPct: DEFAULT_PROPERTIES_PCT,
    }),
  setPanelSizes: ({ chatPct, canvasPct, propertiesPct }) => set({ chatPct, canvasPct, propertiesPct }),
}));
