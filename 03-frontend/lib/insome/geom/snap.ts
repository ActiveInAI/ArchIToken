import type { Point } from "./types";
import { dist } from "./point";

/**
 * Generic snap solver. Lives in @/lib/insome/geom so it's framework-agnostic —
 * the caller supplies wall endpoints / midpoints as plain points.
 *
 * Phase 2.5.2 introduced: endpoint / midpoint / grid / axis-parallel / axis-perpendicular.
 * Phase 2.5.3 adds two creation-mode sources:
 *   - wall-percent  — 25% / 50% / 75% positions along a wall (for opening placement)
 *   - wall-mid-any  — projection onto the wall axis (opening falls on wall)
 *
 * The `mode` parameter is optional (default `"default"`) so Phase 2.5.2 call
 * sites do not need to change.
 */

export type SnapSourceKind =
  | "endpoint"
  | "midpoint"
  | "grid"
  | "axis-parallel"
  | "axis-perpendicular"
  | "wall-percent"
  | "wall-mid-any";

export type SnapMode = "default" | "creation-wall-endpoint" | "creation-opening";

export interface SnapCandidate {
  readonly kind: SnapSourceKind;
  readonly point: Point;
  readonly dist: number;
  readonly priority: number;
  readonly refWallId?: string;
  readonly refPoint?: Point;
}

export interface SnapResult {
  readonly point: Point;
  readonly candidates: ReadonlyArray<SnapCandidate>;
  readonly snappedTo: SnapCandidate | null;
}

export interface SnapWallRef {
  readonly id: string;
  readonly a: Point;
  readonly b: Point;
}

export interface SolveSnapParams {
  readonly input: Point;
  readonly walls: ReadonlyArray<SnapWallRef>;
  readonly ignoreWallIds?: ReadonlySet<string>;
  readonly ignoreEndpoints?: ReadonlyArray<{ wallId: string; end: "a" | "b" }>;
  readonly thresholdWorld: number;
  readonly gridStep: number;
  readonly mode?: SnapMode;
}

const PRIORITY: Record<SnapSourceKind, number> = {
  endpoint: 1,
  "wall-percent": 2,
  midpoint: 2,
  "wall-mid-any": 2.5,
  "axis-parallel": 3,
  "axis-perpendicular": 3,
  grid: 4,
};

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function pointAlong(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function projectOntoWall(input: Point, w: SnapWallRef): { point: Point; t: number; dist: number } {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) return { point: w.a, t: 0, dist: dist(input, w.a) };
  const raw = ((input.x - w.a.x) * dx + (input.y - w.a.y) * dy) / lenSq;
  const t = Math.max(0, Math.min(1, raw));
  const point = pointAlong(w.a, w.b, t);
  return { point, t, dist: dist(input, point) };
}

export function solveSnap(params: SolveSnapParams): SnapResult {
  const { input, walls, thresholdWorld, gridStep } = params;
  const mode: SnapMode = params.mode ?? "default";
  const ignoreWallIds = params.ignoreWallIds ?? new Set<string>();
  const ignoreEndpoints = params.ignoreEndpoints ?? [];
  const ignoreEndpointKey = new Set(ignoreEndpoints.map((e) => `${e.wallId}:${e.end}`));

  const candidates: SnapCandidate[] = [];

  for (const w of walls) {
    if (ignoreWallIds.has(w.id)) continue;

    if (mode !== "creation-opening") {
      if (!ignoreEndpointKey.has(`${w.id}:a`)) {
        const d = dist(input, w.a);
        if (d <= thresholdWorld) {
          candidates.push({ kind: "endpoint", point: w.a, dist: d, priority: PRIORITY.endpoint, refWallId: w.id });
        }
      }
      if (!ignoreEndpointKey.has(`${w.id}:b`)) {
        const d = dist(input, w.b);
        if (d <= thresholdWorld) {
          candidates.push({ kind: "endpoint", point: w.b, dist: d, priority: PRIORITY.endpoint, refWallId: w.id });
        }
      }
      const m = mid(w.a, w.b);
      const dm = dist(input, m);
      if (dm <= thresholdWorld) {
        candidates.push({ kind: "midpoint", point: m, dist: dm, priority: PRIORITY.midpoint, refWallId: w.id });
      }

      if (Math.abs(input.y - w.a.y) <= thresholdWorld) {
        const pt: Point = { x: input.x, y: w.a.y };
        candidates.push({
          kind: "axis-parallel",
          point: pt,
          dist: Math.abs(input.y - w.a.y),
          priority: PRIORITY["axis-parallel"],
          refWallId: w.id,
          refPoint: w.a,
        });
      }
      if (Math.abs(input.x - w.a.x) <= thresholdWorld) {
        const pt: Point = { x: w.a.x, y: input.y };
        candidates.push({
          kind: "axis-perpendicular",
          point: pt,
          dist: Math.abs(input.x - w.a.x),
          priority: PRIORITY["axis-perpendicular"],
          refWallId: w.id,
          refPoint: w.a,
        });
      }
    }

    if (mode === "creation-opening") {
      for (const frac of [0.25, 0.5, 0.75] as const) {
        const pt = pointAlong(w.a, w.b, frac);
        const d = dist(input, pt);
        if (d <= thresholdWorld) {
          candidates.push({
            kind: "wall-percent",
            point: pt,
            dist: d,
            priority: PRIORITY["wall-percent"],
            refWallId: w.id,
            refPoint: pt,
          });
        }
      }
      const proj = projectOntoWall(input, w);
      if (proj.dist <= thresholdWorld) {
        candidates.push({
          kind: "wall-mid-any",
          point: proj.point,
          dist: proj.dist,
          priority: PRIORITY["wall-mid-any"],
          refWallId: w.id,
          refPoint: proj.point,
        });
      }
    }
  }

  if (gridStep > 0 && mode !== "creation-opening") {
    const gp: Point = {
      x: Math.round(input.x / gridStep) * gridStep,
      y: Math.round(input.y / gridStep) * gridStep,
    };
    const d = dist(input, gp);
    if (d <= thresholdWorld) {
      candidates.push({ kind: "grid", point: gp, dist: d, priority: PRIORITY.grid });
    }
  }

  candidates.sort((a, b) => a.priority - b.priority || a.dist - b.dist);
  const snappedTo = candidates[0] ?? null;
  return {
    point: snappedTo ? snappedTo.point : input,
    candidates,
    snappedTo,
  };
}
