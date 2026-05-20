// components/ModuleRelationshipMap.tsx - Upstream/downstream module relationship view
// License: Apache-2.0

import Link from 'next/link';
import { ArrowRight, GitBranch } from 'lucide-react';
import { getModuleSpec, type ModuleId, type ModuleSpec } from '@/lib/module-registry';

function RelatedModuleNode({ moduleId, label }: { moduleId: ModuleId; label: string }) {
  const spec = getModuleSpec(moduleId);
  return (
    <Link
      href={spec.routeHref}
      className="arch-huly-row-muted group p-4 transition hover:border-[var(--arch-primary)]"
    >
      <p className="font-mono arch-type-eyebrow text-slate-400">{label}</p>
      <h3 className="mt-2 arch-type-title font-black text-slate-950 group-hover:text-[var(--arch-primary)]">
        {spec.zhName}
      </h3>
      <p className="mt-1 font-mono arch-type-eyebrow text-slate-500">
        {spec.id}
      </p>
    </Link>
  );
}

export function ModuleRelationshipMap({ spec }: { spec: ModuleSpec }) {
  return (
    <section className="arch-huly-row rounded-lg p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono arch-type-eyebrow text-cyan-700">
            Module graph
          </p>
          <h2 className="arch-type-page font-black text-slate-950">
            上游 / 下游模块关系
          </h2>
        </div>
        <GitBranch className="h-5 w-5 text-cyan-700" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_auto_1fr] xl:items-stretch">
        <div className="space-y-3">
          <p className="arch-type-body font-black text-slate-600">输入</p>
          {spec.inputs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 arch-type-body text-slate-500">
              起点模块或全局平台能力。
            </div>
          ) : (
            spec.inputs.map((moduleId) => (
              <RelatedModuleNode key={moduleId} moduleId={moduleId} label="upstream" />
            ))
          )}
        </div>

        <div className="hidden items-center justify-center xl:flex">
          <div className="rounded-lg bg-slate-950 p-4 text-white">
            <ArrowRight className="h-6 w-6" />
          </div>
        </div>

        <div className="space-y-3">
          <p className="arch-type-body font-black text-slate-600">输出</p>
          {spec.outputs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 arch-type-body text-slate-500">
              终点模块、归档模块或全局侧车。
            </div>
          ) : (
            spec.outputs.map((moduleId) => (
              <RelatedModuleNode key={moduleId} moduleId={moduleId} label="downstream" />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
