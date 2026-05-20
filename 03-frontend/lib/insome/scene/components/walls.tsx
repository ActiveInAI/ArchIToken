"use client";

import type { ReactElement } from "react";
import { detectJunctions } from "@/lib/insome/geom";
import type { SceneTheme, SceneWall, WallSegment } from "../types";

export interface WallsProps {
  readonly walls: ReadonlyArray<SceneWall>;
  readonly theme: SceneTheme;
  readonly selectedWallId?: string | null;
  readonly onClick?: (wallId: string) => void;
}

export function Walls({ walls, theme, selectedWallId, onClick }: WallsProps): ReactElement {
  // Phase 2.75: junction cubes patch the gap at T / L / 十 intersections.
  // We use the first segment's a/b of each wall as a proxy for the 2D wall endpoints.
  const junctionRefs = walls
    .filter((w) => w.segments.length > 0)
    .map((w) => {
      const first = w.segments[0]!;
      const last = w.segments[w.segments.length - 1]!;
      return { id: w.id, a: { x: first.a.x, y: first.a.z }, b: { x: last.b.x, y: last.b.z }, thickness: w.thickness };
    });
  const junctions = detectJunctions(junctionRefs);
  const wallById = new Map(walls.map((w) => [w.id, w]));
  // Phase 4.0 fix: walls take the contrast color of the canvas background.
  // Studio bg #1F1F1F → light wall; Home bg #FAFAFA → dark wall.
  const baseColor = theme === "studio" ? "#E8E5DE" : "#3A3A3A";

  return (
    <group>
      {walls.map((w) =>
        w.segments.map((seg, i) => (
          <WallSegmentMesh
            key={`${w.id}-${i}`}
            wallId={w.id}
            segment={seg}
            thickness={w.thickness}
            theme={theme}
            selected={selectedWallId === w.id}
            onClick={onClick}
          />
        )),
      )}
      {junctions.map((j, i) => {
        const maxHeight = Math.max(...j.refs.map((r) => wallById.get(r.wallId)?.height ?? 0));
        const t = j.maxThickness;
        return (
          <mesh
            key={`junction-${i}`}
            position={[j.point.x, maxHeight / 2, j.point.y]}
          >
            <boxGeometry args={[t, maxHeight, t]} />
            <meshStandardMaterial color={baseColor} roughness={0.85} metalness={0.05} />
          </mesh>
        );
      })}
    </group>
  );
}

function WallSegmentMesh({
  wallId,
  segment,
  thickness,
  theme,
  selected,
  onClick,
}: {
  wallId: string;
  segment: WallSegment;
  thickness: number;
  theme: SceneTheme;
  selected: boolean;
  onClick?: ((wallId: string) => void) | undefined;
}) {
  const dx = segment.b.x - segment.a.x;
  const dz = segment.b.z - segment.a.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 1e-3) return null;
  const cx = (segment.a.x + segment.b.x) / 2;
  const cz = (segment.a.z + segment.b.z) / 2;
  const cy = (segment.yBottom + segment.yTop) / 2;
  const height = segment.yTop - segment.yBottom;
  const rotY = Math.atan2(dz, dx);

  // Phase 4.0 fix: walls take the contrast color of the canvas background.
  // Studio bg #1F1F1F → light wall; Home bg #FAFAFA → dark wall.
  const baseColor = theme === "studio" ? "#E8E5DE" : "#3A3A3A";
  const accent = theme === "studio" ? "#D4FF3A" : "#FF4B1F";
  const color = selected ? mixColor(baseColor, accent, 0.3) : baseColor;

  return (
    <mesh
      position={[cx, cy, cz]}
      rotation={[0, -rotY, 0]}
      userData={{ kind: "wall", id: wallId }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(wallId);
      }}
    >
      <boxGeometry args={[length, height, thickness]} />
      <meshStandardMaterial color={color} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

function mixColor(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  if (!pa || !pb) return a;
  const r = Math.round(pa[0] * (1 - t) + pb[0] * t);
  const g = Math.round(pa[1] * (1 - t) + pb[1] * t);
  const bl = Math.round(pa[2] * (1 - t) + pb[2] * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const v = parseInt(m[1]!, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
