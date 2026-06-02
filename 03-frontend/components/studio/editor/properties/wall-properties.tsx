"use client";

import { useState } from "react";
import * as Slider from "@radix-ui/react-slider";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { Floorplan, Point } from "@/lib/insome/floorplan";
import { segmentLength } from "@/lib/insome/geom";
import {
  createDeleteWallCommand,
  createMoveWallEndpointCommand,
  createSetWallThicknessCommand,
} from "@/lib/command";
import { useStudioEditorStore } from "@/stores/studio-editor.store";
import { NumField, ReadOnlyField } from "./properties-fields";

function worldToFt(v: number, unitsPerMeter: number): number {
  return +((v / unitsPerMeter) * 3.28084).toFixed(2);
}
function ftToWorld(v: number, unitsPerMeter: number): number {
  return +((v / 3.28084) * unitsPerMeter).toFixed(4);
}

export function WallProperties({ wallId, floorplan }: { wallId: string; floorplan: Floorplan }) {
  const t = useTranslations("studio.properties.wall");
  const tEdit = useTranslations();
  const pushCommand = useStudioEditorStore((s) => s.pushCommand);
  const setSelection = useStudioEditorStore((s) => s.setSelection);
  const selection = useStudioEditorStore((s) => s.selection);
  const isShared = floorplan.rooms.some((r) => r.wallIds.includes(wallId));

  const wall = floorplan.walls.find((w) => w.id === wallId);
  const [thicknessDraft, setThicknessDraft] = useState<{
    wallId: string;
    thickness: number;
  }>(() => ({ wallId, thickness: wall?.thickness ?? 6 }));
  const thickness =
    thicknessDraft.wallId === wallId
      ? thicknessDraft.thickness
      : (wall?.thickness ?? 6);
  const thicknessSnapshotRef = wall ? wall.thickness : 6;

  if (!wall) return null;

  const ups = floorplan.scale.unitsPerMeter;
  const length = segmentLength({ a: wall.a, b: wall.b });
  const angleDeg = Math.round((Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x) * 180) / Math.PI);

  const commitEndpointChange = (end: "a" | "b", axis: "x" | "y", ft: number) => {
    const world = ftToWorld(ft, ups);
    const from: Point = end === "a" ? wall.a : wall.b;
    const to: Point = axis === "x" ? { x: world, y: from.y } : { x: from.x, y: world };
    if (Math.abs(to.x - from.x) < 1e-6 && Math.abs(to.y - from.y) < 1e-6) return;
    pushCommand(
      createMoveWallEndpointCommand({
        wallId: wall.id,
        end,
        fromPoint: from,
        toPoint: to,
        selectionSnapshot: selection,
      }),
    );
  };

  const commitThickness = (nextValue: number) => {
    if (nextValue === thicknessSnapshotRef) return;
    pushCommand(
      createSetWallThicknessCommand({
        wallId: wall.id,
        fromThickness: thicknessSnapshotRef,
        toThickness: nextValue,
        selectionSnapshot: selection,
      }),
    );
  };

  return (
    <>
      <div className="mb-4 font-display text-h3 font-bold tracking-tight text-fg-8">
        {t("header")}
      </div>

      <div className="mb-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4">
        {t("endpointA")}
      </div>
      <NumField
        label="x"
        unit="ft"
        step={0.1}
        value={worldToFt(wall.a.x, ups)}
        onChange={(ft) => commitEndpointChange("a", "x", ft)}
      />
      <NumField
        label="y"
        unit="ft"
        step={0.1}
        value={worldToFt(wall.a.y, ups)}
        onChange={(ft) => commitEndpointChange("a", "y", ft)}
      />

      <div className="mt-4 mb-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4">
        {t("endpointB")}
      </div>
      <NumField
        label="x"
        unit="ft"
        step={0.1}
        value={worldToFt(wall.b.x, ups)}
        onChange={(ft) => commitEndpointChange("b", "x", ft)}
      />
      <NumField
        label="y"
        unit="ft"
        step={0.1}
        value={worldToFt(wall.b.y, ups)}
        onChange={(ft) => commitEndpointChange("b", "y", ft)}
      />

      <ReadOnlyField label={t("length")} value={`${worldToFt(length, ups).toFixed(2)} ft`} />
      <ReadOnlyField label={t("angle")} value={`${angleDeg}°`} />

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
            {t("thickness")}
          </span>
          <span className="font-mono text-micro text-accent-lime">{thickness}</span>
        </div>
        <Slider.Root
          value={[thickness]}
          min={4}
          max={24}
          step={1}
          onValueChange={([v]) => {
            if (v !== undefined) {
              setThicknessDraft({ wallId, thickness: v });
            }
          }}
          onValueCommit={([v]) => {
            if (v !== undefined) commitThickness(v);
          }}
          className="relative flex h-5 w-full select-none items-center"
        >
          <Slider.Track className="relative h-1 w-full bg-fg-2">
            <Slider.Range className="absolute h-full bg-accent-lime" />
          </Slider.Track>
          <Slider.Thumb
            aria-label={t("thickness")}
            className="block h-3 w-3 border border-accent-lime bg-fg-0 focus:outline-none focus:ring-1 focus:ring-accent-lime"
          />
        </Slider.Root>
      </div>

      <button
        type="button"
        disabled={isShared}
        title={isShared ? t("deleteSharedHint") : undefined}
        onClick={() => {
          if (isShared) {
            toast(tEdit("studio.edit.cannotDeleteSharedWall"));
            return;
          }
          const attachedOpenings = floorplan.openings.filter((o) => o.wallId === wall.id);
          pushCommand(
            createDeleteWallCommand({
              wallId: wall.id,
              wallSnapshot: wall,
              openingSnapshots: attachedOpenings,
              selectionSnapshot: selection,
            }),
          );
          setSelection(null);
        }}
        className={
          isShared
            ? "mt-5 w-full border border-fg-2 bg-fg-0 px-3 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4 opacity-50"
            : "mt-5 w-full border border-fg-2 bg-fg-0 px-3 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4 transition-colors hover:border-accent-lime hover:text-accent-lime"
        }
      >
        {t("delete")}
      </button>
      {isShared ? (
        <p className="mt-2 font-mono text-micro text-fg-4">{t("deleteSharedHint")}</p>
      ) : null}
    </>
  );
}
