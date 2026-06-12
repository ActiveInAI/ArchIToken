// lib/pg-insights.ts
// License: Apache-2.0
// PostgreSQL 巡检洞察的纯逻辑：psql 行解析、阈值告警计算与结果组装。
// 不触碰网络与子进程，便于单测；执行侧见 app/api/database-runtime/pg-insights/route.ts。

export interface PgDeadTupleRow {
  table: string;
  dead: number;
  live: number;
  lastAutovacuum: string | null;
}

export interface PgSlowQueryRow {
  query: string;
  calls: number;
  meanMs: number;
  totalMs: number;
}

export interface PgInsightThresholds {
  connWarnPct: number;
  cacheHitWarnPct: number;
  longTxMinutes: number;
}

export interface PgInsights {
  ok: boolean;
  reason?: string;
  uptimeSec: number | null;
  dbSize: string | null;
  connections: { active: number; total: number; max: number } | null;
  cacheHitPct: number | null;
  lockWaits: number | null;
  longTxCount: number | null;
  oldestTxSec: number | null;
  idleInTx: number | null;
  deadTuples: PgDeadTupleRow[];
  slowQueries: PgSlowQueryRow[] | null; // null = pg_stat_statements 未启用
  warnings: string[];
  thresholds: PgInsightThresholds;
  generatedAt: string;
}

export const PG_INSIGHT_THRESHOLDS: PgInsightThresholds = {
  connWarnPct: 80,
  cacheHitWarnPct: 90,
  longTxMinutes: 5,
};

export const DEAD_TUP_WARN_COUNT = 10000;
export const DEAD_TUP_WARN_RATIO = 0.2;

/** psql -At 输出的一行拆成字段后的原始结果集（按查询分组）。 */
export interface PgInsightRawRows {
  base: string[][];
  conn: string[][] | null;
  lock: string[][] | null;
  cache: string[][] | null;
  longTx: string[][] | null;
  idleTx: string[][] | null;
  dead: string[][] | null;
  slow: string[][] | null; // null = pg_stat_statements 未启用
}

export function parsePsqlOutput(stdout: string): string[][] {
  return stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.split("\t"));
}

export const num = (value: string | undefined): number | null => {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function unavailablePgInsights(reason: string, generatedAt: string): PgInsights {
  return {
    ok: false,
    reason,
    uptimeSec: null,
    dbSize: null,
    connections: null,
    cacheHitPct: null,
    lockWaits: null,
    longTxCount: null,
    oldestTxSec: null,
    idleInTx: null,
    deadTuples: [],
    slowQueries: null,
    warnings: [],
    thresholds: PG_INSIGHT_THRESHOLDS,
    generatedAt,
  };
}

export function buildPgInsights(raw: PgInsightRawRows, generatedAt: string): PgInsights {
  const { connWarnPct, cacheHitWarnPct, longTxMinutes } = PG_INSIGHT_THRESHOLDS;

  const connections =
    raw.conn && raw.conn[0]
      ? {
          active: num(raw.conn[0][0]) ?? 0,
          total: num(raw.conn[0][1]) ?? 0,
          max: num(raw.conn[0][2]) ?? 0,
        }
      : null;
  const cacheHitPct = num(raw.cache?.[0]?.[0]);
  const lockWaits = num(raw.lock?.[0]?.[0]);
  const longTxCount = num(raw.longTx?.[0]?.[0]);
  const oldestTxSec = num(raw.longTx?.[0]?.[1]);
  const idleInTx = num(raw.idleTx?.[0]?.[0]);
  const deadTuples: PgDeadTupleRow[] = (raw.dead ?? []).map((row) => ({
    table: row[0] ?? "",
    dead: num(row[1]) ?? 0,
    live: num(row[2]) ?? 0,
    lastAutovacuum: row[3] || null,
  }));
  const slowQueries: PgSlowQueryRow[] | null =
    raw.slow === null
      ? null
      : raw.slow.map((row) => ({
          query: row[0] ?? "",
          calls: num(row[1]) ?? 0,
          meanMs: num(row[2]) ?? 0,
          totalMs: num(row[3]) ?? 0,
        }));

  const warnings: string[] = [];
  if (connections && connections.max > 0) {
    const pct = Math.round((connections.total / connections.max) * 100);
    if (pct > connWarnPct) {
      warnings.push(
        `连接数 ${connections.total}/${connections.max}（${pct}%）超过 ${connWarnPct}% 水位，注意连接泄漏或加连接池。`,
      );
    }
  }
  if ((lockWaits ?? 0) > 0) warnings.push(`${lockWaits} 个锁请求处于等待状态，可能存在锁冲突。`);
  if ((longTxCount ?? 0) > 0) {
    warnings.push(
      `${longTxCount} 个事务运行超过 ${longTxMinutes} 分钟（最久 ${Math.round((oldestTxSec ?? 0) / 60)} 分钟），会阻碍 vacuum 与锁释放。`,
    );
  }
  if ((idleInTx ?? 0) > 0) {
    warnings.push(`${idleInTx} 个连接「事务中空闲」超过 ${longTxMinutes} 分钟，建议排查未提交事务。`);
  }
  if (cacheHitPct !== null && cacheHitPct < cacheHitWarnPct) {
    warnings.push(`缓存命中率 ${cacheHitPct}% 低于 ${cacheHitWarnPct}%，考虑增大 shared_buffers 或优化查询。`);
  }
  for (const row of deadTuples) {
    if (row.dead > DEAD_TUP_WARN_COUNT && row.dead > row.live * DEAD_TUP_WARN_RATIO) {
      warnings.push(`表 ${row.table} 死元组 ${row.dead}（活元组 ${row.live}），建议关注 autovacuum。`);
    }
  }

  return {
    ok: true,
    uptimeSec: num(raw.base[0]?.[0]),
    dbSize: raw.base[0]?.[1] ?? null,
    connections,
    cacheHitPct,
    lockWaits,
    longTxCount,
    oldestTxSec,
    idleInTx,
    deadTuples,
    slowQueries,
    warnings,
    thresholds: PG_INSIGHT_THRESHOLDS,
    generatedAt,
  };
}
