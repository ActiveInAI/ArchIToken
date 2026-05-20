"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/insome/ui";

interface ShowcaseShellProps {
  readonly chat: ReactNode;
  readonly canvas: ReactNode;
  readonly info: ReactNode;
  readonly nav: ReactNode;
  readonly theme?: "light" | "dark";
}

export function ShowcaseShell({ chat, canvas, info, nav, theme = "light" }: ShowcaseShellProps) {
  const onDark = theme === "dark";
  return (
    <div className={cn("flex h-screen flex-col overflow-hidden", onDark ? "bg-fg-0 text-fg-9" : "bg-fg-8 text-fg-0")}>
      {nav}
      <div className="flex-1 overflow-hidden">
        <div className="grid h-full w-full grid-cols-1 lg:grid-cols-[22%_56%_22%]">
          <aside className={cn("h-full overflow-hidden border-r", onDark ? "border-fg-2" : "border-fg-6")}>
            {chat}
          </aside>
          <main className="h-full overflow-hidden">{canvas}</main>
          <aside className={cn("h-full overflow-y-auto border-l", onDark ? "border-fg-2" : "border-fg-6")}>
            {info}
          </aside>
        </div>
        <div className={cn(
          "block px-6 py-4 text-center font-mono text-micro tracking-eyebrow uppercase lg:hidden",
          onDark ? "text-fg-4" : "text-fg-3",
        )}>
          For best experience, view on desktop.
        </div>
      </div>
    </div>
  );
}
