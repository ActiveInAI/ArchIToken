"use client";

import { useTranslations } from "next-intl";
import { summarizeFloorplan } from "@/lib/insome/floorplan";
import { useActiveFloorplan } from "@/lib/proposal/use-active-floorplan";
import { useStudioCreateStore } from "@/stores/studio-create.store";

export function InfoPanel() {
  const t = useTranslations("studio.info");
  const floorplan = useActiveFloorplan();
  const form = useStudioCreateStore((s) => s.form);

  if (!floorplan) {
    return (
      <div className="p-4 font-mono text-micro text-fg-4">{t("noSelection")}</div>
    );
  }

  const summary = summarizeFloorplan(floorplan);

  return (
    <div className="flex flex-col gap-4 p-4">
      <Stat label={t("area")} value={`${summary.areaSqft} ft²`} />
      <Stat label={t("rooms")} value={String(summary.roomCount)} />
      <Stat label={t("stories")} value={String(form.residential.stories)} />
      <Stat label={t("style")} value={form.residential.style} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-fg-2 pb-3">
      <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">{label}</span>
      <span className="font-display text-h4 font-semibold text-fg-8">{value}</span>
    </div>
  );
}
