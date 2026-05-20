import { MERGE_WINDOW_MS, type Command, type CommandContext } from "./types";
import { selectionEquals } from "@/lib/insome/floorplan/edit";

const MAX_STACK = 100;

export interface CommandStackState {
  readonly past: ReadonlyArray<Command>;
  readonly future: ReadonlyArray<Command>;
}

export const EMPTY_STACK: CommandStackState = { past: [], future: [] };

export function push(state: CommandStackState, cmd: Command): CommandStackState {
  const top = state.past[state.past.length - 1];
  if (
    top &&
    cmd.createdAt - top.createdAt <= MERGE_WINDOW_MS &&
    selectionEquals(top.selectionSnapshot, cmd.selectionSnapshot) &&
    top.canMergeWith?.(cmd) &&
    top.mergeWith
  ) {
    const merged = top.mergeWith(cmd);
    const newPast = [...state.past.slice(0, -1), merged];
    return { past: trim(newPast), future: [] };
  }
  return { past: trim([...state.past, cmd]), future: [] };
}

function trim(arr: Command[]): Command[] {
  if (arr.length <= MAX_STACK) return arr;
  return arr.slice(arr.length - MAX_STACK);
}

export function undo(
  state: CommandStackState,
  ctx: CommandContext,
): CommandStackState {
  const top = state.past[state.past.length - 1];
  if (!top) return state;
  top.undo(ctx);
  return {
    past: state.past.slice(0, -1),
    future: [...state.future, top],
  };
}

export function redo(
  state: CommandStackState,
  ctx: CommandContext,
): CommandStackState {
  const top = state.future[state.future.length - 1];
  if (!top) return state;
  top.apply(ctx);
  return {
    past: [...state.past, top],
    future: state.future.slice(0, -1),
  };
}

export function canUndo(state: CommandStackState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: CommandStackState): boolean {
  return state.future.length > 0;
}
