import { nanoid } from "nanoid";
import type {
  CreateFormState,
  Proposal,
  ProposalLabel,
  ResidentialSpec,
} from "@/lib/insome/types";
import type { Floorplan } from "@/lib/insome/floorplan";
import { generateResidentialProposals, summarizeFloorplan } from "@/lib/insome/floorplan";
import { checkAllConstraints } from "@/lib/insome/core";
import type { ProposalGenerator } from "./types";

const LABELS: ReadonlyArray<ProposalLabel> = ["A", "B", "C"];
const THUMBNAILS: ReadonlyArray<string> = [
  "/assets/projects-studio/proposal-a.svg",
  "/assets/projects-studio/proposal-b.svg",
  "/assets/projects-studio/proposal-c.svg",
];
const DIFF_KEYS: ReadonlyArray<string> = [
  "studio.create.proposals.diff.a",
  "studio.create.proposals.diff.b",
  "studio.create.proposals.diff.c",
];

export interface ScriptedProposalGeneratorConfig {
  readonly sleepMs?: number | undefined;
  readonly residentialGenerate?: ((spec: ResidentialSpec) => ReadonlyArray<Floorplan>) | undefined;
  readonly onFloorplansGenerated?: ((plans: ReadonlyArray<Floorplan>) => void) | undefined;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * TODO(phase-4): replace with LLMProposalGenerator. Scripted version keeps
 * determinism (no Math.random) + stays as demo / E2E fallback even after the
 * real generator ships.
 */
export class ScriptedProposalGenerator implements ProposalGenerator {
  private readonly sleepMs: number;
  private readonly residentialGenerate: (spec: ResidentialSpec) => ReadonlyArray<Floorplan>;
  private readonly onFloorplansGenerated?: ((plans: ReadonlyArray<Floorplan>) => void) | undefined;

  constructor(config: ScriptedProposalGeneratorConfig = {}) {
    this.sleepMs = config.sleepMs ?? 2400;
    this.residentialGenerate = config.residentialGenerate ?? generateResidentialProposals;
    this.onFloorplansGenerated = config.onFloorplansGenerated;
  }

  async generate(form: CreateFormState): Promise<ReadonlyArray<Proposal>> {
    const plans = this.residentialGenerate(form.residential);
    // Phase 4.0: prefab constraint post-check. Scripted Provider doesn't retry
    // (deterministic output), but warnings surface in the console so demo
    // runners can see what the real LLM would have to repair.
    // TODO(phase-4.1): LLM Provider retries up to 3× with violation-aware repair.
    for (const plan of plans) {
      const { passed, violations } = checkAllConstraints(plan);
      if (!passed) {
        // eslint-disable-next-line no-console
        console.warn("[insome:constraint] scripted plan violates prefab constraints", {
          planId: plan.id,
          violations,
        });
      }
    }
    await sleep(this.sleepMs);
    this.onFloorplansGenerated?.(plans);

    return plans.map((plan, i) => {
      const summary = summarizeFloorplan(plan);
      const label = LABELS[i] ?? "A";
      return {
        id: nanoid(8),
        label,
        floorplanId: plan.id,
        diffKey: DIFF_KEYS[i] ?? DIFF_KEYS[0]!,
        thumbnail: THUMBNAILS[i] ?? THUMBNAILS[0]!,
        areaSqft: summary.areaSqft,
        roomCount: summary.roomCount,
      };
    });
  }

  reset(): void {
    /* scripted version has no persistent state */
  }
}
