import type { Floorplan, Opening, Wall } from "@/lib/insome/floorplan";
import { roomPolygon } from "@/lib/insome/floorplan";
import type {
  Bounds3D,
  Scene3D,
  SceneOpening,
  SceneRoom,
  SceneWall,
  Vec3,
  WallSegment,
} from "./types";
import {
  UNIT_DEFAULTS_FT,
  UNIT_DEFAULTS_M,
  resolveOpeningHeight,
  resolveOpeningSill,
  type UnitDefaults,
} from "./defaults";

/**
 * Pure 2D → 3D derivation. No React, no three.js runtime, no mutation.
 *
 * Coordinate mapping:
 *   2D (x, y) with SVG y-down  →  3D (x, z) with y-up
 *   Wall heights extrude along +y.
 *
 * Keeps a top-down 3D view visually consistent with the 2D SVG Renderer.
 */

export interface SceneDeriveOptions {
  readonly defaultWallHeight?: number;
  readonly includeRoof?: boolean;
  readonly homeFloorColor?: string;
  readonly studioFloorColor?: string;
  readonly theme?: "home" | "studio";
}

export function sceneFromFloorplan(
  floorplan: Floorplan,
  options: SceneDeriveOptions = {},
): Scene3D {
  const unit = floorplan.unit;
  const defaults: UnitDefaults = unit === "ft" ? UNIT_DEFAULTS_FT : UNIT_DEFAULTS_M;
  const unitsPerMeter = floorplan.scale.unitsPerMeter;
  const defaultWallHeightFloorUnits =
    options.defaultWallHeight ??
    floorplan.defaultWallHeight ??
    defaults.wallHeight * unitsPerMeter;

  const openingsByWall = groupOpeningsByWall(floorplan.openings);
  const walls: SceneWall[] = floorplan.walls.map((w) => {
    const attached = openingsByWall.get(w.id) ?? [];
    const wallHeight = w.height ?? defaultWallHeightFloorUnits;
    return {
      id: w.id,
      thickness: w.thickness,
      height: wallHeight,
      segments: deriveWallSegments(w, attached, wallHeight, defaults, unitsPerMeter),
    };
  });

  const rooms: SceneRoom[] = floorplan.rooms.map((r) => {
    const poly2d = roomPolygon(r, floorplan.walls);
    const polygon: Vec3[] = poly2d.map((p) => ({ x: p.x, y: 0, z: p.y }));
    // Phase 4.0 fix: floor contrasts with the canvas background.
    // Studio dark bg → light floor; Home light bg → mid-dark floor.
    const floorColor =
      r.floorFinish3d?.color ??
      (options.theme === "studio"
        ? (options.studioFloorColor ?? "#C9C5BC")
        : (options.homeFloorColor ?? "#5A5A5A"));
    const ceilingHeight = r.ceilingHeight ?? defaultWallHeightFloorUnits;
    return { id: r.id, polygon, floorColor, ceilingHeight };
  });

  const wallById = new Map(floorplan.walls.map((w) => [w.id, w]));
  const openings: SceneOpening[] = floorplan.openings
    .map((o) => toSceneOpening(o, wallById, defaults, unitsPerMeter))
    .filter((x): x is SceneOpening => x !== null);

  const bounds = computeBounds(walls, defaultWallHeightFloorUnits);

  return {
    walls,
    rooms,
    openings,
    bounds,
    metadata: { unit, defaultWallHeight: defaultWallHeightFloorUnits },
  };
}

function groupOpeningsByWall(openings: ReadonlyArray<Opening>): Map<string, Opening[]> {
  const map = new Map<string, Opening[]>();
  for (const o of openings) {
    const list = map.get(o.wallId) ?? [];
    list.push(o);
    map.set(o.wallId, list);
  }
  return map;
}

/**
 * Slice a wall along its a→b direction into mesh-ready segments.
 * Given N openings on the wall, emits:
 *   - up to (N+1) "side-of-opening" segments spanning the wall gaps (full height)
 *   - per opening: optional "below-opening" segment (sill < opening)
 *     and optional "above-opening" segment (opening top < wall top)
 */
function deriveWallSegments(
  wall: Wall,
  openings: ReadonlyArray<Opening>,
  wallHeight: number,
  defaults: UnitDefaults,
  unitsPerMeter: number,
): WallSegment[] {
  const dx = wall.b.x - wall.a.x;
  const dy = wall.b.y - wall.a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) return [];
  const ux = dx / len;
  const uy = dy / len;

  const sorted = [...openings].sort((a, b) => a.offset - b.offset);
  const segments: WallSegment[] = [];

  let cursorT = 0;
  for (const o of sorted) {
    const leftT = Math.max(0, o.offset - o.width / 2);
    const rightT = Math.min(len, o.offset + o.width / 2);
    if (leftT > cursorT + 1e-6) {
      segments.push(makeSeg(wall, ux, uy, cursorT, leftT, 0, wallHeight, "side-of-opening"));
    }
    const oh = resolveOpeningHeight(o, defaults, unitsPerMeter);
    const sill = resolveOpeningSill(o, defaults, unitsPerMeter);
    const topOfOpening = sill + oh;
    if (sill > 1e-6) {
      segments.push(makeSeg(wall, ux, uy, leftT, rightT, 0, sill, "below-opening"));
    }
    if (wallHeight - topOfOpening > 1e-6) {
      segments.push(makeSeg(wall, ux, uy, leftT, rightT, topOfOpening, wallHeight, "above-opening"));
    }
    cursorT = rightT;
  }
  if (cursorT < len - 1e-6) {
    segments.push(makeSeg(wall, ux, uy, cursorT, len, 0, wallHeight, "side-of-opening"));
  }

  return segments.filter(
    (s) => Number.isFinite(s.yBottom) && Number.isFinite(s.yTop) && s.yTop - s.yBottom > 1e-3,
  );
}

function makeSeg(
  wall: Wall,
  ux: number,
  uy: number,
  tA: number,
  tB: number,
  yBottom: number,
  yTop: number,
  reason: WallSegment["reason"],
): WallSegment {
  return {
    a: { x: wall.a.x + ux * tA, y: 0, z: wall.a.y + uy * tA },
    b: { x: wall.a.x + ux * tB, y: 0, z: wall.a.y + uy * tB },
    yBottom,
    yTop,
    reason,
  };
}

function toSceneOpening(
  o: Opening,
  wallById: Map<string, Wall>,
  defaults: UnitDefaults,
  unitsPerMeter: number,
): SceneOpening | null {
  const w = wallById.get(o.wallId);
  if (!w) return null;
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) return null;
  const ux = dx / len;
  const uy = dy / len;
  const cx = w.a.x + ux * o.offset;
  const cz = w.a.y + uy * o.offset;
  const h = resolveOpeningHeight(o, defaults, unitsPerMeter);
  const sill = resolveOpeningSill(o, defaults, unitsPerMeter);
  const cy = sill + h / 2;
  return {
    id: o.id,
    wallId: o.wallId,
    type: o.type,
    position: { x: cx, y: cy, z: cz },
    normal: { x: -uy, y: 0, z: ux },
    direction: { x: ux, y: 0, z: uy },
    width: o.width,
    height: h,
    sillHeight: sill,
    swing: o.swing ?? "none",
  };
}

function computeBounds(walls: ReadonlyArray<SceneWall>, defaultHeight: number): Bounds3D {
  let minX = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = 0, maxZ = -Infinity;
  for (const w of walls) {
    for (const s of w.segments) {
      for (const p of [s.a, s.b]) {
        if (p.x < minX) minX = p.x;
        if (p.z < minZ) minZ = p.z;
        if (p.x > maxX) maxX = p.x;
        if (p.z > maxZ) maxZ = p.z;
      }
      if (s.yTop > maxY) maxY = s.yTop;
    }
  }
  if (!Number.isFinite(minX)) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: defaultHeight, z: 1 } };
  }
  return {
    min: { x: minX, y: 0, z: minZ },
    max: { x: maxX, y: Math.max(maxY, defaultHeight), z: maxZ },
  };
}
