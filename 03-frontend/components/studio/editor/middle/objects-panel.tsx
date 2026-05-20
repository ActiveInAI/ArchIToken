"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/insome/ui";
import { floorplanRoomBounds } from "@/lib/insome/floorplan";
import { useActiveFloorplan } from "@/lib/proposal/use-active-floorplan";
import { useStudioEditorStore } from "@/stores/studio-editor.store";

export function ObjectsPanel() {
  const t = useTranslations();
  const tObj = useTranslations("studio.objects");
  const floorplan = useActiveFloorplan();
  const selection = useStudioEditorStore((s) => s.selection);
  const selectRoom = useStudioEditorStore((s) => s.selectRoom);
  const selectedRoomId = selection?.kind === "room" ? selection.id : null;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 border border-fg-2 bg-fg-0 px-2.5 py-1.5 font-mono text-micro text-fg-4">
        🔍 {tObj("searchPlaceholder")}
      </div>
      <div className="flex flex-col">
        {floorplan?.rooms.map((r) => {
          const b = floorplanRoomBounds(floorplan, r.id);
          const w = b ? Math.round(b.maxX - b.minX) : 0;
          const h = b ? Math.round(b.maxY - b.minY) : 0;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => selectRoom(r.id, r.labelKey)}
              className={cn(
                "flex items-center justify-between border-b border-fg-2 px-1 py-2 text-left text-small transition-colors hover:text-accent-lime",
                selectedRoomId === r.id ? "text-accent-lime" : "text-fg-8",
              )}
            >
              <span>{t(r.labelKey)}</span>
              <span className="font-mono text-micro text-fg-4">
                {w} × {h}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
