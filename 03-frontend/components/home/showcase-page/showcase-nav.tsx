"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LangToggle } from "@/lib/insome/ui";
import type { LocaleCode } from "@/lib/insome/types";
import { setLocaleAction } from "@/app/actions/locale";
import { InsomeLogo } from "@/lib/brand/logo";

interface ShowcaseNavProps {
  readonly title: string;
}

export function ShowcaseNav({ title }: ShowcaseNavProps) {
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
    <nav className="flex h-14 shrink-0 items-center justify-between border-b border-fg-6 bg-fg-8 px-5">
      <div className="flex items-center gap-4">
        <Link href="/" aria-label="INSOME home" className="flex items-center">
          <InsomeLogo size="xs" variant="light-bg" />
        </Link>
        <Link href="/home" className="font-mono text-micro tracking-eyebrow uppercase text-fg-3 transition-colors hover:text-fg-0">
          ← {tNav("backToInspiration")}
        </Link>
        <span className="border-l border-fg-6 pl-4 font-display text-h4 font-bold tracking-tight text-fg-0">
          {title}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-3">
          {tBrand("homeSuffix")}
        </span>
        <LangToggle
          value={locale}
          labelCN={tCommon("langCN")}
          labelEN={tCommon("langEN")}
          disabled={pending}
          onSelect={switchLocale}
        />
      </div>
    </nav>
  );
}
