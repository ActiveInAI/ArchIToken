"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/insome/ui";
import { ArchITokenLogo } from "@/lib/brand/logo";

interface LandingFooterProps {
  readonly theme?: "dark" | "light";
}

export function LandingFooter({ theme = "dark" }: LandingFooterProps) {
  const tFooter = useTranslations("landing.footer");
  const tHero = useTranslations("landing.hero");
  const onDark = theme === "dark";

  return (
    <footer
      className={cn(
        "border-t px-10 py-12",
        onDark ? "border-fg-2 bg-fg-0 text-fg-5" : "border-fg-6 bg-fg-8 text-fg-3",
      )}
    >
      <div className="mx-auto flex w-full max-w-landing flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center">
            <ArchITokenLogo size="md" variant={onDark ? "dark-bg" : "light-bg"} />
          </div>
          <p
            className={cn(
              "mt-4 max-w-[60ch] font-display text-body leading-tight tracking-tight",
              onDark ? "text-fg-5" : "text-fg-3",
            )}
          >
            {tHero("tagline")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-2 font-mono text-micro tracking-eyebrow uppercase sm:grid-cols-3">
          <span>{tFooter("companyAbout")}</span>
          <span>{tFooter("companyCareers")}</span>
          <span>{tFooter("companyContact")}</span>
          <span>{tFooter("legalTerms")}</span>
          <span>{tFooter("legalPrivacy")}</span>
          <span>{tFooter("legalSecurity")}</span>
        </div>
      </div>
    </footer>
  );
}
