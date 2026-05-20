"use client";

import * as Slider from "@radix-ui/react-slider";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useTranslations } from "next-intl";
import type { AccentChoice, Density } from "@/lib/insome/types";
import { FONT_SCALE_STEPS } from "@/lib/insome/types";
import { cn } from "@/lib/insome/ui";
import { useCustomizationStore } from "@/stores/customization.store";

export function CustomizationPanel() {
  const t = useTranslations("studio.customization");
  const { accent, density, fontScale, setAccent, setDensity, setFontScale, reset } =
    useCustomizationStore();

  return (
    <div className="flex flex-col gap-5 p-4">
      <Section labelKey="studio.customization.accentLabel">
        <ToggleGroup.Root
          type="single"
          value={accent}
          onValueChange={(v) => v && setAccent(v as AccentChoice)}
          className="inline-flex border border-fg-2"
        >
          <CustomToggle value="signal" labelKey="studio.customization.accent.signal" />
          <CustomToggle value="lime" labelKey="studio.customization.accent.lime" />
        </ToggleGroup.Root>
      </Section>

      <Section labelKey="studio.customization.densityLabel">
        <ToggleGroup.Root
          type="single"
          value={density}
          onValueChange={(v) => v && setDensity(v as Density)}
          className="inline-flex border border-fg-2"
        >
          <CustomToggle value="compact" labelKey="studio.customization.density.compact" />
          <CustomToggle value="comfortable" labelKey="studio.customization.density.comfortable" />
          <CustomToggle value="spacious" labelKey="studio.customization.density.spacious" />
        </ToggleGroup.Root>
      </Section>

      <Section labelKey="studio.customization.fontScale">
        <div className="flex items-center gap-3">
          <Slider.Root
            value={[FONT_SCALE_STEPS.indexOf(fontScale)]}
            min={0}
            max={FONT_SCALE_STEPS.length - 1}
            step={1}
            onValueChange={([idx]) => {
              if (idx !== undefined) {
                const v = FONT_SCALE_STEPS[idx];
                if (v !== undefined) setFontScale(v);
              }
            }}
            className="relative flex h-5 flex-1 select-none items-center"
          >
            <Slider.Track className="relative h-1 w-full bg-fg-2">
              <Slider.Range className="absolute h-full bg-accent-lime" />
            </Slider.Track>
            <Slider.Thumb
              aria-label={t("fontScale")}
              className="block h-3 w-3 border border-accent-lime bg-fg-0 focus:outline-none focus:ring-1 focus:ring-accent-lime"
            />
          </Slider.Root>
          <span className="font-mono text-micro text-accent-lime">{fontScale.toFixed(3)}×</span>
        </div>
      </Section>

      <button
        type="button"
        onClick={reset}
        className="border border-fg-2 bg-fg-0 px-3 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4 transition-colors hover:border-accent-lime hover:text-fg-8"
      >
        ↺ {t("reset")}
      </button>

      <div className="border-t border-fg-2 pt-3 font-mono text-[10px] text-fg-4">
        {t("scope")}
      </div>
    </div>
  );
}

function Section({ labelKey, children }: { labelKey: string; children: React.ReactNode }) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
        {t(labelKey)}
      </span>
      {children}
    </div>
  );
}

function CustomToggle({ value, labelKey }: { value: string; labelKey: string }) {
  const t = useTranslations();
  return (
    <ToggleGroup.Item
      value={value}
      className={cn(
        "px-3 py-1.5 font-mono text-micro tracking-eyebrow uppercase text-fg-4",
        "data-[state=on]:bg-accent-lime data-[state=on]:text-fg-0",
      )}
    >
      {t(labelKey)}
    </ToggleGroup.Item>
  );
}
