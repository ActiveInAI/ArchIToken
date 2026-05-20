"use client";

import { useMemo, useState, type ReactElement } from "react";
import { Canvas } from "@react-three/fiber";
import type { Floorplan } from "@/lib/insome/floorplan";
import { sceneFromFloorplan } from "../derive";
import { useLocalSceneHover } from "./hover-highlight";
import type {
  CameraPreset,
  CameraState,
  SceneClickTarget,
  SceneSelection,
  SceneTheme,
} from "../types";
import { CameraControls } from "../camera/controls";
import { DefaultLightingRig } from "../lighting/default-rig";
import { Floor } from "./floor";
import { Walls } from "./walls";
import { Openings } from "./openings";
import { Roof } from "./roof";
import { SelectionHighlight3D } from "./selection-highlight";

export interface SceneViewProps {
  readonly floorplan: Floorplan;
  readonly theme: SceneTheme;
  readonly selection?: SceneSelection;
  readonly onObjectClick?: (target: SceneClickTarget) => void;
  readonly initialCameraPreset?: CameraPreset;
  readonly onCameraChange?: (state: CameraState) => void;
  readonly includeRoof?: boolean;
  readonly className?: string;
  /** Phase 2.75: Home-only flag to enable local hover feedback (cursor + tint).
   *  State lives in a local useState — never touches any store. */
  readonly enableHover?: boolean;
}

export function SceneView({
  floorplan,
  theme,
  selection = null,
  onObjectClick,
  initialCameraPreset = "iso",
  onCameraChange,
  includeRoof = true,
  className,
  enableHover = false,
}: SceneViewProps): ReactElement {
  const scene = useMemo(() => sceneFromFloorplan(floorplan, { theme }), [floorplan, theme]);
  const { hoveredId, onObjectHover } = useLocalSceneHover();
  const [cursor, setCursor] = useState<"auto" | "pointer">("auto");

  const selectedWallId = selection?.kind === "wall" ? selection.id : null;
  const selectedRoomId = selection?.kind === "room" ? selection.id : null;
  const selectedOpeningId = selection?.kind === "opening" ? selection.id : null;

  const handleWallClick = (id: string) => onObjectClick?.({ kind: "wall", id });
  const handleRoomClick = (id: string) => onObjectClick?.({ kind: "room", id });
  const handleOpeningClick = (id: string) => onObjectClick?.({ kind: "opening", id });

  const roofVisible = includeRoof && initialCameraPreset !== "top";

  // Phase 2.75 Home-only hover: single-pass "something is hovered" cursor +
  // optional id capture. Visual tint is a L2 concern; keeping it simple avoids
  // per-mesh hover state churn.
  const hoverHandlers = enableHover
    ? {
        onPointerOver: () => setCursor("pointer"),
        onPointerOut: () => {
          setCursor("auto");
          onObjectHover(null);
        },
      }
    : {};
  void hoveredId;

  return (
    <div
      className={className}
      style={{ width: "100%", height: "100%", cursor }}
      {...hoverHandlers}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 50, near: 1, far: 10000, position: [200, 200, 200] }}
      >
        <DefaultLightingRig />
        <CameraControls
          preset={initialCameraPreset}
          bounds={scene.bounds}
          {...(onCameraChange ? { onCameraChange } : {})}
        />
        <Floor
          rooms={scene.rooms}
          theme={theme}
          selectedRoomId={selectedRoomId}
          {...(onObjectClick ? { onClick: handleRoomClick } : {})}
        />
        <Walls
          walls={scene.walls}
          theme={theme}
          selectedWallId={selectedWallId}
          {...(onObjectClick ? { onClick: handleWallClick } : {})}
        />
        <Openings
          openings={scene.openings}
          theme={theme}
          selectedOpeningId={selectedOpeningId}
          {...(onObjectClick ? { onClick: handleOpeningClick } : {})}
        />
        <Roof bounds={scene.bounds} theme={theme} visible={roofVisible} />
        <SelectionHighlight3D selection={selection} scene={scene} theme={theme} />
      </Canvas>
    </div>
  );
}
