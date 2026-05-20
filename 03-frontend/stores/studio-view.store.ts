import { create } from "zustand";
import type { StudioView } from "@/lib/insome/types";

interface StudioViewState {
  readonly view: StudioView;
  readonly activeProjectId: string | null;
  readonly activeProposalId: string | null;
  goTo: (v: StudioView) => void;
  openExistingProject: (projectId: string) => void;
  openProposal: (proposalId: string) => void;
  startCreate: () => void;
  exitToProjects: () => void;
}

export const useStudioViewStore = create<StudioViewState>((set) => ({
  view: "projects",
  activeProjectId: null,
  activeProposalId: null,
  goTo: (view) => set({ view }),
  openExistingProject: (projectId) =>
    set({ view: "editor", activeProjectId: projectId, activeProposalId: null }),
  openProposal: (proposalId) =>
    set({ view: "editor", activeProjectId: null, activeProposalId: proposalId }),
  startCreate: () =>
    set({ view: "create-step-1", activeProjectId: null, activeProposalId: null }),
  exitToProjects: () =>
    set({ view: "projects", activeProjectId: null, activeProposalId: null }),
}));
