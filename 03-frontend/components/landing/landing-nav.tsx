"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LangToggle } from "@/lib/insome/ui";
import type { LocaleCode } from "@/lib/insome/types";
import { setLocaleAction } from "@/app/actions/locale";

export function LandingNav() {
  const tNav = useTranslations("landing.nav");
  const tCommon = useTranslations("common");
  const tBrand = useTranslations("brand");
  const locale = useLocale() as LocaleCode;
  const [pending, startTransition] = useTransition();

  const switchLocale = (next: LocaleCode) => {
    if (next === locale) return;
    startTransition(() => setLocaleAction(next));
  };

  return (
    <nav
      className="sticky top-0 z-50 flex items-center justify-between border-b border-fg-2 bg-fg-0/80 px-10 py-5 backdrop-blur-lg"
      aria-label="primary"
    >
      <div className="font-display text-[22px] font-black tracking-brand text-fg-9">
        {tBrand("wordmarkIn")}
        <span className="text-accent-lime">{tBrand("wordmarkSo")}</span>
        {tBrand("wordmarkMe")}
      </div>

      <div className="hidden gap-7 text-small md:flex">
        <Link href="/home" className="text-fg-4 transition-colors hover:text-fg-9">
          {tNav("home")}
        </Link>
        <Link href="/studio" className="text-fg-4 transition-colors hover:text-fg-9">
          {tNav("studio")}
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <LangToggle
          value={locale}
          labelCN={tCommon("langCN")}
          labelEN={tCommon("langEN")}
          disabled={pending}
          onSelect={switchLocale}
        />
        {/* TODO(phase-4.1): wire /api/auth for real sign-in */}
        <button
          type="button"
          className="border border-fg-9 px-3.5 py-2 font-semibold text-fg-9 text-small transition-colors hover:bg-fg-9 hover:text-fg-0"
        >
          {tCommon("signIn")}
        </button>
      </div>
    </nav>
  );
}
