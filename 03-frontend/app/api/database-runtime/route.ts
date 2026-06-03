import { execFile } from "node:child_process";
import { Socket } from "node:net";
import { promisify } from "node:util";
import type {
  DatabaseRuntimeBinding,
  DatabaseRuntimeContainer,
  DatabaseRuntimeGateway,
  DatabaseRuntimeMetric,
  DatabaseRuntimeSnapshot,
  DatabaseRuntimeStatus,
  DatabaseRuntimeStore,
} from "@/lib/database-runtime-types";
import { classifyDatabaseContainer } from "@/lib/database-runtime-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const requestTimeoutMs = 4500;

interface BindingListResponse {
  bindings: DatabaseRuntimeBinding[];
  total: number;
}

interface ProbeResult {
  ok: boolean;
  metrics: DatabaseRuntimeMetric[];
  status: DatabaseRuntimeStatus;
  notes: string[];
}

interface DockerPsRow {
  ID?: string;
  Image?: string;
  Names?: string;
  Ports?: string;
  Status?: string;
}

export async function GET() {
  const errors: string[] = [];
  const [gateway, bindingList, containers] = await Promise.all([
    fetchGatewayReady(errors),
    fetchDataPlaneBindings(errors),
    listDatabaseContainers(errors),
  ]);
  const probes = await runServiceProbes(errors);
  const stores = buildRuntimeStores({
    gateway,
    bindings: bindingList.bindings,
    containers,
    probes,
  });

  const snapshot: DatabaseRuntimeSnapshot = {
    generatedAt: new Date().toISOString(),
    gateway,
    bindings: bindingList.bindings,
    stores,
    containers,
    errors,
  };

  return Response.json(snapshot, {
    headers: {
      "cache-control": "no-store",
    },
  });
}

async function fetchGatewayReady(
  errors: string[],
): Promise<DatabaseRuntimeGateway | null> {
  const result = await safeJsonFetch<Partial<DatabaseRuntimeGateway>>(
    `${gatewayBaseUrl()}/readyz`,
  );
  if (!result.ok) {
    errors.push(`Gateway readyz failed: ${result.error}`);
    return null;
  }
  return {
    status: String(result.data.status ?? "unknown"),
    runtimeProfile: String(result.data.runtimeProfile ?? "unknown"),
    persistenceMode: String(result.data.persistenceMode ?? "unknown"),
    databaseMode: String(result.data.databaseMode ?? "unknown"),
    objectStoreMode: String(result.data.objectStoreMode ?? "unknown"),
    databaseConfigured: Boolean(result.data.databaseConfigured),
    objectStoreConfigured: Boolean(result.data.objectStoreConfigured),
    queueConfigured: Boolean(result.data.queueConfigured),
    telemetryConfigured: Boolean(result.data.telemetryConfigured),
  };
}

async function fetchDataPlaneBindings(
  errors: string[],
): Promise<BindingListResponse> {
  const result = await safeJsonFetch<BindingListResponse>(
    `${gatewayBaseUrl()}/v1/data-plane/bindings`,
  );
  if (!result.ok) {
    errors.push(`Data-plane bindings failed: ${result.error}`);
    return { bindings: [], total: 0 };
  }
  return {
    bindings: Array.isArray(result.data.bindings) ? result.data.bindings : [],
    total: Number(result.data.total ?? result.data.bindings?.length ?? 0),
  };
}

async function listDatabaseContainers(
  errors: string[],
): Promise<DatabaseRuntimeContainer[]> {
  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["ps", "--format", "{{json .}}"],
      {
        timeout: requestTimeoutMs,
        maxBuffer: 1024 * 1024,
      },
    );
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as DockerPsRow)
      .flatMap((row): DatabaseRuntimeContainer[] => {
        const name = row.Names ?? "";
        const image = row.Image ?? "";
        const classification = classifyDatabaseContainer({ name, image });
        if (!classification) return [];
        return [
          {
            id: row.ID ?? name,
            name,
            image,
            status: row.Status ?? "unknown",
            ports: row.Ports ?? "",
            group: classification.group,
            category: classification.category,
            provider: classification.provider,
          },
        ];
      })
      .sort((left, right) => {
        if (left.group !== right.group) {
          return left.group === "architoken" ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });
  } catch (error) {
    errors.push(`Docker inventory failed: ${errorMessage(error)}`);
    return [];
  }
}

async function runServiceProbes(errors: string[]) {
  const entries = await Promise.all([
    probePostgres(errors),
    probeSeaweedS3(errors),
    probeValkey(errors),
    probeNats(errors),
    probeQdrant(errors),
    probeClickHouse("time_series_store", errors),
    probeClickHouse("analytics_store", errors),
  ]);
  return Object.fromEntries(entries);
}

async function probePostgres(errors: string[]): Promise<[string, ProbeResult]> {
  const databaseUrl =
    process.env.ARCHITOKEN_DATABASE__URL ??
    process.env.DATABASE_URL ??
    "postgres://architoken:architoken_dev_only@127.0.0.1:5433/architoken";
  try {
    const { stdout } = await execFileAsync(
      "psql",
      [
        databaseUrl,
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
        "-F",
        "\t",
        "-c",
        [
          "select",
          "(select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE')::text,",
          "pg_size_pretty(pg_database_size(current_database())),",
          "coalesce((select sum(n_live_tup)::bigint from pg_stat_user_tables),0)::text",
        ].join(" "),
      ],
      {
        timeout: requestTimeoutMs,
        maxBuffer: 1024 * 1024,
      },
    );
    const [tableCount = "0", databaseSize = "unknown", estimatedRows = "0"] =
      stdout.trim().split("\t");
    return [
      "relational_store",
      {
        ok: true,
        status: "live",
        metrics: [
          metric("表", tableCount, "good"),
          metric("容量", databaseSize, "good"),
          metric("估算行", estimatedRows, "muted"),
        ],
        notes: ["PostgreSQL 是系统主干库和多类 fallback 的 source of truth。"],
      },
    ];
  } catch (error) {
    errors.push(`PostgreSQL probe failed: ${errorMessage(error)}`);
    return offlineProbe("relational_store", "PostgreSQL probe failed");
  }
}

async function probeSeaweedS3(
  errors: string[],
): Promise<[string, ProbeResult]> {
  const endpoint = (process.env.S3_ENDPOINT ?? "http://127.0.0.1:8333").replace(
    /\/+$/,
    "",
  );
  const bucket = process.env.S3_BUCKET ?? "architoken-assets";
  const result = await safeTextFetch(`${endpoint}/${bucket}?list-type=2`);
  if (!result.ok) {
    errors.push(`SeaweedFS S3 probe failed: ${result.error}`);
    return offlineProbe("object_store", "SeaweedFS S3 probe failed");
  }
  const keyCount = result.text.match(/<KeyCount>(\d+)<\/KeyCount>/)?.[1] ?? "0";
  const objectCount = Number(keyCount);
  return [
    "object_store",
    {
      ok: true,
      status: objectCount > 0 ? "live" : "empty",
      metrics: [
        metric("桶", bucket, "good"),
        metric("对象", keyCount, objectCount > 0 ? "good" : "warn"),
      ],
      notes: ["对象字节落在 S3 兼容存储，PostgreSQL 保存绑定和元数据。"],
    },
  ];
}

async function probeValkey(errors: string[]): Promise<[string, ProbeResult]> {
  const url =
    process.env.ARCHITOKEN_CACHE__URL ??
    process.env.VALKEY_URL ??
    process.env.REDIS_URL ??
    "redis://127.0.0.1:6381";
  try {
    const dbSize = parseRedisInteger(await redisCommand(url, ["DBSIZE"]));
    const info = await redisCommand(url, ["INFO", "keyspace"]);
    const hasKeyspace = info.includes("keys=");
    return [
      "cache_store",
      {
        ok: true,
        status: dbSize > 0 ? "live" : "empty",
        metrics: [
          metric("keys", String(dbSize), dbSize > 0 ? "good" : "warn"),
          metric("keyspace", hasKeyspace ? "active" : "empty", "muted"),
        ],
        notes: [
          "Valkey 只承载缓存、限流、会话和短期协同状态，不是 canonical 数据。",
        ],
      },
    ];
  } catch (error) {
    errors.push(`Valkey probe failed: ${errorMessage(error)}`);
    return offlineProbe("cache_store", "Valkey probe failed");
  }
}

async function probeNats(errors: string[]): Promise<[string, ProbeResult]> {
  const monitorUrl = (
    process.env.NATS_MONITOR_URL ?? "http://127.0.0.1:8222"
  ).replace(/\/+$/, "");
  const result = await safeJsonFetch<{
    streams?: number;
    consumers?: number;
    messages?: number;
    bytes?: number;
  }>(`${monitorUrl}/jsz`);
  if (!result.ok) {
    errors.push(`NATS probe failed: ${result.error}`);
    return offlineProbe("event_store", "NATS probe failed");
  }
  const streams = Number(result.data.streams ?? 0);
  const messages = Number(result.data.messages ?? 0);
  return [
    "event_store",
    {
      ok: true,
      status: streams > 0 || messages > 0 ? "live" : "empty",
      metrics: [
        metric("streams", String(streams), streams > 0 ? "good" : "warn"),
        metric("messages", String(messages), messages > 0 ? "good" : "warn"),
        metric("consumers", String(result.data.consumers ?? 0), "muted"),
      ],
      notes: [
        "NATS JetStream 是事件流主路由，PostgreSQL outbox 保持 fallback。",
      ],
    },
  ];
}

async function probeQdrant(errors: string[]): Promise<[string, ProbeResult]> {
  const endpoint = (
    process.env.ARCHITOKEN_VECTOR__URL ??
    process.env.QDRANT_URL ??
    "http://127.0.0.1:6333"
  ).replace(/\/+$/, "");
  const result = await safeJsonFetch<{
    result?: { collections?: unknown[] };
  }>(`${endpoint}/collections`);
  if (!result.ok) {
    errors.push(`Qdrant probe failed: ${result.error}`);
    return offlineProbe("vector_store", "Qdrant probe failed");
  }
  const collections = Array.isArray(result.data.result?.collections)
    ? result.data.result.collections.length
    : 0;
  return [
    "vector_store",
    {
      ok: true,
      status: collections > 0 ? "live" : "empty",
      metrics: [
        metric(
          "collections",
          String(collections),
          collections > 0 ? "good" : "warn",
        ),
      ],
      notes: [
        "Qdrant 是向量检索外置路由；当前为空代表尚未加载持久 RAG collection。",
      ],
    },
  ];
}

async function probeClickHouse(
  capability: "time_series_store" | "analytics_store",
  errors: string[],
): Promise<[string, ProbeResult]> {
  const baseUrl =
    (capability === "analytics_store"
      ? process.env.ARCHITOKEN_ANALYTICS__URL
      : (process.env.ARCHITOKEN_TIMESERIES__URL ??
        process.env.ARCHITOKEN_TIME_SERIES__URL)) ??
    process.env.CLICKHOUSE_URL ??
    "http://127.0.0.1:8123";
  const user = process.env.CLICKHOUSE_USER ?? "architoken";
  const password = process.env.CLICKHOUSE_PASSWORD ?? "architoken_dev_only";
  const database = process.env.CLICKHOUSE_DB ?? "architoken";
  const query = [
    "SELECT name,total_rows,formatReadableSize(total_bytes) AS size",
    "FROM system.tables",
    `WHERE database='${database}'`,
    "ORDER BY name FORMAT JSONCompact",
  ].join(" ");
  const url = new URL(baseUrl);
  const username = url.username || user;
  const secret = url.password || password;
  url.username = "";
  url.password = "";
  url.searchParams.set("query", query);
  const result = await safeJsonFetch<{
    data?: Array<[string, string | number | null, string | null]>;
  }>(url.toString(), {
    headers: {
      authorization: `Basic ${Buffer.from(`${username}:${secret}`).toString("base64")}`,
    },
  });
  if (!result.ok) {
    errors.push(`ClickHouse ${capability} probe failed: ${result.error}`);
    return offlineProbe(capability, `ClickHouse ${capability} probe failed`);
  }
  const matchingRows = (result.data.data ?? []).filter(([tableName]) =>
    capability === "analytics_store"
      ? tableName.includes("analytics")
      : tableName.includes("timeseries") || tableName.includes("time_series"),
  );
  const rowCount = matchingRows.reduce(
    (sum, [, rows]) => sum + Number(rows ?? 0),
    0,
  );
  const tableNames = matchingRows.map(([tableName]) => tableName).join(", ");
  return [
    capability,
    {
      ok: true,
      status: rowCount > 0 ? "live" : "empty",
      metrics: [
        metric("tables", String(matchingRows.length), "good"),
        metric("rows", String(rowCount), rowCount > 0 ? "good" : "warn"),
        metric("db", database, "muted"),
      ],
      notes: [
        tableNames
          ? `ClickHouse active tables: ${tableNames}.`
          : "ClickHouse 可达，但未找到该 capability 的表。",
      ],
    },
  ];
}

function buildRuntimeStores(input: {
  gateway: DatabaseRuntimeGateway | null;
  bindings: DatabaseRuntimeBinding[];
  containers: DatabaseRuntimeContainer[];
  probes: Record<string, ProbeResult>;
}): DatabaseRuntimeStore[] {
  const bindingsByCapability = new Map(
    input.bindings.map((binding) => [binding.capability, binding]),
  );
  const architokenContainers = new Map(
    input.containers
      .filter((container) => container.group === "architoken")
      .map((container) => [container.name, container]),
  );

  const stores = [
    buildCapabilityStore({
      id: "postgres",
      name: "PostgreSQL 主干库",
      capability: "relational_store",
      category: "relational",
      endpoint: "127.0.0.1:5433",
      role: "租户、账号、权限、模块、审计、资产、对象绑定和 fallback 表",
      binding: bindingsByCapability.get("relational_store"),
      probe: input.probes.relational_store,
      container: architokenContainers.get("architoken-postgres"),
      links: [
        link("Gateway readyz", "/api/architoken/readyz", "api"),
        link(
          "Data-plane bindings",
          "/api/architoken/v1/data-plane/bindings",
          "api",
        ),
      ],
    }),
    buildCapabilityStore({
      id: "seaweedfs-s3",
      name: "SeaweedFS S3 对象存储",
      capability: "object_store",
      category: "object",
      endpoint: "127.0.0.1:8333",
      role: "源文件、派生产物、模型轻量化结果和对象字节",
      binding: bindingsByCapability.get("object_store"),
      probe: input.probes.object_store,
      container: architokenContainers.get("architoken-seaweed-s3"),
      links: [
        link(
          "Bucket list",
          "http://127.0.0.1:8333/architoken-assets?list-type=2",
          "console",
        ),
      ],
    }),
    buildCapabilityStore({
      id: "valkey",
      name: "Valkey 缓存与会话状态",
      capability: "cache_store",
      category: "cache",
      endpoint: "127.0.0.1:6381",
      role: "缓存、限流、短期会话、锁和协同临时状态",
      binding: bindingsByCapability.get("cache_store"),
      probe: input.probes.cache_store,
      container: architokenContainers.get("architoken-valkey"),
      links: [],
    }),
    buildCapabilityStore({
      id: "nats",
      name: "NATS JetStream 事件总线",
      capability: "event_store",
      category: "event",
      endpoint: "127.0.0.1:4222 / 8222",
      role: "审计、工作流、集成事件、协同 fanout 和 replay",
      binding: bindingsByCapability.get("event_store"),
      probe: input.probes.event_store,
      container: architokenContainers.get("architoken-nats"),
      links: [
        link("JetStream monitor", "http://127.0.0.1:8222/jsz", "console"),
      ],
    }),
    buildCapabilityStore({
      id: "qdrant",
      name: "Qdrant 向量索引",
      capability: "vector_store",
      category: "vector",
      endpoint: "127.0.0.1:6333",
      role: "RAG、语义检索和可重建向量索引",
      binding: bindingsByCapability.get("vector_store"),
      probe: input.probes.vector_store,
      container: architokenContainers.get("architoken-qdrant"),
      links: [link("Collections", "http://127.0.0.1:6333/collections", "api")],
    }),
    buildCapabilityStore({
      id: "clickhouse-timeseries",
      name: "ClickHouse 时序库",
      capability: "time_series_store",
      category: "time_series",
      endpoint: "127.0.0.1:8123",
      role: "IoT、遥测、进度点和质量状态时间序列",
      binding: bindingsByCapability.get("time_series_store"),
      probe: input.probes.time_series_store,
      container: architokenContainers.get("architoken-clickhouse"),
      links: [],
    }),
    buildCapabilityStore({
      id: "clickhouse-analytics",
      name: "ClickHouse 分析库",
      capability: "analytics_store",
      category: "analytics",
      endpoint: "127.0.0.1:8123",
      role: "运营聚合、成本、风险、生产和 BI 指标",
      binding: bindingsByCapability.get("analytics_store"),
      probe: input.probes.analytics_store,
      container: architokenContainers.get("architoken-clickhouse"),
      links: [],
    }),
    buildCapabilityStore({
      id: "postgres-graph",
      name: "GraphStore PostgreSQL adjacency",
      capability: "graph_store",
      category: "graph",
      endpoint: "PostgreSQL data_graph_edges",
      role: "构件、工作流、知识和上下游关系",
      binding: bindingsByCapability.get("graph_store"),
      probe: {
        ok: true,
        status: "blocked",
        metrics: [metric("externalized", "false", "muted")],
        notes: [
          "外部 graph sidecar 尚未通过配置和评审，当前按规则走 PostgreSQL adjacency。",
        ],
      },
      container: architokenContainers.get("architoken-postgres"),
      links: [
        link(
          "Graph edges API",
          "/api/architoken/v1/data-plane/graph-edges",
          "api",
        ),
      ],
    }),
  ];

  const sameHostStores = input.containers
    .filter((container) => container.group === "same_host")
    .map(
      (container): DatabaseRuntimeStore => ({
        id: `container:${container.name}`,
        name: container.name,
        group: "same_host",
        category: container.category,
        provider: container.provider,
        endpoint: container.ports || "internal",
        status: container.status.toLowerCase().includes("up")
          ? "live"
          : "unknown",
        role: "同机运行的其它数据库/存储服务；当前未被 ArchIToken data-plane 绑定为 provider。",
        source: "docker",
        metrics: [
          metric("image", container.image, "muted"),
          metric("status", container.status, "muted"),
        ],
        managementLinks: [],
        notes: [
          "来自 Docker 运行清单；是否属于其它项目需要按容器/compose 名称区分。",
        ],
      }),
    );

  return [...stores, ...sameHostStores];
}

function buildCapabilityStore(input: {
  id: string;
  name: string;
  capability: string;
  category: DatabaseRuntimeStore["category"];
  endpoint: string;
  role: string;
  binding: DatabaseRuntimeBinding | undefined;
  probe: ProbeResult | undefined;
  container: DatabaseRuntimeContainer | undefined;
  links: DatabaseRuntimeStore["managementLinks"];
}): DatabaseRuntimeStore {
  const metadata = input.binding?.metadata ?? {};
  const externalized = metadata.externalized;
  const probe = input.probe;
  const status = probe?.status ?? (input.container ? "configured" : "unknown");
  const store: DatabaseRuntimeStore = {
    id: input.id,
    name: input.name,
    group: "architoken",
    category: input.category,
    capability: input.capability,
    provider:
      input.binding?.currentProvider ?? input.container?.provider ?? "unknown",
    endpoint: input.endpoint,
    status,
    role: input.role,
    source: probe?.ok ? "probe" : "gateway",
    metrics: [
      ...(probe?.metrics ?? []),
      ...(input.container
        ? [metric("container", input.container.status, "muted")]
        : []),
    ],
    managementLinks: input.links,
    notes: [
      ...(probe?.notes ?? []),
      ...(input.binding
        ? [`Gateway provider: ${input.binding.currentProvider}.`]
        : ["Gateway binding not returned for this capability."]),
    ],
  };
  if (input.binding?.fallbackProvider) {
    store.fallbackProvider = input.binding.fallbackProvider;
  }
  if (input.binding?.splitPhase) {
    store.splitPhase = input.binding.splitPhase;
  }
  if (typeof externalized === "boolean") {
    store.externalized = externalized;
  }
  if (input.binding?.updatedAt) {
    store.updatedAt = input.binding.updatedAt;
  }
  return store;
}

function metric(
  label: string,
  value: string,
  tone: DatabaseRuntimeMetric["tone"],
): DatabaseRuntimeMetric {
  return { label, value, tone };
}

function link(
  label: string,
  href: string,
  kind: DatabaseRuntimeStore["managementLinks"][number]["kind"],
) {
  return { label, href, kind };
}

function offlineProbe(capability: string, note: string): [string, ProbeResult] {
  return [
    capability,
    {
      ok: false,
      status: "offline",
      metrics: [metric("probe", "failed", "bad")],
      notes: [note],
    },
  ];
}

async function safeJsonFetch<T>(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    if (!response.ok) {
      return { ok: false, error: `${response.status} ${response.statusText}` };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

async function safeTextFetch(
  url: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    if (!response.ok) {
      return { ok: false, error: `${response.status} ${response.statusText}` };
    }
    return { ok: true, text: await response.text() };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

function gatewayBaseUrl(): string {
  return (
    process.env.ARCHITOKEN_API_BASE_URL ??
    process.env.NEXT_PUBLIC_ARCHITOKEN_API_BASE_URL ??
    "http://127.0.0.1:18080"
  ).replace(/\/+$/, "");
}

function redisCommand(urlText: string, args: string[]): Promise<string> {
  const url = new URL(urlText);
  const host = url.hostname || "127.0.0.1";
  const port = Number(url.port || "6379");
  const payload = encodeRedisCommand(args);
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const chunks: Buffer[] = [];
    let settleTimer: NodeJS.Timeout | null = null;
    const failTimer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Redis probe timed out"));
    }, requestTimeoutMs);

    const settle = () => {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        clearTimeout(failTimer);
        socket.destroy();
        resolve(Buffer.concat(chunks).toString("utf8"));
      }, 80);
    };

    socket.once("error", (error) => {
      clearTimeout(failTimer);
      if (settleTimer) clearTimeout(settleTimer);
      reject(error);
    });
    socket.connect(port, host, () => {
      socket.write(payload);
    });
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      settle();
    });
  });
}

function encodeRedisCommand(args: string[]): string {
  return [
    `*${args.length}`,
    ...args.flatMap((arg) => [`$${Buffer.byteLength(arg)}`, arg]),
    "",
  ].join("\r\n");
}

function parseRedisInteger(response: string): number {
  const match = response.match(/:(-?\d+)/);
  return Number(match?.[1] ?? 0);
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "unknown error";
}
