"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { generatingOverlayFade } from "@/lib/motion-presets";
import { useFloorplanStore } from "@/stores/floorplan.store";

export function GeneratingOverlay() {
  const t = useTranslations("home.workspace.canvas.generating");
  const generating = useFloorplanStore((s) => s.generating);

  return (
    <AnimatePresence>
      {generating ? (
        <motion.div
          {...generatingOverlayFade}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-fg-8/80 backdrop-blur-sm"
        >
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-fg-6 border-t-accent-signal"
            role="status"
            aria-label={t("title")}
          />
          <div className="text-center">
            <div className="font-display text-h4 font-semibold text-fg-0">{t("title")}</div>
            <div className="mt-1 font-mono text-micro text-fg-3">{t("sub")}</div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
