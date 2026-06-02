// components/AICenterManagementPanels.tsx
// License: Apache-2.0
'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Database,
  FileJson,
  Gauge,
  Lock,
  Network,
  Plug,
  RefreshCw,
  ShieldCheck,
  Table,
  Workflow,
} from 'lucide-react';
import {
  api,
  type AiCenterDatabaseBinding,
  type AiCenterInterfaceContract,
  type AiCenterManagementResponse,
  type AiCenterManagementStatus,
  type AiCenterVisualizationPanel,
} from '@/lib/api';
import { createModuleAuditEvent } from '@/lib/module-actions';
import type { ModuleAuditEvent } from '@/lib/module-file-system';

type ManagementPanelId = 'interfaces' | 'databases' | 'visualization';

const STATUS_META: Record<AiCenterManagementStatus, { label: string; className: string }> = {
  configured: {
    label: '已接入',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  approved: {
    label: '已批准',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  review: {
    label: '待审批',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  draft: {
    label: '待配置',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
  },
  disabled: {
    label: '已停用',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
};

const MANAGEMENT_PANELS: {
  id: ManagementPanelId;
  label: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    id: 'interfaces',
    label: '接口管理',
    description: '读取并更新后端 ai_center_interface_contracts。',
    icon: <Plug className="h-4 w-4" />,
  },
  {
    id: 'databases',
    label: '数据库管理',
    description: '读取并更新后端 ai_center_database_bindings。',
    icon: <Database className="h-4 w-4" />,
  },
  {
    id: 'visualization',
    label: '可视化面板',
    description: '读取并更新后端 ai_center_visualization_panels。',
    icon: <BarChart3 className="h-4 w-4" />,
  },
];

export function AICenterManagementPanels({
  compact = false,
  onAudit,
}: {
  compact?: boolean;
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [activePanel, setActivePanel] = useState<ManagementPanelId>('interfaces');
  const [data, setData] = useState<AiCenterManagementResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emitAudit = (action: string, detail: string) => {
    onAudit?.(createModuleAuditEvent(action, 'AICenterManagementPanels', detail));
  };

  const loadManagement = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.aiCenter.management();
      setData(payload);
      emitAudit(
        'ai-center-management-refresh',
        `AI 中心管理数据已从 Gateway 刷新: ${payload.interfaceContracts.length}/${payload.databaseBindings.length}/${payload.visualizationPanels.length}`,
      );
    } catch (err) {
      setError(apiErrorMessage(err, 'AI 中心管理接口不可用'));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadManagement();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(
    () => [
      {
        label: '接口合同',
        value: String(data?.interfaceContracts.length ?? 0),
        detail: `${countStatus(data?.interfaceContracts ?? [], 'configured')} 已接入`,
        icon: <Network className="h-4 w-4" />,
      },
      {
        label: '数据对象',
        value: String(data?.databaseBindings.length ?? 0),
        detail: `${countStatus(data?.databaseBindings ?? [], 'review')} 待审批`,
        icon: <Table className="h-4 w-4" />,
      },
      {
        label: '运行视图',
        value: String(data?.visualizationPanels.length ?? 0),
        detail: `${countStatus(data?.visualizationPanels ?? [], 'approved')} 已批准`,
        icon: <Activity className="h-4 w-4" />,
      },
    ],
    [data],
  );

  const updateInterfaceStatus = async (contractKey: string, status: AiCenterManagementStatus) => {
    setSavingKey(`interface:${contractKey}`);
    setError(null);
    try {
      const updated = await api.aiCenter.updateInterfaceContract(contractKey, {
        status,
        metadata: { updatedFrom: 'ai_center_workbench' },
      });
      setData((current) =>
        current
          ? {
              ...current,
              interfaceContracts: current.interfaceContracts.map((item) =>
                item.contractKey === updated.contractKey ? updated : item,
              ),
            }
          : current,
      );
      emitAudit('ai-interface-contract-update', `接口合同状态已写回数据库: ${updated.contractKey} -> ${updated.status}`);
    } catch (err) {
      setError(apiErrorMessage(err, '接口合同状态写回失败'));
    } finally {
      setSavingKey(null);
    }
  };

  const updateDatabaseStatus = async (bindingKey: string, status: AiCenterManagementStatus) => {
    setSavingKey(`database:${bindingKey}`);
    setError(null);
    try {
      const updated = await api.aiCenter.updateDatabaseBinding(bindingKey, {
        status,
        metadata: { updatedFrom: 'ai_center_workbench' },
      });
      setData((current) =>
        current
          ? {
              ...current,
              databaseBindings: current.databaseBindings.map((item) =>
                item.bindingKey === updated.bindingKey ? updated : item,
              ),
            }
          : current,
      );
      emitAudit('ai-database-binding-update', `数据库绑定状态已写回数据库: ${updated.bindingKey} -> ${updated.status}`);
    } catch (err) {
      setError(apiErrorMessage(err, '数据库绑定状态写回失败'));
    } finally {
      setSavingKey(null);
    }
  };

  const updateVisualizationStatus = async (panelKey: string, status: AiCenterManagementStatus) => {
    setSavingKey(`visualization:${panelKey}`);
    setError(null);
    try {
      const updated = await api.aiCenter.updateVisualizationPanel(panelKey, {
        status,
        metadata: { updatedFrom: 'ai_center_workbench' },
      });
      setData((current) =>
        current
          ? {
              ...current,
              visualizationPanels: current.visualizationPanels.map((item) =>
                item.panelKey === updated.panelKey ? updated : item,
              ),
            }
          : current,
      );
      emitAudit('ai-visualization-panel-update', `可视化面板状态已写回数据库: ${updated.panelKey} -> ${updated.status}`);
    } catch (err) {
      setError(apiErrorMessage(err, '可视化面板状态写回失败'));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className={compact ? 'mt-3 space-y-3' : 'border-t px-4 pb-4 pt-4'}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="arch-primary-text font-mono text-[10px]">AI Ops Registry</p>
          <h3 className="arch-text mt-1 text-base font-medium">接口、数据库与可视化治理</h3>
          <p className="arch-muted mt-1 max-w-4xl text-xs leading-5">
            数据来自 Gateway 与 PostgreSQL 管理表；状态按钮会写回数据库，不使用前端静态卡片。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadManagement()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新后端数据
        </button>
      </div>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {stats.map((item) => (
          <div key={item.label} className="rounded-md border border-slate-100 bg-white px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="arch-muted inline-flex items-center gap-1">
                {item.icon}
                {item.label}
              </span>
              <span className="font-mono text-base font-semibold text-slate-950">{item.value}</span>
            </div>
            <p className="arch-muted mt-1 text-[11px]">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {MANAGEMENT_PANELS.map((panel) => {
          const selected = activePanel === panel.id;
          return (
            <button
              key={panel.id}
              type="button"
              onClick={() => {
                setActivePanel(panel.id);
                emitAudit('ai-center-panel-switch', `切换 AI 中心治理面板: ${panel.label}`);
              }}
              className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                selected
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
              }`}
              title={panel.description}
            >
              {panel.icon}
              {panel.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {activePanel === 'interfaces' ? (
          <InterfaceManagementPanel
            items={data?.interfaceContracts ?? []}
            savingKey={savingKey}
            onUpdateStatus={updateInterfaceStatus}
          />
        ) : null}
        {activePanel === 'databases' ? (
          <DatabaseManagementPanel
            items={data?.databaseBindings ?? []}
            savingKey={savingKey}
            onUpdateStatus={updateDatabaseStatus}
          />
        ) : null}
        {activePanel === 'visualization' ? (
          <VisualizationPanel
            items={data?.visualizationPanels ?? []}
            savingKey={savingKey}
            onUpdateStatus={updateVisualizationStatus}
          />
        ) : null}
      </div>
    </div>
  );
}

function InterfaceManagementPanel({
  items,
  savingKey,
  onUpdateStatus,
}: {
  items: AiCenterInterfaceContract[];
  savingKey: string | null;
  onUpdateStatus: (contractKey: string, status: AiCenterManagementStatus) => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-100 bg-white">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-[92px_minmax(220px,1fr)_minmax(180px,1fr)_160px_170px] border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
          <span>方法</span>
          <span>接口合同</span>
          <span>边界</span>
          <span>数据对象</span>
          <span>状态</span>
        </div>
        {items.map((item) => (
          <div
            key={item.contractKey}
            className="grid grid-cols-[92px_minmax(220px,1fr)_minmax(180px,1fr)_160px_170px] items-center gap-3 border-b border-slate-100 px-3 py-3 text-sm last:border-b-0"
          >
            <span className="font-mono text-xs font-semibold text-slate-800">{item.method}</span>
            <div className="min-w-0">
              <p className="font-medium text-slate-950">{item.name}</p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500">{item.path}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Lock className="h-3 w-3" />
                {item.authPolicy}
              </p>
            </div>
            <p className="text-xs leading-5 text-slate-600">{item.boundary}</p>
            <span className="font-mono text-xs text-slate-600">{item.dataObject}</span>
            <div className="flex flex-col items-start gap-2">
              <StatusBadge status={item.status} />
              <ActionButtons
                id={`interface:${item.contractKey}`}
                savingKey={savingKey}
                onReview={() => onUpdateStatus(item.contractKey, 'review')}
                onApprove={() => onUpdateStatus(item.contractKey, 'approved')}
              />
            </div>
          </div>
        ))}
        {items.length === 0 ? <EmptyState label="后端暂无接口合同记录" /> : null}
      </div>
    </div>
  );
}

function DatabaseManagementPanel({
  items,
  savingKey,
  onUpdateStatus,
}: {
  items: AiCenterDatabaseBinding[];
  savingKey: string | null;
  onUpdateStatus: (bindingKey: string, status: AiCenterManagementStatus) => Promise<void>;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <div key={item.bindingKey} className="rounded-md border border-slate-100 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-950">{item.name}</p>
              <p className="mt-1 font-mono text-xs text-slate-500">{item.objectName}</p>
            </div>
            <StatusBadge status={item.status} />
          </div>
          <dl className="mt-3 grid gap-2 text-xs text-slate-600">
            <KeyValue label="存储" value={item.storageAdapter} />
            <KeyValue label="生命周期" value={item.lifecyclePolicy} />
            <KeyValue label="RLS" value={item.rlsPolicy} />
            <KeyValue label="负责人" value={item.ownerRole} />
          </dl>
          <ActionButtons
            id={`database:${item.bindingKey}`}
            savingKey={savingKey}
            onReview={() => onUpdateStatus(item.bindingKey, 'review')}
            onApprove={() => onUpdateStatus(item.bindingKey, 'approved')}
          />
        </div>
      ))}
      {items.length === 0 ? <EmptyState label="后端暂无数据库绑定记录" /> : null}
    </div>
  );
}

function VisualizationPanel({
  items,
  savingKey,
  onUpdateStatus,
}: {
  items: AiCenterVisualizationPanel[];
  savingKey: string | null;
  onUpdateStatus: (panelKey: string, status: AiCenterManagementStatus) => Promise<void>;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
      <div className="rounded-md border border-slate-100 bg-white p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-950">AI 运行视图注册表</p>
            <p className="arch-muted mt-1 text-xs">视图记录来自数据库，发布审查会写回状态。</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="space-y-3">
          {items.map((panel) => (
            <div key={panel.panelKey} className="rounded-md border border-slate-100 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-slate-950">{panel.name}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{panel.dataset}</p>
                </div>
                <StatusBadge status={panel.status} />
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-3">
                <span>视图: {panel.viewMode}</span>
                <span>刷新: {panel.refreshPolicy}</span>
                <span>准备度: {panel.readiness}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${panel.readiness}%` }} />
              </div>
              <ActionButtons
                id={`visualization:${panel.panelKey}`}
                savingKey={savingKey}
                onReview={() => onUpdateStatus(panel.panelKey, 'review')}
                onApprove={() => onUpdateStatus(panel.panelKey, 'approved')}
              />
            </div>
          ))}
          {items.length === 0 ? <EmptyState label="后端暂无可视化面板记录" /> : null}
        </div>
      </div>
      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
        <p className="text-sm font-medium text-slate-950">发布门禁</p>
        <ul className="mt-3 space-y-3 text-xs text-slate-600">
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
            <span>视图必须声明数据库数据集和租户隔离策略。</span>
          </li>
          <li className="flex gap-2">
            <Workflow className="mt-0.5 h-4 w-4 text-blue-600" />
            <span>AI 调用链必须保留 Planner 到 Approver 审计上下文。</span>
          </li>
          <li className="flex gap-2">
            <Gauge className="mt-0.5 h-4 w-4 text-amber-600" />
            <span>运行指标只能从真实后端事件或已声明配置对象读取。</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function ActionButtons({
  id,
  savingKey,
  onReview,
  onApprove,
}: {
  id: string;
  savingKey: string | null;
  onReview: () => Promise<void>;
  onApprove: () => Promise<void>;
}) {
  const saving = savingKey === id;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void onReview()}
        disabled={saving}
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50"
      >
        <FileJson className="h-3 w-3" />
        审查
      </button>
      <button
        type="button"
        onClick={() => void onApprove()}
        disabled={saving}
        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <CheckCircle2 className="h-3 w-3" />
        批准
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: AiCenterManagementStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="p-6 text-center text-sm text-slate-500">{label}</div>;
}

function countStatus<T extends { status: AiCenterManagementStatus }>(items: T[], status: AiCenterManagementStatus) {
  return items.filter((item) => item.status === status).length;
}

function apiErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'object' && err && 'error' in err) {
    const error = (err as { error?: unknown }).error;
    if (typeof error === 'string') {
      return error;
    }
  }
  return fallback;
}
