// components/AgentGateTimeline.tsx - Planner to Approver gate timeline
// License: Apache-2.0

import {
  CheckCircle2,
  CircleDot,
  Clock3,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import type { AgentGate, AgentGateStatus } from '@/lib/module-registry';

const statusText: Record<AgentGateStatus, string> = {
  pending: '待执行',
  running: '执行中',
  passed: '通过',
  blocked: '阻塞',
};

const statusIcon: Record<AgentGateStatus, LucideIcon> = {
  pending: Clock3,
  running: CircleDot,
  passed: CheckCircle2,
  blocked: ShieldAlert,
};

export function AgentGateTimeline({ gates }: { gates: AgentGate[] }) {
  return (
    <section className="arch-card rounded-lg p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-700">
            AI delivery gates
          </p>
          <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
            Planner → Generator → Evaluator → RuleChecker → SchemaValidator → Approver
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-slate-500">
          Generator 不自评,每个工程输出必须被独立评估、规则校核、Schema 验证和审批。
        </p>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-6">
        {gates.map((gate) => {
          const Icon = statusIcon[gate.status];
          return (
            <article
              key={gate.id}
              className={`rounded-lg border p-4 ${
                gate.status === 'passed'
                  ? 'border-emerald-200 bg-emerald-50'
                  : gate.status === 'running'
                    ? 'border-cyan-200 bg-cyan-50'
                    : gate.status === 'blocked'
                      ? 'border-red-200 bg-red-50'
                      : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <Icon className="h-4 w-4 text-slate-900" />
                <span className="rounded-md bg-white px-2 py-1 text-[10px] font-black text-slate-600">
                  {statusText[gate.status]}
                </span>
              </div>
              <h3 className="mt-3 text-base font-black text-slate-950">{gate.name}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">{gate.responsibility}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
