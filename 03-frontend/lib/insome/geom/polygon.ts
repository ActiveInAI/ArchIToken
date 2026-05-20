import { type Bounds, type Point, type Polygon } from "./types";

/**
 * Signed area via the shoelace formula. Positive for CCW polygons, negative
 * for CW (with y-down screen coords, signs flip — so with SVG y-down, CW is
 * positive and CCW is negative). Absolute value is the geometric area.
 * @example area([{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}]) // => 100 (y-down)
 */
export function area(poly: Polygon): number {
  const n = poly.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/** Geometric centroid (area-weighted, not just vertex mean). */
export function centroid(poly: Polygon): Point {
  const n = poly.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return poly[0]!;
  const signed = area(poly);
  if (Math.abs(signed) < 1e-9) {
    let sx = 0, sy = 0;
    for (const p of poly) { sx += p.x; sy += p.y; }
    return { x: sx / n, y: sy / n };
  }
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const k = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * k;
    cy += (a.y + b.y) * k;
  }
  const f = 1 / (6 * signed);
  return { x: cx * f, y: cy * f };
}

/**
 * Point-in-polygon via ray casting. Works for simple polygons (no
 * self-intersections). Boundary behaviour is unspecified.
 * @example contains([{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}], {x:5,y:5}) // => true
 */
export function contains(poly: Polygon, p: Point): boolean {
  const n = poly.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = poly[i]!;
    const pj = poly[j]!;
    const intersects =
      pi.y > p.y !== pj.y > p.y &&
      p.x < ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** AABB of a polygon. Throws-ish (returns zero-box) on empty input. */
export function polygonBounds(poly: Polygon): Bounds {
  if (poly.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}
