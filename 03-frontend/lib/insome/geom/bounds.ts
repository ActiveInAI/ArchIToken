import { type Bounds, type Point } from "./types";

/** @example fromPoints([{x:0,y:0},{x:10,y:5}]) // => {minX:0,minY:0,maxX:10,maxY:5} */
export function fromPoints(points: ReadonlyArray<Point>): Bounds {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Union (smallest bounding box that contains both). */
export function union(a: Bounds, b: Bounds): Bounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** Overlap test (inclusive on touching edges). */
export function intersects(a: Bounds, b: Bounds): boolean {
  return !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);
}

/** Expand outward by margin (negative shrinks). */
export function expand(b: Bounds, margin: number): Bounds {
  return {
    minX: b.minX - margin,
    minY: b.minY - margin,
    maxX: b.maxX + margin,
    maxY: b.maxY + margin,
  };
}

/** Point-in-AABB. @example contains({minX:0,minY:0,maxX:10,maxY:10},{x:5,y:5}) // => true */
export function contains(b: Bounds, p: Point): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;
}

export function width(b: Bounds): number {
  return b.maxX - b.minX;
}

export function height(b: Bounds): number {
  return b.maxY - b.minY;
}

export function center(b: Bounds): Point {
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}
