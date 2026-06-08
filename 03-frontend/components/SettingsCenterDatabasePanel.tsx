// components/SettingsCenterDatabasePanel.tsx
// License: Apache-2.0
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Badge, Button, Empty, Segmented, Spin, Tag, Tooltip } from "antd";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  HardDrive,
  RefreshCcw,
  Search,
  ShieldAlert,
  TableProperties,
  X,
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
import {
  UpstreamNameValueTable,
  UpstreamResourceTable,
  makeKubeSphereListResult,
  makeKubeSphereQueryState,
  type UpstreamResourceAction,
  type UpstreamResourceTableColumn,
} from "@/components/database-manager/UpstreamResourceConsole";
import { PostgresCrudPanel } from "@/components/DatabaseManagerWorkbench";

type RuntimeScope = "architoken" | "same_host" | "all";
type DatabaseConsoleView =
  | "resources"
  | "crud"
  | "schema"
  | "connections"
  | "operations"
  | "events";
type StoreWorkspaceTab =
  | "overview"
  | "schema"
  | "connections"
  | "operations"
  | "events";

type DatabaseStoreContextMenuState = {
  storeId: string | null;
  x: number;
  y: number;
};

const scopeOptions = [
  { label: "ArchIToken", value: "architoken" },
  { label: "同机数据库", value: "same_host" },
  { label: "全部", value: "all" },
];

const databaseConsoleViewOptions: Array<{
  label: string;
  value: DatabaseConsoleView;
  requiresPostgres?: boolean;
}> = [
  { label: "资源", value: "resources" },
  { label: "表级 CRUD", value: "crud", requiresPostgres: true },
  { label: "Schema", value: "schema", requiresPostgres: true },
  { label: "连接", value: "connections" },
  { label: "操作", value: "operations" },
  { label: "事件", value: "events" },
];

const storeWorkspaceTabOptions: Array<{
  label: string;
  value: StoreWorkspaceTab;
}> = [
  { label: "资源", value: "schema" },
  { label: "详情", value: "overview" },
  { label: "连接", value: "connections" },
  { label: "操作", value: "operations" },
  { label: "事件", value: "events" },
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
  const [consoleView, setConsoleView] = useState<DatabaseConsoleView>("crud");
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [storeContextMenu, setStoreContextMenu] =
    useState<DatabaseStoreContextMenuState | null>(null);

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
    const refreshTimer = window.setTimeout(() => {
      void refreshSnapshot();
    }, 0);
    return () => window.clearTimeout(refreshTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const selectedCanUsePostgresTools = selectedStore
    ? isPostgresBackedStore(selectedStore)
    : false;

  useEffect(() => {
    if (!selectedStore) return;
    const viewTimer = window.setTimeout(() => {
      setConsoleView((current) => {
        if (selectedCanUsePostgresTools) {
          return current === "resources" ? "crud" : current;
        }
        return current === "crud" || current === "schema"
          ? "resources"
          : current;
      });
    }, 0);
    return () => window.clearTimeout(viewTimer);
  }, [selectedCanUsePostgresTools, selectedStore]);

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
  const architokenIssueCount = architokenStores.filter(
    (store) =>
      !isGraphFallbackStore(store) &&
      (store.status === "blocked" || store.status === "offline"),
  ).length;
  const openStore = (storeId: string) => {
    const store = snapshot?.stores.find((item) => item.id === storeId);
    setStoreContextMenu(null);
    setSelectedStoreId(storeId);
    setConsoleView(
      store && isPostgresBackedStore(store) ? "crud" : "resources",
    );
    setDetailsDrawerOpen(Boolean(store && !isPostgresBackedStore(store)));
    if (store) {
      emitAudit("settings-database-runtime-open-store", store.name);
    }
  };

  const closeStoreContextMenu = () => {
    setStoreContextMenu(null);
  };

  const openStoreContextMenu = (
    store: DatabaseRuntimeStore,
    event: MouseEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedStoreId(store.id);
    setStoreContextMenu({
      storeId: store.id,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const openDatabaseBackgroundContextMenu = (
    event: MouseEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    setStoreContextMenu({
      storeId: null,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const copyStoreEndpoint = (store: DatabaseRuntimeStore) => {
    void copyText(store.endpoint, setNotice, setError);
    emitAudit(
      "settings-database-runtime-copy-endpoint",
      `${store.name}: ${store.endpoint}`,
    );
  };

  const registerInspection = () => {
    setNotice("已登记一次数据库巡检，不执行启动、停止或删除动作。");
    emitAudit(
      "settings-database-runtime-inspection",
      "non-destructive inspection logged",
    );
  };

  const openDatabaseManager = () => {
    window.open(
      "/app/database-manager#postgres-crud",
      "_blank",
      "noopener,noreferrer",
    );
    emitAudit(
      "settings-database-runtime-open-database-manager",
      "/app/database-manager#postgres-crud",
    );
  };

  const openStoreManager = (store: DatabaseRuntimeStore) => {
    const href = postgresManagerHref(store);
    window.open(href, "_blank", "noopener,noreferrer");
    emitAudit(
      isGraphFallbackStore(store)
        ? "settings-database-runtime-open-postgres-crud"
        : "settings-database-runtime-open-database-manager",
      `${store.name}: ${href}`,
    );
  };

  const selectedContextStore =
    storeContextMenu?.storeId != null
      ? (snapshot?.stores.find(
          (store) => store.id === storeContextMenu.storeId,
        ) ?? null)
      : null;

  return (
    <section
      className="flex min-h-0 flex-col gap-3"
      data-testid="settings-database-runtime"
      onClick={closeStoreContextMenu}
    >
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

      <div
        className="overflow-hidden rounded-md border border-slate-100 bg-white"
        data-testid="settings-database-headlamp-console"
      >
        <div className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-normal text-emerald-700">
              数据库资源控制台
            </span>
            <Tag color="green">
              {liveCount}/{totalCount} 在线
            </Tag>
            <Tag color={architokenIssueCount > 0 ? "red" : "default"}>
              {architokenIssueCount} 阻断
            </Tag>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="small"
              icon={<TableProperties className="h-3.5 w-3.5" />}
              onClick={openDatabaseManager}
            >
              打开数据库管理器
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<RefreshCcw className="h-3.5 w-3.5" />}
              loading={loading}
              onClick={() => void refreshSnapshot()}
            >
              刷新
            </Button>
            <Button
              size="small"
              icon={<ShieldAlert className="h-3.5 w-3.5" />}
              onClick={registerInspection}
            >
              巡检
            </Button>
          </div>
        </div>

        <div className="grid min-h-[760px] grid-cols-1 xl:grid-cols-[248px_minmax(0,1fr)]">
          <DatabaseConsoleNavigation
            architokenStores={architokenStores}
            sameHostStores={sameHostStores}
            selectedStoreId={selectedStore?.id ?? null}
            onSelect={(store) => {
              setSelectedStoreId(store.id);
              setConsoleView(
                isPostgresBackedStore(store) ? "crud" : "resources",
              );
              setDetailsDrawerOpen(false);
              emitAudit("settings-database-runtime-select", store.name);
            }}
          />

          <main className="min-w-0 border-y border-slate-100 xl:border-y-0 xl:border-l">
            <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/40 px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-slate-950">
                    {selectedStore?.name ?? "数据库资源"}
                  </h3>
                  {selectedStore ? (
                    <StoreStatusBadge store={selectedStore} />
                  ) : null}
                  {selectedStore ? (
                    <Tag
                      color={
                        selectedStore.group === "architoken" ? "green" : "blue"
                      }
                    >
                      {selectedStore.group === "architoken"
                        ? "ArchIToken"
                        : "同机"}
                    </Tag>
                  ) : null}
                  {selectedStore ? (
                    <span className="truncate font-mono text-xs text-slate-500">
                      {selectedStore.endpoint}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  size="small"
                  options={scopeOptions}
                  value={scope}
                  onChange={(value) => setScope(value as RuntimeScope)}
                />
                <label className="relative block min-w-0 sm:w-[300px]">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="搜索库名、provider、端口、能力边界"
                    className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-xs text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>
            </div>

            <div className="border-b border-slate-100 px-3 py-2">
              <div
                role="tablist"
                aria-label="数据库资源控制台视图"
                className="inline-flex flex-wrap gap-1 rounded-md bg-slate-100 p-1"
              >
                {databaseConsoleViewOptions.map((option) => {
                  const disabled =
                    option.requiresPostgres && !selectedCanUsePostgresTools;
                  return (
                    <Tooltip
                      key={option.value}
                      title={
                        disabled
                          ? "仅 PostgreSQL 或 PostgreSQL fallback 支持"
                          : option.label
                      }
                    >
                      <button
                        type="button"
                        role="tab"
                        disabled={disabled}
                        aria-selected={consoleView === option.value}
                        onClick={() => setConsoleView(option.value)}
                        className={[
                          "h-7 rounded px-2 text-xs transition",
                          consoleView === option.value
                            ? "bg-white text-emerald-700 shadow-sm"
                            : "text-slate-600 hover:bg-white/80 hover:text-slate-950",
                          disabled ? "cursor-not-allowed opacity-40" : "",
                        ].join(" ")}
                      >
                        {option.label}
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            <div
              className="max-h-[calc(100vh-260px)] min-h-[600px] overflow-auto p-3"
              onContextMenu={openDatabaseBackgroundContextMenu}
            >
              {consoleView === "resources" ? (
                <DatabaseStoreGrid
                  stores={filteredStores}
                  selectedStoreId={selectedStore?.id ?? null}
                  onSelect={setSelectedStoreId}
                  onOpen={openStore}
                  onContextMenu={openStoreContextMenu}
                  onBackgroundContextMenu={openDatabaseBackgroundContextMenu}
                />
              ) : null}

              {consoleView === "crud" ? (
                selectedCanUsePostgresTools ? (
                  <PostgresCrudPanel />
                ) : (
                  <StoreRowsTable
                    rows={selectedStore ? buildStoreRows(selectedStore) : []}
                  />
                )
              ) : null}

              {consoleView === "schema" ? (
                selectedStore && selectedCanUsePostgresTools ? (
                  <PostgresLiveSchemaCatalog
                    store={selectedStore}
                    onOpenCrud={(schemaName, tableName) => {
                      setConsoleView("crud");
                      setPostgresCrudLocation(schemaName, tableName);
                      emitAudit(
                        "settings-database-runtime-open-postgres-crud",
                        `${schemaName}.${tableName}`,
                      );
                    }}
                  />
                ) : (
                  <StoreRowsTable
                    rows={selectedStore ? buildStoreRows(selectedStore) : []}
                  />
                )
              ) : null}

              {consoleView === "connections" ? (
                <DatabaseConsoleConnections
                  store={selectedStore}
                  onCopy={(value) => void copyText(value, setNotice, setError)}
                  onAudit={emitAudit}
                />
              ) : null}

              {consoleView === "operations" ? (
                <DatabaseConsoleOperations
                  store={selectedStore}
                  onCopy={(value) => void copyText(value, setNotice, setError)}
                  onRefresh={() => void refreshSnapshot()}
                  onAudit={emitAudit}
                />
              ) : null}

              {consoleView === "events" ? (
                <DatabaseConsoleEvents
                  store={selectedStore}
                  generatedAt={snapshot?.generatedAt ?? null}
                />
              ) : null}
            </div>
          </main>
        </div>
      </div>

      <DatabaseConsoleDetailsDrawer
        open={detailsDrawerOpen}
        store={selectedStore}
        gatewayStatus={snapshot?.gateway?.status ?? "unknown"}
        generatedAt={snapshot?.generatedAt ?? null}
        onClose={() => setDetailsDrawerOpen(false)}
        onCopy={(value) => void copyText(value, setNotice, setError)}
        onOpenCrud={() => {
          setConsoleView("crud");
          setDetailsDrawerOpen(false);
        }}
        onOpenSchema={() => {
          setConsoleView("schema");
          setDetailsDrawerOpen(false);
        }}
        onOpenManager={openStoreManager}
        onAudit={emitAudit}
      />

      {storeContextMenu ? (
        <DatabaseStoreContextMenu
          menu={storeContextMenu}
          store={selectedContextStore}
          onClose={closeStoreContextMenu}
          onOpen={openStore}
          onCopyEndpoint={copyStoreEndpoint}
          onOpenManager={openStoreManager}
          onRefresh={() => void refreshSnapshot()}
          onInspect={registerInspection}
          onOpenDatabaseManager={openDatabaseManager}
          onAudit={emitAudit}
        />
      ) : null}
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

function DatabaseConsoleNavigation({
  architokenStores,
  sameHostStores,
  selectedStoreId,
  onSelect,
}: {
  architokenStores: DatabaseRuntimeStore[];
  sameHostStores: DatabaseRuntimeStore[];
  selectedStoreId: string | null;
  onSelect: (store: DatabaseRuntimeStore) => void;
}) {
  return (
    <aside className="min-w-0 bg-slate-50/70">
      <div className="border-b border-slate-100 px-3 py-2">
        <p className="text-xs font-semibold text-slate-950">资源导航</p>
      </div>
      <div className="max-h-[calc(100vh-230px)] overflow-y-auto p-2">
        <DatabaseConsoleNavGroup
          title="数据平面"
          stores={architokenStores}
          selectedStoreId={selectedStoreId}
          onSelect={onSelect}
        />
        <DatabaseConsoleNavGroup
          title="同机资源"
          stores={sameHostStores}
          selectedStoreId={selectedStoreId}
          onSelect={onSelect}
        />
      </div>
    </aside>
  );
}

function DatabaseConsoleNavGroup({
  title,
  stores,
  selectedStoreId,
  onSelect,
}: {
  title: string;
  stores: DatabaseRuntimeStore[];
  selectedStoreId: string | null;
  onSelect: (store: DatabaseRuntimeStore) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-normal text-slate-500">
        <span>{title}</span>
        <span className="font-mono">{stores.length}</span>
      </div>
      <div className="grid gap-1">
        {stores.map((store) => {
          const selected = selectedStoreId === store.id;
          return (
            <button
              key={store.id}
              type="button"
              onClick={() => onSelect(store)}
              className={[
                "flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition",
                selected
                  ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200"
                  : "text-slate-700 hover:bg-white hover:text-slate-950",
              ].join(" ")}
            >
              <span
                className={[
                  "h-2 w-2 shrink-0 rounded-full",
                  storeStatusDotClass(store),
                ].join(" ")}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">
                  {store.name}
                </span>
                <span className="block truncate font-mono text-[11px] text-slate-500">
                  {databaseCategoryLabel(store.category)}
                </span>
              </span>
              {isPostgresBackedStore(store) ? (
                <TableProperties className="h-3.5 w-3.5 shrink-0" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DatabaseConsoleDetailsDrawer({
  open,
  store,
  gatewayStatus,
  generatedAt,
  onClose,
  onCopy,
  onOpenCrud,
  onOpenSchema,
  onOpenManager,
  onAudit,
}: {
  open: boolean;
  store: DatabaseRuntimeStore | null;
  gatewayStatus: string;
  generatedAt: string | null;
  onClose: () => void;
  onCopy: (value: string) => void;
  onOpenCrud: () => void;
  onOpenSchema: () => void;
  onOpenManager: (store: DatabaseRuntimeStore) => void;
  onAudit: (action: string, detail: string) => void;
}) {
  if (!open) return null;
  if (!store) {
    return (
      <aside className="fixed bottom-6 right-6 top-24 z-50 w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-slate-200 bg-white p-3 shadow-2xl">
        <Empty description="选择资源查看详情" />
      </aside>
    );
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-slate-950/10"
        aria-label="关闭资源详情"
        onClick={onClose}
      />
      <aside
        className="fixed bottom-6 right-6 top-24 z-50 w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl"
        data-testid="settings-database-details-drawer"
      >
        <div className="border-b border-slate-100 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-normal text-rose-500">
                资源详情
              </p>
              <h4 className="mt-1 truncate text-sm font-semibold text-slate-950">
                {store.name}
              </h4>
              <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
                {store.provider}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StoreStatusBadge store={store} />
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                aria-label="关闭资源详情"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="max-h-[calc(100vh-230px)] overflow-y-auto p-3">
          <UpstreamNameValueTable
            compact
            rows={[
              { name: "Gateway", value: gatewayStatus },
              { name: "能力边界", value: store.capability ?? "未绑定" },
              { name: "分类", value: databaseCategoryLabel(store.category) },
              { name: "连接", value: store.endpoint },
              { name: "fallback", value: store.fallbackProvider ?? "无" },
              { name: "外置", value: formatBoolean(store.externalized) },
              { name: "刷新时间", value: formatDateTime(generatedAt) },
            ]}
          />

          {store.metrics.length > 0 ? (
            <UpstreamNameValueTable
              compact
              className="mt-3"
              rows={store.metrics.map((metricItem) => ({
                name: metricItem.label,
                value: (
                  <Tooltip title={metricItem.value}>
                    <span className="block truncate">{metricItem.value}</span>
                  </Tooltip>
                ),
              }))}
            />
          ) : null}

          <div className="mt-3 grid gap-2">
            {isPostgresBackedStore(store) ? (
              <>
                <Button
                  type="primary"
                  icon={<TableProperties className="h-4 w-4" />}
                  onClick={() => {
                    onOpenCrud();
                    onAudit(
                      "settings-database-runtime-open-postgres-crud",
                      store.name,
                    );
                  }}
                >
                  表级 CRUD
                </Button>
                <Button
                  icon={<Database className="h-4 w-4" />}
                  onClick={() => {
                    onOpenSchema();
                    onAudit(
                      "settings-database-runtime-open-postgres-schema",
                      store.name,
                    );
                  }}
                >
                  Schema 目录
                </Button>
              </>
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
              复制连接/端口
            </Button>
            {isPostgresBackedStore(store) ? (
              <Button
                icon={<ExternalLink className="h-4 w-4" />}
                onClick={() => onOpenManager(store)}
              >
                独立管理器
              </Button>
            ) : null}
            {store.managementLinks.map((item) => (
              <Button
                key={`${store.id}:drawer:${item.href}`}
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
                  "settings-database-runtime-write-audit",
                  `${store.name}: ${store.status}`,
                )
              }
            >
              写入本地审计
            </Button>
          </div>

          <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700">运行说明</p>
            <ul className="mt-2 grid gap-1 text-xs leading-5 text-slate-600">
              {store.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
}

function DatabaseConsoleConnections({
  store,
  onCopy,
  onAudit,
}: {
  store: DatabaseRuntimeStore | null;
  onCopy: (value: string) => void;
  onAudit: (action: string, detail: string) => void;
}) {
  if (!store) return <Empty className="py-16" description="选择数据库资源" />;
  const consoleSuggestions = buildConsoleSuggestions(store);
  return (
    <div className="grid gap-3 2xl:grid-cols-2">
      <div className="overflow-x-auto rounded-md border border-slate-100 bg-white">
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
              <tr key={`${store.id}:connection:${link.href}`}>
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
                      window.open(link.href, "_blank", "noopener,noreferrer");
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

      <div className="overflow-x-auto rounded-md border border-slate-100 bg-white">
        <table className="w-full min-w-[620px] table-fixed text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="w-[24%] px-3 py-2 font-medium">开源控制台</th>
              <th className="w-[20%] px-3 py-2 font-medium">许可</th>
              <th className="w-[36%] px-3 py-2 font-medium">用途边界</th>
              <th className="w-[20%] px-3 py-2 text-right font-medium">入口</th>
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
                      window.open(item.href, "_blank", "noopener,noreferrer");
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
  );
}

function DatabaseConsoleOperations({
  store,
  onCopy,
  onRefresh,
  onAudit,
}: {
  store: DatabaseRuntimeStore | null;
  onCopy: (value: string) => void;
  onRefresh: () => void;
  onAudit: (action: string, detail: string) => void;
}) {
  if (!store) return <Empty className="py-16" description="选择数据库资源" />;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-md border border-slate-100 bg-white p-3">
        <p className="text-sm font-medium text-slate-950">允许动作</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button
            icon={<RefreshCcw className="h-4 w-4" />}
            onClick={() => {
              onRefresh();
              onAudit("settings-database-runtime-refresh-store", store.name);
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
            写入审计
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
        <p className="text-sm font-medium text-rose-900">需要审批的动作</p>
        <p className="mt-1 text-xs leading-5 text-rose-700">
          停止服务、清库、删除容器、批量迁移和备份恢复必须走变更单、备份校验和审计，不从设置中心直接执行。
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Tooltip title="需要变更审批、备份校验和停机窗口。">
            <Button disabled danger icon={<ShieldAlert className="h-4 w-4" />}>
              停止服务
            </Button>
          </Tooltip>
          <Tooltip title="需要显式变更单，不能从本控制面直接执行。">
            <Button disabled danger icon={<ShieldAlert className="h-4 w-4" />}>
              删除数据
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

function DatabaseConsoleEvents({
  store,
  generatedAt,
}: {
  store: DatabaseRuntimeStore | null;
  generatedAt: string | null;
}) {
  if (!store) return <Empty className="py-16" description="选择数据库资源" />;
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
      action: "权限模型",
      detail: isPostgresBackedStore(store)
        ? "表级 CRUD 已通过 PostgreSQL manager API 暴露； destructive action 仍需变更审批。"
        : "当前资源只提供连接、探测、审计和外部管理入口。",
    },
  ];

  return (
    <div className="overflow-x-auto rounded-md border border-slate-100 bg-white">
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
  );
}

export function DatabaseResourceSummaryBar({
  cells,
}: {
  cells: Array<{
    label: string;
    value: number;
    detail: string;
    icon: ReactNode;
  }>;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-100 bg-white">
      <table className="w-full min-w-[820px] table-fixed text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {cells.map((cell) => (
              <th key={cell.label} className="px-3 py-2 font-medium">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  {cell.icon}
                  <span className="truncate">{cell.label}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {cells.map((cell) => (
              <td key={cell.label} className="px-3 py-2 align-top">
                <span className="block font-mono text-base font-semibold text-slate-950">
                  {cell.value}
                </span>
                <span className="mt-0.5 block truncate text-slate-500">
                  {cell.detail}
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DatabaseStoreGrid({
  stores,
  selectedStoreId,
  onSelect,
  onOpen,
  onContextMenu,
  onBackgroundContextMenu,
}: {
  stores: DatabaseRuntimeStore[];
  selectedStoreId: string | null;
  onSelect: (storeId: string) => void;
  onOpen: (storeId: string) => void;
  onContextMenu: (
    store: DatabaseRuntimeStore,
    event: MouseEvent<HTMLElement>,
  ) => void;
  onBackgroundContextMenu: (event: MouseEvent<HTMLElement>) => void;
}) {
  const result = makeKubeSphereListResult(stores);
  const query = makeKubeSphereQueryState({
    limit: Math.max(stores.length, 1),
    sortBy: "name",
    ascending: true,
  });
  const columns: Array<UpstreamResourceTableColumn<DatabaseRuntimeStore>> = [
    {
      id: "name",
      label: "资源",
      width: "24%",
      getValue: (store) => `${store.name} ${store.provider}`,
      render: (store) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-950">{store.name}</p>
          <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
            {store.provider}
          </p>
        </div>
      ),
    },
    {
      id: "scope",
      label: "范围",
      width: "10%",
      getValue: (store) => store.group,
      render: (store) => (
        <Tag color={store.group === "architoken" ? "green" : "blue"}>
          {store.group === "architoken" ? "ArchIToken" : "同机"}
        </Tag>
      ),
    },
    {
      id: "category",
      label: "分类",
      width: "12%",
      getValue: (store) => databaseCategoryLabel(store.category),
      className: "text-xs text-slate-600",
    },
    {
      id: "endpoint",
      label: "连接/端口",
      width: "22%",
      getValue: (store) => store.endpoint,
      render: (store) => (
        <Tooltip title={store.endpoint}>
          <span className="block truncate font-mono text-xs text-slate-700">
            {store.endpoint}
          </span>
        </Tooltip>
      ),
    },
    {
      id: "status",
      label: "状态",
      width: "12%",
      getValue: (store) =>
        isGraphFallbackStore(store)
          ? "internal fallback"
          : databaseStatusLabel(store.status),
      render: (store) => <StoreStatusBadge store={store} />,
    },
    {
      id: "metrics",
      label: "证据",
      width: "20%",
      getValue: (store) => runtimeMetricText(store),
      render: (store) => (
        <Tooltip title={runtimeMetricText(store)}>
          <span className="block truncate text-xs text-slate-600">
            {runtimeMetricText(store)}
          </span>
        </Tooltip>
      ),
    },
  ];
  const actions: Array<UpstreamResourceAction<DatabaseRuntimeStore>> = [
    {
      id: "manage",
      description: (store) => (isPostgresBackedStore(store) ? "管理" : "详情"),
      longDescription: (store) =>
        isPostgresBackedStore(store)
          ? "在当前资源控制台打开真实 CRUD 管理"
          : "进入资源详情",
      icon: <ChevronRight className="h-3.5 w-3.5" />,
      primary: (store) => isPostgresBackedStore(store),
      onClick: (store) => {
        onSelect(store.id);
        onOpen(store.id);
      },
    },
  ];

  return (
    <div
      data-testid="settings-database-store-grid"
      onContextMenu={onBackgroundContextMenu}
    >
      <UpstreamResourceTable
        id="architoken-database-runtime-resources"
        result={result}
        query={query}
        columns={columns}
        actions={actions}
        rowKey={(store) => store.id}
        rowTestId={(store) => `settings-database-store-${store.id}`}
        selectedKey={selectedStoreId}
        onSelect={(store) => onSelect(store.id)}
        onOpen={(store) => onOpen(store.id)}
        onRowContextMenu={onContextMenu}
        onBackgroundContextMenu={onBackgroundContextMenu}
        emptyText="没有匹配的数据库/存储对象"
      />
    </div>
  );
}

function DatabaseStoreContextMenu({
  menu,
  store,
  onClose,
  onOpen,
  onCopyEndpoint,
  onOpenManager,
  onRefresh,
  onInspect,
  onOpenDatabaseManager,
  onAudit,
}: {
  menu: DatabaseStoreContextMenuState;
  store: DatabaseRuntimeStore | null;
  onClose: () => void;
  onOpen: (storeId: string) => void;
  onCopyEndpoint: (store: DatabaseRuntimeStore) => void;
  onOpenManager: (store: DatabaseRuntimeStore) => void;
  onRefresh: () => void;
  onInspect: () => void;
  onOpenDatabaseManager: () => void;
  onAudit: (action: string, detail: string) => void;
}) {
  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      className="fixed z-[60] w-56 rounded-md border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      aria-label={
        store ? `${store.name} 数据库操作菜单` : "数据库运维空白区域操作菜单"
      }
      data-testid="settings-database-context-menu"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {store ? (
        <>
          <DatabaseContextMenuButton
            icon={<ChevronRight className="h-4 w-4" />}
            label={
              isGraphFallbackStore(store)
                ? "查看 fallback 说明"
                : "进入二级管理"
            }
            onClick={() => run(() => onOpen(store.id))}
          />
          <DatabaseContextMenuButton
            icon={<Copy className="h-4 w-4" />}
            label="复制连接/端口"
            onClick={() => run(() => onCopyEndpoint(store))}
          />
          {isPostgresBackedStore(store) ? (
            <DatabaseContextMenuButton
              icon={<TableProperties className="h-4 w-4" />}
              label={
                isGraphFallbackStore(store)
                  ? "打开 PostgreSQL 表 CRUD"
                  : "打开真实管理器"
              }
              onClick={() => run(() => onOpenManager(store))}
            />
          ) : null}
          <DatabaseContextMenuButton
            icon={<HardDrive className="h-4 w-4" />}
            label="写入本地审计"
            onClick={() =>
              run(() =>
                onAudit(
                  "settings-database-runtime-select",
                  `${store.name}: ${store.status}`,
                ),
              )
            }
          />
          <div className="my-1 h-px bg-slate-100" />
        </>
      ) : null}
      <DatabaseContextMenuButton
        icon={<RefreshCcw className="h-4 w-4" />}
        label="刷新状态"
        onClick={() => run(onRefresh)}
      />
      <DatabaseContextMenuButton
        icon={<ShieldAlert className="h-4 w-4" />}
        label="登记巡检"
        onClick={() => run(onInspect)}
      />
      {!store ? (
        <DatabaseContextMenuButton
          icon={<TableProperties className="h-4 w-4" />}
          label="打开数据库管理器"
          onClick={() => run(onOpenDatabaseManager)}
        />
      ) : null}
      <button
        type="button"
        onClick={onClose}
        className="sr-only"
        aria-label="关闭菜单"
      />
    </div>
  );
}

function DatabaseContextMenuButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex h-8 w-full items-center gap-2 px-3 text-left text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function DatabaseStoreDetail({
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

      <UpstreamNameValueTable
        compact
        className="mt-3"
        rows={[
          { name: "Gateway", value: gatewayStatus },
          { name: "能力边界", value: store.capability ?? "未绑定" },
          { name: "分类", value: databaseCategoryLabel(store.category) },
          { name: "连接", value: store.endpoint },
          { name: "fallback", value: store.fallbackProvider ?? "无" },
          { name: "外置", value: formatBoolean(store.externalized) },
          { name: "刷新时间", value: formatDateTime(generatedAt) },
        ]}
      />

      {store.metrics.length > 0 ? (
        <UpstreamNameValueTable
          compact
          className="mt-3"
          rows={store.metrics.map((item) => ({
            name: item.label,
            value: (
              <Tooltip title={item.value}>
                <span className="block truncate font-mono text-slate-900">
                  {item.value}
                </span>
              </Tooltip>
            ),
          }))}
        />
      ) : null}

      <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-700">管理动作</p>
        <div className="mt-2 grid gap-2">
          {isPostgresBackedStore(store) ? (
            <>
              <Button
                type="primary"
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
              <Button
                icon={<ChevronRight className="h-4 w-4" />}
                onClick={() => {
                  onOpen(store.id);
                  onAudit("settings-database-runtime-open-store", store.name);
                }}
              >
                查看资源详情
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

export function DatabaseStoreWorkspace({
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
    const tabTimer = window.setTimeout(() => {
      setTab(isPostgresBacked ? "schema" : "overview");
    }, 0);
    return () => window.clearTimeout(tabTimer);
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
            返回资源列表
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
            刷新资源
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
            <UpstreamNameValueTable
              compact
              rows={detailRows.map((row) => ({
                name: row.label,
                value: row.value,
              }))}
            />
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
      <UpstreamNameValueTable
        compact
        rows={metrics.map((metricItem) => ({
          name: metricItem.label,
          value: (
            <Tooltip title={metricItem.value}>
              <span className="block truncate">{metricItem.value}</span>
            </Tooltip>
          ),
        }))}
      />
    </div>
  );
}

function StoreRowsTable({ rows }: { rows: StoreDataRow[] }) {
  const columns: Array<UpstreamResourceTableColumn<StoreDataRow>> = [
    {
      id: "name",
      label: "对象",
      width: "26%",
      getValue: (row) => row.name,
      render: (row) => (
        <div className="flex min-w-0 items-center gap-2">
          <TableProperties className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="truncate font-medium text-slate-950">
            {row.name}
          </span>
        </div>
      ),
    },
    {
      id: "type",
      label: "类型",
      width: "18%",
      getValue: (row) => row.type,
      className: "font-mono text-xs text-slate-600",
    },
    {
      id: "status",
      label: "状态",
      width: "18%",
      getValue: (row) => row.status,
      className: "text-xs text-slate-600",
    },
    {
      id: "detail",
      label: "说明",
      width: "38%",
      getValue: (row) => row.detail,
      className: "text-xs leading-5 text-slate-600",
    },
  ];

  return (
    <UpstreamResourceTable
      id="architoken-database-store-resource-rows"
      result={makeKubeSphereListResult(rows)}
      query={makeKubeSphereQueryState({
        limit: Math.max(rows.length, 1),
        sortBy: "name",
        ascending: true,
      })}
      columns={columns}
      rowKey={(row) => `${row.name}:${row.type}`}
      emptyText="没有可显示的资源对象"
    />
  );
}

function PostgresLiveSchemaCatalog({
  store,
  onOpenCrud,
}: {
  store: DatabaseRuntimeStore;
  onOpenCrud?: (schemaName: string, tableName: string) => void;
}) {
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
    const graphTimer = window.setTimeout(() => {
      void loadGraph();
    }, 0);
    return () => window.clearTimeout(graphTimer);
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
  const tableColumns: Array<UpstreamResourceTableColumn<PostgresSchemaTable>> =
    [
      {
        id: "table",
        label: "表",
        width: "22%",
        getValue: (table) =>
          `${table.schemaName}.${table.tableName} ${table.tableType}`,
        render: (table) => {
          const key = schemaTableKey(table);
          return (
            <div className="min-w-0">
              <Tooltip title={key}>
                <span className="block truncate font-mono font-medium text-slate-950">
                  {table.tableName}
                </span>
              </Tooltip>
              <span className="font-mono text-[11px] text-slate-400">
                {table.schemaName} · {table.tableType}
              </span>
            </div>
          );
        },
      },
      {
        id: "family",
        label: "表族",
        width: "12%",
        getValue: (table) => schemaFamilyLabel(table.family),
        render: (table) => (
          <Tag className="m-0" color="blue">
            {schemaFamilyLabel(table.family)}
          </Tag>
        ),
      },
      {
        id: "columns",
        label: "列",
        width: "8%",
        getValue: (table) => table.columns.length,
        className: "font-mono text-xs",
      },
      {
        id: "primary-key",
        label: "主键",
        width: "16%",
        getValue: (table) => table.primaryKeyColumns.join(", "),
        render: (table) => (
          <Tooltip title={table.primaryKeyColumns.join(", ") || "无"}>
            <span className="block truncate font-mono text-xs">
              {table.primaryKeyColumns.length > 0
                ? table.primaryKeyColumns.join(", ")
                : "无"}
            </span>
          </Tooltip>
        ),
      },
      {
        id: "foreign-keys",
        label: "外键出/入",
        width: "10%",
        getValue: (table) => {
          const relations = relationStats.get(schemaTableKey(table)) ?? {
            in: 0,
            out: 0,
          };
          return `${relations.out} / ${relations.in}`;
        },
        className: "font-mono text-xs",
      },
      {
        id: "rows",
        label: "估算行",
        width: "10%",
        getValue: (table) => table.estimatedRows,
        className: "font-mono text-xs",
      },
      {
        id: "bytes",
        label: "容量",
        width: "10%",
        getValue: (table) => formatBytes(table.totalBytes),
        className: "font-mono text-xs",
      },
    ];
  const tableActions: Array<UpstreamResourceAction<PostgresSchemaTable>> = [
    {
      id: "crud",
      description: "CRUD",
      longDescription: "进入真实 PostgreSQL 表数据增删改查",
      primary: true,
      icon: <TableProperties className="h-3.5 w-3.5" />,
      onClick: (table) => {
        if (onOpenCrud) {
          onOpenCrud(table.schemaName, table.tableName);
          return;
        }
        window.location.href = postgresTableCrudHref(
          table.schemaName,
          table.tableName,
        );
      },
    },
  ];

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

      <UpstreamResourceTable
        id="architoken-postgres-live-catalog"
        result={makeKubeSphereListResult(
          visibleTables.slice(0, 120),
          visibleTables.length,
        )}
        query={makeKubeSphereQueryState({
          limit: 120,
          sortBy: "table",
          ascending: true,
        })}
        columns={tableColumns}
        actions={tableActions}
        rowKey={schemaTableKey}
        emptyText="没有匹配的 PostgreSQL 表"
      />
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

function runtimeMetricText(store: DatabaseRuntimeStore): string {
  return (
    store.metrics
      .slice(0, 3)
      .map((item) => `${item.label}:${item.value}`)
      .join(" / ") || "无指标"
  );
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

function setPostgresCrudLocation(schemaName: string, tableName: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("schema", schemaName);
  url.searchParams.set("table", tableName);
  url.hash = "postgres-crud";
  window.history.replaceState(null, "", url.toString());
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

function storeStatusDotClass(store: DatabaseRuntimeStore): string {
  if (isGraphFallbackStore(store)) return "bg-amber-400";
  const tone = storeStatusTone(store.status);
  if (tone === "good") return "bg-emerald-500";
  if (tone === "warn") return "bg-amber-400";
  if (tone === "bad") return "bg-rose-500";
  return "bg-slate-300";
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
