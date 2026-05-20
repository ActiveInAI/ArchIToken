import { nanoid } from "nanoid";
import type { Floorplan, Opening } from "@/lib/insome/floorplan";
import type { SelectionRef } from "@/lib/insome/floorplan/edit";
import type { Command, CommandContext } from "../types";

export interface DeleteOpeningArgs {
  readonly openingSnapshot: Opening;
  readonly selectionSnapshot: SelectionRef;
}

function removeOpening(fp: Floorplan, id: string): Floorplan {
  return { ...fp, openings: fp.openings.filter((o) => o.id !== id) };
}

function addOpening(fp: Floorplan, o: Opening): Floorplan {
  return { ...fp, openings: [...fp.openings, o] };
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

export function createDeleteOpeningCommand(args: DeleteOpeningArgs): Command {
  const { openingSnapshot, selectionSnapshot } = args;
  const createdAt = Date.now();
  const cmd: Command = {
    id: nanoid(8),
    labelKey: "studio.command.deleteOpening",
    createdAt,
    selectionSnapshot,
    apply(ctx: CommandContext) {
      ctx.setFloorplan(removeOpening(ctx.getFloorplan(), openingSnapshot.id));
    },
    undo(ctx: CommandContext) {
      ctx.setFloorplan(addOpening(ctx.getFloorplan(), openingSnapshot));
    },
    canMergeWith(): boolean {
      return false;
    },
    toJSON() {
      return {
        kind: "delete-opening",
        id: cmd.id,
        opening: openingToJSON(openingSnapshot),
        createdAt,
      };
    },
  };
  return cmd;
}
