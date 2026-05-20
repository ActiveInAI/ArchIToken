import type { DesignerLevel } from "@/content/designer-levels";

export interface DesignerStats {
  readonly designerId: string;
  readonly level: DesignerLevel;
  readonly isVerified: boolean;
  readonly points: number;
  readonly nextLevelThreshold: number | null;
  readonly accumulatedRebate: number;
  readonly rebatePercent: number;
  readonly publishedWorks: number;
  readonly adoptedCount: number;
  readonly thisOrderRebateMin: number;
  readonly thisOrderRebateMax: number;
}

const FIXTURES: Record<string, DesignerStats> = {
  "u-self": {
    designerId: "u-self",
    level: 3,
    isVerified: true,
    points: 2400,
    nextLevelThreshold: 3000,
    accumulatedRebate: 18_400,
    rebatePercent: 8,
    publishedWorks: 12,
    adoptedCount: 45,
    thisOrderRebateMin: 3200,
    thisOrderRebateMax: 5800,
  },
};

export function mockDesignerStats(designerId: string): DesignerStats {
  return FIXTURES[designerId] ?? FIXTURES["u-self"]!;
}
