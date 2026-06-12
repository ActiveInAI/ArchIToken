// lib/derivation-jobs-server.test.ts
// License: Apache-2.0

import { afterEach, describe, expect, it } from "vitest";

import {
  __resetDerivationJobs,
  getDerivationJob,
  raceDerivationJob,
} from "./derivation-jobs-server";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(() => {
  __resetDerivationJobs();
});

describe("derivation job queue", () => {
  it("returns inline result when runner finishes within the race window", async () => {
    const raced = await raceDerivationJob("k1", async () => "fast", 1000);
    expect(raced.done).toBe(true);
    if (raced.done) expect(raced.result).toBe("fast");
  });

  it("returns a processing snapshot when runner exceeds the race window", async () => {
    const raced = await raceDerivationJob(
      "k2",
      async () => {
        await delay(300);
        return "slow";
      },
      50,
    );
    expect(raced.done).toBe(false);
    if (!raced.done) {
      expect(raced.snapshot.status).toBe("running");
      expect(raced.snapshot.elapsedMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("dedupes concurrent requests onto a single runner invocation", async () => {
    let runs = 0;
    const runner = async () => {
      runs += 1;
      await delay(120);
      return runs;
    };
    const [a, b, c] = await Promise.all([
      raceDerivationJob("k3", runner, 20),
      raceDerivationJob("k3", runner, 20),
      raceDerivationJob("k3", runner, 20),
    ]);
    expect([a.done, b.done, c.done]).toEqual([false, false, false]);
    await delay(200);
    // 后续请求命中已完成作业,内联返回;runner 只跑了一次
    const final = await raceDerivationJob("k3", runner, 20);
    expect(final.done).toBe(true);
    expect(runs).toBe(1);
  });

  it("eventually resolves the same job to its result on later polls", async () => {
    const slow = async () => {
      await delay(150);
      return "result-x";
    };
    const first = await raceDerivationJob("k4", slow, 30);
    expect(first.done).toBe(false);
    await delay(250);
    const second = await raceDerivationJob("k4", slow, 30);
    expect(second.done).toBe(true);
    if (second.done) expect(second.result).toBe("result-x");
  });

  it("rethrows the original error object and allows retry after failure", async () => {
    class TaggedError extends Error {
      code = "tagged";
    }
    let attempts = 0;
    const failing = async () => {
      attempts += 1;
      await delay(20);
      throw new TaggedError("boom");
    };
    await expect(raceDerivationJob("k5", failing, 1000)).rejects.toBeInstanceOf(
      TaggedError,
    );
    // 失败作业不被复用:再次请求重新发起 runner
    await expect(raceDerivationJob("k5", failing, 1000)).rejects.toBeInstanceOf(
      TaggedError,
    );
    expect(attempts).toBe(2);
  });

  it("exposes a job snapshot via getDerivationJob while running", async () => {
    void raceDerivationJob(
      "k6",
      async () => {
        await delay(200);
        return 1;
      },
      10,
    );
    await delay(30);
    const snap = getDerivationJob("k6");
    expect(snap?.status).toBe("running");
  });
});
