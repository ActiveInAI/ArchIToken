"use client";

import { useTranslations } from "next-intl";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/insome/ui";
import {
  MAX_BATHROOMS,
  MAX_BEDROOMS,
  MAX_LENGTH_FT,
  MAX_WIDTH_FT,
  MIN_BATHROOMS,
  MIN_BEDROOMS,
  MIN_LENGTH_FT,
  MIN_WIDTH_FT,
  STORIES_OPTIONS,
  STYLES,
} from "@/content/create-form.defaults";
import { useStudioCreateStore } from "@/stores/studio-create.store";
import { useStudioViewStore } from "@/stores/studio-view.store";
import { NumberField, Stat, StyleOptionItem } from "./step-2-fields";

export function CreateStep2Form() {
  const t = useTranslations("studio.create.step2");
  const { form, setStep2Mode, updateResidential, updatePrompt } = useStudioCreateStore();
  const goTo = useStudioViewStore((s) => s.goTo);

  const totalSqft = form.residential.widthFt * form.residential.lengthFt;
  const totalRooms = form.residential.bedrooms + form.residential.bathrooms;

  return (
    <div className="mx-auto flex w-full max-w-landing flex-col gap-6 px-10 py-12">
      <header>
        <div className="eyebrow text-fg-4">{t("eyebrow")}</div>
        <h1 className="mt-2 font-display text-[42px] font-extrabold tracking-tight text-fg-8">
          {t("title")}
        </h1>
      </header>

      <ToggleGroup.Root
        type="single"
        value={form.step2Mode}
        onValueChange={(v) => v && setStep2Mode(v === "prompt" ? "prompt" : "residential")}
        className="inline-flex border border-fg-2"
      >
        <ToggleGroup.Item
          value="residential"
          className="px-4 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4 data-[state=on]:bg-accent-lime data-[state=on]:text-fg-0"
        >
          {t("residential")}
        </ToggleGroup.Item>
        <ToggleGroup.Item
          value="prompt"
          className="px-4 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4 data-[state=on]:bg-accent-lime data-[state=on]:text-fg-0"
        >
          {t("prompt")}
        </ToggleGroup.Item>
      </ToggleGroup.Root>

      {form.step2Mode === "residential" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumberField
            label={t("width")}
            unit="ft"
            value={form.residential.widthFt}
            min={MIN_WIDTH_FT}
            max={MAX_WIDTH_FT}
            onChange={(widthFt) => updateResidential({ widthFt })}
          />
          <NumberField
            label={t("length")}
            unit="ft"
            value={form.residential.lengthFt}
            min={MIN_LENGTH_FT}
            max={MAX_LENGTH_FT}
            onChange={(lengthFt) => updateResidential({ lengthFt })}
          />
          <div className="flex flex-col gap-1">
            <label className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
              {t("stories")}
            </label>
            <ToggleGroup.Root
              type="single"
              value={String(form.residential.stories)}
              onValueChange={(v) => v && updateResidential({ stories: Number(v) as 1 | 2 | 3 })}
              className="inline-flex border border-fg-2"
            >
              {STORIES_OPTIONS.map((n) => (
                <ToggleGroup.Item
                  key={n}
                  value={String(n)}
                  className="px-4 py-2 font-mono text-small text-fg-4 data-[state=on]:bg-accent-lime data-[state=on]:text-fg-0"
                >
                  {n}
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
              {t("style")}
            </label>
            <select
              value={form.residential.style}
              onChange={(e) => updateResidential({ style: e.target.value })}
              className="border border-fg-2 bg-fg-0 px-3 py-2 text-small text-fg-8 focus:border-accent-lime focus:outline-none"
            >
              {STYLES.map((s) => (
                <StyleOptionItem key={s.id} id={s.id} labelKey={s.labelKey} />
              ))}
            </select>
          </div>
          <NumberField
            label={t("bedrooms")}
            unit=""
            value={form.residential.bedrooms}
            min={MIN_BEDROOMS}
            max={MAX_BEDROOMS}
            onChange={(bedrooms) => updateResidential({ bedrooms })}
          />
          <NumberField
            label={t("bathrooms")}
            unit=""
            value={form.residential.bathrooms}
            min={MIN_BATHROOMS}
            max={MAX_BATHROOMS}
            onChange={(bathrooms) => updateResidential({ bathrooms })}
          />
          <div className="col-span-full grid grid-cols-2 gap-4 border-t border-fg-2 pt-4 md:grid-cols-3">
            <Stat label={t("totalSqft")} value={`${totalSqft.toLocaleString()} ft²`} />
            <Stat label={t("totalRooms")} value={String(totalRooms)} />
            <Stat label={t("livingSqft")} value={`${Math.round(totalSqft * 0.85).toLocaleString()} ft²`} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
            {t("promptLabel")}
          </label>
          <textarea
            value={form.prompt.text}
            onChange={(e) => updatePrompt(e.target.value)}
            rows={6}
            placeholder={t("promptPlaceholder")}
            className="w-full border border-fg-2 bg-fg-0 p-3 font-sans text-small text-fg-8 placeholder:text-fg-3 focus:border-accent-lime focus:outline-none"
          />
          <div className="font-mono text-micro text-fg-4">
            {form.prompt.text.length} chars
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => goTo("create-generating")}
          className={cn(
            "border border-accent-lime bg-accent-lime px-6 py-2.5 font-mono text-micro tracking-eyebrow uppercase text-fg-0",
            "transition-opacity hover:opacity-90",
          )}
        >
          {t("generate")} →
        </button>
      </div>
    </div>
  );
}
