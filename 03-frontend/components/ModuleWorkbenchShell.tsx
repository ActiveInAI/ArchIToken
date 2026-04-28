// components/ModuleWorkbenchShell.tsx - ArchIToken operational module platform shell
// License: Apache-2.0
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Blocks,
  FileSearch,
  Gauge,
  Search,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { ModuleDetailWorkbench } from '@/components/ModuleDetailWorkbench';
import type { ModuleActionResult } from '@/lib/module-actions';
import {
  getModuleSpec,
  getPlatformStats,
  moduleSpecs,
  moduleStatusLabels,
  type ModuleId,
} from '@/lib/module-registry';

export function ModuleWorkbenchShell({ initialModuleId }: { initialModuleId?: ModuleId }) {
  const fallbackModuleId = initialModuleId ?? 'construction_supervision';
  const [selectedModuleId, setSelectedModuleId] = useState<ModuleId>(fallbackModuleId);
  const [query, setQuery] = useState('');
  const [auditEvents, setAuditEvents] = useState<ModuleActionResult['auditEvent'][]>([]);
  const selectedSpec = getModuleSpec(selectedModuleId);
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

  function handleAudit(event: ModuleActionResult['auditEvent']) {
    setAuditEvents((current) => [event, ...current].slice(0, 8));
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d8fff5_0,#f4f7fb_28%,#eef2f7_56%,#f7f3e8_100%)] text-slate-950">
      <section className="border-b border-slate-900/10 bg-slate-950 text-white">
        <div className="mx-auto grid max-w-[1800px] gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_520px]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black text-cyan-200">
              <Workflow className="h-3.5 w-3.5" />
              Module Registry driven workbench
            </div>
            <h1 className="max-w-5xl text-4xl font-black tracking-[-0.06em] md:text-7xl">
              ArchIToken 平台业务工作台
            </h1>
            <p className="mt-5 max-w-4xl text-base leading-8 text-white/70">
              这里不是展示页。11 个模块都能进入详情、查看子域、输入输出、交付物、状态机、
              AI 门禁、风险、审批和可视化区域。当前未接真实后端 API,但所有操作按钮都有 typed mock 状态变化。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <HeroMetric icon={<Blocks className="h-4 w-4" />} label="模块" value={String(stats.modules)} detail="all clickable" />
            <HeroMetric icon={<FileSearch className="h-4 w-4" />} label="交付物" value={String(stats.artifacts)} detail="mock action enabled" />
            <HeroMetric icon={<Activity className="h-4 w-4" />} label="子域" value={String(stats.subdomains)} detail="operational scopes" />
            <HeroMetric icon={<Gauge className="h-4 w-4" />} label="就绪度" value={`${stats.readiness}%`} detail="frontend registry" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1800px] gap-5 px-5 py-5 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
        <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
          <div className="rounded-[1.75rem] border border-slate-900/10 bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索模块、能力、轨道"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </label>
          </div>

          <nav className="space-y-2 rounded-[1.75rem] border border-slate-900/10 bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-700">
                11 modules
              </p>
              <span className="text-xs font-black text-slate-500">{filteredModules.length}/11</span>
            </div>
            {filteredModules.map((spec) => (
              <div
                key={spec.id}
                className={`rounded-2xl border p-3 transition ${
                  spec.id === selectedModuleId
                    ? 'border-cyan-500 bg-cyan-50 shadow-[0_14px_34px_rgba(8,145,178,0.16)]'
                    : 'border-slate-200 bg-white hover:border-slate-400'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedModuleId(spec.id)}
                  className="grid w-full grid-cols-[32px_1fr] gap-3 text-left"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
                    {String(spec.order).padStart(2, '0')}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-slate-950">{spec.zhName}</span>
                    <span className="mt-1 block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      {spec.id}
                    </span>
                  </span>
                </button>
                <Link
                  href={spec.routeHref}
                  className="mt-3 inline-flex w-full items-center justify-between rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-cyan-700"
                >
                  进入详情路由
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </nav>
        </aside>

        <ModuleDetailWorkbench spec={selectedSpec} onAudit={handleAudit} />

        <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
          <section className="rounded-[1.75rem] border border-slate-900/10 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-700">
              Selected module
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950">
              {selectedSpec.zhName}
            </h2>
            <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-slate-500">
              {selectedSpec.id}
            </p>
            <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-white/60">状态</span>
                <span className="rounded-full bg-cyan-300 px-3 py-1 text-xs font-black text-slate-950">
                  {moduleStatusLabels[selectedSpec.status]}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm text-white/60">Schema</span>
                <span className="text-right font-mono text-xs text-cyan-200">{selectedSpec.schemaRef}</span>
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-900/10 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-700">
                  Audit panel
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">本地操作审计</h2>
              </div>
              <ShieldCheck className="h-5 w-5 text-cyan-700" />
            </div>
            <div className="mt-4 space-y-3">
              {auditEvents.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                  点击交付物上的生成、评估、校核、审批或归档按钮后,这里会出现 mock 审计事件。
                </p>
              ) : (
                auditEvents.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-black text-slate-950">{event.summary}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {event.actor} · {event.at}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function HeroMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-white/50">{label}</p>
        <span className="text-cyan-200">{icon}</span>
      </div>
      <p className="mt-2 text-4xl font-black tracking-[-0.06em] text-cyan-200">{value}</p>
      <p className="mt-2 text-xs leading-5 text-white/50">{detail}</p>
    </div>
  );
}
