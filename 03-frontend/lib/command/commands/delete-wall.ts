import { nanoid } from "nanoid";
import type { Floorplan, Opening, Wall } from "@/lib/insome/floorplan";
import type { SelectionRef } from "@/lib/insome/floorplan/edit";
import type { Command, CommandContext } from "../types";

export interface DeleteWallArgs {
  readonly wallId: string;
  /** Snapshot of the wall at deletion time (needed for undo). */
  readonly wallSnapshot: Wall;
  /** Snapshot of openings that were attached to this wall (cascade-deleted, restored on undo). */
  readonly openingSnapshots: ReadonlyArray<Opening>;
  readonly selectionSnapshot: SelectionRef;
}

function applyDelete(fp: Floorplan, wallId: string, openingIds: ReadonlySet<string>): Floorplan {
  return {
    ...fp,
    walls: fp.walls.filter((w) => w.id !== wallId),
    openings: fp.openings.filter((o) => !openingIds.has(o.id)),
  };
}

function undoDelete(fp: Floorplan, wall: Wall, openings: ReadonlyArray<Opening>): Floorplan {
  return {
    ...fp,
    walls: [...fp.walls, wall],
    openings: [...fp.openings, ...openings],
  };
}

function wallToJSON(w: Wall): Record<string, unknown> {
  return { id: w.id, a: { x: w.a.x, y: w.a.y }, b: { x: w.b.x, y: w.b.y }, thickness: w.thickness };
}

function openingToJSON(o: Opening): Record<string, unknown> {
  return {
    id: o.id,
    wallId: o.wallId,
    type: o.type,
    offset: o.offset,
    width: o.width,
    ...(o.swing !== undefined ? { swing: o.swing } : {}),
  };
}

export function createDeleteWallCommand(args: DeleteWallArgs): Command {
  const { wallId, wallSnapshot, openingSnapshots, selectionSnapshot } = args;
  const openingIds = new Set(openingSnapshots.map((o) => o.id));
  const createdAt = Date.now();
  const cmd: Command = {
    id: nanoid(8),
    labelKey: "studio.command.deleteWall",
    createdAt,
    selectionSnapshot,
    apply(ctx: CommandContext) {
      ctx.setFloorplan(applyDelete(ctx.getFloorplan(), wallId, openingIds));
    },
    undo(ctx: CommandContext) {
      ctx.setFloorplan(undoDelete(ctx.getFloorplan(), wallSnapshot, openingSnapshots));
    },
    canMergeWith(): boolean {
      return false;
    },
    toJSON() {
      return {
        kind: "delete-wall",
        id: cmd.id,
        wallId,
        wall: wallToJSON(wallSnapshot),
        openings: openingSnapshots.map(openingToJSON),
        createdAt,
      };
    },
  };
  return cmd;
}
