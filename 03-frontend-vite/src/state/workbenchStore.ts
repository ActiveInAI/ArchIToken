import { create } from "zustand";

export type WorkbenchContext = {
  tenantId: string;
  projectId: string;
  actor: string;
  roles: string;
};

export type DraftCommand = {
  id: string;
  kind: string;
  status: "draft" | "queued" | "executed" | "skipped";
};

type WorkbenchState = {
  context: WorkbenchContext;
  draftCommand: DraftCommand;
  setContextField: (field: keyof WorkbenchContext, value: string) => void;
  setDraftCommand: (command: DraftCommand) => void;
};

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  context: {
    tenantId: "tenant-dev",
    projectId: "project-open-aec",
    actor: "phase7.engineer",
    roles: "engineer,reviewer",
  },
  draftCommand: {
    id: "cmd-draft-001",
    kind: "select_objects",
    status: "draft",
  },
  setContextField: (field, value) =>
    set((state) => ({
      context: {
        ...state.context,
        [field]: value,
      },
    })),
  setDraftCommand: (command) => set({ draftCommand: command }),
}));
