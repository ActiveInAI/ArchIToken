"use client";

import { useMemo } from "react";
import { mockDesignerStats, type DesignerStats } from "./mock-stats";

// TODO(phase-4.1): replace with GET /api/designers/:id/stats (Supabase)
export function useDesignerStats(designerId: string = "u-self"): DesignerStats {
  return useMemo(() => mockDesignerStats(designerId), [designerId]);
}
