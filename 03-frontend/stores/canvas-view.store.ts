import { create } from "zustand";
import { DEFAULT_VIEW_STATE, type CanvasViewState } from "@/lib/insome/canvas";
import { defaultCameraState, type CameraState } from "@/lib/insome/scene";

interface CanvasViewStoreState {
  readonly chartView: CanvasViewState;
  readonly renderView: CanvasViewState;
  readonly homeRenderCamera: CameraState;
  readonly studio3dCamera: CameraState;
  setChartView: (v: CanvasViewState) => void;
  setRenderView: (v: CanvasViewState) => void;
  setHomeRenderCamera: (c: CameraState) => void;
  setStudio3dCamera: (c: CameraState) => void;
  resetHomeCamera: () => void;
  resetStudio3dCamera: () => void;
  resetAll: () => void;
}

/**
 * Pan/zoom state per 2D Canvas tab + camera state per 3D view.
 * Not persisted to localStorage — resets on project switch.
 */
export const useCanvasViewStore = create<CanvasViewStoreState>((set) => ({
  chartView: DEFAULT_VIEW_STATE,
  renderView: DEFAULT_VIEW_STATE,
  homeRenderCamera: defaultCameraState(),
  studio3dCamera: defaultCameraState(),
  setChartView: (v) => set({ chartView: v }),
  setRenderView: (v) => set({ renderView: v }),
  setHomeRenderCamera: (c) => set({ homeRenderCamera: c }),
  setStudio3dCamera: (c) => set({ studio3dCamera: c }),
  resetHomeCamera: () => set({ homeRenderCamera: defaultCameraState() }),
  resetStudio3dCamera: () => set({ studio3dCamera: defaultCameraState() }),
  resetAll: () =>
    set({
      chartView: DEFAULT_VIEW_STATE,
      renderView: DEFAULT_VIEW_STATE,
      homeRenderCamera: defaultCameraState(),
      studio3dCamera: defaultCameraState(),
    }),
}));
