"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ShinyText } from "@/components/shared/shiny-text";
import { HeroPartInfoPanel } from "@/components/landing/hero-part-info-panel";
import { LandingHeroModel } from "@/components/landing/landing-hero-model";
import { heroEntry, heroSubEntry, easePrecast } from "@/lib/motion-presets";

export function LandingHero() {
  const t = useTranslations("landing.hero");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section
      data-testid="landing-hero"
      className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-fg-0"
    >
      {/*
        3D background layer.
        On lg+, the canvas wrapper is 150% of viewport width anchored to the
        left edge — so the canvas (and its scene-center) extends 50% past the
        right edge. The 3D scene is centered in the canvas, so the building
        visually lands at viewport ~75% (right-half center) WHILE OrbitControls
        target = model center → autoRotate orbits the model itself, not an
        off-center pivot. The right 50% of the canvas is clipped by the
        section's overflow-hidden.
      */}
      <div
        className="absolute left-0 right-0 top-[-5vh] bottom-0 z-0 lg:right-auto lg:w-[145%]"
        data-testid="hero-3d-wrapper"
      >
        {mounted ? (
          <LandingHeroModel />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center bg-fg-1 text-fg-4"
            data-testid="hero-3d-loading"
          >
            <span className="font-mono text-micro tracking-eyebrow uppercase">
              loading 3D...
            </span>
          </div>
        )}
      </div>

      {/* Soft left vignette · darken the text-side half a touch for legibility,
          right half stays clear so the 3D building reads cleanly. */}
      <div
        className="pointer-events-none absolute inset-0 z-[5] bg-[linear-gradient(to_right,_rgba(10,10,10,0.6)_0%,_rgba(10,10,10,0.35)_30%,_rgba(10,10,10,0)_50%)]"
        aria-hidden
      />

      {/* EARLY ACCESS chip · top-left */}
      <motion.div
        {...heroSubEntry}
        className="absolute left-6 top-6 z-20 flex items-center gap-2 border border-fg-2 bg-fg-1/70 px-4 py-2 backdrop-blur-sm lg:left-12"
      >
        <span className="h-1.5 w-1.5 bg-accent-lime" aria-hidden />
        <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-5">
          {t("statusChip")}
        </span>
      </motion.div>

      {/* Text content · centered inside the LEFT half of the viewport on lg+,
          full-width centered on mobile/sm. The right half is left transparent
          so the 3D building (rendered on the canvas behind) is unobstructed. */}
      <div className="pointer-events-none relative z-10 grid h-full w-full grid-cols-1 lg:grid-cols-2">
        <div className="flex h-full items-center justify-center px-6 lg:px-12">
          {/*
            inner wrapper keeps max-w-md so the left edge of the text block
            sits at the same horizontal position as before (user-confirmed
            "distance from left is just right"). Heading + button row each
            individually opt out of wrapping with whitespace-nowrap and may
            visually overflow the wrapper to the right — which is fine, the
            section is overflow-hidden so nothing escapes the hero.
          */}
          <div className="flex w-full max-w-md flex-col items-start text-left">
            <motion.h1
              {...heroEntry}
              className="whitespace-nowrap font-display text-h1 font-extrabold leading-[1.05] tracking-tight text-fg-9 [text-shadow:0_2px_18px_rgba(10,10,10,0.55)]"
            >
              {t("heading")}
            </motion.h1>

            <motion.p
              {...heroSubEntry}
              transition={{ duration: 0.6, delay: 0.3, ease: easePrecast }}
              className="mt-5 text-body leading-relaxed text-fg-5 [text-shadow:0_1px_10px_rgba(10,10,10,0.55)]"
            >
              {t("subheading")}
            </motion.p>

            <motion.div
              {...heroSubEntry}
              transition={{ duration: 0.6, delay: 0.45, ease: easePrecast }}
              className="mt-3"
            >
              <ShinyText
                text={t("tagline")}
                variant="on-dark"
                className="whitespace-nowrap font-display text-h3 font-bold tracking-tight"
              />
            </motion.div>

            <motion.div
              {...heroSubEntry}
              transition={{ duration: 0.6, delay: 0.6, ease: easePrecast }}
              className="pointer-events-auto mt-10 mb-6 flex flex-row flex-nowrap items-center gap-3 whitespace-nowrap"
            >
              <Link
                href="/home"
                data-testid="cta-homeowner"
                style={{ color: "#0A0A0A" }}
                className="bg-accent-lime px-7 py-3.5 text-center font-mono text-small font-bold tracking-eyebrow uppercase outline outline-2 -outline-offset-2 outline-accent-lime transition-colors hover:bg-fg-9 hover:!text-fg-0 hover:outline-fg-9"
              >
                {t("cta.homeowner")}
              </Link>
              <Link
                href="/studio"
                data-testid="cta-designer"
                className="bg-fg-0/50 px-7 py-3.5 text-center font-mono text-small font-bold tracking-eyebrow uppercase text-accent-lime outline outline-2 -outline-offset-2 outline-accent-lime backdrop-blur-sm transition-colors hover:bg-accent-lime hover:!text-fg-0 hover:outline-accent-lime"
              >
                {t("cta.designer")}
              </Link>
            </motion.div>
          </div>
        </div>
        {/* Right half · empty placeholder so the grid keeps the layout but
            does not capture pointer events from the 3D canvas underneath. */}
        <div className="hidden lg:block" aria-hidden />
      </div>

      {/* Selected-part info panel · bottom right */}
      <HeroPartInfoPanel />
    </section>
  );
}
