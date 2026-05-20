"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { MockLeadProvider, type LeadProvider } from "@/lib/insome/core";

const LeadProviderContext = createContext<LeadProvider | null>(null);

export function LeadProviderScope({ children }: { children: ReactNode }) {
  const provider = useMemo<LeadProvider>(() => new MockLeadProvider(), []);
  return <LeadProviderContext.Provider value={provider}>{children}</LeadProviderContext.Provider>;
}

export function useLeadProvider(): LeadProvider {
  const ctx = useContext(LeadProviderContext);
  if (!ctx) throw new Error("useLeadProvider must be used inside <LeadProviderScope>");
  return ctx;
}
