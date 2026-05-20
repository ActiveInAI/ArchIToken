"use client";

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import clsx from "clsx";
import type { SnapCandidate, SnapResult } from "@/lib/insome/geom";
import type { Floorplan, Point, Wall } from "./schema";
import type { CreationSession, EditMode, HitTestResult, SelectionRef } from "./edit";
import { hitTest, isCreationMode } from "./edit";
import { roomPolygon } from "./geometry";
import { polygonCentroid } from "@/lib/insome/geom";
import { CreationPreview, OpeningHighlight } from "./edit/overlay-previews";

const HIT_ENDPOINT_RADIUS_SCREEN = 10;
const HIT_SEGMENT_RADIUS_SCREEN = 6;

export interface EditorOverlayDragPayload {
  readonly hit: HitTestResult;
}

export interface EditorOverlayProps {
  readonly floorplan: Floorplan;
  readonly selection: SelectionRef;
  readonly editMode: EditMode;
  readonly viewBox: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly zoom: number;
  readonly snapResult?: SnapResult | null;
  readonly dragStart?: Point | null;
  readonly dragCurrent?: Point | null;
  readonly creationSession?: CreationSession | null;
  readonly onSelectionChange: (s: SelectionRef) => void;
  readonly onPointerDownHit?: (hit: HitTestResult, evt: ReactPointerEvent<SVGSVGElement>) => void;
  readonly onPointerMoveWorld?: (p: Point, evt: ReactPointerEvent<SVGSVGElement>) => void;
  readonly onPointerUpWorld?: (p: Point, evt: ReactPointerEvent<SVGSVGElement>) => void;
  readonly className?: string;
}

function isSelectedWall(sel: SelectionRef, wallId: string): boolean {
  return sel?.kind === "wall" && sel.id === wallId;
}
function isSelectedRoom(sel: SelectionRef, roomId: string): boolean {
  return sel?.kind === "room" && sel.id === roomId;
}

function worldFromEvent(
  evt: ReactPointerEvent<SVGSVGElement>,
  svg: SVGSVGElement,
): Point {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  const inv = ctm.inverse();
  const world = pt.matrixTransform(inv);
  return { x: world.x, y: world.y };
}

function CandidateGlyph({
  c,
  zoom,
  accent,
  viewBox,
}: {
  c: SnapCandidate;
  zoom: number;
  accent: string;
  viewBox: { x: number; y: number; w: number; h: number };
}) {
  const sw = 1 / zoom;
  const dash = `${4 / zoom} ${4 / zoom}`;
  // Phase 2.75: endpoint → filled square anchor, midpoint → hollow circle
  if (c.kind === "endpoint") {
    const half = 3 / zoom;
    return (
      <rect
        x={c.point.x - half}
        y={c.point.y - half}
        width={half * 2}
        height={half * 2}
        fill={accent}
        stroke="#ffffff"
        strokeWidth={sw}
      />
    );
  }
  if (c.kind === "midpoint") {
    return (
      <circle
        cx={c.point.x}
        cy={c.point.y}
        r={3 / zoom}
        fill={accent}
        fillOpacity={0.4}
        stroke={accent}
        strokeWidth={sw}
      />
    );
  }
  // Phase 2.75: axis lines extend across the viewBox, not just to refPoint
  if (c.kind === "axis-parallel") {
    return (
      <line
        x1={viewBox.x}
        y1={c.point.y}
        x2={viewBox.x + viewBox.w}
        y2={c.point.y}
        stroke={accent}
        strokeWidth={sw}
        strokeDasharray={dash}
        opacity={0.6}
      />
    );
  }
  if (c.kind === "axis-perpendicular") {
    return (
      <line
        x1={c.point.x}
        y1={viewBox.y}
        x2={c.point.x}
        y2={viewBox.y + viewBox.h}
        stroke={accent}
        strokeWidth={sw}
        strokeDasharray={dash}
        opacity={0.6}
      />
    );
  }
  // wall-percent / wall-mid-any: small cross
  if (c.kind === "wall-percent" || c.kind === "wall-mid-any") {
    const r = 4 / zoom;
    return (
      <g>
        <line x1={c.point.x - r} y1={c.point.y} x2={c.point.x + r} y2={c.point.y} stroke={accent} strokeWidth={sw} />
        <line x1={c.point.x} y1={c.point.y - r} x2={c.point.x} y2={c.point.y + r} stroke={accent} strokeWidth={sw} />
      </g>
    );
  }
  return null;
}

function HighlightWall({ wall, selected, zoom, accent }: { wall: Wall; selected: boolean; zoom: number; accent: string }) {
  if (!selected) return null;
  return (
    <line
      x1={wall.a.x}
      y1={wall.a.y}
      x2={wall.b.x}
      y2={wall.b.y}
      stroke={accent}
      strokeWidth={4 / zoom}
      strokeLinecap="round"
      opacity={0.85}
    />
  );
}

function HighlightRoom({
  polygon,
  centroid,
  accent,
}: {
  polygon: ReadonlyArray<Point>;
  centroid: Point;
  accent: string;
}) {
  const pts = polygon.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <g>
      <polygon points={pts} fill={accent} fillOpacity={0.08} stroke={accent} strokeOpacity={0.6} strokeWidth={2} />
      <circle cx={centroid.x} cy={centroid.y} r={3} fill={accent} />
    </g>
  );
}

export function FloorplanEditorOverlay({
  floorplan,
  selection,
  editMode,
  viewBox,
  zoom,
  snapResult,
  dragStart,
  dragCurrent,
  creationSession,
  onSelectionChange,
  onPointerDownHit,
  onPointerMoveWorld,
  onPointerUpWorld,
  className,
}: EditorOverlayProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const accent = "#D4FF3A"; // Studio lime
  const endpointRadiusWorld = HIT_ENDPOINT_RADIUS_SCREEN / Math.max(zoom, 0.01);
  const segmentRadiusWorld = HIT_SEGMENT_RADIUS_SCREEN / Math.max(zoom, 0.01);

  const handlePointerDown = useCallback(
    (evt: ReactPointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      evt.stopPropagation();
      const world = worldFromEvent(evt, svgRef.current);
      const hit = hitTest(floorplan, world, endpointRadiusWorld, segmentRadiusWorld);
      if (!isCreationMode(editMode)) {
        if (hit.target.kind === "wall-endpoint" || hit.target.kind === "wall-segment") {
          onSelectionChange({ kind: "wall", id: hit.target.wallId });
        } else if (hit.target.kind === "opening") {
          onSelectionChange({ kind: "opening", id: hit.target.openingId });
        } else if (hit.target.kind === "room") {
          onSelectionChange({ kind: "room", id: hit.target.roomId });
        } else {
          onSelectionChange(null);
        }
      }
      onPointerDownHit?.(hit, evt);
      if (editMode !== "none") {
        svgRef.current.setPointerCapture(evt.pointerId);
      }
    },
    [floorplan, endpointRadiusWorld, segmentRadiusWorld, onSelectionChange, onPointerDownHit, editMode],
  );

  const handlePointerMove = useCallback(
    (evt: ReactPointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      if (editMode === "none") return;
      const world = worldFromEvent(evt, svgRef.current);
      onPointerMoveWorld?.(world, evt);
    },
    [editMode, onPointerMoveWorld],
  );

  const handlePointerUp = useCallback(
    (evt: ReactPointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      if (svgRef.current.hasPointerCapture(evt.pointerId)) {
        svgRef.current.releasePointerCapture(evt.pointerId);
      }
      if (editMode === "none") return;
      const world = worldFromEvent(evt, svgRef.current);
      onPointerUpWorld?.(world, evt);
    },
    [editMode, onPointerUpWorld],
  );

  const selectedRoom = selection?.kind === "room"
    ? floorplan.rooms.find((r) => r.id === selection.id) ?? null
    : null;
  const selectedRoomPoly = selectedRoom ? roomPolygon(selectedRoom, floorplan.walls) : [];
  const selectedRoomCentroid = selectedRoomPoly.length >= 3 ? polygonCentroid(selectedRoomPoly) : null;

  return (
    <svg
      ref={svgRef}
      className={clsx("insome-floorplan-editor-overlay absolute inset-0 h-full w-full", className)}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ pointerEvents: "auto", cursor: editMode === "none" ? "default" : "crosshair" }}
    >
      {floorplan.walls.map((w) => (
        <HighlightWall
          key={w.id}
          wall={w}
          selected={isSelectedWall(selection, w.id)}
          zoom={zoom}
          accent={accent}
        />
      ))}
      {selection?.kind === "wall" ? (() => {
        const w = floorplan.walls.find((x) => x.id === selection.id);
        if (!w) return null;
        return (
          <g>
            <circle cx={w.a.x} cy={w.a.y} r={5 / zoom} fill={accent} stroke="#0A0A0A" strokeWidth={1 / zoom} />
            <circle cx={w.b.x} cy={w.b.y} r={5 / zoom} fill={accent} stroke="#0A0A0A" strokeWidth={1 / zoom} />
          </g>
        );
      })() : null}
      {selectedRoomPoly.length >= 3 && selectedRoomCentroid && selection?.kind === "room" && isSelectedRoom(selection, selection.id) ? (
        <HighlightRoom polygon={selectedRoomPoly} centroid={selectedRoomCentroid} accent={accent} />
      ) : null}
      {snapResult?.candidates.map((c, i) => (
        <CandidateGlyph key={`snap-${i}`} c={c} zoom={zoom} accent={accent} viewBox={viewBox} />
      ))}
      {dragStart && dragCurrent ? (
        <line
          x1={dragStart.x}
          y1={dragStart.y}
          x2={dragCurrent.x}
          y2={dragCurrent.y}
          stroke={accent}
          strokeWidth={1 / zoom}
          strokeDasharray={`${3 / zoom} ${3 / zoom}`}
          opacity={0.4}
        />
      ) : null}
      <CreationPreview session={creationSession ?? null} editMode={editMode} zoom={zoom} accent={accent} />
      {selection?.kind === "opening" ? (() => {
        const o = floorplan.openings.find((x) => x.id === selection.id);
        if (!o) return null;
        const wall = floorplan.walls.find((w) => w.id === o.wallId);
        if (!wall) return null;
        return (
          <OpeningHighlight opening={o} wall={wall} zoom={zoom} accent={accent} />
        );
      })() : null}
    </svg>
  );
}
