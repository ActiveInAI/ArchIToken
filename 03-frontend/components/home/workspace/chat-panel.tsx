"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";
import type { ChatMessage } from "@/lib/insome/types";
import { useChatProvider } from "@/lib/chat";
import { useFloorplanStore } from "@/stores/floorplan.store";
import { ChatMessageBubble } from "./chat-message";

export function ChatPanel() {
  const t = useTranslations("home.workspace.chat");
  const provider = useChatProvider();
  const setGenerating = useFloorplanStore((s) => s.setGenerating);
  const setVariant = useFloorplanStore((s) => s.setVariant);
  const setCanvasMode = useFloorplanStore((s) => s.setCanvasMode);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [hasScripted, setHasScripted] = useState(() => provider.hasScriptedContent());
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
        if (event.kind === "generating-start") setGenerating(true);
        else if (event.kind === "generating-end") setGenerating(false);
        else if (event.kind === "user-echo" || event.kind === "assistant-message") {
          setMessages((prev) => [...prev, event.message]);
        } else if (event.kind === "side-effect") {
          const se = event.sideEffect;
          if (se.type === "switchVariant" && se.variantId) setVariant(se.variantId);
          if (se.type === "switchCanvas" && se.canvasMode) setCanvasMode(se.canvasMode);
        }
      }
    } finally {
      setSending(false);
      setHasScripted(provider.hasScriptedContent());
    }
  }, [input, provider, sending, setGenerating, setVariant, setCanvasMode]);

  const handleReset = useCallback(() => {
    provider.reset();
    setMessages([]);
    setHasScripted(provider.hasScriptedContent());
    setGenerating(false);
  }, [provider, setGenerating]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const placeholderKey = hasScripted ? "placeholderDemo" : "placeholderFree";

  return (
    <div className="flex h-full flex-col bg-fg-8">
      <div className="flex items-center justify-between border-b border-fg-6 px-4 py-3">
        <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-3">
          {t("header")}
        </span>
        <button
          type="button"
          onClick={handleReset}
          className="font-mono text-micro tracking-eyebrow uppercase text-fg-3 transition-colors hover:text-fg-0"
        >
          ↻ {t("reset")}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <ChatMessageBubble key={m.id} message={m} onRegenerate={handleReset} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="border-t border-fg-6 bg-fg-9 p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={t(placeholderKey)}
          rows={2}
          className="w-full resize-none border border-fg-6 bg-fg-8 p-2.5 font-sans text-small text-fg-0 placeholder:text-fg-4 focus:border-fg-0 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending}
            className="border border-fg-0 bg-fg-0 px-3.5 py-1.5 font-mono text-micro tracking-eyebrow uppercase text-fg-9 transition-colors hover:bg-fg-2 disabled:opacity-60"
          >
            {t("send")} ↵
          </button>
        </div>
      </div>
    </div>
  );
}
