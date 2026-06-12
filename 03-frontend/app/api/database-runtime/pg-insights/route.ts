// app/api/database-runtime/pg-insights/route.ts
// License: Apache-2.0
// PostgreSQL 巡检洞察：连接水位、缓存命中率、锁等待、长事务、空闲事务、死元组/autovacuum、
// 慢查询（pg_stat_statements 可用时），并按大厂运维阈值产出告警。只读，不做任何变更操作。
// 解析与告警逻辑见 lib/pg-insights.ts，本文件只负责 psql 执行与编排。
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  PG_INSIGHT_THRESHOLDS,
  buildPgInsights,
  num,
  parsePsqlOutput,
  unavailablePgInsights,
} from "@/lib/pg-insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const QUERY_TIMEOUT = 8000;

function databaseUrl(): string {
  return (
    process.env.ARCHITOKEN_DATABASE__URL ??
    process.env.DATABASE_URL ??
    "postgres://architoken:architoken_dev_only@127.0.0.1:5433/architoken"
  );
}

async function pg(sql: string): Promise<string[][]> {
  const { stdout } = await execFileAsync(
    "psql",
    [databaseUrl(), "-v", "ON_ERROR_STOP=1", "-At", "-F", "\t", "-c", sql],
    { timeout: QUERY_TIMEOUT, maxBuffer: 1024 * 1024 },
  );
  return parsePsqlOutput(stdout);
}

async function tryPg(sql: string): Promise<string[][] | null> {
  try {
    return await pg(sql);
  } catch {
    return null;
  }
}

export async function GET() {
  const generatedAt = new Date().toISOString();
  const { longTxMinutes } = PG_INSIGHT_THRESHOLDS;

  // 基础连通性：失败直接返回不可用
  let base: string[][];
  try {
    base = await pg(
      "select extract(epoch from now()-pg_postmaster_start_time())::bigint, pg_size_pretty(pg_database_size(current_database()))",
    );
  } catch (error) {
    const reason = `PostgreSQL 不可达: ${error instanceof Error ? error.message : String(error)}`;
    return Response.json(unavailablePgInsights(reason, generatedAt), {
      headers: { "cache-control": "no-store" },
    });
  }

  const [conn, lock, cache, longTx, idleTx, dead, extRows] = await Promise.all([
    tryPg(
      "select count(*) filter (where state='active'), count(*), (select setting::int from pg_settings where name='max_connections') from pg_stat_activity",
    ),
    tryPg("select count(*) from pg_locks where not granted"),
    tryPg(
      "select coalesce(round(100.0*sum(blks_hit)/nullif(sum(blks_hit)+sum(blks_read),0),1),100) from pg_stat_database",
    ),
    tryPg(
      `select count(*), coalesce(max(extract(epoch from now()-xact_start))::bigint,0) from pg_stat_activity where xact_start is not null and state<>'idle' and now()-xact_start > interval '${longTxMinutes} minutes'`,
    ),
    tryPg(
      `select count(*) from pg_stat_activity where state='idle in transaction' and state_change < now()-interval '${longTxMinutes} minutes'`,
    ),
    tryPg(
      "select relname, n_dead_tup, n_live_tup, coalesce(last_autovacuum::text,'') from pg_stat_user_tables where n_dead_tup > 0 order by n_dead_tup desc limit 5",
    ),
    tryPg("select count(*) from pg_extension where extname='pg_stat_statements'"),
  ]);

  let slow: string[][] | null = null;
  if (num(extRows?.[0]?.[0] ?? "0") === 1) {
    slow =
      (await tryPg(
        "select left(regexp_replace(query, E'\\\\s+', ' ', 'g'), 160), calls, round(mean_exec_time::numeric,1), round(total_exec_time::numeric)::bigint from pg_stat_statements where query not ilike '%pg_stat_statements%' order by mean_exec_time desc limit 5",
      )) ?? [];
  }

  const insights = buildPgInsights(
    { base, conn, lock, cache, longTx, idleTx, dead, slow },
    generatedAt,
  );
  return Response.json(insights, { headers: { "cache-control": "no-store" } });
}
