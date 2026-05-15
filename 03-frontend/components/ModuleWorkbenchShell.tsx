// components/ModuleWorkbenchShell.tsx - ArchIToken operational module platform shell
// License: Apache-2.0
'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
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
  const fallbackModuleId = initialModuleId ?? 'construction_supervision';
  const [query, setQuery] = useState('');
  const [railExpanded, setRailExpanded] = useState(initialRailExpanded);
  const [inspectorOpen, setInspectorOpen] = useState(false);
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

  return (
    <main className="arch-app h-screen w-screen overflow-hidden">
      <div className={`grid h-full min-h-0 ${railExpanded ? 'lg:grid-cols-[232px_minmax(0,1fr)]' : 'lg:grid-cols-[72px_minmax(0,1fr)]'}`}>
        <aside className="arch-surface flex min-h-0 flex-col border-b shadow-none lg:border-b-0 lg:border-r">
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
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <header className="arch-surface arch-border flex h-auto shrink-0 flex-col gap-3 border-b px-4 py-3 xl:h-16 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="arch-primary-text font-mono text-[10px] font-black uppercase tracking-[0.22em]">
                OpenBIM CDE Workbench
              </p>
              <h2 className="arch-text mt-1 truncate text-xl font-black">
                {selectedSpec.zhName} · {selectedSpec.enName}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {['openBIM', 'Speckle CDE', 'IFCDB-Agent', 'Native files'].map((item) => (
                <span key={item} className="arch-chip rounded-md border px-3 py-2 text-xs font-black">
                  {item}
                </span>
              ))}
              {(['generate', 'rule_check', 'schema_validate', 'approve'] as const).map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => handleAudit(createModuleAuditEvent(
                    `${selectedSpec.id}-${action}`,
                    'Workbench toolbar',
                    `${selectedSpec.zhName}: ${action} route queued through Harness gates.`,
                  ))}
                  className="arch-btn rounded-md px-3 py-2 text-xs font-black"
                >
                  {action === 'generate' ? '生成' : action === 'rule_check' ? '校核' : action === 'schema_validate' ? 'Schema' : '审批'}
                </button>
              ))}
            </div>
          </header>

          <div className="arch-app grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-h-0 min-w-0 overflow-hidden p-3">
              <ModuleDetailWorkbench key={selectedSpec.id} spec={selectedSpec} onAudit={handleAudit} onFeatureSelect={setSelectedFeatureTitle} />
            </div>
            <WorkbenchIntelligencePanel
              selectedSpec={selectedSpec}
              selectedFeatureTitle={selectedFeatureTitle}
              auditEvents={auditEvents}
              onAudit={handleAudit}
            />
          </div>
        </section>
      </div>

      {inspectorOpen ? (
        <InspectorDrawer selectedSpec={selectedSpec} auditEvents={auditEvents} onClose={() => setInspectorOpen(false)} />
      ) : null}

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
  return (
    <aside className="arch-drawer fixed inset-y-0 right-0 z-[66] flex flex-col border-l p-4">
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

function WorkbenchIntelligencePanel({
  selectedSpec,
  selectedFeatureTitle,
  auditEvents,
  onAudit,
}: {
  selectedSpec: ReturnType<typeof getModuleSpec>;
  selectedFeatureTitle: string;
  auditEvents: ModuleActionResult['auditEvent'][];
  onAudit: (event: ModuleActionResult['auditEvent']) => void;
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
  const [messages, setMessages] = useState<string[]>([
    `${profile.name}: ${selectedFeatureMessage}。`,
  ]);

  function pushMessage(summary: string) {
    const message = `${profile.name}: ${summary}`;
    setMessages((current) => [message, ...current].slice(0, 6));
    onAudit(createModuleAuditEvent(`assistant-${selectedSpec.id}`, profile.name, summary));
  }

  function submitMessage() {
    const normalizedInput = input.trim();
    if (!normalizedInput) return;
    pushMessage(`已接收请求“${normalizedInput}”, 将按 Harness -> openBIM CDE -> Speckle -> IFCDB-Agent -> 后端原生文件运行时路由。`);
    setInput('');
  }

  return (
    <aside className="arch-surface arch-border hidden min-h-0 border-l xl:flex xl:flex-col">
      <div className="arch-border flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="min-w-0">
          <p className="arch-primary-text font-mono text-[10px] font-black uppercase tracking-[0.22em]">
            AI / Knowledge
          </p>
          <h3 className="arch-text mt-1 truncate text-base font-black">
            {profile.name}
          </h3>
        </div>
        <span className="arch-btn-primary flex h-10 w-10 items-center justify-center rounded-md">
          <Bot className="h-5 w-5" />
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
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
            <h4 className="font-black">场景生成</h4>
          </div>
          <div className="space-y-2">
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
