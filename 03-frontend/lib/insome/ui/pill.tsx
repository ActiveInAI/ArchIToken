import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type PillTone = "ghost" | "lime" | "signal";

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: PillTone;
  readonly children?: ReactNode;
}

const toneClass: Record<PillTone, string> = {
  ghost: "bg-transparent text-fg-3 border-fg-6",
  lime: "bg-accent-lime border-accent-lime text-fg-0",
  signal: "bg-accent-signal border-accent-signal text-fg-9",
};

export function Pill({ tone = "ghost", className, children, ...rest }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-mono text-micro tracking-eyebrow uppercase",
        toneClass[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
