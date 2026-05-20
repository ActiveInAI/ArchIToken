import type { Floorplan, Point } from "@/lib/insome/floorplan";
import type { SelectionRef } from "@/lib/insome/floorplan/edit";
import {
  createMoveWallEndpointCommand,
  createTranslateRoomCommand,
  createTranslateWallCommand,
  type Command,
} from "@/lib/command";
import type { DragSession } from "@/stores/studio-editor.store";

const MIN_WALL_LENGTH = 0.05;

function withinViewBox(p: Point, vb: Floorplan["viewBox"]): boolean {
  return p.x >= vb.x && p.x <= vb.x + vb.w && p.y >= vb.y && p.y <= vb.y + vb.h;
}

export function buildDragCommand(
  session: DragSession,
  floorplan: Floorplan,
  snapshot: SelectionRef,
  onInvalid: (reasonKey: string) => void,
): Command | null {
  const delta: Point = {
    x: session.currentWorldPoint.x - session.startWorldPoint.x,
    y: session.currentWorldPoint.y - session.startWorldPoint.y,
  };
  if (Math.abs(delta.x) < 0.0001 && Math.abs(delta.y) < 0.0001) return null;
  if (session.kind === "wall-endpoint" && session.wallId && session.end) {
    const w = floorplan.walls.find((wl) => wl.id === session.wallId);
    if (!w) return null;
    const fromPoint = session.end === "a" ? w.a : w.b;
    const toPoint: Point = { x: fromPoint.x + delta.x, y: fromPoint.y + delta.y };
    if (!withinViewBox(toPoint, floorplan.viewBox)) {
      onInvalid("studio.edit.invalid.outOfBounds");
      return null;
    }
    const otherEnd = session.end === "a" ? w.b : w.a;
    const dx = toPoint.x - otherEnd.x;
    const dy = toPoint.y - otherEnd.y;
    if (Math.sqrt(dx * dx + dy * dy) < MIN_WALL_LENGTH) {
      onInvalid("studio.edit.invalid.zeroLength");
      return null;
    }
    return createMoveWallEndpointCommand({
      wallId: session.wallId,
      end: session.end,
      fromPoint,
      toPoint,
      selectionSnapshot: snapshot,
    });
  }
  if (session.kind === "wall-segment" && session.wallId) {
    const w = floorplan.walls.find((wl) => wl.id === session.wallId);
    if (!w) return null;
    const na: Point = { x: w.a.x + delta.x, y: w.a.y + delta.y };
    const nb: Point = { x: w.b.x + delta.x, y: w.b.y + delta.y };
    if (!withinViewBox(na, floorplan.viewBox) || !withinViewBox(nb, floorplan.viewBox)) {
      onInvalid("studio.edit.invalid.outOfBounds");
      return null;
    }
    return createTranslateWallCommand({
      wallId: session.wallId,
      delta,
      selectionSnapshot: snapshot,
    });
  }
  if (session.kind === "room" && session.roomId) {
    const room = floorplan.rooms.find((r) => r.id === session.roomId);
    if (!room) return null;
    const walls = floorplan.walls.filter((w) => room.wallIds.includes(w.id));
    for (const w of walls) {
      const na: Point = { x: w.a.x + delta.x, y: w.a.y + delta.y };
      const nb: Point = { x: w.b.x + delta.x, y: w.b.y + delta.y };
      if (!withinViewBox(na, floorplan.viewBox) || !withinViewBox(nb, floorplan.viewBox)) {
        onInvalid("studio.edit.invalid.outOfBounds");
        return null;
      }
    }
    return createTranslateRoomCommand({
      roomId: session.roomId,
      delta,
      selectionSnapshot: snapshot,
    });
  }
  return null;
}
