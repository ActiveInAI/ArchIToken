"use client";

import Link from "next/link";
import { useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LangToggle } from "@/lib/insome/ui";
import type { LocaleCode } from "@/lib/insome/types";
import { setLocaleAction } from "@/app/actions/locale";
import { useStudioViewStore } from "@/stores/studio-view.store";

export interface StudioTopNavProps {
  readonly projectName?: string | undefined;
  readonly rightSlot?: ReactNode;
}

export function StudioTopNav({ projectName, rightSlot }: StudioTopNavProps) {
  const tCommon = useTranslations("common");
  const tBrand = useTranslations("brand");
  const tNav = useTranslations("studio.nav");
  const locale = useLocale() as LocaleCode;
  const [pending, startTransition] = useTransition();
  const { view, exitToProjects } = useStudioViewStore();

  const showBack = view !== "projects";

  const switchLocale = (next: LocaleCode) => {
    if (next === locale) return;
    startTransition(() => setLocaleAction(next));
  };

  return (
    <nav className="flex h-14 items-center justify-between border-b border-fg-2 bg-fg-0 px-5 text-small text-fg-8">
      <div className="flex items-center gap-4">
        <Link href="/" className="inline-flex items-baseline gap-2">
          <span className="font-display text-[18px] font-black tracking-brand">
            {tBrand("wordmarkIn")}
            <mark className="text-accent-lime">{tBrand("wordmarkSo")}</mark>
            {tBrand("wordmarkMe")}
          </span>
          <span className="border-l border-fg-2 pl-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4">
            {tBrand("studioSuffix")}
          </span>
        </Link>
        {showBack ? (
          <button
            type="button"
            onClick={exitToProjects}
            className="ml-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4 transition-colors hover:text-fg-8"
          >
            ← {tNav("back")}
          </button>
        ) : null}
      </div>

      {projectName ? (
        <div className="font-mono text-micro text-fg-4">{projectName}</div>
      ) : null}

      <div className="flex items-center gap-3">
        {rightSlot}
        <Link
          href="/home"
          className="font-mono text-micro tracking-eyebrow uppercase text-fg-4 transition-colors hover:text-accent-lime"
        >
          → {tNav("toHome")}
        </Link>
        <span className="font-mono text-micro text-accent-lime">{tNav("saveStatus")}</span>
        <LangToggle
          value={locale}
          labelCN={tCommon("langCN")}
          labelEN={tCommon("langEN")}
          disabled={pending}
          onSelect={switchLocale}
        />
        <span
          aria-label={tCommon("signedIn")}
          className="inline-flex h-8 w-8 items-center justify-center border border-fg-2 font-mono text-micro text-fg-8"
        >
          A
        </span>
      </div>
    </nav>
  );
}
