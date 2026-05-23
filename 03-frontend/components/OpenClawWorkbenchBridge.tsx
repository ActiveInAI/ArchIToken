// components/OpenClawWorkbenchBridge.tsx - controlled ArchIToken/OpenClaw chat bridge
// License: Apache-2.0
'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bot,
  Box,
  CheckCircle2,
  FileCode2,
  Image as ImageIcon,
  Loader2,
  Route,
  Send,
  Sparkles,
  Video,
} from 'lucide-react';
import {
  buildOpenClawWorkbenchCapabilities,
  createOpenClawMessage,
  invokeOpenClawWorkbenchChat,
  type OpenClawAuditSummary,
  type OpenClawChatArtifact,
  type OpenClawChatMessage,
  type OpenClawWorkbenchAction,
  type OpenClawWorkbenchChatRequest,
} from '@/lib/openclaw-workbench-chat';
import type { ModuleId } from '@/lib/module-registry';

export function OpenClawWorkbenchBridge({
  moduleId,
  moduleName,
  selectedFeatureTitle,
  auditEvents = [],
}: {
  moduleId: ModuleId;
  moduleName: string;
  selectedFeatureTitle?: string;
  auditEvents?: OpenClawAuditSummary[];
}) {
  const router = useRouter();
  const capabilities = useMemo(() => buildOpenClawWorkbenchCapabilities(moduleId), [moduleId]);
  const [messages, setMessages] = useState<OpenClawChatMessage[]>(() => [
    createOpenClawMessage('assistant', '您好，我是ArchIT，请问如何帮助您？'),
  ]);
  const [input, setInput] = useState('');
  const [activeCapabilityId, setActiveCapabilityId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quickCapabilities = capabilities.filter((capability) =>
    ['openclaw:cad-worker', 'openclaw:hf-image', 'openclaw:hf-video', 'openclaw:platform-orchestrator'].includes(capability.id),
  );

  function executeWorkbenchActions(actions?: OpenClawWorkbenchAction[]) {
    if (!actions?.length) return;

    for (const action of actions) {
      if (action.type === 'navigate_module' && typeof window !== 'undefined') {
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
    const content = input.trim();
    if (!content || busy) return;

    const userMessage = createOpenClawMessage('user', content);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setBusy(true);
    setError(null);

    try {
      const chatRequest: OpenClawWorkbenchChatRequest = {
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
      const response = await invokeOpenClawWorkbenchChat(chatRequest);
      setMessages([...nextMessages, response.message]);
      executeWorkbenchActions(response.actions);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setMessages([
        ...nextMessages,
        createOpenClawMessage('assistant', '真实路由执行失败，未生成假结果。', {
          route: 'WorkbenchBridge -> OpenClawRouter blocked',
          artifacts: [
            {
              id: `bridge-error-${Date.now()}`,
              kind: 'audit_note',
              title: '阻断原因',
              content: message,
              status: 'blocked',
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
              onClick={() => setActiveCapabilityId((current) => current === capability.id ? undefined : capability.id)}
              className={`arch-btn-secondary h-8 px-3 arch-type-caption ${activeCapabilityId === capability.id ? 'is-active border-[var(--arch-primary)] text-[var(--arch-primary)]' : ''}`}
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
            <MessageBubble key={message.id} message={message} />
          ))}
          {busy ? (
            <div className="arch-muted flex items-center gap-2 arch-type-body">
              <Loader2 className="h-4 w-4 animate-spin" />
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

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-[var(--arch-border)] bg-[var(--arch-surface)] p-4">
        <div className="mx-auto flex max-w-5xl items-end gap-3 rounded-lg border border-[var(--arch-border)] bg-[var(--arch-bg)] px-3 py-2 shadow-sm">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
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
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: OpenClawChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[78%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
        <div className={`rounded-lg px-4 py-3 arch-type-body leading-6 shadow-sm ${isUser ? 'bg-[var(--arch-primary)] text-white' : 'arch-huly-row'}`}>
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
        {message.route ? (
          <div className="arch-muted flex items-center gap-1.5 arch-type-caption">
            <Route className="h-3.5 w-3.5" />
            <span>{message.route}</span>
          </div>
        ) : null}
        {message.artifacts?.length ? <ArtifactList artifacts={message.artifacts} /> : null}
      </div>
    </div>
  );
}

function ArtifactList({ artifacts }: { artifacts: OpenClawChatArtifact[] }) {
  return (
    <div className="grid w-full gap-2">
      {artifacts.map((artifact) => (
        <div key={artifact.id} className="arch-huly-row rounded-md border p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {artifactIcon(artifact)}
              <div className="min-w-0">
                <p className="arch-text truncate arch-type-body font-medium">{artifact.title}</p>
                <p className="arch-muted mt-0.5 arch-type-caption">{artifact.kind}</p>
              </div>
            </div>
            <ArtifactStatus artifact={artifact} />
          </div>
          {artifact.content ? (
            <pre className="arch-huly-row-muted mt-3 max-h-48 overflow-auto rounded-md p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap">
              {artifact.content}
            </pre>
          ) : null}
          {artifact.href ? (
            <a className="arch-primary-text mt-2 inline-block arch-type-caption font-medium" href={artifact.href} target="_blank" rel="noreferrer">
              打开 artifact
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ArtifactStatus({ artifact }: { artifact: OpenClawChatArtifact }) {
  if (artifact.status === 'ready') {
    return <span className="inline-flex items-center gap-1 text-green-600 arch-type-caption"><CheckCircle2 className="h-3.5 w-3.5" />ready</span>;
  }
  if (artifact.status === 'blocked') {
    return <span className="inline-flex items-center gap-1 text-red-600 arch-type-caption"><AlertTriangle className="h-3.5 w-3.5" />blocked</span>;
  }
  return <span className="arch-muted arch-type-caption">{artifact.status}</span>;
}

function artifactIcon(artifact: OpenClawChatArtifact) {
  if (artifact.kind === 'image_prompt' || artifact.kind === 'generation_job') return <ImageIcon className="h-4 w-4 text-[var(--arch-primary)]" />;
  if (artifact.kind === 'video_prompt') return <Video className="h-4 w-4 text-[var(--arch-primary)]" />;
  if (artifact.kind === 'cad_geometry' || artifact.kind === 'cad_mesh') return <Box className="h-4 w-4 text-[var(--arch-primary)]" />;
  if (artifact.kind === 'source_script') return <FileCode2 className="h-4 w-4 text-[var(--arch-primary)]" />;
  return <Sparkles className="h-4 w-4 text-[var(--arch-primary)]" />;
}

function capabilityIcon(id: string) {
  if (id.includes('cad-worker')) return <Box className="inline h-4 w-4" />;
  if (id.includes('hf-image')) return <ImageIcon className="inline h-4 w-4" />;
  if (id.includes('hf-video')) return <Video className="inline h-4 w-4" />;
  return <Bot className="inline h-4 w-4" />;
}
