"use client";

import type { Bounds3D, SceneTheme } from "../types";

export interface RoofProps {
  readonly bounds: Bounds3D;
  readonly theme: SceneTheme;
  readonly visible?: boolean;
}

/**
 * L1 simplification: flat roof over floorplan AABB. L-shaped rooms don't get
 * an L-shaped roof — see "不在 Phase 3 范围" in README.
 */
export function Roof({ bounds, theme, visible = true }: RoofProps) {
  const w = bounds.max.x - bounds.min.x;
  const d = bounds.max.z - bounds.min.z;
  const cx = (bounds.min.x + bounds.max.x) / 2;
  const cz = (bounds.min.z + bounds.max.z) / 2;
  const y = bounds.max.y + 0.1;
  // Phase 4.0 fix: roof contrasts with the canvas background.
  // Studio dark bg → light roof; Home light bg → dark roof.
  const color = theme === "studio" ? "#D8D5D0" : "#3A3A38";
  return (
    <mesh
      visible={visible}
      position={[cx, y, cz]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}
