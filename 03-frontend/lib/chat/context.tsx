"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ChatProvider } from "./types";

const ChatProviderContext = createContext<ChatProvider | null>(null);

export interface ChatProviderScopeProps {
  readonly value: ChatProvider;
  readonly children: ReactNode;
}

export function ChatProviderScope({ value, children }: ChatProviderScopeProps) {
  return <ChatProviderContext.Provider value={value}>{children}</ChatProviderContext.Provider>;
}

export function useChatProvider(): ChatProvider {
  const provider = useContext(ChatProviderContext);
  if (!provider) {
    throw new Error("useChatProvider must be used within <ChatProviderScope>");
  }
  return provider;
}
