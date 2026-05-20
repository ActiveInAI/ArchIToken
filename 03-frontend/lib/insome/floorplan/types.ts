/**
 * @deprecated Since Phase 2.5.1. Import from `@/lib/insome/floorplan/schema` (or the
 * package root) directly. This file is kept only to preserve the old module
 * path and re-exports every public name from `./schema`.
 */
export type {
  FloorplanScheme,
  FloorplanTheme,
  FurnitureType,
  RoomGrade,
  Point,
  Wall,
  OpeningType,
  Opening,
  Room,
  FloorplanViewBox,
  FloorplanScale,
  Floorplan,
  FloorplanId,
  WallId,
  RoomId,
  OpeningId,
  Translator,
  FloorplanRendererProps,
  SchemeColors,
} from "./schema";

export { resolveSchemeColors } from "./colors";
