import type { Floorplan, Opening, Room, Wall } from "@/lib/insome/floorplan";

/**
 * TODO(phase-4): replace with GET /api/floorplans?owner=<user> once the generator
 * returns real data. Three variants mirror the prototype's FLOORPLAN_VARIANTS array
 * (home.html:125-156). IDs v1/v2/v3 are referenced by chat-script side effects.
 *
 * Phase 2.5.1: migrated from legacy rect-rooms to Wall/Room(polygon)/Opening
 * first-class schema. Wall endpoints trace the outer boundary + inner partitions;
 * each room's wallIds walk its perimeter in CW order (SVG y-down). Coordinates
 * identical to Phase 2 rectangles — visual output is intended to be pixel-equivalent.
 *
 * Unit scale: ~40 viewBox units per meter keeps inspector area numbers plausible
 * for the 120-145 m² range these demo variants cover.
 */
const COMMON_VIEWBOX = { x: 0, y: 0, w: 580, h: 390 } as const;
const COMMON_BOUNDARY = { x: 20, y: 20, w: 540, h: 350 } as const;
const COMMON_SCALE = { unitsPerMeter: 40 } as const;
const WALL_THICKNESS = 6;

const NO_OPENINGS: ReadonlyArray<Opening> = [];

function wall(id: string, ax: number, ay: number, bx: number, by: number): Wall {
  return { id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: WALL_THICKNESS };
}

function rectWalls(
  prefix: string,
  x: number,
  y: number,
  w: number,
  h: number,
): { top: Wall; right: Wall; bottom: Wall; left: Wall } {
  return {
    top: wall(`${prefix}-t`, x, y, x + w, y),
    right: wall(`${prefix}-r`, x + w, y, x + w, y + h),
    bottom: wall(`${prefix}-b`, x + w, y + h, x, y + h),
    left: wall(`${prefix}-l`, x, y + h, x, y),
  };
}

function buildV1(): { walls: ReadonlyArray<Wall>; rooms: ReadonlyArray<Room> } {
  const living = rectWalls("liv", 30, 30, 260, 180);
  const kitchen = rectWalls("kit", 290, 30, 160, 110);
  const dining = rectWalls("din", 290, 140, 160, 70);
  const master = rectWalls("mas", 30, 210, 180, 150);
  const bath = rectWalls("bat", 210, 210, 100, 80);
  const bath2 = rectWalls("bt2", 310, 210, 70, 80);
  const second = rectWalls("sec", 380, 210, 150, 150);
  const hall = rectWalls("hal", 210, 290, 170, 70);

  const walls: ReadonlyArray<Wall> = [
    living.top, living.right, living.bottom, living.left,
    kitchen.top, kitchen.right, kitchen.bottom, kitchen.left,
    dining.top, dining.right, dining.bottom, dining.left,
    master.top, master.right, master.bottom, master.left,
    bath.top, bath.right, bath.bottom, bath.left,
    bath2.top, bath2.right, bath2.bottom, bath2.left,
    second.top, second.right, second.bottom, second.left,
    hall.top, hall.right, hall.bottom, hall.left,
  ];

  const rooms: ReadonlyArray<Room> = [
    { id: "living", labelKey: "rooms.livingRoom", wallIds: [living.top.id, living.right.id, living.bottom.id, living.left.id], furn: ["sofa"] },
    { id: "kitchen", labelKey: "rooms.kitchen", wallIds: [kitchen.top.id, kitchen.right.id, kitchen.bottom.id, kitchen.left.id], furn: ["counter"] },
    { id: "dining", labelKey: "rooms.diningRoom", wallIds: [dining.top.id, dining.right.id, dining.bottom.id, dining.left.id], furn: ["table"] },
    { id: "master", labelKey: "rooms.masterRoom", wallIds: [master.top.id, master.right.id, master.bottom.id, master.left.id], furn: ["bed"] },
    { id: "bath", labelKey: "rooms.bathroom", wallIds: [bath.top.id, bath.right.id, bath.bottom.id, bath.left.id], furn: ["tub"] },
    { id: "bath2", labelKey: "rooms.secondBathroom", wallIds: [bath2.top.id, bath2.right.id, bath2.bottom.id, bath2.left.id], furn: ["shower"] },
    { id: "second", labelKey: "rooms.secondRoom", wallIds: [second.top.id, second.right.id, second.bottom.id, second.left.id], furn: ["bed"] },
    { id: "hall", labelKey: "rooms.hallway", wallIds: [hall.top.id, hall.right.id, hall.bottom.id, hall.left.id] },
  ];

  return { walls, rooms };
}

function buildV2(): { walls: ReadonlyArray<Wall>; rooms: ReadonlyArray<Room> } {
  const living = rectWalls("liv", 30, 30, 240, 180);
  const study = rectWalls("stu", 30, 210, 140, 150);
  const kitchen = rectWalls("kit", 270, 30, 180, 100);
  const dining = rectWalls("din", 270, 130, 180, 80);
  const master = rectWalls("mas", 170, 210, 200, 150);
  const bath = rectWalls("bat", 370, 210, 80, 80);
  const second = rectWalls("sec", 450, 30, 100, 180);
  const third = rectWalls("thi", 370, 290, 180, 70);

  const walls: ReadonlyArray<Wall> = [
    living.top, living.right, living.bottom, living.left,
    study.top, study.right, study.bottom, study.left,
    kitchen.top, kitchen.right, kitchen.bottom, kitchen.left,
    dining.top, dining.right, dining.bottom, dining.left,
    master.top, master.right, master.bottom, master.left,
    bath.top, bath.right, bath.bottom, bath.left,
    second.top, second.right, second.bottom, second.left,
    third.top, third.right, third.bottom, third.left,
  ];

  const rooms: ReadonlyArray<Room> = [
    { id: "living", labelKey: "rooms.livingRoom", wallIds: [living.top.id, living.right.id, living.bottom.id, living.left.id], furn: ["sofa"] },
    { id: "study", labelKey: "rooms.study", wallIds: [study.top.id, study.right.id, study.bottom.id, study.left.id], furn: ["desk"] },
    { id: "kitchen", labelKey: "rooms.kitchen", wallIds: [kitchen.top.id, kitchen.right.id, kitchen.bottom.id, kitchen.left.id], furn: ["counter"] },
    { id: "dining", labelKey: "rooms.diningRoom", wallIds: [dining.top.id, dining.right.id, dining.bottom.id, dining.left.id], furn: ["table"] },
    { id: "master", labelKey: "rooms.masterRoom", wallIds: [master.top.id, master.right.id, master.bottom.id, master.left.id], furn: ["bed"] },
    { id: "bath", labelKey: "rooms.bathroom", wallIds: [bath.top.id, bath.right.id, bath.bottom.id, bath.left.id], furn: ["tub"] },
    { id: "second", labelKey: "rooms.secondRoom", wallIds: [second.top.id, second.right.id, second.bottom.id, second.left.id], furn: ["bed"] },
    { id: "third", labelKey: "rooms.thirdRoom", wallIds: [third.top.id, third.right.id, third.bottom.id, third.left.id], furn: ["bed"] },
  ];

  return { walls, rooms };
}

function buildV3(): { walls: ReadonlyArray<Wall>; rooms: ReadonlyArray<Room> } {
  const living = rectWalls("liv", 30, 30, 240, 180);
  const study = rectWalls("stu", 30, 210, 200, 150);
  const kitchen = rectWalls("kit", 270, 30, 180, 100);
  const dining = rectWalls("din", 270, 130, 180, 80);
  const master = rectWalls("mas", 230, 210, 200, 150);
  const bath = rectWalls("bat", 430, 210, 80, 80);
  const second = rectWalls("sec", 450, 30, 100, 180);
  const balc = rectWalls("bal", 430, 290, 120, 70);

  const walls: ReadonlyArray<Wall> = [
    living.top, living.right, living.bottom, living.left,
    study.top, study.right, study.bottom, study.left,
    kitchen.top, kitchen.right, kitchen.bottom, kitchen.left,
    dining.top, dining.right, dining.bottom, dining.left,
    master.top, master.right, master.bottom, master.left,
    bath.top, bath.right, bath.bottom, bath.left,
    second.top, second.right, second.bottom, second.left,
    balc.top, balc.right, balc.bottom, balc.left,
  ];

  const rooms: ReadonlyArray<Room> = [
    { id: "living", labelKey: "rooms.livingRoom", wallIds: [living.top.id, living.right.id, living.bottom.id, living.left.id], furn: ["sofa"] },
    { id: "study", labelKey: "rooms.study", wallIds: [study.top.id, study.right.id, study.bottom.id, study.left.id], furn: ["desk"] },
    { id: "kitchen", labelKey: "rooms.kitchen", wallIds: [kitchen.top.id, kitchen.right.id, kitchen.bottom.id, kitchen.left.id], furn: ["counter"] },
    { id: "dining", labelKey: "rooms.diningRoom", wallIds: [dining.top.id, dining.right.id, dining.bottom.id, dining.left.id], furn: ["table"] },
    { id: "master", labelKey: "rooms.masterRoom", wallIds: [master.top.id, master.right.id, master.bottom.id, master.left.id], furn: ["bed"] },
    { id: "bath", labelKey: "rooms.bathroom", wallIds: [bath.top.id, bath.right.id, bath.bottom.id, bath.left.id], furn: ["tub"] },
    { id: "second", labelKey: "rooms.secondRoom", wallIds: [second.top.id, second.right.id, second.bottom.id, second.left.id], furn: ["bed"] },
    { id: "balc", labelKey: "rooms.balcony", wallIds: [balc.top.id, balc.right.id, balc.bottom.id, balc.left.id] },
  ];

  return { walls, rooms };
}

function buildVariant(id: "v1" | "v2" | "v3"): Floorplan {
  const core = id === "v1" ? buildV1() : id === "v2" ? buildV2() : buildV3();
  return {
    id,
    nameKey: `home.workspace.variant.${id}`,
    viewBox: COMMON_VIEWBOX,
    boundary: COMMON_BOUNDARY,
    unit: "m",
    scale: COMMON_SCALE,
    walls: core.walls,
    rooms: core.rooms,
    openings: NO_OPENINGS,
  };
}

export const homeFloorplanVariants: ReadonlyArray<Floorplan> = [
  buildVariant("v1"),
  buildVariant("v2"),
  buildVariant("v3"),
];

export const HOME_VARIANT_IDS: ReadonlyArray<string> = homeFloorplanVariants.map((v) => v.id);

export function getVariantById(id: string): Floorplan | undefined {
  return homeFloorplanVariants.find((v) => v.id === id);
}
