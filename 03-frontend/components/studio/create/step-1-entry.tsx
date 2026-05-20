"use client";

import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { CreateEntry } from "@/lib/insome/types";
import { useStudioCreateStore } from "@/stores/studio-create.store";
import { useStudioViewStore } from "@/stores/studio-view.store";

export function CreateStep1Entry() {
  const t = useTranslations("studio.create.step1");
  const setEntry = useStudioCreateStore((s) => s.setEntry);
  const goTo = useStudioViewStore((s) => s.goTo);

  const pick = (entry: CreateEntry) => {
    setEntry(entry);
    if (entry === "ai") {
      goTo("create-step-2");
    } else {
      // TODO(phase-4): wire Scratch (blank canvas) + Upload (DWG/DXF parser)
      toast(entry === "scratch" ? t("scratchNotice") : t("uploadNotice"));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-landing flex-col gap-8 px-10 py-16">
      <header>
        <div className="eyebrow text-fg-4">{t("eyebrow")}</div>
        <h1 className="mt-2 font-display text-[48px] font-extrabold tracking-tight text-fg-8">
          {t("title")}
        </h1>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <EntryCard
          icon="✨"
          title={t("ai.title")}
          description={t("ai.description")}
          onClick={() => pick("ai")}
          highlighted
        />
        <EntryCard
          icon="✎"
          title={t("scratch.title")}
          description={t("scratch.description")}
          onClick={() => pick("scratch")}
        />
        <EntryCard
          icon="⬆"
          title={t("upload.title")}
          description={t("upload.description")}
          onClick={() => pick("upload")}
        />
      </div>
    </div>
  );
}

function EntryCard({
  icon,
  title,
  description,
  onClick,
  highlighted = false,
}: {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  readonly onClick: () => void;
  readonly highlighted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-3 border bg-fg-1 p-8 text-center transition-colors ${
        highlighted
          ? "border-accent-lime hover:bg-fg-2"
          : "border-fg-2 hover:border-accent-lime hover:bg-fg-2"
      }`}
    >
      <span className="text-5xl text-accent-lime">{icon}</span>
      <span className="font-display text-h4 font-semibold text-fg-8">{title}</span>
      <span className="font-mono text-micro text-fg-4">{description}</span>
    </button>
  );
}
