export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Segment {
  readonly a: Point;
  readonly b: Point;
}

export type Polygon = ReadonlyArray<Point>;

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export const DEFAULT_EPS = 1e-9;
