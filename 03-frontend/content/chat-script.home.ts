import type { ChatScriptStep } from "@/lib/chat";

/**
 * TODO(phase-4): replace with LLM-driven provider; this scripted script stays as
 * demo/E2E fallback. 9 steps reproduce the prototype's CHAT_SCRIPT beat-for-beat,
 * including the wait+variant+patch+canvas-switch side effects on steps 2 / 4 / 8.
 */
export const homeChatScript: ReadonlyArray<ChatScriptStep> = [
  { role: "assistant", contentKey: "chat.home.scripted.step0" },
  { role: "user", contentKey: "chat.home.scripted.step1" },
  {
    role: "assistant",
    contentKey: "chat.home.scripted.step2",
    wait: 1800,
    triggerVariantId: "v1",
  },
  { role: "user", contentKey: "chat.home.scripted.step3" },
  {
    role: "assistant",
    contentKey: "chat.home.scripted.step4",
    wait: 1500,
    triggerVariantId: "v3",
    patch: true,
  },
  { role: "user", contentKey: "chat.home.scripted.step5" },
  { role: "assistant", contentKey: "chat.home.scripted.step6" },
  { role: "user", contentKey: "chat.home.scripted.step7" },
  {
    role: "assistant",
    contentKey: "chat.home.scripted.step8",
    triggerCanvasMode: "render",
  },
];

export const HOME_OFF_SCRIPT_REPLY_KEY = "chat.home.offScriptReply";
