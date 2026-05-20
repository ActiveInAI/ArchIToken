"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Send } from "lucide-react";
import type { Floorplan } from "@/lib/insome/floorplan";
import { estimatePriceDetailed } from "@/lib/insome/core";
import { cn } from "@/lib/insome/ui";
import { ClaimDialog } from "@/components/shared/claim-dialog";
import { useDesignerStats } from "@/lib/designer-stats";

interface StudioInfoCardProps {
  readonly workId: string;
  readonly floorplan?: Floorplan | undefined;
  readonly priceMinWan?: number | undefined;
  readonly priceMaxWan?: number | undefined;
  readonly constructionDays?: number | undefined;
  readonly savingsPercent?: number | undefined;
}

export function StudioInfoCard({
  workId,
  floorplan,
  priceMinWan,
  priceMaxWan,
  constructionDays = 45,
  savingsPercent = 28,
}: StudioInfoCardProps) {
  const tInfo = useTranslations("showcase.studio.info");
  const tHome = useTranslations("showcase.home.info");
  const tAction = useTranslations("showcase.home.action");
  const [collapsed, setCollapsed] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const stats = useDesignerStats();

  const detailed = floorplan ? estimatePriceDetailed(floorplan) : undefined;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="flex h-full w-12 items-start justify-center border-l border-fg-2 bg-fg-1 pt-6 text-fg-5 transition-colors hover:text-accent-lime"
        aria-label="Expand info card"
      >
        <ChevronRight size={16} className="rotate-180" aria-hidden />
      </button>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
            {tInfo("title")}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="text-fg-4 transition-colors hover:text-fg-8"
            aria-label="Collapse"
          >
            <ChevronRight size={14} aria-hidden />
          </button>
        </div>

        <Section title={tInfo("bom.title")}>
          {detailed ? (
            <div className="grid grid-cols-2 gap-2 font-mono text-micro">
              <Row k={tInfo("bom.column")} v={`${detailed.structureBreakdown.columns}`} />
              <Row k={tInfo("bom.beam")} v={`${detailed.structureBreakdown.beams}`} />
              <Row k={tInfo("bom.joint")} v={`${detailed.structureBreakdown.joints}`} />
              <Row k={tInfo("bom.area")} v={`${Math.round(detailed.totalAreaSqm)}㎡`} />
            </div>
          ) : (
            <span className="text-fg-4">—</span>
          )}
          <button
            type="button"
            className="mt-3 font-mono text-micro tracking-eyebrow uppercase text-fg-5 hover:text-accent-lime"
          >
            {tInfo("bom.detailed")} →
          </button>
        </Section>

        <Section title={tHome("budget.title")}>
          <div className="font-display text-h3 font-bold tracking-tight text-fg-8">
            {priceMinWan ?? Math.round((detailed?.breakdown.total ?? 0) / 10000)}
            {priceMaxWan ? `–${priceMaxWan}` : ""} <span className="text-h4 font-normal opacity-80">万</span>
          </div>
        </Section>

        <Section title={tHome("timeline.title")}>
          <div className="font-display text-h3 font-bold tracking-tight text-fg-8">
            {constructionDays} <span className="text-h4 font-normal opacity-80">{tHome("timeline.daysUnit")}</span>
          </div>
          <div className="mt-2 flex h-1.5 w-full overflow-hidden bg-fg-0">
            <div className="h-full bg-accent-lime" style={{ width: "60%" }} />
          </div>
        </Section>

        <Section title={tHome("savings.title")}>
          <div className="flex items-baseline gap-4">
            <Stat label={tHome("savings.daysSaved")} value="30" suffix={tHome("savings.daysUnit")} />
            <Stat label={tHome("savings.percentSaved")} value={String(savingsPercent)} suffix="%" />
          </div>
        </Section>

        <Section title={tInfo("rebate.title")} highlight>
          <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
            {tInfo("rebate.thisOrder")}
          </span>
          <div className="font-display text-h2 font-extrabold tracking-tight text-accent-lime">
            ¥{stats.thisOrderRebateMin.toLocaleString()}–{stats.thisOrderRebateMax.toLocaleString()}
          </div>
          <span className="font-mono text-micro text-fg-4">{tInfo("rebate.disclaimer")}</span>
          <div className="mt-3 flex items-baseline gap-4 border-t border-fg-2 pt-3">
            <Stat label={tInfo("rebate.thisYear")} value={`¥${(stats.accumulatedRebate / 1000).toFixed(0)}k`} />
            {stats.nextLevelThreshold ? (
              <Stat
                label={tInfo("rebate.toNextLevel")}
                value={`¥${((stats.nextLevelThreshold - stats.points) / 1000).toFixed(1)}k`}
              />
            ) : null}
          </div>
        </Section>

        <div className="mt-auto border-t border-fg-2 pt-4">
          <button
            type="button"
            onClick={() => setClaimOpen(true)}
            className="flex w-full items-center justify-center gap-2 border border-accent-lime bg-accent-lime px-4 py-3 font-mono text-small tracking-eyebrow uppercase text-fg-0 transition-opacity hover:opacity-90"
          >
            <Send size={14} aria-hidden /> {tAction("contactUs")}
          </button>
        </div>
      </div>

      <ClaimDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        source="studio-editor"
        {...(floorplan ? { floorplan } : {})}
        {...(detailed ? { priceEstimate: detailed } : {})}
        projectId={workId}
      />
    </>
  );
}

function Section({ title, highlight, children }: { title: string; highlight?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2 border p-3", highlight ? "border-accent-lime/40 bg-fg-0" : "border-fg-2 bg-fg-1")}>
      <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">{title}</span>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between text-fg-5">
      <span>{k}</span>
      <span className="text-fg-9">{v}</span>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">{label}</span>
      <span className="font-display text-h3 font-bold tracking-tight text-fg-9">
        {value}
        {suffix ? <span className="ml-1 text-h4 font-normal opacity-80">{suffix}</span> : null}
      </span>
    </div>
  );
}
