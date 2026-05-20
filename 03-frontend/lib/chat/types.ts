import type { CanvasMode, ChatMessage, ChatRole, ChatSideEffect } from "@/lib/insome/types";

export type ChatEvent =
  | { readonly kind: "user-echo"; readonly message: ChatMessage }
  | { readonly kind: "generating-start" }
  | { readonly kind: "generating-end" }
  | { readonly kind: "assistant-message"; readonly message: ChatMessage }
  | { readonly kind: "side-effect"; readonly sideEffect: ChatSideEffect };

export interface ChatProvider {
  /** Invoke with the current user input (empty string to advance scripted demo). */
  send(input: string): AsyncIterable<ChatEvent>;
  /** Does the provider still have scripted content left? UI can hint ("press Send to advance"). */
  hasScriptedContent(): boolean;
  /** Reset to initial state — prompt for Chat reset button. */
  reset(): void;
}

export interface ChatScriptStep {
  readonly role: ChatRole;
  readonly contentKey: string;
  readonly wait?: number;
  readonly triggerVariantId?: string;
  readonly triggerCanvasMode?: CanvasMode;
  readonly patch?: boolean;
}
