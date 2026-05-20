"use client";

import { useCallback } from "react";
import type { SceneClickTarget, SceneSelection } from "@/lib/insome/scene";
import { useStudioEditorStore } from "@/stores/studio-editor.store";

/**
 * Studio-only bridge between 2D edit store and 3D SceneView.
 *
 * Reads: selection from studio-editor.store.ts (the single source of truth).
 * Writes: on 3D click, dispatches setSelection to the store.
 *
 * Home does NOT use this hook — Home has no selection concept (principle 9).
 */
export function useSceneSelectionSync(): {
  selection: SceneSelection;
  onObjectClick: (target: SceneClickTarget) => void;
} {
  const selection = useStudioEditorStore((s) => s.selection);
  const setSelection = useStudioEditorStore((s) => s.setSelection);

  const onObjectClick = useCallback(
    (target: SceneClickTarget) => {
      setSelection({ kind: target.kind, id: target.id });
    },
    [setSelection],
  );

  return { selection, onObjectClick };
}
