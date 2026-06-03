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
  RefreshCcw,
  Search,
  Server,
  ShieldCheck,
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

          <section className="rounded-md border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  size="small"
                  options={scopeOptions}
                  value={scope}
                  onChange={(value) => setScope(value as ScopeFilter)}
                />
                <Tag color="green">只读默认</Tag>
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
          当前页面默认只读
        </div>
        <p className="mt-1 leading-5">
          写入、DDL、删除、清空、备份恢复必须进入后续审批流；本页只做探测、复制连接和打开只读入口。
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
