"use client";

import Link from "next/link";
import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LangToggle } from "@/lib/insome/ui";
import type { LocaleCode } from "@/lib/insome/types";
import { cn } from "@/lib/insome/ui";
import { setLocaleAction } from "@/app/actions/locale";
import { InsomeLogo } from "@/lib/brand/logo";

type NavVariant = "landing" | "home" | "studio" | "auto";

interface UnifiedNavProps {
  readonly variant?: NavVariant;
  readonly showAuthButtons?: boolean;
  readonly showLanguageSwitch?: boolean;
}

function detectVariant(pathname: string): Exclude<NavVariant, "auto"> {
  if (pathname.startsWith("/studio")) return "studio";
  if (pathname.startsWith("/home")) return "home";
  return "landing";
}

export function UnifiedNav({
  variant = "auto",
  showAuthButtons = true,
  showLanguageSwitch = true,
}: UnifiedNavProps) {
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const locale = useLocale() as LocaleCode;
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const resolved = variant === "auto" ? detectVariant(pathname) : variant;
  const onDark = resolved === "landing" || resolved === "studio";

  const switchLocale = (next: LocaleCode) => {
    if (next === locale) return;
    startTransition(() => setLocaleAction(next));
  };

  const isActive = (href: string) => {
    if (href === "/home") return pathname === "/home" || pathname.startsWith("/home/");
    if (href === "/studio") return pathname === "/studio" || pathname.startsWith("/studio/");
    return pathname === href;
  };

  return (
    <nav
      data-testid="unified-nav"
      className={cn(
        "sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b px-6 backdrop-blur-md",
        onDark
          ? "border-fg-2 bg-fg-0/85 text-fg-9"
          : "border-fg-6 bg-fg-9/85 text-fg-0",
      )}
      aria-label="primary"
    >
      <div className="flex items-center gap-8">
        <Link href="/" data-testid="nav-logo" className="flex items-center" aria-label="INSOME home">
          <InsomeLogo size="sm" />
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          <NavLink
            href="/home"
            label={tNav("home")}
            active={isActive("/home")}
            onDark={onDark}
            testid="nav-home"
          />
          <NavLink
            href="/studio"
            label={tNav("studio")}
            active={isActive("/studio")}
            onDark={onDark}
            testid="nav-studio"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {showLanguageSwitch ? (
          <LangToggle
            value={locale}
            labelCN={tCommon("langCN")}
            labelEN={tCommon("langEN")}
            disabled={pending}
            onSelect={switchLocale}
          />
        ) : null}
        {showAuthButtons ? (
          <>
            {/* TODO(phase-4.1): wire /api/auth */}
            <button
              type="button"
              data-testid="nav-signin"
              className={cn(
                "border px-4 py-2 font-mono text-micro tracking-eyebrow uppercase transition-colors",
                onDark
                  ? "border-fg-3 text-fg-9 hover:border-accent-lime hover:text-accent-lime"
                  : "border-fg-3 text-fg-0 hover:border-accent-signal hover:text-accent-signal",
              )}
            >
              {tNav("signIn")}
            </button>
            <button
              type="button"
              data-testid="nav-signup"
              className={cn(
                "border-2 px-4 py-2 font-mono text-micro font-semibold tracking-eyebrow uppercase transition-opacity hover:opacity-90",
                onDark
                  ? "border-accent-lime bg-accent-lime text-fg-0"
                  : "border-accent-signal bg-accent-signal text-fg-9",
              )}
            >
              {tNav("signUp")}
            </button>
          </>
        ) : null}
      </div>
    </nav>
  );
}

interface NavLinkProps {
  readonly href: string;
  readonly label: string;
  readonly active: boolean;
  readonly onDark: boolean;
  readonly testid: string;
}

function NavLink({ href, label, active, onDark, testid }: NavLinkProps) {
  return (
    <Link
      href={href}
      data-testid={testid}
      className={cn(
        "font-mono text-micro tracking-eyebrow uppercase transition-colors",
        active
          ? "text-accent-lime underline decoration-accent-lime decoration-2 underline-offset-8"
          : onDark
            ? "text-fg-4 hover:text-fg-9"
            : "text-fg-3 hover:text-fg-0",
      )}
    >
      {label}
    </Link>
  );
}
