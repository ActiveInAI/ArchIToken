"use client";

import clsx from "clsx";
import { detectJunctions, polygonCentroid, polygonBounds, type Bounds, type Point } from "@/lib/insome/geom";
import type {
  FloorplanRendererProps,
  Opening,
  Room,
  SchemeColors,
  Wall,
} from "./schema";
import { resolveSchemeColors } from "./colors";
import { roomPolygon } from "./geometry";
import { FurnitureLayer } from "./furniture-library";
import { OpeningSymbol } from "./opening-symbol";

const SELECTION_STYLE_ID = "insome-floorplan-selection-style";

const SELECTION_KEYFRAMES = `
@keyframes insome-fp-pulse { to { stroke-dashoffset: -16; } }
.insome-fp-select-box {
  fill: none;
  stroke-width: 2;
  stroke-dasharray: 4 4;
  animation: insome-fp-pulse 2s linear infinite;
  pointer-events: none;
}
.insome-fp-room { cursor: pointer; transition: fill 0.32s cubic-bezier(0.2, 0.8, 0.2, 1); }
`;

interface RoomDerived {
  readonly room: Room;
  readonly polygon: ReadonlyArray<Point>;
  readonly bounds: Bounds;
  readonly centroid: Point;
}

function formatSize(units: number, unitsPerMeter: number, unit: "m" | "ft") {
  const meters = units / unitsPerMeter;
  if (unit === "ft") return `${(meters * 3.28084).toFixed(1)} ft`;
  return `${meters.toFixed(1)} m`;
}

function pointsToSvg(poly: ReadonlyArray<Point>): string {
  return poly.map((p) => `${p.x},${p.y}`).join(" ");
}

interface RoomGroupProps {
  readonly derived: RoomDerived;
  readonly colors: SchemeColors;
  readonly isSelected: boolean;
  readonly label: string;
  readonly showDimensions: boolean;
  readonly unitsPerMeter: number;
  readonly unit: "m" | "ft";
  readonly onSelect?: ((roomId: string, labelKey: string) => void) | undefined;
}

function RoomGroup({
  derived,
  colors,
  isSelected,
  label,
  showDimensions,
  unitsPerMeter,
  unit,
  onSelect,
}: RoomGroupProps) {
  const { room, polygon, bounds, centroid } = derived;
  const fillColor = isSelected ? colors.selected + "22" : room.color ?? colors.room;
  const labelX = centroid.x;
  const labelY = bounds.minY + 18;
  const dimY = bounds.maxY - 8;
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const handleClick = () => onSelect?.(room.id, room.labelKey);

  return (
    <g>
      <polygon
        className="insome-fp-room"
        points={pointsToSvg(polygon)}
        fill={fillColor}
        onClick={handleClick}
      />
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        fontSize={10}
        fontFamily="'JetBrains Mono', monospace"
        fill={colors.stroke}
        pointerEvents="none"
      >
        {label}
      </text>
      {showDimensions ? (
        <text
          x={labelX}
          y={dimY}
          textAnchor="middle"
          fontSize={9}
          fontFamily="'JetBrains Mono', monospace"
          fill={colors.stroke}
          opacity={0.55}
          pointerEvents="none"
        >
          {formatSize(w, unitsPerMeter, unit)} × {formatSize(h, unitsPerMeter, unit)}
        </text>
      ) : null}
      <FurnitureLayer furn={room.furn} bounds={bounds} colors={colors} />
      {isSelected ? (
        <rect
          className="insome-fp-select-box"
          x={bounds.minX - 3}
          y={bounds.minY - 3}
          width={w + 6}
          height={h + 6}
          stroke={colors.selected}
        />
      ) : null}
    </g>
  );
}

interface WallLayerProps {
  readonly walls: ReadonlyArray<Wall>;
  readonly openings: ReadonlyArray<Opening>;
  readonly colors: SchemeColors;
}

function WallLayer({ walls, openings, colors }: WallLayerProps) {
  const junctions = detectJunctions(walls);
  return (
    <g>
      {walls.map((w) => (
        <line
          key={w.id}
          x1={w.a.x}
          y1={w.a.y}
          x2={w.b.x}
          y2={w.b.y}
          stroke={colors.stroke}
          strokeWidth={2}
          strokeLinecap="butt"
        />
      ))}
      {junctions.map((j, i) => (
        <circle
          key={`junction-${i}`}
          cx={j.point.x}
          cy={j.point.y}
          r={Math.max(j.maxThickness / 4, 1.2)}
          fill={colors.stroke}
        />
      ))}
      {openings.map((o) => (
        <OpeningSymbol key={o.id} opening={o} walls={walls} colors={colors} />
      ))}
    </g>
  );
}


export function FloorplanRenderer({
  floorplan,
  selectedRoomId,
  scheme = "standard",
  theme = "home",
  showDimensions = false,
  showGrid = false,
  translator,
  onRoomSelect,
  className,
}: FloorplanRendererProps) {
  const colors = resolveSchemeColors(scheme, theme);
  const { viewBox, boundary, rooms, walls, openings, scale, unit } = floorplan;
  const outer = boundary ?? {
    x: viewBox.x + 20,
    y: viewBox.y + 20,
    w: viewBox.w - 40,
    h: viewBox.h - 40,
  };

  const derivedRooms: ReadonlyArray<RoomDerived> = rooms.flatMap((room) => {
    const polygon = roomPolygon(room, walls);
    if (polygon.length < 3) return [];
    const bounds = polygonBounds(polygon);
    const centroid = polygonCentroid(polygon);
    return [{ room, polygon, bounds, centroid }];
  });

  return (
    <svg
      className={clsx("insome-floorplan", className)}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="floorplan"
    >
      <style id={SELECTION_STYLE_ID}>{SELECTION_KEYFRAMES}</style>
      {showGrid ? (
        <defs>
          <pattern id="insome-fp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke={colors.stroke} strokeOpacity={0.08} strokeWidth={1} />
          </pattern>
        </defs>
      ) : null}
      {showGrid ? (
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="url(#insome-fp-grid)" />
      ) : null}
      <rect
        x={outer.x}
        y={outer.y}
        width={outer.w}
        height={outer.h}
        fill={colors.bg}
        stroke={colors.stroke}
        strokeWidth={3}
      />
      {derivedRooms.map((d) => (
        <RoomGroup
          key={d.room.id}
          derived={d}
          colors={colors}
          isSelected={selectedRoomId === d.room.id}
          label={translator(d.room.labelKey)}
          showDimensions={showDimensions}
          unitsPerMeter={scale.unitsPerMeter}
          unit={unit}
          onSelect={onRoomSelect}
        />
      ))}
      <WallLayer walls={walls} openings={openings} colors={colors} />
    </svg>
  );
}
