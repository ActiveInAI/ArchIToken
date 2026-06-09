// lib/generation-client.test.ts - Generation client Router alias tests
// License: Apache-2.0

import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAvailableModels, generateBimModel } from "./generation-client";

const originalFetch = globalThis.fetch;

describe("generation client model routing", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("falls back to ArchIToken Router role aliases, not vendor model ids", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("{}", { status: 503 }),
    ) as typeof fetch;

    await expect(fetchAvailableModels()).resolves.toEqual([
      "architoken-planner",
      "architoken-generator",
      "architoken-evaluator",
      "architoken-rule-checker",
      "architoken-schema-validator",
      "architoken-approver",
    ]);
  });

  it("does not forward provider API keys as Gateway authorization", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    globalThis.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push([input, init]);
        return new Response(JSON.stringify({ ifc_content: "IFC-DATA" }), {
          status: 200,
        });
      },
    ) as typeof fetch;

    await expect(generateBimModel("生成 BIM")).resolves.toBe("IFC-DATA");
    expect(calls[0]?.[1]?.headers).toEqual({
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(calls[0]?.[1]?.body))).toMatchObject({
      model: "architoken-generator",
    });
  });
});
