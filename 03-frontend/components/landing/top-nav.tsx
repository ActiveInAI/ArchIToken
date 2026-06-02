"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LangToggle } from "@/lib/insome/ui";
import type { LocaleCode } from "@/lib/insome/types";
import { setLocaleAction } from "@/app/actions/locale";

export function TopNav() {
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
      className="sticky top-0 z-50 flex items-center justify-between border-b border-fg-6 bg-fg-8/85 px-10 py-5 backdrop-blur-lg"
      aria-label="primary"
    >
      <div className="font-display text-[22px] font-black tracking-brand">
        {tBrand("wordmarkIn")}
        <mark>{tBrand("wordmarkSo")}</mark>
        {tBrand("wordmarkMe")}
      </div>

      <div className="flex gap-7 text-small">
        <Link
          href="/home"
          className="text-fg-3 transition-colors hover:text-fg-0"
        >
          {tNav("home")}
        </Link>
        <Link
          href="/app/modules/concept_design"
          className="text-fg-3 transition-colors hover:text-fg-0"
        >
          {tNav("studio")}
        </Link>
        <span className="cursor-default text-fg-3">{tNav("platform")}</span>
        <span className="cursor-default text-fg-3">{tNav("docs")}</span>
        <span className="cursor-default text-fg-3">{tNav("pricing")}</span>
      </div>

      <div className="flex items-center gap-4">
        <LangToggle
          value={locale}
          labelCN={tCommon("langCN")}
          labelEN={tCommon("langEN")}
          disabled={pending}
          onSelect={switchLocale}
        />
        {/* TODO(phase-4): wire /api/auth for real sign-in */}
        <button
          type="button"
          className="border border-fg-0 bg-fg-0 px-3.5 py-2 font-semibold text-fg-9 text-small transition-colors hover:bg-fg-2 hover:border-fg-2"
        >
          {tCommon("signIn")}
        </button>
      </div>
    </nav>
  );
}
