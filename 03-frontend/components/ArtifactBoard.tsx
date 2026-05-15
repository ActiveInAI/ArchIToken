// components/ArtifactBoard.tsx - Interactive artifact action board
// License: Apache-2.0
'use client';

import { Archive, Check, FileCheck2, Play, ScanSearch, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { createModuleAuditEvent, runModuleAction, type ModuleActionResult } from '@/lib/module-actions';
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
  const [selectedArtifactId, setSelectedArtifactId] = useState(artifacts[0]?.id ?? '');
  const selectedArtifact = items.find((artifact) => artifact.id === selectedArtifactId) ?? items[0];

  function runAction(artifact: ArtifactSpec, action: ModuleAction) {
    const result = runModuleAction(moduleId, artifact, action);
    setItems((current) =>
      current.map((item) => (item.id === artifact.id ? result.artifact : item)),
    );
    onAudit?.(result.auditEvent);
  }

  function selectArtifact(artifact: ArtifactSpec) {
    setSelectedArtifactId(artifact.id);
    onAudit?.(
      createModuleAuditEvent(
        `${moduleId}-${artifact.id}-select`,
        'ArtifactBoard',
        `open artifact detail -> ${artifact.name}`,
      ),
    );
  }

  return (
    <section className="arch-card rounded-lg p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="arch-primary-text font-mono text-[10px] uppercase tracking-[0.28em]">
            Artifacts
          </p>
          <h2 className="arch-text text-2xl font-black tracking-[-0.04em]">
            交付物操作板
          </h2>
        </div>
        <p className="arch-muted text-sm">
          点击会推进当前会话状态并写入审计面板。
        </p>
      </div>

      {selectedArtifact ? (
        <div className="arch-card-muted mt-5 rounded-lg p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="arch-primary-text font-mono text-[10px] uppercase tracking-[0.24em]">
                Selected artifact
              </p>
              <h3 className="mt-1 text-2xl font-black">{selectedArtifact.name}</h3>
              <p className="arch-muted mt-2 text-sm">
                {selectedArtifact.type} · Owner {selectedArtifact.owner} · Updated {selectedArtifact.updatedAt}
              </p>
            </div>
            <span className="arch-chip rounded-md px-3 py-1 text-xs font-black">
              {artifactStatusLabels[selectedArtifact.status]}
            </span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {selectedArtifact.evidence.slice(-6).map((item) => (
              <span key={item} className="arch-card rounded-md px-3 py-2 text-xs leading-5">
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {items.map((artifact) => (
          <article
            key={artifact.id}
            className={`rounded-lg border p-4 transition ${
              artifact.id === selectedArtifact?.id
                ? 'arch-card-selected'
                : 'arch-card-muted'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="arch-primary-text font-mono text-[10px] uppercase tracking-[0.18em]">
                  {artifact.type}
                </p>
                <h3 className="arch-text mt-1 text-lg font-black">{artifact.name}</h3>
              </div>
              <span className="arch-chip rounded-md px-3 py-1 text-xs font-black">
                {artifactStatusLabels[artifact.status]}
              </span>
            </div>
            <p className="arch-muted mt-3 text-sm">Owner: {artifact.owner}</p>
            <p className="arch-muted mt-1 text-xs">Updated: {artifact.updatedAt}</p>

            <button
              type="button"
              onClick={() => selectArtifact(artifact)}
              className="arch-btn mt-3 w-full rounded-md px-3 py-2 text-xs font-black transition"
            >
              查看 artifact 详情
            </button>

            <div className="arch-card mt-4 rounded-md p-3">
              <p className="arch-primary-text text-xs font-black">Evidence</p>
              <ul className="arch-muted mt-2 space-y-1 text-xs leading-5">
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
                  className="arch-btn inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-black transition"
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
