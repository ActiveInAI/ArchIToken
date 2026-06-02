"use client";

import { cn } from "@/lib/insome/ui";

type LogoSize = "xs" | "sm" | "md" | "lg";
type LogoVariant = "auto" | "dark-bg" | "light-bg";

interface BrandLogoProps {
  readonly size?: LogoSize;
  readonly variant?: LogoVariant;
  readonly className?: string;
}

const SIZE_MAP: Record<LogoSize, { className: string }> = {
  xs: { className: "h-3" },
  sm: { className: "h-5" },
  md: { className: "h-7" },
  lg: { className: "h-12" },
};

export function ArchITokenLogo({ size = "sm", variant = "auto", className }: BrandLogoProps) {
  const sizeCls = SIZE_MAP[size].className;
  const variantCls =
    variant === "dark-bg"
      ? "text-fg-9"
      : variant === "light-bg"
        ? "text-fg-1"
        : "architoken-logo-auto";
  return (
    <span
      className={cn("inline-flex items-center", sizeCls, variantCls, className)}
      aria-label="ArchIToken"
      role="img"
    >
      <svg
        viewBox="0 0 240 72"
        className="h-full w-auto"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polygon
          points="36 4 42.12 21.22 58.63 13.37 50.78 29.88 68 36 50.78 42.12 58.63 58.63 42.12 50.78 36 68 29.88 50.78 13.37 58.63 21.22 42.12 4 36 21.22 29.88 13.37 13.37 29.88 21.22"
          fill="#f4c542"
        />
        <circle
          cx="36"
          cy="36"
          r="16"
          fill="#fff1bf"
        />
        <text
          x="84"
          y="53"
          fontFamily="Inter Tight, Helvetica Neue, Helvetica, Arial, sans-serif"
          fontSize="46"
          fontWeight="800"
          letterSpacing="0"
          fill="currentColor"
        >
          ArchIToken
        </text>
      </svg>
    </span>
  );
}

export function InsomeLogo(props: BrandLogoProps) {
  return <ArchITokenLogo {...props} />;
}
