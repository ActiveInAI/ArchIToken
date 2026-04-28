// components/ArtifactBoard.tsx - Interactive artifact action board
// License: Apache-2.0
'use client';

import { Archive, Check, FileCheck2, Play, ScanSearch, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { runModuleAction, type ModuleActionResult } from '@/lib/module-actions';
import {
  artifactStatusLabels,
  moduleActionLabels,
  type ArtifactSpec,
  type ModuleAction,
  type ModuleId,
} from '@/lib/module-registry';

const actions: ModuleAction[] = [
  'generate',
  'evaluate',
  'rule_check',
  'schema_validate',
  'approve',
  'archive',
];

const actionIcons: Record<ModuleAction, ReactNode> = {
  generate: <Play className="h-3.5 w-3.5" />,
  evaluate: <ScanSearch className="h-3.5 w-3.5" />,
  rule_check: <ShieldCheck className="h-3.5 w-3.5" />,
  schema_validate: <FileCheck2 className="h-3.5 w-3.5" />,
  approve: <Check className="h-3.5 w-3.5" />,
  archive: <Archive className="h-3.5 w-3.5" />,
};

export function ArtifactBoard({
  moduleId,
  artifacts,
  onAudit,
}: {
  moduleId: ModuleId;
  artifacts: ArtifactSpec[];
  onAudit?: (event: ModuleActionResult['auditEvent']) => void;
}) {
  const [items, setItems] = useState(() =>
    artifacts.map((artifact) => ({ ...artifact, evidence: [...artifact.evidence] })),
  );

  function runAction(artifact: ArtifactSpec, action: ModuleAction) {
    const result = runModuleAction(moduleId, artifact, action);
    setItems((current) =>
      current.map((item) => (item.id === artifact.id ? result.artifact : item)),
    );
    onAudit?.(result.auditEvent);
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-800/10 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-700">
            Artifacts
          </p>
          <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">
            交付物操作板
          </h2>
        </div>
        <p className="text-sm text-slate-500">
          当前为 mock action handlers,点击会立即改变本地 UI 状态并写入审计面板。
        </p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {items.map((artifact) => (
          <article key={artifact.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  {artifact.type}
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-950">{artifact.name}</h3>
              </div>
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
                {artifactStatusLabels[artifact.status]}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">Owner: {artifact.owner}</p>
            <p className="mt-1 text-xs text-slate-500">Updated: {artifact.updatedAt}</p>

            <div className="mt-4 rounded-xl bg-white p-3">
              <p className="text-xs font-black text-slate-500">Evidence</p>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-700">
                {artifact.evidence.slice(-3).map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {actions.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => runAction(artifact, action)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-800 transition hover:border-cyan-500 hover:bg-cyan-50"
                >
                  {actionIcons[action]}
                  {moduleActionLabels[action]}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
