import type { MeasurementUnit } from "@/lib/insome/types";

/**
 * INSOME Floorplan Schema — authoritative source of truth.
 *
 * Wall / Room / Opening are first-class citizens.
 * Coordinate system: origin (0,0) top-left, +x right, +y down (SVG convention).
 * Units are abstract floorplan units; Floorplan.scale translates to real world
 * via MeasurementUnit + unitsPerMeter.
 *
 * Rooms are polygons expressed as an ordered list of wallIds forming a closed
 * loop. Phase 2.5.1 supports only simple (non-self-intersecting, no-hole)
 * polygons. Inner loops / holes are a Phase 2.5.3+ concern.
 */

export type FloorplanId = string;
export type WallId = string;
export type RoomId = string;
export type OpeningId = string;

export type FloorplanScheme = "standard" | "pastel" | "contrast";
export type FloorplanTheme = "home" | "studio";

export type FurnitureType =
  | "sofa"
  | "bed"
  | "table"
  | "counter"
  | "tub"
  | "shower"
  | "desk";

export type RoomGrade = "standard" | "premium" | "luxury";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A wall segment between two points with uniform thickness. */
export interface Wall {
  readonly id: WallId;
  readonly a: Point;
  readonly b: Point;
  /** Units = floorplan units. Default 8 (≈ 0.2m under 40 units/m scale). */
  readonly thickness: number;
  /** Phase 3: 3D height override (floorplan units). Falls back to Floorplan.defaultWallHeight. */
  readonly height?: number;
}

export type OpeningType = "door" | "window" | "opening";

/** Opening on a wall. offset = distance from wall.a along a→b direction. */
export interface Opening {
  readonly id: OpeningId;
  readonly wallId: WallId;
  readonly type: OpeningType;
  readonly offset: number;
  readonly width: number;
  readonly swing?: "left" | "right" | "none";
  /** Phase 3: 3D opening height (floorplan units). Falls back to type defaults. */
  readonly height?: number;
  /** Phase 3: window sill height above floor (floorplan units). Window default 0.9m. */
  readonly sillHeight?: number;
}

/**
 * Room polygon: wallIds in order form a closed loop. Under SVG y-down, a
 * clockwise (CW) winding has *positive* signed area (shoelace). The renderer
 * derives the polygon vertex ring from the wall endpoints following wallIds
 * order.
 */
export interface Room {
  readonly id: RoomId;
  readonly labelKey: string;
  readonly wallIds: ReadonlyArray<WallId>;
  readonly furn?: ReadonlyArray<FurnitureType>;
  readonly material?: string;
  readonly grade?: RoomGrade;
  readonly color?: string;
  readonly ceilingHeight?: number;
  readonly floorFinish?: string;
  readonly wallFinish?: string;
  readonly lightFixtures?: "none" | "standard" | "premium";
  /** Phase 3: 3D floor finish (L1 color only). */
  readonly floorFinish3d?: { readonly color?: string };
}

export interface FloorplanViewBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface FloorplanScale {
  readonly unitsPerMeter: number;
}

export interface Floorplan {
  readonly id: FloorplanId;
  readonly nameKey: string;
  readonly viewBox: FloorplanViewBox;
  readonly unit: MeasurementUnit;
  readonly scale: FloorplanScale;
  readonly boundary?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly walls: ReadonlyArray<Wall>;
  readonly rooms: ReadonlyArray<Room>;
  readonly openings: ReadonlyArray<Opening>;
  /** Phase 3: default 3D wall height (floorplan units). Fallback 2.7m. */
  readonly defaultWallHeight?: number;
  /** Phase 3: default floor-slab thickness (floorplan units). Fallback 0.1m. */
  readonly defaultFloorThickness?: number;
  /** Phase 4.0: prefab constraint — maximum 4 stories. Defaults to 1. */
  readonly stories?: number;
}

export type Translator = (key: string) => string;

export interface FloorplanRendererProps {
  readonly floorplan: Floorplan;
  readonly selectedRoomId?: string | null;
  readonly scheme?: FloorplanScheme;
  readonly theme?: FloorplanTheme;
  readonly showDimensions?: boolean;
  readonly showGrid?: boolean;
  readonly translator: Translator;
  readonly onRoomSelect?: (roomId: string, labelKey: string) => void;
  readonly className?: string;
}

export interface SchemeColors {
  readonly bg: string;
  readonly stroke: string;
  readonly room: string;
  readonly selected: string;
  readonly furniture: string;
}
