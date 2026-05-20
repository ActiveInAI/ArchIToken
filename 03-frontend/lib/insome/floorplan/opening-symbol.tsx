import type { Opening, SchemeColors, Wall } from "./schema";

/**
 * Stand-alone SVG symbol for an Opening (door / window / passageway).
 * Split out of renderer.tsx in Phase 2.5.3 to keep renderer ≤ 300 lines.
 */
export function OpeningSymbol({
  opening,
  walls,
  colors,
}: {
  opening: Opening;
  walls: ReadonlyArray<Wall>;
  colors: SchemeColors;
}) {
  const wall = walls.find((w) => w.id === opening.wallId);
  if (!wall) return null;
  const dx = wall.b.x - wall.a.x;
  const dy = wall.b.y - wall.a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return null;
  const ux = dx / len;
  const uy = dy / len;
  const cx = wall.a.x + ux * opening.offset;
  const cy = wall.a.y + uy * opening.offset;
  const hx = (ux * opening.width) / 2;
  const hy = (uy * opening.width) / 2;
  const nx = -uy;
  const ny = ux;
  const x1 = cx - hx;
  const y1 = cy - hy;
  const x2 = cx + hx;
  const y2 = cy + hy;

  if (opening.type === "opening") {
    return (
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.bg} strokeWidth={4} strokeLinecap="butt" />
    );
  }
  if (opening.type === "window") {
    const off = 1.5;
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.bg} strokeWidth={4} strokeLinecap="butt" />
        <line
          x1={x1 + nx * off}
          y1={y1 + ny * off}
          x2={x2 + nx * off}
          y2={y2 + ny * off}
          stroke={colors.stroke}
          strokeWidth={0.8}
        />
        <line
          x1={x1 - nx * off}
          y1={y1 - ny * off}
          x2={x2 - nx * off}
          y2={y2 - ny * off}
          stroke={colors.stroke}
          strokeWidth={0.8}
        />
      </g>
    );
  }
  const swing = opening.swing ?? "right";
  const pivot = swing === "left" ? { x: x1, y: y1 } : { x: x2, y: y2 };
  const leafDir = swing === "left" ? { x: ux, y: uy } : { x: -ux, y: -uy };
  const r = opening.width;
  const startAngle = Math.atan2(leafDir.y, leafDir.x);
  const endAngle = startAngle - (Math.PI / 2) * (swing === "left" ? -1 : 1);
  const arcEndX = pivot.x + Math.cos(endAngle) * r;
  const arcEndY = pivot.y + Math.sin(endAngle) * r;
  const sweepFlag = swing === "left" ? 1 : 0;
  const arcStartX = pivot.x + leafDir.x * r;
  const arcStartY = pivot.y + leafDir.y * r;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.bg} strokeWidth={4} strokeLinecap="butt" />
      <path
        d={`M ${arcStartX} ${arcStartY} A ${r} ${r} 0 0 ${sweepFlag} ${arcEndX} ${arcEndY}`}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={0.8}
        opacity={0.6}
      />
      <line
        x1={pivot.x}
        y1={pivot.y}
        x2={arcStartX}
        y2={arcStartY}
        stroke={colors.stroke}
        strokeWidth={1.2}
      />
    </g>
  );
}
