"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { estimatePriceSimple } from "@/lib/insome/core";
import { getVariantById } from "@/content/floorplan-variants.home";
import { getTemplateById } from "@/content/templates.mock";
import { useFloorplanStore } from "@/stores/floorplan.store";
import { useHomeViewStore } from "@/stores/home-view.store";
import { ClaimDialog } from "@/components/shared/claim-dialog";

/**
 * Phase 4.0 Home Workspace bottom info strip.
 * Read-only: shows active floorplan name / area / approximate price +
 * big "Contact us" CTA — the single conversion entry in Workspace.
 */
export function SimpleInfoPanel() {
  const t = useTranslations();
  const tInfo = useTranslations("home.workspace.info");
  const currentVariantId = useFloorplanStore((s) => s.currentVariantId);
  const activeTemplateId = useHomeViewStore((s) => s.activeTemplateId);
  const [claimOpen, setClaimOpen] = useState(false);

  const floorplan = useMemo(() => getVariantById(currentVariantId), [currentVariantId]);
  const template = activeTemplateId ? getTemplateById(activeTemplateId) : undefined;
  const priceEstimate = useMemo(() => (floorplan ? estimatePriceSimple(floorplan) : undefined), [floorplan]);

  const priceTextFromEstimate = priceEstimate
    ? `约 ${Math.round(priceEstimate.breakdown.total / 10_000)} 万`
    : "—";
  const priceTextFromTemplate = template
    ? template.priceMin === template.priceMax
      ? `约 ${Math.round(template.priceMin / 10_000)} 万`
      : `${Math.round(template.priceMin / 10_000)} – ${Math.round(template.priceMax / 10_000)} 万`
    : null;
  const priceText = priceTextFromTemplate ?? priceTextFromEstimate;
  const name = template ? t(template.nameKey) : tInfo("fallbackName");
  const area = priceEstimate ? `${Math.round(priceEstimate.totalAreaSqm)}㎡` : template ? `${template.totalAreaSqm}㎡` : "—";

  return (
    <>
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-baseline gap-6">
          <div className="flex flex-col">
            <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-3">
              {tInfo("name")}
            </span>
            <span className="font-display text-h4 font-bold tracking-tight text-fg-0">{name}</span>
          </div>
          <Sep />
          <Stat label={tInfo("area")} value={area} />
          <Sep />
          <Stat label={tInfo("approxPrice")} value={priceText} accent />
        </div>
        <button
          type="button"
          onClick={() => setClaimOpen(true)}
          className="border border-accent-signal bg-accent-signal px-5 py-2.5 font-mono text-small tracking-eyebrow uppercase text-fg-9 transition-opacity hover:opacity-90"
        >
          ✨ {tInfo("cta.contact")}
        </button>
      </div>
      <ClaimDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        source="home-workspace"
        {...(floorplan ? { floorplan } : {})}
        {...(priceEstimate ? { priceEstimate } : {})}
        {...(template ? { projectId: template.id } : {})}
      />
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-3">{label}</span>
      <span
        className={
          accent
            ? "font-display text-h4 font-bold tracking-tight text-accent-signal"
            : "font-display text-h4 font-bold tracking-tight text-fg-0"
        }
      >
        {value}
      </span>
    </div>
  );
}

function Sep() {
  return <span className="h-5 w-px bg-fg-6" aria-hidden="true" />;
}
