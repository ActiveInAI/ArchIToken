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
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  HardDrive,
  Network,
  RefreshCcw,
  Search,
  ShieldAlert,
  TableProperties,
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
import type {
  PostgresForeignKey,
  PostgresSchemaGraph,
  PostgresSchemaTable,
} from "@/lib/database-manager-schema-types";

type RuntimeScope = "architoken" | "same_host" | "all";
type StoreWorkspaceTab =
  | "overview"
  | "schema"
  | "connections"
  | "operations"
  | "events";

const scopeOptions = [
  { label: "ArchIToken", value: "architoken" },
  { label: "同机数据库", value: "same_host" },
  { label: "全部", value: "all" },
];

const storeWorkspaceTabOptions: Array<{
  label: string;
  value: StoreWorkspaceTab;
}> = [
  { label: "概览", value: "overview" },
  { label: "Schema 与数据", value: "schema" },
  { label: "连接入口", value: "connections" },
  { label: "运维动作", value: "operations" },
  { label: "事件审计", value: "events" },
];

interface StoreDataRow {
  name: string;
  type: string;
  status: string;
  detail: string;
}

interface ConsoleSuggestion {
  name: string;
  license: string;
  href: string | null;
  fit: string;
}

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
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);

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
      setActiveStoreId((current) =>
        current && payload.stores.some((store) => store.id === current)
          ? current
          : null,
      );
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
  const activeStore =
    snapshot?.stores.find((store) => store.id === activeStoreId) ?? null;

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
    (store) =>
      store.status === "live" ||
      store.status === "empty" ||
      isGraphFallbackStore(store),
  ).length;
  const totalCount = snapshot?.stores.length ?? 0;
  const livePercent =
    totalCount > 0 ? Math.round((liveCount / totalCount) * 100) : 0;
  const architokenIssueCount = architokenStores.filter(
    (store) =>
      !isGraphFallbackStore(store) &&
      (store.status === "blocked" || store.status === "offline"),
  ).length;
  const openStore = (storeId: string) => {
    const store = snapshot?.stores.find((item) => item.id === storeId);
    setSelectedStoreId(storeId);
    setActiveStoreId(storeId);
    if (store) {
      emitAudit("settings-database-runtime-open-store", store.name);
    }
  };

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
            数据库运维管理
          </h3>
          <p className="arch-muted mt-1 max-w-5xl text-xs leading-5">
            统一查看 ArchIToken data-plane
            绑定、真实服务探测、同机数据库容器、连接入口、fallback
            和非破坏性运维动作。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            href="/app/database-manager"
            icon={<TableProperties className="h-4 w-4" />}
          >
            打开数据库管理器
          </Button>
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

      {activeStore ? (
        <DatabaseStoreWorkspace
          store={activeStore}
          gatewayStatus={snapshot?.gateway?.status ?? "unknown"}
          generatedAt={snapshot?.generatedAt ?? null}
          onBack={() => setActiveStoreId(null)}
          onRefresh={() => void refreshSnapshot()}
          onCopy={(value) => void copyText(value, setNotice, setError)}
          onAudit={emitAudit}
        />
      ) : (
        <>
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
              detail="不含已受控的内部 fallback"
            />
          </div>

          <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-3">
              <div className="rounded-md border border-slate-100 bg-white">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-950">
                        数据库运维对象
                      </span>
                      <Segmented
                        size="small"
                        options={scopeOptions}
                        value={scope}
                        onChange={(value) => setScope(value as RuntimeScope)}
                      />
                      <Tag color="green">运维入口</Tag>
                      <Tag color="blue">真实探测</Tag>
                    </div>
                    <div className="mt-2 max-w-3xl">
                      <Progress
                        percent={livePercent}
                        size="small"
                        status={
                          architokenIssueCount > 0 ? "exception" : "success"
                        }
                      />
                    </div>
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
                  onOpen={openStore}
                />
              </div>
            </div>

            <DatabaseStoreDetail
              store={selectedStore}
              gatewayStatus={snapshot?.gateway?.status ?? "unknown"}
              generatedAt={snapshot?.generatedAt ?? null}
              onCopy={(value) => void copyText(value, setNotice, setError)}
              onOpen={(storeId) => openStore(storeId)}
              onAudit={emitAudit}
            />
          </div>
        </>
      )}
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

function DatabaseStoreGrid({
  stores,
  selectedStoreId,
  onSelect,
  onOpen,
}: {
  stores: DatabaseRuntimeStore[];
  selectedStoreId: string | null;
  onSelect: (storeId: string) => void;
  onOpen: (storeId: string) => void;
}) {
  if (stores.length === 0) {
    return <Empty className="py-10" description="没有匹配的数据库/存储对象" />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] table-fixed text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="w-[22%] px-3 py-2 font-medium">对象</th>
            <th className="w-[10%] px-3 py-2 font-medium">范围</th>
            <th className="w-[12%] px-3 py-2 font-medium">分类</th>
            <th className="w-[20%] px-3 py-2 font-medium">连接/端口</th>
            <th className="w-[12%] px-3 py-2 font-medium">状态</th>
            <th className="w-[16%] px-3 py-2 font-medium">指标</th>
            <th className="w-[8%] px-3 py-2 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {stores.map((store) => {
            const metrics =
              store.metrics
                .slice(0, 2)
                .map((item) => `${item.label}:${item.value}`)
                .join(" / ") || "无指标";
            const openCurrentStore = () => {
              onSelect(store.id);
              onOpen(store.id);
            };
            return (
              <tr
                key={store.id}
                role="button"
                tabIndex={0}
                onClick={openCurrentStore}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openCurrentStore();
                  }
                }}
                className={[
                  "cursor-pointer bg-white transition hover:bg-emerald-50/60",
                  selectedStoreId === store.id ? "bg-emerald-50" : "",
                ].join(" ")}
              >
                <td className="px-3 py-2 align-top">
                  <p className="truncate font-medium text-slate-950">
                    {store.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
                    {store.provider}
                  </p>
                </td>
                <td className="px-3 py-2 align-top">
                  <Tag color={store.group === "architoken" ? "green" : "blue"}>
                    {store.group === "architoken" ? "ArchIToken" : "同机"}
                  </Tag>
                </td>
                <td className="px-3 py-2 align-top text-xs text-slate-600">
                  {databaseCategoryLabel(store.category)}
                </td>
                <td className="px-3 py-2 align-top">
                  <Tooltip title={store.endpoint}>
                    <span className="block truncate font-mono text-xs text-slate-700">
                      {store.endpoint}
                    </span>
                  </Tooltip>
                </td>
                <td className="px-3 py-2 align-top">
                  <StoreStatusBadge store={store} />
                </td>
                <td className="px-3 py-2 align-top">
                  <Tooltip title={metrics}>
                    <span className="block truncate text-xs text-slate-600">
                      {metrics}
                    </span>
                  </Tooltip>
                </td>
                <td className="px-3 py-2 align-top text-right">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openCurrentStore();
                    }}
                    className="inline-flex items-center justify-end gap-1 text-xs text-emerald-700 hover:text-emerald-800"
                  >
                    {isGraphFallbackStore(store) ? "查看依赖" : "进入"}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DatabaseStoreDetail({
  store,
  gatewayStatus,
  generatedAt,
  onCopy,
  onOpen,
  onAudit,
}: {
  store: DatabaseRuntimeStore | null;
  gatewayStatus: string;
  generatedAt: string | null;
  onCopy: (value: string) => void;
  onOpen: (storeId: string) => void;
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
        <StoreStatusBadge store={store} />
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
          {isGraphFallbackStore(store) ? (
            <>
              <Button
                type="primary"
                href={postgresTableCrudHref("public", "data_graph_edges")}
                icon={<TableProperties className="h-4 w-4" />}
                onClick={() =>
                  onAudit(
                    "settings-database-runtime-open-postgres-crud",
                    `${store.name}: public.data_graph_edges`,
                  )
                }
              >
                打开 PostgreSQL 表 CRUD
              </Button>
              <Button
                icon={<ChevronRight className="h-4 w-4" />}
                onClick={() => {
                  onOpen(store.id);
                  onAudit("settings-database-runtime-open-store", store.name);
                }}
              >
                查看 fallback 说明
              </Button>
            </>
          ) : (
            <Button
              type="primary"
              icon={<ChevronRight className="h-4 w-4" />}
              onClick={() => {
                onOpen(store.id);
                onAudit("settings-database-runtime-open-store", store.name);
              }}
            >
              进入二级管理
            </Button>
          )}
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

function DatabaseStoreWorkspace({
  store,
  gatewayStatus,
  generatedAt,
  onBack,
  onRefresh,
  onCopy,
  onAudit,
}: {
  store: DatabaseRuntimeStore;
  gatewayStatus: string;
  generatedAt: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onCopy: (value: string) => void;
  onAudit: (action: string, detail: string) => void;
}) {
  const isPostgresBacked = isPostgresBackedStore(store);
  const [tab, setTab] = useState<StoreWorkspaceTab>(
    isPostgresBacked ? "schema" : "overview",
  );
  const dataRows = useMemo(() => buildStoreRows(store), [store]);
  const consoleSuggestions = useMemo(
    () => buildConsoleSuggestions(store),
    [store],
  );
  const detailRows = [
    { label: "Gateway", value: gatewayStatus },
    { label: "provider", value: store.provider },
    { label: "能力边界", value: store.capability ?? "未绑定" },
    { label: "分类", value: databaseCategoryLabel(store.category) },
    { label: "连接/端口", value: store.endpoint },
    {
      label: "状态",
      value: isGraphFallbackStore(store)
        ? "内部 fallback"
        : databaseStatusLabel(store.status),
    },
    { label: "fallback", value: store.fallbackProvider ?? "无" },
    { label: "split phase", value: store.splitPhase ?? "未返回" },
    { label: "外置", value: formatBoolean(store.externalized) },
    { label: "数据源", value: store.source },
    { label: "刷新时间", value: formatDateTime(generatedAt) },
  ];
  const eventRows = [
    {
      time: formatDateTime(generatedAt),
      action: "真实探测刷新",
      detail: `${store.name} 当前状态：${
        isGraphFallbackStore(store)
          ? "内部 fallback"
          : databaseStatusLabel(store.status)
      }`,
    },
    {
      time: formatDateTime(store.updatedAt ?? null),
      action: "Gateway 绑定同步",
      detail: store.capability
        ? `${store.capability} -> ${store.provider}`
        : "同机对象未接入 ArchIToken data-plane",
    },
    {
      time: formatDateTime(generatedAt),
      action: "管理入口打开",
      detail: "本页面只执行只读巡检、复制、外部控制台打开和本地审计。",
    },
  ];

  useEffect(() => {
    setTab(isPostgresBacked ? "schema" : "overview");
  }, [isPostgresBacked, store.id]);

  return (
    <div
      className="min-h-0 rounded-md border border-slate-100 bg-white"
      data-testid="database-store-workspace"
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 p-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Button
            size="small"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={onBack}
          >
            返回数据库总览
          </Button>
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="truncate text-lg font-medium text-slate-950">
              {store.name}
            </h4>
            <StoreStatusBadge store={store} />
            <Tag color={store.group === "architoken" ? "green" : "blue"}>
              {store.group === "architoken" ? "ArchIToken" : "同机"}
            </Tag>
            <Tag>{databaseCategoryLabel(store.category)}</Tag>
          </div>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
            {store.role}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isPostgresBacked ? (
            <Button
              href={postgresManagerHref(store)}
              icon={<TableProperties className="h-4 w-4" />}
              onClick={() =>
                onAudit(
                  "settings-database-runtime-open-database-manager",
                  `${store.name}: ${postgresManagerHref(store)}`,
                )
              }
            >
              打开真实管理器
            </Button>
          ) : null}
          {isGraphFallbackStore(store) ? (
            <Button
              href={postgresTableCrudHref("public", "data_graph_edges")}
              icon={<TableProperties className="h-4 w-4" />}
              onClick={() =>
                onAudit(
                  "settings-database-runtime-open-postgres-crud",
                  `${store.name}: public.data_graph_edges`,
                )
              }
            >
              打开 PostgreSQL 表 CRUD
            </Button>
          ) : null}
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
            复制连接
          </Button>
          <Button
            type="primary"
            icon={<RefreshCcw className="h-4 w-4" />}
            onClick={() => {
              onRefresh();
              onAudit("settings-database-runtime-refresh-store", store.name);
            }}
          >
            刷新此库
          </Button>
        </div>
      </div>

      <RuntimeMetricTable store={store} />

      <div className="border-b border-slate-100 p-3">
        <div
          role="tablist"
          aria-label="数据库二级管理视图"
          className="inline-flex flex-wrap gap-1 rounded-md bg-slate-100 p-1"
        >
          {storeWorkspaceTabOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={tab === option.value}
              onClick={() => setTab(option.value)}
              className={[
                "h-7 rounded px-2 text-xs transition",
                tab === option.value
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3">
        {tab === "overview" ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="overflow-x-auto rounded-md border border-slate-100">
              <table className="w-full min-w-[720px] text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  {detailRows.map((row) => (
                    <tr key={row.label}>
                      <th className="w-44 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                        {row.label}
                      </th>
                      <td className="px-3 py-2 font-mono text-xs text-slate-800">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-md border border-slate-100 p-3">
              <p className="text-sm font-medium text-slate-950">运行说明</p>
              <ul className="mt-2 grid gap-2 text-xs leading-5 text-slate-600">
                {store.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {tab === "schema" ? (
          isPostgresBacked ? (
            <PostgresLiveSchemaCatalog store={store} />
          ) : (
            <StoreRowsTable rows={dataRows} />
          )
        ) : null}

        {tab === "connections" ? (
          <div className="grid gap-3 2xl:grid-cols-2">
            <div className="overflow-x-auto rounded-md border border-slate-100">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">入口</th>
                    <th className="px-3 py-2 font-medium">地址</th>
                    <th className="px-3 py-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      当前连接/端口
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-800">
                      {store.endpoint}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="small"
                        icon={<Copy className="h-3.5 w-3.5" />}
                        onClick={() => onCopy(store.endpoint)}
                      >
                        复制
                      </Button>
                    </td>
                  </tr>
                  {store.managementLinks.map((link) => (
                    <tr key={`${store.id}:${link.href}`}>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {link.label}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-800">
                        {link.href}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="small"
                          icon={<ExternalLink className="h-3.5 w-3.5" />}
                          onClick={() => {
                            window.open(
                              link.href,
                              "_blank",
                              "noopener,noreferrer",
                            );
                            onAudit(
                              "settings-database-runtime-open-link",
                              `${store.name}: ${link.href}`,
                            );
                          }}
                        >
                          打开
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto rounded-md border border-slate-100">
              <table className="w-full min-w-[620px] table-fixed text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="w-[24%] px-3 py-2 font-medium">
                      可挂接开源台
                    </th>
                    <th className="w-[20%] px-3 py-2 font-medium">许可</th>
                    <th className="w-[36%] px-3 py-2 font-medium">用途边界</th>
                    <th className="w-[20%] px-3 py-2 text-right font-medium">
                      入口
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consoleSuggestions.map((item) => (
                    <tr key={item.name}>
                      <td className="px-3 py-2 text-xs font-medium text-slate-950">
                        {item.name}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">
                        {item.license}
                      </td>
                      <td className="px-3 py-2 text-xs leading-5 text-slate-600">
                        {item.fit}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="small"
                          disabled={!item.href}
                          icon={<ExternalLink className="h-3.5 w-3.5" />}
                          onClick={() => {
                            if (!item.href) return;
                            window.open(
                              item.href,
                              "_blank",
                              "noopener,noreferrer",
                            );
                            onAudit(
                              "settings-database-runtime-open-oss-console",
                              `${store.name}: ${item.name}`,
                            );
                          }}
                        >
                          {item.href ? "打开" : "待部署"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "operations" ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-md border border-slate-100 p-3">
              <p className="text-sm font-medium text-slate-950">允许动作</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button
                  icon={<RefreshCcw className="h-4 w-4" />}
                  onClick={() => {
                    onRefresh();
                    onAudit(
                      "settings-database-runtime-refresh-store",
                      store.name,
                    );
                  }}
                >
                  重新探测
                </Button>
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
                  复制连接
                </Button>
                <Button
                  icon={<HardDrive className="h-4 w-4" />}
                  onClick={() =>
                    onAudit(
                      "settings-database-runtime-write-audit",
                      `${store.name}: ${store.status}`,
                    )
                  }
                >
                  写入本地审计
                </Button>
                {store.managementLinks.map((link) => (
                  <Button
                    key={`${store.id}:operation:${link.href}`}
                    icon={<ExternalLink className="h-4 w-4" />}
                    onClick={() => {
                      window.open(link.href, "_blank", "noopener,noreferrer");
                      onAudit(
                        "settings-database-runtime-open-link",
                        `${store.name}: ${link.href}`,
                      );
                    }}
                  >
                    打开 {link.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-rose-100 bg-rose-50/40 p-3">
              <p className="text-sm font-medium text-rose-900">禁止动作</p>
              <p className="mt-1 text-xs leading-5 text-rose-700">
                当前页面是数据库可视化管理控制面，不直接执行停止、清库、删除容器或迁移破坏性动作。
                这些操作必须走审批、备份和变更单。
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Tooltip title="需要变更审批、备份校验和停机窗口。">
                  <Button
                    disabled
                    danger
                    icon={<ShieldAlert className="h-4 w-4" />}
                  >
                    停止服务
                  </Button>
                </Tooltip>
                <Tooltip title="需要显式变更单，不能从本只读控制面执行。">
                  <Button
                    disabled
                    danger
                    icon={<ShieldAlert className="h-4 w-4" />}
                  >
                    删除数据
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "events" ? (
          <div className="overflow-x-auto rounded-md border border-slate-100">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="w-48 px-3 py-2 font-medium">时间</th>
                  <th className="w-44 px-3 py-2 font-medium">事件</th>
                  <th className="px-3 py-2 font-medium">详情</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eventRows.map((event) => (
                  <tr key={`${event.action}:${event.detail}`}>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                      {event.time}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-slate-950">
                      {event.action}
                    </td>
                    <td className="px-3 py-2 text-xs leading-5 text-slate-600">
                      {event.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RuntimeMetricTable({ store }: { store: DatabaseRuntimeStore }) {
  const metrics =
    store.metrics.length > 0
      ? store.metrics.slice(0, 6)
      : [{ label: "指标", value: "暂无", tone: "muted" as const }];

  return (
    <div className="border-b border-slate-100 bg-slate-50/50 px-3 py-2">
      <div className="overflow-x-auto rounded-md border border-slate-100 bg-white">
        <table className="w-full min-w-[720px] table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {metrics.map((metricItem) => (
                <th key={metricItem.label} className="px-3 py-1.5 font-medium">
                  {metricItem.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {metrics.map((metricItem) => (
                <td
                  key={`${metricItem.label}:${metricItem.value}`}
                  className="px-3 py-2 font-mono text-slate-900"
                >
                  <Tooltip title={metricItem.value}>
                    <span className="block truncate">{metricItem.value}</span>
                  </Tooltip>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StoreRowsTable({ rows }: { rows: StoreDataRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-100">
      <table className="w-full min-w-[840px] table-fixed text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="w-[24%] px-3 py-2 font-medium">对象</th>
            <th className="w-[16%] px-3 py-2 font-medium">类型</th>
            <th className="w-[16%] px-3 py-2 font-medium">状态</th>
            <th className="w-[44%] px-3 py-2 font-medium">说明</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={`${row.name}:${row.type}`}>
              <td className="px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <TableProperties className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="truncate font-medium text-slate-950">
                    {row.name}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-slate-600">
                {row.type}
              </td>
              <td className="px-3 py-2 text-xs text-slate-600">{row.status}</td>
              <td className="px-3 py-2 text-xs leading-5 text-slate-600">
                {row.detail}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PostgresLiveSchemaCatalog({ store }: { store: DatabaseRuntimeStore }) {
  const [graph, setGraph] = useState<PostgresSchemaGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const loadGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/database-manager/postgresql/schema/graph",
        { cache: "no-store" },
      );
      if (!response.ok) throw await apiError(response);
      setGraph((await response.json()) as PostgresSchemaGraph);
    } catch (error) {
      setGraph(null);
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGraph();
  }, []);

  const visibleTables = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (graph?.tables ?? [])
      .filter((table) =>
        isGraphFallbackStore(store)
          ? table.tableName === "data_graph_edges"
          : true,
      )
      .filter((table) => {
        if (!text) return true;
        return [
          table.schemaName,
          table.tableName,
          table.family,
          table.primaryKeyColumns.join(" "),
          table.columns.map((column) => column.columnName).join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(text);
      });
  }, [graph, query, store]);

  const relationStats = useMemo(
    () => buildRelationStats(graph?.foreignKeys ?? []),
    [graph],
  );

  if (loading && !graph) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border border-slate-100">
        <Spin tip="读取 PostgreSQL catalog" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!graph) {
    return <Empty className="py-12" description="PostgreSQL catalog 未加载" />;
  }

  return (
    <div className="grid gap-3" data-testid="settings-postgres-live-schema">
      <div className="flex flex-col gap-2 rounded-md border border-slate-100 bg-white px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
          <Tag color="green">真实 catalog</Tag>
          <span className="font-mono text-slate-700">
            {graph.tableCount} 表 / {graph.viewCount} 视图 / {graph.columnCount}{" "}
            列 / {graph.foreignKeyCount} 外键边
          </span>
          <span className="font-mono text-slate-500">{graph.source}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block min-w-0 sm:w-[300px]">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索表、列、主键"
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-xs outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <Button
            size="small"
            icon={<RefreshCcw className="h-3.5 w-3.5" />}
            loading={loading}
            onClick={() => void loadGraph()}
          >
            刷新 catalog
          </Button>
          <Button
            size="small"
            href={postgresManagerHref(store)}
            icon={<TableProperties className="h-3.5 w-3.5" />}
          >
            完整管理
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-100">
        <table className="w-full min-w-[1160px] table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="w-[20%] px-3 py-2 font-medium">表</th>
              <th className="w-[12%] px-3 py-2 font-medium">表族</th>
              <th className="w-[8%] px-3 py-2 font-medium">列</th>
              <th className="w-[16%] px-3 py-2 font-medium">主键</th>
              <th className="w-[10%] px-3 py-2 font-medium">外键出/入</th>
              <th className="w-[10%] px-3 py-2 font-medium">估算行</th>
              <th className="w-[10%] px-3 py-2 font-medium">容量</th>
              <th className="w-[14%] px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleTables.slice(0, 120).map((table) => {
              const key = schemaTableKey(table);
              const relations = relationStats.get(key) ?? { in: 0, out: 0 };
              return (
                <tr key={key} className="bg-white hover:bg-emerald-50/50">
                  <td className="px-3 py-2 align-top">
                    <Tooltip title={key}>
                      <span className="block truncate font-mono font-medium text-slate-950">
                        {table.tableName}
                      </span>
                    </Tooltip>
                    <span className="font-mono text-[11px] text-slate-400">
                      {table.schemaName} · {table.tableType}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Tag className="m-0" color="blue">
                      {schemaFamilyLabel(table.family)}
                    </Tag>
                  </td>
                  <td className="px-3 py-2 align-top font-mono">
                    {table.columns.length}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Tooltip title={table.primaryKeyColumns.join(", ")}>
                      <span className="block truncate font-mono">
                        {table.primaryKeyColumns.length > 0
                          ? table.primaryKeyColumns.join(", ")
                          : "无"}
                      </span>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2 align-top font-mono">
                    {relations.out} / {relations.in}
                  </td>
                  <td className="px-3 py-2 align-top font-mono">
                    {table.estimatedRows}
                  </td>
                  <td className="px-3 py-2 align-top font-mono">
                    {formatBytes(table.totalBytes)}
                  </td>
                  <td className="px-3 py-2 text-right align-top">
                    <Button
                      size="small"
                      href={postgresTableCrudHref(
                        table.schemaName,
                        table.tableName,
                      )}
                    >
                      CRUD
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visibleTables.length === 0 ? (
          <Empty className="py-10" description="没有匹配的 PostgreSQL 表" />
        ) : null}
      </div>
    </div>
  );
}

function buildStoreRows(store: DatabaseRuntimeStore): StoreDataRow[] {
  const rows: StoreDataRow[] = [];
  const add = (name: string, type: string, status: string, detail: string) =>
    rows.push({ name, type, status, detail });

  if (store.group === "same_host") {
    add(
      store.name,
      "docker container",
      databaseStatusLabel(store.status),
      `${metricValue(store, "image") ?? store.provider}; ${metricValue(store, "status") ?? store.endpoint}`,
    );
    return rows;
  }

  switch (store.capability) {
    case "relational_store":
      add(
        "public schema",
        "PostgreSQL tables",
        "只读探测",
        `${metricValue(store, "表") ?? "未知"} 张表，容量 ${metricValue(store, "容量") ?? "未知"}，估算 ${metricValue(store, "估算行") ?? "未知"} 行。`,
      );
      add(
        "data_plane_bindings",
        "provider registry",
        "已绑定",
        "StorageRouter 的 capability/provider/fallback 元数据。读取 PostgreSQL，更新应走 Gateway API。",
      );
      add(
        "object_store_bindings",
        "object metadata",
        "fallback",
        "对象字节在 S3，绑定和元数据仍由 PostgreSQL 兜底保存。",
      );
      add(
        "data_graph_edges",
        "adjacency graph",
        "fallback",
        "Graph sidecar 未外置前，构件/知识/流程关系保存在 PostgreSQL adjacency 表。",
      );
      break;
    case "object_store":
      add(
        metricValue(store, "桶") ?? "architoken-assets",
        "S3 bucket",
        databaseStatusLabel(store.status),
        `当前探测到 ${metricValue(store, "对象") ?? "0"} 个对象。源文件、派生产物和模型轻量化结果落在对象存储。`,
      );
      add(
        "generation/*",
        "artifact prefix",
        "可管理",
        "CAD/BIM/Office/PDF/GIS/media worker 产物应按租户、模块、对象和版本分层。",
      );
      break;
    case "cache_store":
      add(
        "keyspace",
        "Valkey database",
        databaseStatusLabel(store.status),
        `${metricValue(store, "keys") ?? "0"} 个 key。缓存、限流、短期会话和锁不作为 canonical 数据。`,
      );
      add(
        "ttl policy",
        "ephemeral state",
        "需审计",
        "协同临时状态需要 TTL、命名空间和租户边界；不在这里直接删除。",
      );
      break;
    case "event_store":
      add(
        "JetStream",
        "event stream",
        databaseStatusLabel(store.status),
        `${metricValue(store, "streams") ?? "0"} 条 stream，${metricValue(store, "messages") ?? "0"} 条 message，${metricValue(store, "consumers") ?? "0"} 个 consumer。`,
      );
      add(
        "PostgreSQL outbox",
        "fallback route",
        "兜底",
        "事件主路由是 NATS JetStream，outbox 保持失败恢复和审计边界。",
      );
      break;
    case "vector_store":
      add(
        "collections",
        "Qdrant vector",
        databaseStatusLabel(store.status),
        `${metricValue(store, "collections") ?? "0"} 个 collection。向量索引可从 canonical 数据重建。`,
      );
      add(
        "RAG corpus",
        "semantic index",
        "待装载",
        "未加载持久 collection 时不代表数据丢失，只代表语义检索索引未物化。",
      );
      break;
    case "time_series_store":
      add(
        "data_timeseries_points",
        "ClickHouse table",
        databaseStatusLabel(store.status),
        `${metricValue(store, "rows") ?? "0"} 行，数据库 ${metricValue(store, "db") ?? "architoken"}。`,
      );
      break;
    case "analytics_store":
      add(
        "data_analytics_events",
        "ClickHouse table",
        databaseStatusLabel(store.status),
        `${metricValue(store, "rows") ?? "0"} 行，数据库 ${metricValue(store, "db") ?? "architoken"}。`,
      );
      break;
    case "graph_store":
      add(
        "data_graph_edges",
        "PostgreSQL adjacency",
        "未外置",
        "当前不是外部 Graph DB，而是主干库里的 adjacency fallback。",
      );
      break;
    default:
      store.metrics.forEach((metricItem) =>
        add(
          metricItem.label,
          "runtime metric",
          databaseStatusLabel(store.status),
          metricItem.value,
        ),
      );
  }

  return rows.length > 0
    ? rows
    : [
        {
          name: store.name,
          type: store.provider,
          status: databaseStatusLabel(store.status),
          detail: store.role,
        },
      ];
}

function buildConsoleSuggestions(
  store: DatabaseRuntimeStore,
): ConsoleSuggestion[] {
  switch (store.category) {
    case "relational":
      return [
        {
          name: "CloudBeaver CE",
          license: "Apache-2.0",
          href: "http://127.0.0.1:8978",
          fit: "通用 SQL 管理台；适合 PostgreSQL/ClickHouse 等连接，但应作为 sidecar 接入。",
        },
        {
          name: "pgAdmin 4",
          license: "PostgreSQL",
          href: "http://127.0.0.1:5050",
          fit: "PostgreSQL 深度管理；适合手工巡检，不代替 Gateway API。",
        },
      ];
    case "object":
      return [
        {
          name: "SeaweedFS Filer UI",
          license: "Apache-2.0",
          href: "http://127.0.0.1:8888",
          fit: "对象/文件浏览入口；S3 元数据仍以 ArchIToken 绑定为准。",
        },
        {
          name: "MinIO Console",
          license: "AGPLv3",
          href: null,
          fit: "许可风险较高，不作为默认分发依赖；只允许用户已有外部服务链接。",
        },
      ];
    case "cache":
      return [
        {
          name: "Redis Commander",
          license: "MIT",
          href: null,
          fit: "可作为 Valkey 兼容 sidecar；默认不打包，避免误删短期状态。",
        },
      ];
    case "event":
      return [
        {
          name: "NATS Surveyor",
          license: "Apache-2.0",
          href: null,
          fit: "适合 NATS fleet/Prometheus 监控；当前页面优先打开 /jsz 只读入口。",
        },
      ];
    case "vector":
      return [
        {
          name: "Qdrant Web UI",
          license: "Apache-2.0",
          href: "http://127.0.0.1:6333/dashboard",
          fit: "官方向量 collection、REST API 和数据点浏览入口。",
        },
      ];
    case "time_series":
    case "analytics":
      return [
        {
          name: "CH-UI",
          license: "Apache-2.0 core",
          href: null,
          fit: "ClickHouse SQL 工作台；建议作为可选 sidecar 接入，不写入业务逻辑。",
        },
        {
          name: "CloudBeaver CE",
          license: "Apache-2.0",
          href: "http://127.0.0.1:8978",
          fit: "可作为通用 SQL 客户端连接 ClickHouse HTTP/JDBC。",
        },
      ];
    case "graph":
      return [
        {
          name: "外部 Graph sidecar",
          license: "待评审",
          href: null,
          fit: "当前未配置外部图数据库；不能标记为已打通。",
        },
      ];
    default:
      return [
        {
          name: "外部管理台",
          license: "待评审",
          href: null,
          fit: "同机服务只列库存，不默认接管。",
        },
      ];
  }
}

function metricValue(
  store: DatabaseRuntimeStore,
  label: string,
): string | null {
  return store.metrics.find((item) => item.label === label)?.value ?? null;
}

function formatBoolean(value: boolean | undefined): string {
  if (typeof value !== "boolean") return "未知";
  return value ? "true" : "false";
}

function isGraphFallbackStore(store: DatabaseRuntimeStore): boolean {
  return (
    store.capability === "graph_store" &&
    store.provider === "postgres_adjacency" &&
    store.externalized === false
  );
}

function isPostgresBackedStore(store: DatabaseRuntimeStore): boolean {
  return (
    store.provider === "postgres" ||
    store.provider === "postgres_adjacency" ||
    store.capability === "relational_store" ||
    isGraphFallbackStore(store)
  );
}

function postgresTableCrudHref(schemaName: string, tableName: string): string {
  const params = new URLSearchParams({ schema: schemaName, table: tableName });
  return `/app/database-manager?${params.toString()}#postgres-crud`;
}

function postgresManagerHref(store: DatabaseRuntimeStore): string {
  return isGraphFallbackStore(store)
    ? postgresTableCrudHref("public", "data_graph_edges")
    : "/app/database-manager#postgres-crud";
}

function schemaTableKey(
  table: Pick<PostgresSchemaTable, "schemaName" | "tableName">,
) {
  return `${table.schemaName}.${table.tableName}`;
}

function schemaFamilyLabel(family: string): string {
  const labels: Record<string, string> = {
    auth: "账号",
    iam: "权限",
    cost: "造价",
    planning: "计划",
    standards_semantic: "标准语义",
    data_plane: "数据平面",
    cde_asset_module: "CDE/资产",
    ai_runtime: "AI运行",
    other: "其它",
  };
  return labels[family] ?? family;
}

function buildRelationStats(foreignKeys: PostgresForeignKey[]) {
  const stats = new Map<string, { in: number; out: number }>();
  const ensure = (key: string) => {
    const current = stats.get(key) ?? { in: 0, out: 0 };
    stats.set(key, current);
    return current;
  };
  for (const foreignKey of foreignKeys) {
    ensure(`${foreignKey.sourceSchema}.${foreignKey.sourceTable}`).out += 1;
    ensure(`${foreignKey.targetSchema}.${foreignKey.targetTable}`).in += 1;
  }
  return stats;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function apiError(response: Response): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as {
    message?: string;
    error?: string;
    detail?: string;
  } | null;
  return new Error(
    payload?.message ??
      payload?.detail ??
      payload?.error ??
      `${response.status} ${response.statusText}`,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function StoreStatusBadge({ store }: { store: DatabaseRuntimeStore }) {
  if (isGraphFallbackStore(store)) {
    return (
      <Badge
        color="gold"
        text={<span className="whitespace-nowrap text-xs">内部 fallback</span>}
      />
    );
  }
  return <StatusBadge status={store.status} />;
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
