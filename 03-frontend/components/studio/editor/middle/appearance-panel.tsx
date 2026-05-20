"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/insome/ui";
import type { FloorplanScheme } from "@/lib/insome/floorplan";
import { APPEARANCE_SCHEMES } from "@/content/appearance-schemes";
import { useStudioEditorStore } from "@/stores/studio-editor.store";

export function AppearancePanel() {
  const t = useTranslations();
  const tApp = useTranslations("studio.appearance");
  const {
    scheme,
    showMeasurements,
    showLabels,
    showGrid,
    setScheme,
    toggleDisplay,
  } = useStudioEditorStore();

  return (
    <div className="flex flex-col gap-4 p-4">
      <section>
        <div className="mb-3 font-mono text-micro tracking-eyebrow uppercase text-fg-4">
          {tApp("displayHeader")}
        </div>
        <DisplayCheckbox
          labelKey="studio.appearance.showMeasurements"
          checked={showMeasurements}
          onToggle={() => toggleDisplay("showMeasurements")}
        />
        <DisplayCheckbox
          labelKey="studio.appearance.showLabels"
          checked={showLabels}
          onToggle={() => toggleDisplay("showLabels")}
        />
        <DisplayCheckbox
          labelKey="studio.appearance.showGrid"
          checked={showGrid}
          onToggle={() => toggleDisplay("showGrid")}
        />
      </section>

      <section className="border-t border-fg-2 pt-4">
        <div className="mb-3 font-mono text-micro tracking-eyebrow uppercase text-fg-4">
          {tApp("schemeHeader")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {APPEARANCE_SCHEMES.map((sch) => {
            const mapped: FloorplanScheme =
              sch.id === "gradient" ? "standard" : (sch.id as FloorplanScheme);
            const isActive = scheme === mapped && sch.id !== "gradient";
            return (
              <button
                key={sch.id}
                type="button"
                onClick={() => setScheme(mapped)}
                className={cn(
                  "flex flex-col items-start gap-2 border bg-fg-0 p-2 transition-colors",
                  isActive ? "border-accent-lime" : "border-fg-2 hover:border-accent-lime",
                )}
              >
                <div className="flex h-5 w-full overflow-hidden border border-fg-2">
                  {sch.swatch.map((hex) => (
                    <div key={hex} className="flex-1" style={{ background: hex }} />
                  ))}
                </div>
                <span className="font-mono text-micro text-fg-8">{t(sch.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function DisplayCheckbox({
  labelKey,
  checked,
  onToggle,
}: {
  readonly labelKey: string;
  readonly checked: boolean;
  readonly onToggle: () => void;
}) {
  const t = useTranslations();
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1.5 text-small text-fg-8">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-3.5 w-3.5 accent-accent-lime"
      />
      {t(labelKey)}
    </label>
  );
}
