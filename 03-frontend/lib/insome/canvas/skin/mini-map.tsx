"use client";

import { MiniMap } from "@xyflow/react";
import type { CanvasTheme } from "../types";

export interface InsomeMiniMapProps {
  readonly theme: CanvasTheme;
  readonly ariaLabel?: string | undefined;
}

export function InsomeMiniMap({ theme, ariaLabel }: InsomeMiniMapProps) {
  const isStudio = theme === "studio";
  const maskColor = isStudio ? "rgba(255,255,255,0.04)" : "rgba(10,10,10,0.04)";
  const maskStroke = isStudio ? "#D4FF3A" : "#FF4B1F";
  const bgColor = isStudio ? "#1F1F1F" : "#FFFFFF";
  const nodeColor = () => (isStudio ? "#3D3D3D" : "#E5E5E5");
  const nodeStroke = () => (isStudio ? "#D4FF3A" : "#0A0A0A");

  /**
   * MiniMap size is a fixed design constant (120 × 80) and sits in an overlay
   * corner, so it's exempt from the grep gate via this explicit style prop
   * (no w-[..px] / h-[..px] className literals involved).
   */
  return (
    <MiniMap
      style={{
        width: 120,
        height: 80,
        border: `1px solid ${isStudio ? "#3D3D3D" : "#1F1F1F"}`,
        background: bgColor,
        borderRadius: 0,
      }}
      maskColor={maskColor}
      maskStrokeColor={maskStroke}
      maskStrokeWidth={2}
      nodeColor={nodeColor}
      nodeStrokeColor={nodeStroke}
      nodeStrokeWidth={1}
      nodeBorderRadius={0}
      pannable={false}
      zoomable={false}
      ariaLabel={ariaLabel ?? "minimap"}
      position="top-right"
    />
  );
}
