"use client";

import * as Slider from "@radix-ui/react-slider";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/insome/ui";
import { useStudioEditorStore, type BuildSubTool } from "@/stores/studio-editor.store";

interface SubToolDef {
  readonly id: BuildSubTool;
  readonly symbol: string;
  readonly labelKey: string;
}

// LEGACY(phase-4.0): the 5 creation tools (draw-wall / draw-room-rect /
// place-door / place-window / place-opening) are intentionally removed from
// the demo Build panel. Underlying code (Commands + creation-gesture) is
// preserved for the future deep-design phase. See editor/LEGACY.md.
const SUB_TOOLS: ReadonlyArray<SubToolDef> = [
  { id: "select", symbol: "↖", labelKey: "studio.build.tool.select" },
  { id: "move-wall", symbol: "⇕", labelKey: "studio.build.tool.moveWall" },
  { id: "move-room", symbol: "✥", labelKey: "studio.build.tool.moveRoom" },
];

export function BuildPanel() {
  const t = useTranslations();
  const tBuild = useTranslations("studio.build");
  const { buildSubTool, setBuildSubTool, wallThickness, setWallThickness } =
    useStudioEditorStore();

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <div className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
          {tBuild("title")}
        </div>
      </div>

      <ToggleGroup.Root
        type="single"
        value={buildSubTool ?? ""}
        onValueChange={(v) => setBuildSubTool(v ? (v as BuildSubTool) : null)}
        className="grid grid-cols-3 gap-1.5"
      >
        {SUB_TOOLS.map((tool) => (
          <ToggleGroup.Item
            key={tool.id}
            value={tool.id}
            aria-label={t(tool.labelKey)}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1 border border-fg-2 bg-fg-0 text-fg-4",
              "transition-colors hover:border-accent-lime hover:text-fg-8",
              "data-[state=on]:border-accent-lime data-[state=on]:bg-fg-1 data-[state=on]:text-accent-lime",
            )}
          >
            <span className="text-[18px] leading-none">{tool.symbol}</span>
            <span className="font-mono text-[9px] tracking-eyebrow uppercase">{t(tool.labelKey)}</span>
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>

      <div className="flex flex-col gap-2 border-t border-fg-2 pt-4">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
            {tBuild("wallThickness")}
          </span>
          <span className="font-mono text-micro text-accent-lime">
            {wallThickness} {tBuild("wallThicknessUnit")}
          </span>
        </div>
        <Slider.Root
          value={[wallThickness]}
          min={2}
          max={24}
          step={1}
          onValueChange={([v]) => {
            if (v !== undefined) setWallThickness(v);
          }}
          className="relative flex h-5 w-full select-none items-center"
        >
          <Slider.Track className="relative h-1 w-full bg-fg-2">
            <Slider.Range className="absolute h-full bg-accent-lime" />
          </Slider.Track>
          <Slider.Thumb
            aria-label={tBuild("wallThickness")}
            className="block h-3 w-3 border border-accent-lime bg-fg-0 focus:outline-none focus:ring-1 focus:ring-accent-lime"
          />
        </Slider.Root>
      </div>

      <div className="border-t border-fg-2 pt-4 font-mono text-micro text-fg-4">
        {buildSubTool ? tBuild(`hint.${buildSubTool}`) : tBuild("hint.pickTool")}
      </div>
    </div>
  );
}
