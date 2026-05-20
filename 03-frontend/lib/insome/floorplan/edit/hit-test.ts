import { closestPointOn, dist, polygonContains } from "@/lib/insome/geom";
import type { Floorplan, Point, Wall } from "../schema";
import { roomPolygon } from "../geometry";
import type { HitTarget, HitTestResult } from "./types";

/**
 * Hit test at a world-space point. Phase 2.5.3 priority:
 *   1. Wall endpoint (within `endpointRadiusWorld`)
 *   2. Opening (projected onto wall within offset±width/2, normal < thickness/2 + 2px)
 *   3. Wall segment (perpendicular distance < `segmentRadiusWorld`)
 *   4. Room polygon containment (top-most in rooms array wins)
 *   5. Empty
 */
export function hitTest(
  fp: Floorplan,
  worldPoint: Point,
  endpointRadiusWorld: number,
  segmentRadiusWorld: number,
): HitTestResult {
  let best: { target: HitTarget; d: number } | null = null;
  for (const w of fp.walls) {
    const da = dist(worldPoint, w.a);
    if (da <= endpointRadiusWorld && (!best || da < best.d)) {
      best = { target: { kind: "wall-endpoint", wallId: w.id, end: "a" }, d: da };
    }
    const db = dist(worldPoint, w.b);
    if (db <= endpointRadiusWorld && (!best || db < best.d)) {
      best = { target: { kind: "wall-endpoint", wallId: w.id, end: "b" }, d: db };
    }
  }
  if (best) return { target: best.target, worldPoint };

  const openingHit = hitOpening(fp, worldPoint);
  if (openingHit) return { target: openingHit, worldPoint };

  let bestSeg: { wallId: string; d: number } | null = null;
  for (const w of fp.walls) {
    const { dist: d } = closestPointOn({ a: w.a, b: w.b }, worldPoint);
    if (d <= segmentRadiusWorld) {
      if (!bestSeg || d < bestSeg.d) bestSeg = { wallId: w.id, d };
    }
  }
  if (bestSeg) {
    return { target: { kind: "wall-segment", wallId: bestSeg.wallId }, worldPoint };
  }

  for (let i = fp.rooms.length - 1; i >= 0; i--) {
    const room = fp.rooms[i]!;
    const poly = roomPolygon(room, fp.walls);
    if (poly.length >= 3 && polygonContains(poly, worldPoint)) {
      return { target: { kind: "room", roomId: room.id }, worldPoint };
    }
  }

  return { target: { kind: "empty" }, worldPoint };
}

function wallLen(w: Wall): number {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function hitOpening(fp: Floorplan, p: Point): HitTarget | null {
  const wallsById = new Map(fp.walls.map((w) => [w.id, w]));
  let best: { id: string; d: number } | null = null;
  for (const o of fp.openings) {
    const w = wallsById.get(o.wallId);
    if (!w) continue;
    const len = wallLen(w);
    if (len < 1e-6) continue;
    const ux = (w.b.x - w.a.x) / len;
    const uy = (w.b.y - w.a.y) / len;
    const px = p.x - w.a.x;
    const py = p.y - w.a.y;
    const along = px * ux + py * uy;
    const normal = Math.abs(-ux * py + uy * px);
    const halfW = o.width / 2;
    const normalLimit = w.thickness / 2 + 2;
    if (along >= o.offset - halfW && along <= o.offset + halfW && normal <= normalLimit) {
      const d = Math.abs(along - o.offset);
      if (!best || d < best.d) best = { id: o.id, d };
    }
  }
  if (!best) return null;
  return { kind: "opening", openingId: best.id };
}
