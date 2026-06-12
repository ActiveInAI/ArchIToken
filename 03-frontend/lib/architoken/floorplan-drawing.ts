// lib/architoken/floorplan-drawing.ts - GeneratedPlan -> 工程图纸 DXF 实体 / 彩平图 SVG
// License: Apache-2.0

import type {
  CadDrawingEntity,
  CadDrawingSpec,
} from "../panai-cad-drawing";
import {
  rectFromBlock,
  type FurnitureItem,
  type GeneratedPlan,
  type PlanBlock,
} from "./floorplan-layout";

const WALL_THICKNESS_MM = 240;
const WALL_LINE_INSET_MM = WALL_THICKNESS_MM / 2;
const FLOOR_GAP_MM = 6000;
const AXIS_OVERSHOOT_MM = 1200;
const AXIS_BUBBLE_RADIUS_MM = 400;
const AXIS_SNAP_MM = 50;
const DOOR_WIDTH_MM = 900;
const NARROW_DOOR_WIDTH_MM = 800;
const WINDOW_WIDTH_MM = 1500;
const DIM_ROW_1_MM = 1800;
const DIM_ROW_2_MM = 3200;
const DIM_TICK_MM = 200;
const DIM_TEXT_MM = 320;
const FRAME_MARGIN_MM = 1800;
const TITLE_BLOCK_W_MM = 7200;
const TITLE_BLOCK_H_MM = 2400;

// 走廊优先；楼梯/弹性区在无走廊的布局里充当连通空间，保证每个房间都有门可开。
const PUBLIC_PURPOSES = new Set([
  "客厅",
  "公共区",
  "客餐厅一体",
  "餐厅",
  "走廊",
  "过道",
  "楼梯",
  "弹性区",
]);
const NARROW_DOOR_PURPOSES = new Set(["卫生间", "主卫", "储藏"]);
const WINDOW_PURPOSES = new Set([
  "主卧",
  "次卧",
  "客厅",
  "公共区",
  "客餐厅一体",
  "餐厅",
  "厨房",
  "阳台",
]);

export interface WallEdge {
  axis: "h" | "v";
  /** 边所在的常量坐标（h 边为 y，v 边为 x）。 */
  c: number;
  a0: number;
  a1: number;
  /** 朝室内方向的符号（h 边作用于 y，v 边作用于 x）。 */
  inward: 1 | -1;
}

export interface WallOpening {
  start: number;
  end: number;
  kind: "door" | "window";
}

const ROOM_FILL_COLORS: Record<string, string> = {
  主卧: "#bfdbfe",
  次卧: "#dbeafe",
  客厅: "#bbf7d0",
  公共区: "#bbf7d0",
  客餐厅一体: "#bbf7d0",
  餐厅: "#d9f99d",
  厨房: "#fde68a",
  卫生间: "#e0e7ff",
  主卫: "#e0e7ff",
  阳台: "#ccfbf1",
  楼梯: "#e5e7eb",
  走廊: "#f1f5f9",
  储藏: "#f5d0fe",
};
const ROOM_FILL_FALLBACK = "#f3f4f6";

export function floorplanToDrawingSpec(plan: GeneratedPlan): CadDrawingSpec {
  const entities: CadDrawingEntity[] = [];
  const notes: string[] = [
    `户型图纸由布局内核生成，墙厚按 ${WALL_THICKNESS_MM}mm 双线绘制；门窗洞口为基于布局邻接关系的启发结果，需专业复核。`,
  ];
  const [envW, envH] = plan.summary.envelope;
  const floors = floorNumbers(plan);

  floors.forEach((floor, index) => {
    const offsetX = index * (envW + FLOOR_GAP_MM);
    const blocks = plan.blocks.filter((block) => block.floor === floor);
    entities.push(...floorAxisGridEntities(blocks, offsetX));
    for (const block of blocks) {
      const openings = collectBlockOpenings(block, blocks);
      entities.push(...blockWallEntities(block, offsetX, openings));
      entities.push(blockLabelEntity(block, offsetX));
    }
    entities.push(...floorDimensionEntities(blocks, offsetX, envH));
    entities.push({
      type: "text",
      position: [
        offsetX + envW / 2 - 1800,
        envH + DIM_ROW_2_MM + DIM_TEXT_MM * 4,
      ],
      height: 600,
      value: `${floors.length > 1 ? `${floor}层` : ""}平面图 ${formatMeters(envW)}×${formatMeters(envH)}`,
      layer: "TEXT",
    });
  });

  entities.push(...frameAndTitleBlockEntities(entities, plan));
  flipYInPlace(entities);

  notes.push(
    `轴网取自房间边界线，含轴间距与总尺寸两道标注；图面含 ${floors.length} 个楼层平面、图框图签，外包络 ${formatMeters(envW)}×${formatMeters(envH)}。`,
  );
  return {
    name: safeDrawingName(plan.projectId),
    units: "mm",
    entities,
    metadata: {
      sourcePrompt: plan.projectName,
      parser: "heuristic",
      notes,
    },
  };
}

export function renderFloorplanColorSvg(
  plan: GeneratedPlan,
  furniture: ReadonlyArray<FurnitureItem> = [],
): string {
  const [envW, envH] = plan.summary.envelope;
  const margin = 1200;
  const titleBand = 1600;
  const footerBand = 1400;
  const floors = floorNumbers(plan);
  const totalW = floors.length * envW + (floors.length - 1) * FLOOR_GAP_MM + margin * 2;
  const totalH = envH + margin * 2 + titleBand + footerBand;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${Math.round(totalW / 12)}" height="${Math.round(totalH / 12)}" font-family="'Noto Sans SC',sans-serif">`,
    `<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#ffffff"/>`,
  );

  floors.forEach((floor, index) => {
    const ox = margin + index * (envW + FLOOR_GAP_MM);
    const oy = margin + titleBand;
    const blocks = plan.blocks.filter((block) => block.floor === floor);
    parts.push(
      `<text x="${ox + envW / 2}" y="${margin + titleBand / 2}" text-anchor="middle" font-size="640" fill="#0f172a">${floors.length > 1 ? `${floor}层彩平图` : "彩平图"}</text>`,
    );
    for (const block of blocks) {
      const rect = rectFromBlock(block);
      const fill = ROOM_FILL_COLORS[block.purpose] ?? ROOM_FILL_FALLBACK;
      parts.push(
        `<rect x="${ox + rect.x0}" y="${oy + rect.y0}" width="${rect.w}" height="${rect.h}" fill="${fill}" stroke="#334155" stroke-width="${WALL_THICKNESS_MM / 2}"/>`,
      );
      const fontSize = clamp(Math.min(rect.w, rect.h) / 6, 260, 560);
      parts.push(
        `<text x="${ox + rect.x0 + rect.w / 2}" y="${oy + rect.y0 + rect.h / 2 - fontSize * 0.2}" text-anchor="middle" font-size="${fontSize}" fill="#1e293b">${escapeXml(block.purpose)}</text>`,
        `<text x="${ox + rect.x0 + rect.w / 2}" y="${oy + rect.y0 + rect.h / 2 + fontSize}" text-anchor="middle" font-size="${fontSize * 0.75}" fill="#475569">${block.areaSqm.toFixed(1)}㎡</text>`,
      );
    }
    for (const item of furniture) {
      if (item.floor !== floor) continue;
      parts.push(
        `<rect x="${ox + item.x0}" y="${oy + item.y0}" width="${item.w}" height="${item.h}" rx="80" fill="${item.color}" stroke="#64748b" stroke-width="40"/>`,
        `<text x="${ox + item.x0 + item.w / 2}" y="${oy + item.y0 + item.h / 2 + 90}" text-anchor="middle" font-size="260" fill="#334155">${escapeXml(item.label)}</text>`,
      );
    }
  });

  parts.push(
    `<text x="${margin}" y="${totalH - footerBand / 2}" font-size="420" fill="#475569">${escapeXml(plan.projectName)} · 外包络 ${formatMeters(envW)}×${formatMeters(envH)} · 房间合计 ${plan.summary.totalRoomSqm.toFixed(1)}㎡ · AI 生成彩平图，需专业复核</text>`,
    "</svg>",
  );
  return parts.join("\n");
}

export function blockEdges(block: PlanBlock): WallEdge[] {
  const rect = rectFromBlock(block);
  return [
    { axis: "h", c: rect.y0, a0: rect.x0, a1: rect.x1, inward: 1 },
    { axis: "h", c: rect.y1, a0: rect.x0, a1: rect.x1, inward: -1 },
    { axis: "v", c: rect.x0, a0: rect.y0, a1: rect.y1, inward: 1 },
    { axis: "v", c: rect.x1, a0: rect.y0, a1: rect.y1, inward: -1 },
  ];
}

export function collectBlockOpenings(
  block: PlanBlock,
  blocks: ReadonlyArray<PlanBlock>,
): Map<number, WallOpening[]> {
  const openings = new Map<number, WallOpening[]>();
  const edges = blockEdges(block);
  const isPublic = PUBLIC_PURPOSES.has(block.purpose);

  // 门：私有房间在与公共区共享的墙上开门，公共区之间不重复开门。
  if (!isPublic && block.purpose !== "阳台") {
    const doorWidth = NARROW_DOOR_PURPOSES.has(block.purpose)
      ? NARROW_DOOR_WIDTH_MM
      : DOOR_WIDTH_MM;
    placement: for (let index = 0; index < edges.length; index += 1) {
      const edge = edges[index] as WallEdge;
      for (const neighbor of blocks) {
        if (neighbor.id === block.id || !PUBLIC_PURPOSES.has(neighbor.purpose))
          continue;
        for (const other of blockEdges(neighbor)) {
          if (other.axis !== edge.axis) continue;
          if (Math.abs(other.c - edge.c) > 100) continue;
          const overlap0 = Math.max(edge.a0, other.a0);
          const overlap1 = Math.min(edge.a1, other.a1);
          if (overlap1 - overlap0 < doorWidth + 300) continue;
          const mid = (overlap0 + overlap1) / 2;
          pushOpening(openings, index, {
            start: mid - doorWidth / 2,
            end: mid + doorWidth / 2,
            kind: "door",
          });
          break placement;
        }
      }
    }
  }

  // 窗：可采光房间在外墙段（无邻接房间覆盖的边段）开窗——对矩形和 L 形体量都成立。
  // 窗宽按窗地比 1/7 需求反推（窗高按 1.5m 计），受外墙段长度约束。
  if (WINDOW_PURPOSES.has(block.purpose)) {
    const requiredWidth = Math.ceil(((block.areaSqm / 7 / 1.5) * 1000) / 50) * 50;
    for (let index = 0; index < edges.length; index += 1) {
      const edge = edges[index] as WallEdge;
      const interval = largestExteriorInterval(edge, block, blocks);
      if (!interval) continue;
      const width = Math.min(
        Math.max(WINDOW_WIDTH_MM, requiredWidth),
        interval.end - interval.start - 600,
      );
      if (width < 600) continue;
      const mid = (interval.start + interval.end) / 2;
      pushOpening(openings, index, {
        start: mid - width / 2,
        end: mid + width / 2,
        kind: "window",
      });
      break;
    }
  }
  return openings;
}

/** 返回边上未被任何邻接房间覆盖的最长子区间（即真实外墙段）。 */
function largestExteriorInterval(
  edge: WallEdge,
  block: PlanBlock,
  blocks: ReadonlyArray<PlanBlock>,
): { start: number; end: number } | null {
  const covered: Array<[number, number]> = [];
  for (const neighbor of blocks) {
    if (neighbor.id === block.id) continue;
    for (const other of blockEdges(neighbor)) {
      if (other.axis !== edge.axis) continue;
      if (Math.abs(other.c - edge.c) > 100) continue;
      const overlap0 = Math.max(edge.a0, other.a0);
      const overlap1 = Math.min(edge.a1, other.a1);
      if (overlap1 - overlap0 >= 300) covered.push([overlap0, overlap1]);
    }
  }
  covered.sort((a, b) => a[0] - b[0]);
  let best: { start: number; end: number } | null = null;
  let cursor = edge.a0;
  for (const [start, end] of [...covered, [edge.a1, edge.a1] as [number, number]]) {
    if (start - cursor >= 1200 && (!best || start - cursor > best.end - best.start)) {
      best = { start: cursor, end: start };
    }
    cursor = Math.max(cursor, end);
  }
  return best;
}

function pushOpening(
  openings: Map<number, WallOpening[]>,
  edgeIndex: number,
  opening: WallOpening,
): void {
  const list = openings.get(edgeIndex) ?? [];
  list.push(opening);
  openings.set(edgeIndex, list);
}

function blockWallEntities(
  block: PlanBlock,
  offsetX: number,
  openings: Map<number, WallOpening[]>,
): CadDrawingEntity[] {
  const entities: CadDrawingEntity[] = [];
  const edges = blockEdges(block);
  edges.forEach((edge, index) => {
    const edgeOpenings = [...(openings.get(index) ?? [])].sort(
      (a, b) => a.start - b.start,
    );
    const innerC = edge.c + WALL_LINE_INSET_MM * edge.inward;
    // 边线与内线在洞口处断开；洞口两端补门垛短线。
    let cursor = edge.a0;
    for (const opening of edgeOpenings) {
      entities.push(
        wallLine(edge, cursor, opening.start, edge.c, offsetX),
        wallLine(edge, cursor, opening.start, innerC, offsetX),
        jambLine(edge, opening.start, edge.c, innerC, offsetX),
        jambLine(edge, opening.end, edge.c, innerC, offsetX),
      );
      if (opening.kind === "door") {
        entities.push(...doorSymbol(edge, opening, offsetX));
      } else {
        entities.push(...windowSymbol(edge, opening, innerC, offsetX));
      }
      cursor = opening.end;
    }
    entities.push(
      wallLine(edge, cursor, edge.a1, edge.c, offsetX),
      wallLine(edge, cursor, edge.a1, innerC, offsetX),
    );
  });
  return entities;
}

function wallLine(
  edge: WallEdge,
  a0: number,
  a1: number,
  c: number,
  offsetX: number,
): CadDrawingEntity {
  return edge.axis === "h"
    ? {
        type: "line",
        start: [offsetX + a0, c],
        end: [offsetX + a1, c],
        layer: "WALL",
      }
    : {
        type: "line",
        start: [offsetX + c, a0],
        end: [offsetX + c, a1],
        layer: "WALL",
      };
}

function jambLine(
  edge: WallEdge,
  a: number,
  c0: number,
  c1: number,
  offsetX: number,
): CadDrawingEntity {
  return edge.axis === "h"
    ? {
        type: "line",
        start: [offsetX + a, c0],
        end: [offsetX + a, c1],
        layer: "WALL",
      }
    : {
        type: "line",
        start: [offsetX + c0, a],
        end: [offsetX + c1, a],
        layer: "WALL",
      };
}

function doorSymbol(
  edge: WallEdge,
  opening: WallOpening,
  offsetX: number,
): CadDrawingEntity[] {
  const width = opening.end - opening.start;
  const hinge: [number, number] =
    edge.axis === "h"
      ? [offsetX + opening.start, edge.c]
      : [offsetX + edge.c, opening.start];
  const openDir: [number, number] = edge.axis === "h" ? [1, 0] : [0, 1];
  const inwardDir: [number, number] =
    edge.axis === "h" ? [0, edge.inward] : [edge.inward, 0];
  const leafEnd: [number, number] = [
    hinge[0] + inwardDir[0] * width,
    hinge[1] + inwardDir[1] * width,
  ];
  const angleOpen = vectorAngle(openDir);
  const angleLeaf = vectorAngle(inwardDir);
  const ccw = (angleLeaf - angleOpen + 360) % 360 === 90;
  return [
    { type: "line", start: hinge, end: leafEnd, layer: "DOOR" },
    {
      type: "arc",
      center: hinge,
      radius: width,
      startAngle: ccw ? angleOpen : angleLeaf,
      endAngle: ccw ? angleLeaf : angleOpen,
      layer: "DOOR",
    },
  ];
}

function windowSymbol(
  edge: WallEdge,
  opening: WallOpening,
  innerC: number,
  offsetX: number,
): CadDrawingEntity[] {
  const midC = (edge.c + innerC) / 2;
  return [edge.c, midC, innerC].map((c) => wallLineOnLayer(edge, opening.start, opening.end, c, offsetX, "WINDOW"));
}

function wallLineOnLayer(
  edge: WallEdge,
  a0: number,
  a1: number,
  c: number,
  offsetX: number,
  layer: string,
): CadDrawingEntity {
  const line = wallLine(edge, a0, a1, c, offsetX);
  return { ...line, layer } as CadDrawingEntity;
}

function vectorAngle(direction: [number, number]): number {
  return (
    (Math.atan2(direction[1], direction[0]) * 180) / Math.PI + 360
  ) % 360;
}

function blockLabelEntity(block: PlanBlock, offsetX: number): CadDrawingEntity {
  const rect = rectFromBlock(block);
  const height = clamp(Math.min(rect.w, rect.h) / 8, 200, 480);
  return {
    type: "text",
    position: [
      offsetX + rect.x0 + rect.w / 2 - height * 2,
      rect.y0 + rect.h / 2,
    ],
    height,
    value: `${block.purpose} ${block.areaSqm.toFixed(1)}㎡`,
    layer: "TEXT",
  };
}

function floorAxisGridEntities(
  blocks: ReadonlyArray<PlanBlock>,
  offsetX: number,
): CadDrawingEntity[] {
  const xs = new Set<number>();
  const ys = new Set<number>();
  let maxX = 0;
  let maxY = 0;
  for (const block of blocks) {
    const rect = rectFromBlock(block);
    xs.add(snapAxis(rect.x0));
    xs.add(snapAxis(rect.x1));
    ys.add(snapAxis(rect.y0));
    ys.add(snapAxis(rect.y1));
    maxX = Math.max(maxX, rect.x1);
    maxY = Math.max(maxY, rect.y1);
  }
  const entities: CadDrawingEntity[] = [];
  const sortedXs = [...xs].sort((a, b) => a - b);
  const sortedYs = [...ys].sort((a, b) => a - b);
  sortedXs.forEach((x, index) => {
    entities.push(
      {
        type: "line",
        start: [offsetX + x, -AXIS_OVERSHOOT_MM],
        end: [offsetX + x, maxY + AXIS_OVERSHOOT_MM],
        layer: "AXIS",
      },
      {
        type: "circle",
        center: [offsetX + x, -AXIS_OVERSHOOT_MM - AXIS_BUBBLE_RADIUS_MM],
        radius: AXIS_BUBBLE_RADIUS_MM,
        layer: "AXIS",
      },
      {
        type: "text",
        position: [
          offsetX + x - AXIS_BUBBLE_RADIUS_MM / 3,
          -AXIS_OVERSHOOT_MM - AXIS_BUBBLE_RADIUS_MM * 1.4,
        ],
        height: AXIS_BUBBLE_RADIUS_MM,
        value: String(index + 1),
        layer: "TEXT",
      },
    );
  });
  sortedYs.forEach((y, index) => {
    entities.push(
      {
        type: "line",
        start: [offsetX - AXIS_OVERSHOOT_MM, y],
        end: [offsetX + maxX + AXIS_OVERSHOOT_MM, y],
        layer: "AXIS",
      },
      {
        type: "circle",
        center: [offsetX - AXIS_OVERSHOOT_MM - AXIS_BUBBLE_RADIUS_MM, y],
        radius: AXIS_BUBBLE_RADIUS_MM,
        layer: "AXIS",
      },
      {
        type: "text",
        position: [
          offsetX - AXIS_OVERSHOOT_MM - AXIS_BUBBLE_RADIUS_MM * 1.4,
          y - AXIS_BUBBLE_RADIUS_MM / 2,
        ],
        height: AXIS_BUBBLE_RADIUS_MM,
        value: axisLetter(index),
        layer: "TEXT",
      },
    );
  });
  return entities;
}

function floorDimensionEntities(
  blocks: ReadonlyArray<PlanBlock>,
  offsetX: number,
  envH: number,
): CadDrawingEntity[] {
  const xs = new Set<number>();
  const ys = new Set<number>();
  for (const block of blocks) {
    const rect = rectFromBlock(block);
    xs.add(snapAxis(rect.x0));
    xs.add(snapAxis(rect.x1));
    ys.add(snapAxis(rect.y0));
    ys.add(snapAxis(rect.y1));
  }
  const sortedXs = [...xs].sort((a, b) => a - b);
  const sortedYs = [...ys].sort((a, b) => a - b);
  const entities: CadDrawingEntity[] = [];

  // 水平方向两道标注画在平面下方（数据坐标 y 增大方向），竖直方向画在轴号气泡左侧。
  entities.push(
    ...horizontalDimensionRow(sortedXs, envH + DIM_ROW_1_MM, offsetX, false),
    ...horizontalDimensionRow(
      [sortedXs[0] as number, sortedXs[sortedXs.length - 1] as number],
      envH + DIM_ROW_2_MM,
      offsetX,
      true,
    ),
    ...verticalDimensionRow(
      sortedYs,
      offsetX - AXIS_OVERSHOOT_MM - AXIS_BUBBLE_RADIUS_MM * 2 - DIM_ROW_1_MM,
      false,
    ),
    ...verticalDimensionRow(
      [sortedYs[0] as number, sortedYs[sortedYs.length - 1] as number],
      offsetX - AXIS_OVERSHOOT_MM - AXIS_BUBBLE_RADIUS_MM * 2 - DIM_ROW_2_MM,
      true,
    ),
  );
  return entities;
}

function horizontalDimensionRow(
  stops: ReadonlyArray<number>,
  y: number,
  offsetX: number,
  overall: boolean,
): CadDrawingEntity[] {
  const entities: CadDrawingEntity[] = [];
  const first = stops[0] as number;
  const last = stops[stops.length - 1] as number;
  entities.push({
    type: "line",
    start: [offsetX + first, y],
    end: [offsetX + last, y],
    layer: "DIM",
  });
  for (const stop of stops) {
    entities.push(
      {
        type: "line",
        start: [offsetX + stop, y - DIM_TICK_MM * 2],
        end: [offsetX + stop, y + DIM_TICK_MM],
        layer: "DIM",
      },
      {
        type: "line",
        start: [offsetX + stop - DIM_TICK_MM / 2, y + DIM_TICK_MM / 2],
        end: [offsetX + stop + DIM_TICK_MM / 2, y - DIM_TICK_MM / 2],
        layer: "DIM",
      },
    );
  }
  for (let index = 0; index + 1 < stops.length; index += 1) {
    const a = stops[index] as number;
    const b = stops[index + 1] as number;
    const span = Math.round(b - a);
    if (!overall && span < 600) continue;
    entities.push({
      type: "text",
      position: [offsetX + (a + b) / 2 - DIM_TEXT_MM, y - DIM_TEXT_MM * 1.3],
      height: DIM_TEXT_MM,
      value: String(span),
      layer: "DIM",
    });
  }
  return entities;
}

function verticalDimensionRow(
  stops: ReadonlyArray<number>,
  x: number,
  overall: boolean,
): CadDrawingEntity[] {
  const entities: CadDrawingEntity[] = [];
  const first = stops[0] as number;
  const last = stops[stops.length - 1] as number;
  entities.push({
    type: "line",
    start: [x, first],
    end: [x, last],
    layer: "DIM",
  });
  for (const stop of stops) {
    entities.push(
      {
        type: "line",
        start: [x - DIM_TICK_MM, stop],
        end: [x + DIM_TICK_MM * 2, stop],
        layer: "DIM",
      },
      {
        type: "line",
        start: [x - DIM_TICK_MM / 2, stop - DIM_TICK_MM / 2],
        end: [x + DIM_TICK_MM / 2, stop + DIM_TICK_MM / 2],
        layer: "DIM",
      },
    );
  }
  for (let index = 0; index + 1 < stops.length; index += 1) {
    const a = stops[index] as number;
    const b = stops[index + 1] as number;
    const span = Math.round(b - a);
    if (!overall && span < 600) continue;
    entities.push({
      type: "text",
      position: [x - DIM_TEXT_MM * 1.6, (a + b) / 2],
      height: DIM_TEXT_MM,
      value: String(span),
      layer: "DIM",
    });
  }
  return entities;
}

function frameAndTitleBlockEntities(
  content: ReadonlyArray<CadDrawingEntity>,
  plan: GeneratedPlan,
): CadDrawingEntity[] {
  const bounds = entityBounds(content);
  const x0 = bounds.minX - FRAME_MARGIN_MM;
  const y0 = bounds.minY - FRAME_MARGIN_MM;
  const x1 = bounds.maxX + FRAME_MARGIN_MM;
  const y1 = bounds.maxY + FRAME_MARGIN_MM + TITLE_BLOCK_H_MM;
  const entities: CadDrawingEntity[] = [
    {
      type: "polyline",
      points: rectanglePoints(x0, y0, x1 - x0, y1 - y0),
      closed: true,
      layer: "FRAME",
    },
    {
      type: "polyline",
      points: rectanglePoints(
        x0 + 300,
        y0 + 300,
        x1 - x0 - 600,
        y1 - y0 - 600,
      ),
      closed: true,
      layer: "FRAME",
    },
  ];

  // 图签表格放在图框内右下角。
  const tx0 = x1 - 300 - TITLE_BLOCK_W_MM;
  const ty0 = y1 - 300 - TITLE_BLOCK_H_MM;
  entities.push({
    type: "polyline",
    points: rectanglePoints(tx0, ty0, TITLE_BLOCK_W_MM, TITLE_BLOCK_H_MM),
    closed: true,
    layer: "FRAME",
  });
  const rows: Array<[string, string]> = [
    ["项目", plan.projectName.slice(0, 24)],
    ["图名", `户型平面图 1:100`],
    ["图号", plan.projectId.slice(0, 28)],
    ["状态", "AI 生成 · 需专业复核"],
  ];
  const rowH = TITLE_BLOCK_H_MM / rows.length;
  rows.forEach(([label, value], index) => {
    const rowY = ty0 + rowH * index;
    if (index > 0) {
      entities.push({
        type: "line",
        start: [tx0, rowY],
        end: [tx0 + TITLE_BLOCK_W_MM, rowY],
        layer: "FRAME",
      });
    }
    entities.push(
      {
        type: "text",
        position: [tx0 + 200, rowY + rowH / 2],
        height: 300,
        value: label,
        layer: "TEXT",
      },
      {
        type: "text",
        position: [tx0 + 1400, rowY + rowH / 2],
        height: 300,
        value,
        layer: "TEXT",
      },
    );
  });
  entities.push({
    type: "line",
    start: [tx0 + 1200, ty0],
    end: [tx0 + 1200, ty0 + TITLE_BLOCK_H_MM],
    layer: "FRAME",
  });
  return entities;
}

function entityBounds(entities: ReadonlyArray<CadDrawingEntity>): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const entity of entities) {
    if (entity.type === "line") {
      visit(...entity.start);
      visit(...entity.end);
    } else if (entity.type === "circle" || entity.type === "arc") {
      visit(entity.center[0] - entity.radius, entity.center[1] - entity.radius);
      visit(entity.center[0] + entity.radius, entity.center[1] + entity.radius);
    } else if (entity.type === "polyline") {
      for (const point of entity.points) visit(point[0], point[1]);
    } else {
      visit(...entity.position);
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * 布局内核数据为 y 向下（屏幕坐标），DXF 为 y 向上；整体取负翻转，
 * 让图纸在 CAD 中北朝上，与彩平图/线稿视觉一致。
 */
function flipYInPlace(entities: CadDrawingEntity[]): void {
  for (let index = 0; index < entities.length; index += 1) {
    const entity = entities[index] as CadDrawingEntity;
    if (entity.type === "line") {
      entities[index] = {
        ...entity,
        start: [entity.start[0], -entity.start[1]],
        end: [entity.end[0], -entity.end[1]],
      };
    } else if (entity.type === "circle") {
      entities[index] = {
        ...entity,
        center: [entity.center[0], -entity.center[1]],
      };
    } else if (entity.type === "arc") {
      entities[index] = {
        ...entity,
        center: [entity.center[0], -entity.center[1]],
        startAngle: (360 - entity.endAngle) % 360,
        endAngle: (360 - entity.startAngle) % 360,
      };
    } else if (entity.type === "polyline") {
      entities[index] = {
        ...entity,
        points: entity.points.map((point) => [point[0], -point[1]]),
      };
    } else {
      entities[index] = {
        ...entity,
        position: [entity.position[0], -entity.position[1]],
      };
    }
  }
}

function floorNumbers(plan: GeneratedPlan): Array<1 | 2> {
  return plan.floors === 2 ? [1, 2] : [1];
}

function rectanglePoints(
  x: number,
  y: number,
  width: number,
  height: number,
): Array<[number, number]> {
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
}

function snapAxis(value: number): number {
  return Math.round(value / AXIS_SNAP_MM) * AXIS_SNAP_MM;
}

function axisLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function formatMeters(valueMm: number): string {
  return `${(valueMm / 1000).toFixed(1)}m`;
}

function safeDrawingName(value: string): string {
  const safe = value.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 48);
  return safe || "floorplan";
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
