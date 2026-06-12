// components/PanAIWorkbenchBridge.tsx - controlled ArchIToken/PanAI chat bridge
// License: Apache-2.0
/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  Box,
  CheckCircle2,
  FileCode2,
  Image as ImageIcon,
  Route,
  Send,
  Sparkles,
  Video,
} from "lucide-react";
import { ArchLoadingFlow } from "@/components/ArchLoadingFlow";
import {
  buildPanAIWorkbenchCapabilities,
  createPanAIMessage,
  invokePanAIWorkbenchChat,
  type PanAIAuditSummary,
  type PanAIChatArtifact,
  type PanAIChatMessage,
  type PanAIWorkbenchAction,
  type PanAIWorkbenchChatRequest,
} from "@/lib/panai-workbench-chat";
import type { ModuleId } from "@/lib/module-registry";

export function PanAIWorkbenchBridge({
  moduleId,
  moduleName,
  selectedFeatureTitle,
  auditEvents = [],
}: {
  moduleId: ModuleId;
  moduleName: string;
  selectedFeatureTitle?: string;
  auditEvents?: PanAIAuditSummary[];
}) {
  const router = useRouter();
  const capabilities = useMemo(
    () => buildPanAIWorkbenchCapabilities(moduleId),
    [moduleId],
  );
  const [messages, setMessages] = useState<PanAIChatMessage[]>(() => [
    createPanAIMessage("assistant", "您好，我是ArchIT，请问如何帮助您？"),
  ]);
  const [input, setInput] = useState("");
  const [activeCapabilityId, setActiveCapabilityId] = useState<
    string | undefined
  >();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quickCapabilities = capabilities.filter((capability) =>
    [
      "panai:cad-worker",
      "panai:hf-image",
      "panai:hf-video",
      "panai:platform-orchestrator",
    ].includes(capability.id),
  );

  function executeWorkbenchActions(actions?: PanAIWorkbenchAction[]) {
    if (!actions?.length) return;

    for (const action of actions) {
      if (action.type === "navigate_module" && typeof window !== "undefined") {
        window.setTimeout(() => {
          if (window.location.pathname !== action.href) {
            router.push(action.href);
          }
        }, 80);
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendContent(input.trim());
  }

  async function sendContent(content: string) {
    if (!content || busy) return;

    const userMessage = createPanAIMessage("user", content);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const chatRequest: PanAIWorkbenchChatRequest = {
        moduleId,
        moduleName,
        messages: nextMessages,
        capabilities,
        auditEvents,
      };
      if (selectedFeatureTitle) {
        chatRequest.selectedFeatureTitle = selectedFeatureTitle;
      }
      if (activeCapabilityId) {
        chatRequest.activeCapabilityId = activeCapabilityId;
      }
      const response = await invokePanAIWorkbenchChat(chatRequest);
      setMessages([...nextMessages, response.message]);
      executeWorkbenchActions(response.actions);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setMessages([
        ...nextMessages,
        createPanAIMessage("assistant", "真实路由执行失败，未生成假结果。", {
          route: "WorkbenchBridge -> PanAIRouter blocked",
          artifacts: [
            {
              id: `bridge-error-${Date.now()}`,
              kind: "audit_note",
              title: "阻断原因",
              content: message,
              status: "blocked",
            },
          ],
        }),
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-[440px] flex-col bg-[var(--arch-surface)] text-[var(--arch-text)]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--arch-border)] bg-[var(--arch-surface-muted)] px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {quickCapabilities.map((capability) => (
            <button
              key={capability.id}
              type="button"
              onClick={() =>
                setActiveCapabilityId((current) =>
                  current === capability.id ? undefined : capability.id,
                )
              }
              className={`arch-btn-secondary h-8 px-3 arch-type-caption ${activeCapabilityId === capability.id ? "is-active border-[var(--arch-primary)] text-[var(--arch-primary)]" : ""}`}
              title={capability.description}
            >
              {capabilityIcon(capability.id)}
              <span className="ml-1.5">{capability.label}</span>
            </button>
          ))}
        </div>
        <div className="arch-muted flex shrink-0 items-center gap-2 arch-type-caption">
          <Route className="h-4 w-4" />
          <span>HF / 本地 worker 优先</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onQuickAction={(content) => void sendContent(content)}
            />
          ))}
          {busy ? (
            <div className="arch-muted flex items-center gap-2 arch-type-body">
              <ArchLoadingFlow label="路由执行中" size="compact" />
              <span>路由执行中</span>
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mx-6 mb-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 arch-type-caption">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="whitespace-pre-wrap">{error}</span>
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-[var(--arch-border)] bg-[var(--arch-surface)] p-4"
      >
        <div className="mx-auto flex max-w-5xl items-end gap-3 rounded-lg border border-[var(--arch-border)] bg-[var(--arch-bg)] px-3 py-2 shadow-sm">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            className="min-h-10 max-h-32 flex-1 resize-none bg-transparent py-2 arch-type-body leading-6 outline-none placeholder:text-[var(--arch-muted)]"
            placeholder="请输入需求，例如：进入市场客服模块、生成WBS预警、生成方案配图"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="arch-btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="发送"
            title="发送"
          >
            {busy ? (
              <ArchLoadingFlow label="发送中" size="inline" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({
  message,
  onQuickAction,
}: {
  message: PanAIChatMessage;
  onQuickAction?: ((content: string) => void) | undefined;
}) {
  const isUser = message.role === "user";
  const mediaPreviews = isUser
    ? []
    : extractMessageMediaPreviews(message.content);
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-2`}
      >
        <div
          className={`rounded-lg px-4 py-3 arch-type-body leading-6 shadow-sm ${isUser ? "bg-[var(--arch-primary)] text-white" : "arch-huly-row"}`}
        >
          <MessageContent content={message.content} isUser={isUser} />
        </div>
        {mediaPreviews.length ? (
          <MediaPreviewGrid previews={mediaPreviews} />
        ) : null}
        {message.route ? (
          <div className="arch-muted flex items-center gap-1.5 arch-type-caption">
            <Route className="h-3.5 w-3.5" />
            <span>{message.route}</span>
          </div>
        ) : null}
        {message.artifacts?.length ? (
          <ArtifactList artifacts={message.artifacts} onQuickAction={onQuickAction} />
        ) : null}
      </div>
    </div>
  );
}

function MessageContent({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  const displayContent = isUser ? content : stripPreviewOnlyMediaLines(content);
  return <div className="whitespace-pre-wrap">{displayContent || content}</div>;
}

function ArtifactList({
  artifacts,
  onQuickAction,
}: {
  artifacts: PanAIChatArtifact[];
  onQuickAction?: ((content: string) => void) | undefined;
}) {
  return (
    <div className="grid w-full gap-2">
      {artifacts.map((artifact) => (
        <div key={artifact.id} className="arch-huly-row rounded-md border p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {artifactIcon(artifact)}
              <div className="min-w-0">
                <p className="arch-text truncate arch-type-body font-medium">
                  {artifact.title}
                </p>
                <p className="arch-muted mt-0.5 arch-type-caption">
                  {artifact.kind}
                </p>
              </div>
            </div>
            <ArtifactStatus artifact={artifact} />
          </div>
          <FloorplanSuitePanel artifact={artifact} onQuickAction={onQuickAction} />
          {artifact.content && !isFloorplanSummaryArtifact(artifact) ? (
            <pre className="arch-huly-row-muted mt-3 max-h-48 overflow-auto rounded-md p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap">
              {artifact.content}
            </pre>
          ) : null}
          {artifact.href && artifactIsImage(artifact) ? (
            <a
              className="mt-3 block overflow-hidden rounded-md border border-[var(--arch-border)] bg-[var(--arch-bg)]"
              href={artifact.href}
              target="_blank"
              rel="noreferrer"
              title="打开原图"
            >
              <img
                src={artifact.href}
                alt={artifact.title}
                className="max-h-80 w-full object-contain"
                loading="lazy"
              />
            </a>
          ) : null}
          {artifact.href && artifact.mediaKind === "video" ? (
            <video
              className="mt-3 max-h-80 w-full rounded-md border border-[var(--arch-border)] bg-black"
              controls
              src={artifact.href}
            />
          ) : null}
          {artifact.href ? (
            <a
              className="arch-primary-text mt-2 inline-block arch-type-caption font-medium"
              href={artifact.href}
              target="_blank"
              rel="noreferrer"
            >
              {artifact.mediaKind === "image"
                ? "打开原图"
                : artifact.mediaKind === "video"
                  ? "打开视频"
                  : "打开 artifact"}
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}

interface FloorplanSummaryPayload {
  intent?: string;
  prompt?: string;
  candidate?: string;
  candidateId?: string;
  score?: number;
  candidates?: Array<{ id: string; title: string; score: number }>;
  compliance?: { passed?: boolean; error?: number; warning?: number };
}

// 与 lib/architoken/floorplan-control-image.ts 的 RENDER_STYLE_PRESETS 关键词保持一致
//（该模块依赖 node:zlib，不能进客户端包，此处仅列预设名）。
const RENDER_STYLE_NAMES = [
  "现代简约",
  "新中式",
  "北欧",
  "工业风",
  "奶油风",
  "轻奢",
  "日式",
];

const CANDIDATE_SELECTION_LABEL: Record<string, string> = {
  "generate-a": "候选A",
  "generate-b": "候选B",
  "fit-c": "候选C",
  "furnish-d": "候选D",
};

function parseFloorplanSummary(
  artifact: PanAIChatArtifact,
): FloorplanSummaryPayload | null {
  if (artifact.kind !== "floorplan_suite" || !artifact.content) return null;
  try {
    const parsed = JSON.parse(artifact.content) as FloorplanSummaryPayload;
    return Array.isArray(parsed.candidates) && parsed.prompt ? parsed : null;
  } catch {
    return null;
  }
}

function isFloorplanSummaryArtifact(artifact: PanAIChatArtifact): boolean {
  return parseFloorplanSummary(artifact) !== null;
}

/** 户型套件交互面板：候选切换 + 风格渲染，点选即重发完整意图。 */
function FloorplanSuitePanel({
  artifact,
  onQuickAction,
}: {
  artifact: PanAIChatArtifact;
  onQuickAction?: ((content: string) => void) | undefined;
}) {
  const summary = parseFloorplanSummary(artifact);
  if (!summary || !onQuickAction) return null;
  const basePrompt = (summary.prompt ?? "")
    .replace(/[，,]?\s*(候选|方案)\s*[ABCD]/gi, "")
    .trim();
  // 重发渲染指令前剥离旧风格词，避免与新选的预设冲突（预设按列表序匹配）。
  const styleFreePrompt = basePrompt
    .replace(
      /[，,]?\s*(现代简约|新中式|中式|北欧|工业风|奶油风|轻奢|日式|侘寂|现代|简约)\s*风格?/g,
      "",
    )
    .replace(/[，,]?\s*户型效果图/g, "")
    .trim();
  return (
    <div className="mt-3 grid gap-3">
      <div className="arch-huly-row-muted rounded-md p-3">
        <p className="arch-muted mb-2 arch-type-caption">
          意图 {summary.intent} · 当前 {summary.candidate}（{summary.score} 分）
          {summary.compliance
            ? summary.compliance.passed
              ? " · 规范预检通过"
              : ` · 预检 ${summary.compliance.error ?? 0} 错误/${summary.compliance.warning ?? 0} 警告`
            : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {(summary.candidates ?? []).map((candidate) => {
            const active = candidate.id === summary.candidateId;
            const label = CANDIDATE_SELECTION_LABEL[candidate.id];
            return (
              <button
                key={candidate.id}
                type="button"
                disabled={active || !label}
                onClick={() =>
                  label && onQuickAction(`${basePrompt}，${label}`)
                }
                className={`arch-btn-secondary h-7 px-2.5 arch-type-caption ${active ? "is-active border-[var(--arch-primary)] text-[var(--arch-primary)]" : ""}`}
                title={active ? "当前候选" : `切换到 ${candidate.title} 重新生成`}
              >
                {candidate.title}（{candidate.score}）
              </button>
            );
          })}
        </div>
      </div>
      <div className="arch-huly-row-muted rounded-md p-3">
        <p className="arch-muted mb-2 arch-type-caption">
          按布局真源出效果图（ControlNet 受控，墙体不漂移）
        </p>
        <div className="flex flex-wrap gap-2">
          {RENDER_STYLE_NAMES.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() =>
                onQuickAction(`${styleFreePrompt}，户型效果图，${style}风格`)
              }
              className="arch-btn-secondary h-7 px-2.5 arch-type-caption"
              title={`生成${style}风格的布局受控效果图`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ArtifactStatus({ artifact }: { artifact: PanAIChatArtifact }) {
  if (artifact.status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 arch-type-caption">
        <CheckCircle2 className="h-3.5 w-3.5" />
        ready
      </span>
    );
  }
  if (artifact.status === "blocked") {
    return (
      <span className="inline-flex items-center gap-1 text-red-600 arch-type-caption">
        <AlertTriangle className="h-3.5 w-3.5" />
        blocked
      </span>
    );
  }
  return (
    <span className="arch-muted arch-type-caption">{artifact.status}</span>
  );
}

function artifactIcon(artifact: PanAIChatArtifact) {
  if (artifact.kind === "image_prompt" || artifact.kind === "generation_job")
    return <ImageIcon className="h-4 w-4 text-[var(--arch-primary)]" />;
  if (artifact.kind === "video_prompt")
    return <Video className="h-4 w-4 text-[var(--arch-primary)]" />;
  if (artifact.kind === "cad_geometry" || artifact.kind === "cad_mesh")
    return <Box className="h-4 w-4 text-[var(--arch-primary)]" />;
  if (artifact.kind === "source_script")
    return <FileCode2 className="h-4 w-4 text-[var(--arch-primary)]" />;
  return <Sparkles className="h-4 w-4 text-[var(--arch-primary)]" />;
}

function capabilityIcon(id: string) {
  if (id.includes("cad-worker")) return <Box className="inline h-4 w-4" />;
  if (id.includes("hf-image")) return <ImageIcon className="inline h-4 w-4" />;
  if (id.includes("hf-video")) return <Video className="inline h-4 w-4" />;
  return <Bot className="inline h-4 w-4" />;
}

type MediaPreview = {
  url: string;
  label: string;
};

const markdownImagePattern = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi;
const imageUrlPattern =
  /https?:\/\/[^\s<>)]+(?:\.png|\.jpe?g|\.webp|\.gif)(?:\?[^\s<>)]+)?/gi;
const previewOnlyLinkLinePattern =
  /^(?:下载链接|图片链接|图像链接|生成图片|生成图像)\s*[:：]\s*https?:\/\/[^\s<>)]+(?:\.png|\.jpe?g|\.webp|\.gif)(?:\?[^\s<>)]+)?\s*$/i;

function extractMessageMediaPreviews(content: string): MediaPreview[] {
  const previews: MediaPreview[] = [];
  const seen = new Set<string>();

  for (const match of content.matchAll(markdownImagePattern)) {
    const label = match[1]?.trim() || "生成图像";
    const url = match[2];
    if (url && !seen.has(url)) {
      seen.add(url);
      previews.push({ url, label });
    }
  }

  for (const match of content.matchAll(imageUrlPattern)) {
    const url = match[0];
    if (url && !seen.has(url)) {
      seen.add(url);
      previews.push({ url, label: "生成图像" });
    }
  }

  return previews;
}

function stripPreviewOnlyMediaLines(content: string) {
  return content
    .replace(markdownImagePattern, "")
    .split("\n")
    .filter((line) => !previewOnlyLinkLinePattern.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function MediaPreviewGrid({ previews }: { previews: MediaPreview[] }) {
  return (
    <div className="grid w-full gap-2">
      {previews.map((preview) => (
        <a
          key={preview.url}
          href={preview.url}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-lg border border-[var(--arch-border)] bg-[var(--arch-bg)] shadow-sm"
          title="打开原图"
        >
          <img
            src={preview.url}
            alt={preview.label}
            className="max-h-[420px] w-full object-contain"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}

function artifactIsImage(artifact: PanAIChatArtifact) {
  if (artifact.mediaKind === "image") return true;
  if (artifact.mimeType?.startsWith("image/")) return true;
  if (artifact.kind === "generation_job" && artifact.title.includes("图像")) {
    return true;
  }
  return Boolean(artifact.href && isImageUrl(artifact.href));
}

function isImageUrl(url: string) {
  return /\.(png|jpe?g|webp|gif)(?:$|\?)/i.test(url);
}
