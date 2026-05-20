export type DesignerLevel = 1 | 2 | 3 | 4;

export interface DesignerLevelMeta {
  readonly lv: DesignerLevel;
  readonly nameKey: string;
  readonly threshold: number;
  readonly rebatePct: number;
  readonly streamWeight: number;
}

export const DESIGNER_LEVELS: ReadonlyArray<DesignerLevelMeta> = [
  { lv: 1, nameKey: "workspace.studio.level.lv1", threshold: 0,    rebatePct: 3,  streamWeight: 1.0 },
  { lv: 2, nameKey: "workspace.studio.level.lv2", threshold: 100,  rebatePct: 5,  streamWeight: 1.5 },
  { lv: 3, nameKey: "workspace.studio.level.lv3", threshold: 500,  rebatePct: 8,  streamWeight: 2.5 },
  { lv: 4, nameKey: "workspace.studio.level.lv4", threshold: 3000, rebatePct: 12, streamWeight: 4.0 },
];

export function getLevelMeta(lv: DesignerLevel): DesignerLevelMeta {
  return DESIGNER_LEVELS[lv - 1]!;
}

export function getNextLevelMeta(lv: DesignerLevel): DesignerLevelMeta | null {
  if (lv === 4) return null;
  return DESIGNER_LEVELS[lv]!;
}
