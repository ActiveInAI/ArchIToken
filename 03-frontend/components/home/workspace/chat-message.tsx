"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { ChatMessage } from "@/lib/insome/types";
import { cn } from "@/lib/insome/ui";
import { chatMessageEnter } from "@/lib/motion-presets";

export interface ChatMessageBubbleProps {
  readonly message: ChatMessage;
  readonly onRegenerate?: (messageId: string) => void;
}

export function ChatMessageBubble({ message, onRegenerate }: ChatMessageBubbleProps) {
  const t = useTranslations("home.workspace.chat");
  const isUser = message.role === "user";

  return (
    <motion.div
      {...chatMessageEnter}
      className={cn("flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}
    >
      <div
        className={cn(
          "max-w-[82%] px-3 py-2 text-small leading-snug",
          isUser ? "bg-fg-0 text-fg-9" : "bg-fg-7 text-fg-0",
        )}
        // Content may contain <mark> highlights from translated scripted messages.
        // The translator pipeline is the only source of this HTML (no user-provided content).
        dangerouslySetInnerHTML={{ __html: message.content }}
      />
      {message.patch && onRegenerate ? (
        <button
          type="button"
          onClick={() => onRegenerate(message.id)}
          className="mt-1 border border-fg-6 bg-fg-8 px-2.5 py-1 font-mono text-micro tracking-eyebrow uppercase text-fg-0 transition-colors hover:bg-fg-0 hover:text-fg-9"
        >
          {t("regenerate")}
        </button>
      ) : null}
    </motion.div>
  );
}
