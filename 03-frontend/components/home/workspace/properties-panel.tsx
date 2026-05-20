"use client";

import { useTranslations } from "next-intl";
import type { Room, RoomGrade } from "@/lib/insome/floorplan";
import { floorplanRoomBounds } from "@/lib/insome/floorplan";
import { getVariantById } from "@/content/floorplan-variants.home";
import {
  DEFAULT_COLOR,
  DEFAULT_GRADE,
  DEFAULT_MATERIAL,
} from "@/content/room-options";
import { useFloorplanStore } from "@/stores/floorplan.store";
import { ColorPopover, GradeSelect, MaterialSelect } from "./properties-controls";

function formatLength(units: number, unitsPerMeter: number, unit: "m" | "ft") {
  const meters = units / unitsPerMeter;
  if (unit === "ft") return `${(meters * 3.28084).toFixed(2)} ft`;
  return `${meters.toFixed(2)} m`;
}

function formatArea(w: number, h: number, unitsPerMeter: number, unit: "m" | "ft") {
  const m2 = (w * h) / (unitsPerMeter * unitsPerMeter);
  if (unit === "ft") return `${(m2 * 10.7639).toFixed(1)} ft²`;
  return `${m2.toFixed(2)} m²`;
}

export function PropertiesPanel() {
  const t = useTranslations("home.workspace.properties");
  const tAny = useTranslations();
  const tShare = useTranslations("home.share");
  const {
    currentVariantId,
    selectedRoomId,
    selectedRoomLabelKey,
    roomOverrides,
    setRoomOverride,
  } = useFloorplanStore();

  const variant = getVariantById(currentVariantId);
  const room: Room | undefined = variant?.rooms.find((r) => r.id === selectedRoomId) ?? undefined;
  const roomBounds = variant && room ? floorplanRoomBounds(variant, room.id) : null;
  const roomWidth = roomBounds ? roomBounds.maxX - roomBounds.minX : 0;
  const roomHeight = roomBounds ? roomBounds.maxY - roomBounds.minY : 0;

  if (!variant || !room || !selectedRoomId || !selectedRoomLabelKey) {
    return (
      <div className="flex h-full flex-col bg-fg-8">
        <div className="border-b border-fg-6 px-4 py-3">
          <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-3">
            {t("header")}
          </span>
        </div>
        <div className="flex-1 p-6">
          <p className="max-w-[28ch] text-small text-fg-3">{t("empty")}</p>
        </div>
      </div>
    );
  }

  const override = roomOverrides[room.id] ?? {};
  const currentMaterial = override.material ?? room.material ?? DEFAULT_MATERIAL;
  const currentGrade: RoomGrade = override.grade ?? room.grade ?? DEFAULT_GRADE;
  const currentColor = override.color ?? room.color ?? DEFAULT_COLOR;

  /* TODO(phase-4): wire Replace / Restore to real regeneration + restore-snapshot APIs */
  const showExportComingSoon = () => {
    if (typeof window !== "undefined") window.alert(tShare("exportComingSoon"));
  };

  return (
    <div className="flex h-full flex-col bg-fg-8">
      <div className="flex items-center justify-between border-b border-fg-6 px-4 py-3">
        <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-3">
          {t("header")}
        </span>
        <span className="font-mono text-micro text-accent-signal">{t("selected")}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-5 font-display text-h3 font-bold tracking-tight">
          {tAny(selectedRoomLabelKey)}
        </div>

        <PropertyRow label={t("width")}>
          <ReadOnlyField value={formatLength(roomWidth, variant.scale.unitsPerMeter, variant.unit)} />
        </PropertyRow>

        <PropertyRow label={t("length")}>
          <ReadOnlyField value={formatLength(roomHeight, variant.scale.unitsPerMeter, variant.unit)} />
        </PropertyRow>

        <PropertyRow label={t("area")} hint={t("areaAuto")}>
          <ReadOnlyField
            value={formatArea(roomWidth, roomHeight, variant.scale.unitsPerMeter, variant.unit)}
          />
        </PropertyRow>

        <PropertyRow label={t("material")}>
          <MaterialSelect
            value={currentMaterial}
            onChange={(id) => setRoomOverride(room.id, { material: id })}
          />
        </PropertyRow>

        <PropertyRow label={t("grade")}>
          <GradeSelect
            value={currentGrade}
            onChange={(id) => setRoomOverride(room.id, { grade: id })}
          />
        </PropertyRow>

        <PropertyRow label={t("color")}>
          <ColorPopover
            value={currentColor}
            onChange={(hex) => setRoomOverride(room.id, { color: hex })}
          />
        </PropertyRow>

        <button
          type="button"
          onClick={showExportComingSoon}
          className="mt-4 w-full border border-accent-signal bg-accent-signal px-3 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-9 transition-opacity hover:opacity-90"
        >
          {t("replace")}
        </button>

        <hr className="my-5 border-t border-fg-6" />

        <button
          type="button"
          onClick={showExportComingSoon}
          className="w-full font-mono text-micro tracking-eyebrow uppercase text-fg-3 transition-colors hover:text-fg-0"
        >
          {t("restoreProject")}
        </button>
      </div>
    </div>
  );
}

function PropertyRow({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-3">{label}</span>
        {hint ? <span className="font-mono text-micro text-fg-4">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function ReadOnlyField({ value }: { value: string }) {
  return (
    <div className="border border-fg-6 bg-fg-9 px-2.5 py-1.5 font-sans text-small text-fg-0">
      {value}
    </div>
  );
}
