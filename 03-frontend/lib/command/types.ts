import type { Floorplan } from "@/lib/insome/floorplan";
import type { SelectionRef } from "@/lib/insome/floorplan/edit";

export interface CommandContext {
  readonly getFloorplan: () => Floorplan;
  readonly setFloorplan: (next: Floorplan) => void;
}

export interface Command {
  readonly id: string;
  readonly labelKey: string;
  readonly createdAt: number;
  /** Snapshot of selection at construction time — canMergeWith compares this */
  readonly selectionSnapshot: SelectionRef;
  apply(ctx: CommandContext): void;
  undo(ctx: CommandContext): void;
  canMergeWith?(other: Command): boolean;
  mergeWith?(other: Command): Command;
  toJSON(): Record<string, unknown>;
}

export const MERGE_WINDOW_MS = 500;
