"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useStudioEditorStore } from "@/stores/studio-editor.store";
import { useCanvasViewStore } from "@/stores/canvas-view.store";
import { useSceneSelectionSync } from "@/lib/scene/use-scene-selection-sync";
import { CameraToolbar } from "@/components/scene/camera-toolbar";
import { SceneLoadingFallback } from "@/components/scene/scene-loading-fallback";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { PerfOverlay } from "../perf-overlay";

const SceneView = dynamic(
  () => import("@/lib/insome/scene").then((m) => ({ default: m.SceneView })),
  { ssr: false, loading: () => <SceneLoadingFallback /> },
);

export function Canvas3DView() {
  const t = useTranslations("scene");
  const ta11y = useTranslations("a11y.canvas.3d");
  const floorplan = useStudioEditorStore((s) => s.activeFloorplan);
  const camera = useCanvasViewStore((s) => s.studio3dCamera);
  const setCamera = useCanvasViewStore((s) => s.setStudio3dCamera);
  const resetCamera = useCanvasViewStore((s) => s.resetStudio3dCamera);
  const { selection, onObjectClick } = useSceneSelectionSync();
  const [fitSignal, setFitSignal] = useState(0);

  if (!floorplan) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-fg-1 font-mono text-micro text-fg-4">
        {t("emptyFloorplan")}
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full bg-fg-1"
      role="img"
      aria-label={ta11y("label")}
      tabIndex={0}
    >
      <PerfOverlay />
      <CameraToolbar
        theme="studio"
        preset={camera.preset}
        onPresetChange={(p) => setCamera({ ...camera, preset: p })}
        onFitView={() => {
          resetCamera();
          setFitSignal((n) => n + 1);
        }}
      />
      <ErrorBoundary scope="scene">
        <SceneView
          key={`${floorplan.id}-${fitSignal}`}
          floorplan={floorplan}
          theme="studio"
          selection={selection}
          onObjectClick={onObjectClick}
          initialCameraPreset={camera.preset}
          onCameraChange={setCamera}
        />
      </ErrorBoundary>
    </div>
  );
}
