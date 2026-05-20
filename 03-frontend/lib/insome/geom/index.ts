export type { Point, Segment, Polygon, Bounds } from "./types";
export { DEFAULT_EPS } from "./types";

export {
  add,
  sub,
  scale,
  dist,
  distSq,
  dot,
  cross,
  equals,
} from "./point";

export {
  length as segmentLength,
  closestPointOn,
  intersect as segmentIntersect,
  pointOnSegment,
} from "./segment";

export {
  area as polygonArea,
  centroid as polygonCentroid,
  contains as polygonContains,
  polygonBounds,
} from "./polygon";

export {
  fromPoints as boundsFromPoints,
  union as boundsUnion,
  intersects as boundsIntersects,
  expand as boundsExpand,
  contains as boundsContains,
  width as boundsWidth,
  height as boundsHeight,
  center as boundsCenter,
} from "./bounds";

export type {
  SnapSourceKind,
  SnapMode,
  SnapCandidate,
  SnapResult,
  SnapWallRef,
  SolveSnapParams,
} from "./snap";
export { solveSnap } from "./snap";

export type { SpatialEntry, SpatialIndex } from "./spatial-index";
export { createSpatialIndex } from "./spatial-index";

export type { Junction, JunctionWallRef } from "./junctions";
export { detectJunctions } from "./junctions";
