"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/insome/ui";
import type { TemplateHouseType, TemplateStyle } from "@/content/templates.mock";

export interface GalleryFilters {
  readonly style: TemplateStyle | "all";
  readonly houseType: TemplateHouseType | "all";
}

export interface GalleryFiltersBarProps {
  readonly value: GalleryFilters;
  readonly onChange: (next: GalleryFilters) => void;
}

const STYLES: ReadonlyArray<TemplateStyle | "all"> = ["all", "modern", "minimalist", "classic", "scandinavian"];
const HOUSE_TYPES: ReadonlyArray<TemplateHouseType | "all"> = ["all", "1-bedroom", "2-bedroom", "3-bedroom", "villa", "loft"];

export function GalleryFiltersBar({ value, onChange }: GalleryFiltersBarProps) {
  const t = useTranslations("home.template.gallery");
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
      <FilterGroup
        label={t("filter.style")}
        value={value.style}
        options={STYLES}
        onChange={(next) => onChange({ ...value, style: next as TemplateStyle | "all" })}
        labelPrefix="style"
      />
      <FilterGroup
        label={t("filter.houseType")}
        value={value.houseType}
        options={HOUSE_TYPES}
        onChange={(next) => onChange({ ...value, houseType: next as TemplateHouseType | "all" })}
        labelPrefix="houseType"
      />
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  labelPrefix,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<T>;
  onChange: (next: T) => void;
  labelPrefix: string;
}) {
  const t = useTranslations("home.template.gallery");
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-3">
        {label}
      </span>
      <ToggleGroup.Root
        type="single"
        value={value}
        onValueChange={(v) => { if (v) onChange(v as T); }}
        className="flex flex-wrap gap-1"
      >
        {options.map((opt) => (
          <ToggleGroup.Item
            key={opt}
            value={opt}
            className={cn(
              "border border-fg-6 bg-fg-9 px-2.5 py-1 font-mono text-micro tracking-eyebrow uppercase text-fg-3",
              "transition-colors hover:text-fg-0",
              "data-[state=on]:border-accent-signal data-[state=on]:text-accent-signal",
            )}
          >
            {t(`${labelPrefix}.${opt}` as never)}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}
