export { FloorplanRenderer } from "./renderer";
export { FloorplanEditorOverlay } from "./editor-overlay";
export type { EditorOverlayProps } from "./editor-overlay";
export { FurnitureLayer } from "./furniture-library";
export { resolveSchemeColors } from "./colors";
export {
  generateResidentialProposals,
  summarizeFloorplan,
} from "./variants/residential-generator";
export { roomPolygon, floorplanRoomBounds } from "./geometry";
export type {
  FloorplanScheme,
  FloorplanTheme,
  FurnitureType,
  Point,
  Room,
  RoomGrade,
  Floorplan,
  FloorplanViewBox,
  FloorplanScale,
  FloorplanRendererProps,
  SchemeColors,
  Translator,
  Wall,
  Opening,
  OpeningType,
  FloorplanId,
  WallId,
  RoomId,
  OpeningId,
} from "./schema";
