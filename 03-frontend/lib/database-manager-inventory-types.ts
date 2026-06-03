// Database Manager inventory contracts.
// License: Apache-2.0

export type DatabaseManagerInventoryStatus =
  | "live"
  | "not_configured"
  | "unavailable";

export interface DatabaseManagerInventoryItem {
  engine: string;
  status: DatabaseManagerInventoryStatus;
  source: string | null;
  summary: Record<string, unknown>;
  data: unknown | null;
  error: string | null;
}

export interface DatabaseManagerInventorySnapshot {
  generatedAtUnixMs: number;
  status: "ready" | "degraded" | string;
  itemCount: number;
  liveCount: number;
  unavailableCount: number;
  items: DatabaseManagerInventoryItem[];
}

export function databaseManagerInventoryStatusLabel(
  status: DatabaseManagerInventoryStatus,
): string {
  switch (status) {
    case "live":
      return "在线";
    case "not_configured":
      return "未配置";
    case "unavailable":
      return "不可达";
  }
}

export function databaseManagerEngineLabel(engine: string): string {
  switch (engine) {
    case "postgresql":
      return "PostgreSQL";
    case "clickhouse":
      return "ClickHouse";
    case "valkey":
      return "Valkey";
    case "qdrant":
      return "Qdrant";
    case "nats_jetstream":
      return "NATS JetStream";
    case "s3_compatible":
      return "S3 兼容对象存储";
    default:
      return engine;
  }
}

export function summarizeInventoryItem(
  item: DatabaseManagerInventoryItem,
): string {
  const pairs = Object.entries(item.summary)
    .slice(0, 5)
    .map(([key, value]) => `${key}:${formatInventoryValue(value)}`);
  return pairs.length > 0 ? pairs.join(" / ") : (item.error ?? "无摘要");
}

function formatInventoryValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
