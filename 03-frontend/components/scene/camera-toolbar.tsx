"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/insome/ui";
import type { CameraPreset } from "@/lib/insome/scene";

const PRESETS: ReadonlyArray<{ id: CameraPreset; labelKey: string }> = [
  { id: "iso", labelKey: "canvas.camera.iso" },
  { id: "top", labelKey: "canvas.camera.top" },
  { id: "perspective", labelKey: "canvas.camera.perspective" },
];

export interface CameraToolbarProps {
  readonly preset: CameraPreset;
  readonly onPresetChange: (p: CameraPreset) => void;
  readonly onFitView?: () => void;
  readonly theme?: "home" | "studio";
}

export function CameraToolbar({ preset, onPresetChange, onFitView, theme = "studio" }: CameraToolbarProps) {
  const t = useTranslations();
  const accent = theme === "studio" ? "text-accent-lime" : "text-accent-signal";
  const border = theme === "studio" ? "border-accent-lime" : "border-accent-signal";
  return (
    <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2">
      <ToggleGroup.Root
        type="single"
        value={preset}
        onValueChange={(v) => {
          if (v) onPresetChange(v as CameraPreset);
        }}
        className="pointer-events-auto flex border border-fg-2 bg-fg-0"
        aria-label={t("canvas.camera.ariaLabel")}
      >
        {PRESETS.map((p) => (
          <ToggleGroup.Item
            key={p.id}
            value={p.id}
            aria-label={t(p.labelKey)}
            className={cn(
              "px-3 py-1.5 font-mono text-micro tracking-eyebrow uppercase text-fg-4",
              "transition-colors hover:text-fg-8",
              `data-[state=on]:bg-fg-1 data-[state=on]:${accent}`,
              `data-[state=on]:border-r data-[state=on]:${border}`,
            )}
          >
            {t(p.labelKey)}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      {onFitView ? (
        <button
          type="button"
          onClick={onFitView}
          className={cn(
            "pointer-events-auto border border-fg-2 bg-fg-0 px-3 py-1.5",
            "font-mono text-micro tracking-eyebrow uppercase text-fg-4",
            "transition-colors hover:text-fg-8",
          )}
        >
          {t("canvas.camera.fitView")}
        </button>
      ) : null}
    </div>
  );
}
