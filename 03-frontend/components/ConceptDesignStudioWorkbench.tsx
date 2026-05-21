// components/ConceptDesignStudioWorkbench.tsx - Concept design embedded Studio dashboard
// License: Apache-2.0
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BadgeCheck, ClipboardList, FolderOpen, Plus } from 'lucide-react';
import { CanvasTabs } from '@/components/studio/editor/canvas/canvas-tabs';
import { ClaimButton } from '@/components/studio/editor/claim-button';
import { ConstraintWarningBadge } from '@/components/studio/editor/constraint-warning';
import { StudioEditorShell } from '@/components/studio/editor/editor-shell';
import { ExportDialog } from '@/components/studio/editor/export-dialog';
import { MiddlePanelRouter } from '@/components/studio/editor/middle/panel-router';
import { StudioPropertiesPanel } from '@/components/studio/editor/properties/properties-panel';
import { CreateGeneratingView } from '@/components/studio/create/generating-view';
import { ProposalsView } from '@/components/studio/create/proposals-view';
import { CreateStep1Entry } from '@/components/studio/create/step-1-entry';
import { CreateStep2Form } from '@/components/studio/create/step-2-form';
import { ToastProvider } from '@/components/studio/shared/toast-provider';
import { WorkCard } from '@/components/shared/work-card';
import { WorkDetailDialog } from '@/components/shared/work-detail-dialog';
import { DESIGNER_LEVELS } from '@/content/designer-levels';
import { mockWorks, type Work } from '@/content/works.mock';
import type { StudioView } from '@/lib/insome/types';
import { useDesignerStats } from '@/lib/designer-stats';
import { createModuleAuditEvent } from '@/lib/module-actions';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
import { usePublishWork } from '@/lib/publish-work';
import { ProposalGeneratorScope, ScriptedProposalGenerator } from '@/lib/proposal';
import { useStudioCreateStore } from '@/stores/studio-create.store';
import { useStudioEditorStore } from '@/stores/studio-editor.store';
import { useStudioViewStore } from '@/stores/studio-view.store';

const photoCovers: Record<string, string> = {
  'w-023': '/assets/projects-photo/villa-pool.svg',
  'w-024': '/assets/projects-photo/ryokan.svg',
  'w-025': '/assets/projects-photo/camp.svg',
  'w-027': '/assets/projects-photo/resort.svg',
  'w-028': '/assets/projects-photo/alpine.svg',
  'w-004': '/assets/projects-photo/ryokan.svg',
  'w-005': '/assets/projects-photo/interior.svg',
  'w-006': '/assets/projects-photo/alpine.svg',
  'w-007': '/assets/projects-photo/villa-pool.svg',
};

function withPhotoCovers(works: ReadonlyArray<Work>): Work[] {
  return works.map((work) => ({
    ...work,
    thumbnail: photoCovers[work.id] ?? work.thumbnail,
  }));
}

export function ConceptDesignStudioWorkbench({
  onAudit,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [lastAction, setLastAction] = useState<string | null>(null);
  const view = useStudioViewStore((state) => state.view);
  const activeProjectId = useStudioViewStore((state) => state.activeProjectId);
  const activeProposalId = useStudioViewStore((state) => state.activeProposalId);
  const startCreate = useStudioViewStore((state) => state.startCreate);
  const resetEditor = useStudioEditorStore((state) => state.resetEditor);
  const setProposals = useStudioCreateStore((state) => state.setProposals);

  const provider = useMemo(
    () =>
      new ScriptedProposalGenerator({
        sleepMs: 2400,
      }),
    [],
  );

  useEffect(() => {
    if (view === 'editor') resetEditor();
  }, [view, activeProjectId, activeProposalId, resetEditor]);

  useEffect(() => {
    if (view === 'projects') {
      setProposals([]);
    }
  }, [view, setProposals]);

  function emitAction(action: string, summary: string) {
    setLastAction(summary);
    onAudit?.(createModuleAuditEvent(action, 'ConceptDesignStudioWorkbench', summary));
  }

  function handleNewWork() {
    startCreate();
    emitAction('concept-design-new-work', '方案设计新建作品入口已打开');
  }

  return (
    <ProposalGeneratorScope value={provider}>
      <section className="arch-concept-studio-home arch-module-accent-yellow min-h-[calc(100vh-9rem)]">
        {view === 'projects' ? (
          <div className="flex w-full flex-col gap-8 px-4 py-8 xl:px-6">
            <ConceptDesignerLevelCard />
            <ConceptDesignStudioActions onAction={emitAction} onNewWork={handleNewWork} />
            {lastAction ? (
              <div className="rounded-md border border-[var(--module-accent)] bg-[var(--module-accent-soft)] px-4 py-2 font-mono text-micro tracking-eyebrow text-[var(--module-accent)]">
                {lastAction}
              </div>
            ) : null}
            <ConceptDesignPeerFeed />
          </div>
        ) : (
          <ConceptDesignCreateSurface view={view} />
        )}
        <ToastProvider />
      </section>
    </ProposalGeneratorScope>
  );
}

function ConceptDesignCreateSurface({
  view,
}: {
  view: StudioView;
}) {
  const tExport = useTranslations('studio.export');
  const exitToProjects = useStudioViewStore((state) => state.exitToProjects);
  const activeProposalId = useStudioViewStore((state) => state.activeProposalId);
  const projectName = activeProposalId ? `方案编辑 · Proposal ${activeProposalId.slice(-1).toUpperCase()}` : '方案编辑';
  const showFlowHeader = view !== 'editor';

  return (
    <div className="arch-concept-create-flow flex min-h-[calc(100vh-9rem)] flex-col bg-[var(--arch-bg)] text-[var(--arch-text)]">
      {showFlowHeader ? (
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--arch-border)] bg-[var(--arch-surface)] px-4 py-2">
          <button
            type="button"
            onClick={exitToProjects}
            className="rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] px-3 py-1.5 arch-type-caption text-[var(--arch-text)] hover:border-[var(--module-accent)] hover:text-[var(--module-accent)]"
          >
            ← 返回设计师首页
          </button>
          <span className="font-mono arch-type-caption text-[var(--arch-text-muted)]">方案设计 / 新建作品</span>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {renderConceptCreateView(view, projectName, tExport('label'))}
      </div>
    </div>
  );
}

function renderConceptCreateView(view: StudioView, projectName: string, exportLabel: string) {
  if (view === 'create-step-1') return <CreateStep1Entry />;
  if (view === 'create-step-2') return <CreateStep2Form />;
  if (view === 'create-generating') return <CreateGeneratingView />;
  if (view === 'create-proposals') return <ProposalsView />;
  return (
    <StudioEditorShell
      middle={<MiddlePanelRouter />}
      canvas={<CanvasTabs />}
      properties={
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-fg-2 bg-fg-0 px-3 py-2">
            <span className="truncate font-mono text-micro tracking-eyebrow uppercase text-fg-4">
              {projectName}
            </span>
            <div className="flex items-center gap-2">
              <ConstraintWarningBadge />
              <ExportDialog>
                <button
                  type="button"
                  className="border border-fg-2 bg-fg-0 px-3 py-1.5 font-mono text-micro tracking-eyebrow uppercase text-fg-4 transition-colors hover:border-accent-lime hover:text-fg-8"
                >
                  ↗ {exportLabel}
                </button>
              </ExportDialog>
              <ClaimButton source="studio-editor" />
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <StudioPropertiesPanel />
          </div>
        </div>
      }
    />
  );
}

function ConceptDesignerLevelCard() {
  const t = useTranslations();
  const tLevel = useTranslations('workspace.studio.level');
  const stats = useDesignerStats();
  const levelMeta = DESIGNER_LEVELS[stats.level - 1]!;
  const progress =
    stats.nextLevelThreshold !== null
      ? Math.min(stats.points / stats.nextLevelThreshold, 1)
      : 1;
  const remaining = stats.nextLevelThreshold !== null ? stats.nextLevelThreshold - stats.points : 0;

  return (
    <div className="rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface)] p-6 text-[var(--arch-text)] shadow-[var(--arch-shadow)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-display text-h2 font-extrabold tracking-tight text-[var(--arch-text)]">
            Lv{stats.level}
          </span>
          <span className="font-display text-h4 font-bold tracking-tight text-[var(--arch-text)]">
            {t(levelMeta.nameKey)}
          </span>
          <span className="font-mono text-micro tracking-eyebrow uppercase text-[var(--arch-text-muted)]">
            {tLevel('designer')}
          </span>
        </div>
        {stats.isVerified ? (
          <span className="flex items-center gap-1 rounded-md border border-[var(--module-accent)] bg-[var(--module-accent-soft)] px-2.5 py-1 font-mono text-micro tracking-eyebrow uppercase text-[var(--module-accent)]">
            <BadgeCheck size={12} aria-hidden /> {tLevel('verified')}
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-8">
        <ConceptDesignerMetric
          label={tLevel('accumulatedRebate')}
          value={`¥${stats.accumulatedRebate.toLocaleString()}`}
          primary
        />
        {stats.nextLevelThreshold !== null ? (
          <ConceptDesignerMetric label={tLevel('nextLevelHint')} value={`¥${remaining.toLocaleString()}`} />
        ) : null}
        <ConceptDesignerMetric label={tLevel('rebateRate')} value={`${stats.rebatePercent}%`} />
      </div>

      {stats.nextLevelThreshold !== null ? (
        <div className="mt-5">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--arch-surface-muted)]">
            <div
              className="h-full bg-[var(--module-accent)] transition-[width]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-micro tracking-eyebrow uppercase text-[var(--arch-text-muted)]">
            <span>
              {tLevel('points')}: {stats.points.toLocaleString()}
            </span>
            <span>{stats.nextLevelThreshold.toLocaleString()}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ConceptDesignerMetric({
  label,
  value,
  primary = false,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-micro tracking-eyebrow uppercase text-[var(--arch-text-muted)]">
        {label}
      </span>
      <span
        className={`font-display font-extrabold tracking-tight ${
          primary
            ? 'text-h2 text-[var(--module-accent)]'
            : 'text-h4 text-[var(--arch-text)]'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ConceptDesignStudioActions({
  onAction,
  onNewWork,
}: {
  onAction: (action: string, summary: string) => void;
  onNewWork: () => void;
}) {
  const tActions = useTranslations('workspace.studio.actions');
  const { listPublished } = usePublishWork();
  const stats = useDesignerStats();
  const publishedCount = listPublished().length || stats.publishedWorks;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <button
        type="button"
        onClick={onNewWork}
        className="flex items-center justify-between rounded-md border border-[var(--module-accent)] bg-[var(--module-accent)] px-5 py-4 font-mono text-small tracking-eyebrow uppercase text-[var(--module-accent-foreground)] transition-opacity hover:opacity-90"
      >
        <span className="flex items-center gap-2">
          <Plus size={16} aria-hidden /> {tActions('newWork')}
        </span>
        <span className="font-display text-h4 font-bold">→</span>
      </button>
      <button
        type="button"
        onClick={() => onAction('concept-design-my-works', '方案设计我的作品入口已记录')}
        className="flex items-center justify-between rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface)] px-5 py-4 font-mono text-small tracking-eyebrow uppercase text-[var(--arch-text)] transition-colors hover:border-[var(--module-accent)] hover:text-[var(--module-accent)]"
      >
        <span className="flex items-center gap-2">
          <FolderOpen size={16} aria-hidden /> {tActions('myWorks')}
        </span>
        <span className="font-display text-h4 font-bold">{publishedCount}</span>
      </button>
      <button
        type="button"
        onClick={() => onAction('concept-design-orders', '方案设计订单入口已记录')}
        className="flex items-center justify-between rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface)] px-5 py-4 font-mono text-small tracking-eyebrow uppercase text-[var(--arch-text)] transition-colors hover:border-[var(--module-accent)] hover:text-[var(--module-accent)]"
      >
        <span className="flex items-center gap-2">
          <ClipboardList size={16} aria-hidden /> {tActions('orders')}
        </span>
        <span className="font-display text-h4 font-bold">3</span>
      </button>
    </div>
  );
}

function ConceptDesignPeerFeed() {
  const tPeer = useTranslations('workspace.studio.peer');
  const [openId, setOpenId] = useState<string | null>(null);

  const photoWorks = useMemo(() => withPhotoCovers(mockWorks), []);
  const weeklyHot = useMemo(
    () => [...photoWorks].sort((a, b) => b.likes - a.likes).slice(0, 8),
    [photoWorks],
  );
  const newDesigners = useMemo(
    () =>
      photoWorks
        .filter((work) => !work.creator.isHomeowner && work.creator.level <= 2)
        .slice(0, 6),
    [photoWorks],
  );
  const work = photoWorks.find((item) => item.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-10">
      <ConceptDesignFeedRow title={tPeer('weeklyHot')} works={weeklyHot} onOpen={setOpenId} />
      <ConceptDesignFeedRow title={tPeer('newDesigners')} works={newDesigners} onOpen={setOpenId} />
      <WorkDetailDialog
        work={work}
        open={openId !== null}
        theme="light"
        onOpenChange={(open) => !open && setOpenId(null)}
      />
    </div>
  );
}

function ConceptDesignFeedRow({
  title,
  works,
  onOpen,
}: {
  title: string;
  works: ReadonlyArray<Work>;
  onOpen: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-3 font-mono text-micro tracking-eyebrow uppercase text-[var(--arch-text-muted)]">
        {title}
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">
        {works.map((work) => (
          <div key={work.id} className="w-64 shrink-0">
            <WorkCard work={work} theme="light" onOpen={onOpen} />
          </div>
        ))}
      </div>
    </section>
  );
}
