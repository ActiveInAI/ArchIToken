"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/insome/ui";
import { PARTNERS } from "@/content/partners";
import { easePrecast } from "@/lib/motion-presets";

interface SponsorMarqueeProps {
  readonly theme?: "dark" | "light";
}

export function SponsorMarquee({ theme = "dark" }: SponsorMarqueeProps) {
  const t = useTranslations("landing.partners");
  const onDark = theme === "dark";
  // Triple-replicate ensures the loop wraparound happens off-screen with margin.
  const duplicated = [...PARTNERS, ...PARTNERS, ...PARTNERS];
  const fadeFrom = onDark ? "from-fg-0" : "from-fg-8";

  return (
    <div
      data-testid="sponsor-marquee"
      className={cn(
        "relative w-full overflow-hidden py-12",
        onDark ? "bg-fg-0" : "bg-fg-8",
      )}
    >
      <div className={cn("pointer-events-none absolute left-0 top-0 z-10 h-full w-32 bg-gradient-to-r to-transparent", fadeFrom)} />
      <div className={cn("pointer-events-none absolute right-0 top-0 z-10 h-full w-32 bg-gradient-to-l to-transparent", fadeFrom)} />

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: easePrecast }}
        className={cn(
          "eyebrow mb-8 text-center",
          onDark ? "text-fg-4" : "text-fg-3",
        )}
      >
        {t("title")}
      </motion.p>

      <div className="relative overflow-hidden">
        <div className="flex animate-marquee gap-12">
          {duplicated.map((partner, i) => (
            <div
              key={`${partner.name}-${i}`}
              className="flex flex-shrink-0 items-center justify-center"
            >
              {/*
                IMPORTANT: do NOT apply `brightness(0) invert(1)` here.
                Several partner SVGs use embedded base64 PNGs or white fills
                — invert-filtering would turn them solid black and create
                visible "black gaps" in the marquee loop. Logos are kept in
                their native colors (mostly grey/white) which already read
                fine on both dark (fg-0) and light (fg-8) marquee backgrounds.
              */}
              <Image
                src={partner.logoUrl}
                alt={partner.name}
                width={120}
                height={40}
                className={cn(
                  "h-10 w-auto object-contain opacity-80 transition-opacity duration-300 hover:opacity-100",
                )}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
