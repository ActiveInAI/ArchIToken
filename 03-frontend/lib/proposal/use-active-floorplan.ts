"use client";

import { useMemo } from "react";
import type { Floorplan } from "@/lib/insome/floorplan";
import { useStudioCreateStore } from "@/stores/studio-create.store";
import { useStudioViewStore } from "@/stores/studio-view.store";

/**
 * Resolve the currently active Floorplan for the Studio editor.
 *
 * - If entered from a Proposal → look up that Proposal, find its
 *   `floorplanId`, and return the matching floorplan from the Create wizard's
 *   cached generator output (held in a parallel map or re-derived).
 * - If entered from an existing project → return null for Phase 2 (real
 *   persistence is Phase 4). The editor shows the empty state in this path.
 *
 * The generator's floorplans are stashed on `window.__insomeStudioFloorplans`
 * by the Studio page after generation; this hook reads them back keyed by id.
 *
 * TODO(phase-4): replace this client-side stash with a proper floorplan store.
 */
declare global {
  interface Window {
    __insomeStudioFloorplans?: ReadonlyArray<Floorplan>;
  }
}

export function useActiveFloorplan(): Floorplan | undefined {
  const activeProposalId = useStudioViewStore((s) => s.activeProposalId);
  const proposals = useStudioCreateStore((s) => s.proposals);

  return useMemo(() => {
    if (!activeProposalId) return undefined;
    const proposal = proposals.find((p) => p.id === activeProposalId);
    if (!proposal) return undefined;
    if (typeof window === "undefined") return undefined;
    const plans = window.__insomeStudioFloorplans ?? [];
    return plans.find((fp) => fp.id === proposal.floorplanId);
  }, [activeProposalId, proposals]);
}
