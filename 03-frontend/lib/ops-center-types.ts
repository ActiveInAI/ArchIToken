// lib/ops-center-types.ts
// License: Apache-2.0
// 运维中心前后端共享的数据契约。

export interface OpsContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string;
  running: boolean;
  stack: string;
  cpuPerc?: string;
  memUsage?: string;
}

export interface OpsK8sNode {
  name: string;
  ready: boolean;
  version: string;
}

export interface OpsK8sSummary {
  available: boolean;
  reason?: string;
  nodes?: OpsK8sNode[];
  podSummary?: {
    total: number;
    running: number;
    pending: number;
    failed: number;
    succeeded: number;
  };
  namespaceCount?: number;
}

export interface OpsModelEndpoint {
  name: string;
  url: string;
  kind: "ollama" | "openai";
  reachable: boolean;
  modelCount: number;
}

export interface OpsModel {
  name: string;
  sizeBytes: number;
  params: string;
  family: string;
  source: string;
}

export interface OpsModelProvider {
  name: string;
  keyName: string;
}

export interface OpsModelSummary {
  endpoints: OpsModelEndpoint[];
  models: OpsModel[];
  providers: OpsModelProvider[];
}

export interface OpsCenterSnapshot {
  generatedAt: string;
  host: {
    hostname: string;
    platform: string;
    uptimeSec: number;
    loadavg: [number, number, number];
    cpuCount: number;
    memTotal: number;
    memFree: number;
    memUsedPct: number;
  };
  containers: OpsContainer[];
  containerSummary: { total: number; running: number; stopped: number };
  k8s: OpsK8sSummary;
  models: OpsModelSummary;
  errors: string[];
}

export interface OpsLogsResult {
  id: string;
  tail: number;
  logs: string;
}

export interface OpsExecResult {
  command: string;
  cwd: string;
  code: number;
  stdout: string;
  stderr: string;
}

export type OpsContainerAction = "start" | "stop" | "restart" | "remove";

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${minutes}分`;
  return `${minutes}分`;
}
