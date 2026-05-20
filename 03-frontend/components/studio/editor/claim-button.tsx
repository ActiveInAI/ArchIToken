"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { estimatePriceDetailed, type LeadSource } from "@/lib/insome/core";
import { useStudioEditorStore } from "@/stores/studio-editor.store";
import { ClaimDialog } from "@/components/shared/claim-dialog";

export function ClaimButton({ source }: { source: LeadSource }) {
  const t = useTranslations("claim");
  const floorplan = useStudioEditorStore((s) => s.activeFloorplan);
  const [open, setOpen] = useState(false);
  const priceEstimate = useMemo(
    () => (floorplan ? estimatePriceDetailed(floorplan) : undefined),
    [floorplan],
  );
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-accent-lime bg-accent-lime px-4 py-1.5 font-mono text-micro tracking-eyebrow uppercase text-fg-0 transition-opacity hover:opacity-90"
      >
        ✨ {t("studioTrigger")}
      </button>
      <ClaimDialog
        open={open}
        onOpenChange={setOpen}
        source={source}
        floorplan={floorplan ?? null}
        {...(priceEstimate ? { priceEstimate } : {})}
      />
    </>
  );
}
