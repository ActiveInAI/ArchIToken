"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { cardHover } from "@/lib/motion-presets";
import { useHomeViewStore } from "@/stores/home-view.store";

export function NewProjectButton() {
  const t = useTranslations("home.dashboard");
  const createNewProject = useHomeViewStore((s) => s.createNewProject);

  return (
    <motion.button
      type="button"
      {...cardHover}
      onClick={createNewProject}
      className="flex aspect-[4/3] flex-col items-center justify-center gap-3 border border-dashed border-fg-4 bg-fg-9 text-fg-3 transition-colors hover:border-fg-0 hover:text-fg-0"
    >
      <span className="font-display text-5xl font-light leading-none">+</span>
      <span className="font-mono text-micro tracking-eyebrow uppercase">
        {t("createNewCta")}
      </span>
    </motion.button>
  );
}
