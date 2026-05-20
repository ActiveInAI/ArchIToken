import { DEFAULT_EPS, type Point, type Segment } from "./types";
import { dist as pointDist } from "./point";

/** @example length({a:{x:0,y:0}, b:{x:3,y:4}}) // => 5 */
export function length(s: Segment): number {
  return pointDist(s.a, s.b);
}

/**
 * Closest point on segment to p. Returns the projected point, t in [0,1]
 * parameter along a→b, and distance from p.
 * @example closestPointOn({a:{x:0,y:0}, b:{x:10,y:0}}, {x:5,y:3})
 *   // => { point:{x:5,y:0}, t:0.5, dist:3 }
 */
export function closestPointOn(
  s: Segment,
  p: Point,
): { readonly point: Point; readonly t: number; readonly dist: number } {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < DEFAULT_EPS) {
    return { point: s.a, t: 0, dist: pointDist(p, s.a) };
  }
  const raw = ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / lenSq;
  const t = Math.max(0, Math.min(1, raw));
  const point: Point = { x: s.a.x + dx * t, y: s.a.y + dy * t };
  return { point, t, dist: pointDist(p, point) };
}

/**
 * Segment intersection. Returns the intersection point if segments cross
 * within their bounds, otherwise null (parallel or non-crossing).
 * @example intersect({a:{x:0,y:0},b:{x:10,y:0}}, {a:{x:5,y:-5},b:{x:5,y:5}})
 *   // => { x:5, y:0 }
 */
export function intersect(s1: Segment, s2: Segment): Point | null {
  const x1 = s1.a.x, y1 = s1.a.y, x2 = s1.b.x, y2 = s1.b.y;
  const x3 = s2.a.x, y3 = s2.a.y, x4 = s2.b.x, y4 = s2.b.y;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < DEFAULT_EPS) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

/** @example pointOnSegment({a:{x:0,y:0},b:{x:10,y:0}}, {x:5,y:0}) // => true */
export function pointOnSegment(s: Segment, p: Point, eps: number = 1e-6): boolean {
  const { dist } = closestPointOn(s, p);
  return dist <= eps;
}
