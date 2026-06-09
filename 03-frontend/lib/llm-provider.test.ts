// lib/llm-provider.test.ts - client LLM config storage boundary
// License: Apache-2.0

import { describe, expect, it } from "vitest";

import { normalizeConfig } from "./llm-provider";

describe("LLM provider config storage", () => {
  it("strips browser-side API keys from stored config migrations", () => {
    const normalized = normalizeConfig({
      provider: "qwen",
      model: "architoken-generator",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: "must-not-persist",
    });

    expect(normalized).toEqual({
      provider: "qwen",
      model: "architoken-generator",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });
    expect("apiKey" in normalized).toBe(false);
  });
});
