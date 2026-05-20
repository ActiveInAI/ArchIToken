import type { Bounds } from "@/lib/insome/geom";
import type { FurnitureType, SchemeColors } from "./schema";

/**
 * Glyphs receive the room's AABB (derived from its polygon) so the
 * drawing logic remains unchanged from the pre-2.5.1 rectangular-room
 * implementation. Real layout within non-rectangular rooms can come later.
 */
export interface FurnitureGlyphProps {
  readonly bounds: Bounds;
  readonly colors: SchemeColors;
}

function box(bounds: Bounds) {
  return {
    x: bounds.minX,
    y: bounds.minY,
    w: bounds.maxX - bounds.minX,
    h: bounds.maxY - bounds.minY,
  };
}

function Sofa({ bounds, colors }: FurnitureGlyphProps) {
  const r = box(bounds);
  const x = r.x + 20;
  const y = r.y + r.h - 50;
  const w = Math.max(r.w - 40, 20);
  return <rect x={x} y={y} width={w} height={30} rx={2} fill={colors.furniture} />;
}

function Bed({ bounds, colors }: FurnitureGlyphProps) {
  const r = box(bounds);
  const x = r.x + 15;
  const y = r.y + 30;
  return (
    <g>
      <rect x={x} y={y} width={60} height={80} rx={3} fill={colors.furniture} />
      <rect x={x + 8} y={y + 8} width={44} height={14} rx={2} fill={colors.bg} opacity={0.6} />
    </g>
  );
}

function Table({ bounds, colors }: FurnitureGlyphProps) {
  const r = box(bounds);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return <rect x={cx - 30} y={cy - 15} width={60} height={30} rx={2} fill={colors.furniture} />;
}

function Counter({ bounds, colors }: FurnitureGlyphProps) {
  const r = box(bounds);
  const x = r.x + 10;
  const y = r.y + r.h - 20;
  const w = Math.max(r.w - 20, 20);
  return <rect x={x} y={y} width={w} height={12} fill={colors.furniture} />;
}

function Tub({ bounds, colors }: FurnitureGlyphProps) {
  const r = box(bounds);
  const x = r.x + 8;
  const y = r.y + 20;
  const w = Math.max(r.w - 16, 20);
  return <rect x={x} y={y} width={w} height={30} rx={4} fill={colors.furniture} />;
}

function Shower({ bounds, colors }: FurnitureGlyphProps) {
  const r = box(bounds);
  const x = r.x + 5;
  const y = r.y + 15;
  const w = Math.max(r.w - 10, 16);
  const h = Math.max(r.h - 25, 20);
  return <rect x={x} y={y} width={w} height={h} rx={2} fill={colors.furniture} opacity={0.6} />;
}

function Desk({ bounds, colors }: FurnitureGlyphProps) {
  const r = box(bounds);
  const cx = r.x + r.w / 2;
  const y = r.y + r.h - 30;
  return <rect x={cx - 40} y={y} width={80} height={18} fill={colors.furniture} />;
}

const GLYPH: Record<FurnitureType, (props: FurnitureGlyphProps) => React.ReactElement> = {
  sofa: Sofa,
  bed: Bed,
  table: Table,
  counter: Counter,
  tub: Tub,
  shower: Shower,
  desk: Desk,
};

export interface FurnitureLayerProps {
  readonly furn?: ReadonlyArray<FurnitureType> | undefined;
  readonly bounds: Bounds;
  readonly colors: SchemeColors;
}

export function FurnitureLayer({ furn, bounds, colors }: FurnitureLayerProps) {
  if (!furn || furn.length === 0) return null;
  return (
    <g>
      {furn.map((kind) => {
        const Glyph = GLYPH[kind];
        return <Glyph key={kind} bounds={bounds} colors={colors} />;
      })}
    </g>
  );
}
