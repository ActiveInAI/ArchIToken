// components/ops/OpsResources.tsx
// License: Apache-2.0
// 容器资源实时曲线：订阅 stats-stream SSE，维护每个容器的 CPU 历史并绘制 sparkline。
"use client";

import { useEffect, useMemo, useState } from "react";
import { Empty, Segmented, Spin } from "@/components/pan-ui";

interface StatRow {
  name: string;
  cpu: number;
  mem: number;
  memUsage: string;
}

const HISTORY = 60;
type SortKey = "cpu" | "mem" | "name";

export function OpsResources() {
  const [rows, setRows] = useState<StatRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("cpu");
  const [history, setHistory] = useState<Map<string, number[]>>(() => new Map());

  useEffect(() => {
    const es = new EventSource("/api/ops-center/stats-stream");
    es.onopen = () => setConnected(true);
    es.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data) as { rows?: StatRow[] };
        const next = frame.rows ?? [];
        setRows(next);
        setHistory((prev) => {
          const map = new Map<string, number[]>();
          for (const row of next) {
            const series = [...(prev.get(row.name) ?? []), row.cpu];
            map.set(row.name, series.length > HISTORY ? series.slice(-HISTORY) : series);
          }
          return map;
        });
      } catch {
        /* ignore malformed frame */
      }
    };
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "mem") return b.mem - a.mem;
      return b.cpu - a.cpu;
    });
    return copy;
  }, [rows, sortKey]);

  if (!connected && rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Spin tip="正在连接资源数据流…" />
      </div>
    );
  }
  if (rows.length === 0) {
    return <Empty description="没有运行中的容器" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="arch-muted text-[11px]">
          {connected ? "● 实时" : "○ 已断开"} · {rows.length} 个运行容器 · 每 2.5s 刷新
        </span>
        <Segmented
          options={[
            { label: "按 CPU", value: "cpu" },
            { label: "按内存", value: "mem" },
            { label: "按名称", value: "name" },
          ]}
          value={sortKey}
          onChange={setSortKey}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-100">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">容器</th>
              <th className="px-3 py-2 font-medium">CPU%</th>
              <th className="px-3 py-2 font-medium">CPU 趋势</th>
              <th className="px-3 py-2 font-medium">内存%</th>
              <th className="px-3 py-2 font-medium">内存用量</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const series = history.get(row.name) ?? [];
              return (
                <tr key={row.name} className="border-t border-slate-100">
                  <td className="max-w-[220px] px-3 py-2">
                    <span className="block truncate font-medium text-slate-800" title={row.name}>
                      {row.name}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        row.cpu > 80
                          ? "text-rose-600"
                          : row.cpu > 40
                            ? "text-amber-600"
                            : "text-slate-700"
                      }
                    >
                      {row.cpu.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Spark values={series} />
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.mem.toFixed(1)}</td>
                  <td className="px-3 py-2 text-slate-500">{row.memUsage}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  const width = 120;
  const height = 26;
  if (values.length < 2) {
    return <svg width={width} height={height} className="block" />;
  }
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const points = values
    .map((value, index) => `${(index * step).toFixed(1)},${(height - (value / max) * height).toFixed(1)}`)
    .join(" ");
  const last = values[values.length - 1] ?? 0;
  const color = last > 80 ? "#e11d48" : last > 40 ? "#d97706" : "#10b981";
  return (
    <svg width={width} height={height} className="block">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
