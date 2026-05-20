"use client";

import { useTranslations } from "next-intl";

export interface LabeledOption {
  readonly id: string;
  readonly labelKey: string;
}

export function NumField({
  label,
  unit,
  value,
  onChange,
  step = 0.5,
}: {
  readonly label: string;
  readonly unit: string;
  readonly value: number;
  readonly onChange: (v: number) => void;
  readonly step?: number;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1">
      <label className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) onChange(n);
          }}
          className="flex-1 border border-fg-2 bg-fg-0 px-2.5 py-1.5 text-small text-fg-8 focus:border-accent-lime focus:outline-none"
        />
        <span className="font-mono text-micro text-fg-4">{unit}</span>
      </div>
    </div>
  );
}

export function ReadOnlyField({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">{label}</span>
        {hint ? <span className="font-mono text-micro text-fg-4">{hint}</span> : null}
      </div>
      <div className="border border-fg-2 bg-fg-0 px-2.5 py-1.5 text-small text-fg-8">{value}</div>
    </div>
  );
}

export function SelectField({
  label,
  options,
  value,
  onChange,
}: {
  readonly label: string;
  readonly options: ReadonlyArray<LabeledOption>;
  readonly value: string;
  readonly onChange: (v: string) => void;
}) {
  const t = useTranslations();
  return (
    <div className="mb-3 flex flex-col gap-1">
      <label className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-fg-2 bg-fg-0 px-2.5 py-1.5 text-small text-fg-8 focus:border-accent-lime focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {t(opt.labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
