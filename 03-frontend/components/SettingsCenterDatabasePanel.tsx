// components/SettingsCenterDatabasePanel.tsx
// License: Apache-2.0
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Empty,
  Progress,
  Segmented,
  Spin,
  Tag,
  Tooltip,
} from "antd";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  HardDrive,
  Network,
  RefreshCcw,
  Search,
  Server,
  ShieldAlert,
} from "lucide-react";
import { createModuleAuditEvent } from "@/lib/module-actions";
import type { ModuleAuditEvent } from "@/lib/module-file-system";
import {
  databaseCategoryLabel,
  databaseStatusLabel,
  storeStatusTone,
  type DatabaseRuntimeSnapshot,
  type DatabaseRuntimeStatus,
  type DatabaseRuntimeStore,
} from "@/lib/database-runtime-types";

type RuntimeScope = "architoken" | "same_host" | "all";

const scopeOptions = [
  { label: "ArchIToken", value: "architoken" },
  { label: "同机数据库", value: "same_host" },
  { label: "全部", value: "all" },
];

export function SettingsCenterDatabasePanel({
  onAudit,
}: {
  onAudit?: ((event: ModuleAuditEvent) => void) | undefined;
}) {
  const [snapshot, setSnapshot] = useState<DatabaseRuntimeSnapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scope, setScope] = useState<RuntimeScope>("architoken");
  const [searchText, setSearchText] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const emitAudit = (action: string, detail: string) => {
    onAudit?.(
      createModuleAuditEvent(action, "SettingsCenterDatabasePanel", detail),
    );
  };

  const refreshSnapshot = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/database-runtime", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const payload = (await response.json()) as DatabaseRuntimeSnapshot;
      setSnapshot(payload);
      setSelectedStoreId((current) => current ?? payload.stores[0]?.id ?? null);
      setNotice(
        `已刷新 ${payload.stores.length} 个数据库/存储对象，ArchIToken data-plane ${payload.bindings.length} 个绑定。`,
      );
      emitAudit(
        "settings-database-runtime-refresh",
        `stores=${payload.stores.length}; bindings=${payload.bindings.length}; errors=${payload.errors.length}`,
      );
    } catch (refreshError) {
      const message =
        refreshError instanceof Error && refreshError.message.trim()
          ? refreshError.message
          : "数据库运行状态刷新失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshSnapshot();
  }, []);

  const filteredStores = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return (snapshot?.stores ?? []).filter((store) => {
      if (scope !== "all" && store.group !== scope) return false;
      if (!query) return true;
      return [
        store.name,
        store.provider,
        store.capability ?? "",
        store.endpoint,
        store.role,
        databaseCategoryLabel(store.category),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [scope, searchText, snapshot]);

  const selectedStore =
    filteredStores.find((store) => store.id === selectedStoreId) ??
    snapshot?.stores.find((store) => store.id === selectedStoreId) ??
    filteredStores[0] ??
    null;

  const architokenStores = useMemo(
    () =>
      (snapshot?.stores ?? []).filter((store) => store.group === "architoken"),
    [snapshot],
  );
  const sameHostStores = useMemo(
    () =>
      (snapshot?.stores ?? []).filter((store) => store.group === "same_host"),
    [snapshot],
  );
  const liveCount = (snapshot?.stores ?? []).filter(
    (store) => store.status === "live" || store.status === "empty",
  ).length;
  const totalCount = snapshot?.stores.length ?? 0;
  const livePercent =
    totalCount > 0 ? Math.round((liveCount / totalCount) * 100) : 0;
  const architokenIssueCount = architokenStores.filter(
    (store) => store.status === "blocked" || store.status === "offline",
  ).length;

  return (
    <section
      className="flex min-h-0 flex-col gap-3"
      data-testid="settings-database-runtime"
    >
      <div className="flex flex-col gap-3 rounded-md border border-slate-100 bg-white p-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="arch-primary-text font-mono text-[10px]">
            Database Runtime Control Plane
          </p>
          <h3 className="arch-text mt-1 text-base font-medium">
            数据库可视化管理
          </h3>
          <p className="arch-muted mt-1 max-w-5xl text-xs leading-5">
            统一查看 ArchIToken data-plane
            绑定、真实服务探测、同机数据库容器、连接入口、fallback
            和非破坏性运维动作。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="primary"
            icon={<RefreshCcw className="h-4 w-4" />}
            loading={loading}
            onClick={() => void refreshSnapshot()}
          >
            刷新状态
          </Button>
          <Button
            icon={<ShieldAlert className="h-4 w-4" />}
            onClick={() => {
              setNotice("已登记一次数据库巡检，不执行启动、停止或删除动作。");
              emitAudit(
                "settings-database-runtime-inspection",
                "non-destructive inspection logged",
              );
            }}
          >
            登记巡检
          </Button>
        </div>
      </div>

      <RuntimeMessage
        loading={loading}
        error={error}
        notice={notice}
        errors={snapshot?.errors ?? []}
        onClear={() => {
          setError(null);
          setNotice(null);
        }}
      />

      <div className="grid gap-2 md:grid-cols-4">
        <RuntimeMetricCard
          label="ArchIToken 绑定"
          value={snapshot?.bindings.length ?? 0}
          icon={<Network className="h-4 w-4" />}
          detail="Gateway data-plane"
        />
        <RuntimeMetricCard
          label="管理对象"
          value={totalCount}
          icon={<Database className="h-4 w-4" />}
          detail={`${architokenStores.length} 个 ArchIToken / ${sameHostStores.length} 个同机对象`}
        />
        <RuntimeMetricCard
          label="在线或空数据"
          value={liveCount}
          icon={<CheckCircle2 className="h-4 w-4" />}
          detail={`${livePercent}% 可达`}
        />
        <RuntimeMetricCard
          label="阻断/离线"
          value={architokenIssueCount}
          icon={<AlertCircle className="h-4 w-4" />}
          detail="Graph 外置未配置会计入阻断"
        />
      </div>

      <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          <div className="rounded-md border border-slate-100 bg-white p-3">
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-950">
                  ArchIToken 数据平面拓扑
                </p>
                <p className="arch-muted mt-1 text-xs">
                  中心是 Gateway，周围节点是当前 StorageRouter capability
                  provider。
                </p>
              </div>
              <Progress
                className="min-w-[180px]"
                percent={livePercent}
                size="small"
                status={architokenIssueCount > 0 ? "exception" : "success"}
              />
            </div>
            {loading && !snapshot ? (
              <div className="flex h-56 items-center justify-center">
                <Spin tip="正在探测数据库运行状态" />
              </div>
            ) : (
              <RuntimeTopology
                stores={architokenStores}
                selectedStoreId={selectedStore?.id ?? null}
                onSelect={setSelectedStoreId}
              />
            )}
          </div>

          <div className="rounded-md border border-slate-100 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  size="small"
                  options={scopeOptions}
                  value={scope}
                  onChange={(value) => setScope(value as RuntimeScope)}
                />
                <Tag color="green">只读管理</Tag>
                <Tag color="blue">真实探测</Tag>
              </div>
              <label className="relative block min-w-0 xl:w-[360px]">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="搜索库名、provider、端口、能力边界"
                  className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </div>
            <DatabaseStoreGrid
              stores={filteredStores}
              selectedStoreId={selectedStore?.id ?? null}
              onSelect={setSelectedStoreId}
            />
          </div>
        </div>

        <DatabaseStoreDetail
          store={selectedStore}
          gatewayStatus={snapshot?.gateway?.status ?? "unknown"}
          generatedAt={snapshot?.generatedAt ?? null}
          onCopy={(value) => void copyText(value, setNotice, setError)}
          onAudit={emitAudit}
        />
      </div>
    </section>
  );
}

function RuntimeMessage({
  loading,
  error,
  notice,
  errors,
  onClear,
}: {
  loading: boolean;
  error: string | null;
  notice: string | null;
  errors: string[];
  onClear: () => void;
}) {
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{error}</span>
        <button type="button" onClick={onClear} className="ml-auto text-xs">
          关闭
        </button>
      </div>
    );
  }
  if (errors.length > 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="h-4 w-4" />
          部分探测失败，页面仍显示已获取的数据。
        </div>
        <div className="mt-1 grid gap-1">
          {errors.slice(0, 4).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>
    );
  }
  if (!notice && !loading) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span>{loading ? "正在刷新数据库运行状态..." : notice}</span>
      <button type="button" onClick={onClear} className="ml-auto text-xs">
        关闭
      </button>
    </div>
  );
}

function RuntimeMetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-100 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-xl font-medium text-slate-900">{value}</div>
      <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function RuntimeTopology({
  stores,
  selectedStoreId,
  onSelect,
}: {
  stores: DatabaseRuntimeStore[];
  selectedStoreId: string | null;
  onSelect: (storeId: string) => void;
}) {
  if (stores.length === 0) {
    return <Empty description="暂无 ArchIToken 数据平面绑定" />;
  }
  return (
    <div className="relative min-h-[330px] overflow-hidden rounded-md border border-slate-100 bg-slate-50 p-3">
      <div className="absolute inset-x-6 top-1/2 h-px bg-emerald-200" />
      <div className="absolute inset-y-6 left-1/2 w-px bg-emerald-200" />
      <div className="relative z-10 grid min-h-[300px] gap-3 md:grid-cols-[1fr_220px_1fr]">
        <TopologyNodeColumn
          stores={stores.filter((_, index) => index % 2 === 0)}
          selectedStoreId={selectedStoreId}
          onSelect={onSelect}
        />
        <button
          type="button"
          className="self-center rounded-md border border-emerald-200 bg-white p-4 text-center shadow-sm"
        >
          <Server className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-2 text-sm font-medium text-slate-950">
            architoken-gateway
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500">
            StorageRouter / DataPlane
          </p>
        </button>
        <TopologyNodeColumn
          stores={stores.filter((_, index) => index % 2 === 1)}
          selectedStoreId={selectedStoreId}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

function TopologyNodeColumn({
  stores,
  selectedStoreId,
  onSelect,
}: {
  stores: DatabaseRuntimeStore[];
  selectedStoreId: string | null;
  onSelect: (storeId: string) => void;
}) {
  return (
    <div className="grid content-center gap-2">
      {stores.map((store) => (
        <button
          key={store.id}
          type="button"
          onClick={() => onSelect(store.id)}
          className={[
            "rounded-md border bg-white p-3 text-left shadow-sm transition",
            selectedStoreId === store.id
              ? "border-emerald-300 ring-2 ring-emerald-100"
              : "border-slate-100 hover:border-emerald-200",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-slate-950">
              {store.name}
            </span>
            <StatusBadge status={store.status} />
          </div>
          <p className="mt-1 truncate font-mono text-xs text-slate-500">
            {store.capability}
          </p>
        </button>
      ))}
    </div>
  );
}

function DatabaseStoreGrid({
  stores,
  selectedStoreId,
  onSelect,
}: {
  stores: DatabaseRuntimeStore[];
  selectedStoreId: string | null;
  onSelect: (storeId: string) => void;
}) {
  if (stores.length === 0) {
    return <Empty className="py-10" description="没有匹配的数据库/存储对象" />;
  }
  return (
    <div className="grid gap-2 p-3 md:grid-cols-2 2xl:grid-cols-3">
      {stores.map((store) => (
        <button
          key={store.id}
          type="button"
          onClick={() => onSelect(store.id)}
          className={[
            "min-h-[142px] rounded-md border bg-white p-3 text-left transition",
            selectedStoreId === store.id
              ? "border-emerald-300 shadow-sm ring-2 ring-emerald-100"
              : "border-slate-100 hover:border-emerald-200",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-950">
                {store.name}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500">
                {store.endpoint}
              </p>
            </div>
            <StatusBadge status={store.status} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            <Tag color={store.group === "architoken" ? "green" : "default"}>
              {store.group === "architoken" ? "ArchIToken" : "同机"}
            </Tag>
            <Tag>{databaseCategoryLabel(store.category)}</Tag>
          </div>
          <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600">
            {store.role}
          </p>
        </button>
      ))}
    </div>
  );
}

function DatabaseStoreDetail({
  store,
  gatewayStatus,
  generatedAt,
  onCopy,
  onAudit,
}: {
  store: DatabaseRuntimeStore | null;
  gatewayStatus: string;
  generatedAt: string | null;
  onCopy: (value: string) => void;
  onAudit: (action: string, detail: string) => void;
}) {
  if (!store) {
    return (
      <aside className="rounded-md border border-slate-100 bg-white p-3">
        <Empty description="选择一个数据库节点查看管理详情" />
      </aside>
    );
  }
  return (
    <aside className="min-w-0 rounded-md border border-slate-100 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="arch-primary-text font-mono text-[10px]">
            {store.group === "architoken"
              ? "Active provider"
              : "Same-host service"}
          </p>
          <h4 className="mt-1 truncate text-base font-medium text-slate-950">
            {store.name}
          </h4>
          <p className="mt-1 font-mono text-xs text-slate-500">
            {store.provider}
          </p>
        </div>
        <StatusBadge status={store.status} />
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-600">
        <DetailRow label="Gateway" value={gatewayStatus} />
        <DetailRow label="能力边界" value={store.capability ?? "未绑定"} />
        <DetailRow label="分类" value={databaseCategoryLabel(store.category)} />
        <DetailRow label="连接" value={store.endpoint} />
        <DetailRow label="fallback" value={store.fallbackProvider ?? "无"} />
        <DetailRow
          label="外置"
          value={
            typeof store.externalized === "boolean"
              ? store.externalized
                ? "true"
                : "false"
              : "未知"
          }
        />
        <DetailRow label="刷新时间" value={formatDateTime(generatedAt)} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {store.metrics.map((item) => (
          <div
            key={`${item.label}:${item.value}`}
            className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
          >
            <p className="text-xs text-slate-500">{item.label}</p>
            <Tooltip title={item.value}>
              <p className="mt-1 truncate font-mono text-sm text-slate-900">
                {item.value}
              </p>
            </Tooltip>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-700">管理动作</p>
        <div className="mt-2 grid gap-2">
          <Button
            icon={<Copy className="h-4 w-4" />}
            onClick={() => {
              onCopy(store.endpoint);
              onAudit(
                "settings-database-runtime-copy-endpoint",
                `${store.name}: ${store.endpoint}`,
              );
            }}
          >
            复制连接/端口
          </Button>
          {store.managementLinks.map((item) => (
            <Button
              key={`${store.id}:${item.href}`}
              icon={<ExternalLink className="h-4 w-4" />}
              onClick={() => {
                window.open(item.href, "_blank", "noopener,noreferrer");
                onAudit(
                  "settings-database-runtime-open-link",
                  `${store.name}: ${item.href}`,
                );
              }}
            >
              打开 {item.label}
            </Button>
          ))}
          <Button
            icon={<HardDrive className="h-4 w-4" />}
            onClick={() =>
              onAudit(
                "settings-database-runtime-select",
                `${store.name}: ${store.status}`,
              )
            }
          >
            写入本地审计
          </Button>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-slate-100 p-3">
        <p className="text-xs font-medium text-slate-700">说明</p>
        <ul className="mt-2 grid gap-1 text-xs leading-5 text-slate-600">
          {store.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-2 py-1.5">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-right font-mono text-slate-800">
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: DatabaseRuntimeStatus }) {
  const tone = storeStatusTone(status);
  const color =
    tone === "good"
      ? "green"
      : tone === "warn"
        ? "gold"
        : tone === "bad"
          ? "red"
          : "default";
  return (
    <Badge
      color={color}
      text={
        <span className="whitespace-nowrap text-xs">
          {databaseStatusLabel(status)}
        </span>
      }
    />
  );
}

async function copyText(
  value: string,
  setNotice: (value: string | null) => void,
  setError: (value: string | null) => void,
) {
  try {
    await navigator.clipboard.writeText(value);
    setNotice("连接信息已复制");
  } catch {
    setError("当前浏览器不允许写入剪贴板。");
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return "未刷新";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
