"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useStudioEditorStore } from "@/stores/studio-editor.store";

const TICK_MS = 10_000;
const RECENT_COUNT = 5;

export function CommandHistoryOverlay() {
  const t = useTranslations();
  const stack = useStudioEditorStore((s) => s.commandStack);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const recent = stack.past.slice(-RECENT_COUNT).reverse();
  if (recent.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-col-reverse gap-1"
      aria-hidden="true"
    >
      {recent.map((cmd, i) => {
        const opacity = 1 - i * 0.12;
        return (
          <div
            key={cmd.id}
            className="border border-fg-2 bg-fg-0 px-2 py-1 font-mono text-[10px] tracking-eyebrow uppercase text-fg-4"
            style={{ opacity }}
            title={formatTimeAgo(cmd.createdAt, t)}
          >
            <span className="mr-1 text-accent-lime">{iconFor(cmd.labelKey)}</span>
            <span className="truncate">{truncate(t(cmd.labelKey), 22)}</span>
          </div>
        );
      })}
    </div>
  );
}

function iconFor(labelKey: string): string {
  if (labelKey.includes("create")) return "+";
  if (labelKey.includes("delete")) return "−";
  if (labelKey.includes("update") || labelKey.includes("translate") || labelKey.includes("move") || labelKey.includes("setWall")) return "→";
  return "•";
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function formatTimeAgo(createdAt: number, t: (k: string, values?: Record<string, number | string>) => string): string {
  const diffMs = Date.now() - createdAt;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return t("history.overlay.timeAgo.second", { n: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return t("history.overlay.timeAgo.minute", { n: min });
  const hr = Math.floor(min / 60);
  return t("history.overlay.timeAgo.hour", { n: hr });
}
