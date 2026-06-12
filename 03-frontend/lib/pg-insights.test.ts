import { describe, expect, it } from "vitest";
import {
  PG_INSIGHT_THRESHOLDS,
  buildPgInsights,
  num,
  parsePsqlOutput,
  unavailablePgInsights,
  type PgInsightRawRows,
} from "./pg-insights";

const AT = "2026-06-12T00:00:00.000Z";

function healthyRaw(overrides: Partial<PgInsightRawRows> = {}): PgInsightRawRows {
  return {
    base: [["86400", "12 MB"]],
    conn: [["3", "10", "100"]],
    lock: [["0"]],
    cache: [["99.5"]],
    longTx: [["0", "0"]],
    idleTx: [["0"]],
    dead: [],
    slow: null,
    ...overrides,
  };
}

describe("parsePsqlOutput", () => {
  it("splits psql -At -F tab output into rows and fields", () => {
    expect(parsePsqlOutput("a\tb\tc\nd\te\tf\n")).toEqual([
      ["a", "b", "c"],
      ["d", "e", "f"],
    ]);
  });

  it("drops empty lines and trailing whitespace", () => {
    expect(parsePsqlOutput("\nfoo\t1  \n\n")).toEqual([["foo", "1"]]);
  });
});

describe("num", () => {
  it("parses finite numbers and rejects everything else", () => {
    expect(num("42")).toBe(42);
    expect(num("99.5")).toBe(99.5);
    expect(num("")).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num("abc")).toBeNull();
  });
});

describe("buildPgInsights", () => {
  it("produces a healthy report without warnings", () => {
    const insights = buildPgInsights(healthyRaw(), AT);
    expect(insights.ok).toBe(true);
    expect(insights.uptimeSec).toBe(86400);
    expect(insights.dbSize).toBe("12 MB");
    expect(insights.connections).toEqual({ active: 3, total: 10, max: 100 });
    expect(insights.cacheHitPct).toBe(99.5);
    expect(insights.slowQueries).toBeNull();
    expect(insights.warnings).toEqual([]);
    expect(insights.thresholds).toEqual(PG_INSIGHT_THRESHOLDS);
    expect(insights.generatedAt).toBe(AT);
  });

  it("warns when connection usage exceeds the watermark", () => {
    const insights = buildPgInsights(healthyRaw({ conn: [["50", "85", "100"]] }), AT);
    expect(insights.warnings).toHaveLength(1);
    expect(insights.warnings[0]).toContain("85/100");
    expect(insights.warnings[0]).toContain("85%");
  });

  it("warns on lock waits, long transactions and idle-in-transaction", () => {
    const insights = buildPgInsights(
      healthyRaw({ lock: [["2"]], longTx: [["1", "600"]], idleTx: [["3"]] }),
      AT,
    );
    expect(insights.lockWaits).toBe(2);
    expect(insights.longTxCount).toBe(1);
    expect(insights.oldestTxSec).toBe(600);
    expect(insights.idleInTx).toBe(3);
    expect(insights.warnings).toHaveLength(3);
    expect(insights.warnings[1]).toContain("10 分钟");
  });

  it("warns when cache hit ratio drops below threshold", () => {
    const insights = buildPgInsights(healthyRaw({ cache: [["85.2"]] }), AT);
    expect(insights.warnings).toHaveLength(1);
    expect(insights.warnings[0]).toContain("85.2%");
  });

  it("warns on dead tuples only above both count and ratio thresholds", () => {
    const insights = buildPgInsights(
      healthyRaw({
        dead: [
          ["big_messy", "20000", "1000", "2026-06-10 00:00:00"],
          ["big_but_ok_ratio", "20000", "1000000", ""],
          ["small", "50", "10", ""],
        ],
      }),
      AT,
    );
    expect(insights.deadTuples).toHaveLength(3);
    expect(insights.deadTuples[1]?.lastAutovacuum).toBeNull();
    expect(insights.warnings).toHaveLength(1);
    expect(insights.warnings[0]).toContain("big_messy");
  });

  it("maps slow query rows when pg_stat_statements is enabled", () => {
    const insights = buildPgInsights(
      healthyRaw({ slow: [["select 1", "12", "3.4", "41"]] }),
      AT,
    );
    expect(insights.slowQueries).toEqual([
      { query: "select 1", calls: 12, meanMs: 3.4, totalMs: 41 },
    ]);
  });

  it("tolerates missing optional result sets", () => {
    const insights = buildPgInsights(
      healthyRaw({ conn: null, lock: null, cache: null, longTx: null, idleTx: null, dead: null }),
      AT,
    );
    expect(insights.ok).toBe(true);
    expect(insights.connections).toBeNull();
    expect(insights.cacheHitPct).toBeNull();
    expect(insights.deadTuples).toEqual([]);
    expect(insights.warnings).toEqual([]);
  });
});

describe("unavailablePgInsights", () => {
  it("returns a fully-populated offline report", () => {
    const insights = unavailablePgInsights("PostgreSQL 不可达: timeout", AT);
    expect(insights.ok).toBe(false);
    expect(insights.reason).toContain("不可达");
    expect(insights.deadTuples).toEqual([]);
    expect(insights.slowQueries).toBeNull();
    expect(insights.thresholds).toEqual(PG_INSIGHT_THRESHOLDS);
  });
});
