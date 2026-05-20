import type { CreationSession, EditMode } from "./types";
import type { Wall } from "../schema";

/**
 * Stand-alone preview components used by <FloorplanEditorOverlay>. Split out
 * of editor-overlay.tsx in Phase 2.5.3 to keep that file ≤ 350 lines.
 */

export function CreationPreview({
  session,
  editMode,
  zoom,
  accent,
}: {
  session: CreationSession | null;
  editMode: EditMode;
  zoom: number;
  accent: string;
}) {
  if (!session) return null;
  const sw = 1.5 / zoom;
  const dash = `${5 / zoom} ${4 / zoom}`;
  if (editMode === "create-wall" && session.startPoint && session.currentPoint) {
    const p1 = session.startPoint;
    const p2 = session.currentPoint;
    return (
      <g>
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={accent} strokeWidth={sw} strokeDasharray={dash} />
        <circle cx={p1.x} cy={p1.y} r={4 / zoom} fill={accent} />
      </g>
    );
  }
  if (editMode === "create-room-rect" && session.startPoint && session.currentPoint) {
    const p1 = session.startPoint;
    const p2 = session.currentPoint;
    const xMin = Math.min(p1.x, p2.x);
    const yMin = Math.min(p1.y, p2.y);
    const w = Math.abs(p2.x - p1.x);
    const h = Math.abs(p2.y - p1.y);
    return (
      <g>
        <rect
          x={xMin}
          y={yMin}
          width={w}
          height={h}
          fill={accent}
          fillOpacity={0.08}
          stroke={accent}
          strokeWidth={sw}
          strokeDasharray={dash}
        />
        <circle cx={p1.x} cy={p1.y} r={4 / zoom} fill={accent} />
      </g>
    );
  }
  if (
    (editMode === "create-opening-door" ||
      editMode === "create-opening-window" ||
      editMode === "create-opening-plain") &&
    session.currentPoint
  ) {
    return (
      <circle
        cx={session.currentPoint.x}
        cy={session.currentPoint.y}
        r={6 / zoom}
        fill="none"
        stroke={accent}
        strokeWidth={sw}
      />
    );
  }
  return null;
}

export function OpeningHighlight({
  opening,
  wall,
  zoom,
  accent,
}: {
  opening: { wallId: string; offset: number; width: number };
  wall: Wall;
  zoom: number;
  accent: string;
}) {
  const dx = wall.b.x - wall.a.x;
  const dy = wall.b.y - wall.a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) return null;
  const ux = dx / len;
  const uy = dy / len;
  const cx = wall.a.x + ux * opening.offset;
  const cy = wall.a.y + uy * opening.offset;
  const hx = (ux * opening.width) / 2;
  const hy = (uy * opening.width) / 2;
  return (
    <g>
      <line
        x1={cx - hx}
        y1={cy - hy}
        x2={cx + hx}
        y2={cy + hy}
        stroke={accent}
        strokeWidth={5 / zoom}
        strokeLinecap="butt"
        opacity={0.85}
      />
      <circle cx={cx} cy={cy} r={4 / zoom} fill={accent} stroke="#0A0A0A" strokeWidth={0.8 / zoom} />
    </g>
  );
}
