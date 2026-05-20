import { nanoid } from "nanoid";
import type { Floorplan, Opening, Room, Wall } from "@/lib/insome/floorplan";
import type { SelectionRef } from "@/lib/insome/floorplan/edit";
import type { Command, CommandContext } from "../types";

export interface DeleteRoomArgs {
  readonly roomId: string;
  readonly selectionSnapshot: SelectionRef;
}

interface DeleteRoomSnapshot {
  readonly room: Room;
  readonly exclusiveWalls: ReadonlyArray<Wall>;
  readonly exclusiveOpenings: ReadonlyArray<Opening>;
}

/**
 * "Delete Room" semantic (Phase 2.75 finalised):
 *   - removes the Room object
 *   - removes walls referenced only by this room (exclusive walls)
 *   - removes openings attached to exclusive walls (cascade)
 *   - KEEPS walls shared with other rooms — they become "boundary walls"
 *
 * This shared-wall-retention is intentional. README documents why.
 */
function buildSnapshot(fp: Floorplan, roomId: string): DeleteRoomSnapshot | null {
  const room = fp.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const otherRoomsWallIds = new Set<string>();
  for (const r of fp.rooms) {
    if (r.id === roomId) continue;
    for (const wid of r.wallIds) otherRoomsWallIds.add(wid);
  }
  const exclusiveWallIds = new Set<string>();
  for (const wid of room.wallIds) {
    if (!otherRoomsWallIds.has(wid)) exclusiveWallIds.add(wid);
  }
  const exclusiveWalls = fp.walls.filter((w) => exclusiveWallIds.has(w.id));
  const exclusiveOpenings = fp.openings.filter((o) => exclusiveWallIds.has(o.wallId));
  return { room, exclusiveWalls, exclusiveOpenings };
}

function applyDelete(fp: Floorplan, snap: DeleteRoomSnapshot): Floorplan {
  const wallIds = new Set(snap.exclusiveWalls.map((w) => w.id));
  const openingIds = new Set(snap.exclusiveOpenings.map((o) => o.id));
  return {
    ...fp,
    rooms: fp.rooms.filter((r) => r.id !== snap.room.id),
    walls: fp.walls.filter((w) => !wallIds.has(w.id)),
    openings: fp.openings.filter((o) => !openingIds.has(o.id)),
  };
}

function undoDelete(fp: Floorplan, snap: DeleteRoomSnapshot): Floorplan {
  return {
    ...fp,
    rooms: [...fp.rooms, snap.room],
    walls: [...fp.walls, ...snap.exclusiveWalls],
    openings: [...fp.openings, ...snap.exclusiveOpenings],
  };
}

function wallToJSON(w: Wall): Record<string, unknown> {
  return {
    id: w.id,
    a: { x: w.a.x, y: w.a.y },
    b: { x: w.b.x, y: w.b.y },
    thickness: w.thickness,
    ...(w.height !== undefined ? { height: w.height } : {}),
  };
}

function openingToJSON(o: Opening): Record<string, unknown> {
  return {
    id: o.id,
    wallId: o.wallId,
    type: o.type,
    offset: o.offset,
    width: o.width,
    ...(o.swing !== undefined ? { swing: o.swing } : {}),
    ...(o.height !== undefined ? { height: o.height } : {}),
    ...(o.sillHeight !== undefined ? { sillHeight: o.sillHeight } : {}),
  };
}

function roomToJSON(r: Room): Record<string, unknown> {
  return {
    id: r.id,
    labelKey: r.labelKey,
    wallIds: [...r.wallIds],
    ...(r.color !== undefined ? { color: r.color } : {}),
    ...(r.material !== undefined ? { material: r.material } : {}),
    ...(r.grade !== undefined ? { grade: r.grade } : {}),
    ...(r.furn !== undefined ? { furn: [...r.furn] } : {}),
    ...(r.ceilingHeight !== undefined ? { ceilingHeight: r.ceilingHeight } : {}),
    ...(r.floorFinish !== undefined ? { floorFinish: r.floorFinish } : {}),
    ...(r.wallFinish !== undefined ? { wallFinish: r.wallFinish } : {}),
    ...(r.lightFixtures !== undefined ? { lightFixtures: r.lightFixtures } : {}),
  };
}

export function createDeleteRoomCommand(args: DeleteRoomArgs): Command {
  const { roomId, selectionSnapshot } = args;
  const createdAt = Date.now();
  let frozenSnap: DeleteRoomSnapshot | null = null;
  const cmd: Command = {
    id: nanoid(8),
    labelKey: "studio.command.deleteRoom",
    createdAt,
    selectionSnapshot,
    apply(ctx: CommandContext) {
      if (!frozenSnap) frozenSnap = buildSnapshot(ctx.getFloorplan(), roomId);
      if (!frozenSnap) return;
      ctx.setFloorplan(applyDelete(ctx.getFloorplan(), frozenSnap));
    },
    undo(ctx: CommandContext) {
      if (!frozenSnap) return;
      ctx.setFloorplan(undoDelete(ctx.getFloorplan(), frozenSnap));
    },
    canMergeWith(): boolean {
      return false;
    },
    toJSON() {
      return {
        kind: "delete-room",
        id: cmd.id,
        roomId,
        room: frozenSnap ? roomToJSON(frozenSnap.room) : null,
        exclusiveWalls: frozenSnap ? frozenSnap.exclusiveWalls.map(wallToJSON) : [],
        exclusiveOpenings: frozenSnap ? frozenSnap.exclusiveOpenings.map(openingToJSON) : [],
        createdAt,
      };
    },
  };
  return cmd;
}
