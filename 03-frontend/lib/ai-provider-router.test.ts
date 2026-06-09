// lib/ai-provider-router.test.ts - Router boundary contract tests
// License: Apache-2.0

import { afterEach, describe, expect, it, vi } from "vitest";

import { discoverAiProviders } from "./ai-provider-router";
import { CHANNEL_PROVIDER_IDS } from "./ai-channel-provider-registry";
import { MODEL_PROVIDER_IDS } from "./ai-model-provider-registry";
import { getModuleSpec } from "./module-registry";
import { getModuleOperationalProfile } from "./module-operations";

const originalFetch = globalThis.fetch;

describe("AI provider router boundary", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("exposes providers only as Router-managed adapters", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("{}", { status: 503 }),
    ) as typeof fetch;

    const manifest = await discoverAiProviders();

    expect(manifest.routerRule).toContain(
      "只能通过 ArchIToken Router / ModelRouter / InferenceRouter / GenerationRouter 调用模型",
    );
    expect(manifest.routerRule).toContain("ModelProviderRegistry 只登记");
    expect(manifest.modelProviders.map((provider) => provider.id)).toEqual(
      MODEL_PROVIDER_IDS,
    );
    expect(manifest.providers).toEqual(manifest.modelProviders);
    expect(manifest.providers.map((provider) => provider.id)).not.toContain(
      "openrouter",
    );
    expect(
      manifest.providers.every((provider) =>
        provider.controls.some((control) =>
          /Router|审计|边界|白名单|隔离/.test(control),
        ),
      ),
    ).toBe(true);
    expect(
      manifest.providers.find((provider) => provider.id === "qwen"),
    ).toMatchObject({
      route: "external_endpoint",
      controls: expect.arrayContaining(["ModelRouter 白名单"]),
    });
  });

  it("exposes only the requested channel provider registry", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("{}", { status: 503 }),
    ) as typeof fetch;

    const manifest = await discoverAiProviders();

    expect(manifest.channelRouterRule).toContain(
      "ChannelProviderRegistry 只登记",
    );
    expect(manifest.channelProviders.map((provider) => provider.id)).toEqual(
      CHANNEL_PROVIDER_IDS,
    );
    expect(
      manifest.channelProviders.find((provider) => provider.id === "openclaw"),
    ).toMatchObject({
      route: "sidecar",
      controls: expect.arrayContaining(["sidecar 隔离", "Approver 审批"]),
    });
  });

  it("keeps AI Center copy focused on adapter registry, not vendor identity", () => {
    const modelProviderRegistry = getModuleSpec("ai_center").subdomains.find(
      (subdomain) => subdomain.id === "model-provider-registry",
    );
    const modelProviders = getModuleOperationalProfile(
      "ai_center",
    ).features.find((feature) => feature.id === "model-providers");

    expect(modelProviderRegistry?.purpose).toContain("provider adapter");
    expect(modelProviderRegistry?.purpose).not.toMatch(
      /OpenAI|Anthropic|Google|OpenRouter/,
    );
    expect(modelProviders?.description).toContain("Router 后置 adapter");
    expect(modelProviders?.description).not.toMatch(
      /OpenAI|Anthropic|Google|OpenRouter/,
    );
  });
});
