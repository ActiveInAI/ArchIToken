"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { ComponentRef } from "react";
import type { Bounds3D, CameraPreset, CameraState } from "../types";
import { getCameraPreset } from "./presets";
import { useCameraTransition } from "../components/camera-transition";

type OrbitControlsRef = ComponentRef<typeof OrbitControls>;

export interface CameraControlsProps {
  readonly preset: CameraPreset;
  readonly bounds: Bounds3D;
  readonly onCameraChange?: (state: CameraState) => void;
}

export function CameraControls({ preset, bounds, onCameraChange }: CameraControlsProps) {
  const controlsRef = useRef<OrbitControlsRef | null>(null);
  const camera = useThree((s) => s.camera);
  const lastPresetRef = useRef<CameraPreset | null>(null);
  const transition = useCameraTransition(controlsRef.current);

  useEffect(() => {
    const r = getCameraPreset(preset, bounds);
    if (lastPresetRef.current === null) {
      camera.position.set(r.position[0], r.position[1], r.position[2]);
      camera.lookAt(r.target[0], r.target[1], r.target[2]);
      if (controlsRef.current) {
        controlsRef.current.target.set(r.target[0], r.target[1], r.target[2]);
        controlsRef.current.update();
      }
      lastPresetRef.current = preset;
      onCameraChange?.({ preset, position: r.position, target: r.target });
      return;
    }
    if (lastPresetRef.current === preset) return;
    // Phase 2.75: animate preset ↔ preset transitions over 800ms.
    transition.animateTo(
      { position: r.position, target: r.target },
      () => onCameraChange?.({ preset, position: r.position, target: r.target }),
    );
    lastPresetRef.current = preset;
  }, [preset, bounds, camera, onCameraChange, transition]);

  const handleChange = () => {
    if (!controlsRef.current || !onCameraChange) return;
    const p = camera.position;
    const t = controlsRef.current.target;
    onCameraChange({
      preset: lastPresetRef.current ?? preset,
      position: [p.x, p.y, p.z],
      target: [t.x, t.y, t.z],
    });
  };

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      enablePan
      onEnd={handleChange}
    />
  );
}
