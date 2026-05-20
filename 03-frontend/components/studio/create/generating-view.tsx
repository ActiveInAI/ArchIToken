"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { pulseDot } from "@/lib/motion-presets";
import { useProposalGenerator } from "@/lib/proposal";
import { useStudioCreateStore } from "@/stores/studio-create.store";
import { useStudioViewStore } from "@/stores/studio-view.store";

export function CreateGeneratingView() {
  const t = useTranslations("studio.create.generating");
  const generator = useProposalGenerator();
  const form = useStudioCreateStore((s) => s.form);
  const setProposals = useStudioCreateStore((s) => s.setProposals);
  const setGenerating = useStudioCreateStore((s) => s.setGenerating);
  const goTo = useStudioViewStore((s) => s.goTo);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    setGenerating(true);
    void generator.generate(form).then((proposals) => {
      setProposals(proposals);
      setGenerating(false);
      goTo("create-proposals");
    });
  }, [generator, form, setProposals, setGenerating, goTo]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-fg-0 text-fg-8">
      <div className="flex gap-3">
        {[0, 0.2, 0.4].map((delay) => (
          <motion.span
            key={delay}
            {...pulseDot(delay)}
            className="inline-block h-3 w-3 bg-accent-lime"
          />
        ))}
      </div>
      <div className="text-center">
        <div className="font-display text-h1 font-extrabold tracking-tight">{t("title")}</div>
        <div className="mt-2 max-w-[48ch] font-mono text-small text-fg-4">{t("sub")}</div>
      </div>
      <div className="flex flex-wrap justify-center gap-4 font-mono text-micro text-fg-4">
        <span>● {t("step.zoning")}</span>
        <span>● {t("step.adjacency")}</span>
        <span>● {t("step.circulation")}</span>
      </div>
    </div>
  );
}
