import { create } from "zustand";
import type {
  CreateEntry,
  CreateFormState,
  CreateStep2Mode,
  Proposal,
  ResidentialSpec,
} from "@/lib/insome/types";

const DEFAULT_RESIDENTIAL: ResidentialSpec = {
  widthFt: 30,
  lengthFt: 40,
  stories: 1,
  style: "modern",
  bedrooms: 3,
  bathrooms: 2,
};

const DEFAULT_FORM: CreateFormState = {
  entry: null,
  step2Mode: "residential",
  residential: DEFAULT_RESIDENTIAL,
  prompt: {
    text: "Single-family, 3BR 2BA, open-plan kitchen, master suite with walk-in closet.",
  },
};

interface StudioCreateState {
  readonly form: CreateFormState;
  readonly proposals: ReadonlyArray<Proposal>;
  readonly generating: boolean;
  setEntry: (e: CreateEntry) => void;
  setStep2Mode: (m: CreateStep2Mode) => void;
  updateResidential: (patch: Partial<ResidentialSpec>) => void;
  updatePrompt: (text: string) => void;
  setGenerating: (b: boolean) => void;
  setProposals: (p: ReadonlyArray<Proposal>) => void;
  resetWizard: () => void;
}

export const useStudioCreateStore = create<StudioCreateState>((set) => ({
  form: DEFAULT_FORM,
  proposals: [],
  generating: false,
  setEntry: (entry) => set((s) => ({ form: { ...s.form, entry } })),
  setStep2Mode: (step2Mode) => set((s) => ({ form: { ...s.form, step2Mode } })),
  updateResidential: (patch) =>
    set((s) => ({
      form: { ...s.form, residential: { ...s.form.residential, ...patch } },
    })),
  updatePrompt: (text) => set((s) => ({ form: { ...s.form, prompt: { text } } })),
  setGenerating: (generating) => set({ generating }),
  setProposals: (proposals) => set({ proposals }),
  resetWizard: () => set({ form: DEFAULT_FORM, proposals: [], generating: false }),
}));
