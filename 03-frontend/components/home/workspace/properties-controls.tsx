"use client";

import * as Select from "@radix-ui/react-select";
import * as Popover from "@radix-ui/react-popover";
import { useTranslations } from "next-intl";
import type { RoomGrade } from "@/lib/insome/floorplan";
import { cn } from "@/lib/insome/ui";
import { colorSwatches, gradeOptions, materialOptions } from "@/content/room-options";

export function MaterialSelect({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (id: string) => void;
}) {
  const t = useTranslations();
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="flex w-full items-center justify-between border border-fg-6 bg-fg-9 px-2.5 py-1.5 text-small text-fg-0 focus:border-fg-0 focus:outline-none">
        <Select.Value />
        <Select.Icon className="text-fg-3">▾</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 border border-fg-6 bg-fg-9 py-1 text-small shadow-lift">
          <Select.Viewport>
            {materialOptions.map((opt) => (
              <Select.Item
                key={opt.id}
                value={opt.id}
                className="cursor-pointer px-3 py-1.5 text-fg-0 outline-none data-[highlighted]:bg-fg-7"
              >
                <Select.ItemText>{t(opt.labelKey)}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export function GradeSelect({
  value,
  onChange,
}: {
  readonly value: RoomGrade;
  readonly onChange: (id: RoomGrade) => void;
}) {
  const t = useTranslations();
  return (
    <Select.Root value={value} onValueChange={(v) => onChange(v as RoomGrade)}>
      <Select.Trigger className="flex w-full items-center justify-between border border-fg-6 bg-fg-9 px-2.5 py-1.5 text-small text-fg-0 focus:border-fg-0 focus:outline-none">
        <Select.Value />
        <Select.Icon className="text-fg-3">▾</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 border border-fg-6 bg-fg-9 py-1 text-small shadow-lift">
          <Select.Viewport>
            {gradeOptions.map((opt) => (
              <Select.Item
                key={opt.id}
                value={opt.id}
                className="cursor-pointer px-3 py-1.5 text-fg-0 outline-none data-[highlighted]:bg-fg-7"
              >
                <Select.ItemText>{t(opt.labelKey)}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export function ColorPopover({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (hex: string) => void;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 border border-fg-6 bg-fg-9 px-2.5 py-1.5 text-small text-fg-0"
        >
          <span className="inline-block h-4 w-4 border border-fg-6" style={{ background: value }} />
          <span className="font-mono text-micro">{value}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          className="z-50 flex gap-1 border border-fg-6 bg-fg-9 p-2 shadow-lift"
        >
          {colorSwatches.map((swatch) => (
            <button
              key={swatch.id}
              type="button"
              onClick={() => onChange(swatch.hex)}
              aria-label={swatch.hex}
              style={{ background: swatch.hex }}
              className={cn(
                "h-7 w-7 cursor-pointer border transition-all",
                value === swatch.hex
                  ? "border-accent-signal ring-1 ring-accent-signal"
                  : "border-fg-6 hover:border-fg-0",
              )}
            />
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
