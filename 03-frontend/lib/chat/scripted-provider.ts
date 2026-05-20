import { nanoid } from "nanoid";
import type { ChatMessage } from "@/lib/insome/types";
import type { ChatEvent, ChatProvider, ChatScriptStep } from "./types";

const FREE_TEXT_WAIT_MS = 1600;
const INTER_PAIR_PAUSE_MS = 600;

export interface ScriptedChatProviderConfig {
  readonly script: ReadonlyArray<ChatScriptStep>;
  readonly variantIds: ReadonlyArray<string>;
  readonly translator: (key: string) => string;
  readonly offScriptReplyKey: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class ScriptedChatProvider implements ChatProvider {
  private stepIndex = 0;
  private cycleIndex = 0;

  constructor(private readonly config: ScriptedChatProviderConfig) {}

  hasScriptedContent(): boolean {
    return this.stepIndex < this.config.script.length;
  }

  reset(): void {
    this.stepIndex = 0;
    this.cycleIndex = 0;
  }

  async *send(input: string): AsyncIterable<ChatEvent> {
    const trimmed = input.trim();

    if (!trimmed && this.hasScriptedContent()) {
      yield* this.advanceScriptedPair();
      return;
    }

    if (trimmed) {
      yield* this.handleFreeText(trimmed);
    }
  }

  private async *advanceScriptedPair(): AsyncIterable<ChatEvent> {
    for (let emitted = 0; emitted < 2 && this.hasScriptedContent(); emitted++) {
      const step = this.config.script[this.stepIndex];
      if (!step) break;
      this.stepIndex += 1;

      if (step.wait && step.wait > 0) {
        yield { kind: "generating-start" };
        await sleep(step.wait);
        yield { kind: "generating-end" };
      }

      const message = this.buildMessage(step.role, this.config.translator(step.contentKey), step.patch);
      if (step.role === "user") {
        yield { kind: "user-echo", message };
      } else {
        yield { kind: "assistant-message", message };
      }

      if (step.triggerVariantId) {
        yield {
          kind: "side-effect",
          sideEffect: { type: "switchVariant", variantId: step.triggerVariantId },
        };
      }
      if (step.triggerCanvasMode) {
        yield {
          kind: "side-effect",
          sideEffect: { type: "switchCanvas", canvasMode: step.triggerCanvasMode },
        };
      }

      if (emitted === 0 && this.hasScriptedContent()) {
        await sleep(INTER_PAIR_PAUSE_MS);
      }
    }
  }

  private async *handleFreeText(text: string): AsyncIterable<ChatEvent> {
    yield {
      kind: "user-echo",
      message: this.buildMessage("user", text),
    };
    yield { kind: "generating-start" };
    await sleep(FREE_TEXT_WAIT_MS);
    yield { kind: "generating-end" };
    yield {
      kind: "assistant-message",
      message: this.buildMessage("assistant", this.config.translator(this.config.offScriptReplyKey)),
    };

    const variantId = this.cycleNextVariant();
    if (variantId) {
      yield {
        kind: "side-effect",
        sideEffect: { type: "switchVariant", variantId },
      };
    }
  }

  private cycleNextVariant(): string | undefined {
    const { variantIds } = this.config;
    if (variantIds.length === 0) return undefined;
    this.cycleIndex = (this.cycleIndex + 1) % variantIds.length;
    return variantIds[this.cycleIndex];
  }

  private buildMessage(role: ChatMessage["role"], content: string, patch?: boolean): ChatMessage {
    return {
      id: nanoid(10),
      role,
      content,
      timestamp: Date.now(),
      ...(patch ? { patch: true } : {}),
    };
  }
}
