"use client";

/**
 * LEGACY(phase-4.0.3): AskAiButton was the top-bar dialog form of "Ask AI".
 * Phase 4.0.3 moved chat into the editor left-pane as an always-docked section
 * (see `left-pane/ai-chat-section.tsx`). This file is kept for archival —
 * no longer imported anywhere; safe to delete in a later phase.
 */

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { StudioChatPanel } from "./studio-chat-panel";

export function AskAiButton() {
  const t = useTranslations("studio.askAi");
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="border border-fg-2 bg-fg-0 px-3 py-1.5 font-mono text-micro tracking-eyebrow uppercase text-fg-4 transition-colors hover:border-accent-lime hover:text-accent-lime"
        >
          ✦ {t("trigger")}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-fg-9/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed right-4 top-16 z-50 flex h-[min(72vh,640px)] w-[min(420px,92vw)] flex-col border border-fg-2 bg-fg-0 shadow-xl">
          <div className="flex items-center justify-between border-b border-fg-2 px-4 py-3">
            <Dialog.Title className="font-display text-h4 font-bold tracking-tight text-fg-8">
              {t("title")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="font-mono text-micro tracking-eyebrow uppercase text-fg-4 hover:text-fg-8"
              >
                ×
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t("description")}</Dialog.Description>
          <div className="flex-1 overflow-hidden">
            <StudioChatPanel />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
