"use client";

import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { FloorplanEditorOverlay, FloorplanRenderer, type Floorplan } from "@/lib/insome/floorplan";
import { isCreationMode } from "@/lib/insome/floorplan/edit";
import { InfiniteCanvas, StaticSvgNode, type CanvasLabels } from "@/lib/insome/canvas";
import type { Point, SnapResult } from "@/lib/insome/geom";
import { useActiveFloorplan } from "@/lib/proposal/use-active-floorplan";
import { useStudioEditorStore } from "@/stores/studio-editor.store";
import { useSnapSolver } from "@/hooks/studio/use-snap-solver";
import { useDragGesture } from "@/hooks/studio/use-drag-gesture";
import { useCreationGesture } from "@/hooks/studio/use-creation-gesture";

const NODE_WIDTH = 720;
const NODE_HEIGHT = 484;

export function Canvas2DView() {
  const t = useTranslations();
  const tControls = useTranslations("studio.canvas.controls");
  const tMini = useTranslations("studio.canvas.miniMap");

  const base = useActiveFloorplan();
  const selection = useStudioEditorStore((s) => s.selection);
  const scheme = useStudioEditorStore((s) => s.scheme);
  const showMeasurements = useStudioEditorStore((s) => s.showMeasurements);
  const showGrid = useStudioEditorStore((s) => s.showGrid);
  const canvas2dView = useStudioEditorStore((s) => s.canvas2dView);
  const roomOverrides = useStudioEditorStore((s) => s.roomOverrides);
  const activeFloorplan = useStudioEditorStore((s) => s.activeFloorplan);
  const setActiveFloorplan = useStudioEditorStore((s) => s.setActiveFloorplan);
  const setSelection = useStudioEditorStore((s) => s.setSelection);
  const setCanvas2dView = useStudioEditorStore((s) => s.setCanvas2dView);
  const getEditMode = useStudioEditorStore((s) => s.getEditMode);

  useEffect(() => {
    if (base && (!activeFloorplan || activeFloorplan.id !== base.id)) {
      setActiveFloorplan(base);
    }
  }, [base, activeFloorplan, setActiveFloorplan]);

  const floorplan: Floorplan | undefined = useMemo(() => {
    const src = activeFloorplan ?? base;
    if (!src) return undefined;
    if (Object.keys(roomOverrides).length === 0) return src;
    return {
      ...src,
      rooms: src.rooms.map((room) => {
        const o = roomOverrides[room.id];
        if (!o) return room;
        return {
          ...room,
          ...(o.color ? { color: o.color } : {}),
          ...(o.material ? { material: o.material } : {}),
          ...(o.grade ? { grade: o.grade } : {}),
        };
      }),
    };
  }, [activeFloorplan, base, roomOverrides]);

  const editMode = getEditMode();
  const wallThickness = useStudioEditorStore((s) => s.wallThickness);
  const creationSession = useStudioEditorStore((s) => s.creationSession);
  const baseSnapSolver = useSnapSolver(floorplan ?? null, canvas2dView.zoom);

  const creationSnapSolver = useCallback(
    (input: { point: Point; wallCreationMode: boolean; openingMode: boolean }): SnapResult => {
      if (input.openingMode) {
        return baseSnapSolver({ point: input.point, mode: "creation-opening" });
      }
      return baseSnapSolver({ point: input.point });
    },
    [baseSnapSolver],
  );

  const { onPointerDownHit, onPointerMoveWorld, onPointerUpWorld, dragStart, dragCurrent, snapResult } =
    useDragGesture({
      floorplan: floorplan ?? null,
      editMode,
      snapSolver: (input) => baseSnapSolver(input),
      onInvalid: (reasonKey) => toast(t(reasonKey)),
    });

  const creationGesture = useCreationGesture({
    floorplan: floorplan ?? null,
    editMode,
    snapSolver: creationSnapSolver,
    endpointRadiusWorld: 10 / Math.max(canvas2dView.zoom, 0.01),
    segmentRadiusWorld: 8 / Math.max(canvas2dView.zoom, 0.01),
    wallThickness,
    defaultRoomLabelKey: "rooms.livingRoom",
    translator: (key) => t(key),
  });

  const inCreationMode = isCreationMode(editMode);
  const effectiveSnapResult = inCreationMode ? creationSession?.snapResult ?? null : snapResult;

  const labels: CanvasLabels = {
    zoomIn: tControls("zoomIn"),
    zoomOut: tControls("zoomOut"),
    fitView: tControls("fitView"),
    resetZoom: tControls("resetZoom"),
    miniMap: tMini("ariaLabel"),
  };

  if (!floorplan) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-fg-1 font-mono text-micro text-fg-4">
        {t("studio.canvas.empty")}
      </div>
    );
  }

  const cursor = editMode === "none" ? "" : "cursor-crosshair";

  return (
    <div
      className={`h-full w-full ${cursor}`}
      role="application"
      aria-label={t("a11y.canvas.2d.label")}
      tabIndex={0}
    >
      <InfiniteCanvas
        theme="studio"
        showMiniMap
        showControls
        showGrid={showGrid}
        fitViewOnInit
        initialViewState={canvas2dView}
        onViewStateChange={setCanvas2dView}
        labels={labels}
      >
        <StaticSvgNode
          id="studio-floorplan"
          position={{ x: 0, y: 0 }}
          width={NODE_WIDTH}
          height={NODE_HEIGHT}
        >
          <div className="relative" style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}>
            <FloorplanRenderer
              floorplan={floorplan}
              selectedRoomId={selection?.kind === "room" ? selection.id : null}
              scheme={scheme}
              theme="studio"
              showDimensions={showMeasurements && selection?.kind === "room"}
              translator={(key) => t(key)}
              className="h-full w-full"
            />
            <FloorplanEditorOverlay
              floorplan={floorplan}
              selection={selection}
              editMode={editMode}
              viewBox={floorplan.viewBox}
              zoom={canvas2dView.zoom}
              snapResult={effectiveSnapResult}
              dragStart={dragStart}
              dragCurrent={dragCurrent}
              creationSession={creationSession}
              onSelectionChange={setSelection}
              onPointerDownHit={(hit, evt) => {
                if (inCreationMode) {
                  const world = hit.worldPoint;
                  creationGesture.onPointerDownHit(hit, world);
                  evt.stopPropagation();
                } else {
                  onPointerDownHit(hit);
                }
              }}
              onPointerMoveWorld={(p) => {
                if (inCreationMode) creationGesture.onPointerMoveWorld(p);
                else onPointerMoveWorld(p);
              }}
              onPointerUpWorld={(p) => {
                if (!inCreationMode) onPointerUpWorld(p);
              }}
            />
          </div>
        </StaticSvgNode>
      </InfiniteCanvas>
    </div>
  );
}
