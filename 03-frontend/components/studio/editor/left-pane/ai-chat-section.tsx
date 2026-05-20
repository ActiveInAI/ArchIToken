"use client";

import { useTranslations } from "next-intl";
import { StudioChatPanel } from "../studio-chat-panel";

export function AiChatSection() {
  const t = useTranslations("studio.editor.leftPane");
  return (
    <div
      data-testid="left-pane-chat"
      className="flex h-full flex-col overflow-hidden border-t border-fg-2"
    >
      <div className="shrink-0 border-b border-fg-2 px-4 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4">
        {t("aiTitle")}
      </div>
      <div className="flex-1 overflow-hidden">
        <StudioChatPanel />
      </div>
    </div>
  );
}
