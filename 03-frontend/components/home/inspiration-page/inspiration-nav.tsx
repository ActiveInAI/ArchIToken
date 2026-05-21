"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LangToggle } from "@/lib/insome/ui";
import type { LocaleCode } from "@/lib/insome/types";
import { setLocaleAction } from "@/app/actions/locale";

export function InspirationNav() {
  const tCommon = useTranslations("common");
  const tBrand = useTranslations("brand");
  const tNav = useTranslations("inspiration.nav");
  const locale = useLocale() as LocaleCode;
  const [pending, startTransition] = useTransition();

  const switchLocale = (next: LocaleCode) => {
    if (next === locale) return;
    startTransition(() => setLocaleAction(next));
  };

  return (
    <nav className="flex h-16 items-center justify-between border-b border-fg-6 bg-fg-8/85 px-6 text-small backdrop-blur-md">
      <div className="flex items-center gap-8">
        <Link href="/" className="inline-flex items-baseline gap-2">
          <span className="font-display text-[20px] font-black tracking-brand text-fg-0">
            {tBrand("wordmarkIn")}
            <mark>{tBrand("wordmarkSo")}</mark>
            {tBrand("wordmarkMe")}
          </span>
          <span className="border-l border-fg-6 pl-2 font-mono text-micro tracking-eyebrow uppercase text-fg-3">
            {tBrand("homeSuffix")}
          </span>
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          <Link href="/home" className="font-mono text-micro tracking-eyebrow uppercase text-fg-0 underline-offset-4 hover:underline">
            {tNav("inspiration")}
          </Link>
          <Link href="/home#start" className="font-mono text-micro tracking-eyebrow uppercase text-fg-3 transition-colors hover:text-fg-0">
            {tNav("startDesign")}
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/app/modules/concept_design"
          className="font-mono text-micro tracking-eyebrow uppercase text-fg-3 transition-colors hover:text-accent-signal"
        >
          → {tNav("toStudio")}
        </Link>
        <LangToggle
          value={locale}
          labelCN={tCommon("langCN")}
          labelEN={tCommon("langEN")}
          disabled={pending}
          onSelect={switchLocale}
        />
        <span
          aria-label={tCommon("signedIn")}
          className="inline-flex h-8 w-8 items-center justify-center border border-fg-6 font-mono text-micro text-fg-0"
        >
          L
        </span>
      </div>
    </nav>
  );
}
