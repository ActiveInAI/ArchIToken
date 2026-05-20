import { boundsFromPoints, type Bounds, type Point } from "@/lib/insome/geom";
import type { Floorplan, Room, Wall } from "./schema";

const CONNECT_EPS = 0.5;

/**
 * Find which endpoint of wall w1 is shared with wall w2 (within eps).
 * Returns null if the walls are not topologically connected.
 */
function sharedEndpoint(w1: Wall, w2: Wall): Point | null {
  const candidates: ReadonlyArray<[Point, Point]> = [
    [w1.b, w2.a],
    [w1.b, w2.b],
    [w1.a, w2.a],
    [w1.a, w2.b],
  ];
  for (const [p, q] of candidates) {
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    if (dx * dx + dy * dy <= CONNECT_EPS * CONNECT_EPS) return p;
  }
  return null;
}

/**
 * Derive the polygon vertex ring for a room by walking its wallIds and
 * taking each adjacent-wall shared endpoint as a polygon vertex. Returns
 * an empty array if walls aren't properly connected.
 */
export function roomPolygon(room: Room, walls: ReadonlyArray<Wall>): ReadonlyArray<Point> {
  const n = room.wallIds.length;
  if (n < 3) return [];
  const byId = new Map(walls.map((w) => [w.id, w]));
  const ordered: Wall[] = [];
  for (const id of room.wallIds) {
    const w = byId.get(id);
    if (!w) return [];
    ordered.push(w);
  }
  const ring: Point[] = [];
  for (let i = 0; i < n; i++) {
    const cur = ordered[i]!;
    const next = ordered[(i + 1) % n]!;
    const v = sharedEndpoint(cur, next);
    if (!v) return [];
    ring.push(v);
  }
  return ring;
}

/** Convenience: AABB of a given room within a floorplan. */
export function floorplanRoomBounds(fp: Floorplan, roomId: string): Bounds | null {
  const room = fp.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const poly = roomPolygon(room, fp.walls);
  if (poly.length < 3) return null;
  return boundsFromPoints(poly);
}
