import type { Bounds3D, CameraPreset, CameraState } from "../types";

export interface CameraPresetResult {
  readonly position: [number, number, number];
  readonly target: [number, number, number];
}

function centerOf(b: Bounds3D): { x: number; y: number; z: number } {
  return {
    x: (b.min.x + b.max.x) / 2,
    y: (b.min.y + b.max.y) / 2,
    z: (b.min.z + b.max.z) / 2,
  };
}

function sizeOf(b: Bounds3D): { x: number; y: number; z: number } {
  return { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z };
}

/**
 * Three camera presets. All targets point at the floorplan center (y=0 level
 * for iso/top, y=mid-height for perspective). Distances scale with bounds
 * diagonal so the floorplan fills the view regardless of scale.
 */
export function getCameraPreset(preset: CameraPreset, bounds: Bounds3D): CameraPresetResult {
  const c = centerOf(bounds);
  const s = sizeOf(bounds);
  const diag = Math.max(Math.hypot(s.x, s.z), 100); // floor at 100 floorplan units so tiny test plans still get a reasonable camera distance
  const yHeightFloor = Math.max(s.y, 100);

  switch (preset) {
    case "iso":
      return {
        position: [c.x + diag, Math.max(yHeightFloor * 2, diag * 0.9), c.z + diag],
        target: [c.x, 0, c.z],
      };
    case "top":
      return {
        position: [c.x, diag * 1.5, c.z + 0.001],
        target: [c.x, 0, c.z],
      };
    case "perspective":
      return {
        position: [c.x + diag * 0.8, yHeightFloor * 1.2, c.z + diag * 1.2],
        target: [c.x, yHeightFloor * 0.4, c.z],
      };
  }
}

export function cameraStateFromPreset(preset: CameraPreset, bounds: Bounds3D): CameraState {
  const r = getCameraPreset(preset, bounds);
  return { preset, position: r.position, target: r.target };
}

export function defaultCameraState(): CameraState {
  return { preset: "iso", position: [200, 200, 200], target: [0, 0, 0] };
}
