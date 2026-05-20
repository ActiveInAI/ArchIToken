"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/insome/ui";
import { mockWorks } from "@/content/works.mock";
import { WorkGrid } from "./work-grid";
import { WorkDetailDialog } from "./work-detail-dialog";
import {
  FilterBar,
  DEFAULT_FILTER,
  type FilterBarValue,
} from "./filter-bar";
import { useInfiniteWorks } from "@/lib/works/use-infinite-works";

interface WorksExplorerProps {
  readonly theme: "dark" | "light";
  readonly compactFilters?: boolean;
  readonly title?: string;
}

export function WorksExplorer({ theme, compactFilters = false, title }: WorksExplorerProps) {
  const tHeader = useTranslations("home.work.header");
  const tInfinite = useTranslations("works.infinite");
  const [filter, setFilter] = useState<FilterBarValue>(DEFAULT_FILTER);
  const [openId, setOpenId] = useState<string | null>(null);
  const onDark = theme === "dark";
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { items, hasMore, isLoading, error, loadMore } = useInfiniteWorks(filter);

  const work = useMemo(() => mockWorks.find((w) => w.id === openId) ?? null, [openId]);
  const open = openId !== null;

  // Initial load on mount and on filter reset
  useEffect(() => {
    if (items.length === 0 && hasMore && !isLoading) loadMore();
  }, [items.length, hasMore, isLoading, loadMore]);

  // IntersectionObserver triggers loadMore when sentinel enters viewport
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !isLoading && hasMore) {
            loadMore();
          }
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore]);

  return (
    <section
      data-testid="works-explorer"
      className={cn("mx-auto w-full max-w-landing px-6 py-12", onDark ? "bg-fg-0" : "bg-fg-8")}
    >
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2
          data-testid="works-explorer-title"
          className={cn(
            "font-display text-h2 font-extrabold tracking-tight",
            onDark ? "text-fg-9" : "text-fg-0",
          )}
        >
          {title ?? tHeader("publicGallery")}
        </h2>
        <span
          className={cn(
            "font-mono text-micro tracking-eyebrow uppercase",
            onDark ? "text-fg-4" : "text-fg-3",
          )}
        >
          {tHeader("totalCount", { n: items.length })}
        </span>
      </div>
      <div className="mb-8">
        <FilterBar value={filter} onChange={setFilter} theme={theme} compact={compactFilters} />
      </div>
      <div data-testid="public-waterfall">
        <WorkGrid works={items} theme={theme} onOpen={setOpenId} />
      </div>

      <div ref={sentinelRef} aria-hidden className="h-2 w-full" data-testid="works-sentinel" />

      {isLoading ? (
        <div data-testid="works-loading" className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`sk-${i}`}
              className={cn(
                "h-64 animate-pulse",
                onDark ? "bg-fg-1" : "bg-fg-7",
              )}
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <div
          data-testid="works-error"
          className={cn(
            "mt-6 flex flex-col items-center gap-2 py-6",
            onDark ? "text-fg-4" : "text-fg-3",
          )}
        >
          <span>{tInfinite("error")}</span>
          <button
            type="button"
            onClick={() => loadMore()}
            className={cn(
              "border px-4 py-2 font-mono text-micro tracking-eyebrow uppercase",
              onDark
                ? "border-accent-lime text-accent-lime hover:bg-accent-lime hover:text-fg-0"
                : "border-accent-signal text-accent-signal hover:bg-accent-signal hover:text-fg-9",
            )}
          >
            {tInfinite("retry")}
          </button>
        </div>
      ) : null}

      {!hasMore && !isLoading && items.length > 0 ? (
        <div
          data-testid="works-end"
          className={cn(
            "mt-10 flex flex-col items-center gap-2 py-6",
            onDark ? "text-fg-4" : "text-fg-3",
          )}
        >
          <span className="font-mono text-micro tracking-eyebrow uppercase">{tInfinite("end")}</span>
          <span className="font-mono text-micro">{tInfinite("endHint")}</span>
        </div>
      ) : null}

      <WorkDetailDialog
        work={work}
        open={open}
        theme={theme}
        onOpenChange={(o) => !o && setOpenId(null)}
      />
    </section>
  );
}
