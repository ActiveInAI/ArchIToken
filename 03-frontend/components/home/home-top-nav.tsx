"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LangToggle } from "@/lib/insome/ui";
import type { LocaleCode } from "@/lib/insome/types";
import { setLocaleAction } from "@/app/actions/locale";
import { useHomeViewStore } from "@/stores/home-view.store";

export interface HomeTopNavProps {
  readonly projectName?: string | undefined;
  readonly showBack?: boolean | undefined;
}

export function HomeTopNav({ projectName, showBack = false }: HomeTopNavProps) {
  const tCommon = useTranslations("common");
  const tBrand = useTranslations("brand");
  const tNav = useTranslations("home.workspace.nav");
  const locale = useLocale() as LocaleCode;
  const [pending, startTransition] = useTransition();
  const goDashboard = useHomeViewStore((s) => s.goDashboard);

  const switchLocale = (next: LocaleCode) => {
    if (next === locale) return;
    startTransition(() => setLocaleAction(next));
  };

  return (
    <nav className="flex h-14 items-center justify-between border-b border-fg-6 bg-fg-8 px-5 text-small">
      <div className="flex items-center gap-4">
        <Link href="/" className="inline-flex items-baseline gap-2">
          <span className="font-display text-[18px] font-black tracking-brand">
            {tBrand("wordmarkIn")}
            <mark>{tBrand("wordmarkSo")}</mark>
            {tBrand("wordmarkMe")}
          </span>
          <span className="border-l border-fg-6 pl-2 font-mono text-micro tracking-eyebrow uppercase text-fg-3">
            {tBrand("homeSuffix")}
          </span>
        </Link>
        {showBack ? (
          <button
            type="button"
            onClick={goDashboard}
            className="ml-2 font-mono text-micro tracking-eyebrow uppercase text-fg-3 transition-colors hover:text-fg-0"
          >
            ← {tNav("back")}
          </button>
        ) : null}
      </div>

      {projectName ? (
        <div className="font-mono text-micro text-fg-3">{projectName}</div>
      ) : null}

      <div className="flex items-center gap-4">
        <Link
          href="/studio"
          className="font-mono text-micro tracking-eyebrow uppercase text-fg-3 transition-colors hover:text-accent-signal"
        >
          → {tNav("toStudio")}
        </Link>
        <span className="font-mono text-micro text-accent-signal">
          {tNav("saveStatus")}
        </span>
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
