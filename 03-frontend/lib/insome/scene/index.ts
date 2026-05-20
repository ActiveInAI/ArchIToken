export { SceneView } from "./components/scene-view";
export type { SceneViewProps } from "./components/scene-view";

export { sceneFromFloorplan } from "./derive";
export type { SceneDeriveOptions } from "./derive";

export {
  getCameraPreset,
  cameraStateFromPreset,
  defaultCameraState,
} from "./camera/presets";

export type {
  Vec3,
  Bounds3D,
  Scene3D,
  SceneWall,
  SceneRoom,
  SceneOpening,
  WallSegment,
  WallSegmentReason,
  CameraPreset,
  CameraState,
  SceneClickTarget,
  SceneTheme,
  SceneSelection,
} from "./types";
