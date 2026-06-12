// lib/architoken/text-to-bim-spec.ts - 结构化 Text-to-BIM 规格：类型、校验、户型推导
// License: Apache-2.0

import {
  rectFromBlock,
  type GeneratedPlan,
} from "./floorplan-layout";
import {
  blockEdges,
  collectBlockOpenings,
  type WallOpening,
} from "./floorplan-drawing";

export interface TextToBimOpening {
  kind: "door" | "window";
  name?: string;
  /** 洞口盒体最小角点，单位米（与构件同一坐标系）。 */
  position: [number, number, number];
  size: [number, number, number];
}

export interface TextToBimElement {
  type: string;
  name?: string;
  description?: string;
  /** 材质名（写入 IfcMaterial 并关联构件）；户型推导为声明式默认假定，BOM 依据列可见。 */
  material?: string;
  /** 盒体最小角点，单位米。 */
  position?: [number, number, number];
  /** 盒体尺寸 (dx, dy, dz)，单位米，全部为正。 */
  size?: [number, number, number];
  /** 宿主构件上的门窗洞口（生成 IfcOpeningElement + IfcDoor/IfcWindow）。 */
  openings?: TextToBimOpening[];
}

export interface TextToBimSpec {
  name: string;
  schema?: "IFC4" | "IFC2X3";
  storeyName?: string;
  elements: TextToBimElement[];
}

const MAX_ELEMENTS = 300;
const MAX_COORD_M = 10_000;
const STOREY_HEIGHT_M = 3.0;
const WALL_HEIGHT_M = 2.8;
const WALL_THICKNESS_M = 0.12;
const SLAB_THICKNESS_M = 0.12;
const DOOR_HEIGHT_M = 2.1;
const WINDOW_SILL_M = 0.9;
const WINDOW_HEIGHT_M = 1.5;

export function validateTextToBimSpec(raw: unknown): TextToBimSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const name =
    typeof value.name === "string" && value.name.trim()
      ? value.name.trim().slice(0, 80)
      : null;
  if (!name || !Array.isArray(value.elements)) return null;
  if (value.elements.length === 0 || value.elements.length > MAX_ELEMENTS) {
    return null;
  }
  const elements: TextToBimElement[] = [];
  for (const item of value.elements) {
    const element = validateElement(item);
    if (!element) return null;
    elements.push(element);
  }
  const schema =
    value.schema === "IFC2X3" || value.schema === "IFC4"
      ? value.schema
      : undefined;
  return {
    name,
    ...(schema ? { schema } : {}),
    ...(typeof value.storeyName === "string" && value.storeyName.trim()
      ? { storeyName: value.storeyName.trim().slice(0, 80) }
      : {}),
    elements,
  };
}

export function floorplanToBimSpec(plan: GeneratedPlan): TextToBimSpec {
  const elements: TextToBimElement[] = [];
  // 同线区间覆盖表：lineKey -> 已发射的 [a0, a1] 区间，消除相邻房间共线墙段的体积重复。
  const wallLineCoverage = new Map<string, Array<[number, number]>>();
  const floors: Array<1 | 2> = plan.floors === 2 ? [1, 2] : [1];

  for (const floor of floors) {
    const baseZ = (floor - 1) * STOREY_HEIGHT_M;
    const wallZ = baseZ + SLAB_THICKNESS_M;
    const floorBlocks = plan.blocks.filter((block) => block.floor === floor);
    // 楼板按房间铺设：覆盖与房间并集精确一致（L 形缺角自然排除，不虚增板量）。
    for (const block of floorBlocks) {
      const rect = rectFromBlock(block);
      elements.push({
        type: "Slab",
        name: `${floor}层楼板`,
        material: "钢筋混凝土",
        position: [round3(rect.x0 / 1000), round3(rect.y0 / 1000), round3(baseZ)],
        size: [round3(rect.w / 1000), round3(rect.h / 1000), SLAB_THICKNESS_M],
      });
    }
    // 先按几何边键聚合全层门窗洞口（与图纸线共用同一启发），墙体去重后洞口不丢。
    const openingsByEdge = collectFloorOpenings(floorBlocks);
    for (const block of floorBlocks) {
      const rect = rectFromBlock(block);
      // 每个房间生成 IfcSpace 空间元素，给 BOM/算量链路提供房间语义与体积。
      elements.push({
        type: "Space",
        name: `${floor}层${block.purpose}`,
        description: `${block.areaSqm.toFixed(1)}㎡`,
        position: [round3(rect.x0 / 1000), round3(rect.y0 / 1000), round3(wallZ)],
        size: [
          round3(rect.w / 1000),
          round3(rect.h / 1000),
          WALL_HEIGHT_M,
        ],
      });
      const rawEdges = [
        { x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y0 },
        { x0: rect.x0, y0: rect.y1, x1: rect.x1, y1: rect.y1 },
        { x0: rect.x0, y0: rect.y0, x1: rect.x0, y1: rect.y1 },
        { x0: rect.x1, y0: rect.y0, x1: rect.x1, y1: rect.y1 },
      ];
      for (const raw of rawEdges) {
        const horizontal = raw.y0 === raw.y1;
        const c = horizontal ? raw.y0 : raw.x0;
        const a0 = horizontal
          ? Math.min(raw.x0, raw.x1)
          : Math.min(raw.y0, raw.y1);
        const a1 = horizontal
          ? Math.max(raw.x0, raw.x1)
          : Math.max(raw.y0, raw.y1);
        const lineKey = `${floor}:${horizontal ? "h" : "v"}:${Math.round(c / 50) * 50}`;
        const covered = wallLineCoverage.get(lineKey) ?? [];
        const freeSegments = subtractCoveredIntervals(a0, a1, covered);
        covered.push([a0, a1]);
        wallLineCoverage.set(lineKey, covered);
        const openingLineKey = `${horizontal ? "h" : "v"}:${Math.round(c / 50) * 50}`;
        const edgeOpenings = openingsByEdge.get(openingLineKey) ?? [];
        for (const [s0, s1] of freeSegments) {
          if (s1 - s0 < 200) continue;
          const edge = horizontal
            ? wallBox(s0, c, s1, c, wallZ)
            : wallBox(c, s0, c, s1, wallZ);
          const openings = edgeOpenings
            .filter(
              (opening) => opening.start >= s0 - 10 && opening.end <= s1 + 10,
            )
            .map((opening) => openingBox(opening, edge, wallZ));
          elements.push({
            type: "Wall",
            name: `${block.purpose}墙`,
            material: "加气混凝土砌块",
            position: edge.position,
            size: edge.size,
            ...(openings.length ? { openings } : {}),
          });
        }
      }
    }
  }

  return {
    name: plan.projectName.slice(0, 80) || "AI 户型模型",
    schema: "IFC4",
    elements,
  };
}

/** 从 [a0, a1] 中减去已覆盖区间，返回剩余自由段。 */
function subtractCoveredIntervals(
  a0: number,
  a1: number,
  covered: ReadonlyArray<[number, number]>,
): Array<[number, number]> {
  let segments: Array<[number, number]> = [[a0, a1]];
  for (const [c0, c1] of covered) {
    const next: Array<[number, number]> = [];
    for (const [s0, s1] of segments) {
      if (c1 <= s0 || c0 >= s1) {
        next.push([s0, s1]);
        continue;
      }
      if (c0 > s0) next.push([s0, c0]);
      if (c1 < s1) next.push([c1, s1]);
    }
    segments = next;
  }
  return segments;
}

/** 按墙线键（轴向 + 线坐标）聚合洞口，与墙段发射的同线去重逻辑对齐。 */
function collectFloorOpenings(
  floorBlocks: ReadonlyArray<GeneratedPlan["blocks"][number]>,
): Map<string, WallOpening[]> {
  const byLine = new Map<string, WallOpening[]>();
  for (const block of floorBlocks) {
    const blockOpenings = collectBlockOpenings(block, floorBlocks);
    const edges = blockEdges(block);
    for (const [edgeIndex, list] of blockOpenings) {
      const edge = edges[edgeIndex];
      if (!edge) continue;
      const key = `${edge.axis}:${Math.round(edge.c / 50) * 50}`;
      byLine.set(key, [...(byLine.get(key) ?? []), ...list]);
    }
  }
  return byLine;
}

function openingBox(
  opening: WallOpening,
  edge: { horizontal: boolean; position: [number, number, number] },
  wallZ: number,
): TextToBimOpening {
  const z =
    opening.kind === "door" ? round3(wallZ) : round3(wallZ + WINDOW_SILL_M);
  const height = opening.kind === "door" ? DOOR_HEIGHT_M : WINDOW_HEIGHT_M;
  const length = round3((opening.end - opening.start) / 1000);
  return {
    kind: opening.kind,
    name: opening.kind === "door" ? "门" : "窗",
    position: edge.horizontal
      ? [round3(opening.start / 1000), edge.position[1], z]
      : [edge.position[0], round3(opening.start / 1000), z],
    size: edge.horizontal
      ? [length, WALL_THICKNESS_M, height]
      : [WALL_THICKNESS_M, length, height],
  };
}

function wallBox(
  x0Mm: number,
  y0Mm: number,
  x1Mm: number,
  y1Mm: number,
  zM: number,
): {
  key: string;
  horizontal: boolean;
  position: [number, number, number];
  size: [number, number, number];
} {
  const half = WALL_THICKNESS_M / 2;
  const x0 = Math.min(x0Mm, x1Mm) / 1000;
  const y0 = Math.min(y0Mm, y1Mm) / 1000;
  const x1 = Math.max(x0Mm, x1Mm) / 1000;
  const y1 = Math.max(y0Mm, y1Mm) / 1000;
  const horizontal = y0 === y1;
  // 沿墙线方向两端各延伸半厚，封闭转角。
  const position: [number, number, number] = [
    round3(x0 - half),
    round3(y0 - half),
    round3(zM),
  ];
  const size: [number, number, number] = horizontal
    ? [round3(x1 - x0 + WALL_THICKNESS_M), WALL_THICKNESS_M, WALL_HEIGHT_M]
    : [WALL_THICKNESS_M, round3(y1 - y0 + WALL_THICKNESS_M), WALL_HEIGHT_M];
  return {
    key: `${Math.round(x0Mm)}:${Math.round(y0Mm)}:${Math.round(x1Mm)}:${Math.round(y1Mm)}`,
    horizontal,
    position,
    size,
  };
}

function validateElement(item: unknown): TextToBimElement | null {
  if (!item || typeof item !== "object") return null;
  const value = item as Record<string, unknown>;
  const type =
    typeof value.type === "string" && value.type.trim()
      ? value.type.trim().slice(0, 64)
      : null;
  if (!type) return null;
  const position = asVector3(value.position);
  const size = asVector3(value.size, { positive: true });
  if (value.position !== undefined && !position) return null;
  if (value.size !== undefined && !size) return null;
  let openings: TextToBimOpening[] | null = null;
  if (value.openings !== undefined) {
    openings = validateOpenings(value.openings);
    if (!openings) return null;
  }
  return {
    type,
    ...(typeof value.name === "string" && value.name.trim()
      ? { name: value.name.trim().slice(0, 80) }
      : {}),
    ...(typeof value.material === "string" && value.material.trim()
      ? { material: value.material.trim().slice(0, 48) }
      : {}),
    ...(typeof value.description === "string" && value.description.trim()
      ? { description: value.description.trim().slice(0, 200) }
      : {}),
    ...(position ? { position } : {}),
    ...(size ? { size } : {}),
    ...(openings?.length ? { openings } : {}),
  };
}

function validateOpenings(raw: unknown): TextToBimOpening[] | null {
  if (!Array.isArray(raw) || raw.length > 16) return null;
  const openings: TextToBimOpening[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const value = item as Record<string, unknown>;
    if (value.kind !== "door" && value.kind !== "window") return null;
    const position = asVector3(value.position);
    const size = asVector3(value.size, { positive: true });
    if (!position || !size) return null;
    openings.push({
      kind: value.kind,
      ...(typeof value.name === "string" && value.name.trim()
        ? { name: value.name.trim().slice(0, 80) }
        : {}),
      position,
      size,
    });
  }
  return openings;
}

function asVector3(
  raw: unknown,
  options: { positive?: boolean } = {},
): [number, number, number] | null {
  if (!Array.isArray(raw) || raw.length !== 3) return null;
  const values: [number, number, number] = [0, 0, 0];
  for (let index = 0; index < 3; index += 1) {
    const item = raw[index];
    const value = typeof item === "number" ? item : Number(item);
    if (!Number.isFinite(value) || Math.abs(value) > MAX_COORD_M) return null;
    if (options.positive && value <= 0) return null;
    values[index] = value;
  }
  return values;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
