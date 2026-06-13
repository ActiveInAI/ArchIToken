// lib/costing-grid-layout.test.ts
// License: Apache-2.0
import { describe, expect, it } from "vitest";

import {
  COSTING_DEFAULT_ROW_HEIGHT,
  COSTING_FENBU_COLUMNS,
  COSTING_MIN_COL_WIDTH,
  COSTING_ROW_HEIGHTS,
  clampColumnWidth,
  cycleRowHeight,
  defaultColumnWidths,
  rowHeightLabel,
} from "./costing-grid-layout";

describe("costing 分部分项 grid layout", () => {
  it("defines exactly the 18 leaf columns with unique ids", () => {
    expect(COSTING_FENBU_COLUMNS).toHaveLength(18);
    const ids = COSTING_FENBU_COLUMNS.map((c) => c.id);
    expect(new Set(ids).size).toBe(18);
  });

  it("seeds a width map covering every column", () => {
    const widths = defaultColumnWidths();
    for (const col of COSTING_FENBU_COLUMNS) {
      expect(widths[col.id]).toBe(col.width);
    }
  });

  describe("clampColumnWidth", () => {
    it("adds the pointer delta to the start width", () => {
      expect(clampColumnWidth(100, 40)).toBe(140);
      expect(clampColumnWidth(100, -30)).toBe(70);
    });

    it("never shrinks below the minimum width", () => {
      expect(clampColumnWidth(60, -100)).toBe(COSTING_MIN_COL_WIDTH);
    });

    it("rounds to whole pixels", () => {
      expect(clampColumnWidth(100, 12.6)).toBe(113);
    });
  });

  describe("row height", () => {
    it("cycles through the presets and wraps", () => {
      const [compact, normal, loose] = COSTING_ROW_HEIGHTS;
      expect(cycleRowHeight(compact)).toBe(normal);
      expect(cycleRowHeight(normal)).toBe(loose);
      expect(cycleRowHeight(loose)).toBe(compact);
    });

    it("defaults to the 标准 preset", () => {
      expect(COSTING_DEFAULT_ROW_HEIGHT).toBe(COSTING_ROW_HEIGHTS[1]);
      expect(rowHeightLabel(COSTING_DEFAULT_ROW_HEIGHT)).toBe("标准");
    });

    it("labels the extremes", () => {
      expect(rowHeightLabel(COSTING_ROW_HEIGHTS[0])).toBe("紧凑");
      expect(rowHeightLabel(COSTING_ROW_HEIGHTS[2])).toBe("宽松");
    });
  });
});
