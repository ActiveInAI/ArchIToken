export interface LabeledOption {
  readonly id: string;
  readonly labelKey: string;
}

export const FLOOR_FINISHES: ReadonlyArray<LabeledOption> = [
  { id: "oak-hardwood", labelKey: "studio.properties.floors.oakHardwood" },
  { id: "concrete", labelKey: "studio.properties.floors.concrete" },
  { id: "ceramic-tile", labelKey: "studio.properties.floors.ceramicTile" },
  { id: "marble", labelKey: "studio.properties.floors.marble" },
  { id: "carpet", labelKey: "studio.properties.floors.carpet" },
];

export const WALL_FINISHES: ReadonlyArray<LabeledOption> = [
  { id: "eggshell-white", labelKey: "studio.properties.walls.eggshellWhite" },
  { id: "matte-gray", labelKey: "studio.properties.walls.matteGray" },
  { id: "wood-panel", labelKey: "studio.properties.walls.woodPanel" },
  { id: "exposed-concrete", labelKey: "studio.properties.walls.exposedConcrete" },
];

export const LIGHT_FIXTURES: ReadonlyArray<LabeledOption> = [
  { id: "none", labelKey: "studio.properties.lights.none" },
  { id: "recessed-std", labelKey: "studio.properties.lights.recessedStandard" },
  { id: "recessed-premium", labelKey: "studio.properties.lights.recessedPremium" },
  { id: "track", labelKey: "studio.properties.lights.track" },
  { id: "chandelier", labelKey: "studio.properties.lights.chandelier" },
];
