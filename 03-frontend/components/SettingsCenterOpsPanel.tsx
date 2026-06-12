// components/SettingsCenterOpsPanel.tsx
// License: Apache-2.0
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Button, Empty, Input, Segmented, Spin, Tag } from "@/components/pan-ui";
import {
  Activity,
  AlertCircle,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Gauge,
  HardDrive,
  Play,
  RefreshCcw,
  RotateCcw,
  ScrollText,
  Server,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { createModuleAuditEvent } from "@/lib/module-actions";
import type { ModuleAuditEvent } from "@/lib/module-file-system";
import {
  formatBytes,
  formatUptime,
  type OpsCenterSnapshot,
  type OpsContainer,
  type OpsContainerAction,
} from "@/lib/ops-center-types";
import { OpsTerminal } from "@/components/ops/OpsTerminal";
import { OpsResources } from "@/components/ops/OpsResources";
import { OpsPorts } from "@/components/ops/OpsPorts";
import { OpsSecrets } from "@/components/ops/OpsSecrets";
import { OpsCodeEditor } from "@/components/ops/OpsCodeEditor";
import { OpsAgents } from "@/components/ops/OpsAgents";
import { OpsUniApi } from "@/components/ops/OpsUniApi";
import { OpsLogsDrawer } from "@/components/ops/OpsLogsDrawer";
import { OpsJobLogsDrawer } from "@/components/ops/OpsJobLogsDrawer";

type OpsView =
  | "overview"
  | "containers"
  | "resources"
  | "ports"
  | "cluster"
  | "models"
  | "uniapi"
  | "agents"
  | "secrets"
  | "code"
  | "terminal";

const opsViewOptions: Array<{ label: string; value: OpsView }> = [
  { label: "概览", value: "overview" },
  { label: "容器", value: "containers" },
  { label: "资源", value: "resources" },
  { label: "端口", value: "ports" },
  { label: "集群", value: "cluster" },
  { label: "大模型", value: "models" },
  { label: "API 网关", value: "uniapi" },
  { label: "智能体", value: "agents" },
  { label: "密钥", value: "secrets" },
  { label: "代码", value: "code" },
  { label: "终端", value: "terminal" },
];

const SNAPSHOT_VIEWS: OpsView[] = ["overview", "containers", "cluster", "models"];

export function SettingsCenterOpsPanel({
  onAudit,
}: {
  onAudit?: ((event: ModuleAuditEvent) => void) | undefined;
}) {
  const [snapshot, setSnapshot] = useState<OpsCenterSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<OpsView>("overview");
  const [busyId, setBusyId] = useState<string | null>(null);

  const emitAudit = useCallback(
    (action: string, detail: string) => {
      onAudit?.(createModuleAuditEvent(action, "SettingsCenterOpsPanel", detail));
    },
    [onAudit],
  );

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/ops-center", { cache: "no-store" });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const payload = (await response.json()) as OpsCenterSnapshot;
        setSnapshot(payload);
        if (!silent) {
          setNotice(
            `已刷新：容器 ${payload.containerSummary.running}/${payload.containerSummary.total} 运行中` +
              (payload.k8s.available
                ? `，Pod ${payload.k8s.podSummary?.running ?? 0}/${payload.k8s.podSummary?.total ?? 0}`
                : "，k3s 不可达"),
          );
        }
        emitAudit(
          "ops-center-refresh",
          `containers=${payload.containerSummary.total}; k8s=${payload.k8s.available}; errors=${payload.errors.length}`,
        );
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : "运维快照刷新失败");
      } finally {
        setLoading(false);
      }
    },
    [emitAudit],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch("/api/ops-center", { cache: "no-store" });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const payload = (await response.json()) as OpsCenterSnapshot;
        if (!alive) return;
        setSnapshot(payload);
        emitAudit(
          "ops-center-refresh",
          `containers=${payload.containerSummary.total}; k8s=${payload.k8s.available}; errors=${payload.errors.length}`,
        );
      } catch (refreshError) {
        if (alive) setError(refreshError instanceof Error ? refreshError.message : "运维快照刷新失败");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [emitAudit]);

  // 仅快照驱动的页签自动刷新；资源/终端/代码等交互页不打扰
  useEffect(() => {
    if (!SNAPSHOT_VIEWS.includes(view)) return;
    const timer = window.setInterval(() => void refresh(true), 15000);
    return () => window.clearInterval(timer);
  }, [view, refresh]);

  const containerAction = useCallback(
    async (container: OpsContainer, action: OpsContainerAction) => {
      setBusyId(container.id);
      setError(null);
      try {
        const response = await fetch("/api/ops-center", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ op: `container.${action}`, id: container.id }),
        });
        const payload = (await response.json()) as { ok?: boolean; output?: string; error?: string };
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || payload.output || "操作失败");
        }
        setNotice(`容器 ${container.name} 已${actionLabel(action)}`);
        emitAudit(`ops-container-${action}`, container.name);
        await refresh(true);
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "容器操作失败");
      } finally {
        setBusyId(null);
      }
    },
    [emitAudit, refresh],
  );

  return (
    <div className="flex h-[calc(100vh-150px)] min-h-[460px] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented options={opsViewOptions} value={view} onChange={setView} />
        <div className="flex items-center gap-2">
          {snapshot ? (
            <span className="arch-muted text-[11px]">
              {new Date(snapshot.generatedAt).toLocaleTimeString()}
            </span>
          ) : null}
          <Button
            size="small"
            icon={<RefreshCcw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />}
            onClick={() => void refresh()}
            disabled={loading}
          >
            刷新
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto rounded p-0.5 hover:bg-rose-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : notice ? (
        <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="ml-auto rounded p-0.5 hover:bg-emerald-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {snapshot?.errors?.length ? (
        <details className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <summary className="cursor-pointer font-medium">
            {snapshot.errors.length} 条采集警告（点击展开）
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {snapshot.errors.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {view === "resources" ? (
        <OpsResources />
      ) : view === "ports" ? (
        <OpsPorts />
      ) : view === "uniapi" ? (
        <OpsUniApi onAudit={emitAudit} />
      ) : view === "agents" ? (
        <OpsAgents />
      ) : view === "secrets" ? (
        <OpsSecrets />
      ) : view === "code" ? (
        <OpsCodeEditor />
      ) : view === "terminal" ? (
        <OpsTerminal />
      ) : loading && !snapshot ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spin tip="正在采集运行态…" />
        </div>
      ) : !snapshot ? (
        <Empty description="暂无运维数据" />
      ) : view === "overview" ? (
        <OverviewView snapshot={snapshot} onJump={setView} />
      ) : view === "containers" ? (
        <ContainersView
          snapshot={snapshot}
          busyId={busyId}
          onAction={containerAction}
          onAudit={emitAudit}
        />
      ) : view === "cluster" ? (
        <ClusterView snapshot={snapshot} />
      ) : (
        <ModelsView snapshot={snapshot} />
      )}
    </div>
  );
}

function actionLabel(action: OpsContainerAction): string {
  return action === "start"
    ? "启动"
    : action === "stop"
      ? "停止"
      : action === "restart"
        ? "重启"
        : "删除";
}

// ---------------------------------------------------------------------------
// 概览
// ---------------------------------------------------------------------------
function OverviewView({
  snapshot,
  onJump,
}: {
  snapshot: OpsCenterSnapshot;
  onJump: (view: OpsView) => void;
}) {
  const { host, containerSummary, k8s, models } = snapshot;
  const load1 = host.loadavg[0];
  const loadPct = host.cpuCount > 0 ? Math.min(100, Math.round((load1 / host.cpuCount) * 100)) : 0;
  const diskPct = host.disk?.usedPct ?? null;
  const failedPods = k8s.podSummary?.failed ?? 0;

  // 聚合告警：超过阈值的关键指标集中提示，避免逐卡巡看
  const warnings: string[] = [];
  if (loadPct > 85) warnings.push(`CPU 负载 ${loadPct}% 超过 85% 阈值`);
  if (host.memUsedPct > 90) warnings.push(`内存占用 ${host.memUsedPct}% 超过 90% 阈值（统一内存机型注意 GPU 任务挤占）`);
  if (diskPct !== null && diskPct > 85) warnings.push(`磁盘占用 ${diskPct}% 超过 85% 阈值，请清理或扩容`);
  if (host.gpu?.tempC !== null && host.gpu !== null && host.gpu.tempC! > 85)
    warnings.push(`GPU 温度 ${host.gpu.tempC}°C 超过 85°C`);
  if (!k8s.available) warnings.push(`k3s 集群不可达${k8s.reason ? `：${k8s.reason}` : ""}`);
  if (failedPods > 0) warnings.push(`${failedPods} 个 Pod 处于 Failed 状态`);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      {warnings.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <p className="font-medium">{warnings.length} 项指标越过告警阈值：</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {warnings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          icon={<Cpu className="h-4 w-4" />}
          label="CPU 负载 (1m)"
          value={`${load1}`}
          hint={`${host.cpuCount} 核 · 约 ${loadPct}%`}
          tone={loadPct > 85 ? "rose" : loadPct > 60 ? "amber" : "emerald"}
        />
        <MetricCard
          icon={<Activity className="h-4 w-4" />}
          label="内存占用"
          value={`${host.memUsedPct}%`}
          hint={`${formatBytes(host.memTotal - host.memFree)} / ${formatBytes(host.memTotal)}`}
          tone={host.memUsedPct > 90 ? "rose" : host.memUsedPct > 75 ? "amber" : "emerald"}
        />
        <MetricCard
          icon={<HardDrive className="h-4 w-4" />}
          label="磁盘 (/)"
          value={diskPct !== null ? `${diskPct}%` : "—"}
          hint={
            host.disk
              ? `${formatBytes(host.disk.usedBytes)} / ${formatBytes(host.disk.totalBytes)}`
              : "df 不可用"
          }
          tone={diskPct === null ? "slate" : diskPct > 85 ? "rose" : diskPct > 70 ? "amber" : "emerald"}
        />
        <MetricCard
          icon={<Gauge className="h-4 w-4" />}
          label="GPU"
          value={host.gpu ? (host.gpu.utilPct !== null ? `${host.gpu.utilPct}%` : "在线") : "—"}
          hint={
            host.gpu
              ? `${host.gpu.name}${host.gpu.tempC !== null ? ` · ${host.gpu.tempC}°C` : ""}` +
                (host.gpu.memTotalBytes === null ? " · 统一内存" : "")
              : "nvidia-smi 不可用"
          }
          tone={
            !host.gpu
              ? "slate"
              : (host.gpu.tempC ?? 0) > 85
                ? "rose"
                : (host.gpu.utilPct ?? 0) > 90
                  ? "amber"
                  : "emerald"
          }
        />
        <MetricCard
          icon={<Boxes className="h-4 w-4" />}
          label="容器"
          value={`${containerSummary.running}/${containerSummary.total}`}
          hint={`${containerSummary.stopped} 个已停止`}
          tone="emerald"
          onClick={() => onJump("containers")}
        />
        <MetricCard
          icon={<Server className="h-4 w-4" />}
          label="k3s 集群"
          value={k8s.available ? `${k8s.podSummary?.running ?? 0} Pod` : "不可达"}
          hint={k8s.available ? `${k8s.nodes?.length ?? 0} 节点 · ${k8s.namespaceCount ?? 0} 命名空间` : k8s.reason ?? ""}
          tone={k8s.available ? (failedPods > 0 ? "amber" : "emerald") : "slate"}
          onClick={() => onJump("cluster")}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="主机" eyebrow="Host">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <InfoRow label="主机名" value={host.hostname} />
            <InfoRow label="运行时长" value={formatUptime(host.uptimeSec)} />
            <InfoRow label="系统" value={host.platform} />
            <InfoRow label="负载 5m/15m" value={`${host.loadavg[1]} / ${host.loadavg[2]}`} />
          </dl>
        </SectionCard>
        <SectionCard
          title="本地大模型"
          eyebrow="Models"
          action={
            <Button size="small" type="text" onClick={() => onJump("models")}>
              查看
            </Button>
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <Tag color="green" icon={<Sparkles className="h-3.5 w-3.5" />}>
              {models.models.length} 个模型
            </Tag>
            {models.endpoints.map((endpoint) => (
              <Tag key={endpoint.url} color={endpoint.reachable ? "green" : "slate"}>
                {endpoint.name} {endpoint.reachable ? "在线" : "离线"}
              </Tag>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 容器
// ---------------------------------------------------------------------------
function ContainersView({
  snapshot,
  busyId,
  onAction,
  onAudit,
}: {
  snapshot: OpsCenterSnapshot;
  busyId: string | null;
  onAction: (container: OpsContainer, action: OpsContainerAction) => void;
  onAudit: (action: string, detail: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [logsFor, setLogsFor] = useState<OpsContainer | null>(null);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return snapshot.containers;
    return snapshot.containers.filter((item) =>
      `${item.name} ${item.image} ${item.ports}`.toLowerCase().includes(text),
    );
  }, [snapshot.containers, query]);

  const groups = useMemo(() => {
    const map = new Map<string, OpsContainer[]>();
    for (const item of filtered) {
      const list = map.get(item.stack) ?? [];
      list.push(item);
      map.set(item.stack, list);
    }
    return Array.from(map.entries())
      .map(([stackName, items]) => ({
        stack: stackName,
        items,
        running: items.filter((c) => c.running).length,
      }))
      .sort(
        (a, b) => b.items.length - a.items.length || a.stack.localeCompare(b.stack),
      );
  }, [filtered]);

  type ContainerRow =
    | { type: "header"; stack: string; running: number; total: number }
    | { type: "item"; container: OpsContainer };
  const rows = useMemo<ContainerRow[]>(() => {
    const out: ContainerRow[] = [];
    for (const group of groups) {
      out.push({
        type: "header",
        stack: group.stack,
        running: group.running,
        total: group.items.length,
      });
      if (!collapsed.has(group.stack)) {
        for (const container of group.items) out.push({ type: "item", container });
      }
    }
    return out;
  }, [groups, collapsed]);

  const toggle = (stackName: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(stackName)) next.delete(stackName);
      else next.add(stackName);
      return next;
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-64">
          <Input
            size="small"
            allowClear
            placeholder="搜索名称/镜像/端口"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <span className="arch-muted text-[11px]">
          {filtered.length} 个容器 · {groups.length} 组
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Button size="small" type="text" onClick={() => setCollapsed(new Set())}>
            全部展开
          </Button>
          <Button
            size="small"
            type="text"
            onClick={() => setCollapsed(new Set(groups.map((group) => group.stack)))}
          >
            全部折叠
          </Button>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-100">
        <table className="w-full min-w-[820px] border-collapse text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">名称</th>
              <th className="px-3 py-2 font-medium">镜像</th>
              <th className="px-3 py-2 font-medium">状态</th>
              <th className="px-3 py-2 font-medium">CPU / 内存</th>
              <th className="px-3 py-2 font-medium">端口</th>
              <th className="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10">
                  <Empty description="没有匹配的容器" />
                </td>
              </tr>
            ) : (
              rows.map((entry) => {
                if (entry.type === "header") {
                  const open = !collapsed.has(entry.stack);
                  return (
                    <tr key={`h:${entry.stack}`} className="bg-slate-50/80">
                      <td colSpan={6} className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => toggle(entry.stack)}
                          className="flex w-full items-center gap-1.5 text-left"
                        >
                          <ChevronRight
                            className={
                              "h-3.5 w-3.5 text-slate-400 transition " + (open ? "rotate-90" : "")
                            }
                          />
                          <span className="text-xs font-semibold text-slate-700">{entry.stack}</span>
                          <span className="arch-muted text-[10px]">
                            {entry.running}/{entry.total} 运行
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                }
                const container = entry.container;
                const busy = busyId === container.id;
                return (
                  <tr key={container.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{container.name}</div>
                      <div className="arch-muted text-[10px]">{container.stack}</div>
                    </td>
                    <td className="max-w-[220px] px-3 py-2">
                      <span className="block truncate text-slate-600" title={container.image}>
                        {container.image}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <StatusDot ok={container.running} text={container.status || container.state} />
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {container.running ? (
                        <span>
                          {container.cpuPerc ?? "—"}
                          <span className="arch-muted"> · {container.memUsage ?? "—"}</span>
                        </span>
                      ) : (
                        <span className="arch-muted">—</span>
                      )}
                    </td>
                    <td className="max-w-[200px] px-3 py-2">
                      <span className="block truncate text-slate-500" title={container.ports}>
                        {container.ports || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {container.running ? (
                          <>
                            <IconBtn
                              title="重启"
                              busy={busy}
                              onClick={() => onAction(container, "restart")}
                              icon={<RotateCcw className="h-3.5 w-3.5" />}
                            />
                            <IconBtn
                              title="停止"
                              busy={busy}
                              onClick={() => onAction(container, "stop")}
                              icon={<Square className="h-3.5 w-3.5" />}
                            />
                          </>
                        ) : (
                          <IconBtn
                            title="启动"
                            busy={busy}
                            onClick={() => onAction(container, "start")}
                            icon={<Play className="h-3.5 w-3.5" />}
                          />
                        )}
                        <IconBtn
                          title="日志"
                          onClick={() => {
                            setLogsFor(container);
                            onAudit("ops-container-logs", container.name);
                          }}
                          icon={<ScrollText className="h-3.5 w-3.5" />}
                        />
                        <IconBtn
                          title="删除"
                          danger
                          busy={busy}
                          onClick={() => {
                            if (window.confirm(`确认删除容器 ${container.name}？此操作不可恢复。`)) {
                              onAction(container, "remove");
                            }
                          }}
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {logsFor ? (
        <OpsLogsDrawer id={logsFor.id} name={logsFor.name} onClose={() => setLogsFor(null)} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 集群
// ---------------------------------------------------------------------------
function ClusterView({ snapshot }: { snapshot: OpsCenterSnapshot }) {
  const { k8s } = snapshot;
  if (!k8s.available) {
    return (
      <Empty
        description={
          <div className="space-y-1">
            <p>k3s 集群当前不可达</p>
            {k8s.reason ? <p className="arch-muted text-xs">{k8s.reason}</p> : null}
          </div>
        }
      />
    );
  }
  const pod = k8s.podSummary;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Server className="h-4 w-4" />} label="节点" value={`${k8s.nodes?.length ?? 0}`} tone="emerald" />
        <MetricCard icon={<Boxes className="h-4 w-4" />} label="Pod 运行" value={`${pod?.running ?? 0}/${pod?.total ?? 0}`} tone="emerald" />
        <MetricCard
          icon={<Activity className="h-4 w-4" />}
          label="Pending"
          value={`${pod?.pending ?? 0}`}
          tone={(pod?.pending ?? 0) > 0 ? "amber" : "slate"}
        />
        <MetricCard
          icon={<AlertCircle className="h-4 w-4" />}
          label="Failed"
          value={`${pod?.failed ?? 0}`}
          tone={(pod?.failed ?? 0) > 0 ? "rose" : "slate"}
        />
      </div>
      <SectionCard title="节点" eyebrow="Nodes">
        <div className="overflow-auto rounded-md border border-slate-100">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">名称</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">版本</th>
              </tr>
            </thead>
            <tbody>
              {(k8s.nodes ?? []).map((node) => (
                <tr key={node.name} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{node.name}</td>
                  <td className="px-3 py-2">
                    <StatusDot ok={node.ready} text={node.ready ? "Ready" : "NotReady"} />
                  </td>
                  <td className="px-3 py-2 text-slate-600">{node.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 大模型
// ---------------------------------------------------------------------------
interface HfEntry {
  type: string;
  repo: string;
  size: string;
  sizeBytes: number;
  lastModified: string;
}
interface HfData {
  available: boolean;
  reason?: string;
  entries: HfEntry[];
  totalDisk: string;
  count: number;
}
interface JobInfo {
  id: string;
  kind: string;
  label: string;
  status: "running" | "exited";
  exitCode: number | null;
  startedAt: number;
  port: number | null;
}

function ModelsView({ snapshot }: { snapshot: OpsCenterSnapshot }) {
  const { models } = snapshot;
  const [hf, setHf] = useState<HfData | null>(null);
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [logsForJob, setLogsForJob] = useState<{ id: string; name: string } | null>(null);
  const [busyRepo, setBusyRepo] = useState<string | null>(null);
  const [jobMsg, setJobMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch("/api/ops-center/hf", { cache: "no-store" });
        const data = (await response.json()) as HfData;
        if (alive) setHf(data);
      } catch {
        if (alive) setHf({ available: false, entries: [], totalDisk: "", count: 0 });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const response = await fetch("/api/ops-center/jobs", { cache: "no-store" });
      const data = (await response.json()) as { jobs?: JobInfo[] };
      setJobs(data.jobs ?? []);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch("/api/ops-center/jobs", { cache: "no-store" });
        const data = (await response.json()) as { jobs?: JobInfo[] };
        if (alive) setJobs(data.jobs ?? []);
      } catch {
        /* ignore */
      }
    })();
    const timer = window.setInterval(() => void loadJobs(), 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [loadJobs]);

  const startModel = async (repo: string, kind: "vllm" | "ollama") => {
    setBusyRepo(repo);
    setJobMsg(null);
    try {
      const response = await fetch("/api/ops-center/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "start", kind, repo }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        id?: string;
        port?: number;
        error?: string;
      };
      if (!response.ok || data.error) throw new Error(data.error || "启动失败");
      setJobMsg(
        kind === "vllm"
          ? `已启动 vLLM 加载 ${repo}${data.port ? `（端口 ${data.port}）` : ""}，下方任务可看日志`
          : `已用 Ollama 开始拉取 ${repo}`,
      );
      if (data.id) setLogsForJob({ id: data.id, name: `${kind} · ${repo}` });
      await loadJobs();
    } catch (error) {
      setJobMsg(error instanceof Error ? error.message : "启动失败");
    } finally {
      setBusyRepo(null);
    }
  };

  const stopJob = async (id: string) => {
    try {
      await fetch("/api/ops-center/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "stop", id }),
      });
      await loadJobs();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <SectionCard title="本地推理服务" eyebrow="Local Runtimes">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {models.endpoints.map((endpoint) => (
            <div
              key={endpoint.url}
              className={
                "flex items-center justify-between rounded-md border px-3 py-2 " +
                (endpoint.reachable ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100")
              }
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{endpoint.name}</p>
                <p className="arch-muted font-mono text-[10px]">{endpoint.url.replace("http://", "")}</p>
              </div>
              <div className="shrink-0 text-right">
                <StatusDot ok={endpoint.reachable} text={endpoint.reachable ? "在线" : "离线"} />
                {endpoint.reachable ? (
                  <p className="arch-muted text-[10px]">{endpoint.modelCount} 模型</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {jobs.length > 0 || jobMsg ? (
        <SectionCard title="模型启动任务" eyebrow="Launch Jobs">
          {jobMsg ? (
            <div className="mb-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
              {jobMsg}
            </div>
          ) : null}
          {jobs.length === 0 ? (
            <span className="arch-muted text-xs">暂无运行中的任务</span>
          ) : (
            <div className="space-y-1.5">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-1.5 text-xs"
                >
                  <StatusDot ok={job.status === "running"} text={job.label} />
                  <span className="arch-muted">
                    {job.status === "running" ? "运行中" : `已退出 (${job.exitCode})`}
                    {job.port ? ` · 端口 ${job.port}` : ""}
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    {job.status === "running" && job.port ? (
                      <Button
                        size="small"
                        type="text"
                        href={`http://127.0.0.1:${job.port}/v1/models`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        接口
                      </Button>
                    ) : null}
                    <Button
                      size="small"
                      type="text"
                      onClick={() => setLogsForJob({ id: job.id, name: job.label })}
                    >
                      日志
                    </Button>
                    {job.status === "running" ? (
                      <Button size="small" type="text" danger onClick={() => void stopJob(job.id)}>
                        停止
                      </Button>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      {models.providers.length > 0 ? (
        <SectionCard title="云端 API 提供方" eyebrow="Cloud Providers">
          <div className="flex flex-wrap gap-2">
            {models.providers.map((provider) => (
              <Tag key={provider.name} color="cyan">
                {provider.name} · 已配置
              </Tag>
            ))}
          </div>
          <p className="arch-muted mt-2 text-[10px]">
            依据各 .env 中已配置的 API Key 识别（共 {models.providers.length} 家）；密钥本身在「密钥」页管理。
          </p>
        </SectionCard>
      ) : null}

      <SectionCard
        title={`Hugging Face 本地模型${hf?.totalDisk ? ` · ${hf.totalDisk}` : ""}`}
        eyebrow="HuggingFace Cache"
      >
        {hf === null ? (
          <Spin size="small" tip="扫描 HF 缓存…" />
        ) : !hf.available ? (
          <Empty description="未发现 HF 缓存（hf CLI 不可用或缓存为空）" />
        ) : hf.entries.length === 0 ? (
          <Empty description="HF 缓存为空" />
        ) : (
          <div className="overflow-auto rounded-md border border-slate-100">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">仓库</th>
                  <th className="px-3 py-2 font-medium">类型</th>
                  <th className="px-3 py-2 font-medium">大小</th>
                  <th className="px-3 py-2 font-medium">最近修改</th>
                  <th className="px-3 py-2 text-right font-medium">加载</th>
                </tr>
              </thead>
              <tbody>
                {hf.entries.map((entry) => (
                  <tr key={`${entry.type}/${entry.repo}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{entry.repo}</td>
                    <td className="px-3 py-2">
                      <Tag color={entry.type === "dataset" ? "gold" : "cyan"}>{entry.type}</Tag>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{entry.size}</td>
                    <td className="px-3 py-2 text-slate-500">{entry.lastModified}</td>
                    <td className="px-3 py-2">
                      {entry.type === "model" ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="small"
                            type="text"
                            loading={busyRepo === entry.repo}
                            onClick={() => void startModel(entry.repo, "vllm")}
                          >
                            vLLM
                          </Button>
                          <Button
                            size="small"
                            type="text"
                            onClick={() => void startModel(entry.repo, "ollama")}
                          >
                            Ollama
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title={`已加载模型 · ${models.models.length}`} eyebrow="Models">
        {models.models.length === 0 ? (
          <Empty description="未发现本地模型（本地推理服务可能未运行）" />
        ) : (
          <div className="overflow-auto rounded-md border border-slate-100">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">模型</th>
                  <th className="px-3 py-2 font-medium">来源</th>
                  <th className="px-3 py-2 font-medium">参数量</th>
                  <th className="px-3 py-2 font-medium">系列</th>
                  <th className="px-3 py-2 font-medium">大小</th>
                </tr>
              </thead>
              <tbody>
                {models.models.map((model) => (
                  <tr key={`${model.source}:${model.name}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{model.name}</td>
                    <td className="px-3 py-2">
                      <Tag color="green">{model.source}</Tag>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{model.params || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{model.family || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {model.sizeBytes ? formatBytes(model.sizeBytes) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {logsForJob ? (
        <OpsJobLogsDrawer
          id={logsForJob.id}
          name={logsForJob.name}
          onClose={() => setLogsForJob(null)}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 复用小组件
// ---------------------------------------------------------------------------
function MetricCard({
  icon,
  label,
  value,
  hint,
  tone = "emerald",
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "emerald" | "amber" | "rose" | "slate";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "rose"
      ? "text-rose-600 bg-rose-50"
      : tone === "amber"
        ? "text-amber-600 bg-amber-50"
        : tone === "slate"
          ? "text-slate-500 bg-slate-100"
          : "text-emerald-700 bg-emerald-50";
  const Wrapper: "button" | "div" = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={
        "flex flex-col gap-2 rounded-md border border-slate-100 bg-white p-3 text-left shadow-sm transition " +
        (onClick ? "hover:border-emerald-200 hover:bg-emerald-50/40" : "")
      }
    >
      <span className="flex items-center justify-between">
        <span className="arch-muted text-[11px]">{label}</span>
        <span className={"inline-flex h-7 w-7 items-center justify-center rounded-md " + toneClass}>
          {icon}
        </span>
      </span>
      <span className="text-lg font-semibold text-slate-800">{value}</span>
      {hint ? <span className="arch-muted text-[11px]">{hint}</span> : null}
    </Wrapper>
  );
}

function SectionCard({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-slate-100 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="arch-primary-text font-mono text-[10px]">{eyebrow}</p>
          <h4 className="arch-text text-sm font-medium">{title}</h4>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function StatusDot({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={"inline-block h-2 w-2 shrink-0 rounded-full " + (ok ? "bg-emerald-500" : "bg-slate-300")}
      />
      <span className="text-slate-600">{text}</span>
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="arch-muted text-[10px]">{label}</dt>
      <dd className="truncate text-slate-700" title={value}>
        {value}
      </dd>
    </div>
  );
}

function IconBtn({
  icon,
  title,
  onClick,
  busy,
  danger,
}: {
  icon: ReactNode;
  title: string;
  onClick: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={busy}
      onClick={onClick}
      className={
        "inline-flex h-7 w-7 items-center justify-center rounded-md border transition disabled:opacity-40 " +
        (danger
          ? "border-rose-100 text-rose-500 hover:border-rose-200 hover:bg-rose-50"
          : "border-slate-100 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700")
      }
    >
      {icon}
    </button>
  );
}
