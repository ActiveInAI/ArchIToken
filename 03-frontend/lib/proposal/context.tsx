"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ProposalGenerator } from "./types";

const ProposalGeneratorContext = createContext<ProposalGenerator | null>(null);

export interface ProposalGeneratorScopeProps {
  readonly value: ProposalGenerator;
  readonly children: ReactNode;
}

export function ProposalGeneratorScope({ value, children }: ProposalGeneratorScopeProps) {
  return (
    <ProposalGeneratorContext.Provider value={value}>{children}</ProposalGeneratorContext.Provider>
  );
}

export function useProposalGenerator(): ProposalGenerator {
  const gen = useContext(ProposalGeneratorContext);
  if (!gen) {
    throw new Error("useProposalGenerator must be used within <ProposalGeneratorScope>");
  }
  return gen;
}
