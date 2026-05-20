import type { Bounds, Point } from "./types";
import { expand, contains, intersects } from "./bounds";

/**
 * Minimal AABB-filter spatial index.
 *
 * NOTE(phase-2.75-benchmark): Bun + node perf benchmark of `solveSnap` at
 *   - 32 walls (current Studio proposal scale) → 0.0037 ms per call → ~4479 snap queries per 60 fps frame budget
 *   - 192 walls (6x stress test) → 0.0164 ms per call → ~1014 queries per frame
 * Linear scan is plenty fast. rbush / R-tree upgrade deferred until a real
 * floorplan exceeds ~500 walls (no foreseeable Phase roadmap hits this scale).
 */
export interface SpatialEntry<T> {
  readonly id: string;
  readonly bounds: Bounds;
  readonly value: T;
}

export interface SpatialIndex<T> {
  queryPoint(p: Point, margin: number): ReadonlyArray<SpatialEntry<T>>;
  queryBounds(b: Bounds): ReadonlyArray<SpatialEntry<T>>;
  all(): ReadonlyArray<SpatialEntry<T>>;
}

export function createSpatialIndex<T>(
  entries: ReadonlyArray<SpatialEntry<T>>,
): SpatialIndex<T> {
  const list = [...entries];
  return {
    queryPoint(p, margin) {
      return list.filter((e) => contains(expand(e.bounds, margin), p));
    },
    queryBounds(b) {
      return list.filter((e) => intersects(e.bounds, b));
    },
    all() {
      return list;
    },
  };
}
