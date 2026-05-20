"use client";

// LEGACY(phase-4.0): Two-Click creation gesture — not exposed in demo UI.
// Code preserved for the future deep-design phase when creation tools return.
import { useCallback } from "react";
import type { Point, SnapResult } from "@/lib/insome/geom";
import type { Floorplan } from "@/lib/insome/floorplan";
import type { EditMode, HitTestResult } from "@/lib/insome/floorplan/edit";
import { hitTest } from "@/lib/insome/floorplan/edit";
import { useStudioEditorStore } from "@/stores/studio-editor.store";
import {
  commitCreateOpening,
  commitCreateRoomRect,
  commitCreateWall,
} from "./creation-commits";

export type CreationSnapSolver = (input: {
  point: Point;
  wallCreationMode: boolean;
  openingMode: boolean;
}) => SnapResult;

export function useCreationGesture(params: {
  floorplan: Floorplan | null;
  editMode: EditMode;
  snapSolver: CreationSnapSolver;
  endpointRadiusWorld: number;
  segmentRadiusWorld: number;
  wallThickness: number;
  defaultRoomLabelKey: string;
  translator: (key: string) => string;
}) {
  const {
    floorplan,
    editMode,
    snapSolver,
    endpointRadiusWorld,
    segmentRadiusWorld,
    wallThickness,
    defaultRoomLabelKey,
    translator,
  } = params;

  const session = useStudioEditorStore((s) => s.creationSession);
  const updateCreation = useStudioEditorStore((s) => s.updateCreation);
  const commitCreation = useStudioEditorStore((s) => s.commitCreation);
  const pushCmd = useStudioEditorStore((s) => s.pushCommand);
  const selection = useStudioEditorStore((s) => s.selection);

  const onPointerMoveWorld = useCallback(
    (p: Point) => {
      if (!session) return;
      const wallCreationMode = editMode === "create-wall" || editMode === "create-room-rect";
      const openingMode = isOpeningMode(editMode);
      const snap = snapSolver({ point: p, wallCreationMode, openingMode });
      updateCreation({ currentPoint: snap.point, snapResult: snap });
    },
    [session, editMode, snapSolver, updateCreation],
  );

  const onPointerDownWorld = useCallback(
    (p: Point) => {
      if (!floorplan || !session) return;
      const wallCreationMode = editMode === "create-wall" || editMode === "create-room-rect";
      const openingMode = isOpeningMode(editMode);
      const snap = snapSolver({ point: p, wallCreationMode, openingMode });
      const snapped = snap.point;
      if (editMode === "create-wall") {
        if (!session.startPoint) {
          updateCreation({ startPoint: snapped, currentPoint: snapped, snapResult: snap });
          return;
        }
        commitCreateWall(floorplan, session.startPoint, snapped, wallThickness, selection, pushCmd, translator);
        commitCreation();
        return;
      }
      if (editMode === "create-room-rect") {
        if (!session.startPoint) {
          updateCreation({ startPoint: snapped, currentPoint: snapped, snapResult: snap });
          return;
        }
        commitCreateRoomRect(session.startPoint, snapped, wallThickness, defaultRoomLabelKey, selection, pushCmd, translator);
        commitCreation();
        return;
      }
      if (openingMode) {
        const hit = hitTest(floorplan, p, endpointRadiusWorld, segmentRadiusWorld);
        const wallId =
          hit.target.kind === "wall-segment" ? hit.target.wallId
            : hit.target.kind === "wall-endpoint" ? hit.target.wallId
              : null;
        if (!wallId) return;
        const wall = floorplan.walls.find((w) => w.id === wallId);
        if (!wall) return;
        commitCreateOpening(wall, snap.point, editMode, floorplan.openings, selection, pushCmd, translator);
        commitCreation();
      }
    },
    [
      floorplan,
      session,
      editMode,
      snapSolver,
      updateCreation,
      commitCreation,
      pushCmd,
      selection,
      wallThickness,
      defaultRoomLabelKey,
      endpointRadiusWorld,
      segmentRadiusWorld,
      translator,
    ],
  );

  const onPointerDownHit = useCallback(
    (_hit: HitTestResult, worldPoint: Point) => onPointerDownWorld(worldPoint),
    [onPointerDownWorld],
  );

  return { onPointerMoveWorld, onPointerDownHit, session };
}

function isOpeningMode(mode: EditMode): boolean {
  return mode === "create-opening-door" || mode === "create-opening-window" || mode === "create-opening-plain";
}
