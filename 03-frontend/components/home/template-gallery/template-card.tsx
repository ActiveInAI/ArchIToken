"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/insome/ui";
import type { TemplateMeta } from "@/content/templates.mock";

export interface TemplateCardProps {
  readonly template: TemplateMeta;
  readonly onOpen: (id: string) => void;
}

export function TemplateCard({ template, onOpen }: TemplateCardProps) {
  const t = useTranslations();
  const tGallery = useTranslations("home.template.gallery");
  const priceLow = Math.round(template.priceMin / 10_000);
  const priceHigh = Math.round(template.priceMax / 10_000);
  const accentBg =
    template.coverAccent === "warm"
      ? "from-[#F5E6D8] to-[#D7D4CE]"
      : template.coverAccent === "cool"
        ? "from-[#E1ECEE] to-[#CAD3D6]"
        : "from-[#EDECE6] to-[#D5D4CE]";
  return (
    <button
      type="button"
      onClick={() => onOpen(template.id)}
      className={cn(
        "flex flex-col border border-fg-6 bg-fg-9 text-left text-fg-0",
        "transition-all hover:-translate-y-1 hover:border-accent-signal",
      )}
    >
      <div className={cn("aspect-[4/3] bg-gradient-to-br", accentBg)}>
        <TemplateCoverSketch template={template} />
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-h4 font-bold tracking-tight text-fg-0">
            {t(template.nameKey)}
          </h3>
          <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-3">
            {template.totalAreaSqm}㎡
          </span>
        </div>
        <p className="line-clamp-2 text-small text-fg-3">{t(template.descriptionKey)}</p>
        <div className="mt-2 flex items-baseline justify-between border-t border-fg-6 pt-2">
          <span className="font-display text-h4 font-bold tracking-tight text-accent-signal">
            {priceLow === priceHigh
              ? `约 ${priceLow} 万`
              : `${priceLow} – ${priceHigh} 万`}
          </span>
          <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-3">
            {tGallery(`style.${template.styleKey}`)}
          </span>
        </div>
      </div>
    </button>
  );
}

function TemplateCoverSketch({ template }: { template: TemplateMeta }) {
  // Simple procedural sketch based on bedroom count
  const rects = Array.from({ length: template.bedrooms + 2 }, (_, i) => i);
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" aria-hidden="true">
      <rect x="18" y="22" width="164" height="106" fill="none" stroke="#0A0A0A" strokeWidth="1.5" />
      {rects.map((i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        return (
          <rect
            key={i}
            x={26 + col * 52}
            y={30 + row * 45}
            width="44"
            height="38"
            fill="none"
            stroke="#0A0A0A"
            strokeWidth="1"
            opacity={0.4 + i * 0.1}
          />
        );
      })}
      <line x1="18" y1="75" x2="70" y2="75" stroke="#FF4B1F" strokeWidth="3" />
    </svg>
  );
}
