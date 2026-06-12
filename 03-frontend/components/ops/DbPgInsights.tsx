// components/ops/DbPgInsights.tsx
// License: Apache-2.0
// PostgreSQL 巡检视图：连接水位、缓存命中率、锁等待、长事务、死元组/autovacuum、慢查询，
// 按阈值集中告警；只读巡检，每 60 秒静默自刷新。
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Empty, Spin, Tag } from "@/components/pan-ui";
import {
  Activity,
  Database,
  Gauge,
  Lock,
  RefreshCcw,
  Timer,
  Users,
} from "lucide-react";
import { unavailablePgInsights, type PgInsights } from "@/lib/pg-insights";

const AUTO_REFRESH_MS = 60000;

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}天 ${hours}小时`;
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}小时 ${minutes}分`;
  return `${minutes}分`;
}

export function DbPgInsights({
  onAudit,
}: {
  onAudit?: ((action: string, detail: string) => void) | undefined;
}) {
  const [insights, setInsights] = useState<PgInsights | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const response = await fetch("/api/database-runtime/pg-insights", {
          cache: "no-store",
        });
        const data = (await response.json()) as PgInsights;
        setInsights(data);
        if (!silent) {
          onAudit?.(
            "settings-database-pg-insights",
            `ok=${data.ok}; warnings=${data.warnings.length}`,
          );
        }
      } catch {
        if (!silent) setInsights(null);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [onAudit],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/database-runtime/pg-insights", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: PgInsights) => {
        if (active) setInsights(data);
      })
      .catch(() => {
        if (active)
          setInsights(unavailablePgInsights("巡检接口请求失败", new Date().toISOString()));
      });
    const timer = window.setInterval(() => void load(true), AUTO_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [load]);

  const connPct = useMemo(() => {
    if (!insights?.connections || insights.connections.max <= 0) return null;
    return Math.round((insights.connections.total / insights.connections.max) * 100);
  }, [insights]);

  if (insights === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spin tip="正在巡检 PostgreSQL…" />
      </div>
    );
  }

  if (!insights.ok) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <Button
            size="small"
            icon={<RefreshCcw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />}
            onClick={() => void load()}
            disabled={loading}
          >
            重新巡检
          </Button>
        </div>
        <Empty description={insights.reason ?? "PostgreSQL 不可达"} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tag color="green" icon={<Database className="h-3.5 w-3.5" />}>
          PostgreSQL 在线{insights.dbSize ? ` · ${insights.dbSize}` : ""}
        </Tag>
        {insights.uptimeSec !== null ? (
          <span className="arch-muted text-[11px]">运行 {formatUptime(insights.uptimeSec)}</span>
        ) : null}
        <span className="arch-muted text-[11px]">
          {new Date(insights.generatedAt).toLocaleTimeString()} 巡检 · 每 60 秒自动复查
        </span>
        <Button
          size="small"
          className="ml-auto"
          icon={<RefreshCcw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />}
          onClick={() => void load()}
          disabled={loading}
        >
          重新巡检
        </Button>
      </div>

      {insights.warnings.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <p className="font-medium">{insights.warnings.length} 项巡检告警：</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {insights.warnings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          全部巡检项处于健康水位。
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <InsightCard
          icon={<Users className="h-4 w-4" />}
          label="连接水位"
          value={
            insights.connections
              ? `${insights.connections.total}/${insights.connections.max}`
              : "—"
          }
          hint={
            insights.connections
              ? `${insights.connections.active} 活动 · ${connPct ?? 0}%（>${insights.thresholds.connWarnPct}% 告警）`
              : "不可用"
          }
          tone={connPct !== null && connPct > insights.thresholds.connWarnPct ? "amber" : "emerald"}
        />
        <InsightCard
          icon={<Gauge className="h-4 w-4" />}
          label="缓存命中率"
          value={insights.cacheHitPct !== null ? `${insights.cacheHitPct}%` : "—"}
          hint={`低于 ${insights.thresholds.cacheHitWarnPct}% 告警`}
          tone={
            insights.cacheHitPct !== null &&
            insights.cacheHitPct < insights.thresholds.cacheHitWarnPct
              ? "amber"
              : "emerald"
          }
        />
        <InsightCard
          icon={<Lock className="h-4 w-4" />}
          label="锁等待"
          value={`${insights.lockWaits ?? "—"}`}
          hint="未授予的锁请求数"
          tone={(insights.lockWaits ?? 0) > 0 ? "rose" : "emerald"}
        />
        <InsightCard
          icon={<Timer className="h-4 w-4" />}
          label="长事务"
          value={`${insights.longTxCount ?? "—"}`}
          hint={
            (insights.longTxCount ?? 0) > 0
              ? `最久 ${Math.round((insights.oldestTxSec ?? 0) / 60)} 分钟`
              : `> ${insights.thresholds.longTxMinutes} 分钟计入`
          }
          tone={(insights.longTxCount ?? 0) > 0 ? "amber" : "emerald"}
        />
        <InsightCard
          icon={<Activity className="h-4 w-4" />}
          label="事务中空闲"
          value={`${insights.idleInTx ?? "—"}`}
          hint={`空闲超 ${insights.thresholds.longTxMinutes} 分钟的连接`}
          tone={(insights.idleInTx ?? 0) > 0 ? "amber" : "emerald"}
        />
      </div>

      <section className="rounded-md border border-slate-100 bg-white p-4 shadow-sm">
        <header className="mb-2">
          <p className="arch-primary-text font-mono text-[10px]">Autovacuum</p>
          <h4 className="arch-text text-sm font-medium">死元组 Top 5</h4>
        </header>
        {insights.deadTuples.length === 0 ? (
          <p className="arch-muted text-xs">所有用户表当前没有死元组堆积。</p>
        ) : (
          <div className="overflow-auto rounded-md border border-slate-100">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">表</th>
                  <th className="px-3 py-2 font-medium">死元组</th>
                  <th className="px-3 py-2 font-medium">活元组</th>
                  <th className="px-3 py-2 font-medium">最近 autovacuum</th>
                </tr>
              </thead>
              <tbody>
                {insights.deadTuples.map((row) => (
                  <tr key={row.table} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{row.table}</td>
                    <td className="px-3 py-2 text-slate-600">{row.dead}</td>
                    <td className="px-3 py-2 text-slate-600">{row.live}</td>
                    <td className="px-3 py-2 text-slate-500">{row.lastAutovacuum ?? "从未"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-md border border-slate-100 bg-white p-4 shadow-sm">
        <header className="mb-2">
          <p className="arch-primary-text font-mono text-[10px]">Slow Queries</p>
          <h4 className="arch-text text-sm font-medium">慢查询 Top 5（按平均耗时）</h4>
        </header>
        {insights.slowQueries === null ? (
          <p className="arch-muted text-xs">
            pg_stat_statements 扩展未启用。如需慢查询统计，在 postgresql.conf 配置
            shared_preload_libraries=&apos;pg_stat_statements&apos; 并执行 CREATE EXTENSION
            pg_stat_statements; 后重启数据库。
          </p>
        ) : insights.slowQueries.length === 0 ? (
          <p className="arch-muted text-xs">暂无慢查询记录。</p>
        ) : (
          <div className="overflow-auto rounded-md border border-slate-100">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">查询</th>
                  <th className="px-3 py-2 font-medium">调用次数</th>
                  <th className="px-3 py-2 font-medium">平均耗时</th>
                  <th className="px-3 py-2 font-medium">总耗时</th>
                </tr>
              </thead>
              <tbody>
                {insights.slowQueries.map((row, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    <td className="max-w-[480px] px-3 py-2">
                      <span className="block truncate font-mono text-slate-700" title={row.query}>
                        {row.query}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.calls}</td>
                    <td className="px-3 py-2 text-slate-600">{row.meanMs}ms</td>
                    <td className="px-3 py-2 text-slate-600">{row.totalMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function InsightCard({
  icon,
  label,
  value,
  hint,
  tone = "emerald",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "rose"
      ? "bg-rose-50 text-rose-600"
      : tone === "amber"
        ? "bg-amber-50 text-amber-600"
        : "bg-emerald-50 text-emerald-700";
  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-100 bg-white p-3 shadow-sm">
      <span className="flex items-center justify-between">
        <span className="arch-muted text-[11px]">{label}</span>
        <span className={"inline-flex h-7 w-7 items-center justify-center rounded-md " + toneClass}>
          {icon}
        </span>
      </span>
      <span className="text-lg font-semibold text-slate-800">{value}</span>
      {hint ? (
        <span className="arch-muted truncate text-[11px]" title={hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
