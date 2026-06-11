// components/ops/OpsPorts.tsx
// License: Apache-2.0
// 端口/服务总览：列出主机所有监听端口、对应容器/进程、暴露范围与 HTTP 可达性，
// 支持一键在浏览器打开或复制访问地址。
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Empty, Input, Segmented, Spin, Tag } from "@/components/pan-ui";
import { Check, Copy, ExternalLink, Globe, Lock, RefreshCcw } from "lucide-react";

type Scope = "lan" | "local" | "other";

interface PortEntry {
  port: number;
  scope: Scope;
  process: string;
  pid: number | null;
  container: string | null;
  http: boolean;
}

type ScopeFilter = "all" | "lan" | "local";

export function OpsPorts() {
  const [ports, setPorts] = useState<PortEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [httpOnly, setHttpOnly] = useState(false);
  const [host, setHost] = useState("localhost");
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    setHost(window.location.hostname || "localhost");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ops-center/ports", { cache: "no-store" });
      const data = (await response.json()) as { ports?: PortEntry[] };
      setPorts(data.ports ?? []);
    } catch {
      setPorts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (ports ?? []).filter((entry) => {
      if (scope !== "all" && entry.scope !== scope) return false;
      if (httpOnly && !entry.http) return false;
      if (!text) return true;
      return `${entry.port} ${entry.process} ${entry.container ?? ""}`.toLowerCase().includes(text);
    });
  }, [ports, query, scope, httpOnly]);

  const copyAddr = (port: number) => {
    void navigator.clipboard?.writeText(`${host}:${port}`);
    setCopied(port);
    window.setTimeout(() => setCopied((value) => (value === port ? null : value)), 1500);
  };

  if (ports === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Spin tip="扫描监听端口…" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-56">
          <Input
            size="small"
            allowClear
            placeholder="搜索端口/容器/进程"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Segmented
          options={[
            { label: "全部", value: "all" },
            { label: "局域网", value: "lan" },
            { label: "仅本机", value: "local" },
          ]}
          value={scope}
          onChange={setScope}
        />
        <Button
          size="small"
          type={httpOnly ? "primary" : "default"}
          icon={<Globe className="h-4 w-4" />}
          onClick={() => setHttpOnly((value) => !value)}
        >
          仅 HTTP
        </Button>
        <span className="arch-muted text-[11px]">{filtered.length} 个端口</span>
        <Button
          size="small"
          className="ml-auto"
          icon={<RefreshCcw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />}
          onClick={() => void load()}
          disabled={loading}
        >
          刷新
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Empty description="没有匹配的端口" />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-100">
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">端口</th>
                <th className="px-3 py-2 font-medium">服务 / 进程</th>
                <th className="px-3 py-2 font-medium">来源</th>
                <th className="px-3 py-2 font-medium">暴露范围</th>
                <th className="px-3 py-2 font-medium">协议</th>
                <th className="px-3 py-2 text-right font-medium">访问</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const addr = `${host}:${entry.port}`;
                return (
                  <tr key={entry.port} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-mono font-medium text-slate-800">{entry.port}</td>
                    <td className="max-w-[260px] px-3 py-2">
                      <span className="block truncate text-slate-700" title={entry.container ?? entry.process}>
                        {entry.container ?? entry.process ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {entry.container ? (
                        <Tag color="cyan">容器</Tag>
                      ) : entry.process ? (
                        <span className="text-slate-500">
                          {entry.process}
                          {entry.pid ? <span className="arch-muted"> · {entry.pid}</span> : null}
                        </span>
                      ) : (
                        <span className="arch-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {entry.scope === "lan" ? (
                        <Tag color="green" icon={<Globe className="h-3 w-3" />}>
                          局域网
                        </Tag>
                      ) : entry.scope === "local" ? (
                        <Tag color="gold" icon={<Lock className="h-3 w-3" />}>
                          仅本机
                        </Tag>
                      ) : (
                        <Tag>其他</Tag>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={entry.http ? "text-emerald-600" : "text-slate-400"}>
                        {entry.http ? "HTTP" : "TCP"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {entry.http ? (
                          <Button
                            size="small"
                            type="text"
                            href={`http://${addr}`}
                            target="_blank"
                            rel="noreferrer"
                            icon={<ExternalLink className="h-3.5 w-3.5" />}
                          >
                            打开
                          </Button>
                        ) : null}
                        <Button
                          size="small"
                          type="text"
                          icon={
                            copied === entry.port ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )
                          }
                          onClick={() => copyAddr(entry.port)}
                        >
                          {copied === entry.port ? "已复制" : "复制"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
