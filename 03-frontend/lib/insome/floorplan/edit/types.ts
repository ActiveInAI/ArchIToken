import type { Point } from "../schema";
import type { SnapResult } from "@/lib/insome/geom";

export type SelectionRef =
  | { readonly kind: "room"; readonly id: string }
  | { readonly kind: "wall"; readonly id: string }
  | { readonly kind: "opening"; readonly id: string }
  | null;

export type HitTarget =
  | { readonly kind: "wall-endpoint"; readonly wallId: string; readonly end: "a" | "b" }
  | { readonly kind: "opening"; readonly openingId: string }
  | { readonly kind: "wall-segment"; readonly wallId: string }
  | { readonly kind: "room"; readonly roomId: string }
  | { readonly kind: "empty" };

export interface HitTestResult {
  readonly target: HitTarget;
  readonly worldPoint: Point;
}

export type EditMode =
  | "none"
  | "wall"
  | "room"
  | "create-wall"
  | "create-room-rect"
  | "create-opening-door"
  | "create-opening-window"
  | "create-opening-plain";

export type DragKind = "wall-endpoint" | "wall-segment" | "room";

export type CreationKind =
  | "wall"
  | "room-rectangle"
  | "opening-door"
  | "opening-window"
  | "opening-plain";

export interface CreationSession {
  readonly kind: CreationKind;
  /** First click point (world coords); null = waiting for first click */
  readonly startPoint: Point | null;
  /** Current mouse position, already snapped. For one-click openings = hover position. */
  readonly currentPoint: Point | null;
  readonly snapResult: SnapResult | null;
  /** For opening placement: the wall the cursor is snapping to */
  readonly targetWallId?: string;
}

export function selectionEquals(a: SelectionRef, b: SelectionRef): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.kind === b.kind && a.id === b.id;
}

export function isCreationMode(m: EditMode): boolean {
  return m === "create-wall" || m === "create-room-rect"
    || m === "create-opening-door" || m === "create-opening-window" || m === "create-opening-plain";
}

export function editModeToCreationKind(m: EditMode): CreationKind | null {
  if (m === "create-wall") return "wall";
  if (m === "create-room-rect") return "room-rectangle";
  if (m === "create-opening-door") return "opening-door";
  if (m === "create-opening-window") return "opening-window";
  if (m === "create-opening-plain") return "opening-plain";
  return null;
}
