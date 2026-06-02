"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LangToggle } from "@/lib/insome/ui";
import type { LocaleCode } from "@/lib/insome/types";
import { setLocaleAction } from "@/app/actions/locale";
import { ArchITokenLogo } from "@/lib/brand/logo";

interface StudioShowcaseNavProps {
  readonly title: string;
}

export function StudioShowcaseNav({ title }: StudioShowcaseNavProps) {
  const tCommon = useTranslations("common");
  const tBrand = useTranslations("brand");
  const tNav = useTranslations("studio.nav");
  const locale = useLocale() as LocaleCode;
  const [pending, startTransition] = useTransition();

  const switchLocale = (next: LocaleCode) => {
    if (next === locale) return;
    startTransition(() => setLocaleAction(next));
  };

  return (
    <nav className="flex h-14 shrink-0 items-center justify-between border-b border-fg-2 bg-fg-0 px-5 text-fg-8">
      <div className="flex items-center gap-4">
        <Link href="/" aria-label="ArchIToken home" className="flex items-center">
          <ArchITokenLogo size="xs" variant="dark-bg" />
        </Link>
        <Link
          href="/app/modules/concept_design"
          className="font-mono text-micro tracking-eyebrow uppercase text-fg-4 transition-colors hover:text-fg-8"
        >
          ← {tNav("back")}
        </Link>
        <span className="border-l border-fg-2 pl-4 font-display text-h4 font-bold tracking-tight text-fg-9">
          {title}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
          {tBrand("studioSuffix")}
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
