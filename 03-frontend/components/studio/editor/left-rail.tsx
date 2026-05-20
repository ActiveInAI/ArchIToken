"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useTranslations } from "next-intl";
import { LEFT_RAIL_TOOLS } from "@/content/left-rail-tools";
import type { LeftRailTool } from "@/stores/studio-editor.store";
import { useStudioEditorStore } from "@/stores/studio-editor.store";

export function LeftRail() {
  const t = useTranslations();
  const currentTool = useStudioEditorStore((s) => s.currentTool);
  const setTool = useStudioEditorStore((s) => s.setTool);
  const buildSubTool = useStudioEditorStore((s) => s.buildSubTool);
  const editActive =
    currentTool === "build" &&
    (buildSubTool === "move-wall" || buildSubTool === "move-room");

  return (
    <ToggleGroup.Root
      type="single"
      value={currentTool}
      onValueChange={(v) => {
        if (v) setTool(v as LeftRailTool);
      }}
      className="flex h-full w-12 flex-col items-stretch border-r border-fg-2 bg-fg-0 py-2"
    >
      {LEFT_RAIL_TOOLS.map((tool) => {
        const showBadge = tool.id === "build" && editActive;
        return (
          <ToggleGroup.Item
            key={tool.id}
            value={tool.id}
            title={t(tool.labelKey)}
            aria-label={t(tool.labelKey)}
            className="relative flex h-11 items-center justify-center border-l-2 border-transparent text-fg-4 transition-colors hover:text-fg-8 data-[state=on]:border-l-accent-lime data-[state=on]:bg-fg-1 data-[state=on]:text-accent-lime"
          >
            <span className="text-[18px] leading-none">{tool.symbol}</span>
            {showBadge ? (
              <span className="absolute bottom-1.5 right-1.5 block size-1.5 rounded-full bg-accent-lime" />
            ) : null}
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}
