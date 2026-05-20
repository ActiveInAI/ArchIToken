"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mockWorks, type Work } from "@/content/works.mock";
import { applyFilter, type FilterBarValue } from "@/components/shared/filter-bar";

export interface FetchWorksParams {
  readonly cursor?: string | null;
  readonly limit?: number;
  readonly filter?: FilterBarValue;
}

export interface FetchWorksResult {
  readonly items: ReadonlyArray<Work>;
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

const MOCK_DELAY_MS = 800;
const DEFAULT_LIMIT = 20;

// TODO(phase-4.1): replace with GET /api/works?cursor=&limit=&filter=
export async function fetchWorks(params: FetchWorksParams): Promise<FetchWorksResult> {
  const { cursor, limit = DEFAULT_LIMIT, filter } = params;
  const filtered = filter ? (applyFilter(mockWorks, filter) as Work[]) : (mockWorks as Work[]);
  const startIndex = cursor ? Math.max(0, parseInt(cursor, 10)) : 0;
  const endIndex = Math.min(filtered.length, startIndex + limit);
  const items = filtered.slice(startIndex, endIndex);
  const hasMore = endIndex < filtered.length;
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
  return {
    items,
    nextCursor: hasMore ? String(endIndex) : null,
    hasMore,
  };
}

interface UseInfiniteWorksReturn {
  readonly items: ReadonlyArray<Work>;
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly loadMore: () => void;
  readonly reset: () => void;
}

export function useInfiniteWorks(filter?: FilterBarValue, initialItems: ReadonlyArray<Work> = []): UseInfiniteWorksReturn {
  const [items, setItems] = useState<ReadonlyArray<Work>>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialItems.length > 0 ? String(initialItems.length) : null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const filterKey = useRef(JSON.stringify(filter ?? null));

  const reset = useCallback(() => {
    setItems([]);
    setCursor(null);
    setHasMore(true);
    setIsLoading(false);
    setError(null);
    loadingRef.current = false;
  }, []);

  // Reset whenever filter changes
  useEffect(() => {
    const next = JSON.stringify(filter ?? null);
    if (next !== filterKey.current) {
      filterKey.current = next;
      reset();
    }
  }, [filter, reset]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchWorks({ cursor, ...(filter ? { filter } : {}) });
      setItems((prev) => [...prev, ...result.items]);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (e) {
      setError(String(e));
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [cursor, filter, hasMore]);

  return { items, hasMore, isLoading, error, loadMore, reset };
}
