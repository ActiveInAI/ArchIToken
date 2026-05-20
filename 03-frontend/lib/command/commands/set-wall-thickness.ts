import { nanoid } from "nanoid";
import type { Floorplan } from "@/lib/insome/floorplan";
import type { SelectionRef } from "@/lib/insome/floorplan/edit";
import type { Command, CommandContext } from "../types";

export interface SetWallThicknessArgs {
  readonly wallId: string;
  readonly fromThickness: number;
  readonly toThickness: number;
  readonly selectionSnapshot: SelectionRef;
}

function setThickness(fp: Floorplan, wallId: string, t: number): Floorplan {
  return {
    ...fp,
    walls: fp.walls.map((w) => (w.id === wallId ? { ...w, thickness: t } : w)),
  };
}

export function createSetWallThicknessCommand(args: SetWallThicknessArgs): Command {
  const { wallId, fromThickness, toThickness, selectionSnapshot } = args;
  const createdAt = Date.now();
  const cmd: Command = {
    id: nanoid(8),
    labelKey: "studio.command.setWallThickness",
    createdAt,
    selectionSnapshot,
    apply(ctx: CommandContext) {
      ctx.setFloorplan(setThickness(ctx.getFloorplan(), wallId, toThickness));
    },
    undo(ctx: CommandContext) {
      ctx.setFloorplan(setThickness(ctx.getFloorplan(), wallId, fromThickness));
    },
    canMergeWith(other: Command): boolean {
      const j = other.toJSON();
      return j["kind"] === "set-wall-thickness" && j["wallId"] === wallId;
    },
    mergeWith(other: Command): Command {
      const j = other.toJSON();
      return createSetWallThicknessCommand({
        wallId,
        fromThickness,
        toThickness: j["toThickness"] as number,
        selectionSnapshot,
      });
    },
    toJSON() {
      return {
        kind: "set-wall-thickness",
        id: cmd.id,
        wallId,
        fromThickness,
        toThickness,
        createdAt,
      };
    },
  };
  return cmd;
}
