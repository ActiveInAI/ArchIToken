"use client";

import type { LocaleCode } from "@/lib/insome/types";
import { cn } from "./cn";

export interface LangToggleProps {
  readonly value: LocaleCode;
  readonly labelCN?: string;
  readonly labelEN?: string;
  readonly onSelect: (next: LocaleCode) => void;
  readonly disabled?: boolean;
}

export function LangToggle({
  value,
  labelCN = "中",
  labelEN = "EN",
  onSelect,
  disabled = false,
}: LangToggleProps) {
  const btnBase =
    "px-2.5 py-1 cursor-pointer transition-colors font-mono text-micro tracking-normal";
  const active = "bg-fg-0 text-fg-9";
  const inactive = "bg-transparent text-fg-3 hover:text-fg-0";

  return (
    <div className="inline-flex border border-fg-6">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value === "zh"}
        onClick={() => onSelect("zh")}
        className={cn(btnBase, value === "zh" ? active : inactive)}
      >
        {labelCN}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value === "en"}
        onClick={() => onSelect("en")}
        className={cn(btnBase, value === "en" ? active : inactive)}
      >
        {labelEN}
      </button>
    </div>
  );
}
