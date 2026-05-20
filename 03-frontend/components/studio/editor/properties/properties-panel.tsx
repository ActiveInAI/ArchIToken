"use client";

import { useTranslations } from "next-intl";
import { useStudioEditorStore } from "@/stores/studio-editor.store";
import { RoomProperties } from "./room-properties";
import { WallProperties } from "./wall-properties";
import { OpeningProperties } from "./opening-properties";

export function StudioPropertiesPanel() {
  const tProps = useTranslations("studio.properties");
  const selection = useStudioEditorStore((s) => s.selection);
  const floorplan = useStudioEditorStore((s) => s.activeFloorplan);

  const body = (() => {
    if (!floorplan || !selection) {
      return <div className="p-6 font-mono text-micro text-fg-4">{tProps("empty")}</div>;
    }
    if (selection.kind === "room") {
      return (
        <div className="p-4">
          <RoomProperties roomId={selection.id} floorplan={floorplan} />
        </div>
      );
    }
    if (selection.kind === "wall") {
      return (
        <div className="p-4">
          <WallProperties wallId={selection.id} floorplan={floorplan} />
        </div>
      );
    }
    if (selection.kind === "opening") {
      return (
        <div className="p-4">
          <OpeningProperties openingId={selection.id} floorplan={floorplan} />
        </div>
      );
    }
    return <div className="p-6 font-mono text-micro text-fg-4">{tProps("empty")}</div>;
  })();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-fg-2 px-4 py-3">
        <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
          {tProps("header")}
        </span>
        {selection ? (
          <span className="font-mono text-micro text-accent-lime">{tProps("selected")}</span>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto">{body}</div>
    </div>
  );
}
