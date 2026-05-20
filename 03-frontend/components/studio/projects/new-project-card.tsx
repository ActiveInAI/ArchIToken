"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { cardHover } from "@/lib/motion-presets";
import { useStudioViewStore } from "@/stores/studio-view.store";

export function StudioNewProjectCard() {
  const t = useTranslations("studio.projects");
  const startCreate = useStudioViewStore((s) => s.startCreate);

  return (
    <motion.button
      type="button"
      {...cardHover}
      onClick={startCreate}
      className="flex aspect-[4/3] flex-col items-center justify-center gap-3 border border-dashed border-fg-2 bg-fg-0 text-fg-4 transition-colors hover:border-accent-lime hover:text-accent-lime"
    >
      <span className="font-display text-5xl font-light leading-none">+</span>
      <span className="font-mono text-micro tracking-eyebrow uppercase">
        {t("newProject")}
      </span>
    </motion.button>
  );
}
