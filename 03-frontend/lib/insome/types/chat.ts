export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  readonly id: string;
  readonly role: ChatRole;
  readonly content: string;
  readonly timestamp: number;
  readonly patch?: boolean;
}

export type ChatSideEffectType = "switchVariant" | "switchCanvas" | "none";

export type CanvasMode = "chart" | "render";

export interface ChatSideEffect {
  readonly type: ChatSideEffectType;
  readonly variantId?: string;
  readonly canvasMode?: CanvasMode;
}
