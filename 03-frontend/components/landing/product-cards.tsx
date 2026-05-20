"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { ProductCardConfig } from "@/lib/insome/types";
import { cn } from "@/lib/insome/ui";
import { cardHover, entryArrowShift } from "@/lib/motion-presets";

export interface ProductCardsProps {
  readonly cards: ReadonlyArray<ProductCardConfig>;
}

export function ProductCards({ cards }: ProductCardsProps) {
  return (
    <section className="mx-auto grid w-full max-w-landing grid-cols-1 gap-6 px-10 pb-10 lg:grid-cols-2">
      {cards.map((card) => (
        <ProductCard key={card.id} card={card} />
      ))}
    </section>
  );
}

function ProductCard({ card }: { card: ProductCardConfig }) {
  const t = useTranslations(`landing.productCard.${card.id}`);
  const isDark = card.theme === "dark";

  const containerClass = cn(
    "group relative flex min-h-115 flex-col overflow-hidden border p-10 cursor-pointer transition-colors",
    isDark
      ? "on-dark bg-fg-0 text-fg-8 border-fg-1 hover:border-accent-lime"
      : "bg-fg-9 text-fg-0 border-fg-6 hover:border-fg-0",
  );

  return (
    <motion.div {...cardHover} className={containerClass}>
      <Link href={card.href} className="flex h-full flex-col">
        <div
          className={cn(
            "mb-10 flex justify-between font-mono text-micro tracking-eyebrow",
            isDark ? "text-fg-3" : "text-fg-3",
          )}
        >
          <span>{t("number")}</span>
          <span>{t("audience")}</span>
        </div>

        <h2 className="font-display text-[56px] font-extrabold leading-none tracking-tight">
          {t("titlePrefix")}
          <br />
          <mark>{t("titleSuffix")}</mark>
        </h2>

        <p
          className={cn(
            "mt-5 max-w-[42ch] flex-1 text-[15px]",
            isDark ? "text-fg-4" : "text-fg-2",
          )}
        >
          {t("description")}
        </p>

        <div
          className={cn(
            "my-6 flex flex-col gap-1.5 font-mono text-micro",
            isDark ? "text-fg-4" : "text-fg-3",
          )}
        >
          {card.featureKeys.map((key, idx) => (
            <div key={key} className="relative pl-4 before:absolute before:left-0 before:content-['→']">
              {t(`feature${idx + 1}`)}
            </div>
          ))}
        </div>

        <div
          className={cn(
            "mt-auto flex items-center justify-between border-t pt-5 text-small font-semibold",
            isDark ? "border-fg-1" : "border-fg-6",
          )}
        >
          <span>{t("cta")}</span>
          <motion.span
            {...entryArrowShift}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full",
              isDark ? "bg-accent-lime text-fg-0" : "bg-fg-0 text-fg-9",
            )}
            aria-hidden
          >
            →
          </motion.span>
        </div>

        <Image
          src={card.miniSvgPath}
          alt=""
          width={180}
          height={120}
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-6 top-6 border opacity-60 transition-opacity group-hover:opacity-100",
            isDark ? "border-fg-1 bg-fg-1" : "border-fg-6 bg-fg-8",
          )}
        />
      </Link>
    </motion.div>
  );
}
