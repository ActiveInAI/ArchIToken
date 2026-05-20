import { nanoid } from "nanoid";
import type { Floorplan, Point, Wall } from "@/lib/insome/floorplan";
import type { SelectionRef } from "@/lib/insome/floorplan/edit";
import type { Command, CommandContext } from "../types";

export interface TranslateWallArgs {
  readonly wallId: string;
  readonly delta: Point;
  readonly selectionSnapshot: SelectionRef;
}

function shift(p: Point, d: Point): Point {
  return { x: p.x + d.x, y: p.y + d.y };
}

function translateWall(fp: Floorplan, wallId: string, d: Point): Floorplan {
  return {
    ...fp,
    walls: fp.walls.map((w: Wall) =>
      w.id === wallId ? { ...w, a: shift(w.a, d), b: shift(w.b, d) } : w,
    ),
  };
}

export function createTranslateWallCommand(args: TranslateWallArgs): Command {
  const { wallId, delta, selectionSnapshot } = args;
  const createdAt = Date.now();
  const neg: Point = { x: -delta.x, y: -delta.y };
  const cmd: Command = {
    id: nanoid(8),
    labelKey: "studio.command.translateWall",
    createdAt,
    selectionSnapshot,
    apply(ctx: CommandContext) {
      ctx.setFloorplan(translateWall(ctx.getFloorplan(), wallId, delta));
    },
    undo(ctx: CommandContext) {
      ctx.setFloorplan(translateWall(ctx.getFloorplan(), wallId, neg));
    },
    canMergeWith(other: Command): boolean {
      const j = other.toJSON();
      return j["kind"] === "translate-wall" && j["wallId"] === wallId;
    },
    mergeWith(other: Command): Command {
      const j = other.toJSON();
      const dOther = j["delta"] as Point;
      return createTranslateWallCommand({
        wallId,
        delta: { x: delta.x + dOther.x, y: delta.y + dOther.y },
        selectionSnapshot,
      });
    },
    toJSON() {
      return {
        kind: "translate-wall",
        id: cmd.id,
        wallId,
        delta: { x: delta.x, y: delta.y },
        createdAt,
      };
    },
  };
  return cmd;
}
