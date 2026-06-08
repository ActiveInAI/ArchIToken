// components/DatabaseManagerWorkbench.tsx
// License: Apache-2.0
"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Empty, Segmented, Spin, Tag, Tooltip } from "antd";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  GitBranch,
  Layers,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Server,
  ShieldCheck,
  TableProperties,
  Trash2,
} from "lucide-react";
import {
  databaseCategoryLabel,
  databaseStatusLabel,
  storeStatusTone,
  type DatabaseRuntimeSnapshot,
  type DatabaseRuntimeStore,
} from "@/lib/database-runtime-types";
import {
  databaseManagerEngineLabel,
  databaseManagerInventoryStatusLabel,
  summarizeInventoryItem,
  type DatabaseManagerInventoryItem,
  type DatabaseManagerInventorySnapshot,
} from "@/lib/database-manager-inventory-types";
import type {
  PostgresCrudTable,
  PostgresMutationResponse,
  PostgresRowsResponse,
} from "@/lib/database-manager-crud-types";
import type { PostgresSchemaGraph } from "@/lib/database-manager-schema-types";

type ScopeFilter = "architoken" | "same_host" | "all";

const scopeOptions = [
  { label: "ArchIToken", value: "architoken" },
  { label: "同机", value: "same_host" },
  { label: "全部", value: "all" },
];

export function DatabaseManagerWorkbench() {
  const [snapshot, setSnapshot] = useState<DatabaseRuntimeSnapshot | null>(
    null,
  );
  const [managerInventory, setManagerInventory] =
    useState<DatabaseManagerInventorySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managerError, setManagerError] = useState<string | null>(null);
  const [scope, setScope] = useState<ScopeFilter>("architoken");
  const [query, setQuery] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    setManagerError(null);
    const [runtimeResult, managerResult] = await Promise.allSettled([
      fetchRuntimeSnapshot(),
      fetchManagerInventory(),
    ]);

    if (runtimeResult.status === "fulfilled") {
      setSnapshot(runtimeResult.value);
      setSelectedStoreId(
        (current) => current ?? runtimeResult.value.stores[0]?.id ?? null,
      );
    } else {
      setError(
        runtimeResult.reason instanceof Error
          ? runtimeResult.reason.message
          : "数据库运行态刷新失败",
      );
    }

    if (managerResult.status === "fulfilled") {
      setManagerInventory(managerResult.value);
    } else {
      setManagerInventory(null);
      setManagerError(
        managerResult.reason instanceof Error
          ? managerResult.reason.message
          : "Rust 数据库管理器 inventory 刷新失败",
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filteredStores = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (snapshot?.stores ?? []).filter((store) => {
      if (scope !== "all" && store.group !== scope) return false;
      if (!text) return true;
      return [
        store.name,
        store.provider,
        store.endpoint,
        store.capability ?? "",
        store.role,
        databaseCategoryLabel(store.category),
      ]
        .join(" ")
        .toLowerCase()
        .includes(text);
    });
  }, [query, scope, snapshot]);

  const selectedStore =
    filteredStores.find((store) => store.id === selectedStoreId) ??
    snapshot?.stores.find((store) => store.id === selectedStoreId) ??
    filteredStores[0] ??
    null;
  const inventoryByEngine = useMemo(
    () =>
      new Map(
        (managerInventory?.items ?? []).map((item) => [item.engine, item]),
      ),
    [managerInventory],
  );
  const selectedInventoryItem = selectedStore
    ? (inventoryByEngine.get(inventoryEngineForStore(selectedStore)) ?? null)
    : null;
  const selectInventoryEngine = (engine: string) => {
    const targetId = storeIdForInventoryEngine(engine, snapshot?.stores ?? []);
    if (targetId) setSelectedStoreId(targetId);
  };

  const architokenStores = (snapshot?.stores ?? []).filter(
    (store) => store.group === "architoken",
  );
  const reachableStores = (snapshot?.stores ?? []).filter(
    (store) => store.status === "live" || store.status === "empty",
  );
  const blockedStores = architokenStores.filter(
    (store) => store.status === "blocked" || store.status === "offline",
  );

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 text-slate-950">
      <header
        className="border-b border-slate-200 bg-white px-4 py-3"
        data-testid="database-manager-workbench"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-medium uppercase text-emerald-600">
              Apache-2.0 · Rust / Go control plane
            </p>
            <h1 className="mt-1 text-xl font-semibold">
              ArchIToken Database Manager
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              统一管理 PostgreSQL、ClickHouse、Valkey、Qdrant、SeaweedFS
              S3、NATS JetStream 和同机数据库。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button href="/app/modules/settings_center">返回设置中心</Button>
            <Button
              type="primary"
              icon={<RefreshCcw className="h-4 w-4" />}
              loading={loading}
              onClick={() => void refresh()}
            >
              刷新
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          <StatusStrip
            snapshot={snapshot}
            managerInventory={managerInventory}
            managerError={managerError}
            reachableCount={reachableStores.length}
            blockedCount={blockedStores.length}
          />

          {error ? (
            <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}

          <DatabaseManagerInventoryPanel
            inventory={managerInventory}
            error={managerError}
            onSelectEngine={selectInventoryEngine}
          />

          <PostgresSchemaGraphPanel />

          <PostgresCrudPanel />

          <section className="rounded-md border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  size="small"
                  options={scopeOptions}
                  value={scope}
                  onChange={(value) => setScope(value as ScopeFilter)}
                />
                <Tag color="green">运维入口</Tag>
                <Tag color="blue">真实探测</Tag>
                <Tag color="default">破坏性动作阻断</Tag>
              </div>
              <label className="relative block min-w-0 xl:w-[420px]">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索库名、provider、端口、能力边界"
                  className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </div>

            {loading && !snapshot ? (
              <div className="flex h-80 items-center justify-center">
                <Spin tip="正在读取数据库运行态" />
              </div>
            ) : (
              <DatabaseManagerTable
                stores={filteredStores}
                selectedStoreId={selectedStore?.id ?? null}
                inventoryByEngine={inventoryByEngine}
                onSelect={setSelectedStoreId}
              />
            )}
          </section>
        </div>

        <DatabaseManagerDetail
          store={selectedStore}
          snapshot={snapshot}
          inventoryItem={selectedInventoryItem}
        />
      </section>
    </main>
  );
}

function StatusStrip({
  snapshot,
  managerInventory,
  managerError,
  reachableCount,
  blockedCount,
}: {
  snapshot: DatabaseRuntimeSnapshot | null;
  managerInventory: DatabaseManagerInventorySnapshot | null;
  managerError: string | null;
  reachableCount: number;
  blockedCount: number;
}) {
  const cells = [
    {
      label: "管理对象",
      value: snapshot?.stores.length ?? 0,
      icon: <Database className="h-4 w-4" />,
    },
    {
      label: "Rust 实测",
      value: managerInventory
        ? `${managerInventory.liveCount}/${managerInventory.itemCount}`
        : managerError
          ? "离线"
          : 0,
      icon: <Server className="h-4 w-4" />,
    },
    {
      label: "可达",
      value: reachableCount,
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      label: "阻断/离线",
      value: blockedCount,
      icon: <AlertCircle className="h-4 w-4" />,
    },
  ];

  return (
    <div className="grid gap-2 md:grid-cols-4">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-md border border-slate-200 bg-white px-3 py-2"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{cell.label}</span>
            {cell.icon}
          </div>
          <div className="mt-1 text-2xl font-semibold">{cell.value}</div>
        </div>
      ))}
    </div>
  );
}

function DatabaseManagerInventoryPanel({
  inventory,
  error,
  onSelectEngine,
}: {
  inventory: DatabaseManagerInventorySnapshot | null;
  error: string | null;
  onSelectEngine: (engine: string) => void;
}) {
  if (!inventory) {
    return (
      <section className="rounded-md border border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span className="font-medium">Rust inventory 未连接</span>
          <span className="truncate text-xs text-slate-500">
            {error ?? "等待刷新"}
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-col gap-1 border-b border-slate-200 px-3 py-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Rust 统一 Inventory</span>
          <Tag color={inventory.status === "ready" ? "green" : "gold"}>
            {inventory.status}
          </Tag>
          <span className="text-xs text-slate-500">
            {formatUnixMs(inventory.generatedAtUnixMs)}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          live {inventory.liveCount} / total {inventory.itemCount}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] table-fixed text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="w-[18%] px-3 py-2 font-medium">引擎</th>
              <th className="w-[12%] px-3 py-2 font-medium">状态</th>
              <th className="w-[26%] px-3 py-2 font-medium">来源</th>
              <th className="w-[44%] px-3 py-2 font-medium">真实摘要</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inventory.items.map((item) => (
              <tr
                key={item.engine}
                role="button"
                tabIndex={0}
                onClick={() => onSelectEngine(item.engine)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectEngine(item.engine);
                  }
                }}
                className="cursor-pointer bg-white hover:bg-emerald-50/70"
              >
                <td className="px-3 py-2 align-top">
                  <p className="truncate font-medium">
                    {databaseManagerEngineLabel(item.engine)}
                  </p>
                  <p className="truncate font-mono text-xs text-slate-500">
                    {item.engine}
                  </p>
                </td>
                <td className="px-3 py-2 align-top">
                  <ManagerInventoryStatusTag status={item.status} />
                </td>
                <td className="px-3 py-2 align-top">
                  <Tooltip title={item.source ?? item.error ?? "未配置"}>
                    <span className="block truncate font-mono text-xs">
                      {item.source ?? item.error ?? "未配置"}
                    </span>
                  </Tooltip>
                </td>
                <td className="px-3 py-2 align-top">
                  <Tooltip title={summarizeInventoryItem(item)}>
                    <span className="block truncate text-xs text-slate-600">
                      {summarizeInventoryItem(item)}
                    </span>
                  </Tooltip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PostgresSchemaGraphPanel() {
  const [graph, setGraph] = useState<PostgresSchemaGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("all");

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
      setError(errorMessage(error));
      setGraph(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGraph();
  }, []);

  const familyStats = useMemo(() => {
    const stats = new Map<string, { tables: number; columns: number }>();
    for (const table of graph?.tables ?? []) {
      const current = stats.get(table.family) ?? { tables: 0, columns: 0 };
      current.tables += 1;
      current.columns += table.columns.length;
      stats.set(table.family, current);
    }
    return Array.from(stats.entries())
      .map(([family, value]) => ({ family, ...value }))
      .sort((left, right) => right.tables - left.tables);
  }, [graph]);

  const filteredTables = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (graph?.tables ?? []).filter((table) => {
      if (family !== "all" && table.family !== family) return false;
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
  }, [family, graph, query]);

  const filteredTableKeys = useMemo(
    () => new Set(filteredTables.map((table) => schemaTableKey(table))),
    [filteredTables],
  );

  const visibleForeignKeys = useMemo(
    () =>
      (graph?.foreignKeys ?? [])
        .filter(
          (foreignKey) =>
            filteredTableKeys.has(
              `${foreignKey.sourceSchema}.${foreignKey.sourceTable}`,
            ) ||
            filteredTableKeys.has(
              `${foreignKey.targetSchema}.${foreignKey.targetTable}`,
            ),
        )
        .slice(0, 140),
    [filteredTableKeys, graph],
  );

  const topTables = useMemo(
    () =>
      [...filteredTables]
        .sort((left, right) => right.totalBytes - left.totalBytes)
        .slice(0, 10),
    [filteredTables],
  );

  return (
    <section
      className="rounded-md border border-slate-200 bg-white"
      data-testid="postgres-schema-graph"
    >
      <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <GitBranch className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold">PostgreSQL Schema 图谱</span>
          <Tag color="green">真实 catalog</Tag>
          <Tag color="default">只读</Tag>
          {graph ? (
            <span className="font-mono text-xs text-slate-500">
              {graph.source}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block min-w-0 sm:w-[280px]">
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
            刷新图谱
          </Button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      {loading && !graph ? (
        <div className="flex h-56 items-center justify-center">
          <Spin tip="读取 PostgreSQL catalog" />
        </div>
      ) : graph ? (
        <div className="grid gap-3 p-3">
          <div className="grid gap-2 md:grid-cols-5">
            <SchemaMetric label="表" value={graph.tableCount} />
            <SchemaMetric label="视图" value={graph.viewCount} />
            <SchemaMetric label="列" value={graph.columnCount} />
            <SchemaMetric label="外键边" value={graph.foreignKeyCount} />
            <SchemaMetric
              label="总容量"
              value={formatBytes(graph.totalBytes)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFamily("all")}
              className={[
                "rounded-md border px-2 py-1 text-xs",
                family === "all"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-600",
              ].join(" ")}
            >
              全部 {graph.tables.length}
            </button>
            {familyStats.map((item) => (
              <button
                key={item.family}
                type="button"
                onClick={() => setFamily(item.family)}
                className={[
                  "rounded-md border px-2 py-1 text-xs",
                  family === item.family
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-600",
                ].join(" ")}
              >
                {schemaFamilyLabel(item.family)} {item.tables}
              </button>
            ))}
          </div>

          <div className="grid gap-3 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="overflow-hidden rounded-md border border-slate-100">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                <Layers className="h-3.5 w-3.5" />
                表族与大表
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] table-fixed text-left text-xs">
                  <thead className="bg-white text-slate-500">
                    <tr>
                      <th className="w-[34%] px-3 py-2 font-medium">表</th>
                      <th className="w-[18%] px-3 py-2 font-medium">表族</th>
                      <th className="w-[14%] px-3 py-2 font-medium">列</th>
                      <th className="w-[16%] px-3 py-2 font-medium">容量</th>
                      <th className="w-[18%] px-3 py-2 font-medium">主键</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topTables.map((table) => (
                      <tr key={schemaTableKey(table)}>
                        <td className="px-3 py-2 align-top">
                          <Tooltip title={schemaTableKey(table)}>
                            <span className="block truncate font-mono font-medium text-slate-900">
                              {table.tableName}
                            </span>
                          </Tooltip>
                          <span className="font-mono text-[11px] text-slate-400">
                            {table.tableType}
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
                        <td className="px-3 py-2 align-top font-mono">
                          {formatBytes(table.totalBytes)}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-slate-100">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                <GitBranch className="h-3.5 w-3.5" />
                外键关系边
                <span className="ml-auto font-normal text-slate-400">
                  显示 {visibleForeignKeys.length} / {graph.foreignKeyCount}
                </span>
              </div>
              <div className="max-h-[360px] overflow-auto">
                <table className="w-full min-w-[760px] table-fixed text-left text-xs">
                  <thead className="sticky top-0 bg-white text-slate-500">
                    <tr>
                      <th className="w-[28%] px-3 py-2 font-medium">来源</th>
                      <th className="w-[28%] px-3 py-2 font-medium">目标</th>
                      <th className="w-[22%] px-3 py-2 font-medium">约束</th>
                      <th className="w-[22%] px-3 py-2 font-medium">规则</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleForeignKeys.map((foreignKey) => (
                      <tr
                        key={`${foreignKey.constraintName}:${foreignKey.sourceTable}:${foreignKey.sourceColumn}:${foreignKey.ordinalPosition}`}
                      >
                        <td className="px-3 py-2 align-top">
                          <Tooltip
                            title={`${foreignKey.sourceSchema}.${foreignKey.sourceTable}.${foreignKey.sourceColumn}`}
                          >
                            <span className="block truncate font-mono">
                              {foreignKey.sourceTable}.{foreignKey.sourceColumn}
                            </span>
                          </Tooltip>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Tooltip
                            title={`${foreignKey.targetSchema}.${foreignKey.targetTable}.${foreignKey.targetColumn}`}
                          >
                            <span className="block truncate font-mono">
                              {foreignKey.targetTable}.{foreignKey.targetColumn}
                            </span>
                          </Tooltip>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Tooltip title={foreignKey.constraintName}>
                            <span className="block truncate font-mono">
                              {foreignKey.constraintName}
                            </span>
                          </Tooltip>
                        </td>
                        <td className="px-3 py-2 align-top font-mono">
                          {foreignKey.updateRule} / {foreignKey.deleteRule}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visibleForeignKeys.length === 0 ? (
                  <Empty className="py-10" description="没有匹配的外键关系" />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Empty className="py-12" description="Schema 图谱未加载" />
      )}
    </section>
  );
}

function PostgresCrudPanel() {
  const [tables, setTables] = useState<PostgresCrudTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [rows, setRows] = useState<PostgresRowsResponse | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [insertJson, setInsertJson] = useState("{\n}\n");
  const [updateJson, setUpdateJson] = useState("{\n}\n");
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [crudError, setCrudError] = useState<string | null>(null);
  const [crudMessage, setCrudMessage] = useState<string | null>(null);

  const selectedTable =
    tables.find((table) => postgresTableId(table) === selectedTableId) ??
    tables[0] ??
    null;
  const selectedRow =
    selectedRowIndex !== null ? (rows?.rows[selectedRowIndex] ?? null) : null;
  const canMutateSelectedRow =
    Boolean(selectedRow) && (rows?.primaryKeyColumns.length ?? 0) > 0;

  const loadTables = async () => {
    setLoadingTables(true);
    setCrudError(null);
    try {
      const response = await fetch(
        "/api/database-manager/postgresql/crud/tables",
        { cache: "no-store" },
      );
      if (!response.ok) throw await apiError(response);
      const payload = (await response.json()) as PostgresCrudTable[];
      const requestedTableId = requestedPostgresTableId();
      setTables(payload);
      setSelectedTableId((current) => {
        if (
          requestedTableId &&
          payload.some((table) => postgresTableId(table) === requestedTableId)
        ) {
          return requestedTableId;
        }
        if (
          current &&
          payload.some((table) => postgresTableId(table) === current)
        ) {
          return current;
        }
        return payload[0] ? postgresTableId(payload[0]) : null;
      });
    } catch (error) {
      setCrudError(errorMessage(error));
    } finally {
      setLoadingTables(false);
    }
  };

  const loadRows = async (table: PostgresCrudTable, offset = 0) => {
    setLoadingRows(true);
    setCrudError(null);
    try {
      const params = new URLSearchParams({
        schemaName: table.schemaName,
        tableName: table.tableName,
        limit: "25",
        offset: String(Math.max(0, offset)),
      });
      const response = await fetch(
        `/api/database-manager/postgresql/crud/rows?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw await apiError(response);
      const payload = (await response.json()) as PostgresRowsResponse;
      setRows(payload);
      setSelectedRowIndex(null);
      setUpdateJson("{\n}\n");
    } catch (error) {
      setCrudError(errorMessage(error));
      setRows(null);
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    void loadTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      void loadRows(selectedTable);
    }
  }, [selectedTableId]);

  const selectRow = (index: number) => {
    const row = rows?.rows[index] ?? null;
    setSelectedRowIndex(index);
    setUpdateJson(row ? `${JSON.stringify(row, null, 2)}\n` : "{\n}\n");
  };

  const insertRow = async () => {
    if (!selectedTable) return;
    await mutatePostgresRow({
      method: "POST",
      body: {
        schemaName: selectedTable.schemaName,
        tableName: selectedTable.tableName,
        values: parseJsonObject(insertJson),
      },
      success: "新增行已提交",
    });
    setInsertJson("{\n}\n");
  };

  const updateRow = async () => {
    if (!selectedTable || !selectedRow || !rows) return;
    await mutatePostgresRow({
      method: "PATCH",
      body: {
        schemaName: selectedTable.schemaName,
        tableName: selectedTable.tableName,
        key: rowKey(selectedRow, rows.primaryKeyColumns),
        values: parseJsonObject(updateJson),
      },
      success: "选中行已更新",
    });
  };

  const deleteRow = async () => {
    if (!selectedTable || !selectedRow || !rows) return;
    if (!window.confirm("确认删除选中行？该动作会写入数据库。")) return;
    await mutatePostgresRow({
      method: "DELETE",
      body: {
        schemaName: selectedTable.schemaName,
        tableName: selectedTable.tableName,
        key: rowKey(selectedRow, rows.primaryKeyColumns),
      },
      success: "选中行已删除",
    });
  };

  const mutatePostgresRow = async ({
    method,
    body,
    success,
  }: {
    method: "POST" | "PATCH" | "DELETE";
    body: Record<string, unknown>;
    success: string;
  }) => {
    if (!selectedTable) return;
    setMutating(true);
    setCrudError(null);
    setCrudMessage(null);
    try {
      const response = await fetch(
        "/api/database-manager/postgresql/crud/rows",
        {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw await apiError(response);
      const payload = (await response.json()) as PostgresMutationResponse;
      setCrudMessage(`${success}，影响 ${payload.affectedRows} 行。`);
      await loadRows(selectedTable, rows?.offset ?? 0);
      await loadTables();
    } catch (error) {
      setCrudError(errorMessage(error));
    } finally {
      setMutating(false);
    }
  };

  const visibleColumns = (rows?.columns ?? selectedTable?.columns ?? []).slice(
    0,
    10,
  );

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <TableProperties className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold">PostgreSQL 表级 CRUD</span>
          <Tag color="green">真实读写</Tag>
          <Tag color="default">主键保护更新/删除</Tag>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="small"
            icon={<RefreshCcw className="h-3.5 w-3.5" />}
            loading={loadingTables || loadingRows}
            onClick={() => {
              void loadTables();
              if (selectedTable)
                void loadRows(selectedTable, rows?.offset ?? 0);
            }}
          >
            刷新表/行
          </Button>
        </div>
      </div>

      {crudError ? (
        <div className="border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {crudError}
        </div>
      ) : null}
      {crudMessage ? (
        <div className="border-b border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {crudMessage}
        </div>
      ) : null}

      <div className="grid min-h-[420px] gap-0 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <div className="border-b border-slate-100 xl:border-b-0 xl:border-r">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
            表
          </div>
          {loadingTables && tables.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <Spin size="small" />
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              {tables.map((table) => {
                const selected = postgresTableId(table) === selectedTableId;
                return (
                  <button
                    key={postgresTableId(table)}
                    type="button"
                    onClick={() => setSelectedTableId(postgresTableId(table))}
                    className={[
                      "block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-emerald-50",
                      selected ? "bg-emerald-50" : "bg-white",
                    ].join(" ")}
                  >
                    <p className="truncate text-sm font-medium">
                      {table.tableName}
                    </p>
                    <p className="truncate font-mono text-xs text-slate-500">
                      {table.schemaName} · {table.columns.length} 列 · 估算{" "}
                      {table.estimatedRows} 行
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      PK:{" "}
                      {table.primaryKeyColumns.length > 0
                        ? table.primaryKeyColumns.join(", ")
                        : "无"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="min-w-0 border-b border-slate-100 xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
            <span>
              {rows
                ? `${rows.schemaName}.${rows.tableName} · ${rows.totalRows} 行`
                : "选择表后读取行"}
            </span>
            <span>
              {rows
                ? `${rows.offset + 1}-${rows.offset + rows.rows.length}`
                : ""}
            </span>
          </div>
          {loadingRows ? (
            <div className="flex h-80 items-center justify-center">
              <Spin tip="读取行数据" />
            </div>
          ) : rows && rows.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="w-[56px] px-2 py-2 font-medium">#</th>
                    {visibleColumns.map((column) => (
                      <th
                        key={column.columnName}
                        className="w-[140px] px-2 py-2 font-medium"
                      >
                        <Tooltip title={column.dataType}>
                          <span className="block truncate">
                            {column.columnName}
                            {column.isPrimaryKey ? " *" : ""}
                          </span>
                        </Tooltip>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.rows.map((row, index) => (
                    <tr
                      key={`${rows.offset}:${index}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectRow(index)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectRow(index);
                        }
                      }}
                      className={[
                        "cursor-pointer hover:bg-emerald-50/70",
                        selectedRowIndex === index
                          ? "bg-emerald-50"
                          : "bg-white",
                      ].join(" ")}
                    >
                      <td className="px-2 py-2 font-mono text-slate-500">
                        {rows.offset + index + 1}
                      </td>
                      {visibleColumns.map((column) => (
                        <td key={column.columnName} className="px-2 py-2">
                          <Tooltip
                            title={stringifyCell(row[column.columnName])}
                          >
                            <span className="block truncate font-mono">
                              {stringifyCell(row[column.columnName])}
                            </span>
                          </Tooltip>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-3 py-2">
                <Button
                  size="small"
                  disabled={!rows || rows.offset <= 0}
                  onClick={() =>
                    selectedTable &&
                    void loadRows(
                      selectedTable,
                      Math.max(0, rows.offset - rows.limit),
                    )
                  }
                >
                  上一页
                </Button>
                <Button
                  size="small"
                  disabled={!rows || rows.offset + rows.limit >= rows.totalRows}
                  onClick={() =>
                    selectedTable &&
                    void loadRows(selectedTable, rows.offset + rows.limit)
                  }
                >
                  下一页
                </Button>
              </div>
            </div>
          ) : (
            <Empty className="py-20" description="没有行数据" />
          )}
        </div>

        <div className="min-w-0 p-3">
          <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {selectedTable ? (
              <>
                <p className="font-mono text-slate-900">
                  {selectedTable.schemaName}.{selectedTable.tableName}
                </p>
                <p className="mt-1">
                  主键：
                  {selectedTable.primaryKeyColumns.length > 0
                    ? selectedTable.primaryKeyColumns.join(", ")
                    : "无主键，更新/删除禁用"}
                </p>
              </>
            ) : (
              "暂无可管理表"
            )}
          </div>

          <label className="mt-3 block">
            <span className="text-xs font-medium text-slate-600">
              新增 JSON
            </span>
            <textarea
              value={insertJson}
              onChange={(event) => setInsertJson(event.target.value)}
              spellCheck={false}
              className="mt-1 h-32 w-full resize-none rounded-md border border-slate-200 bg-white p-2 font-mono text-xs outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <Button
            className="mt-2 w-full"
            type="primary"
            icon={<Plus className="h-4 w-4" />}
            disabled={!selectedTable}
            loading={mutating}
            onClick={() => void insertRow()}
          >
            新增行
          </Button>

          <label className="mt-4 block">
            <span className="text-xs font-medium text-slate-600">
              更新选中行 JSON
            </span>
            <textarea
              value={updateJson}
              onChange={(event) => setUpdateJson(event.target.value)}
              spellCheck={false}
              className="mt-1 h-44 w-full resize-none rounded-md border border-slate-200 bg-white p-2 font-mono text-xs outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              icon={<Save className="h-4 w-4" />}
              disabled={!canMutateSelectedRow}
              loading={mutating}
              onClick={() => void updateRow()}
            >
              更新
            </Button>
            <Button
              danger
              icon={<Trash2 className="h-4 w-4" />}
              disabled={!canMutateSelectedRow}
              loading={mutating}
              onClick={() => void deleteRow()}
            >
              删除
            </Button>
          </div>
          {!canMutateSelectedRow ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              选择带主键的行后才能更新或删除；无主键表需要先补主键或走迁移审批。
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function DatabaseManagerTable({
  stores,
  selectedStoreId,
  inventoryByEngine,
  onSelect,
}: {
  stores: DatabaseRuntimeStore[];
  selectedStoreId: string | null;
  inventoryByEngine: Map<string, DatabaseManagerInventoryItem>;
  onSelect: (storeId: string) => void;
}) {
  if (stores.length === 0) {
    return <Empty className="py-16" description="没有匹配的数据库对象" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="w-[20%] px-3 py-2 font-medium">对象</th>
            <th className="w-[10%] px-3 py-2 font-medium">状态</th>
            <th className="w-[12%] px-3 py-2 font-medium">分类</th>
            <th className="w-[16%] px-3 py-2 font-medium">能力</th>
            <th className="w-[18%] px-3 py-2 font-medium">连接</th>
            <th className="w-[16%] px-3 py-2 font-medium">指标</th>
            <th className="w-[8%] px-3 py-2 text-right font-medium">范围</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {stores.map((store) => {
            const selected = selectedStoreId === store.id;
            const inventoryItem = inventoryByEngine.get(
              inventoryEngineForStore(store),
            );
            return (
              <tr
                key={store.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(store.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(store.id);
                  }
                }}
                className={[
                  "cursor-pointer bg-white hover:bg-emerald-50/70",
                  selected ? "bg-emerald-50" : "",
                ].join(" ")}
              >
                <td className="px-3 py-2 align-top">
                  <p className="truncate font-medium">{store.name}</p>
                  <p className="truncate font-mono text-xs text-slate-500">
                    {store.provider}
                  </p>
                </td>
                <td className="px-3 py-2 align-top">
                  <StatusTag status={store.status} />
                  {inventoryItem ? (
                    <div className="mt-1">
                      <ManagerInventoryStatusTag
                        status={inventoryItem.status}
                        compact
                      />
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 align-top text-xs text-slate-600">
                  {databaseCategoryLabel(store.category)}
                </td>
                <td className="px-3 py-2 align-top">
                  <Tooltip title={store.role}>
                    <span className="block truncate font-mono text-xs">
                      {store.capability ?? store.source}
                    </span>
                  </Tooltip>
                </td>
                <td className="px-3 py-2 align-top">
                  <Tooltip title={store.endpoint}>
                    <span className="block truncate font-mono text-xs">
                      {store.endpoint}
                    </span>
                  </Tooltip>
                </td>
                <td className="px-3 py-2 align-top">
                  <MetricText store={store} />
                </td>
                <td className="px-3 py-2 text-right align-top">
                  <Tag color={store.group === "architoken" ? "green" : "blue"}>
                    {store.group === "architoken" ? "平台" : "同机"}
                  </Tag>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DatabaseManagerDetail({
  store,
  snapshot,
  inventoryItem,
}: {
  store: DatabaseRuntimeStore | null;
  snapshot: DatabaseRuntimeSnapshot | null;
  inventoryItem: DatabaseManagerInventoryItem | null;
}) {
  if (!store) {
    return (
      <aside className="rounded-md border border-slate-200 bg-white p-4">
        <Empty description="选择一个数据库对象" />
      </aside>
    );
  }

  return (
    <aside className="min-w-0 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase text-emerald-600">
            {store.provider}
          </p>
          <h2 className="mt-1 truncate text-lg font-semibold">{store.name}</h2>
          <p className="mt-1 text-xs text-slate-500">{store.role}</p>
        </div>
        <StatusTag status={store.status} />
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <DetailRow label="分类" value={databaseCategoryLabel(store.category)} />
        <DetailRow label="能力边界" value={store.capability ?? "未绑定"} />
        <DetailRow label="连接" value={store.endpoint} />
        <DetailRow label="当前 provider" value={store.provider} />
        <DetailRow label="fallback" value={store.fallbackProvider ?? "无"} />
        <DetailRow
          label="刷新时间"
          value={
            snapshot?.generatedAt ? formatDate(snapshot.generatedAt) : "未刷新"
          }
        />
      </div>

      {inventoryItem ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Rust inventory</span>
            <ManagerInventoryStatusTag status={inventoryItem.status} />
          </div>
          <div className="mt-2 grid gap-2 text-sm">
            <DetailRow
              label="引擎"
              value={databaseManagerEngineLabel(inventoryItem.engine)}
            />
            <DetailRow
              label="来源"
              value={inventoryItem.source ?? inventoryItem.error ?? "未配置"}
            />
            <DetailRow
              label="摘要"
              value={summarizeInventoryItem(inventoryItem)}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {store.metrics.map((metric) => (
          <div
            key={`${metric.label}:${metric.value}`}
            className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
          >
            <p className="text-xs text-slate-500">{metric.label}</p>
            <p className="mt-1 truncate font-mono text-sm">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck className="h-4 w-4" />
          危险动作受控
        </div>
        <p className="mt-1 leading-5">
          PostgreSQL CRUD
          面板支持行级新增、更新和删除；DDL、清库、备份恢复和批量破坏性动作仍必须进入审批流。
        </p>
      </div>

      <div className="mt-4 grid gap-2">
        <Button
          icon={<Copy className="h-4 w-4" />}
          onClick={() => void navigator.clipboard.writeText(store.endpoint)}
        >
          复制连接/端口
        </Button>
        {store.managementLinks.map((link) => (
          <Button
            key={`${store.id}:${link.href}`}
            href={link.href}
            target={link.href.startsWith("http") ? "_blank" : undefined}
            icon={<ExternalLink className="h-4 w-4" />}
          >
            打开 {link.label}
          </Button>
        ))}
      </div>
    </aside>
  );
}

function ManagerInventoryStatusTag({
  status,
  compact = false,
}: {
  status: DatabaseManagerInventoryItem["status"];
  compact?: boolean;
}) {
  const color =
    status === "live" ? "green" : status === "unavailable" ? "red" : "default";
  if (compact) {
    return (
      <Tag color={color} className="m-0 text-[11px]">
        Rust {databaseManagerInventoryStatusLabel(status)}
      </Tag>
    );
  }

  return <Tag color={color}>{databaseManagerInventoryStatusLabel(status)}</Tag>;
}

function StatusTag({ status }: { status: DatabaseRuntimeStore["status"] }) {
  const tone = storeStatusTone(status);
  const color =
    tone === "good"
      ? "green"
      : tone === "warn"
        ? "gold"
        : tone === "bad"
          ? "red"
          : "default";
  return <Tag color={color}>{databaseStatusLabel(status)}</Tag>;
}

function MetricText({ store }: { store: DatabaseRuntimeStore }) {
  const text =
    store.metrics
      .slice(0, 3)
      .map((metric) => `${metric.label}:${metric.value}`)
      .join(" / ") || "无指标";

  return (
    <Tooltip title={text}>
      <span className="block truncate text-xs text-slate-600">{text}</span>
    </Tooltip>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2 border-b border-slate-100 py-1.5 last:border-b-0">
      <span className="text-xs text-slate-500">{label}</span>
      <Tooltip title={value}>
        <span className="truncate font-mono text-xs text-slate-800">
          {value}
        </span>
      </Tooltip>
    </div>
  );
}

function SchemaMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate font-mono text-lg font-semibold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function schemaTableKey(table: { schemaName: string; tableName: string }) {
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function formatUnixMs(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "未刷新";
  return formatDate(new Date(value).toISOString());
}

function inventoryEngineForStore(store: DatabaseRuntimeStore): string {
  switch (store.id) {
    case "postgres":
    case "postgres-graph":
      return "postgresql";
    case "seaweedfs-s3":
      return "s3_compatible";
    case "valkey":
      return "valkey";
    case "nats":
      return "nats_jetstream";
    case "qdrant":
      return "qdrant";
    case "clickhouse-timeseries":
    case "clickhouse-analytics":
      return "clickhouse";
    default:
      return store.provider.toLowerCase().includes("postgres")
        ? "postgresql"
        : store.provider.toLowerCase().includes("clickhouse")
          ? "clickhouse"
          : store.provider.toLowerCase().includes("qdrant")
            ? "qdrant"
            : store.provider.toLowerCase().includes("valkey")
              ? "valkey"
              : store.provider.toLowerCase().includes("nats")
                ? "nats_jetstream"
                : store.provider.toLowerCase().includes("seaweed")
                  ? "s3_compatible"
                  : "";
  }
}

function storeIdForInventoryEngine(
  engine: string,
  stores: DatabaseRuntimeStore[],
): string | null {
  const preferredIds: Record<string, string[]> = {
    postgresql: ["postgres", "postgres-graph"],
    s3_compatible: ["seaweedfs-s3"],
    valkey: ["valkey"],
    nats_jetstream: ["nats"],
    qdrant: ["qdrant"],
    clickhouse: ["clickhouse-timeseries", "clickhouse-analytics"],
  };
  const ids = preferredIds[engine] ?? [];
  return (
    ids.find((id) => stores.some((store) => store.id === id)) ??
    stores.find((store) => inventoryEngineForStore(store) === engine)?.id ??
    null
  );
}

function postgresTableId(table: PostgresCrudTable): string {
  return `${table.schemaName}.${table.tableName}`;
}

function requestedPostgresTableId(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const schemaName = params.get("schema") ?? params.get("schemaName");
  const tableName = params.get("table") ?? params.get("tableName");
  if (!schemaName || !tableName) return null;
  return `${schemaName}.${tableName}`;
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON 必须是对象");
  }
  return parsed as Record<string, unknown>;
}

function rowKey(
  row: Record<string, unknown>,
  primaryKeyColumns: string[],
): Record<string, unknown> {
  const key: Record<string, unknown> = {};
  for (const column of primaryKeyColumns) {
    key[column] = row[column];
  }
  return key;
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
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

async function fetchRuntimeSnapshot(): Promise<DatabaseRuntimeSnapshot> {
  const response = await fetch("/api/database-runtime", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `database-runtime ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as DatabaseRuntimeSnapshot;
}

async function fetchManagerInventory(): Promise<DatabaseManagerInventorySnapshot> {
  const response = await fetch("/api/database-manager/inventory", {
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      detail?: string;
    } | null;
    throw new Error(
      payload?.detail ??
        payload?.error ??
        `database-manager inventory ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as DatabaseManagerInventorySnapshot;
}
