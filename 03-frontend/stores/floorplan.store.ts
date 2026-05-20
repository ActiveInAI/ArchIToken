import { create } from "zustand";
import type { FloorplanScheme, RoomGrade } from "@/lib/insome/floorplan";

export interface RoomOverride {
  readonly material?: string;
  readonly grade?: RoomGrade;
  readonly color?: string;
}

interface FloorplanState {
  readonly currentVariantId: string;
  readonly selectedRoomId: string | null;
  readonly selectedRoomLabelKey: string | null;
  readonly scheme: FloorplanScheme;
  readonly canvasMode: "chart" | "render";
  readonly generating: boolean;
  readonly roomOverrides: Record<string, RoomOverride>;
  setVariant: (id: string) => void;
  selectRoom: (id: string, labelKey: string) => void;
  clearSelection: () => void;
  setScheme: (scheme: FloorplanScheme) => void;
  setCanvasMode: (mode: "chart" | "render") => void;
  setGenerating: (on: boolean) => void;
  setRoomOverride: (roomId: string, override: RoomOverride) => void;
  clearOverrides: () => void;
}

export const DEFAULT_VARIANT_ID = "v1";

export const useFloorplanStore = create<FloorplanState>((set) => ({
  currentVariantId: DEFAULT_VARIANT_ID,
  selectedRoomId: null,
  selectedRoomLabelKey: null,
  scheme: "standard",
  canvasMode: "chart",
  generating: false,
  roomOverrides: {},
  setVariant: (id) =>
    set({
      currentVariantId: id,
      selectedRoomId: null,
      selectedRoomLabelKey: null,
    }),
  selectRoom: (id, labelKey) => set({ selectedRoomId: id, selectedRoomLabelKey: labelKey }),
  clearSelection: () => set({ selectedRoomId: null, selectedRoomLabelKey: null }),
  setScheme: (scheme) => set({ scheme }),
  setCanvasMode: (canvasMode) => set({ canvasMode }),
  setGenerating: (generating) => set({ generating }),
  setRoomOverride: (roomId, override) =>
    set((s) => ({
      roomOverrides: {
        ...s.roomOverrides,
        [roomId]: { ...(s.roomOverrides[roomId] ?? {}), ...override },
      },
    })),
  clearOverrides: () => set({ roomOverrides: {} }),
}));
