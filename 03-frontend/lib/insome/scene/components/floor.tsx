"use client";

import { useMemo, type ReactElement } from "react";
import * as THREE from "three";
import type { SceneRoom, SceneTheme } from "../types";

export interface FloorProps {
  readonly rooms: ReadonlyArray<SceneRoom>;
  readonly theme: SceneTheme;
  readonly selectedRoomId?: string | null;
  readonly onClick?: (roomId: string) => void;
}

export function Floor({ rooms, theme, selectedRoomId, onClick }: FloorProps): ReactElement {
  return (
    <group>
      {rooms.map((r) => (
        <RoomFloor
          key={r.id}
          room={r}
          theme={theme}
          selected={selectedRoomId === r.id}
          onClick={onClick}
        />
      ))}
    </group>
  );
}

function RoomFloor({
  room,
  theme,
  selected,
  onClick,
}: {
  room: SceneRoom;
  theme: SceneTheme;
  selected: boolean;
  onClick?: ((roomId: string) => void) | undefined;
}) {
  const geometry = useMemo(() => buildFloorGeometry(room.polygon), [room.polygon]);
  if (!geometry) return null;
  const base = room.floorColor;
  const accent = theme === "studio" ? "#D4FF3A" : "#FF4B1F";
  const color = selected ? accent : base;
  return (
    <mesh
      position={[0, -0.05, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={geometry}
      userData={{ kind: "room", id: room.id }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(room.id);
      }}
    >
      <meshStandardMaterial color={color} roughness={0.9} metalness={0.05} />
    </mesh>
  );
}

function buildFloorGeometry(polygon: ReadonlyArray<{ x: number; z: number }>): THREE.ShapeGeometry | null {
  if (polygon.length < 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(polygon[0]!.x, polygon[0]!.z);
  for (let i = 1; i < polygon.length; i++) {
    shape.lineTo(polygon[i]!.x, polygon[i]!.z);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}
