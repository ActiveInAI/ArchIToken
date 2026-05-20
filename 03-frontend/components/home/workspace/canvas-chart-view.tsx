"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { FloorplanRenderer, type Floorplan } from "@/lib/insome/floorplan";
import { InfiniteCanvas, StaticSvgNode, type CanvasLabels } from "@/lib/insome/canvas";
import { getVariantById } from "@/content/floorplan-variants.home";
import { useFloorplanStore } from "@/stores/floorplan.store";
import { useCanvasViewStore } from "@/stores/canvas-view.store";

/** Fixed canvas-space dimensions for the single floorplan node.
 * Matches the prototype's preferred display size (720 × 484) and the
 * FloorplanRenderer's 580×390 viewBox aspect. */
const NODE_WIDTH = 720;
const NODE_HEIGHT = 484;

export function CanvasChartView() {
  const t = useTranslations();
  const tControls = useTranslations("home.canvas.controls");
  const tMini = useTranslations("home.canvas.miniMap");
  const { currentVariantId, selectedRoomId, scheme, roomOverrides, selectRoom } = useFloorplanStore();
  const { chartView, setChartView } = useCanvasViewStore();

  const base = getVariantById(currentVariantId);

  const floorplan: Floorplan | undefined = useMemo(() => {
    if (!base) return undefined;
    if (Object.keys(roomOverrides).length === 0) return base;
    return {
      ...base,
      rooms: base.rooms.map((room) => {
        const override = roomOverrides[room.id];
        if (!override) return room;
        return {
          ...room,
          ...(override.color ? { color: override.color } : {}),
          ...(override.material ? { material: override.material } : {}),
          ...(override.grade ? { grade: override.grade } : {}),
        };
      }),
    };
  }, [base, roomOverrides]);

  const labels: CanvasLabels = {
    zoomIn: tControls("zoomIn"),
    zoomOut: tControls("zoomOut"),
    fitView: tControls("fitView"),
    resetZoom: tControls("resetZoom"),
    miniMap: tMini("ariaLabel"),
  };

  if (!floorplan) return null;

  return (
    <InfiniteCanvas
      theme="home"
      showMiniMap
      showControls
      showGrid
      fitViewOnInit
      initialViewState={chartView}
      onViewStateChange={setChartView}
      labels={labels}
    >
      <StaticSvgNode
        id="home-floorplan"
        position={{ x: 0, y: 0 }}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
      >
        <div style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}>
          <FloorplanRenderer
            floorplan={floorplan}
            selectedRoomId={selectedRoomId}
            scheme={scheme}
            theme="home"
            showDimensions={selectedRoomId !== null}
            translator={(key) => t(key)}
            onRoomSelect={selectRoom}
            className="h-full w-full"
          />
        </div>
      </StaticSvgNode>
    </InfiniteCanvas>
  );
}
