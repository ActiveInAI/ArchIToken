"use client";

import { useTranslations } from "next-intl";
import * as HoverCard from "@radix-ui/react-popover";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/insome/ui";
import { useDesignerStats } from "@/lib/designer-stats";
import { DESIGNER_LEVELS } from "@/content/designer-levels";

export function DesignerLevelCard() {
  const t = useTranslations();
  const tLevel = useTranslations("workspace.studio.level");
  const stats = useDesignerStats();
  const levelMeta = DESIGNER_LEVELS[stats.level - 1]!;

  const progress =
    stats.nextLevelThreshold !== null
      ? Math.min(stats.points / stats.nextLevelThreshold, 1)
      : 1;
  const remaining = stats.nextLevelThreshold !== null ? stats.nextLevelThreshold - stats.points : 0;

  return (
    <HoverCard.Root>
      <div className="flex w-full flex-col gap-4 border border-fg-2 bg-fg-1 p-6">
        <div className="flex items-start justify-between">
          <HoverCard.Trigger asChild>
            <button
              type="button"
              className="group flex items-baseline gap-3 transition-opacity hover:opacity-80"
            >
              <span className="font-display text-h2 font-extrabold tracking-tight text-fg-9">
                Lv{stats.level}
              </span>
              <span className="font-display text-h4 font-bold tracking-tight text-fg-8">
                {t(levelMeta.nameKey)}
              </span>
              <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4 group-hover:text-fg-5">
                {tLevel("designer")}
              </span>
            </button>
          </HoverCard.Trigger>
          {stats.isVerified ? (
            <span className="flex items-center gap-1 border border-accent-lime/60 bg-fg-0 px-2.5 py-1 font-mono text-micro tracking-eyebrow uppercase text-accent-lime">
              <BadgeCheck size={12} aria-hidden /> {tLevel("verified")}
            </span>
          ) : null}
        </div>

        <div className="flex items-baseline gap-6">
          <div className="flex flex-col">
            <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
              {tLevel("accumulatedRebate")}
            </span>
            <span className="font-display text-h2 font-extrabold tracking-tight text-accent-lime">
              ¥{stats.accumulatedRebate.toLocaleString()}
            </span>
          </div>
          {stats.nextLevelThreshold !== null ? (
            <div className="flex flex-col">
              <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
                {tLevel("nextLevelHint")}
              </span>
              <span className="font-display text-h4 font-bold tracking-tight text-fg-8">
                ¥{remaining.toLocaleString()}
              </span>
            </div>
          ) : null}
          <div className="flex flex-col">
            <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
              {tLevel("rebateRate")}
            </span>
            <span className="font-display text-h4 font-bold tracking-tight text-fg-8">
              {stats.rebatePercent}%
            </span>
          </div>
        </div>

        {stats.nextLevelThreshold !== null ? (
          <div>
            <div className="flex h-1.5 w-full overflow-hidden bg-fg-0">
              <div
                className="h-full bg-accent-lime transition-[width]"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-micro tracking-eyebrow uppercase text-fg-4">
              <span>{tLevel("points")}: {stats.points.toLocaleString()}</span>
              <span>{stats.nextLevelThreshold.toLocaleString()}</span>
            </div>
          </div>
        ) : null}
      </div>

      <HoverCard.Portal>
        <HoverCard.Content
          align="start"
          sideOffset={6}
          className="z-50 w-96 border border-fg-2 bg-fg-1 p-5 shadow-xl"
        >
          <div className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
            {tLevel("ladderTitle")}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {DESIGNER_LEVELS.map((meta) => (
              <div
                key={meta.lv}
                className={cn(
                  "grid grid-cols-[40px_1fr_60px] items-baseline border-b border-fg-2 pb-2 last:border-0",
                  meta.lv === stats.level ? "text-accent-lime" : "text-fg-5",
                )}
              >
                <span className="font-display text-h4 font-bold tracking-tight">Lv{meta.lv}</span>
                <span className="font-display text-body font-bold tracking-tight">
                  {t(meta.nameKey)}
                </span>
                <span className="text-right font-mono text-micro tracking-eyebrow uppercase">
                  {meta.rebatePct}%
                </span>
              </div>
            ))}
          </div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
