import type { SelectionRef } from "@/lib/insome/floorplan/edit";

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Bounds3D {
  readonly min: Vec3;
  readonly max: Vec3;
}

export type WallSegmentReason =
  | "full"
  | "below-opening"
  | "above-opening"
  | "side-of-opening";

export interface WallSegment {
  readonly a: Vec3;
  readonly b: Vec3;
  readonly yBottom: number;
  readonly yTop: number;
  readonly reason: WallSegmentReason;
}

export interface SceneWall {
  readonly id: string;
  readonly segments: ReadonlyArray<WallSegment>;
  readonly thickness: number;
  readonly height: number;
}

export interface SceneRoom {
  readonly id: string;
  readonly polygon: ReadonlyArray<Vec3>;
  readonly floorColor: string;
  readonly ceilingHeight: number;
}

export interface SceneOpening {
  readonly id: string;
  readonly wallId: string;
  readonly type: "door" | "window" | "opening";
  readonly position: Vec3;
  readonly normal: Vec3;
  readonly direction: Vec3;
  readonly width: number;
  readonly height: number;
  readonly sillHeight: number;
  readonly swing: "left" | "right" | "none";
}

export interface Scene3D {
  readonly walls: ReadonlyArray<SceneWall>;
  readonly rooms: ReadonlyArray<SceneRoom>;
  readonly openings: ReadonlyArray<SceneOpening>;
  readonly bounds: Bounds3D;
  readonly metadata: {
    readonly unit: "m" | "ft";
    readonly defaultWallHeight: number;
  };
}

export type CameraPreset = "iso" | "top" | "perspective";

export interface CameraState {
  readonly preset: CameraPreset;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

export interface SceneClickTarget {
  readonly kind: "wall" | "room" | "opening";
  readonly id: string;
}

export type SceneTheme = "home" | "studio";

export type SceneSelection = SelectionRef;
