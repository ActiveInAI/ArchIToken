# Phase 7 Vite Open AEC Workbench

Phase 7 introduces `03-frontend-vite` as the main Open AEC Universal Runtime workbench shell. The existing `03-frontend` Next application remains in the repository as a legacy transition surface and is not deleted by this phase.

## Scope

- Runtime shell: Vite 8, React 19, TypeScript, TanStack Router, TanStack Query, Zustand, Tailwind CSS-ready styling, and Radix UI tabs.
- Viewer/runtime stack posture: React Three Fiber, Three.js/WebGPU, CesiumJS, MapLibre GL JS, and 3d-tiles-renderer are declared as Phase 7 frontend runtime dependencies.
- Pages: `/assets`, `/ai`, `/openbim`, `/cad`, `/gis`, `/documents`, `/gantt`, `/flow`, `/runtime`, and `/admin`.
- Components: `AssetLibrary`, `AssetUploader`, `ConversionJobPanel`, `OpenBimWorkbench`, `CadWorkbench`, `GisRealityWorkbench`, `DocumentWorkbench`, `AiCommandCenter`, `RuntimeExecutionTrace`, and `ViewerCommandPanel`.

## Runtime Boundary

The shell preserves Phase 6 assumptions: all backend calls must carry RuntimeContext headers, remain subject to RBAC, and stay tenant/project isolated. `VITE_ARCHITOKEN_API_BASE_URL` controls the backend base URL, with `http://localhost:8080` as the development fallback.

AI actions are shown as draft commands first. They are not allowed to mutate assets directly; backend approval and audit contracts decide execution.

## Run

```bash
cd 03-frontend-vite
bun install
bun run dev
```

Open `http://localhost:5177/assets`.

## Policy

The workbench does not import proprietary viewer loaders, proprietary WASM blobs, closed-source EXE tools, or DWG implementations into the production core. DWG remains a legal adapter boundary only.
