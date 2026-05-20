import { polygonBounds } from "@/lib/insome/geom";
import { roomPolygon } from "../geometry";
import type { Floorplan, Opening, Room, Wall } from "../schema";
import type { ResidentialSpec } from "@/lib/insome/types";

/**
 * Deterministic residential floorplan generator. Phase 2.5.1 migrated to the
 * Wall/Room/Opening first-class schema — output structure changed, visual
 * intent (A baseline / B study swap / C bigger study + balcony) preserved.
 *
 * TODO(phase-4): replace with LLM-driven layout generator once the AI service
 * is wired. This scripted algorithm stays as demo / E2E fallback — determined
 * purely by ResidentialSpec so tests stay reproducible.
 */

const VIEWBOX_W = 580;
const VIEWBOX_H = 390;
const BOUNDARY_MARGIN = 20;
const UNITS_PER_METER = 40;
const WALL_THICKNESS = 6;
const NO_OPENINGS: ReadonlyArray<Opening> = [];

function buildBase(): Pick<Floorplan, "viewBox" | "boundary" | "unit" | "scale"> {
  return {
    viewBox: { x: 0, y: 0, w: VIEWBOX_W, h: VIEWBOX_H },
    boundary: {
      x: BOUNDARY_MARGIN,
      y: BOUNDARY_MARGIN,
      w: VIEWBOX_W - BOUNDARY_MARGIN * 2,
      h: VIEWBOX_H - BOUNDARY_MARGIN * 2,
    },
    unit: "m",
    scale: { unitsPerMeter: UNITS_PER_METER },
  };
}

interface RectSpec {
  readonly id: string;
  readonly labelKey: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly furn?: Room["furn"];
}

function expandRect(r: RectSpec): {
  walls: ReadonlyArray<Wall>;
  room: Room;
} {
  const top: Wall = { id: `${r.id}-t`, a: { x: r.x, y: r.y }, b: { x: r.x + r.w, y: r.y }, thickness: WALL_THICKNESS };
  const right: Wall = { id: `${r.id}-r`, a: { x: r.x + r.w, y: r.y }, b: { x: r.x + r.w, y: r.y + r.h }, thickness: WALL_THICKNESS };
  const bottom: Wall = { id: `${r.id}-b`, a: { x: r.x + r.w, y: r.y + r.h }, b: { x: r.x, y: r.y + r.h }, thickness: WALL_THICKNESS };
  const left: Wall = { id: `${r.id}-l`, a: { x: r.x, y: r.y + r.h }, b: { x: r.x, y: r.y }, thickness: WALL_THICKNESS };
  const room: Room = {
    id: r.id,
    labelKey: r.labelKey,
    wallIds: [top.id, right.id, bottom.id, left.id],
    ...(r.furn ? { furn: r.furn } : {}),
  };
  return { walls: [top, right, bottom, left], room };
}

function assemble(label: "a" | "b" | "c", rects: ReadonlyArray<RectSpec>): Floorplan {
  const walls: Wall[] = [];
  const rooms: Room[] = [];
  for (const r of rects) {
    const exp = expandRect(r);
    walls.push(...exp.walls);
    rooms.push(exp.room);
  }
  const base = buildBase();
  return {
    id: `generated-${label}-${Date.now()}`,
    nameKey: `studio.create.proposals.diff.${label}`,
    ...base,
    walls,
    rooms,
    openings: NO_OPENINGS,
  };
}

const RECTS_A: ReadonlyArray<RectSpec> = [
  { id: "living", labelKey: "rooms.livingRoom", x: 30, y: 30, w: 260, h: 180, furn: ["sofa"] },
  { id: "kitchen", labelKey: "rooms.kitchen", x: 290, y: 30, w: 160, h: 110, furn: ["counter"] },
  { id: "dining", labelKey: "rooms.diningRoom", x: 290, y: 140, w: 160, h: 70, furn: ["table"] },
  { id: "master", labelKey: "rooms.masterRoom", x: 30, y: 210, w: 180, h: 150, furn: ["bed"] },
  { id: "bath", labelKey: "rooms.bathroom", x: 210, y: 210, w: 100, h: 80, furn: ["tub"] },
  { id: "bath2", labelKey: "rooms.secondBathroom", x: 310, y: 210, w: 70, h: 80, furn: ["shower"] },
  { id: "second", labelKey: "rooms.secondRoom", x: 380, y: 210, w: 150, h: 150, furn: ["bed"] },
  { id: "hall", labelKey: "rooms.hallway", x: 210, y: 290, w: 170, h: 70 },
];

const RECTS_B: ReadonlyArray<RectSpec> = [
  { id: "living", labelKey: "rooms.livingRoom", x: 30, y: 30, w: 240, h: 180, furn: ["sofa"] },
  { id: "study", labelKey: "rooms.study", x: 30, y: 210, w: 140, h: 150, furn: ["desk"] },
  { id: "kitchen", labelKey: "rooms.kitchen", x: 270, y: 30, w: 180, h: 100, furn: ["counter"] },
  { id: "dining", labelKey: "rooms.diningRoom", x: 270, y: 130, w: 180, h: 80, furn: ["table"] },
  { id: "master", labelKey: "rooms.masterRoom", x: 170, y: 210, w: 200, h: 150, furn: ["bed"] },
  { id: "bath", labelKey: "rooms.bathroom", x: 370, y: 210, w: 80, h: 80, furn: ["tub"] },
  { id: "second", labelKey: "rooms.secondRoom", x: 450, y: 30, w: 100, h: 180, furn: ["bed"] },
  { id: "third", labelKey: "rooms.thirdRoom", x: 370, y: 290, w: 180, h: 70, furn: ["bed"] },
];

const RECTS_C: ReadonlyArray<RectSpec> = [
  { id: "living", labelKey: "rooms.livingRoom", x: 30, y: 30, w: 240, h: 180, furn: ["sofa"] },
  { id: "study", labelKey: "rooms.study", x: 30, y: 210, w: 200, h: 150, furn: ["desk"] },
  { id: "kitchen", labelKey: "rooms.kitchen", x: 270, y: 30, w: 180, h: 100, furn: ["counter"] },
  { id: "dining", labelKey: "rooms.diningRoom", x: 270, y: 130, w: 180, h: 80, furn: ["table"] },
  { id: "master", labelKey: "rooms.masterRoom", x: 230, y: 210, w: 200, h: 150, furn: ["bed"] },
  { id: "bath", labelKey: "rooms.bathroom", x: 430, y: 210, w: 80, h: 80, furn: ["tub"] },
  { id: "second", labelKey: "rooms.secondRoom", x: 450, y: 30, w: 100, h: 180, furn: ["bed"] },
  { id: "balc", labelKey: "rooms.balcony", x: 430, y: 290, w: 120, h: 70 },
];

export function generateResidentialProposals(
  _spec: ResidentialSpec,
): ReadonlyArray<Floorplan> {
  return [
    assemble("a", RECTS_A),
    assemble("b", RECTS_B),
    assemble("c", RECTS_C),
  ];
}

/**
 * Summary helper — deterministic area + room count used by
 * ScriptedProposalGenerator to decorate Proposal objects. Area is derived
 * from each room's polygon AABB to stay correct under the new schema.
 */
export function summarizeFloorplan(fp: Floorplan): { areaSqft: number; roomCount: number } {
  let totalUnitsArea = 0;
  for (const room of fp.rooms) {
    const poly = roomPolygon(room, fp.walls);
    if (poly.length < 3) continue;
    const b = polygonBounds(poly);
    totalUnitsArea += (b.maxX - b.minX) * (b.maxY - b.minY);
  }
  const m2 = totalUnitsArea / (fp.scale.unitsPerMeter * fp.scale.unitsPerMeter);
  const sqft = Math.round(m2 * 10.7639);
  return { areaSqft: sqft, roomCount: fp.rooms.length };
}
