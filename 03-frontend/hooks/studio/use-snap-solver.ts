"use client";

import { useCallback } from "react";
import {
  solveSnap,
  type Point,
  type SnapMode,
  type SnapResult,
  type SnapWallRef,
} from "@/lib/insome/geom";
import type { Floorplan } from "@/lib/insome/floorplan";

const SNAP_PX = 8;
const GRID_STEP = 1;

export interface SnapSolverInput {
  readonly point: Point;
  readonly ignoreWallIds?: ReadonlySet<string>;
  readonly ignoreEndpoints?: ReadonlyArray<{ wallId: string; end: "a" | "b" }>;
  readonly mode?: SnapMode;
}

export function useSnapSolver(floorplan: Floorplan | null, zoom: number) {
  const solve = useCallback(
    (input: SnapSolverInput): SnapResult => {
      if (!floorplan) {
        return { point: input.point, candidates: [], snappedTo: null };
      }
      const walls: SnapWallRef[] = floorplan.walls.map((w) => ({ id: w.id, a: w.a, b: w.b }));
      return solveSnap({
        input: input.point,
        walls,
        ...(input.ignoreWallIds ? { ignoreWallIds: input.ignoreWallIds } : {}),
        ...(input.ignoreEndpoints ? { ignoreEndpoints: input.ignoreEndpoints } : {}),
        thresholdWorld: SNAP_PX / Math.max(zoom, 0.01),
        gridStep: GRID_STEP,
        ...(input.mode ? { mode: input.mode } : {}),
      });
    },
    [floorplan, zoom],
  );
  return solve;
}
