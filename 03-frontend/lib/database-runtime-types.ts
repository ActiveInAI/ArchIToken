// Runtime database visualization and management contracts.
// License: Apache-2.0

export type DatabaseRuntimeStatus =
  | "live"
  | "empty"
  | "configured"
  | "blocked"
  | "offline"
  | "unknown";

export type DatabaseRuntimeCategory =
  | "relational"
  | "object"
  | "cache"
  | "event"
  | "vector"
  | "time_series"
  | "analytics"
  | "graph"
  | "search"
  | "document"
  | "storage"
  | "application";

export interface DatabaseRuntimeMetric {
  label: string;
  value: string;
  tone: "good" | "warn" | "bad" | "muted";
}

export interface DatabaseRuntimeLink {
  label: string;
  href: string;
  kind: "api" | "console" | "docs";
}

export interface DatabaseRuntimeStore {
  id: string;
  name: string;
  group: "architoken" | "same_host";
  category: DatabaseRuntimeCategory;
  capability?: string;
  provider: string;
  endpoint: string;
  status: DatabaseRuntimeStatus;
  role: string;
  source: "gateway" | "probe" | "docker";
  fallbackProvider?: string;
  splitPhase?: string;
  externalized?: boolean;
  metrics: DatabaseRuntimeMetric[];
  managementLinks: DatabaseRuntimeLink[];
  notes: string[];
  updatedAt?: string;
}

export interface DatabaseRuntimeContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  group: "architoken" | "same_host";
  category: DatabaseRuntimeCategory;
  provider: string;
}

export interface DatabaseRuntimeGateway {
  status: string;
  runtimeProfile: string;
  persistenceMode: string;
  databaseMode: string;
  objectStoreMode: string;
  databaseConfigured: boolean;
  objectStoreConfigured: boolean;
  queueConfigured: boolean;
  telemetryConfigured: boolean;
}

export interface DatabaseRuntimeBinding {
  capability: string;
  currentProvider: string;
  fallbackProvider: string;
  splitPhase: string;
  externalUrlEnv: string[];
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseRuntimeSnapshot {
  generatedAt: string;
  gateway: DatabaseRuntimeGateway | null;
  bindings: DatabaseRuntimeBinding[];
  stores: DatabaseRuntimeStore[];
  containers: DatabaseRuntimeContainer[];
  errors: string[];
}

export function databaseStatusLabel(status: DatabaseRuntimeStatus): string {
  switch (status) {
    case "live":
      return "在线";
    case "empty":
      return "在线 · 空数据";
    case "configured":
      return "已配置";
    case "blocked":
      return "未外置";
    case "offline":
      return "离线";
    case "unknown":
      return "未知";
  }
}

export function databaseCategoryLabel(
  category: DatabaseRuntimeCategory,
): string {
  switch (category) {
    case "relational":
      return "关系库";
    case "object":
      return "对象存储";
    case "cache":
      return "缓存";
    case "event":
      return "事件流";
    case "vector":
      return "向量库";
    case "time_series":
      return "时序库";
    case "analytics":
      return "分析库";
    case "graph":
      return "图关系";
    case "search":
      return "搜索";
    case "document":
      return "文档库";
    case "storage":
      return "文件存储";
    case "application":
      return "应用存储";
  }
}

export function classifyDatabaseContainer(input: {
  name: string;
  image: string;
}): {
  group: "architoken" | "same_host";
  category: DatabaseRuntimeCategory;
  provider: string;
} | null {
  const name = input.name.toLowerCase();
  const image = input.image.toLowerCase();
  const text = `${name} ${image}`;
  const group = name.startsWith("architoken-") ? "architoken" : "same_host";

  if (text.includes("clickhouse")) {
    return { group, category: "analytics", provider: "ClickHouse" };
  }
  if (text.includes("qdrant")) {
    return { group, category: "vector", provider: "Qdrant" };
  }
  if (text.includes("nats")) {
    return { group, category: "event", provider: "NATS JetStream" };
  }
  if (text.includes("seaweed")) {
    return { group, category: "object", provider: "SeaweedFS" };
  }
  if (text.includes("valkey")) {
    return { group, category: "cache", provider: "Valkey" };
  }
  if (text.includes("redis")) {
    return { group, category: "cache", provider: "Redis" };
  }
  if (text.includes("postgres") || text.includes("pgvector")) {
    return { group, category: "relational", provider: "PostgreSQL" };
  }
  if (text.includes("mongo")) {
    return { group, category: "document", provider: "MongoDB" };
  }
  if (text.includes("meilisearch")) {
    return { group, category: "search", provider: "Meilisearch" };
  }
  if (text.includes("storage-api")) {
    return { group, category: "storage", provider: "Supabase Storage" };
  }
  if (text.includes("logflare")) {
    return { group, category: "analytics", provider: "Logflare" };
  }
  if (text.includes("uptime-kuma")) {
    return { group, category: "application", provider: "Uptime Kuma" };
  }
  return null;
}

export function storeStatusTone(
  status: DatabaseRuntimeStatus,
): "good" | "warn" | "bad" | "muted" {
  switch (status) {
    case "live":
      return "good";
    case "empty":
    case "configured":
      return "warn";
    case "blocked":
    case "unknown":
      return "muted";
    case "offline":
      return "bad";
  }
}
