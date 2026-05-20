// LEGACY(phase-4.0): creation Command — Studio demo hides entry. Kept.
import { nanoid } from "nanoid";
import type { Floorplan, Opening } from "@/lib/insome/floorplan";
import type { SelectionRef } from "@/lib/insome/floorplan/edit";
import type { Command, CommandContext } from "../types";

export interface CreateOpeningArgs {
  readonly opening: Opening;
  readonly selectionSnapshot: SelectionRef;
}

function addOpening(fp: Floorplan, o: Opening): Floorplan {
  return { ...fp, openings: [...fp.openings, o] };
}

function removeOpening(fp: Floorplan, id: string): Floorplan {
  return { ...fp, openings: fp.openings.filter((o) => o.id !== id) };
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

export function createCreateOpeningCommand(args: CreateOpeningArgs): Command {
  const { opening, selectionSnapshot } = args;
  const createdAt = Date.now();
  const cmd: Command = {
    id: nanoid(8),
    labelKey: "studio.command.createOpening",
    createdAt,
    selectionSnapshot,
    apply(ctx: CommandContext) {
      ctx.setFloorplan(addOpening(ctx.getFloorplan(), opening));
    },
    undo(ctx: CommandContext) {
      ctx.setFloorplan(removeOpening(ctx.getFloorplan(), opening.id));
    },
    canMergeWith(): boolean {
      return false;
    },
    toJSON() {
      return {
        kind: "create-opening",
        id: cmd.id,
        opening: openingToJSON(opening),
        createdAt,
      };
    },
  };
  return cmd;
}
