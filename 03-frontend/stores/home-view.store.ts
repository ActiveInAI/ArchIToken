import { create } from "zustand";

export type HomeView = "dashboard" | "workspace";

interface HomeViewState {
  readonly view: HomeView;
  readonly activeProjectId: string | null;
  readonly activeTemplateId: string | null;
  setView: (view: HomeView) => void;
  openProject: (projectId: string) => void;
  openTemplate: (templateId: string) => void;
  createNewProject: () => void;
  goDashboard: () => void;
}

export const useHomeViewStore = create<HomeViewState>((set) => ({
  view: "dashboard",
  activeProjectId: null,
  activeTemplateId: null,
  setView: (view) => set({ view }),
  openProject: (projectId) => set({ view: "workspace", activeProjectId: projectId, activeTemplateId: null }),
  openTemplate: (templateId) => set({ view: "workspace", activeProjectId: null, activeTemplateId: templateId }),
  createNewProject: () => set({ view: "workspace", activeProjectId: null, activeTemplateId: null }),
  goDashboard: () => set({ view: "dashboard", activeProjectId: null, activeTemplateId: null }),
}));
