"use client";

import { useTranslations } from "next-intl";
import { floorplanRoomBounds, type Floorplan } from "@/lib/insome/floorplan";
import { FLOOR_FINISHES, LIGHT_FIXTURES, WALL_FINISHES } from "@/content/studio-property-options";
import { useStudioEditorStore } from "@/stores/studio-editor.store";
import { createDeleteRoomCommand } from "@/lib/command";
import { NumField, ReadOnlyField, SelectField } from "./properties-fields";

function formatAreaSqft(w: number, h: number, unitsPerMeter: number): number {
  const m2 = (w * h) / (unitsPerMeter * unitsPerMeter);
  return Math.round(m2 * 10.7639);
}

export function RoomProperties({ roomId, floorplan }: { roomId: string; floorplan: Floorplan }) {
  const t = useTranslations();
  const tProps = useTranslations("studio.properties");
  const roomOverrides = useStudioEditorStore((s) => s.roomOverrides);
  const setRoomOverride = useStudioEditorStore((s) => s.setRoomOverride);
  const pushCommand = useStudioEditorStore((s) => s.pushCommand);
  const setSelection = useStudioEditorStore((s) => s.setSelection);
  const selection = useStudioEditorStore((s) => s.selection);

  const room = floorplan.rooms.find((r) => r.id === roomId);
  const roomBounds = room ? floorplanRoomBounds(floorplan, room.id) : null;
  const roomW = roomBounds ? roomBounds.maxX - roomBounds.minX : 0;
  const roomH = roomBounds ? roomBounds.maxY - roomBounds.minY : 0;
  if (!room) return null;

  const override = roomOverrides[room.id] ?? {};
  const areaSqft = formatAreaSqft(roomW, roomH, floorplan.scale.unitsPerMeter);
  const labelKey = room.labelKey;

  return (
    <>
      <div className="mb-4 font-display text-h3 font-bold tracking-tight text-fg-8">
        {t(labelKey)}
      </div>

      <NumField
        label={tProps("width")}
        unit="ft"
        value={override.widthFt ?? Math.round((roomW / floorplan.scale.unitsPerMeter) * 3.28)}
        onChange={(widthFt) => setRoomOverride(room.id, { widthFt })}
      />
      <NumField
        label={tProps("length")}
        unit="ft"
        value={override.lengthFt ?? Math.round((roomH / floorplan.scale.unitsPerMeter) * 3.28)}
        onChange={(lengthFt) => setRoomOverride(room.id, { lengthFt })}
      />
      <ReadOnlyField label={tProps("area")} value={`${areaSqft} ft²`} hint={tProps("areaAuto")} />

      <NumField
        label={tProps("ceiling")}
        unit="ft"
        value={override.ceilingFt ?? 9.0}
        step={0.5}
        onChange={(ceilingFt) => setRoomOverride(room.id, { ceilingFt })}
      />

      <SelectField
        label={tProps("floorFinish")}
        options={FLOOR_FINISHES}
        value={override.floorFinish ?? FLOOR_FINISHES[0]!.id}
        onChange={(floorFinish) => setRoomOverride(room.id, { floorFinish })}
      />
      <SelectField
        label={tProps("wallFinish")}
        options={WALL_FINISHES}
        value={override.wallFinish ?? WALL_FINISHES[0]!.id}
        onChange={(wallFinish) => setRoomOverride(room.id, { wallFinish })}
      />
      <SelectField
        label={tProps("lightFixtures")}
        options={LIGHT_FIXTURES}
        value={override.lightFixture ?? LIGHT_FIXTURES[1]!.id}
        onChange={(lightFixture) => setRoomOverride(room.id, { lightFixture })}
      />

      <button
        type="button"
        className="mt-5 w-full border border-accent-lime bg-accent-lime px-3 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-0 transition-opacity hover:opacity-90"
      >
        ✓ {tProps("apply")}
      </button>

      <button
        type="button"
        onClick={() => {
          pushCommand(createDeleteRoomCommand({ roomId: room.id, selectionSnapshot: selection }));
          setSelection(null);
        }}
        className="mt-3 w-full border border-fg-2 bg-fg-0 px-3 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4 transition-colors hover:border-accent-lime hover:text-accent-lime"
      >
        {tProps("room.delete")}
      </button>
    </>
  );
}
