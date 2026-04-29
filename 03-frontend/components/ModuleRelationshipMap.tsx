// components/ModuleRelationshipMap.tsx - Upstream/downstream module relationship view
// License: Apache-2.0

import Link from 'next/link';
import { ArrowRight, GitBranch } from 'lucide-react';
import { getModuleSpec, type ModuleId, type ModuleSpec } from '@/lib/module-registry';

function RelatedModuleCard({ moduleId, label }: { moduleId: ModuleId; label: string }) {
  const spec = getModuleSpec(moduleId);
  return (
    <Link
      href={spec.routeHref}
      className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-cyan-500 hover:shadow-[0_18px_44px_rgba(8,145,178,0.12)]"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <h3 className="mt-2 text-base font-black text-slate-950 group-hover:text-cyan-700">
        {spec.zhName}
      </h3>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {spec.id}
      </p>
    </Link>
  );
}

export function ModuleRelationshipMap({ spec }: { spec: ModuleSpec }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-800/10 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-700">
            Module graph
          </p>
          <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
            上游 / 下游模块关系
          </h2>
        </div>
        <GitBranch className="h-5 w-5 text-cyan-700" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_auto_1fr] xl:items-stretch">
        <div className="space-y-3">
          <p className="text-sm font-black text-slate-600">输入</p>
          {spec.inputs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              起点模块或全局平台能力。
            </div>
          ) : (
            spec.inputs.map((moduleId) => (
              <RelatedModuleCard key={moduleId} moduleId={moduleId} label="upstream" />
            ))
          )}
        </div>

        <div className="hidden items-center justify-center xl:flex">
          <div className="rounded-full bg-slate-950 p-4 text-white">
            <ArrowRight className="h-6 w-6" />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-black text-slate-600">输出</p>
          {spec.outputs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              终点模块、归档模块或全局侧车。
            </div>
          ) : (
            spec.outputs.map((moduleId) => (
              <RelatedModuleCard key={moduleId} moduleId={moduleId} label="downstream" />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
