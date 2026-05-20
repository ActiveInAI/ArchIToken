"use client";

import type { ReactElement } from "react";
import type { SceneOpening, SceneTheme } from "../types";

export interface OpeningsProps {
  readonly openings: ReadonlyArray<SceneOpening>;
  readonly theme: SceneTheme;
  readonly selectedOpeningId?: string | null;
  readonly onClick?: (openingId: string) => void;
}

export function Openings({ openings, theme, selectedOpeningId, onClick }: OpeningsProps): ReactElement {
  return (
    <group>
      {openings.map((o) => (
        <OpeningMesh
          key={o.id}
          opening={o}
          theme={theme}
          selected={selectedOpeningId === o.id}
          onClick={onClick}
        />
      ))}
    </group>
  );
}

function OpeningMesh({
  opening,
  theme,
  selected,
  onClick,
}: {
  opening: SceneOpening;
  theme: SceneTheme;
  selected: boolean;
  onClick?: ((id: string) => void) | undefined;
}) {
  const { position, direction, width, height, type, swing, sillHeight } = opening;
  const rotY = Math.atan2(direction.z, direction.x);
  const accent = theme === "studio" ? "#D4FF3A" : "#FF4B1F";
  // Phase 4.0 fix: opening trim contrasts with bg.
  // Studio dark bg → light grey; Home light bg → dark grey.
  const baseColor = theme === "studio" ? "#B5B0A6" : "#4A4A4A";
  const color = selected ? accent : baseColor;

  if (type === "opening") {
    return (
      <group
        position={[position.x, (sillHeight + height) / 2, position.z]}
        rotation={[0, -rotY, 0]}
        userData={{ kind: "opening", id: opening.id }}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(opening.id);
        }}
      >
        <mesh visible={false}>
          <boxGeometry args={[width, height, 2]} />
          <meshBasicMaterial />
        </mesh>
      </group>
    );
  }

  if (type === "window") {
    return (
      <group
        position={[position.x, position.y, position.z]}
        rotation={[0, -rotY, 0]}
        userData={{ kind: "opening", id: opening.id }}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(opening.id);
        }}
      >
        <mesh>
          <boxGeometry args={[width, height, 0.5]} />
          <meshStandardMaterial color={color} transparent opacity={0.3} depthWrite={false} />
        </mesh>
        <WindowFrame width={width} height={height} color={color} />
      </group>
    );
  }

  const hingeOffset = swing === "left" ? -width / 2 : width / 2;
  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[0, -rotY, 0]}
      userData={{ kind: "opening", id: opening.id }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(opening.id);
      }}
    >
      <group position={[hingeOffset, 0, 0]}>
        <mesh
          position={[swing === "left" ? width / 2 : -width / 2, 0, 0]}
          rotation={[0, swing === "right" ? -0.35 : 0.35, 0]}
        >
          <boxGeometry args={[width, height, 1]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

function WindowFrame({ width, height, color }: { width: number; height: number; color: string }) {
  const t = 0.6;
  return (
    <group>
      <mesh position={[0, height / 2 - t / 2, 0]}>
        <boxGeometry args={[width, t, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, -height / 2 + t / 2, 0]}>
        <boxGeometry args={[width, t, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-width / 2 + t / 2, 0, 0]}>
        <boxGeometry args={[t, height, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[width / 2 - t / 2, 0, 0]}>
        <boxGeometry args={[t, height, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}
