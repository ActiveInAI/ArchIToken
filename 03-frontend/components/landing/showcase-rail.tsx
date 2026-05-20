"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { ShowcaseRailConfig } from "@/lib/insome/types";
import { Pill, cn } from "@/lib/insome/ui";
import { showcaseEnter } from "@/lib/motion-presets";
import { ShowcaseScreen } from "./showcase-screen";

export interface ShowcaseRailProps {
  readonly config: ShowcaseRailConfig;
}

export function ShowcaseRail({ config }: ShowcaseRailProps) {
  const t = useTranslations("landing.showcaseSection");
  const isStudio = config.productLine === "studio";

  return (
    <section className="mx-auto w-full max-w-landing px-10 pt-20 pb-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <div className="eyebrow mb-2">{t(config.eyebrowKey)}</div>
          <h2 className="font-display text-[48px] font-extrabold tracking-tight">
            {t(config.titleKey)}
          </h2>
        </div>
        <Pill tone={isStudio ? "lime" : "signal"} className="self-start">
          {t(config.pillLabelKey)}
        </Pill>
      </header>

      <div
        className={cn(
          "flex snap-x snap-mandatory gap-4 overflow-x-auto py-2",
          "[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-fg-6",
        )}
      >
        {config.screens.map((screen, idx) => (
          <motion.div
            key={screen.id}
            {...showcaseEnter}
            transition={{ ...showcaseEnter.transition, delay: idx * 0.05 }}
          >
            <ShowcaseScreen screen={screen} dark={isStudio} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
