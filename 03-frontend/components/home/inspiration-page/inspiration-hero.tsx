"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Sparkles, Upload, Pencil } from "lucide-react";
import { cn } from "@/lib/insome/ui";
import { heroEntry, heroSubEntry, easePrecast } from "@/lib/motion-presets";

export function InspirationHero() {
  const t = useTranslations("inspiration.hero");
  const tCta = useTranslations("inspiration.cta");
  const router = useRouter();

  return (
    <section id="start" className="mx-auto w-full max-w-landing px-6 pt-16 pb-12">
      <motion.h1
        {...heroEntry}
        className="font-display text-h1 font-extrabold leading-[1.05] tracking-tight text-fg-0"
      >
        {t("heading")}
      </motion.h1>
      <motion.p
        {...heroSubEntry}
        transition={{ duration: 0.6, delay: 0.2, ease: easePrecast }}
        className="mt-4 max-w-[60ch] text-body text-fg-3"
      >
        {t("tagline")}
      </motion.p>

      <motion.div
        {...heroSubEntry}
        transition={{ duration: 0.6, delay: 0.35, ease: easePrecast }}
        className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        <CtaCard
          icon={<Sparkles size={20} aria-hidden />}
          label={tCta("browse")}
          description={tCta("browseDescription")}
          onClick={() => {
            document.querySelector("#works-grid")?.scrollIntoView({ behavior: "smooth" });
          }}
          variant="primary"
        />
        <CtaCard
          icon={<Upload size={20} aria-hidden />}
          label={tCta("upload")}
          description={tCta("uploadDescription")}
          onClick={() => {
            // TODO(phase-4.1): wire upload reference image flow
            router.push("/home/design/new?mode=upload");
          }}
          variant="secondary"
        />
        <CtaCard
          icon={<Pencil size={20} aria-hidden />}
          label={tCta("fromScratch")}
          description={tCta("fromScratchDescription")}
          onClick={() => {
            // TODO(phase-4.1): real /home/design/new flow with site picker + AI gen
            router.push("/home/design/new?mode=blank");
          }}
          variant="secondary"
        />
      </motion.div>
    </section>
  );
}

interface CtaCardProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly description: string;
  readonly onClick: () => void;
  readonly variant: "primary" | "secondary";
}

function CtaCard({ icon, label, description, onClick, variant }: CtaCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-start gap-4 border p-6 text-left transition-all hover:-translate-y-1",
        variant === "primary"
          ? "border-accent-signal bg-accent-signal text-fg-9 hover:opacity-95"
          : "border-fg-6 bg-fg-9 text-fg-0 hover:border-accent-signal hover:text-accent-signal",
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center border",
          variant === "primary" ? "border-fg-9/40 bg-fg-9/10" : "border-fg-6 bg-fg-8 text-fg-0 group-hover:border-accent-signal group-hover:text-accent-signal",
        )}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-display text-h4 font-bold tracking-tight">{label}</span>
        <span
          className={cn(
            "text-small",
            variant === "primary" ? "text-fg-9/80" : "text-fg-3 group-hover:text-fg-2",
          )}
        >
          {description}
        </span>
      </div>
    </button>
  );
}
