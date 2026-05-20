// LEGACY(phase-4.0): creation Command — Studio demo hides entry. Kept.
import { nanoid } from "nanoid";
import type { Floorplan, Point, Room, Wall } from "@/lib/insome/floorplan";
import type { SelectionRef } from "@/lib/insome/floorplan/edit";
import type { Command, CommandContext } from "../types";

export interface CreateRoomRectangleArgs {
  readonly topLeft: Point;
  readonly bottomRight: Point;
  readonly thickness: number;
  readonly labelKey: string;
  readonly selectionSnapshot: SelectionRef;
}

interface Built {
  readonly walls: ReadonlyArray<Wall>;
  readonly room: Room;
}

function buildRectangle(
  topLeft: Point,
  bottomRight: Point,
  thickness: number,
  labelKey: string,
): Built {
  const { x: x1, y: y1 } = topLeft;
  const { x: x2, y: y2 } = bottomRight;
  const xMin = Math.min(x1, x2);
  const yMin = Math.min(y1, y2);
  const xMax = Math.max(x1, x2);
  const yMax = Math.max(y1, y2);
  const tlId = `w-${nanoid(6)}-t`;
  const rtId = `w-${nanoid(6)}-r`;
  const btId = `w-${nanoid(6)}-b`;
  const lfId = `w-${nanoid(6)}-l`;
  const roomId = `r-${nanoid(6)}`;
  const walls: ReadonlyArray<Wall> = [
    { id: tlId, a: { x: xMin, y: yMin }, b: { x: xMax, y: yMin }, thickness },
    { id: rtId, a: { x: xMax, y: yMin }, b: { x: xMax, y: yMax }, thickness },
    { id: btId, a: { x: xMax, y: yMax }, b: { x: xMin, y: yMax }, thickness },
    { id: lfId, a: { x: xMin, y: yMax }, b: { x: xMin, y: yMin }, thickness },
  ];
  const room: Room = {
    id: roomId,
    labelKey,
    wallIds: [tlId, rtId, btId, lfId],
  };
  return { walls, room };
}

function applyAtomic(fp: Floorplan, built: Built): Floorplan {
  return {
    ...fp,
    walls: [...fp.walls, ...built.walls],
    rooms: [...fp.rooms, built.room],
  };
}

function undoAtomic(fp: Floorplan, built: Built): Floorplan {
  const wallIds = new Set(built.walls.map((w) => w.id));
  return {
    ...fp,
    walls: fp.walls.filter((w) => !wallIds.has(w.id)),
    rooms: fp.rooms.filter((r) => r.id !== built.room.id),
  };
}

export function createCreateRoomRectangleCommand(args: CreateRoomRectangleArgs): Command {
  const built = buildRectangle(args.topLeft, args.bottomRight, args.thickness, args.labelKey);
  const createdAt = Date.now();
  const cmd: Command = {
    id: nanoid(8),
    labelKey: "studio.command.createRoom",
    createdAt,
    selectionSnapshot: args.selectionSnapshot,
    apply(ctx: CommandContext) {
      ctx.setFloorplan(applyAtomic(ctx.getFloorplan(), built));
    },
    undo(ctx: CommandContext) {
      ctx.setFloorplan(undoAtomic(ctx.getFloorplan(), built));
    },
    canMergeWith(): boolean {
      return false;
    },
    toJSON() {
      return {
        kind: "create-room-rectangle",
        id: cmd.id,
        topLeft: { x: args.topLeft.x, y: args.topLeft.y },
        bottomRight: { x: args.bottomRight.x, y: args.bottomRight.y },
        thickness: args.thickness,
        labelKey: args.labelKey,
        roomId: built.room.id,
        wallIds: built.walls.map((w) => w.id),
        createdAt,
      };
    },
  };
  return cmd;
}
