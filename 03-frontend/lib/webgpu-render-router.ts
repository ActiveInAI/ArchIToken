// lib/webgpu-render-router.ts
// License: Apache-2.0
//
// Frontend RenderRouter — WebGPU-first rendering strategy (issue #7).
//
// This is the single source of truth for *which* rendering backend the BIM /
// digital-twin viewports use and *why*. WebGPU is the primary high-performance
// path; Three.js WebGL is an audited compatibility fallback only — never the
// primary. The backend kinds mirror `04-backend/harness-core/src/render_router.rs`
// (`RenderBackend`) so the frontend and the harness RenderRouter agree on what
// "WebGPU-first" means.
//
// Everything here except `detectGpuCapabilities` is a pure function of an
// explicit `GpuCapabilities` value, so the policy is unit-testable without a
// browser GPU.

/** Rendering backend a viewport can run on (subset mirroring the backend RenderBackend). */
export type RenderBackend =
  | "webgpu" // native WebGPU / Three.js WebGPURenderer — primary path
  | "three_webgl" // Three.js WebGL backend — audited fallback only
  | "unavailable"; // no GPU rendering path on this client

/** A snapshot of the client's GPU rendering capabilities. */
export interface GpuCapabilities {
  /** Whether a browser `window`/`navigator` exists (false during SSR). */
  readonly hasWindow: boolean;
  /** Whether the page is a browser-trusted secure context. */
  readonly isSecureContext: boolean;
  /** Whether the host is localhost/loopback (a secure origin for WebGPU). */
  readonly isLocalhost: boolean;
  /** Whether `navigator.gpu` is exposed. */
  readonly hasNavigatorGpu: boolean;
  /** Whether `navigator.gpu.requestAdapter()` returned a usable adapter. */
  readonly hasGpuAdapter: boolean;
  /** Whether a WebGL2 or WebGL context can be created (fallback capability). */
  readonly hasWebgl: boolean;
  /** Raw user-agent string, used only for human-readable diagnostics. */
  readonly userAgent: string;
}

/** An auditable rendering-route decision. */
export interface RenderRouteDecision {
  /** Selected primary backend. */
  readonly backend: RenderBackend;
  /** Whether the primary path satisfies the WebGPU-first rule. */
  readonly webgpuFirst: boolean;
  /** Ordered fallback chain; WebGL only ever appears here, never as primary. */
  readonly fallbackChain: RenderBackend[];
  /** Human-readable routing rationale (Chinese, surfaced to operators). */
  readonly reason: string;
}

/**
 * Explain, in human terms, why WebGPU is not available given these capabilities.
 * Returns `null` when WebGPU *is* available. Pure — mirrors the runtime checks
 * previously duplicated inside the viewport components.
 */
export function webgpuUnavailableReason(caps: GpuCapabilities): string | null {
  if (!caps.hasWindow) {
    return "当前运行环境没有浏览器 window/navigator。";
  }
  if (!caps.isSecureContext && !caps.isLocalhost) {
    return "当前地址不是浏览器认可的 WebGPU 安全来源；请用 localhost、HTTPS 或将该地址加入安全来源白名单。";
  }
  if (!caps.hasNavigatorGpu) {
    if (/firefox/i.test(caps.userAgent)) {
      return "当前 Firefox 未暴露 navigator.gpu；需要启用 WebGPU 配置或改用 Chromium/Edge 的安全来源。";
    }
    return "当前浏览器未暴露 navigator.gpu。";
  }
  if (!caps.hasGpuAdapter) {
    return "navigator.gpu.requestAdapter() 没有返回可用 GPU adapter。";
  }
  return null;
}

/**
 * Select the rendering backend from a capability snapshot, enforcing the
 * WebGPU-first policy: a usable GPU adapter always wins; WebGL is only a
 * recorded fallback; with neither, rendering is unavailable.
 */
export function selectRenderBackend(
  caps: GpuCapabilities,
): RenderRouteDecision {
  const unavailable = webgpuUnavailableReason(caps);
  if (unavailable === null) {
    return {
      backend: "webgpu",
      webgpuFirst: true,
      fallbackChain: caps.hasWebgl ? ["three_webgl"] : [],
      reason: "WebGPU adapter 可用，主渲染路径使用 WebGPU（Three.js WebGPURenderer / 原生 WGSL）。",
    };
  }
  if (caps.hasWebgl) {
    return {
      backend: "three_webgl",
      webgpuFirst: false,
      fallbackChain: [],
      reason: `${unavailable} 已降级到 Three.js WebGL 兼容视口（审计降级，非主路径）。`,
    };
  }
  return {
    backend: "unavailable",
    webgpuFirst: false,
    fallbackChain: [],
    reason: `${unavailable} 且无法创建 WebGL 上下文，当前客户端无 GPU 渲染路径。`,
  };
}

/** WebGPU support level per browser family. */
export type WebgpuSupportLevel = "stable" | "flag" | "none";

/** One row of the WebGPU browser compatibility matrix. */
export interface BrowserGpuSupport {
  readonly browser: string;
  readonly webgpu: WebgpuSupportLevel;
  readonly notes: string;
}

/**
 * WebGPU browser compatibility matrix. Drives operator messaging and the
 * fallback policy; kept here so it lives next to the routing logic it informs.
 */
export const BROWSER_GPU_MATRIX: readonly BrowserGpuSupport[] = [
  { browser: "Chrome / Edge ≥ 113", webgpu: "stable", notes: "默认启用；需安全来源（HTTPS/localhost）。" },
  { browser: "Firefox ≥ 141", webgpu: "stable", notes: "较旧版本需 about:config dom.webgpu.enabled。" },
  { browser: "Safari ≥ 18", webgpu: "stable", notes: "macOS/iOS 逐步默认启用。" },
  { browser: "其他 / 旧版浏览器", webgpu: "none", notes: "无 navigator.gpu，降级 Three.js WebGL。" },
];

/** A GPU memory budget for large-BIM streaming. */
export interface GpuMemoryBudget {
  /** Soft cap for a single GPU buffer upload (MiB). */
  readonly maxBufferMb: number;
  /** Streaming tile/chunk size for progressive large-scene loading (MiB). */
  readonly streamingChunkMb: number;
  /** Human-readable budget policy. */
  readonly policy: string;
}

/**
 * Derive a GPU memory budget from the client's reported device memory.
 * Conservative by design: large BIM models stream in chunks instead of a single
 * upload so a unified-memory client is never driven OOM.
 */
export function gpuMemoryBudget(deviceMemoryGb?: number): GpuMemoryBudget {
  // navigator.deviceMemory is coarse (0.25–8) and may be undefined; assume a
  // modest 4 GiB when unknown.
  const memGb = deviceMemoryGb && deviceMemoryGb > 0 ? deviceMemoryGb : 4;
  const maxBufferMb = Math.max(64, Math.min(1024, Math.round(memGb * 96)));
  const streamingChunkMb = Math.max(16, Math.round(maxBufferMb / 8));
  return {
    maxBufferMb,
    streamingChunkMb,
    policy:
      "大型 BIM 模型按 streamingChunkMb 分块流式上传，单缓冲不超过 maxBufferMb，避免统一内存设备 OOM。",
  };
}

/**
 * Probe the live browser for GPU capabilities. The only impure function here;
 * everything else consumes the returned snapshot. Safe to call during SSR
 * (returns a no-window snapshot).
 */
export async function detectGpuCapabilities(): Promise<GpuCapabilities> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      hasWindow: false,
      isSecureContext: false,
      isLocalhost: false,
      hasNavigatorGpu: false,
      hasGpuAdapter: false,
      hasWebgl: false,
      userAgent: "",
    };
  }

  const host = window.location.hostname;
  const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  const gpu = (
    navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown> };
    }
  ).gpu;

  let hasGpuAdapter = false;
  if (gpu && window.isSecureContext) {
    try {
      hasGpuAdapter = (await gpu.requestAdapter()) !== null;
    } catch {
      hasGpuAdapter = false;
    }
  }

  let hasWebgl = false;
  try {
    const canvas = document.createElement("canvas");
    hasWebgl =
      canvas.getContext("webgl2") !== null ||
      canvas.getContext("webgl") !== null;
  } catch {
    hasWebgl = false;
  }

  return {
    hasWindow: true,
    isSecureContext: window.isSecureContext,
    isLocalhost,
    hasNavigatorGpu: Boolean(gpu),
    hasGpuAdapter,
    hasWebgl,
    userAgent: navigator.userAgent,
  };
}
