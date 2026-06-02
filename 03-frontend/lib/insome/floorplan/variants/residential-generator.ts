import { polygonBounds } from "@/lib/insome/geom";
import { roomPolygon } from "../geometry";
import type { Floorplan, FurnitureType, Opening, Room, Wall } from "../schema";
import type { ResidentialSpec } from "@/lib/insome/types";
import {
  createPlanCandidates,
  initialIntent,
  rectFromBlock,
  type GeneratedPlan,
  type PlanBlock,
  type StudioIntent,
} from "@/lib/architoken/floorplan-layout";

/**
 * Residential proposal generator shared by concept_design and detailed_design.
 *
 * The source solver now lives in `lib/architoken/floorplan-layout.ts` so the
 * early concept renderer and the detailed Generate/Fit/Furnish workbench use
 * one deterministic contract before backend/worker solvers are wired.
 */

const VIEWBOX_MARGIN = 20;
const FLOOR_GAP_MM = 1500;
const UNITS_PER_METER = 40;
const WALL_THICKNESS = 6;
const NO_OPENINGS: ReadonlyArray<Opening> = [];

const ROOM_LABELS: Record<string, string> = {
  主卧: "rooms.masterRoom",
  次卧: "rooms.secondRoom",
  主卫: "rooms.bathroom",
  卫生间: "rooms.secondBathroom",
  客厅: "rooms.livingRoom",
  餐厅: "rooms.diningRoom",
  客餐厅一体: "rooms.livingRoom",
  厨房: "rooms.kitchen",
  阳台: "rooms.balcony",
  楼梯: "rooms.hallway",
  储藏: "rooms.hallway",
  弹性区: "rooms.study",
  公共区: "rooms.livingRoom",
};

const ROOM_FURNITURE: Record<string, ReadonlyArray<FurnitureType>> = {
  主卧: ["bed"],
  次卧: ["bed"],
  客厅: ["sofa"],
  公共区: ["sofa"],
  客餐厅一体: ["sofa", "table"],
  餐厅: ["table"],
  厨房: ["counter"],
  主卫: ["tub"],
  卫生间: ["shower"],
  弹性区: ["desk"],
};

interface RectSpec {
  readonly id: string;
  readonly labelKey: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly furn?: ReadonlyArray<FurnitureType>;
}

function specToIntent(spec: ResidentialSpec): StudioIntent {
  const footprintSqm = Math.max(
    40,
    Math.round((spec.widthFt * spec.lengthFt * 0.092903) * 10) / 10,
  );
  const stories = Math.min(2, Math.max(1, spec.stories ?? 1)) as 1 | 2;
  const bedrooms = Math.max(1, Math.round(spec.bedrooms ?? 3));
  const bathrooms = Math.max(1, Math.round(spec.bathrooms ?? 2));
  return {
    ...initialIntent,
    totalAreaSqm: Math.max(60, Math.round(footprintSqm * stories)),
    floors: stories,
    publicSplit: bedrooms <= 2 ? "lk" : "lk_sep",
    rooms: {
      ...initialIntent.rooms,
      主卧: {
        ...initialIntent.rooms.主卧,
        count: 1,
        max: bedrooms >= 4 ? 18 : 16,
      },
      主卫: {
        ...initialIntent.rooms.主卫,
        count: bathrooms > 1 ? 1 : 0,
      },
      次卧: {
        ...initialIntent.rooms.次卧,
        count: Math.max(0, bedrooms - 1),
      },
      卫生间: {
        ...initialIntent.rooms.卫生间,
        count: Math.max(1, bathrooms - (bathrooms > 1 ? 1 : 0)),
      },
      厨房: { ...initialIntent.rooms.厨房, count: 1 },
      阳台: { ...initialIntent.rooms.阳台, count: 0 },
    },
  };
}

function expandRect(r: RectSpec): {
  readonly walls: ReadonlyArray<Wall>;
  readonly room: Room;
} {
  const top: Wall = {
    id: `${r.id}-t`,
    a: { x: r.x, y: r.y },
    b: { x: r.x + r.w, y: r.y },
    thickness: WALL_THICKNESS,
  };
  const right: Wall = {
    id: `${r.id}-r`,
    a: { x: r.x + r.w, y: r.y },
    b: { x: r.x + r.w, y: r.y + r.h },
    thickness: WALL_THICKNESS,
  };
  const bottom: Wall = {
    id: `${r.id}-b`,
    a: { x: r.x + r.w, y: r.y + r.h },
    b: { x: r.x, y: r.y + r.h },
    thickness: WALL_THICKNESS,
  };
  const left: Wall = {
    id: `${r.id}-l`,
    a: { x: r.x, y: r.y + r.h },
    b: { x: r.x, y: r.y },
    thickness: WALL_THICKNESS,
  };
  const room: Room = {
    id: r.id,
    labelKey: r.labelKey,
    wallIds: [top.id, right.id, bottom.id, left.id],
    ...(r.furn?.length ? { furn: r.furn } : {}),
  };
  return { walls: [top, right, bottom, left], room };
}

function blockToRect(block: PlanBlock, plan: GeneratedPlan): RectSpec {
  const mm = rectFromBlock(block);
  const scale = UNITS_PER_METER / 1000;
  const floorOffsetX = (block.floor - 1) * (plan.summary.envelope[0] + FLOOR_GAP_MM);
  const id = `${block.id}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  return {
    id,
    labelKey: ROOM_LABELS[block.purpose] ?? "rooms.hallway",
    x: VIEWBOX_MARGIN + (mm.x0 + floorOffsetX) * scale,
    y: VIEWBOX_MARGIN + mm.y0 * scale,
    w: Math.max(8, mm.w * scale),
    h: Math.max(8, mm.h * scale),
    ...(ROOM_FURNITURE[block.purpose] ? { furn: ROOM_FURNITURE[block.purpose] } : {}),
  };
}

function assemble(plan: GeneratedPlan, label: string): Floorplan {
  const rects = plan.blocks.map((block) => blockToRect(block, plan));
  const walls: Wall[] = [];
  const rooms: Room[] = [];
  for (const rect of rects) {
    const expanded = expandRect(rect);
    walls.push(...expanded.walls);
    rooms.push(expanded.room);
  }
  const scale = UNITS_PER_METER / 1000;
  const viewBoxW =
    VIEWBOX_MARGIN * 2 +
    (plan.summary.envelope[0] * plan.floors + FLOOR_GAP_MM * (plan.floors - 1)) * scale;
  const viewBoxH = VIEWBOX_MARGIN * 2 + plan.summary.envelope[1] * scale;
  return {
    id: `layout-kernel-${label}-${plan.projectId}`,
    nameKey: `studio.create.proposals.${label}`,
    viewBox: { x: 0, y: 0, w: viewBoxW, h: viewBoxH },
    boundary: {
      x: VIEWBOX_MARGIN,
      y: VIEWBOX_MARGIN,
      w: viewBoxW - VIEWBOX_MARGIN * 2,
      h: viewBoxH - VIEWBOX_MARGIN * 2,
    },
    unit: "m",
    scale: { unitsPerMeter: UNITS_PER_METER },
    walls,
    rooms,
    openings: NO_OPENINGS,
    stories: plan.floors,
  };
}

export function generateResidentialProposals(
  spec: ResidentialSpec,
): ReadonlyArray<Floorplan> {
  const intent = specToIntent(spec);
  return createPlanCandidates(intent).map((candidate, index) =>
    assemble(candidate.plan, String.fromCharCode(97 + index)),
  );
}

/**
 * Summary helper: deterministic area + room count used by
 * ScriptedProposalGenerator to decorate Proposal objects.
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
