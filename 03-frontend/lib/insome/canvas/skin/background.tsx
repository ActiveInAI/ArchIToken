"use client";

import { Background, BackgroundVariant } from "@xyflow/react";
import type { CanvasTheme } from "../types";

export interface InsomeBackgroundProps {
  readonly theme: CanvasTheme;
}

/**
 * Dotted pattern background, matching the INSOME prototype's chart view.
 * Density: 20px gap, 1px dots — tweak the `gap` prop below to change
 * grid density globally.
 */
export function InsomeBackground({ theme }: InsomeBackgroundProps) {
  const color = theme === "studio" ? "#3D3D3D" : "#E5E5E5";
  return (
    <Background
      variant={BackgroundVariant.Dots}
      gap={20}
      size={1}
      color={color}
      className="insome-canvas-bg"
    />
  );
}
