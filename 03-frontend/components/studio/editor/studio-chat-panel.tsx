"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";
import type { ChatMessage } from "@/lib/insome/types";
import { ScriptedChatProvider } from "@/lib/chat";
import { HOME_OFF_SCRIPT_REPLY_KEY, homeChatScript } from "@/content/chat-script.home";
import { HOME_VARIANT_IDS } from "@/content/floorplan-variants.home";
import { ChatMessageBubble } from "@/components/home/workspace/chat-message";

/**
 * Studio in-editor "Ask AI" chat — reuses ScriptedChatProvider with Home script.
 * Side effects are no-op in Studio context (activeFloorplan is managed by the
 * Proposal flow). Phase 4.1 will replace with LLM-backed StudioChatProvider.
 */
export function StudioChatPanel() {
  const t = useTranslations("studio.askAi");
  const tMsg = useTranslations();
  const provider = useMemo(
    () =>
      new ScriptedChatProvider({
        script: homeChatScript,
        variantIds: HOME_VARIANT_IDS,
        translator: (key) => tMsg(key),
        offScriptReplyKey: HOME_OFF_SCRIPT_REPLY_KEY,
      }),
    [tMsg],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (sending) return;
    const value = input;
    setInput("");
    setSending(true);
    try {
      for await (const event of provider.send(value)) {
        if (event.kind === "user-echo" || event.kind === "assistant-message") {
          setMessages((prev) => [...prev, event.message]);
        }
      }
    } finally {
      setSending(false);
    }
  }, [input, provider, sending]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col bg-fg-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="p-4 font-mono text-micro text-fg-4">{t("hint")}</div>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <ChatMessageBubble key={m.id} message={m} onRegenerate={() => {}} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      <div className="border-t border-fg-2 bg-fg-1 p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={t("placeholder")}
          rows={2}
          className="w-full resize-none border border-fg-2 bg-fg-0 p-2 font-sans text-small text-fg-8 placeholder:text-fg-4 focus:border-accent-lime focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-end">
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending}
            className="border border-accent-lime bg-accent-lime px-3 py-1.5 font-mono text-micro tracking-eyebrow uppercase text-fg-0 transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {t("send")} ↵
          </button>
        </div>
      </div>
    </div>
  );
}
