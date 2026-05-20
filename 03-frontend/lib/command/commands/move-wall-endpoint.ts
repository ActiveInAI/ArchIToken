import { nanoid } from "nanoid";
import type { Floorplan, Point, Wall } from "@/lib/insome/floorplan";
import type { SelectionRef } from "@/lib/insome/floorplan/edit";
import type { Command, CommandContext } from "../types";

export interface MoveWallEndpointArgs {
  readonly wallId: string;
  readonly end: "a" | "b";
  readonly fromPoint: Point;
  readonly toPoint: Point;
  readonly selectionSnapshot: SelectionRef;
}

function patchWall(fp: Floorplan, wallId: string, fn: (w: Wall) => Wall): Floorplan {
  return { ...fp, walls: fp.walls.map((w) => (w.id === wallId ? fn(w) : w)) };
}

export function createMoveWallEndpointCommand(args: MoveWallEndpointArgs): Command {
  const { wallId, end, fromPoint, toPoint } = args;
  const createdAt = Date.now();
  const cmd: Command = {
    id: nanoid(8),
    labelKey: "studio.command.moveWallEndpoint",
    createdAt,
    selectionSnapshot: args.selectionSnapshot,
    apply(ctx: CommandContext) {
      ctx.setFloorplan(patchWall(ctx.getFloorplan(), wallId, (w) => ({ ...w, [end]: toPoint })));
    },
    undo(ctx: CommandContext) {
      ctx.setFloorplan(patchWall(ctx.getFloorplan(), wallId, (w) => ({ ...w, [end]: fromPoint })));
    },
    canMergeWith(other: Command): boolean {
      const json = other.toJSON();
      return json["kind"] === "move-wall-endpoint" && json["wallId"] === wallId && json["end"] === end;
    },
    mergeWith(other: Command): Command {
      const merged = createMoveWallEndpointCommand({
        wallId,
        end,
        fromPoint,
        toPoint: (other.toJSON()["toPoint"] as Point),
        selectionSnapshot: args.selectionSnapshot,
      });
      return merged;
    },
    toJSON() {
      return {
        kind: "move-wall-endpoint",
        id: cmd.id,
        wallId,
        end,
        fromPoint: { x: fromPoint.x, y: fromPoint.y },
        toPoint: { x: toPoint.x, y: toPoint.y },
        createdAt,
      };
    },
  };
  return cmd;
}
