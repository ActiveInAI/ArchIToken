"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const SLOW_THRESHOLD_MS = 5000;

export function SceneLoadingFallback() {
  const t = useTranslations("scene");
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_THRESHOLD_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex h-full w-full flex-col items-center justify-center gap-3 font-mono text-micro tracking-eyebrow uppercase text-fg-4"
    >
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 animate-pulse bg-accent-signal" />
        <span className="inline-block h-2 w-2 animate-pulse bg-accent-signal" style={{ animationDelay: "0.15s" }} />
        <span className="inline-block h-2 w-2 animate-pulse bg-accent-signal" style={{ animationDelay: "0.3s" }} />
      </div>
      <span>{t("loading")}</span>
      {slow ? <span className="text-[10px] text-fg-4">{t("loadingSlow")}</span> : null}
    </div>
  );
}
