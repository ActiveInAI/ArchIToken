export type StudioView =
  | "projects"
  | "create-step-1"
  | "create-step-2"
  | "create-generating"
  | "create-proposals"
  | "editor";

export type CreateEntry = "ai" | "scratch" | "upload";

export type CreateStep2Mode = "residential" | "prompt";

export interface ResidentialSpec {
  readonly widthFt: number;
  readonly lengthFt: number;
  readonly stories: 1 | 2 | 3;
  readonly style: string;
  readonly bedrooms: number;
  readonly bathrooms: number;
}

export interface CreatePrompt {
  readonly text: string;
}

export interface CreateFormState {
  readonly entry: CreateEntry | null;
  readonly step2Mode: CreateStep2Mode;
  readonly residential: ResidentialSpec;
  readonly prompt: CreatePrompt;
}

export type ProposalLabel = "A" | "B" | "C";

export interface Proposal {
  readonly id: string;
  readonly label: ProposalLabel;
  readonly floorplanId: string;
  readonly diffKey: string;
  readonly thumbnail: string;
  readonly areaSqft: number;
  readonly roomCount: number;
}
