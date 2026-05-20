"use client";

/**
 * Home-only 3D hover feedback. State lives here in a React useState, NEVER in
 * any store — Home is read-only by principle 9. Consumer renders this above
 * the mesh layer and reads `hoveredId` to tint the right element.
 *
 * Phase 2.75 scope: just expose hook + SelectionHighlight3D-like API. The tint
 * effect is implemented via a scale-up + emissive bump in the consuming
 * component when their meshes match hoveredId.
 */

import { useState, useCallback } from "react";
import type { SceneClickTarget } from "../types";

export function useLocalSceneHover() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const onObjectHover = useCallback(
    (target: SceneClickTarget | null) => {
      setHoveredId(target ? target.id : null);
    },
    [],
  );

  return { hoveredId, onObjectHover };
}
