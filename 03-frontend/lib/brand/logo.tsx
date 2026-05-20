"use client";

import { cn } from "@/lib/insome/ui";

type LogoSize = "xs" | "sm" | "md" | "lg";
type LogoVariant = "auto" | "dark-bg" | "light-bg";

interface InsomeLogoProps {
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

/**
 * INSOME wordmark. SVG uses fill="currentColor"; this component sets `color`
 * via className to control rendering:
 *  - variant="auto"      → CSS rule on data-theme picks fg-1 (light) / fg-9 (dark)
 *  - variant="dark-bg"   → forced fg-9 (white)
 *  - variant="light-bg"  → forced fg-1 (near-black)
 */
export function InsomeLogo({ size = "sm", variant = "auto", className }: InsomeLogoProps) {
  const sizeCls = SIZE_MAP[size].className;
  const variantCls =
    variant === "dark-bg"
      ? "text-fg-9"
      : variant === "light-bg"
        ? "text-fg-1"
        : "insome-logo-auto";
  return (
    <span
      className={cn("inline-flex items-center", sizeCls, variantCls, className)}
      aria-label="INSOME"
      role="img"
    >
      <svg
        viewBox="0 0 1833 293.71"
        className="h-full w-auto"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="m0,12.3h69.66v253.63l7.38,15.49H7.38V27.9L0,12.3Z" />
        <polygon points="1833 231.43 1833 281.39 1601.94 281.39 1601.94 27.89 1594.56 12.32 1828.06 12.32 1828.06 62.28 1664.37 62.28 1664.37 120.73 1811.45 120.73 1811.45 169.14 1664.37 169.14 1664.37 231.43 1833 231.43" />
        <path d="m581.74,78.64c1.49-17.54,25.07-30.82,70.18-24.87,37.27,4.91,78.85,26.75,78.85,26.75l28.82-57.06-18.13-.37s-43.08-17.7-85.34-21.82c-89.25-8.7-130.96,28.06-134.05,78.52-6.06,98.88,175.39,76.45,181.84,125.77,3.69,28.19-31.61,36.95-76.43,32.84-52.36-4.8-90.44-35.62-90.44-35.62l-30.37,55.83,14.44-1.06s48.65,29.69,102.2,34.86c101.05,9.75,142.04-37.28,143.18-79.81,2.9-108.44-189.47-78.24-184.74-133.96Z" />
        <path d="m970.25,7.67c-103.54,0-159.77,53.13-159.77,139.18s56.24,139.18,159.77,139.18,159.77-53.13,159.77-139.18S1073.79,7.67,970.25,7.67Zm0,221.69c-58.37,0-99.85-31.36-99.85-82.51s41.47-82.51,99.85-82.51,99.85,31.36,99.85,82.51-41.47,82.51-99.85,82.51Z" />
        <polygon points="448.76 281.39 389.53 281.39 238.32 115.49 238.32 281.39 176.03 281.39 176.03 27.89 168.65 12.32 230.57 12.32 378.39 174.9 379.12 175.71 379.12 12.32 441.38 12.32 441.38 265.96 448.76 281.39" />
        <path d="m1249.87,140.69l-1.03,12.32,1.11-12.25-.08-.07Z" />
        <path d="m1525.06,265.96l-22.14-253.64h-60.88l-.07.07-91.8,140.14-91.8-140.14-.07-.07h-69.59l7.38,15.57-22.14,253.5h60.96l14.98-172.54.08.07,100.22,147.01,100.22-147.01.07-.07,14.98,172.54h69.67l-10.04-15.42Z" />
      </svg>
    </span>
  );
}
