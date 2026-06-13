// lib/costing-grid-layout.ts
// License: Apache-2.0
//
// Column-width / row-height layout model for the quantity-costing 分部分项
// review grid (ModuleOperationalPanel). The interactive grid previously had no
// resizable columns or adjustable row height; this module is the testable core
// of that behaviour so the drag math is verified without a browser.

/** One leaf column of the 分部分项 review grid, in render order. */
export interface CostingGridColumn {
  /** Stable column id (key into the width map). */
  readonly id: string;
  /** Header label (for tooltips / reset). */
  readonly label: string;
  /** Default width in px. */
  readonly width: number;
}

/**
 * The 18 leaf columns of the 分部分项 review table, matching the colgroup /
 * header order: identity columns, 送审(3), 审定(3), 增减(4), 来源.
 */
export const COSTING_FENBU_COLUMNS: readonly CostingGridColumn[] = [
  { id: "seq", label: "序", width: 48 },
  { id: "mark", label: "标记", width: 56 },
  { id: "code", label: "编码", width: 110 },
  { id: "cat", label: "类别", width: 56 },
  { id: "name", label: "名称", width: 200 },
  { id: "feature", label: "项目特征", width: 160 },
  { id: "unit", label: "单位", width: 56 },
  { id: "sub_qty", label: "送审工程量", width: 84 },
  { id: "sub_price", label: "送审综合单价", width: 92 },
  { id: "sub_total", label: "送审综合合价", width: 100 },
  { id: "app_qty", label: "审定工程量", width: 84 },
  { id: "app_price", label: "审定综合单价", width: 92 },
  { id: "app_total", label: "审定综合合价", width: 100 },
  { id: "delta_qty", label: "工程量差", width: 84 },
  { id: "inc", label: "核增", width: 84 },
  { id: "dec", label: "核减", width: 84 },
  { id: "reason", label: "增减说明", width: 120 },
  { id: "source", label: "来源", width: 96 },
];

/** Minimum column width a drag can shrink to (px). */
export const COSTING_MIN_COL_WIDTH = 40;

/**
 * New width for a column being dragged: start width plus pointer delta,
 * clamped to a sane minimum and rounded to a whole pixel.
 */
export function clampColumnWidth(
  startWidth: number,
  delta: number,
  min: number = COSTING_MIN_COL_WIDTH,
): number {
  return Math.max(min, Math.round(startWidth + delta));
}

/** A fresh width map seeded from the column defaults. */
export function defaultColumnWidths(): Record<string, number> {
  return Object.fromEntries(COSTING_FENBU_COLUMNS.map((c) => [c.id, c.width]));
}

/** Row-height presets (px): 紧凑 / 标准 / 宽松. */
export const COSTING_ROW_HEIGHTS = [22, 28, 36] as const;

/** Default row height (标准). */
export const COSTING_DEFAULT_ROW_HEIGHT: number = COSTING_ROW_HEIGHTS[1];

/** Cycle to the next row-height preset (wraps around). */
export function cycleRowHeight(current: number): number {
  const index = COSTING_ROW_HEIGHTS.indexOf(
    current as (typeof COSTING_ROW_HEIGHTS)[number],
  );
  const next = (index + 1) % COSTING_ROW_HEIGHTS.length;
  return COSTING_ROW_HEIGHTS[next] ?? COSTING_DEFAULT_ROW_HEIGHT;
}

/** Human label for a row-height value. */
export function rowHeightLabel(height: number): string {
  if (height <= COSTING_ROW_HEIGHTS[0]) return "紧凑";
  if (height >= COSTING_ROW_HEIGHTS[2]) return "宽松";
  return "标准";
}

/** Project-tree pane width bounds (px): default / min / max. */
export const COSTING_TREE_WIDTH = { default: 246, min: 168, max: 560 } as const;

/** Bottom detail pane height bounds (px): default / min / max. */
export const COSTING_DETAIL_HEIGHT = {
  default: 218,
  min: 120,
  max: 620,
} as const;

/**
 * New pane size while dragging a splitter: start size plus the drag delta,
 * clamped to [min, max] and rounded to a whole pixel.
 */
export function clampPaneSize(
  startSize: number,
  delta: number,
  min: number,
  max: number,
): number {
  return Math.max(min, Math.min(max, Math.round(startSize + delta)));
}
