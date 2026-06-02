"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArchLoadingFlow } from "@/components/ArchLoadingFlow";

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
      <ArchLoadingFlow label={t("loading")} size="panel" />
      <span>{t("loading")}</span>
      {slow ? (
        <span className="text-[10px] text-fg-4">{t("loadingSlow")}</span>
      ) : null}
    </div>
  );
}
