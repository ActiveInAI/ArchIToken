# WebGPU-first BIM / digital-twin rendering (issue #7)

ArchIToken renders BIM and digital-twin scenes **WebGPU-first**: WebGPU is the
primary high-performance path, and Three.js WebGL is an audited compatibility
fallback only — never the primary. This document is the architecture of record;
the executable policy lives in
[`03-frontend/lib/webgpu-render-router.ts`](../03-frontend/lib/webgpu-render-router.ts)
and is unit-tested in `webgpu-render-router.test.ts`.

## 1. Backend ↔ frontend RenderRouter contract

The frontend `RenderBackend` kinds mirror the harness RenderRouter in
[`04-backend/harness-core/src/render_router.rs`](../04-backend/harness-core/src/render_router.rs)
so both sides agree on what "WebGPU-first" means. The backend RenderRouter
decides the backend per artifact format/target; the frontend RenderRouter
resolves the concrete client path from live GPU capabilities. Both treat WebGL
strictly as a recorded fallback.

| Layer | Module | Responsibility |
|---|---|---|
| Harness (Rust) | `render_router.rs` `RenderRouter` | per-format/target backend + fallback chain, WebGPU-first invariant |
| Frontend (TS) | `lib/webgpu-render-router.ts` | capability detection → client backend selection |

## 2. Capability detection

`detectGpuCapabilities()` probes the live browser into a `GpuCapabilities`
snapshot: secure context, localhost, `navigator.gpu`, a real
`requestAdapter()` adapter, and WebGL availability. It is SSR-safe (returns a
no-window snapshot). Every other function is a **pure** function of that
snapshot, so the routing policy is testable without a GPU.

## 3. Renderer selection policy

`selectRenderBackend(caps)` enforces the WebGPU-first rule:

1. A usable GPU adapter → `webgpu` (native WGSL or Three.js `WebGPURenderer`), `webgpuFirst = true`.
2. No adapter but WebGL present → `three_webgl` fallback, `webgpuFirst = false` (audited downgrade).
3. Neither → `unavailable` (never a fake render).

`webgpuUnavailableReason(caps)` returns the operator-facing Chinese diagnostic
(insecure origin, missing `navigator.gpu`, Firefox hint, no adapter).

Consumers:
[`components/DigitalTwinWebGPUViewport.tsx`](../03-frontend/components/DigitalTwinWebGPUViewport.tsx)
(native WGSL primary viewport) and
[`components/OpenEngineeringEditor.tsx`](../03-frontend/components/OpenEngineeringEditor.tsx)
(`useModelGraphicsRuntime`, Three.js WebGPURenderer with WebGL fallback).

## 4. Three.js fallback policy

Three.js is the ecosystem/compatibility layer over WebGPU, and its WebGL
backend is the only fallback. WebGL never appears as a primary backend while
WebGPU is available; downgrades are recorded in the decision `reason` and on the
viewport `data-architoken-renderer` attribute for audit.

## 5. GPU memory budget (large BIM)

`gpuMemoryBudget(deviceMemoryGb?)` derives a conservative budget from
`navigator.deviceMemory`: a per-buffer soft cap (clamped to 64–1024 MiB) and a
streaming chunk size. Large BIM models stream in chunks rather than a single
upload so unified-memory clients (e.g. DGX Spark) are never driven OOM — this
mirrors the backend OOM-guard posture for the same hardware.

## 6. WASM geometry worker plan

IFC/CAD geometry is produced by WASM kernels (`web-ifc`, `@ifc-lite/geometry`,
`occt-import-js`, `rhino3dm`) under `03-frontend/public/wasm/`. The plan is to
move heavy tessellation off the main thread into a dedicated geometry worker
that hands GPU-ready buffers to the WebGPU path, keeping the render thread free.
Until then geometry derivation runs in the `lib/*-derivative-server.ts` adapters.

## 7. Large-BIM streaming viewer plan

Large scenes stream as 3D Tiles / chunked geometry sized by the GPU memory
budget, progressively uploaded to the WebGPU device. The backend RenderRouter
already routes `stream` targets to `Tiles3d`; the frontend consumes those tiles
under the same WebGPU-first selection.

## 8. Browser compatibility matrix

`BROWSER_GPU_MATRIX` in `lib/webgpu-render-router.ts` is the source of truth:

| Browser | WebGPU | Notes |
|---|---|---|
| Chrome / Edge ≥ 113 | stable | default on; requires a secure origin (HTTPS/localhost) |
| Firefox ≥ 141 | stable | older versions need `dom.webgpu.enabled` |
| Safari ≥ 18 | stable | macOS/iOS rolling out by default |
| other / legacy | none | no `navigator.gpu`; downgrades to Three.js WebGL |
