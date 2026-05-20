"use client";

import type { Scene3D, SceneSelection, SceneTheme } from "../types";

export interface SelectionHighlight3DProps {
  readonly selection: SceneSelection;
  readonly scene: Scene3D;
  readonly theme: SceneTheme;
}

/**
 * L1 strategy: selected mesh's own material already goes lime/signal in the
 * base mesh component (Walls/Floor/Openings handle `selected` prop). This
 * component adds an axis-aligned box outline around the selected element so
 * users can find it from any camera angle.
 */
export function SelectionHighlight3D({ selection, scene, theme }: SelectionHighlight3DProps) {
  if (!selection) return null;
  const color = theme === "studio" ? "#D4FF3A" : "#FF4B1F";
  const box = resolveBox(selection, scene);
  if (!box) return null;
  const { center, size } = box;
  return (
    <mesh position={center}>
      <boxGeometry args={[size[0] + 2, size[1] + 2, size[2] + 2]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.6} />
    </mesh>
  );
}

function resolveBox(
  sel: SceneSelection,
  scene: Scene3D,
): { center: [number, number, number]; size: [number, number, number] } | null {
  if (!sel) return null;
  if (sel.kind === "wall") {
    const w = scene.walls.find((x) => x.id === sel.id);
    if (!w) return null;
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const seg of w.segments) {
      for (const p of [seg.a, seg.b]) {
        if (p.x < minX) minX = p.x;
        if (p.z < minZ) minZ = p.z;
        if (p.x > maxX) maxX = p.x;
        if (p.z > maxZ) maxZ = p.z;
      }
    }
    if (!Number.isFinite(minX)) return null;
    return {
      center: [(minX + maxX) / 2, w.height / 2, (minZ + maxZ) / 2],
      size: [maxX - minX, w.height, Math.max(maxZ - minZ, w.thickness)],
    };
  }
  if (sel.kind === "room") {
    const r = scene.rooms.find((x) => x.id === sel.id);
    if (!r || r.polygon.length < 3) return null;
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const p of r.polygon) {
      if (p.x < minX) minX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.x > maxX) maxX = p.x;
      if (p.z > maxZ) maxZ = p.z;
    }
    return {
      center: [(minX + maxX) / 2, 0.5, (minZ + maxZ) / 2],
      size: [maxX - minX, 1, maxZ - minZ],
    };
  }
  if (sel.kind === "opening") {
    const o = scene.openings.find((x) => x.id === sel.id);
    if (!o) return null;
    return {
      center: [o.position.x, o.position.y, o.position.z],
      size: [o.width + 2, o.height + 2, 3],
    };
  }
  return null;
}
