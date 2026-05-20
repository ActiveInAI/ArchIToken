"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { getVariantById } from "@/content/floorplan-variants.home";
import { useFloorplanStore } from "@/stores/floorplan.store";
import { useCanvasViewStore } from "@/stores/canvas-view.store";
import { CameraToolbar } from "@/components/scene/camera-toolbar";
import { SceneLoadingFallback } from "@/components/scene/scene-loading-fallback";
import { ErrorBoundary } from "@/components/shared/error-boundary";

const SceneView = dynamic(
  () => import("@/lib/insome/scene").then((m) => ({ default: m.SceneView })),
  { ssr: false, loading: () => <SceneLoadingFallback /> },
);

export function CanvasRenderView() {
  const t = useTranslations("scene");
  const currentVariantId = useFloorplanStore((s) => s.currentVariantId);
  const roomOverrides = useFloorplanStore((s) => s.roomOverrides);
  const camera = useCanvasViewStore((s) => s.homeRenderCamera);
  const setCamera = useCanvasViewStore((s) => s.setHomeRenderCamera);
  const resetCamera = useCanvasViewStore((s) => s.resetHomeCamera);
  const [fitSignal, setFitSignal] = useState(0);

  const base = getVariantById(currentVariantId);
  const floorplan = useMemo(() => {
    if (!base) return undefined;
    if (Object.keys(roomOverrides).length === 0) return base;
    return {
      ...base,
      rooms: base.rooms.map((room) => {
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
  }, [base, roomOverrides]);

  if (!floorplan) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-fg-8 font-mono text-micro text-fg-4">
        {t("emptyFloorplan")}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-fg-8">
      <CameraToolbar
        theme="home"
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
          theme="home"
          enableHover
          initialCameraPreset={camera.preset}
          onCameraChange={setCamera}
        />
      </ErrorBoundary>
    </div>
  );
}
