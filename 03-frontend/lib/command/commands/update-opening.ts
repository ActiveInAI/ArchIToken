import { nanoid } from "nanoid";
import type { Floorplan, Opening } from "@/lib/insome/floorplan";
import type { SelectionRef } from "@/lib/insome/floorplan/edit";
import type { Command, CommandContext } from "../types";

export type OpeningPatch = Partial<Pick<Opening, "type" | "offset" | "width" | "swing">>;

export interface UpdateOpeningArgs {
  readonly openingId: string;
  readonly fromPatch: OpeningPatch;
  readonly toPatch: OpeningPatch;
  readonly selectionSnapshot: SelectionRef;
}

function patchOpening(fp: Floorplan, id: string, patch: OpeningPatch): Floorplan {
  return {
    ...fp,
    openings: fp.openings.map((o) => {
      if (o.id !== id) return o;
      const next: Opening = {
        id: o.id,
        wallId: o.wallId,
        type: patch.type ?? o.type,
        offset: patch.offset ?? o.offset,
        width: patch.width ?? o.width,
        ...(patch.swing !== undefined
          ? { swing: patch.swing }
          : o.swing !== undefined
            ? { swing: o.swing }
            : {}),
      };
      return next;
    }),
  };
}

export function createUpdateOpeningCommand(args: UpdateOpeningArgs): Command {
  const { openingId, fromPatch, toPatch, selectionSnapshot } = args;
  const createdAt = Date.now();
  const cmd: Command = {
    id: nanoid(8),
    labelKey: "studio.command.updateOpening",
    createdAt,
    selectionSnapshot,
    apply(ctx: CommandContext) {
      ctx.setFloorplan(patchOpening(ctx.getFloorplan(), openingId, toPatch));
    },
    undo(ctx: CommandContext) {
      ctx.setFloorplan(patchOpening(ctx.getFloorplan(), openingId, fromPatch));
    },
    canMergeWith(other: Command): boolean {
      const j = other.toJSON();
      return j["kind"] === "update-opening" && j["openingId"] === openingId;
    },
    mergeWith(other: Command): Command {
      const j = other.toJSON();
      return createUpdateOpeningCommand({
        openingId,
        fromPatch,
        toPatch: j["toPatch"] as OpeningPatch,
        selectionSnapshot,
      });
    },
    toJSON() {
      return {
        kind: "update-opening",
        id: cmd.id,
        openingId,
        fromPatch: { ...fromPatch },
        toPatch: { ...toPatch },
        createdAt,
      };
    },
  };
  return cmd;
}
