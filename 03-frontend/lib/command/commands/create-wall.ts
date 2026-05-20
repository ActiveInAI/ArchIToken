// LEGACY(phase-4.0): creation Command — Studio demo hides the "draw wall"
// entry point per the prefab funnel pivot. Kept for the future deep-design
// phase. See apps/web/components/studio/editor/LEGACY.md.
import { nanoid } from "nanoid";
import type { Floorplan, Wall } from "@/lib/insome/floorplan";
import type { SelectionRef } from "@/lib/insome/floorplan/edit";
import type { Command, CommandContext } from "../types";

export interface CreateWallArgs {
  readonly wall: Wall;
  readonly selectionSnapshot: SelectionRef;
}

function addWall(fp: Floorplan, w: Wall): Floorplan {
  return { ...fp, walls: [...fp.walls, w] };
}

function removeWall(fp: Floorplan, id: string): Floorplan {
  return { ...fp, walls: fp.walls.filter((w) => w.id !== id) };
}

export function createCreateWallCommand(args: CreateWallArgs): Command {
  const { wall, selectionSnapshot } = args;
  const createdAt = Date.now();
  const cmd: Command = {
    id: nanoid(8),
    labelKey: "studio.command.createWall",
    createdAt,
    selectionSnapshot,
    apply(ctx: CommandContext) {
      ctx.setFloorplan(addWall(ctx.getFloorplan(), wall));
    },
    undo(ctx: CommandContext) {
      ctx.setFloorplan(removeWall(ctx.getFloorplan(), wall.id));
    },
    canMergeWith(): boolean {
      return false;
    },
    toJSON() {
      return {
        kind: "create-wall",
        id: cmd.id,
        wall: { id: wall.id, a: { x: wall.a.x, y: wall.a.y }, b: { x: wall.b.x, y: wall.b.y }, thickness: wall.thickness },
        createdAt,
      };
    },
  };
  return cmd;
}
