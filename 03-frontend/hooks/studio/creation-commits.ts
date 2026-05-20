// LEGACY(phase-4.0): creation-gesture commit helpers — dormant in demo. Kept.
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { segmentLength, type Point } from "@/lib/insome/geom";
import type { Floorplan, Opening, Wall } from "@/lib/insome/floorplan";
import type { EditMode, SelectionRef } from "@/lib/insome/floorplan/edit";
import {
  createCreateOpeningCommand,
  createCreateRoomRectangleCommand,
  createCreateWallCommand,
  type Command,
} from "@/lib/command";

const MIN_WALL_LENGTH = 0.05;
const MIN_ROOM_SIDE = 0.1;
const DEFAULT_OPENING_WIDTH = 24;
const DEFAULT_DOOR_SWING: "left" | "right" | "none" = "right";

export function commitCreateWall(
  _fp: Floorplan,
  start: Point,
  end: Point,
  thickness: number,
  selectionSnapshot: SelectionRef,
  pushCmd: (c: Command) => void,
  translator: (k: string) => string,
): void {
  const len = segmentLength({ a: start, b: end });
  if (len < MIN_WALL_LENGTH) {
    toast(translator("studio.edit.invalid.zeroLength"));
    return;
  }
  const wall: Wall = { id: `w-${nanoid(8)}`, a: start, b: end, thickness };
  pushCmd(createCreateWallCommand({ wall, selectionSnapshot }));
}

export function commitCreateRoomRect(
  start: Point,
  end: Point,
  thickness: number,
  labelKey: string,
  selectionSnapshot: SelectionRef,
  pushCmd: (c: Command) => void,
  translator: (k: string) => string,
): void {
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);
  if (w < MIN_ROOM_SIDE || h < MIN_ROOM_SIDE) {
    toast(translator("studio.edit.invalid.tooSmall"));
    return;
  }
  pushCmd(
    createCreateRoomRectangleCommand({
      topLeft: start,
      bottomRight: end,
      thickness,
      labelKey,
      selectionSnapshot,
    }),
  );
}

export function commitCreateOpening(
  wall: Wall,
  snappedPoint: Point,
  editMode: EditMode,
  existingOpenings: ReadonlyArray<Opening>,
  selectionSnapshot: SelectionRef,
  pushCmd: (c: Command) => void,
  translator: (k: string) => string,
): void {
  const dx = wall.b.x - wall.a.x;
  const dy = wall.b.y - wall.a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) return;
  const ux = dx / len;
  const uy = dy / len;
  const along = (snappedPoint.x - wall.a.x) * ux + (snappedPoint.y - wall.a.y) * uy;
  const width = DEFAULT_OPENING_WIDTH;
  const halfW = width / 2;
  if (along - halfW < 0 || along + halfW > len) {
    toast(translator("studio.edit.invalid.openingOutOfWall"));
    return;
  }
  const overlap = existingOpenings.some((o) => {
    if (o.wallId !== wall.id) return false;
    return Math.abs(o.offset - along) < (o.width + width) / 2;
  });
  if (overlap) {
    toast(translator("studio.edit.invalid.openingOverlap"));
    return;
  }
  const type: Opening["type"] =
    editMode === "create-opening-door"
      ? "door"
      : editMode === "create-opening-window"
        ? "window"
        : "opening";
  const opening: Opening = {
    id: `o-${nanoid(8)}`,
    wallId: wall.id,
    type,
    offset: along,
    width,
    ...(type === "door" ? { swing: DEFAULT_DOOR_SWING } : {}),
  };
  pushCmd(createCreateOpeningCommand({ opening, selectionSnapshot }));
}
