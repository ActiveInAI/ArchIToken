// components/ModuleDetailWorkbench.tsx - Operational module detail surface
// License: Apache-2.0
'use client';

import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  FileType2,
  Layers3,
  ListTodo,
  MonitorCog,
  Workflow,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { ArtifactBoard } from '@/components/ArtifactBoard';
import { AgentGateTimeline } from '@/components/AgentGateTimeline';
import { ModuleRelationshipMap } from '@/components/ModuleRelationshipMap';
import type { ModuleActionResult } from '@/lib/module-actions';
import type { ApprovalStatus, ModuleSpec, ModuleTask, RiskLevel } from '@/lib/module-registry';

const taskStateLabels: Record<ModuleTask['state'], string> = {
  todo: '待办',
  doing: '执行中',
  review: '审阅中',
  done: '完成',
};

const approvalLabels: Record<ApprovalStatus, string> = {
  not_started: '未开始',
  waiting: '待审批',
  approved: '已通过',
  rejected: '已驳回',
};

const riskClass: Record<RiskLevel, string> = {
  low: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  medium: 'border-amber-200 bg-amber-50 text-amber-900',
  high: 'border-orange-200 bg-orange-50 text-orange-900',
  critical: 'border-red-200 bg-red-50 text-red-900',
};

export function ModuleDetailWorkbench({
  spec,
  onAudit,
}: {
  spec: ModuleSpec;
  onAudit?: (event: ModuleActionResult['auditEvent']) => void;
}) {
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[2rem] border border-slate-800/10 bg-slate-950 text-white shadow-[0_30px_80px_rgba(15,23,42,0.24)]">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan-300">
              Module {String(spec.order).padStart(2, '0')} · {spec.id}
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] md:text-6xl">
              {spec.zhName}
            </h1>
            <p className="mt-2 text-lg text-white/64">{spec.enName}</p>
            <p className="mt-5 max-w-4xl text-base leading-8 text-white/72">{spec.summary}</p>
            <p className="mt-4 max-w-4xl rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm leading-7 text-white/72">
              <strong className="text-cyan-200">模块目标:</strong> {spec.objective}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <HeroMetric label="子域能力" value={String(spec.subdomains.length)} detail="Subdomain coverage" />
            <HeroMetric label="交付物" value={String(spec.artifacts.length)} detail="Artifacts with actions" />
            <HeroMetric label="文件类型" value={String(spec.fileTypes.length)} detail="Supported handover files" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Panel title="子域能力" icon={<Layers3 className="h-5 w-5" />}>
            <div className="grid gap-3 md:grid-cols-2">
              {spec.subdomains.map((subdomain) => (
                <article key={subdomain.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">{subdomain.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{subdomain.purpose}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                      {subdomain.capabilityLevel}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Owner: {subdomain.ownerRole}</p>
                </article>
              ))}
            </div>
          </Panel>

          <ModuleRelationshipMap spec={spec} />
          <AgentGateTimeline gates={spec.agentGates} />
          {onAudit ? (
            <ArtifactBoard key={spec.id} moduleId={spec.id} artifacts={spec.artifacts} onAudit={onAudit} />
          ) : (
            <ArtifactBoard key={spec.id} moduleId={spec.id} artifacts={spec.artifacts} />
          )}
        </div>

        <aside className="space-y-5">
          <Panel title="流程状态" icon={<Workflow className="h-5 w-5" />}>
            <div className="space-y-3">
              {spec.workflowStates.map((step) => (
                <div key={step.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-black text-slate-950">{step.name}</h3>
                    <span className="rounded-full bg-cyan-50 px-2 py-1 text-xs font-black text-cyan-800">
                      {step.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="任务列表" icon={<ListTodo className="h-5 w-5" />}>
            <div className="space-y-3">
              {spec.tasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-black text-slate-950">{task.title}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
                      {taskStateLabels[task.state]}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {task.assignee} · due {task.due}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="审批状态" icon={<ClipboardCheck className="h-5 w-5" />}>
            <div className="space-y-3">
              {spec.approvals.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <h3 className="font-black text-slate-950">{item.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {item.approver} · {approvalLabels[item.status]}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="风险 / 阻塞项" icon={<AlertTriangle className="h-5 w-5" />}>
            <div className="space-y-3">
              {spec.risks.map((item) => (
                <div key={item.id} className={`rounded-2xl border p-4 ${riskClass[item.level]}`}>
                  <p className="text-xs font-black uppercase tracking-[0.18em]">{item.level}</p>
                  <h3 className="mt-2 font-black">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6">{item.mitigation}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="文件类型" icon={<FileType2 className="h-5 w-5" />}>
            <div className="flex flex-wrap gap-2">
              {spec.fileTypes.map((fileType) => (
                <span key={fileType} className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
                  {fileType}
                </span>
              ))}
            </div>
          </Panel>

          <Panel title="可视化区域" icon={<MonitorCog className="h-5 w-5" />}>
            <div className="rounded-[1.5rem] border border-cyan-500/20 bg-slate-950 p-4 text-white">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">
                {spec.visualization.mode}
              </p>
              <h3 className="mt-2 text-xl font-black">{spec.visualization.title}</h3>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {spec.visualization.layers.map((layer) => (
                  <span key={layer} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs">
                    {layer}
                  </span>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-cyan-300/10 p-3">
                <p className="text-xs text-cyan-100">Telemetry</p>
                <p className="mt-2 text-xs leading-5 text-white/72">
                  {spec.visualization.telemetry.join(' · ')}
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="输入 / 输出" icon={<Boxes className="h-5 w-5" />}>
            <TokenGroup title="输入" items={spec.inputs} empty="起点模块或全局侧车" />
            <TokenGroup title="输出" items={spec.outputs} empty="终点模块或归档侧车" />
          </Panel>
        </aside>
      </section>
    </div>
  );
}

function HeroMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <p className="text-xs text-white/52">{label}</p>
      <p className="mt-2 text-4xl font-black tracking-[-0.06em] text-cyan-200">{value}</p>
      <p className="mt-2 text-xs text-white/52">{detail}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-800/10 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">{title}</h2>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
          {icon}
        </span>
      </div>
      {children}
    </section>
  );
}

function TokenGroup({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="mb-2 text-sm font-black text-slate-600">{title}</h3>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
          {empty}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
