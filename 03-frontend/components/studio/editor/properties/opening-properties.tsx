"use client";

import { useTranslations } from "next-intl";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type { Floorplan, Opening } from "@/lib/insome/floorplan";
import { cn } from "@/lib/insome/ui";
import {
  createDeleteOpeningCommand,
  createUpdateOpeningCommand,
  type OpeningPatch,
} from "@/lib/command";
import { useStudioEditorStore } from "@/stores/studio-editor.store";
import { NumField, ReadOnlyField } from "./properties-fields";

function worldToFt(v: number, unitsPerMeter: number): number {
  return +((v / unitsPerMeter) * 3.28084).toFixed(2);
}
function ftToWorld(v: number, unitsPerMeter: number): number {
  return +((v / 3.28084) * unitsPerMeter).toFixed(4);
}

export function OpeningProperties({
  openingId,
  floorplan,
}: {
  openingId: string;
  floorplan: Floorplan;
}) {
  const t = useTranslations("studio.properties.opening");
  const pushCommand = useStudioEditorStore((s) => s.pushCommand);
  const setSelection = useStudioEditorStore((s) => s.setSelection);
  const selection = useStudioEditorStore((s) => s.selection);

  const opening = floorplan.openings.find((o) => o.id === openingId);
  if (!opening) return null;
  const wall = floorplan.walls.find((w) => w.id === opening.wallId);
  if (!wall) return null;
  const ups = floorplan.scale.unitsPerMeter;

  const commit = (from: OpeningPatch, to: OpeningPatch) => {
    pushCommand(
      createUpdateOpeningCommand({
        openingId: opening.id,
        fromPatch: from,
        toPatch: to,
        selectionSnapshot: selection,
      }),
    );
  };

  return (
    <>
      <div className="mb-4 font-display text-h3 font-bold tracking-tight text-fg-8">
        {t("header")}
      </div>

      <ReadOnlyField label={t("wall")} value={opening.wallId} />

      <div className="mt-3 mb-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4">
        {t("type")}
      </div>
      <ToggleGroup.Root
        type="single"
        value={opening.type}
        onValueChange={(v) => {
          if (!v || v === opening.type) return;
          const next = v as Opening["type"];
          commit({ type: opening.type }, { type: next });
        }}
        className="grid grid-cols-3 gap-1.5"
      >
        {(["door", "window", "opening"] as const).map((k) => (
          <ToggleGroup.Item
            key={k}
            value={k}
            aria-label={t(`typeOption.${k}`)}
            className={cn(
              "border border-fg-2 bg-fg-0 py-1.5 font-mono text-micro tracking-eyebrow uppercase text-fg-4",
              "transition-colors hover:border-accent-lime hover:text-fg-8",
              "data-[state=on]:border-accent-lime data-[state=on]:bg-fg-1 data-[state=on]:text-accent-lime",
            )}
          >
            {t(`typeOption.${k}`)}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>

      <div className="mt-4 flex flex-col gap-2">
        <NumField
          label={t("offset")}
          unit="ft"
          step={0.1}
          value={worldToFt(opening.offset, ups)}
          onChange={(ft) => {
            const next = ftToWorld(ft, ups);
            if (Math.abs(next - opening.offset) < 1e-4) return;
            commit({ offset: opening.offset }, { offset: next });
          }}
        />
        <NumField
          label={t("width")}
          unit="ft"
          step={0.1}
          value={worldToFt(opening.width, ups)}
          onChange={(ft) => {
            const next = ftToWorld(ft, ups);
            if (Math.abs(next - opening.width) < 1e-4) return;
            commit({ width: opening.width }, { width: next });
          }}
        />
      </div>

      {opening.type === "door" ? (
        <>
          <div className="mt-4 mb-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4">
            {t("swing")}
          </div>
          <ToggleGroup.Root
            type="single"
            value={opening.swing ?? "none"}
            onValueChange={(v) => {
              if (!v) return;
              const next = v as "left" | "right" | "none";
              if (next === (opening.swing ?? "none")) return;
              commit(
                opening.swing !== undefined ? { swing: opening.swing } : { swing: "none" },
                { swing: next },
              );
            }}
            className="grid grid-cols-3 gap-1.5"
          >
            {(["left", "right", "none"] as const).map((k) => (
              <ToggleGroup.Item
                key={k}
                value={k}
                aria-label={t(`swingOption.${k}`)}
                className={cn(
                  "border border-fg-2 bg-fg-0 py-1.5 font-mono text-micro tracking-eyebrow uppercase text-fg-4",
                  "transition-colors hover:border-accent-lime hover:text-fg-8",
                  "data-[state=on]:border-accent-lime data-[state=on]:bg-fg-1 data-[state=on]:text-accent-lime",
                )}
              >
                {t(`swingOption.${k}`)}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </>
      ) : null}

      <button
        type="button"
        onClick={() => {
          pushCommand(
            createDeleteOpeningCommand({
              openingSnapshot: opening,
              selectionSnapshot: selection,
            }),
          );
          setSelection(null);
        }}
        className="mt-5 w-full border border-fg-2 bg-fg-0 px-3 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4 transition-colors hover:border-accent-lime hover:text-accent-lime"
      >
        {t("delete")}
      </button>
    </>
  );
}
