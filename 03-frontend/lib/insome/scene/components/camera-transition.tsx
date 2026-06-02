"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { RefObject } from "react";
import type { PerspectiveCamera, Vector3 } from "three";

const TRANSITION_MS = 800;
const EASE_PRECAST = [0.2, 0.8, 0.2, 1] as const;

function cubicBezier(t: number, p1: number, p2: number, p3: number, p4: number): number {
  const mt = 1 - t;
  return mt * mt * mt * 0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p3 + t * t * t * 1 * 0 + p2 * 0 + p4 * 0;
}

function easePrecastAt(t: number): number {
  // Approximation via standard cubic-bezier (x1,y1,x2,y2) = (0.2, 0.8, 0.2, 1)
  // For animation we treat the value as (1 - (1 - t)^3) shaped — a sharp out-ease.
  // Cheap approximation: t ^ (1/2) gives similar perceived feel as easePrecast.
  return 1 - Math.pow(1 - t, 3);
}

interface TransitionTargets {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

export interface CameraTransitionController {
  animateTo(target: TransitionTargets, onDone?: () => void): void;
  isAnimating(): boolean;
}

interface CameraControlsTarget {
  target: Vector3;
  enabled: boolean;
  update(): void;
}

/**
 * Animate camera.position + controls.target from current to next values over
 * TRANSITION_MS with easePrecast-ish curve. Returns an imperative controller
 * so callers can trigger animations without React render churn.
 *
 * Caller is responsible for disabling OrbitControls.enabled during transition.
 */
export function useCameraTransition(
  controlsRef: RefObject<CameraControlsTarget | null>,
): CameraTransitionController {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const ctl = useRef({
    rafId: 0 as number,
    active: false,
    onDone: null as null | (() => void),
  });

  useEffect(() => {
    const current = ctl.current;
    return () => {
      if (current.rafId) cancelAnimationFrame(current.rafId);
    };
  }, []);

  return useMemo(
    () => ({
      isAnimating: () => ctl.current.active,
      animateTo(next, onDone) {
        const controls = controlsRef.current;
        if (!controls) return;
      if (ctl.current.rafId) cancelAnimationFrame(ctl.current.rafId);
      const fromPos: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z];
      const fromTgt: [number, number, number] = [controls.target.x, controls.target.y, controls.target.z];
      const startTime = performance.now();
      controls.enabled = false;
      ctl.current.active = true;
      ctl.current.onDone = onDone ?? null;
      void EASE_PRECAST; void cubicBezier;

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / TRANSITION_MS);
        const e = easePrecastAt(t);
        camera.position.set(
          fromPos[0] + (next.position[0] - fromPos[0]) * e,
          fromPos[1] + (next.position[1] - fromPos[1]) * e,
          fromPos[2] + (next.position[2] - fromPos[2]) * e,
        );
        controls.target.set(
          fromTgt[0] + (next.target[0] - fromTgt[0]) * e,
          fromTgt[1] + (next.target[1] - fromTgt[1]) * e,
          fromTgt[2] + (next.target[2] - fromTgt[2]) * e,
        );
        controls.update();
        if (t < 1) {
          ctl.current.rafId = requestAnimationFrame(step);
        } else {
          controls.enabled = true;
          ctl.current.active = false;
          ctl.current.rafId = 0;
          if (ctl.current.onDone) ctl.current.onDone();
          ctl.current.onDone = null;
        }
      };
      ctl.current.rafId = requestAnimationFrame(step);
      },
    }),
    [camera, controlsRef],
  );
}
