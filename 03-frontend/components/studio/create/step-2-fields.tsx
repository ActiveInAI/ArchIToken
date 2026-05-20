"use client";

import { useTranslations } from "next-intl";

export function NumberField({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  readonly label: string;
  readonly unit: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
          }}
          className="flex-1 border border-fg-2 bg-fg-0 px-3 py-2 text-small text-fg-8 focus:border-accent-lime focus:outline-none"
        />
        {unit ? <span className="font-mono text-micro text-fg-4">{unit}</span> : null}
      </div>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">{label}</span>
      <span className="font-display text-h3 font-bold text-accent-lime">{value}</span>
    </div>
  );
}

export function StyleOptionItem({ id, labelKey }: { id: string; labelKey: string }) {
  const t = useTranslations();
  return <option value={id}>{t(labelKey)}</option>;
}
