import { nanoid } from "nanoid";
import type { Floorplan, Point } from "@/lib/insome/floorplan";
import type { SelectionRef } from "@/lib/insome/floorplan/edit";
import type { Command, CommandContext } from "../types";

export interface TranslateRoomArgs {
  readonly roomId: string;
  readonly delta: Point;
  readonly selectionSnapshot: SelectionRef;
}

function shift(p: Point, d: Point): Point {
  return { x: p.x + d.x, y: p.y + d.y };
}

/**
 * Translate every endpoint of every wall referenced by the room's wallIds by
 * delta. Shared walls (walls referenced by another room) will therefore deform
 * that other room — this is Phase 2.5.2's documented behaviour (see README).
 */
function translateRoom(fp: Floorplan, roomId: string, d: Point): Floorplan {
  const room = fp.rooms.find((r) => r.id === roomId);
  if (!room) return fp;
  const affected = new Set(room.wallIds);
  return {
    ...fp,
    walls: fp.walls.map((w) =>
      affected.has(w.id) ? { ...w, a: shift(w.a, d), b: shift(w.b, d) } : w,
    ),
  };
}

export function createTranslateRoomCommand(args: TranslateRoomArgs): Command {
  const { roomId, delta, selectionSnapshot } = args;
  const createdAt = Date.now();
  const neg: Point = { x: -delta.x, y: -delta.y };
  const cmd: Command = {
    id: nanoid(8),
    labelKey: "studio.command.translateRoom",
    createdAt,
    selectionSnapshot,
    apply(ctx: CommandContext) {
      ctx.setFloorplan(translateRoom(ctx.getFloorplan(), roomId, delta));
    },
    undo(ctx: CommandContext) {
      ctx.setFloorplan(translateRoom(ctx.getFloorplan(), roomId, neg));
    },
    canMergeWith(other: Command): boolean {
      const j = other.toJSON();
      return j["kind"] === "translate-room" && j["roomId"] === roomId;
    },
    mergeWith(other: Command): Command {
      const j = other.toJSON();
      const dOther = j["delta"] as Point;
      return createTranslateRoomCommand({
        roomId,
        delta: { x: delta.x + dOther.x, y: delta.y + dOther.y },
        selectionSnapshot,
      });
    },
    toJSON() {
      return {
        kind: "translate-room",
        id: cmd.id,
        roomId,
        delta: { x: delta.x, y: delta.y },
        createdAt,
      };
    },
  };
  return cmd;
}
