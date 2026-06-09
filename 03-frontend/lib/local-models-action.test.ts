// lib/local-models-action.test.ts - Server-side model catalog adapter tests
// License: Apache-2.0

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getProviderModelCatalog,
  getProviderSecretStatus,
} from "./local-models-action";

const originalFetch = globalThis.fetch;
const originalDashScopeApiKey = process.env.DASHSCOPE_API_KEY;

describe("provider model catalog server action", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalDashScopeApiKey === undefined) {
      delete process.env.DASHSCOPE_API_KEY;
    } else {
      process.env.DASHSCOPE_API_KEY = originalDashScopeApiKey;
    }
    vi.restoreAllMocks();
  });

  it("fetches Qwen model catalogs with server-side secrets only", async () => {
    process.env.DASHSCOPE_API_KEY = "server-test-token";
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push([input, init]);
        expect(init?.headers).toEqual({
          Authorization: "Bearer server-test-token",
        });
        return new Response(
          JSON.stringify({ data: [{ id: "qwen/example-model" }] }),
          { status: 200 },
        );
      },
    );
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(
      getProviderModelCatalog({
        provider: "qwen",
      }),
    ).resolves.toEqual(["qwen/example-model"]);
    expect(String(calls[0]?.[0])).toContain(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
    );
  });

  it("reports cloud provider secret status without exposing values", async () => {
    process.env.DASHSCOPE_API_KEY = "server-test-token";

    await expect(getProviderSecretStatus("qwen")).resolves.toEqual({
      configured: true,
      mode: "server_secret",
      tokenEnv: "DASHSCOPE_API_KEY",
    });
  });

  it("normalizes OpenAI-compatible local catalog URLs", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push([input, init]);
        return new Response(JSON.stringify({ data: ["local/model-a"] }), {
          status: 200,
        });
      },
    );
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(
      getProviderModelCatalog({
        provider: "vllm",
        baseUrl: "http://127.0.0.1:8000/v1/",
      }),
    ).resolves.toEqual(["local/model-a"]);
    expect(String(calls[0]?.[0])).toBe("http://127.0.0.1:8000/v1/models");
  });
});
