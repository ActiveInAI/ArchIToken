// components/FileManagerWorkbench.tsx - File-first business module workbench
// License: Apache-2.0
'use client';

import {
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileArchive,
  GitBranch,
  PanelRightOpen,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { useState } from 'react';
import { AgentGateTimeline } from '@/components/AgentGateTimeline';
import { ApprovalWorkflowPanel } from '@/components/ApprovalWorkflowPanel';
import { ArtifactBoard } from '@/components/ArtifactBoard';
import { LifecycleTransactionPanel } from '@/components/LifecycleTransactionPanel';
import { ModuleFileExplorer } from '@/components/ModuleFileExplorer';
import { ModuleRelationshipMap } from '@/components/ModuleRelationshipMap';
import { StateMachinePanel } from '@/components/StateMachinePanel';
import { createModuleAuditEvent } from '@/lib/module-actions';
import { moduleBackendAdapter, type ModuleBackendSnapshot } from '@/lib/module-backend-adapter';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
import {
  getAllowedLifecycleEvents,
  lifecycleStateLabels,
  type ModuleTransactionEvent,
} from '@/lib/module-lifecycle';
import { getModuleOperationalProfile, type ModuleFeatureCard, type ModuleOperationButton } from '@/lib/module-operations';
import type { ModuleSpec } from '@/lib/module-registry';

type DrawerMode = 'lifecycle' | 'approval' | 'artifacts' | 'audit' | null;

const actionToLifecycleEvent: Record<string, ModuleTransactionEvent> = {
  generate: 'generate',
  generator: 'generate',
  evaluate: 'evaluate',
  check: 'rule_check',
  rule: 'rule_check',
  schema: 'validate_schema',
  approval: 'request_approval',
  approve: 'approve',
  archive: 'archive',
};

export function FileManagerWorkbench({
  spec,
  onAudit,
  onFeatureSelect,
  sidecar,
}: {
  spec: ModuleSpec;
  onAudit?: (event: ModuleAuditEvent) => void;
  onFeatureSelect?: (featureTitle: string) => void;
  sidecar?: ReactNode;
}) {
  const profile = getModuleOperationalProfile(spec.id);
  const fallbackFeatures: ModuleFeatureCard[] = [
    {
      id: 'workspace',
      title: '工作区根',
      description: '模块默认工作区，用于承载业务对象、输入资料、过程文件、交付物、审批记录和审计归档。',
      status: 'ready',
      owner: spec.zhName,
      metrics: ['业务对象已初始化', '文件区已挂载', '审计链已启用'],
    },
    {
      id: 'business-objects',
      title: '业务对象',
      description: '模块核心业务对象与 OpenConstructionERP 生产数据映射。',
      status: 'running',
      owner: '业务负责人',
      metrics: ['对象状态可追踪', '支持审批流转', '支持证据绑定'],
    },
    {
      id: 'deliverables',
      title: '交付物',
      description: '模块输出的 Token、报告、模型、清单、审批记录和归档资料。',
      status: 'review',
      owner: '交付负责人',
      metrics: ['交付物可归档', '版本可追溯', '支持下游模块消费'],
    },
  ];

  const normalizedFeatures: ModuleFeatureCard[] = (profile?.features?.length ? profile.features : fallbackFeatures).map((feature) => ({
    id: feature.id,
    title: feature.title,
    description: feature.description,
    status: feature.status ?? 'ready',
    owner: feature.owner ?? spec.zhName,
    metrics: feature.metrics?.length ? feature.metrics : ['状态已初始化', '支持审计追踪', '支持业务流转'],
  }));

  const safeProfile = {
    title: profile?.title ?? spec.zhName,
    subtitle: profile?.subtitle ?? `${spec.zhName} · 企业级生产文件与业务对象工作台`,
    summary: profile?.summary ?? spec.summary,
    description: profile?.description ?? spec.objective,
    statusTracks: profile?.statusTracks?.length
      ? profile.statusTracks
      : ['业务对象', '输入资料', '过程文件', '交付物', '审批记录', '审计归档'],
    features: normalizedFeatures,
    operations: profile?.operations ?? [],
  };
  const [snapshot, setSnapshot] = useState<ModuleBackendSnapshot>(() => moduleBackendAdapter.snapshot(spec.id));
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(
    snapshot.transactions[0]?.id ?? null,
  );
  const [selectedFeatureId, setSelectedFeatureId] = useState(safeProfile.features[0]?.id ?? '');
  const [operationStates, setOperationStates] = useState<Record<string, string>>({});
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [objectPaneWidth, setObjectPaneWidth] = useState(380);

  const selectedFeature = safeProfile.features.find((feature) => feature.id === selectedFeatureId) ?? safeProfile.features[0];
  const selectedTransaction =
    snapshot.transactions.find((transaction) => transaction.id === selectedTransactionId) ??
    snapshot.transactions[0] ??
    null;

  function refreshLifecycle() {
    const nextSnapshot = moduleBackendAdapter.snapshot(spec.id);
    setSnapshot(nextSnapshot);
    if (!selectedTransactionId && nextSnapshot.transactions[0]) {
      setSelectedTransactionId(nextSnapshot.transactions[0].id);
    }
  }

  function handleAudit(event: ModuleAuditEvent) {
    onAudit?.(event);
    refreshLifecycle();
  }

  function selectFeature(feature: ModuleFeatureCard) {
    setSelectedFeatureId(feature.id);
    onFeatureSelect?.(feature.title);
    const event = createModuleAuditEvent(`${spec.id}-feature`, 'FileManagerWorkbench', `${spec.zhName}: 打开业务对象 ${feature.title}`);
    handleAudit(event);
  }

  function runOperation(operation: ModuleOperationButton) {
    let lifecycleSummary = '已记录操作事件';
    if (selectedTransaction) {
      const allowedEvents = getAllowedLifecycleEvents(selectedTransaction.currentState);
      const inferredEvent = inferLifecycleEvent(operation.id, operation.label);
      const event = allowedEvents.includes(inferredEvent) ? inferredEvent : allowedEvents[0];
      if (event) {
        const result = moduleBackendAdapter.transitionTransaction(selectedTransaction.id, event);
        setSelectedTransactionId(result.transaction.id);
        lifecycleSummary = `${event} -> ${lifecycleStateLabels[result.transaction.currentState]}`;
        onAudit?.(result.auditEvent);
      }
    }

    setOperationStates((current) => ({
      ...current,
      [operation.id]: `${operation.result} · ${lifecycleSummary}`,
    }));
    const auditEvent = createModuleAuditEvent(`${spec.id}-operation`, 'FileManagerWorkbench', `${spec.zhName}: ${operation.label} · ${lifecycleSummary}`);
    handleAudit(auditEvent);
  }

  function startObjectPaneResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = objectPaneWidth;

    function handlePointerMove(moveEvent: PointerEvent) {
      setObjectPaneWidth(clampWorkbenchPaneWidth(startWidth - (moveEvent.clientX - startX), 300, 580));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }

  const workbenchGridStyle = {
    '--object-pane-template': `minmax(0,1fr) ${objectPaneWidth}px`,
  } as CSSProperties;

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <div
        className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[var(--object-pane-template)]"
        style={workbenchGridStyle}
      >
        <ModuleFileExplorer spec={spec} onAudit={handleAudit} />

        <aside className="arch-surface relative flex min-h-0 flex-col overflow-hidden rounded-lg border">
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="调整业务对象侧栏宽度"
            onPointerDown={startObjectPaneResize}
            className="absolute inset-y-0 left-[-5px] z-20 hidden w-3 cursor-ew-resize touch-none xl:block"
            title="拖动调整业务对象侧栏宽度"
          />
          <header className="arch-surface-muted shrink-0 border-b px-3 py-3">
            <p className="arch-primary-text text-xs font-black uppercase tracking-[0.18em]">Business objects</p>
            <h2 className="arch-text mt-1 truncate text-lg font-black">业务对象 / 操作队列</h2>
            <p className="arch-muted mt-1 line-clamp-2 text-xs leading-5">{safeProfile.subtitle}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {safeProfile.statusTracks.map((track) => (
                <span
                  key={track}
                  className="arch-card rounded-md px-2 py-1 text-[11px] font-bold"
                >
                  {track}
                </span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <DrawerButton label="生命周期" icon={<GitBranch className="h-4 w-4" />} onClick={() => setDrawerMode('lifecycle')} />
              <DrawerButton label="审批" icon={<ClipboardCheck className="h-4 w-4" />} onClick={() => setDrawerMode('approval')} />
              <DrawerButton label="交付物" icon={<FileArchive className="h-4 w-4" />} onClick={() => setDrawerMode('artifacts')} />
              <DrawerButton label="审计" icon={<PanelRightOpen className="h-4 w-4" />} onClick={() => setDrawerMode('audit')} />
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto pb-16">
            {sidecar ? (
              <div className="border-b border-[var(--arch-border)]">
                {sidecar}
              </div>
            ) : null}
            <div className="grid gap-1 border-b border-[var(--arch-border)] p-2">
              {safeProfile.features.map((feature) => (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => selectFeature(feature)}
                  className={`rounded-md border px-3 py-2.5 text-left transition hover:border-[var(--arch-primary)] hover:bg-[var(--arch-primary-soft)] ${
                    selectedFeature?.id === feature.id ? 'arch-card-selected' : 'border-transparent hover:text-[var(--arch-primary)]'
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="arch-text block truncate text-sm font-black">{feature.title}</span>
                      <span className="arch-muted mt-1 block line-clamp-1 text-xs">{feature.description}</span>
                    </span>
                    <FeatureStatus status={feature.status} />
                  </span>
                </button>
              ))}
            </div>

            <div className="p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="arch-primary-text h-4 w-4" />
                <p className="arch-primary-text text-xs font-black uppercase tracking-[0.18em]">Selected object</p>
              </div>
              <h3 className="arch-text mt-1 text-lg font-black">{selectedFeature?.title}</h3>
              <p className="arch-muted mt-2 text-sm leading-6">{selectedFeature?.description}</p>
              <p className="arch-primary-text mt-2 text-xs font-bold">Owner: {selectedFeature?.owner}</p>

              <div className="mt-3 grid gap-2">
                {selectedFeature?.metrics.map((metric) => (
                  <p key={metric} className="arch-card-muted rounded-md px-3 py-2 text-xs font-bold">
                    {metric}
                  </p>
                ))}
              </div>

              {safeProfile.operations.length > 0 ? (
                <div className="mt-4 grid gap-2">
                  {safeProfile.operations.map((operation) => (
                    <button
                      key={operation.id}
                      type="button"
                      onClick={() => runOperation(operation)}
                      className="arch-card group flex items-center justify-between gap-3 rounded-md px-3 py-3 text-left transition hover:border-[var(--arch-primary)] hover:bg-[var(--arch-primary-soft)]"
                    >
                      <span className="min-w-0">
                        <span className="arch-text block truncate text-sm font-black">{operation.label}</span>
                        <span className="arch-muted mt-1 block line-clamp-2 text-xs leading-5">
                          {operationStates[operation.id] ?? operation.result}
                        </span>
                      </span>
                      <ChevronRight className="arch-primary-text h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      {drawerMode ? (
        <WorkbenchDrawer title={drawerTitle(drawerMode)} onClose={() => setDrawerMode(null)}>
          {drawerMode === 'lifecycle' ? (
            <div className="space-y-3">
              <LifecycleTransactionPanel
                moduleId={spec.id}
                transactions={snapshot.transactions}
                selectedTransactionId={selectedTransaction?.id ?? null}
                onSelect={setSelectedTransactionId}
                onRefresh={refreshLifecycle}
                onAudit={handleAudit}
              />
              <StateMachinePanel transaction={selectedTransaction} />
            </div>
          ) : null}
          {drawerMode === 'approval' ? (
            <ApprovalWorkflowPanel
              transaction={selectedTransaction}
              onRefresh={refreshLifecycle}
              onAudit={handleAudit}
            />
          ) : null}
          {drawerMode === 'artifacts' ? (
            <div className="space-y-3">
              <AgentGateTimeline gates={spec.agentGates} />
              {onAudit ? (
                <ArtifactBoard key={spec.id} moduleId={spec.id} artifacts={spec.artifacts} onAudit={onAudit} />
              ) : (
                <ArtifactBoard key={spec.id} moduleId={spec.id} artifacts={spec.artifacts} />
              )}
              <ModuleRelationshipMap spec={spec} />
            </div>
          ) : null}
          {drawerMode === 'audit' ? (
            <AuditDrawerBody snapshot={snapshot} />
          ) : null}
        </WorkbenchDrawer>
      ) : null}
    </section>
  );
}

function DrawerButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="arch-btn inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-black transition"
    >
      {icon}
      {label}
    </button>
  );
}

function WorkbenchDrawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const [drawerWidth, setDrawerWidth] = useState(520);

  function startDrawerResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = drawerWidth;

    function handlePointerMove(moveEvent: PointerEvent) {
      setDrawerWidth(clampWorkbenchPaneWidth(startWidth - (moveEvent.clientX - startX), 360, Math.max(520, window.innerWidth - 32)));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }

  return (
    <div
      className="arch-drawer fixed inset-y-0 right-0 z-[68] flex flex-col border-l p-4"
      style={{ width: `min(${drawerWidth}px, calc(100vw - 2rem))` }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="调整工程抽屉宽度"
        onPointerDown={startDrawerResize}
        className="absolute inset-y-0 left-[-5px] z-20 w-3 cursor-ew-resize touch-none"
        title="拖动调整工程抽屉宽度"
      />
      <header className="arch-border flex items-center justify-between border-b pb-3">
        <div>
          <p className="arch-primary-text text-xs font-black uppercase tracking-[0.22em]">Drawer</p>
          <h2 className="mt-1 text-xl font-black">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="arch-btn flex h-10 w-10 items-center justify-center rounded-md"
          aria-label="关闭抽屉"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto py-4">{children}</div>
    </div>
  );
}

function FeatureStatus({ status }: { status: ModuleFeatureCard['status'] }) {
  const className =
    status === 'blocked'
      ? 'bg-red-50 text-red-700'
      : status === 'review'
        ? 'bg-amber-50 text-amber-700'
        : status === 'running'
          ? 'bg-blue-50 text-blue-700'
          : 'arch-chip';
  const label =
    status === 'blocked'
      ? '阻断'
      : status === 'review'
        ? '审阅'
        : status === 'running'
          ? '运行'
          : '就绪';
  return <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-black ${className}`}>{label}</span>;
}

function AuditDrawerBody({ snapshot }: { snapshot: ModuleBackendSnapshot }) {
  return (
    <div className="space-y-3">
      <div className="arch-card-muted rounded-lg p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="arch-primary-text h-4 w-4" />
          <h3 className="arch-text font-black">当前事务</h3>
        </div>
        <p className="arch-muted mt-2 text-sm">
          {snapshot.transactions[0]?.type ?? '暂无事务'} · {snapshot.transactions[0]?.currentState ?? 'none'}
        </p>
      </div>
      {snapshot.auditEvents.length === 0 ? (
        <p className="arch-card-muted rounded-lg border border-dashed p-4 text-sm leading-6">
          文件、上传、审批、生命周期和 AI 快捷操作都会写入这里。
        </p>
      ) : (
        snapshot.auditEvents.slice(0, 16).map((event) => (
          <div key={event.id} className="arch-card rounded-lg p-3">
            <p className="arch-text text-sm font-black">{event.summary}</p>
            <p className="arch-muted mt-2 text-xs">{event.actor} · {event.at}</p>
          </div>
        ))
      )}
    </div>
  );
}

function drawerTitle(mode: Exclude<DrawerMode, null>) {
  if (mode === 'lifecycle') {
    return '生命周期事务 / 状态机';
  }
  if (mode === 'approval') {
    return '审批工作流';
  }
  if (mode === 'artifacts') {
    return 'AI 工程链 / 交付物';
  }
  return '审计事件流';
}

function clampWorkbenchPaneWidth(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function inferLifecycleEvent(id: string, label: string): ModuleTransactionEvent {
  const lowered = `${id} ${label}`.toLowerCase();
  const matched = Object.entries(actionToLifecycleEvent).find(([keyword]) => lowered.includes(keyword));
  return matched?.[1] ?? 'generate';
}
