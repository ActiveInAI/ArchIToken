"use client";

import { useCallback } from "react";
import type { Floorplan } from "@/lib/insome/floorplan";

const STORAGE_KEY = "insome_published_works";

export interface PublishedWork {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly publishedAt: string;
  readonly floorplanSnapshot?: Pick<Floorplan, "id" | "nameKey"> | undefined;
}

export interface PublishWorkInput {
  readonly title: string;
  readonly description: string;
  readonly floorplan?: Floorplan | undefined;
}

interface UsePublishWork {
  readonly publish: (input: PublishWorkInput) => Promise<PublishedWork>;
  readonly listPublished: () => ReadonlyArray<PublishedWork>;
}

// TODO(phase-4.1): replace with POST /api/works (Supabase + storage upload)
export function usePublishWork(): UsePublishWork {
  const publish = useCallback(async (input: PublishWorkInput) => {
    const record: PublishedWork = {
      id: `pub-${Date.now()}`,
      title: input.title,
      description: input.description,
      publishedAt: new Date().toISOString(),
      ...(input.floorplan
        ? {
            floorplanSnapshot: {
              id: input.floorplan.id,
              nameKey: input.floorplan.nameKey,
            },
          }
        : {}),
    };
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const list: PublishedWork[] = raw ? JSON.parse(raw) : [];
        list.push(record);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        console.log("[publish-work] published:", record);
      } catch {
        /* swallow */
      }
    }
    return record;
  }, []);

  const listPublished = useCallback((): ReadonlyArray<PublishedWork> => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as PublishedWork[]) : [];
    } catch {
      return [];
    }
  }, []);

  return { publish, listPublished };
}
