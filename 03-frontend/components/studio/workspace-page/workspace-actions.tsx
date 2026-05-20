"use client";

import { useTranslations } from "next-intl";
import { Plus, FolderOpen, ClipboardList } from "lucide-react";
import { useStudioViewStore } from "@/stores/studio-view.store";
import { useDesignerStats } from "@/lib/designer-stats";
import { usePublishWork } from "@/lib/publish-work";

export function WorkspaceActions() {
  const tActions = useTranslations("workspace.studio.actions");
  const goTo = useStudioViewStore((s) => s.goTo);
  const { listPublished } = usePublishWork();
  const stats = useDesignerStats();
  const publishedCount = listPublished().length || stats.publishedWorks;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <button
        type="button"
        onClick={() => goTo("create-step-1")}
        className="flex items-center justify-between border border-accent-lime bg-accent-lime px-5 py-4 font-mono text-small tracking-eyebrow uppercase text-fg-0 transition-opacity hover:opacity-90"
      >
        <span className="flex items-center gap-2">
          <Plus size={16} aria-hidden /> {tActions("newWork")}
        </span>
        <span className="font-display text-h4 font-bold">→</span>
      </button>
      <button
        type="button"
        className="flex items-center justify-between border border-fg-2 bg-fg-1 px-5 py-4 font-mono text-small tracking-eyebrow uppercase text-fg-8 transition-colors hover:border-accent-lime hover:text-accent-lime"
      >
        <span className="flex items-center gap-2">
          <FolderOpen size={16} aria-hidden /> {tActions("myWorks")}
        </span>
        <span className="font-display text-h4 font-bold">{publishedCount}</span>
      </button>
      <button
        type="button"
        className="flex items-center justify-between border border-fg-2 bg-fg-1 px-5 py-4 font-mono text-small tracking-eyebrow uppercase text-fg-8 transition-colors hover:border-accent-lime hover:text-accent-lime"
      >
        <span className="flex items-center gap-2">
          <ClipboardList size={16} aria-hidden /> {tActions("orders")}
        </span>
        <span className="font-display text-h4 font-bold">3</span>
      </button>
    </div>
  );
}
