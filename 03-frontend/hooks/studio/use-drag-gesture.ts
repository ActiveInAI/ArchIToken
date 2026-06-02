"use client";

import { useCallback, useRef } from "react";
import type { Floorplan, Point } from "@/lib/insome/floorplan";
import type { HitTestResult, SelectionRef } from "@/lib/insome/floorplan/edit";
import type { SnapResult } from "@/lib/insome/geom";
import {
  useStudioEditorStore,
  type DragSession,
} from "@/stores/studio-editor.store";
import { buildDragCommand } from "./build-drag-command";

interface DragGestureReturn {
  onPointerDownHit: (hit: HitTestResult) => void;
  onPointerMoveWorld: (p: Point) => void;
  onPointerUpWorld: (p: Point) => void;
  dragStart: Point | null;
  dragCurrent: Point | null;
  snapResult: SnapResult | null;
}

import type { EditMode } from "@/lib/insome/floorplan/edit";

export function useDragGesture(params: {
  floorplan: Floorplan | null;
  editMode: EditMode;
  snapSolver: (input: {
    point: Point;
    ignoreWallIds?: ReadonlySet<string>;
    ignoreEndpoints?: ReadonlyArray<{ wallId: string; end: "a" | "b" }>;
  }) => SnapResult;
  onInvalid: (reasonKey: string) => void;
}): DragGestureReturn {
  const { floorplan, editMode, snapSolver, onInvalid } = params;
  const startDrag = useStudioEditorStore((s) => s.startDrag);
  const updateDrag = useStudioEditorStore((s) => s.updateDrag);
  const endDrag = useStudioEditorStore((s) => s.endDrag);
  const dragSession = useStudioEditorStore((s) => s.dragSession);
  const pushCmd = useStudioEditorStore((s) => s.pushCommand);

  const selectionSnapshotRef = useRef<SelectionRef>(null);

  const onPointerDownHit = useCallback(
    (hit: HitTestResult) => {
      if (editMode !== "wall" && editMode !== "room") return;
      if (!floorplan) return;
      if (editMode === "wall") {
        if (hit.target.kind === "wall-endpoint") {
          selectionSnapshotRef.current = {
            kind: "wall",
            id: hit.target.wallId,
          };
          startDrag({
            kind: "wall-endpoint",
            startWorldPoint: hit.worldPoint,
            currentWorldPoint: hit.worldPoint,
            snapResult: null,
            wallId: hit.target.wallId,
            end: hit.target.end,
          });
          return;
        }
        if (hit.target.kind === "wall-segment") {
          selectionSnapshotRef.current = {
            kind: "wall",
            id: hit.target.wallId,
          };
          startDrag({
            kind: "wall-segment",
            startWorldPoint: hit.worldPoint,
            currentWorldPoint: hit.worldPoint,
            snapResult: null,
            wallId: hit.target.wallId,
          });
          return;
        }
      }
      if (editMode === "room" && hit.target.kind === "room") {
        selectionSnapshotRef.current = { kind: "room", id: hit.target.roomId };
        startDrag({
          kind: "room",
          startWorldPoint: hit.worldPoint,
          currentWorldPoint: hit.worldPoint,
          snapResult: null,
          roomId: hit.target.roomId,
        });
      }
    },
    [editMode, floorplan, startDrag],
  );

  const onPointerMoveWorld = useCallback(
    (p: Point) => {
      const session: DragSession | null =
        useStudioEditorStore.getState().dragSession;
      if (!session || !floorplan) return;
      if (session.kind === "wall-endpoint" && session.wallId && session.end) {
        const snap = snapSolver({
          point: p,
          ignoreEndpoints: [{ wallId: session.wallId, end: session.end }],
        });
        updateDrag({ currentWorldPoint: snap.point, snapResult: snap });
      } else if (session.kind === "wall-segment" && session.wallId) {
        const snap = snapSolver({
          point: p,
          ignoreWallIds: new Set([session.wallId]),
        });
        updateDrag({ currentWorldPoint: snap.point, snapResult: snap });
      } else if (session.kind === "room" && session.roomId) {
        const room = floorplan.rooms.find((r) => r.id === session.roomId);
        const ignoreSet = new Set(room?.wallIds ?? []);
        const snap = snapSolver({ point: p, ignoreWallIds: ignoreSet });
        updateDrag({ currentWorldPoint: snap.point, snapResult: snap });
      }
    },
    [snapSolver, updateDrag, floorplan],
  );

  const onPointerUpWorld = useCallback(() => {
    const session = useStudioEditorStore.getState().dragSession;
    if (!session || !floorplan) return;
    const snapshot = selectionSnapshotRef.current;
    const cmd = buildDragCommand(session, floorplan, snapshot, onInvalid);
    endDrag(cmd !== null);
    if (cmd) pushCmd(cmd);
    selectionSnapshotRef.current = null;
  }, [floorplan, endDrag, pushCmd, onInvalid]);

  return {
    onPointerDownHit,
    onPointerMoveWorld,
    onPointerUpWorld,
    dragStart: dragSession ? dragSession.startWorldPoint : null,
    dragCurrent: dragSession ? dragSession.currentWorldPoint : null,
    snapResult: dragSession?.snapResult ?? null,
  };
}
