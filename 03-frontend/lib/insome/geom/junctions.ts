import type { Point } from "./types";

/**
 * Detect shared endpoints across walls. Two endpoints are "shared" when they
 * are within `eps` world units. Used by 2D/3D renderers to patch the
 * thickness-gap at T / L / 十 junctions.
 */

export interface JunctionWallRef {
  readonly id: string;
  readonly a: Point;
  readonly b: Point;
  readonly thickness: number;
}

export interface Junction {
  readonly point: Point;
  /** Wall ids (and which endpoint A/B) that meet at this point. */
  readonly refs: ReadonlyArray<{ readonly wallId: string; readonly end: "a" | "b" }>;
  /** Maximum thickness of the walls meeting here — drives patch cap radius. */
  readonly maxThickness: number;
}

const DEFAULT_JUNCTION_EPS = 0.5;

export function detectJunctions(
  walls: ReadonlyArray<JunctionWallRef>,
  eps: number = DEFAULT_JUNCTION_EPS,
): ReadonlyArray<Junction> {
  const epsSq = eps * eps;
  const endpoints: Array<{ wallId: string; end: "a" | "b"; p: Point; thickness: number }> = [];
  for (const w of walls) {
    endpoints.push({ wallId: w.id, end: "a", p: w.a, thickness: w.thickness });
    endpoints.push({ wallId: w.id, end: "b", p: w.b, thickness: w.thickness });
  }

  const used = new Array<boolean>(endpoints.length).fill(false);
  const junctions: Junction[] = [];
  for (let i = 0; i < endpoints.length; i++) {
    if (used[i]) continue;
    const seed = endpoints[i]!;
    const members: Array<{ wallId: string; end: "a" | "b"; thickness: number }> = [
      { wallId: seed.wallId, end: seed.end, thickness: seed.thickness },
    ];
    let maxT = seed.thickness;
    used[i] = true;
    for (let j = i + 1; j < endpoints.length; j++) {
      if (used[j]) continue;
      const other = endpoints[j]!;
      const dx = seed.p.x - other.p.x;
      const dy = seed.p.y - other.p.y;
      if (dx * dx + dy * dy <= epsSq) {
        used[j] = true;
        members.push({ wallId: other.wallId, end: other.end, thickness: other.thickness });
        if (other.thickness > maxT) maxT = other.thickness;
      }
    }
    if (members.length >= 2) {
      junctions.push({ point: seed.p, refs: members, maxThickness: maxT });
    }
  }
  return junctions;
}
