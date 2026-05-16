// components/ModuleWorkbenchShell.tsx - ArchIToken operational module platform shell
// License: Apache-2.0
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  Bot,
  CheckCircle2,
  FolderTree,
  GitBranch,
  Menu,
  Network,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';
import { ModuleDetailWorkbench } from '@/components/ModuleDetailWorkbench';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import {
  architokenAssistantProfile,
  moduleAssistantSuggestions,
} from '@/lib/ai-assistant-profile';
import { createModuleAuditEvent } from '@/lib/module-actions';
import type { ModuleActionResult } from '@/lib/module-actions';
import { moduleBackendAdapter } from '@/lib/module-backend-adapter';
import {
  architokenOpenFileEventName,
  architokenPendingOpenFileKey,
  type ArchitokenOpenFileRequest,
} from '@/lib/module-dialog-events';
import type { ModuleFileNode } from '@/lib/module-file-system';
import {
  getModuleSpec,
  moduleSpecs,
  moduleStatusLabels,
  MODULE_TREE_GROUPS,
  type ModuleId,
} from '@/lib/module-registry';

export function ModuleWorkbenchShell({
  initialModuleId,
  initialRailExpanded = false,
}: {
  initialModuleId?: ModuleId;
  initialRailExpanded?: boolean;
}) {
  const fallbackModuleId = initialModuleId ?? 'construction_management';
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [railExpanded, setRailExpanded] = useState(initialRailExpanded);
  const [railWidth, setRailWidth] = useState(232);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(fallbackModuleId !== 'ai_center');
  const [selectedFeatureTitle, setSelectedFeatureTitle] = useState<string>('');

  function toggleModuleRail() {
    setRailExpanded((current) => {
      const next = !current;
      const serialized = String(next);
      document.cookie = `architoken.moduleRailExpanded=${serialized}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }
  const [auditEvents, setAuditEvents] = useState<ModuleActionResult['auditEvent'][]>([]);
  const selectedSpec = getModuleSpec(fallbackModuleId);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredModules = normalizedQuery
    ? moduleSpecs.filter((spec) =>
        [spec.id, spec.zhName, spec.enName, spec.summary, spec.track]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : moduleSpecs;
  const moduleById = new Map(moduleSpecs.map((spec) => [spec.id, spec] as const));

  function handleAudit(event: ModuleActionResult['auditEvent']) {
    setAuditEvents((current) => [event, ...current].slice(0, 12));
  }

  function startRailResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = railWidth;

    function handlePointerMove(moveEvent: PointerEvent) {
      setRailWidth(clampNumber(startWidth + moveEvent.clientX - startX, 196, 380));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }

  const shellGridStyle = {
    '--module-rail-template': railExpanded
      ? `${railWidth}px minmax(0,1fr)`
      : '72px minmax(0,1fr)',
  } as CSSProperties;

  return (
    <main className="arch-app h-screen w-screen overflow-hidden">
      <div
        className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[var(--module-rail-template)]"
        style={shellGridStyle}
      >
        <aside className="arch-surface relative flex min-h-0 flex-col border-b shadow-none lg:border-b-0 lg:border-r">
          <div className="arch-border flex h-14 shrink-0 items-center gap-2 border-b px-3">
            <button
              type="button"
              onClick={toggleModuleRail}
              className="arch-btn flex h-9 w-9 items-center justify-center rounded-md"
              aria-expanded={railExpanded}
              aria-label={railExpanded ? '收起模块目录' : '展开模块目录'}
            >
              <Menu className="h-5 w-5" />
            </button>
            {railExpanded ? (
              <div className="min-w-0">
                <h1 className="arch-text truncate text-base font-black">ArchIToken</h1>
                <p className="arch-primary-text font-mono text-[10px] uppercase tracking-[0.2em]">
                  module OS
                </p>
              </div>
            ) : null}
          </div>

          {railExpanded ? (
            <div className="arch-border border-b p-3">
              <label className="arch-input flex items-center gap-2 rounded-md px-3 py-2">
                <Search className="arch-muted h-4 w-4" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索模块"
                  className="arch-text w-full bg-transparent text-sm outline-none placeholder:opacity-60"
                />
              </label>
            </div>
          ) : null}

          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            {normalizedQuery ? (
              <div className="grid gap-1.5">
                {filteredModules.map((spec) => (
                  <ModuleNavItem
                    key={spec.id}
                    spec={spec}
                    selected={spec.id === selectedSpec.id}
                    railExpanded={railExpanded}
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-3">
                {MODULE_TREE_GROUPS.map((group) => (
                  <section key={group.id} className="space-y-1">
                    {railExpanded ? (
                      <p className="arch-muted px-2 pt-1 font-mono text-[10px] font-black uppercase tracking-[0.18em]">
                        {group.title}
                      </p>
                    ) : null}
                    <div className="grid gap-1.5">
                      {group.modules.map((moduleId) => {
                        const spec = moduleById.get(moduleId);
                        if (!spec) return null;
                        return (
                          <ModuleNavItem
                            key={spec.id}
                            spec={spec}
                            selected={spec.id === selectedSpec.id}
                            railExpanded={railExpanded}
                          />
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </nav>

          <div className="arch-border shrink-0 border-t p-2">
            {railExpanded ? (
              <div className="grid gap-2">
                <ThemeSwitcher />
                <button
                  type="button"
                  onClick={() => setInspectorOpen(true)}
                  className="arch-btn inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-black"
                >
                  <ShieldCheck className="h-4 w-4" />
                  审计
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setInspectorOpen(true)}
                className="arch-btn flex h-10 w-10 items-center justify-center rounded-md"
                aria-label="打开审计抽屉"
              >
                <ShieldCheck className="h-4 w-4" />
              </button>
            )}
          </div>
          {railExpanded ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="调整全局模块目录宽度"
              onPointerDown={startRailResize}
              className="absolute inset-y-0 right-[-4px] z-20 hidden w-2 cursor-ew-resize touch-none lg:block"
              title="拖动调整模块目录宽度"
            >
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition group-hover:bg-[var(--arch-primary)]" />
            </div>
          ) : null}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="arch-app min-h-0 flex-1 overflow-hidden p-3">
            <ModuleDetailWorkbench key={selectedSpec.id} spec={selectedSpec} onAudit={handleAudit} onFeatureSelect={setSelectedFeatureTitle} />
          </div>
        </section>
      </div>

      {inspectorOpen ? (
        <InspectorDrawer selectedSpec={selectedSpec} auditEvents={auditEvents} onClose={() => setInspectorOpen(false)} />
      ) : null}

      <WorkbenchIntelligenceDialog
        selectedSpec={selectedSpec}
        selectedFeatureTitle={selectedFeatureTitle}
        auditEvents={auditEvents}
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        onAudit={handleAudit}
        onNavigate={(href) => router.push(href)}
      />
    </main>
  );
}

function ModuleNavItem({
  spec,
  selected,
  railExpanded,
}: {
  spec: (typeof moduleSpecs)[number];
  selected: boolean;
  railExpanded: boolean;
}) {
  return (
    <Link
      href={spec.routeHref}
      prefetch={false}
      title={`${spec.zhName} · ${spec.id}`}
      className={`grid items-center gap-2 rounded-md border px-2 py-2 text-left transition ${
        railExpanded ? 'grid-cols-[34px_1fr]' : 'grid-cols-1 justify-items-center'
      } ${
        selected
          ? 'arch-card-selected'
          : 'border-transparent arch-surface-muted hover:border-[var(--arch-primary)] hover:bg-[var(--arch-primary-soft)] hover:text-[var(--arch-primary)]'
      }`}
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-black ${
        selected ? 'arch-btn-primary' : 'arch-primary-soft'
      }`}>
        {String(spec.order).padStart(2, '0')}
      </span>
      {railExpanded ? (
        <span className="min-w-0">
          <span className="block truncate text-sm font-black">{spec.zhName}</span>
          <span className="arch-muted mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.12em]">
            {spec.id}
          </span>
        </span>
      ) : null}
    </Link>
  );
}

function InspectorDrawer({
  selectedSpec,
  auditEvents,
  onClose,
}: {
  selectedSpec: ReturnType<typeof getModuleSpec>;
  auditEvents: ModuleActionResult['auditEvent'][];
  onClose: () => void;
}) {
  const [drawerWidth, setDrawerWidth] = useState(420);

  function startDrawerResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = drawerWidth;

    function handlePointerMove(moveEvent: PointerEvent) {
      setDrawerWidth(clampNumber(startWidth - (moveEvent.clientX - startX), 340, Math.max(420, window.innerWidth - 32)));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }

  return (
    <aside
      className="arch-drawer fixed inset-y-0 right-0 z-[66] flex flex-col border-l p-4"
      style={{ width: `min(${drawerWidth}px, calc(100vw - 2rem))` }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="调整审计抽屉宽度"
        onPointerDown={startDrawerResize}
        className="absolute inset-y-0 left-[-5px] z-20 w-3 cursor-ew-resize touch-none"
        title="拖动调整审计抽屉宽度"
      />
      <header className="arch-border flex items-center justify-between border-b pb-3">
        <div>
          <p className="arch-primary-text text-xs font-black uppercase tracking-[0.22em]">Inspector</p>
          <h2 className="mt-1 text-xl font-black">审计 / 模块上下文</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="arch-btn flex h-10 w-10 items-center justify-center rounded-md"
          aria-label="关闭审计抽屉"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto py-4">
        <section className="arch-card-muted rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Workflow className="arch-primary-text h-4 w-4" />
            <h3 className="arch-text font-black">{selectedSpec.zhName}</h3>
          </div>
          <div className="mt-3 space-y-2">
            <InfoRow label="状态" value={moduleStatusLabels[selectedSpec.status]} />
            <InfoRow label="Schema" value={selectedSpec.schemaRef} />
            <InfoRow label="Track" value={selectedSpec.track} />
          </div>
        </section>

        <section className="arch-card mt-3 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="arch-primary-text text-xs font-black uppercase tracking-[0.22em]">Audit panel</p>
              <h3 className="arch-text mt-1 font-black">操作审计</h3>
            </div>
            <ShieldCheck className="arch-primary-text h-5 w-5" />
          </div>
          <div className="mt-4 space-y-2">
            {auditEvents.length === 0 ? (
              <p className="arch-card-muted rounded-lg border border-dashed p-4 text-sm leading-6">
                文件、生命周期、审批、artifact 和 AI 操作都会写入这里。
              </p>
            ) : (
              auditEvents.map((event) => (
                <div key={event.id} className="arch-card-muted rounded-lg p-3">
                  <p className="arch-text text-sm font-black">{event.summary}</p>
                  <p className="arch-muted mt-2 text-xs">
                    {event.actor} · {event.at}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="arch-card flex items-start justify-between gap-3 rounded-md px-3 py-2 text-xs">
      <span className="arch-muted">{label}</span>
      <span className="arch-text max-w-[70%] break-words text-right font-bold">{value}</span>
    </div>
  );
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeCommand(value: string) {
  return value
    .toLowerCase()
    .replace(/[“”"'，,。:：]+/g, '')
    .replace(/[\s._/-]+/g, '');
}

function resolveModuleFromCommand(input: string) {
  const normalized = normalizeCommand(input);
  if (!normalized) return null;

  return (
    moduleSpecs.find((spec) =>
      [spec.zhName, spec.enName, spec.id, spec.track]
        .filter(Boolean)
        .some((candidate) => normalized.includes(normalizeCommand(candidate))),
    ) ?? null
  );
}

function resolveFileFromCommand(input: string, currentModuleId: ModuleId): ModuleFileNode | null {
  const query = extractFileOpenQuery(input);
  if (!query) return null;

  const normalizedInput = normalizeCommand(input);
  const normalizedQuery = normalizeCommand(query);
  if (normalizedQuery.length < 2) return null;

  return moduleBackendAdapter
    .snapshot()
    .files.filter((file) => file.parentId !== null)
    .map((file) => ({
      file,
      score: scoreFileCandidate(file, normalizedInput, normalizedQuery, currentModuleId),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.file ?? null;
}

function extractFileOpenQuery(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const hasOpenIntent = /(打开|查看|预览|定位|进入|open|view|preview)/i.test(trimmed);
  const hasFileExtension = /\.[a-z0-9]{2,8}\b/i.test(trimmed);
  if (!hasOpenIntent && !hasFileExtension) return null;

  return trimmed
    .replace(/^(请|帮我|麻烦|请帮我)?\s*(打开|查看|预览|定位|进入|open|view|preview)\s*/i, '')
    .replace(/^(这个|当前|一下)\s*/i, '')
    .trim();
}

function scoreFileCandidate(
  file: ModuleFileNode,
  normalizedInput: string,
  normalizedQuery: string,
  currentModuleId: ModuleId,
) {
  const normalizedName = normalizeCommand(file.name);
  const normalizedBaseName = normalizeCommand(file.name.replace(/\.[^.]+$/, ''));
  const normalizedTags = file.tags.map(normalizeCommand);
  let score = 0;

  if (normalizedName === normalizedQuery || normalizedBaseName === normalizedQuery) score = 120;
  else if (normalizedInput.includes(normalizedName)) score = 110;
  else if (normalizedName.includes(normalizedQuery)) score = 92;
  else if (normalizedBaseName.includes(normalizedQuery)) score = 88;
  else if (normalizedQuery.includes(normalizedName) && normalizedName.length >= 2) score = 82;
  else if (normalizedTags.some((tag) => tag && normalizedQuery.includes(tag))) score = 58;

  if (score === 0) return 0;
  if (file.moduleId === currentModuleId) score += 25;
  if (file.type === 'file') score += 5;
  return score;
}

function dispatchOpenFileRequest(request: ArchitokenOpenFileRequest) {
  window.dispatchEvent(
    new CustomEvent<ArchitokenOpenFileRequest>(architokenOpenFileEventName, {
      detail: request,
    }),
  );
}

function WorkbenchIntelligenceDialog({
  selectedSpec,
  selectedFeatureTitle,
  auditEvents,
  open,
  onOpenChange,
  onAudit,
  onNavigate,
}: {
  selectedSpec: ReturnType<typeof getModuleSpec>;
  selectedFeatureTitle: string;
  auditEvents: ModuleActionResult['auditEvent'][];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAudit: (event: ModuleActionResult['auditEvent']) => void;
  onNavigate: (href: string) => void;
}) {
  const profile = architokenAssistantProfile;
  const suggestions = moduleAssistantSuggestions[selectedSpec.id] ?? [
    '生成当前模块交付物草案并等待人工审批。',
    '检查 openBIM / CDE / Speckle / IFCDB-Agent 路由缺口。',
    '把当前文件、对象、审批和知识图谱写入可追踪证据链。',
  ];
  const selectedFeatureMessage = selectedFeatureTitle
    ? `已锁定业务对象: ${selectedFeatureTitle}`
    : `${selectedSpec.zhName} 模块上下文已载入`;
  const [input, setInput] = useState('');
  const [dialogWidth, setDialogWidth] = useState(440);
  const [dialogHeight, setDialogHeight] = useState(760);
  const [messages, setMessages] = useState<string[]>([
    `${profile.name}: ${selectedFeatureMessage}。这里是全局弹出式工程对话,可处理生成、校核、派生、归档、路由诊断和跨模块导航。`,
  ]);

  function pushMessage(summary: string) {
    const message = `${profile.name}: ${summary}`;
    setMessages((current) => [message, ...current].slice(0, 6));
    onAudit(createModuleAuditEvent(`assistant-${selectedSpec.id}`, profile.name, summary));
  }

  function submitMessage() {
    const normalizedInput = input.trim();
    if (!normalizedInput) return;
    const targetFile = resolveFileFromCommand(normalizedInput, selectedSpec.id);

    if (targetFile) {
      const request: ArchitokenOpenFileRequest = {
        fileId: targetFile.id,
        moduleId: targetFile.moduleId,
        query: normalizedInput,
        requestedAt: new Date().toISOString(),
      };
      const targetModule = getModuleSpec(targetFile.moduleId);
      if (targetFile.moduleId === selectedSpec.id) {
        dispatchOpenFileRequest(request);
      } else {
        window.sessionStorage.setItem(
          architokenPendingOpenFileKey,
          JSON.stringify(request),
        );
        onNavigate(targetModule.routeHref);
      }
      pushMessage(`正在打开 ${targetModule.zhName} / ${targetFile.name}。`);
      setInput('');
      return;
    }

    const targetModule = resolveModuleFromCommand(normalizedInput);

    if (targetModule) {
      pushMessage(`正在打开 ${targetModule.zhName}。全局指令已映射到 ${targetModule.routeHref}。`);
      onNavigate(targetModule.routeHref);
      setInput('');
      return;
    }

    pushMessage(`已接收请求“${normalizedInput}”, 将按 Harness -> openBIM CDE -> Speckle -> IFCDB-Agent -> 后端原生文件运行时路由。`);
    setInput('');
  }

  function runGlobalAction(action: string) {
    pushMessage(`${action}: 已进入全局任务队列,将按当前模块、知识地图、文件运行时和审批边界生成可追踪任务。`);
  }

  function startDialogResize(
    event: ReactPointerEvent<HTMLDivElement>,
    mode: 'left' | 'top' | 'corner',
  ) {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = dialogWidth;
    const startHeight = dialogHeight;

    function handlePointerMove(moveEvent: PointerEvent) {
      const maxWidth = Math.max(360, window.innerWidth - 40);
      const maxHeight = Math.max(440, window.innerHeight - 40);
      if (mode === 'left' || mode === 'corner') {
        setDialogWidth(clampNumber(startWidth - (moveEvent.clientX - startX), 360, maxWidth));
      }
      if (mode === 'top' || mode === 'corner') {
        setDialogHeight(clampNumber(startHeight - (moveEvent.clientY - startY), 440, maxHeight));
      }
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="arch-btn-primary fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-md shadow-lg"
        aria-label="打开 ArchIToken AI 全局对话"
        title="ArchIToken AI"
      >
        <Bot className="h-6 w-6" />
      </button>
    );
  }

  return (
    <aside
      className="arch-surface arch-border fixed bottom-5 right-5 z-50 flex max-h-[calc(100vh-2.5rem)] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-lg border shadow-2xl"
      style={{
        width: `min(${dialogWidth}px, calc(100vw - 2.5rem))`,
        height: `min(${dialogHeight}px, calc(100vh - 2.5rem))`,
        minWidth: 'min(360px, calc(100vw - 2.5rem))',
        minHeight: 'min(440px, calc(100vh - 2.5rem))',
      }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="拖动调整对话框宽度"
        onPointerDown={(event) => startDialogResize(event, 'left')}
        className="absolute inset-y-0 left-[-5px] z-20 w-3 cursor-ew-resize touch-none"
        title="拖动调整宽度"
      />
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="拖动调整对话框高度"
        onPointerDown={(event) => startDialogResize(event, 'top')}
        className="absolute inset-x-0 top-[-5px] z-20 h-3 cursor-ns-resize touch-none"
        title="拖动调整高度"
      />
      <div
        aria-hidden="true"
        onPointerDown={(event) => startDialogResize(event, 'corner')}
        className="absolute left-[-5px] top-[-5px] z-30 h-5 w-5 cursor-nwse-resize touch-none rounded-br-md border-b border-r border-[var(--arch-border)] bg-[var(--arch-surface-muted)]"
        title="拖动调整大小"
      />
      <div className="arch-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={() => pushMessage(`${selectedSpec.zhName}: 已刷新当前模块上下文。`)}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <span className="arch-btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
            <Bot className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="arch-primary-text block font-mono text-[10px] font-black uppercase tracking-[0.2em]">
              Global dialog
            </span>
            <span className="arch-text mt-1 block truncate text-base font-black">
              {profile.name}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="arch-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
          aria-label="关闭 ArchIToken AI 全局对话"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <section className="arch-card-muted mt-3 rounded-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="arch-primary-text font-mono text-[10px] uppercase tracking-[0.22em]">
                Platform
              </p>
              <h4 className="arch-text mt-1 font-black">
                ArchIToken = AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS
              </h4>
              <p className="arch-muted mt-2 text-sm leading-6">
                默认从这里进入全局生成、校核、派生、归档、跨模块导航和文件运行时路由。开放格式走原生/open runtime,复杂格式走后端 worker、Speckle CDE、IFCDB-Agent 或授权适配器。
              </p>
            </div>
            <CheckCircle2 className="arch-primary-text h-5 w-5 shrink-0" />
          </div>
        </section>

        <section className="arch-card-muted rounded-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="arch-primary-text font-mono text-[10px] uppercase tracking-[0.22em]">
                Profile
              </p>
              <h4 className="mt-1 font-black">{profile.role}</h4>
            </div>
            <CheckCircle2 className="arch-primary-text h-5 w-5" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.capabilityTags.slice(0, 6).map((tag) => (
              <span key={tag} className="arch-chip rounded-md border px-2 py-1 text-[11px] font-bold">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="arch-card mt-3 rounded-lg p-4">
          <div className="mb-3 flex items-center gap-2">
            <Workflow className="arch-primary-text h-4 w-4" />
            <h4 className="font-black">使用说明</h4>
          </div>
          <div className="grid gap-2">
            {[
              '选择左侧模块,中间区域处理真实文件、模型、流程和审批。',
              '在本弹窗输入需求,系统按 Harness 门禁生成可审计任务。',
              '输入“打开设置中心”“进入材料物流”等指令可直接切换模块。',
              '目录、业务侧栏和弹窗边缘均可直接拖拽调整。',
            ].map((item, index) => (
              <p key={item} className="arch-card-muted rounded-md px-3 py-2 text-sm leading-6">
                <span className="arch-primary-text mr-2 font-black">{index + 1}</span>
                {item}
              </p>
            ))}
          </div>
        </section>

        <section className="arch-card mt-3 rounded-lg p-4">
          <div className="mb-3 flex items-center gap-2">
            <FolderTree className="arch-primary-text h-4 w-4" />
            <h4 className="font-black">可点击目录</h4>
          </div>
          <div className="grid gap-3">
            {MODULE_TREE_GROUPS.map((group) => (
              <div key={group.id} className="space-y-2">
                <p className="arch-muted font-mono text-[10px] font-black uppercase tracking-[0.16em]">
                  {group.title}
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {group.modules.map((moduleId) => {
                    const spec = getModuleSpec(moduleId);
                    return (
                      <Link
                        key={spec.id}
                        href={spec.routeHref}
                        prefetch={false}
                        className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                          spec.id === selectedSpec.id
                            ? 'arch-card-selected'
                            : 'arch-card-muted hover:border-[var(--arch-primary)]'
                        }`}
                      >
                        <span className="arch-text block truncate font-black">{spec.zhName}</span>
                        <span className="arch-muted mt-1 block truncate font-mono text-[10px] uppercase">
                          {spec.id}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="arch-card mt-3 rounded-lg p-4">
          <div className="mb-3 flex items-center gap-2">
            <Network className="arch-primary-text h-4 w-4" />
            <h4 className="font-black">知识地图</h4>
          </div>
          <div className="grid gap-2">
            <KnowledgeNode icon={<FolderTree className="h-4 w-4" />} label="当前模块" value={selectedSpec.zhName} />
            <KnowledgeNode icon={<GitBranch className="h-4 w-4" />} label="上下游" value={`${selectedSpec.inputs.length} 输入 / ${selectedSpec.outputs.length} 输出`} />
            <KnowledgeNode icon={<ShieldCheck className="h-4 w-4" />} label="标准" value={selectedSpec.standards.slice(0, 3).join(' · ')} />
            <KnowledgeNode icon={<Network className="h-4 w-4" />} label="CDE 图谱" value="Speckle stream/object/commit + IFCDB-Agent" />
            <KnowledgeNode icon={<Workflow className="h-4 w-4" />} label="文件运行时" value={selectedSpec.fileTypes.slice(0, 5).join(' · ')} />
          </div>
        </section>

        <section className="arch-card mt-3 rounded-lg p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="arch-primary-text h-4 w-4" />
            <h4 className="font-black">全局功能</h4>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {['全局生成', '全局校核', '派生文件', '归档交付', '路由诊断', '审批建议'].map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => runGlobalAction(action)}
                className="arch-btn rounded-md px-3 py-2 text-xs font-black"
              >
                {action}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {suggestions.slice(0, 4).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => pushMessage(suggestion)}
                className="arch-card-muted w-full rounded-md px-3 py-2 text-left text-sm leading-6 transition hover:border-[var(--arch-primary)]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </section>

        <section className="arch-card mt-3 rounded-lg p-4">
          <div className="mb-3 flex items-center gap-2">
            <Bot className="arch-primary-text h-4 w-4" />
            <h4 className="font-black">工程对话</h4>
          </div>
          <div className="space-y-2">
            {messages.map((message) => (
              <p key={message} className="arch-card-muted rounded-md px-3 py-2 text-sm leading-6">
                {message}
              </p>
            ))}
          </div>
        </section>

        <section className="arch-card-muted mt-3 rounded-lg p-4">
          <p className="arch-primary-text font-mono text-[10px] uppercase tracking-[0.22em]">
            Audit tail
          </p>
          <div className="mt-2 space-y-2">
            {auditEvents.slice(0, 4).map((event) => (
              <p key={event.id} className="arch-card rounded-md px-3 py-2 text-xs leading-5">
                {event.summary}
              </p>
            ))}
            {auditEvents.length === 0 ? (
              <p className="arch-muted text-sm leading-6">暂无本页操作审计。</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="arch-border shrink-0 border-t p-3">
        <label className="arch-input flex items-center gap-2 rounded-md px-3 py-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitMessage();
            }}
            placeholder="生成、校核、派生、归档..."
            className="arch-text min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-60"
          />
          <button
            type="button"
            onClick={submitMessage}
            className="arch-btn-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
            aria-label="发送工程对话"
          >
            <Send className="h-4 w-4" />
          </button>
        </label>
      </div>
    </aside>
  );
}

function KnowledgeNode({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="arch-card-muted grid grid-cols-[28px_1fr] gap-2 rounded-md p-3">
      <span className="arch-primary-soft flex h-7 w-7 items-center justify-center rounded-md">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="arch-muted block text-[11px] font-bold">{label}</span>
        <span className="arch-text mt-0.5 block break-words text-sm font-black">
          {value || '-'}
        </span>
      </span>
    </div>
  );
}
