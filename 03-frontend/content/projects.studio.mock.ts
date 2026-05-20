import type { Project } from "@/lib/insome/types";

/**
 * Phase 4.0: Studio landing defaults to empty state + "新建方案" CTA.
 * Historical mock projects cleared — designers now start each session with
 * AI-assisted creation. TODO(phase-4.1): GET /api/studio/projects once auth lands.
 */
export const mockStudioProjects: ReadonlyArray<Project> = [];
