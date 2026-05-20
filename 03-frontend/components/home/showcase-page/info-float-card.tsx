"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Heart, Share2, Send } from "lucide-react";
import type { Floorplan } from "@/lib/insome/floorplan";
import { estimatePriceSimple, type PriceEstimate } from "@/lib/insome/core";
import { cn } from "@/lib/insome/ui";
import { ClaimDialog } from "@/components/shared/claim-dialog";
import { PublishButton } from "./publish-button";
import { useInviteLink } from "@/lib/invite";

interface InfoFloatCardProps {
  readonly floorplan?: Floorplan | undefined;
  readonly workId: string;
  readonly priceMinWan?: number | undefined;
  readonly priceMaxWan?: number | undefined;
  readonly constructionDays?: number | undefined;
  readonly savingsPercent?: number | undefined;
  readonly theme?: "light" | "dark";
}

export function InfoFloatCard({
  floorplan,
  workId,
  priceMinWan,
  priceMaxWan,
  constructionDays = 45,
  savingsPercent = 28,
  theme = "light",
}: InfoFloatCardProps) {
  const tInfo = useTranslations("showcase.home.info");
  const tAction = useTranslations("showcase.home.action");
  const [claimOpen, setClaimOpen] = useState(false);
  const onDark = theme === "dark";

  const liveEstimate = useMemo<PriceEstimate | undefined>(
    () => (floorplan ? estimatePriceSimple(floorplan) : undefined),
    [floorplan],
  );

  const priceText = priceMinWan && priceMaxWan
    ? `¥${priceMinWan}–${priceMaxWan} 万`
    : liveEstimate
      ? `约 ¥${Math.round(liveEstimate.breakdown.total / 10_000)} 万`
      : "—";

  const inviteLink = useInviteLink();

  const handleShare = async () => {
    const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/home/design/${workId}?ref=${inviteLink.code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "INSOME design", url: shareUrl });
      } else {
        await navigator.clipboard?.writeText(shareUrl);
      }
    } catch {
      /* user cancelled or unsupported */
    }
  };

  return (
    <>
      <div className="flex h-full flex-col gap-6 p-6">
        <Section title={tInfo("savings.title")} onDark={onDark}>
          <div className="flex items-center justify-between">
            <Stat label={tInfo("savings.daysSaved")} value="30" suffix={tInfo("savings.daysUnit")} onDark={onDark} accent />
            <Stat label={tInfo("savings.percentSaved")} value={`${savingsPercent}`} suffix="%" onDark={onDark} accent />
          </div>
          <p className={cn("mt-2 font-mono text-micro", onDark ? "text-fg-4" : "text-fg-3")}>
            {tInfo("savings.note")}
          </p>
        </Section>

        <Section title={tInfo("timeline.title")} onDark={onDark}>
          <Stat
            label={tInfo("timeline.duration")}
            value={String(constructionDays)}
            suffix={tInfo("timeline.daysUnit")}
            onDark={onDark}
            accent
          />
          <div className={cn("mt-3 flex h-2 w-full overflow-hidden", onDark ? "bg-fg-1" : "bg-fg-7")}>
            <div className={cn("h-full", onDark ? "bg-accent-lime" : "bg-accent-signal")} style={{ width: "60%" }} />
          </div>
          <div className={cn("mt-1 flex justify-between font-mono text-micro tracking-eyebrow uppercase", onDark ? "text-fg-4" : "text-fg-3")}>
            <span>{tInfo("timeline.factory")}</span>
            <span>{tInfo("timeline.assembly")}</span>
          </div>
        </Section>

        <Section title={tInfo("budget.title")} onDark={onDark}>
          <div className={cn("font-display text-h2 font-extrabold tracking-tight", onDark ? "text-accent-lime" : "text-accent-signal")}>
            {priceText}
          </div>
          <p className={cn("mt-1 font-mono text-micro", onDark ? "text-fg-4" : "text-fg-3")}>
            {tInfo("budget.disclaimer")}
          </p>
        </Section>

        <div className={cn("mt-auto flex flex-col gap-2 border-t pt-4", onDark ? "border-fg-2" : "border-fg-6")}>
          <button
            type="button"
            onClick={() => setClaimOpen(true)}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-3 font-mono text-small tracking-eyebrow uppercase transition-opacity hover:opacity-90",
              onDark ? "border border-accent-lime bg-accent-lime text-fg-0" : "border border-accent-signal bg-accent-signal text-fg-9",
            )}
          >
            <Send size={14} aria-hidden /> {tAction("contactUs")}
          </button>
          <PublishButton workId={workId} {...(floorplan ? { floorplan } : {})} theme={theme} />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-2 font-mono text-micro tracking-eyebrow uppercase transition-colors",
                onDark ? "border border-fg-2 bg-fg-1 text-fg-8 hover:border-fg-4" : "border border-fg-6 bg-fg-9 text-fg-0 hover:border-fg-3",
              )}
            >
              <Heart size={12} aria-hidden /> {tAction("favorite")}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-2 font-mono text-micro tracking-eyebrow uppercase transition-colors",
                onDark ? "border border-fg-2 bg-fg-1 text-fg-8 hover:border-fg-4" : "border border-fg-6 bg-fg-9 text-fg-0 hover:border-fg-3",
              )}
            >
              <Share2 size={12} aria-hidden /> {tAction("shareInvite")}
            </button>
          </div>
        </div>
      </div>
      <ClaimDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        source="home-workspace"
        {...(floorplan ? { floorplan } : {})}
        {...(liveEstimate ? { priceEstimate: liveEstimate } : {})}
        projectId={workId}
      />
    </>
  );
}

function Section({ title, children, onDark }: { title: string; children: React.ReactNode; onDark: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className={cn("font-mono text-micro tracking-eyebrow uppercase", onDark ? "text-fg-4" : "text-fg-3")}>{title}</span>
      <div className={cn("border p-3", onDark ? "border-fg-2 bg-fg-1" : "border-fg-6 bg-fg-9")}>{children}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  onDark,
  accent = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  onDark: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn("font-mono text-micro tracking-eyebrow uppercase", onDark ? "text-fg-4" : "text-fg-3")}>{label}</span>
      <span
        className={cn(
          "font-display text-h3 font-bold tracking-tight",
          accent
            ? onDark
              ? "text-accent-lime"
              : "text-accent-signal"
            : onDark
              ? "text-fg-9"
              : "text-fg-0",
        )}
      >
        {value}
        {suffix ? <span className="ml-1 text-h4 font-normal opacity-80">{suffix}</span> : null}
      </span>
    </div>
  );
}
