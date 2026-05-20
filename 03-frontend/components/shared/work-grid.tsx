"use client";

import { cn } from "@/lib/insome/ui";
import type { Work } from "@/content/works.mock";
import { WorkCard } from "./work-card";

interface WorkGridProps {
  readonly works: ReadonlyArray<Work>;
  readonly theme: "dark" | "light";
  readonly onOpen: (id: string) => void;
}

export function WorkGrid({ works, theme, onOpen }: WorkGridProps) {
  if (works.length === 0) {
    return (
      <div
        className={cn(
          "flex w-full flex-col items-center justify-center py-32 font-mono text-small tracking-eyebrow uppercase",
          theme === "dark" ? "text-fg-4" : "text-fg-3",
        )}
      >
        <span>No works match the filters</span>
      </div>
    );
  }
  return (
    <div className="w-full columns-2 gap-4 [column-fill:_balance] sm:columns-3 lg:columns-4 xl:columns-5">
      {works.map((work) => (
        <div key={work.id} className="mb-4 break-inside-avoid">
          <WorkCard work={work} theme={theme} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}
