"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { heroEntry, heroSubEntry } from "@/lib/motion-presets";

export function Hero() {
  const t = useTranslations("landing.hero");

  return (
    <section className="mx-auto grid w-full max-w-landing grid-cols-1 items-end gap-15 px-10 pt-20 pb-10 lg:grid-cols-[1.2fr_1fr]">
      <motion.div {...heroEntry}>
        <div className="eyebrow mb-2">{t("eyebrow")}</div>
        <h1 className="font-display text-hero font-black leading-[.86] tracking-hero">
          <span className="block">{t("titleBuild")}</span>
          <span className="block text-accent-signal">{t("titleDifferent")}</span>
        </h1>
        <motion.p
          {...heroSubEntry}
          className="mt-4 max-w-[48ch] text-[20px] leading-[1.4] text-fg-2"
        >
          {t("subtitle")}
        </motion.p>
      </motion.div>

      <motion.div
        {...heroSubEntry}
        className="flex flex-col gap-2 pb-5 font-mono text-[12px] text-fg-3"
      >
        <div className="eyebrow text-fg-0">{t("statusLabel")}</div>
        <div>{t("statusLine1")}</div>
        <div>{t("statusLine2")}</div>
        <div>{t("statusLine3")}</div>
        <div className="eyebrow mt-3 text-fg-0">{t("coverageLabel")}</div>
        <div>{t("coverageLine")}</div>
      </motion.div>
    </section>
  );
}
