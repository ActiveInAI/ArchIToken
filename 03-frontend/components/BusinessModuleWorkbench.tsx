// components/BusinessModuleWorkbench.tsx - ArchIToken 11-module workbench
// License: Apache-2.0
'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  Archive,
  ArrowRight,
  Bot,
  Boxes,
  Building2,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Factory,
  FileCheck2,
  GitBranch,
  HardHat,
  LibraryBig,
  MessageCircle,
  Route,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import type { ModuleId } from '@/lib/api';
import {
  businessModules,
  getBusinessModule,
  getModuleDependencyIssues,
  getModuleReadinessScore,
  moduleStatusLabels,
  type BusinessModuleSpec,
  type BusinessModuleStatus,
  type BusinessModuleTrack,
} from '@/lib/business-modules';

const defaultModuleId: ModuleId = 'construction_supervision';

export function BusinessModuleWorkbench() {
  const [selectedModuleId, setSelectedModuleId] = useState<ModuleId>(defaultModuleId);
  const selectedModule = getBusinessModule(selectedModuleId);
  const readiness = getModuleReadinessScore();
  const dependencyIssues = getModuleDependencyIssues();
  const activeCount = businessModules.filter((spec) => spec.status === 'active').length;
  const pilotCount = businessModules.filter((spec) => spec.status === 'pilot').length;
  const foundationCount = businessModules.filter((spec) => spec.status === 'foundation').length;

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#101213]">
      <section className="border-b border-[#101213]/10 bg-[#101213] text-white">
        <div className="container mx-auto grid gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_440px]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-xs font-bold text-[#9ee7d5]">
              <Workflow className="h-3.5 w-3.5" />
              11 modules registry · document-driven development
            </div>
            <h1 className="max-w-4xl text-4xl font-black tracking-[-0.055em] md:text-7xl">
              ArchIToken 业务模块工作台
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-white/70 md:text-lg">
              按 `MODULES.md` 的 11 模块注册机制推进开发: 每个模块都有输入输出、交付物、
              AI Agent 能力、标准法规、质量门禁和数据对象。这里是其它业务模块继续深挖的统一入口。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <HeroMetric label="模块总数" value={String(businessModules.length)} detail="registry order locked" />
            <HeroMetric label="开发中" value={`${activeCount} + ${pilotCount}`} detail="active + pilot modules" />
            <HeroMetric label="底座模块" value={String(foundationCount)} detail="standard library / settings" />
            <HeroMetric label="工作台就绪" value={`${readiness}%`} detail={`${dependencyIssues.length} dependency issue`} />
          </div>
        </div>
      </section>

      <section className="container mx-auto grid gap-5 px-6 py-6 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
        <aside className="space-y-5 self-start">
          <Panel title="模块链" eyebrow="Module chain" icon={<GitBranch className="h-4 w-4" />}>
            <div className="space-y-2">
              {businessModules.map((spec) => (
                <ModuleButton
                  key={spec.id}
                  spec={spec}
                  selected={spec.id === selectedModuleId}
                  onSelect={setSelectedModuleId}
                />
              ))}
            </div>
          </Panel>
        </aside>

        <section className="space-y-5 self-start">
          <ModuleDetail spec={selectedModule} />
          <ModuleFlow spec={selectedModule} />
          <Roadmap />
        </section>

        <aside className="space-y-5 self-start">
          <GovernancePanel spec={selectedModule} />
          <Panel title="开发门禁" eyebrow="Quality gates" icon={<CheckCircle2 className="h-4 w-4" />}>
            <div className="space-y-2">
              {selectedModule.qualityGates.map((gate) => (
                <div key={gate} className="rounded-2xl border border-[#101213]/10 bg-white p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#008f6b]" />
                    <p className="text-sm font-semibold leading-5">{gate}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </section>
    </main>
  );
}

function ModuleDetail({ spec }: { spec: BusinessModuleSpec }) {
  return (
    <Panel
      title={`${spec.zhName} · ${spec.enName}`}
      eyebrow={`Module ${String(spec.order).padStart(2, '0')} · ${spec.id}`}
      icon={moduleIcon(spec.id)}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusPill status={spec.status} />
            <TrackPill track={spec.track} />
          </div>
          <p className="max-w-3xl text-lg leading-8 text-[#101213]/74">{spec.summary}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <InfoList title="主要交付物" items={spec.primaryArtifacts} icon={<FileCheck2 className="h-4 w-4" />} />
            <InfoList title="AI Agent 能力" items={spec.aiCapabilities} icon={<Bot className="h-4 w-4" />} />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[#101213]/10 bg-[#101213] p-4 text-white">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#9ee7d5]/70">
            Entry
          </p>
          <Link
            href={spec.routeHref}
            className="mt-4 flex items-center justify-between rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-black transition hover:border-[#9ee7d5]/60"
          >
            进入模块入口
            <ArrowRight className="h-4 w-4" />
          </Link>
          {spec.contractHref ? (
            <div className="mt-3 rounded-2xl border border-white/12 bg-white/[0.04] p-3">
              <p className="text-xs text-white/52">模块契约</p>
              <p className="mt-1 font-mono text-xs text-[#9ee7d5]">{spec.contractHref}</p>
            </div>
          ) : null}
          <div className="mt-3 rounded-2xl border border-white/12 bg-white/[0.04] p-3">
            <p className="text-xs text-white/52">数据对象</p>
            <p className="mt-1 text-xs leading-5 text-white/74">{spec.dataObjects.join(' · ')}</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ModuleFlow({ spec }: { spec: BusinessModuleSpec }) {
  return (
    <Panel title="上下游流转" eyebrow="Inputs / Outputs" icon={<Route className="h-4 w-4" />}>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
        <FlowColumn title="输入模块" moduleIds={spec.inputs} empty="起点或全局侧车" />
        <div className="hidden items-center justify-center lg:flex">
          <ArrowRight className="h-8 w-8 text-[#c8332a]" />
        </div>
        <FlowColumn title="输出模块" moduleIds={spec.outputs} empty="终点或全局侧车" />
      </div>
    </Panel>
  );
}

function GovernancePanel({ spec }: { spec: BusinessModuleSpec }) {
  return (
    <Panel title="标准与数据治理" eyebrow="Governance" icon={<ShieldCheck className="h-4 w-4" />}>
      <div className="space-y-4">
        <InfoList title="标准法规基线" items={spec.standards} icon={<ClipboardList className="h-4 w-4" />} compact />
        <InfoList title="主数据对象" items={spec.dataObjects} icon={<Boxes className="h-4 w-4" />} compact />
      </div>
    </Panel>
  );
}

function Roadmap() {
  const items = [
    ['施工监理', '接入 production-ready prompt 目录与现场证据数据。'],
    ['深化设计', '增加 IFC / IDS / BCF 审查和图纸解析入口。'],
    ['加工制造', '建立重钢构件排产、焊缝质检和 MES 回传页面。'],
    ['材料物流', '建立 DDMRP、运输 ETA、到场验收和堆场看板。'],
    ['数字档案', '打通合同、图纸、模型、检测和签章长期留存。'],
    ['设置中心', '租户、RBAC、模型路由、SLA 和合规策略统一配置。'],
  ] as const;

  return (
    <Panel title="后续开发路线" eyebrow="Next development" icon={<Sparkles className="h-4 w-4" />}>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map(([title, body], index) => (
          <div key={title} className="rounded-2xl border border-[#101213]/10 bg-white p-4">
            <p className="font-mono text-xs font-black text-[#c8332a]">
              {String(index + 1).padStart(2, '0')}
            </p>
            <h3 className="mt-2 text-lg font-black">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#101213]/64">{body}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ModuleButton({
  spec,
  selected,
  onSelect,
}: {
  spec: BusinessModuleSpec;
  selected: boolean;
  onSelect: (moduleId: ModuleId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(spec.id)}
      className={`grid w-full grid-cols-[36px_1fr_auto] items-center gap-3 rounded-2xl border p-3 text-left transition ${
        selected
          ? 'border-[#101213] bg-white shadow-[0_18px_40px_rgba(16,18,19,0.12)]'
          : 'border-[#101213]/10 bg-white/62 hover:border-[#101213]/40'
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101213] text-white">
        {moduleIcon(spec.id)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-black">{spec.zhName}</span>
        <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[#101213]/45">
          {spec.id}
        </span>
      </span>
      <span className="font-mono text-xs font-black text-[#c8332a]">
        {String(spec.order).padStart(2, '0')}
      </span>
    </button>
  );
}

function FlowColumn({ title, moduleIds, empty }: { title: string; moduleIds: ModuleId[]; empty: string }) {
  return (
    <div className="rounded-[1.5rem] border border-[#101213]/10 bg-white p-4">
      <h3 className="mb-3 font-black">{title}</h3>
      {moduleIds.length === 0 ? (
        <p className="text-sm text-[#101213]/52">{empty}</p>
      ) : (
        <div className="space-y-2">
          {moduleIds.map((moduleId) => {
            const spec = getBusinessModule(moduleId);
            return (
              <div key={moduleId} className="rounded-xl bg-[#f4f1ea] px-3 py-2">
                <p className="text-sm font-black">{spec.zhName}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#101213]/48">
                  {spec.id}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoList({
  title,
  items,
  icon,
  compact = false,
}: {
  title: string;
  items: string[];
  icon: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[#101213]/10 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[#c8332a]">{icon}</span>
        <h3 className="font-black">{title}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className={`rounded-full border border-[#101213]/10 bg-[#f4f1ea] px-3 py-1 ${
              compact ? 'text-xs' : 'text-sm'
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  icon,
  children,
}: {
  title: string;
  eyebrow: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-[#101213]/10 bg-[#fbfaf6] p-5 shadow-[0_18px_60px_rgba(16,18,19,0.06)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#101213]/42">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.045em]">{title}</h2>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#101213] text-white">
          {icon}
        </span>
      </div>
      {children}
    </section>
  );
}

function HeroMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/12 bg-white/[0.055] p-4">
      <p className="text-xs text-white/50">{label}</p>
      <p className="mt-2 text-4xl font-black tracking-[-0.06em] text-[#9ee7d5]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-white/50">{detail}</p>
    </div>
  );
}

function StatusPill({ status }: { status: BusinessModuleStatus }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(status)}`}>
      {moduleStatusLabels[status]}
    </span>
  );
}

function TrackPill({ track }: { track: BusinessModuleTrack }) {
  return (
    <span className="rounded-full border border-[#101213]/10 bg-white px-3 py-1 text-xs font-black">
      {track}
    </span>
  );
}

function moduleIcon(moduleId: ModuleId) {
  const className = 'h-4 w-4';
  const icons: Record<ModuleId, ReactNode> = {
    marketing_service: <MessageCircle className={className} />,
    concept_design: <Sparkles className={className} />,
    standard_library: <LibraryBig className={className} />,
    detailed_design: <Building2 className={className} />,
    quantity_costing: <Calculator className={className} />,
    material_logistics: <Route className={className} />,
    manufacturing: <Factory className={className} />,
    construction_supervision: <HardHat className={className} />,
    digital_twin: <Cpu className={className} />,
    digital_archive: <Archive className={className} />,
    settings_center: <ShieldCheck className={className} />,
  };
  return icons[moduleId];
}

function statusClass(status: BusinessModuleStatus) {
  if (status === 'active') {
    return 'bg-[#d9f7ef] text-[#006b52]';
  }
  if (status === 'pilot') {
    return 'bg-[#e6eefc] text-[#1f3a5f]';
  }
  if (status === 'foundation') {
    return 'bg-[#fff1d7] text-[#8a5a00]';
  }
  return 'bg-[#f1e7df] text-[#7c3f2b]';
}
