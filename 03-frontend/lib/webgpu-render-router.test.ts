// lib/webgpu-render-router.test.ts
// License: Apache-2.0
import { describe, expect, it } from "vitest";

import {
  BROWSER_GPU_MATRIX,
  type GpuCapabilities,
  gpuMemoryBudget,
  selectRenderBackend,
  webgpuUnavailableReason,
} from "./webgpu-render-router";

function caps(over: Partial<GpuCapabilities> = {}): GpuCapabilities {
  return {
    hasWindow: true,
    isSecureContext: true,
    isLocalhost: false,
    hasNavigatorGpu: true,
    hasGpuAdapter: true,
    hasWebgl: true,
    userAgent: "Mozilla/5.0 Chrome/120",
    ...over,
  };
}

describe("selectRenderBackend — WebGPU-first policy (#7)", () => {
  it("routes to WebGPU as the primary path when an adapter is available", () => {
    const d = selectRenderBackend(caps());
    expect(d.backend).toBe("webgpu");
    expect(d.webgpuFirst).toBe(true);
    expect(d.fallbackChain).toEqual(["three_webgl"]);
  });

  it("falls back to Three.js WebGL only when WebGPU is unavailable", () => {
    const d = selectRenderBackend(caps({ hasGpuAdapter: false }));
    expect(d.backend).toBe("three_webgl");
    expect(d.webgpuFirst).toBe(false);
  });

  it("never makes WebGL the primary path while WebGPU works", () => {
    for (const localhost of [true, false]) {
      const d = selectRenderBackend(caps({ isLocalhost: localhost }));
      expect(d.backend).not.toBe("three_webgl");
      expect(d.webgpuFirst).toBe(true);
    }
  });

  it("reports unavailable when neither WebGPU nor WebGL can run", () => {
    const d = selectRenderBackend(
      caps({ hasGpuAdapter: false, hasNavigatorGpu: false, hasWebgl: false }),
    );
    expect(d.backend).toBe("unavailable");
  });

  it("treats localhost as a secure origin for WebGPU", () => {
    const d = selectRenderBackend(
      caps({ isSecureContext: false, isLocalhost: true }),
    );
    expect(d.backend).toBe("webgpu");
  });
});

describe("webgpuUnavailableReason — diagnostics", () => {
  it("returns null when WebGPU is fully available", () => {
    expect(webgpuUnavailableReason(caps())).toBeNull();
  });

  it("flags insecure non-localhost origins", () => {
    const reason = webgpuUnavailableReason(
      caps({ isSecureContext: false, isLocalhost: false }),
    );
    expect(reason).toContain("安全来源");
  });

  it("gives a Firefox-specific hint when navigator.gpu is missing", () => {
    const reason = webgpuUnavailableReason(
      caps({ hasNavigatorGpu: false, userAgent: "Mozilla/5.0 Firefox/130" }),
    );
    expect(reason).toContain("Firefox");
  });
});

describe("gpuMemoryBudget — large-BIM streaming", () => {
  it("derives a conservative budget and chunk size", () => {
    const budget = gpuMemoryBudget(8);
    expect(budget.maxBufferMb).toBeLessThanOrEqual(1024);
    expect(budget.streamingChunkMb).toBeGreaterThan(0);
    expect(budget.streamingChunkMb).toBeLessThan(budget.maxBufferMb);
  });

  it("falls back to a 4 GiB assumption when device memory is unknown", () => {
    expect(gpuMemoryBudget().maxBufferMb).toBe(gpuMemoryBudget(4).maxBufferMb);
  });

  it("clamps the buffer cap to the [64, 1024] MiB range", () => {
    expect(gpuMemoryBudget(0.25).maxBufferMb).toBeGreaterThanOrEqual(64);
    expect(gpuMemoryBudget(64).maxBufferMb).toBeLessThanOrEqual(1024);
  });
});

describe("BROWSER_GPU_MATRIX", () => {
  it("documents at least one stable engine and a no-WebGPU fallback row", () => {
    expect(BROWSER_GPU_MATRIX.some((r) => r.webgpu === "stable")).toBe(true);
    expect(BROWSER_GPU_MATRIX.some((r) => r.webgpu === "none")).toBe(true);
  });
});
