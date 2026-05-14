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
import type { ReactNode } from 'react';
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
}: {
  spec: ModuleSpec;
  onAudit?: (event: ModuleAuditEvent) => void;
  onFeatureSelect?: (featureTitle: string) => void;
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

  return (
    <section className="space-y-3">
      <div className="arch-surface rounded-[1.25rem] border px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="arch-primary-text text-xs font-black uppercase tracking-[0.22em]">
              {spec.id} · file driven lifecycle
            </p>
            <h1 className="arch-text mt-1 truncate text-2xl font-black tracking-[-0.03em]">
              {safeProfile.title}
            </h1>
            <p className="arch-muted mt-1 max-w-5xl truncate text-sm">{safeProfile.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DrawerButton label="生命周期" icon={<GitBranch className="h-4 w-4" />} onClick={() => setDrawerMode('lifecycle')} />
            <DrawerButton label="审批" icon={<ClipboardCheck className="h-4 w-4" />} onClick={() => setDrawerMode('approval')} />
            <DrawerButton label="交付物" icon={<FileArchive className="h-4 w-4" />} onClick={() => setDrawerMode('artifacts')} />
            <DrawerButton label="审计" icon={<PanelRightOpen className="h-4 w-4" />} onClick={() => setDrawerMode('audit')} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {safeProfile.statusTracks.map((track) => (
            <span key={track} className="arch-chip rounded-full px-3 py-1 text-xs font-black">
              {track}
            </span>
          ))}
        </div>
      </div>

      <ModuleFileExplorer spec={spec} onAudit={handleAudit} />

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] items-start">
        <div className="arch-surface rounded-[1.25rem] border p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="arch-primary-text text-xs font-black uppercase tracking-[0.22em]">Business objects</p>
              <h2 className="arch-text mt-1 text-xl font-black">业务对象区</h2>
            </div>
            <p className="arch-muted text-sm">
              点击对象会写入审计；操作按钮会推动当前事务状态机。
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {safeProfile.features.map((feature) => (
              <button
                key={feature.id}
                type="button"
                onClick={() => selectFeature(feature)}
                className={`rounded-2xl border p-4 text-left transition hover:border-[var(--arch-primary)] hover:bg-[var(--arch-primary-soft)] ${
                  selectedFeature?.id === feature.id ? 'arch-card-selected' : 'arch-card'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="arch-text text-base font-black">{feature.title}</h3>
                  <FeatureStatus status={feature.status} />
                </div>
                <p className="arch-muted mt-2 line-clamp-2 text-sm leading-6">{feature.description}</p>
                <p className="arch-primary-text mt-3 text-xs font-bold">Owner: {feature.owner}</p>
              </button>
            ))}
          </div>
        </div>

        <aside className="arch-surface rounded-[1.25rem] border p-4 sticky top-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="arch-primary-text text-xs font-black uppercase tracking-[0.22em]">Selected object</p>
              <h2 className="arch-text mt-1 text-xl font-black">{selectedFeature?.title}</h2>
            </div>
            <Sparkles className="arch-primary-text h-5 w-5" />
          </div>
          <p className="arch-muted mt-3 text-sm leading-6">{selectedFeature?.description}</p>
          <div className="mt-3 space-y-2">
            {selectedFeature?.metrics.map((metric) => (
              <p key={metric} className="arch-card-muted rounded-xl px-3 py-2 text-xs font-bold">
                {metric}
              </p>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {safeProfile.operations.map((operation) => (
              <button
                key={operation.id}
                type="button"
                onClick={() => runOperation(operation)}
                className="arch-card-muted group flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition hover:border-[var(--arch-primary)] hover:bg-[var(--arch-primary-soft)]"
              >
                <span className="min-w-0">
                  <span className="arch-text block truncate text-sm font-black">{operation.label}</span>
                  <span className="arch-muted mt-1 block line-clamp-2 text-xs leading-5">
                    {operationStates[operation.id] ?? operation.result}
                  </span>
                </span>
                <ChevronRight className="arch-primary-text h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </aside>
      </section>

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
      className="arch-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition"
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
  return (
    <div className="arch-drawer fixed inset-y-0 right-0 z-[68] flex flex-col border-l p-4">
      <header className="arch-border flex items-center justify-between border-b pb-3">
        <div>
          <p className="arch-primary-text text-xs font-black uppercase tracking-[0.22em]">Drawer</p>
          <h2 className="mt-1 text-xl font-black">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="arch-btn flex h-10 w-10 items-center justify-center rounded-xl"
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
  return <span className={`rounded-full px-2 py-1 text-[11px] font-black ${className}`}>{label}</span>;
}

function AuditDrawerBody({ snapshot }: { snapshot: ModuleBackendSnapshot }) {
  return (
    <div className="space-y-3">
      <div className="arch-card-muted rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="arch-primary-text h-4 w-4" />
          <h3 className="arch-text font-black">当前事务</h3>
        </div>
        <p className="arch-muted mt-2 text-sm">
          {snapshot.transactions[0]?.type ?? '暂无事务'} · {snapshot.transactions[0]?.currentState ?? 'none'}
        </p>
      </div>
      {snapshot.auditEvents.length === 0 ? (
        <p className="arch-card-muted rounded-2xl border border-dashed p-4 text-sm leading-6">
          文件、上传、审批、生命周期和 AI 快捷操作都会写入这里。
        </p>
      ) : (
        snapshot.auditEvents.slice(0, 16).map((event) => (
          <div key={event.id} className="arch-card rounded-2xl p-3">
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

function inferLifecycleEvent(id: string, label: string): ModuleTransactionEvent {
  const lowered = `${id} ${label}`.toLowerCase();
  const matched = Object.entries(actionToLifecycleEvent).find(([keyword]) => lowered.includes(keyword));
  return matched?.[1] ?? 'generate';
}
