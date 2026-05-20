"use client";

import { useTranslations } from "next-intl";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/insome/ui";
import {
  WORK_CATEGORIES,
  WORK_STYLE_FILTERS,
  WORK_BEDROOMS_FILTERS,
  WORK_PRICE_FILTERS,
  WORK_LEVEL_FILTERS,
  type WorkCategory,
  type WorkStyleFilter,
  type WorkBedroomsFilter,
  type WorkPriceFilter,
  type WorkLevelFilter,
} from "@/content/work-categories";

export interface FilterBarValue {
  category: WorkCategory;
  style: WorkStyleFilter;
  bedrooms: WorkBedroomsFilter;
  price: WorkPriceFilter;
  level: WorkLevelFilter;
}

export const DEFAULT_FILTER: FilterBarValue = {
  category: "all",
  style: "all",
  bedrooms: "all",
  price: "all",
  level: "all",
};

interface FilterBarProps {
  readonly value: FilterBarValue;
  readonly onChange: (next: FilterBarValue) => void;
  readonly theme: "dark" | "light";
  readonly compact?: boolean;
}

export function FilterBar({ value, onChange, theme, compact = false }: FilterBarProps) {
  const tFilter = useTranslations("home.work.filter");
  const tCategory = useTranslations("home.work.category");
  const tStyle = useTranslations("home.work.style");
  const onDark = theme === "dark";

  return (
    <div className={cn("flex w-full flex-wrap items-center gap-x-6 gap-y-3", onDark ? "text-fg-8" : "text-fg-0")}>
      <Group
        label={tFilter("category")}
        items={WORK_CATEGORIES}
        renderLabel={(c) => tCategory(c)}
        value={value.category}
        onChange={(v) => onChange({ ...value, category: v as WorkCategory })}
        onDark={onDark}
      />
      {!compact ? (
        <Group
          label={tFilter("style")}
          items={WORK_STYLE_FILTERS}
          renderLabel={(s) => tStyle(s)}
          value={value.style}
          onChange={(v) => onChange({ ...value, style: v as WorkStyleFilter })}
          onDark={onDark}
        />
      ) : null}
      {!compact ? (
        <Group
          label={tFilter("bedrooms")}
          items={WORK_BEDROOMS_FILTERS}
          renderLabel={(b) => (b === "all" ? tFilter("any") : b)}
          value={value.bedrooms}
          onChange={(v) => onChange({ ...value, bedrooms: v as WorkBedroomsFilter })}
          onDark={onDark}
        />
      ) : null}
      {!compact ? (
        <Group
          label={tFilter("priceRange")}
          items={WORK_PRICE_FILTERS}
          renderLabel={(p) => tFilter(`price.${p}` as never)}
          value={value.price}
          onChange={(v) => onChange({ ...value, price: v as WorkPriceFilter })}
          onDark={onDark}
        />
      ) : null}
      {!compact ? (
        <Group
          label={tFilter("designerLevel")}
          items={WORK_LEVEL_FILTERS}
          renderLabel={(l) => (l === "all" ? tFilter("any") : `Lv${l}`)}
          value={value.level}
          onChange={(v) => onChange({ ...value, level: v as WorkLevelFilter })}
          onDark={onDark}
        />
      ) : null}
    </div>
  );
}

interface GroupProps<T extends string> {
  readonly label: string;
  readonly items: ReadonlyArray<T>;
  readonly renderLabel: (v: T) => string;
  readonly value: T;
  readonly onChange: (next: T) => void;
  readonly onDark: boolean;
}

function Group<T extends string>({ label, items, renderLabel, value, onChange, onDark }: GroupProps<T>) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("font-mono text-micro tracking-eyebrow uppercase", onDark ? "text-fg-4" : "text-fg-3")}>{label}</span>
      <ToggleGroup.Root
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as T)}
        className="flex flex-wrap gap-1.5"
      >
        {items.map((item) => (
          <ToggleGroup.Item
            key={item}
            value={item}
            className={cn(
              "px-3 py-1.5 font-mono text-micro tracking-eyebrow uppercase transition-colors",
              onDark
                ? "border border-fg-2 bg-fg-1 text-fg-5 hover:border-fg-4 data-[state=on]:border-accent-lime data-[state=on]:bg-fg-0 data-[state=on]:text-accent-lime"
                : "border border-fg-6 bg-fg-9 text-fg-3 hover:border-fg-3 data-[state=on]:border-accent-signal data-[state=on]:bg-fg-9 data-[state=on]:text-accent-signal",
            )}
          >
            {renderLabel(item)}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}

export function applyFilter(works: ReadonlyArray<{
  category: "architecture" | "interior";
  style: string;
  bedrooms: number;
  estimatedPriceMaxWan: number;
  creator: { level: 1 | 2 | 3 | 4; isHomeowner: boolean };
}>, filter: FilterBarValue) {
  return works.filter((w) => {
    if (filter.category !== "all" && w.category !== filter.category) return false;
    if (filter.style !== "all" && w.style !== filter.style) return false;
    if (filter.bedrooms !== "all") {
      if (filter.bedrooms === "4+" ? w.bedrooms < 4 : w.bedrooms !== Number(filter.bedrooms)) {
        return false;
      }
    }
    if (filter.price !== "all") {
      const max = w.estimatedPriceMaxWan;
      if (filter.price === "lt-50" && max >= 50) return false;
      if (filter.price === "50-150" && (max < 50 || max > 150)) return false;
      if (filter.price === "150-300" && (max < 150 || max > 300)) return false;
      if (filter.price === "gt-300" && max <= 300) return false;
    }
    if (filter.level !== "all") {
      if (w.creator.isHomeowner) return false;
      if (String(w.creator.level) !== filter.level) return false;
    }
    return true;
  });
}
