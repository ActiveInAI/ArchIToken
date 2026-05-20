import { create } from "zustand";

export interface HeroPartInfo {
  readonly id: string;
  readonly name: string;
  readonly uuid: string;
  readonly size: readonly [number, number, number];
  readonly triangles: number;
  readonly vertices: number;
}

interface HeroModelState {
  readonly hoveredId: string | null;
  readonly selectedId: string | null;
  readonly selectedInfo: HeroPartInfo | null;
  setHovered: (id: string | null) => void;
  setSelected: (info: HeroPartInfo | null) => void;
  clear: () => void;
}

export const useHeroModelStore = create<HeroModelState>((set) => ({
  hoveredId: null,
  selectedId: null,
  selectedInfo: null,
  setHovered: (id) => set({ hoveredId: id }),
  setSelected: (info) =>
    set({ selectedId: info?.id ?? null, selectedInfo: info }),
  clear: () => set({ hoveredId: null, selectedId: null, selectedInfo: null }),
}));
