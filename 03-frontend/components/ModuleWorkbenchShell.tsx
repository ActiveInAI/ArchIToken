// components/ModuleWorkbenchShell.tsx - ArchIToken operational module platform shell
// License: Apache-2.0
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Activity,
  Blocks,
  FileSearch,
  Gauge,
  Menu,
  PanelRightOpen,
  Search,
  ShieldCheck,
  Workflow,
  X,
} from 'lucide-react';
import { FloatingAIAssistant } from '@/components/FloatingAIAssistant';
import { ModuleDetailWorkbench } from '@/components/ModuleDetailWorkbench';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import type { ModuleActionResult } from '@/lib/module-actions';
import {
  getModuleSpec,
  getPlatformStats,
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
  const stats = getPlatformStats();
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
      <div className={`grid h-full min-h-0 ${railExpanded ? 'lg:grid-cols-[220px_minmax(0,1fr)]' : 'lg:grid-cols-[72px_minmax(0,1fr)]'}`}>
        <aside className="arch-surface flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r">
          <div className="arch-border flex h-14 shrink-0 items-center gap-2 border-b px-3">
            <button
              type="button"
              onClick={toggleModuleRail}
              className="arch-btn flex h-10 w-10 items-center justify-center rounded-xl"
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
              <label className="arch-input flex items-center gap-2 rounded-xl px-3 py-2">
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
        </aside>

        <section className="flex min-h-0 min-w-0 overflow-hidden flex-col">
          <header className="arch-surface flex h-14 shrink-0 items-center justify-between gap-3 border-b px-3">
            <div className="min-w-0">
              <p className="arch-primary-text font-mono text-[10px] uppercase tracking-[0.22em]">
                当前项目 · ArchIToken Heavy Steel
              </p>
              <h2 className="arch-text truncate text-lg font-black">
                {selectedSpec.zhName} · 当前目录: 工作区根
              </h2>
            </div>
            <div className="hidden items-center gap-2 xl:flex">
              <StatusMetric icon={<Blocks className="h-4 w-4" />} label="模块" value={String(stats.modules)} />
              <StatusMetric icon={<FileSearch className="h-4 w-4" />} label="交付物" value={String(stats.artifacts)} />
              <StatusMetric icon={<Activity className="h-4 w-4" />} label="子域" value={String(stats.subdomains)} />
              <StatusMetric icon={<Gauge className="h-4 w-4" />} label="就绪" value={`${stats.readiness}%`} />
            </div>
            <ThemeSwitcher />
            <button
              type="button"
              onClick={() => setInspectorOpen(true)}
              className="arch-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black"
            >
              <PanelRightOpen className="h-4 w-4" />
              审计
            </button>
          </header>

          <div className="arch-app min-h-0 flex-1 overflow-y-auto p-2">
            <ModuleDetailWorkbench key={selectedSpec.id} spec={selectedSpec} onAudit={handleAudit} />
          </div>
        </section>
      </div>

      {inspectorOpen ? (
        <InspectorDrawer selectedSpec={selectedSpec} auditEvents={auditEvents} onClose={() => setInspectorOpen(false)} />
      ) : null}

      <FloatingAIAssistant module={selectedSpec} onAudit={handleAudit} />
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
      className={`grid items-center gap-2 rounded-xl border px-2 py-2 text-left transition ${
        railExpanded ? 'grid-cols-[34px_1fr]' : 'grid-cols-1 justify-items-center'
      } ${
        selected
          ? 'arch-card-selected'
          : 'border-transparent arch-surface-muted hover:border-[var(--arch-primary)] hover:bg-[var(--arch-primary-soft)] hover:text-[var(--arch-primary)]'
      }`}
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black ${
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

function StatusMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="arch-card-muted flex items-center gap-2 rounded-xl px-3 py-2">
      <span className="arch-primary-text">{icon}</span>
      <span>
        <span className="arch-muted block text-[10px]">{label}</span>
        <span className="arch-text block text-sm font-black">{value}</span>
      </span>
    </div>
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
          className="arch-btn flex h-10 w-10 items-center justify-center rounded-xl"
          aria-label="关闭审计抽屉"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto py-4">
        <section className="arch-card-muted rounded-2xl p-4">
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

        <section className="arch-card mt-3 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="arch-primary-text text-xs font-black uppercase tracking-[0.22em]">Audit panel</p>
              <h3 className="arch-text mt-1 font-black">操作审计</h3>
            </div>
            <ShieldCheck className="arch-primary-text h-5 w-5" />
          </div>
          <div className="mt-4 space-y-2">
            {auditEvents.length === 0 ? (
              <p className="arch-card-muted rounded-2xl border border-dashed p-4 text-sm leading-6">
                文件、生命周期、审批、artifact 和 AI 操作都会写入这里。
              </p>
            ) : (
              auditEvents.map((event) => (
                <div key={event.id} className="arch-card-muted rounded-2xl p-3">
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
    <div className="arch-card flex items-start justify-between gap-3 rounded-xl px-3 py-2 text-xs">
      <span className="arch-muted">{label}</span>
      <span className="arch-text max-w-[70%] break-words text-right font-bold">{value}</span>
    </div>
  );
}
