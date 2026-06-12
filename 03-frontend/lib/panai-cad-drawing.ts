// lib/panai-cad-drawing.ts - PanAI CAD绘图助手: NL drawing spec -> real DXF entities
// License: Apache-2.0

export type CadDrawingEntity =
  | {
      type: "line";
      start: [number, number];
      end: [number, number];
      layer?: string;
    }
  | {
      type: "circle";
      center: [number, number];
      radius: number;
      layer?: string;
    }
  | {
      type: "arc";
      center: [number, number];
      radius: number;
      startAngle: number;
      endAngle: number;
      layer?: string;
    }
  | {
      type: "polyline";
      points: Array<[number, number]>;
      closed?: boolean;
      layer?: string;
    }
  | {
      type: "text";
      position: [number, number];
      height: number;
      value: string;
      layer?: string;
    };

export interface CadDrawingSpec {
  name: string;
  units: "mm";
  entities: CadDrawingEntity[];
  metadata: {
    sourcePrompt: string;
    parser: "heuristic" | "llm";
    notes: string[];
  };
}

const DXF_LAYERS: Array<{ name: string; color: number }> = [
  { name: "0", color: 7 },
  { name: "WALL", color: 4 },
  { name: "GEOM", color: 7 },
  { name: "AXIS", color: 1 },
  { name: "TEXT", color: 3 },
  { name: "DOOR", color: 2 },
  { name: "WINDOW", color: 5 },
  { name: "DIM", color: 6 },
  { name: "FRAME", color: 7 },
];

const MAX_ENTITIES = 500;
const MAX_COORD_MM = 10_000_000;
const DEFAULT_WALL_THICKNESS_MM = 240;
const DEFAULT_AXIS_SPACING_MM = 6000;

export function parseCadDrawingSpec(input: string): CadDrawingSpec | null {
  const notes: string[] = [];
  const entities: CadDrawingEntity[] = [];
  let cursorX = 0;
  let name = "panai_drawing";

  const rect = parseRectangleRequest(input);
  if (rect) {
    const { widthMm, heightMm, withWall } = rect;
    entities.push({
      type: "polyline",
      points: rectanglePoints(cursorX, 0, widthMm, heightMm),
      closed: true,
      layer: withWall ? "WALL" : "GEOM",
    });
    if (withWall) {
      const t = DEFAULT_WALL_THICKNESS_MM;
      if (widthMm > t * 2 && heightMm > t * 2) {
        entities.push({
          type: "polyline",
          points: rectanglePoints(
            cursorX + t,
            t,
            widthMm - t * 2,
            heightMm - t * 2,
          ),
          closed: true,
          layer: "WALL",
        });
        notes.push(`房间按双线墙绘制，默认墙厚 ${t}mm。`);
      }
    }
    const textHeight = clampTextHeight(Math.min(widthMm, heightMm) / 15);
    entities.push({
      type: "text",
      position: [cursorX + widthMm / 2 - textHeight * 3, heightMm / 2],
      height: textHeight,
      value: `${formatMm(widthMm)} x ${formatMm(heightMm)}`,
      layer: "TEXT",
    });
    cursorX += widthMm + 1000;
    name = withWall ? "room_plan" : "rectangle";
  }

  const circle = parseCircleRequest(input);
  if (circle) {
    entities.push({
      type: "circle",
      center: [cursorX + circle.radiusMm, 0],
      radius: circle.radiusMm,
      layer: "GEOM",
    });
    entities.push({
      type: "text",
      position: [cursorX + circle.radiusMm * 0.4, circle.radiusMm + 200],
      height: clampTextHeight(circle.radiusMm / 8),
      value: `R${formatMm(circle.radiusMm)}`,
      layer: "TEXT",
    });
    cursorX += circle.radiusMm * 2 + 1000;
    if (name === "panai_drawing") name = "circle";
  }

  const grid = parseAxisGridRequest(input);
  if (grid) {
    entities.push(...buildAxisGridEntities(cursorX, grid, notes));
    cursorX += grid.xSpans * grid.spacingXMm + 3000;
    if (name === "panai_drawing") name = "axis_grid";
  }

  const line = parseLineRequest(input);
  if (line) {
    entities.push({
      type: "line",
      start: [cursorX, 0],
      end: [cursorX + line.lengthMm, 0],
      layer: "GEOM",
    });
    cursorX += line.lengthMm + 1000;
    if (name === "panai_drawing") name = "line";
  }

  if (entities.length === 0) {
    return null;
  }

  notes.push("未注明单位时，数值 ≤ 100 按米解析，其余按毫米解析。");
  return {
    name,
    units: "mm",
    entities,
    metadata: { sourcePrompt: input, parser: "heuristic", notes },
  };
}

export function validateCadDrawingEntities(
  raw: unknown,
): CadDrawingEntity[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ENTITIES) {
    return null;
  }
  const entities: CadDrawingEntity[] = [];
  for (const item of raw) {
    const entity = validateOneEntity(item);
    if (!entity) return null;
    entities.push(entity);
  }
  return entities;
}

export function renderCadDrawingDxf(spec: CadDrawingSpec): string {
  const lines: string[] = [];
  const push = (code: number, value: string | number) => {
    lines.push(String(code), String(value));
  };

  push(0, "SECTION");
  push(2, "HEADER");
  push(9, "$ACADVER");
  push(1, "AC1009");
  push(0, "ENDSEC");

  push(0, "SECTION");
  push(2, "TABLES");
  push(0, "TABLE");
  push(2, "LAYER");
  push(70, DXF_LAYERS.length);
  for (const layer of DXF_LAYERS) {
    push(0, "LAYER");
    push(2, layer.name);
    push(70, 0);
    push(62, layer.color);
    push(6, "CONTINUOUS");
  }
  push(0, "ENDTAB");
  push(0, "ENDSEC");

  push(0, "SECTION");
  push(2, "ENTITIES");
  for (const entity of spec.entities) {
    renderEntity(entity, push);
  }
  push(0, "ENDSEC");
  push(0, "EOF");
  return `${lines.join("\n")}\n`;
}

function renderEntity(
  entity: CadDrawingEntity,
  push: (code: number, value: string | number) => void,
): void {
  const layer = normalizeLayer(entity.layer);
  if (entity.type === "line") {
    push(0, "LINE");
    push(8, layer);
    push(10, fmt(entity.start[0]));
    push(20, fmt(entity.start[1]));
    push(30, 0);
    push(11, fmt(entity.end[0]));
    push(21, fmt(entity.end[1]));
    push(31, 0);
    return;
  }
  if (entity.type === "circle") {
    push(0, "CIRCLE");
    push(8, layer);
    push(10, fmt(entity.center[0]));
    push(20, fmt(entity.center[1]));
    push(30, 0);
    push(40, fmt(entity.radius));
    return;
  }
  if (entity.type === "arc") {
    push(0, "ARC");
    push(8, layer);
    push(10, fmt(entity.center[0]));
    push(20, fmt(entity.center[1]));
    push(30, 0);
    push(40, fmt(entity.radius));
    push(50, fmt(entity.startAngle));
    push(51, fmt(entity.endAngle));
    return;
  }
  if (entity.type === "polyline") {
    push(0, "POLYLINE");
    push(8, layer);
    push(66, 1);
    push(70, entity.closed ? 1 : 0);
    for (const point of entity.points) {
      push(0, "VERTEX");
      push(8, layer);
      push(10, fmt(point[0]));
      push(20, fmt(point[1]));
      push(30, 0);
    }
    push(0, "SEQEND");
    push(8, layer);
    return;
  }
  push(0, "TEXT");
  push(8, layer);
  push(10, fmt(entity.position[0]));
  push(20, fmt(entity.position[1]));
  push(30, 0);
  push(40, fmt(entity.height));
  push(1, escapeDxfText(entity.value.slice(0, 256)));
}

/**
 * 非 ASCII 字符按 DXF R12/AutoCAD 规范写成固定 4 位 \U+XXXX 转义
 * （按 UTF-16 码元，非 BMP 字符自然成对），文件保持纯 ASCII 字节，
 * 避免外部 CAD 按本地码页（GBK/cp1252）误读 UTF-8 中文。
 */
export function escapeDxfText(value: string): string {
  let out = "";
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    out +=
      unit > 126
        ? `\\U+${unit.toString(16).toUpperCase().padStart(4, "0")}`
        : value[index];
  }
  return out;
}

function parseRectangleRequest(input: string): {
  widthMm: number;
  heightMm: number;
  withWall: boolean;
} | null {
  if (!/(房间|矩形|楼板|底板|平面)/.test(input)) return null;
  const size = input.match(
    /(\d+(?:\.\d+)?)\s*(毫米|mm|厘米|cm|米|m)?\s*[x×X*乘]\s*(\d+(?:\.\d+)?)\s*(毫米|mm|厘米|cm|米|m)?/,
  );
  if (!size) return null;
  const widthMm = toMm(Number(size[1]), size[2] ?? size[4]);
  const heightMm = toMm(Number(size[3]), size[4] ?? size[2]);
  if (!isUsableLength(widthMm) || !isUsableLength(heightMm)) return null;
  return { widthMm, heightMm, withWall: /(房间|墙)/.test(input) };
}

function parseCircleRequest(input: string): { radiusMm: number } | null {
  if (!/(圆形|圆圈|圆\b|画[^，。\n]{0,10}圆|半径|直径)/.test(input)) {
    return null;
  }
  const radius = input.match(
    /半径\s*(?:为|=|:|：)?\s*(\d+(?:\.\d+)?)\s*(毫米|mm|厘米|cm|米|m)?/,
  );
  const diameter = input.match(
    /直径\s*(?:为|=|:|：)?\s*(\d+(?:\.\d+)?)\s*(毫米|mm|厘米|cm|米|m)?/,
  );
  if (!radius && !diameter) return null;
  const radiusMm = radius
    ? toMm(Number(radius[1]), radius[2])
    : toMm(Number(diameter![1]), diameter![2]) / 2;
  if (!isUsableLength(radiusMm)) return null;
  return { radiusMm };
}

interface AxisGridRequest {
  xSpans: number;
  ySpans: number;
  spacingXMm: number;
  spacingYMm: number;
}

function parseAxisGridRequest(input: string): AxisGridRequest | null {
  if (!/(轴网|轴线网|柱网)/.test(input)) return null;
  const spans = input.match(/(\d+)\s*跨?\s*[x×X*乘]\s*(\d+)\s*跨?/);
  const xSpans = clampSpan(spans ? Number(spans[1]) : 3);
  const ySpans = clampSpan(spans ? Number(spans[2]) : 3);
  const spacing = input.match(
    /(?:跨距|间距|柱距)\s*(?:为|=|:|：)?\s*(\d+(?:\.\d+)?)\s*(毫米|mm|厘米|cm|米|m)?/,
  );
  const spacingMm = spacing
    ? toMm(Number(spacing[1]), spacing[2])
    : DEFAULT_AXIS_SPACING_MM;
  if (!isUsableLength(spacingMm)) return null;
  return { xSpans, ySpans, spacingXMm: spacingMm, spacingYMm: spacingMm };
}

function parseLineRequest(input: string): { lengthMm: number } | null {
  if (!/(直线|线段)/.test(input)) return null;
  const length = input.match(
    /(?:长|长度)?\s*(?:为|=|:|：)?\s*(\d+(?:\.\d+)?)\s*(毫米|mm|厘米|cm|米|m)?/,
  );
  if (!length) return null;
  const lengthMm = toMm(Number(length[1]), length[2]);
  if (!isUsableLength(lengthMm)) return null;
  return { lengthMm };
}

function buildAxisGridEntities(
  originX: number,
  grid: AxisGridRequest,
  notes: string[],
): CadDrawingEntity[] {
  const entities: CadDrawingEntity[] = [];
  const widthMm = grid.xSpans * grid.spacingXMm;
  const heightMm = grid.ySpans * grid.spacingYMm;
  const overshoot = 1000;
  const bubbleRadius = 400;

  for (let i = 0; i <= grid.xSpans; i += 1) {
    const x = originX + i * grid.spacingXMm;
    entities.push({
      type: "line",
      start: [x, -overshoot],
      end: [x, heightMm + overshoot],
      layer: "AXIS",
    });
    entities.push({
      type: "circle",
      center: [x, -overshoot - bubbleRadius],
      radius: bubbleRadius,
      layer: "AXIS",
    });
    entities.push({
      type: "text",
      position: [x - bubbleRadius / 3, -overshoot - bubbleRadius * 1.4],
      height: bubbleRadius,
      value: String(i + 1),
      layer: "TEXT",
    });
  }
  for (let j = 0; j <= grid.ySpans; j += 1) {
    const y = j * grid.spacingYMm;
    entities.push({
      type: "line",
      start: [originX - overshoot, y],
      end: [originX + widthMm + overshoot, y],
      layer: "AXIS",
    });
    entities.push({
      type: "circle",
      center: [originX - overshoot - bubbleRadius, y],
      radius: bubbleRadius,
      layer: "AXIS",
    });
    entities.push({
      type: "text",
      position: [
        originX - overshoot - bubbleRadius * 1.4,
        y - bubbleRadius / 2,
      ],
      height: bubbleRadius,
      value: axisLetter(j),
      layer: "TEXT",
    });
  }
  notes.push(
    `轴网 ${grid.xSpans}x${grid.ySpans} 跨，跨距 ${formatMm(grid.spacingXMm)}；竖向轴号 1..${grid.xSpans + 1}，横向轴号 ${axisLetter(0)}..${axisLetter(grid.ySpans)}。`,
  );
  return entities;
}

function validateOneEntity(item: unknown): CadDrawingEntity | null {
  if (!item || typeof item !== "object") return null;
  const value = item as Record<string, unknown>;
  const layer =
    typeof value.layer === "string" ? normalizeLayer(value.layer) : undefined;

  if (value.type === "line") {
    const start = asPoint(value.start);
    const end = asPoint(value.end);
    if (!start || !end) return null;
    return { type: "line", start, end, ...(layer ? { layer } : {}) };
  }
  if (value.type === "circle") {
    const center = asPoint(value.center);
    const radius = asLength(value.radius);
    if (!center || radius === null) return null;
    return { type: "circle", center, radius, ...(layer ? { layer } : {}) };
  }
  if (value.type === "arc") {
    const center = asPoint(value.center);
    const radius = asLength(value.radius);
    const startAngle = asFiniteNumber(value.startAngle);
    const endAngle = asFiniteNumber(value.endAngle);
    if (!center || radius === null || startAngle === null || endAngle === null)
      return null;
    return {
      type: "arc",
      center,
      radius,
      startAngle,
      endAngle,
      ...(layer ? { layer } : {}),
    };
  }
  if (value.type === "polyline") {
    if (!Array.isArray(value.points) || value.points.length < 2) return null;
    const points: Array<[number, number]> = [];
    for (const point of value.points) {
      const parsed = asPoint(point);
      if (!parsed) return null;
      points.push(parsed);
    }
    return {
      type: "polyline",
      points,
      closed: value.closed === true,
      ...(layer ? { layer } : {}),
    };
  }
  if (value.type === "text") {
    const position = asPoint(value.position);
    const height = asLength(value.height);
    if (
      !position ||
      height === null ||
      typeof value.value !== "string" ||
      !value.value.trim()
    ) {
      return null;
    }
    return {
      type: "text",
      position,
      height,
      value: value.value.slice(0, 256),
      ...(layer ? { layer } : {}),
    };
  }
  return null;
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

function toMm(value: number, unit: string | undefined): number {
  if (!Number.isFinite(value) || value <= 0) return Number.NaN;
  const normalized = (unit ?? "").toLowerCase();
  if (normalized === "米" || normalized === "m") return value * 1000;
  if (normalized === "厘米" || normalized === "cm") return value * 10;
  if (normalized === "毫米" || normalized === "mm") return value;
  return value <= 100 ? value * 1000 : value;
}

function isUsableLength(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= MAX_COORD_MM;
}

function clampSpan(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(20, Math.round(value)));
}

function clampTextHeight(value: number): number {
  return Math.max(120, Math.min(2000, Math.round(value)));
}

function axisLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

function normalizeLayer(layer: string | undefined): string {
  const known = DXF_LAYERS.find((entry) => entry.name === layer);
  return known ? known.name : "GEOM";
}

function asPoint(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = asFiniteNumber(value[0]);
  const y = asFiniteNumber(value[1]);
  if (x === null || y === null) return null;
  return [x, y];
}

function asLength(value: unknown): number | null {
  const parsed = asFiniteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function asFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= MAX_COORD_MM
    ? parsed
    : null;
}

function fmt(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function formatMm(value: number): string {
  return value >= 1000 && value % 100 === 0
    ? `${value / 1000}m`
    : `${Math.round(value)}mm`;
}
