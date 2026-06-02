# ArchIToken Tech Stack

**Status**: active technical stack baseline
**Principle**: high performance, high concurrency, high efficiency, source-first openness, extensibility and maintainability
**Project**: ArchIToken
**Positioning**: AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS

---

## 1. Selection Principles

ArchIToken does not use technology as belief. Every language, database, model, renderer and framework must serve business goals.

| Principle              | Meaning                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High performance       | Hot paths use Rust, Cxx, C++, WASM, WebGPU-first rendering/compute and platform GPU backends where justified                                                            |
| High concurrency       | Backend services must support async, bounded resources and backpressure                                                                                                 |
| High efficiency        | Use mature ecosystems when they reduce delivery risk                                                                                                                    |
| Source-first openness  | No default restriction on protocol, vendor, package manager, source build, runtime shape, local model runtime or deployment mode when capability is production-relevant |
| Extensible             | Registry replaces Enum; adapters replace direct vendor binding                                                                                                          |
| Open CDE / Workflow OS | UI and APIs organize files, lifecycle, approvals, evidence, audit and module transactions before visual decoration                                                      |
| Maintainable           | Strong types, schema contracts, tests, CI and docs truth                                                                                                                |
| Auditable              | File, lifecycle, approval, model and tool actions produce audit evidence                                                                                                |
| Private deployable     | k8s + Docker + local private deployment must work without external SaaS as a hard dependency                                                                            |

---

## 2. Frontend Stack

| Layer                  | Choice                                       | Role                                                                                               |
| ---------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| App framework          | Next.js `16.2.6`                             | App router, pages, workbench shell, build pipeline                                                 |
| UI runtime             | React `19.2.5`                               | Component state, interaction, workbench composition                                                |
| Language               | TypeScript `6.0.3`                           | Typed contracts, registry fixtures, adapter interfaces                                             |
| Package/runtime        | Bun                                          | Dev server, scripts, tests and package management                                                  |
| Rendering core         | WebGPU                                       | Primary path for BIM/CAD/digital twin/image/video high-performance viewport and browser compute    |
| Compatibility renderer | Three.js WebGPU/audited fallback layer       | Scene/loader ecosystem, WebGPU carrier and explicitly recorded failure-recovery path               |
| Compute/parser bridge  | WASM                                         | Client-side geometry preprocessing and file parsing where useful                                   |
| UI components          | Ant Design ecosystem + React + tokenized CSS | `antd`, icons, ProComponents, Charts, Ant Design X and `ConfigProvider` are the global UI baseline |
| Testing                | Vitest, Playwright, ESLint, TypeScript       | Unit, E2E, lint and type safety                                                                    |

Current frontend packages include `antd@5.29.3`, `@ant-design/icons`, `@ant-design/pro-components`, `@ant-design/charts`, `@ant-design/x@1.6.1`, `antd-style@3.7.1`, `@ant-design/static-style-extract@1.0.3`, `monaco-editor@0.55.1`, `three@0.184.0`, `@react-three/fiber`, `@react-three/drei`, `vitest`, `playwright`, `eslint` and `tailwindcss@4.3.0`.

PanCode code editing route:

- PanCode is the fixed reusable code programming file runtime. Its canonical standalone repository is `https://github.com/ActiveInAI/PanCode`; ArchIToken consumes the same route in the unified CDE file workbench.
- Local CDE-bound code/config/text files use `monaco-editor@0.55.1` as the inline editor with the VS Code default dark workbench surface. Save-back remains `/api/local-files/{fileId}` so ArchIToken owns version, checksum and audit state.
- `code-server@4.121.0` is the selected Collabora-style sidecar for full browser IDE sessions. It must run as an isolated service such as `codercom/code-server:4.121.0`; direct source-file mounting is not accepted as CDE save-back evidence. The `architoken.code_native_session.v1` route materializes a session workspace and commits edits back through CDE APIs.
- `tree-sitter v0.26.9` is the selected source-build parser route for syntax trees, code search and worker-side diagnostics. It complements Monaco and LSP; it never replaces the CDE source file.
- HTML/HTM defaults to visual preview with source switching. Other registered code/config/text files default to edit mode.

Design-system rule:

| Layer               | Contract                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme registry      | `03-frontend/lib/theme-registry.ts` defines `huly_light`, `huly_dark` and `huly_system`; legacy `wechat_light` and `industrial_dark` values are migrated at read time     |
| Font registry       | `03-frontend/lib/font-registry.ts` defines Huly-size options `huly_spacious` and `huly_compact`                                                                           |
| Ant Design registry | `03-frontend/lib/design-system-registry.ts` defines the selected Ant Design runtime/reference packages and future development rules                                       |
| Provider            | `ThemeProvider` writes `data-theme`, persists `architoken_theme` in `localStorage`, and routes Ant Design through `ConfigProvider` + Chinese locale                       |
| Default theme       | `huly_light`, used by Shell, navigation, toolbar, file system, drawers, approvals, lifecycle and AI assistant                                                             |
| Optional themes     | `huly_dark` and `huly_system` are platform-level modes; `huly_spacious` and `huly_compact` manage font size without per-module overrides                                  |
| Digital twin        | `/app/modules/digital_twin` uses the same CDE file workbench as every module; standalone `/app/digital-twin` is retired so the product has one synchronized module entry  |
| Styling contract    | Ant Design tokens are the first-class UI contract; `--arch-*` CSS variables bridge Huly shell, engineering viewers and legacy surfaces                                    |
| Color contract      | Module navigation and process signals use a Material/Google-inspired multi-accent palette instead of a single blue-only scheme; color is supplemental to icons and labels |
| Reference doc       | `docs/FRONTEND_ANT_DESIGN_STANDARD.md` is the active frontend design-system contract                                                                                      |

Ant Design adoption rule:

- New UI must use Ant Design components, ProComponents, Ant Design Charts, Ant Design X, Ant Design icons, or tokenized Ant Design wrappers before custom controls.
- Ant Design Pro is a reference, not a replacement shell; ArchIToken keeps the Open CDE module workbench and 14-module registry.
- Ant Design 5 is the current production baseline because ProComponents and Ant Design X v1 share that peer contract. Ant Design 6 requires a coordinated package migration and CI validation before activation.
- Custom CSS is allowed for viewer canvases, transparent dock rails, BIM/CAD overlays and low-level responsive constraints, but it must inherit Ant Design/ArchIToken tokens.

Diagram and whiteboard integration rule:

- `https://github.com/DayuanJiang/next-ai-draw-io` is an AI-assisted draw.io candidate behind an isolated diagram adapter or clean-room command contract.
- `https://github.com/plait-board/drawnix` is a Plait-based whiteboard/mindmap/flowchart candidate behind module files, schema validation and approval state.
- Generated `.drawio`, `.drawnix`, Mermaid, SVG, PNG and JSON artifacts must be persisted as module files before downstream modules consume them.

Floorplan Generate / Fit / Furnish rule:

- `03-frontend/lib/architoken/floorplan-layout.ts` is the current shared frontend kernel for concept-design and detailed-design residential / hotel-unit floorplan candidates.
- `06-workers/architoken_workers/floorplan_worker.py` is the backend worker adapter for the same Generate / Fit / Furnish manifest contract.
- The kernel emits `architoken.floorplan_candidate_manifest.v1` and `architoken.floorplan_evaluation_report.v1` evidence with `professional_review_required`.
- Future backend solvers may replace the deterministic frontend generator, but they must preserve the same manifest, evaluator, rule-check, schema-validation and approval boundary.
- Reference: [`FLOORPLAN_GENERATE_FIT_FURNISH_KERNEL.md`](./FLOORPLAN_GENERATE_FIT_FURNISH_KERNEL.md).

Rendering rule:

```text
Next.js + React + TypeScript = application workbench
GPU-first = default execution strategy for render, geometry, AI kernels, image/video editing and heavy derivatives
WebGPU + WASM = primary browser rendering and compute core
CUDA / OptiX / TensorRT / ROCm / DirectX 12 / Metal / Vulkan / Triton = platform-native GPU acceleration
Three.js = WebGPU carrier, ecosystem and audited fallback layer
WebGL = audited failure-recovery path, not the default core
CPU = evidenced failure-recovery path, not the default hot path
```

WebGPU-first rule:

- GPU-first is mandatory when the target device, browser, driver, runtime or cluster node exposes a usable GPU. CPU-only routes are fallback paths and must record why GPU was unavailable.
- CAD, BIM, IFC, STEP/STP, IGES/IGS, STL, 3DM, SKP, PDF graphics, image/video AI editing and digital twin viewports must select WebGPU first for browser interaction.
- Browser clients, designer workstations, demos, private-deployment images and managed endpoints must enable WebGPU and WebGL hardware acceleration. Profiles, launch flags, container policies, remote desktop policies and security baselines must not default to disabling WebGPU, WebGL, hardware acceleration or the GPU process.
- WebGL is only allowed when WebGPU is unavailable, when a third-party legacy dependency has no WebGPU path, or for thumbnails / audited failure recovery. This condition must be explicit in the adapter manifest.
- Three.js is allowed and expected as a WebGPU scene/loader ecosystem layer; it must not force WebGL as the only production renderer.
- WebGPU shader/workgroup limits, device features and adapter info must be captured in viewer diagnostics so GPU bugs are traceable.
- NVIDIA targets must use NVIDIA certified/supported software paths: NGC CUDA or CUDA Deep Learning signed images, NVIDIA Container Toolkit, GPU Operator/device plugin, DCGM, CUDA, OptiX, TensorRT/TensorRT-LLM and Triton as registered capabilities. Mesa, CPU-only, WebGL-only, screenshots, empty canvases or frontend-derived artifacts cannot be used to claim GPU rendering success.
- Geometry kernels, source-file derivatives, AI image/video generation, inference kernels, transcode jobs and bulk previews must prefer CUDA/OptiX/TensorRT/ROCm/DirectX 12/Metal/Vulkan/Triton when matching hardware exists; WASM/CPU is the audited fallback route.

---

## 3. Backend Stack

| Layer                  | Choice                                                          | Role                                                                       |
| ---------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Core services          | Rust first                                                      | Harness core, Router, state guards, schema gates, high-concurrency APIs    |
| FFI bridge             | Cxx                                                             | Rust/C++ interop for geometry and CAD/BIM hot paths                        |
| Geometry kernels       | Rust/C++/Cxx/WASM                                               | IFC, STEP, DWG/DXF, OCCT/CGAL-style geometry workflows                     |
| Tooling languages      | Python, Go, Perl, Shell                                         | AI ecosystem adapters, CLI tools, infra glue, text processing where useful |
| Performance extensions | CUDA, ROCm/HIP, DirectX 12, Metal, Vulkan, Triton, C++/Rust FFI | Platform GPU acceleration when WebGPU/WASM or CPU workers are not enough   |

Rust/Cxx is the preferred core, but Python/Go/C++/Perl are allowed when the module adapter, maintenance owner and contract are explicit.

### 3.1 Backend-Native File Runtime

复杂工程格式必须优先走后端原生/open runtime、授权适配器或外部进程 sidecar,而不是前端截图、空 Canvas、伪重绘或不可追溯派生。

统一优先级:

```text
source bytes / entity graph / vector / B-Rep / properties
-> lightweight native cache manifest
-> OpenUSD / USDZ / 3D Tiles
-> glTF / GLB fallback only when audited
-> explicit failure
```

| Format family                            | Primary route                                                                                                                                                                                                                                                          | Cache / derivative contract                                                                                                                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IFC                                      | IfcOpenShell / ThatOpen fragments worker with source IFC as record                                                                                                                                                                                                     | First upload emits property index and lightweight native manifests; OpenUSD/USDZ, 3D Tiles, GLB fallback, fragments and tiles are cache candidates, not replacement records                                      |
| DWG                                      | MLightCAD `@mlightcad/cad-simple-viewer` browser runtime with `@mlightcad/libredwg-web` GPL-3.0 WASM boundary                                                                                                                                                          | Source DWG remains record; browser entity/vector route is required; ODA/LibreDWG/LibreCAD sidecars are explicit diagnostics/export only; raster or watermark preview is not production success                   |
| DXF                                      | MLightCAD `@mlightcad/cad-simple-viewer` browser runtime with data-model DXF worker                                                                                                                                                                                    | Preserve model/layout/layer/entity semantics, line weight, color, text, blocks and dimensions before any PDF/image fallback                                                                                      |
| STEP/STP/IGES/IGS/BREP                   | OCCT/OCP/FreeCAD-compatible B-Rep worker route                                                                                                                                                                                                                         | Preserve B-Rep/topology/properties first; tessellated mesh is a lightweight display cache only                                                                                                                   |
| 3DM/Rhino/Grasshopper                    | rhino3dm/OpenNURBS worker plus licensed Rhino/Grasshopper sidecar when required                                                                                                                                                                                        | Preserve NURBS, layers, materials, object attributes and source ids; IFC/STEP/OpenUSD/glTF fallback exports are generated artifacts                                                                              |
| SKP/SketchUp                             | Licensed SketchUp Ruby sidecar first: `Sketchup::Model#export` for IFC/GLB where supported, BIM-Tools SketchUp IFC Manager as isolated GPL sidecar for IFC, Yulio glTF exporter as MIT sidecar plugin for GLB, and Speckle SketchUp Connector as licensed-gated bridge | Preserve scene hierarchy, materials, components, units, coordinates and object ids; IFC is the openBIM exchange derivative, GLB is only a source-bound browser runtime derivative; see `SKETCHUP_SKP_SIDECAR.md` |
| STL/PLY/DAE/glTF/GLB/BLEND               | Mesh/source-native worker / Three.js audited recovery runtime / Blender isolated service / CGAL mesh worker                                                                                                                                                            | Mesh bounds, camera fit, material/color preservation, metadata and source binding; OBJ/FBX are abandoned legacy inputs and not default targets                                                                   |
| PDF/3D PDF/Office/XML/3DXML/code/archive | Format-specific backend parser or source-preserving web viewer                                                                                                                                                                                                         | Vector/source view first, stream source bytes with ETag/Range/cache and attach tool-specific manifest                                                                                                            |

CAD/BIM browser editing surface:

- `OpenEngineeringEditor` is the unified engineering file workbench inside the Open CDE module viewer. It uses a FreeCAD/Blender-style professional layout for engineering formats: compact top toolbars, source/object tree, source-bound viewport, property editor, and status bar.
- DWG/DXF trees come from MLightCAD source runtime tables where available, IFC trees come from source element/type/property indexes, and mesh/B-Rep/scene formats expose the Three/OCCT/worker scene hierarchy. Fallback trees must explicitly say adapter/worker evidence is pending.
- Browser property edits are draft state until a format adapter, worker, sidecar, licensed adapter, schema validation, audit, and Approver transaction writes a new CDE version. The browser must not silently overwrite DWG, RVT, SKP, 3DM, IFC or B-Rep sources.
- Native FreeCAD / Blender operation is an embedded workbench route, not a local desktop popup. `/api/local-files/{fileId}/native-open` materializes a checksum-bound session workspace copy and launches the registered `engineering-native-workbench` sidecar. The viewer embeds that sidecar through noVNC/Web UI inside `OpenEngineeringEditor`. Save-back uses `POST /api/local-files/{fileId}/native-open/commit` to import the saved workspace bytes as a new CDE version with checksum, tags, audit and approval gating.

Blender integration includes the full add-on / extension runtime, but only through the isolated `blender_plugin` and `blender_plugin_run` worker boundary. Every `.py`, `.zip` or source-directory plugin package must produce `architoken.blender_plugin_audit.v1` before execution; approved executions run in job-scoped `BLENDER_USER_*` directories and produce `architoken.blender_plugin_run.v1` plus real scene derivatives. See [`BLENDER_PLUGIN_SYSTEM_INTEGRATION.md`](./BLENDER_PLUGIN_SYSTEM_INTEGRATION.md).

Streaming rule:

- Source bytes are served through stream APIs with `ETag`, `Last-Modified`, `Range` and cache headers.
- Workers must avoid repeated full-file parsing when a checksum-matched derivative exists.
- Large IFC/CAD/mesh properties must be paginated or indexed; frontends must not load a full IFC property graph into memory for every open.
- Derivative manifests must identify source file id, checksum, generator, command route, output artifacts, cache policy and legal adapter boundary.

Source-build rule:

- Source builds are executed through `06-workers/architoken_workers/source_build.py` / `architoken-source-build`; ad-hoc terminal builds are not accepted as production evidence unless their commands are copied into the manifest.
- Required manifest coverage: CPython 3.13, sse2neon, OpenColorIO, WebGPU runtime smoke, NVIDIA CUDA workstation smoke, Intel oneAPI/Level Zero SYCL smoke, Intel LLVM DPC++/SYCL source toolchain, AMD ROCm/HIP smoke, DirectX 12 smoke, Metal smoke, Vulkan smoke, Triton kernel smoke, Blender, Bonsai, IfcOpenShell, OCCT/OpenCascade current and compatibility builds, LibreDWG, FreeCAD, rhino3dm, OpenNURBS, CGAL, CGAL SWIG, buildingSMART standards source sync, Open-Cascade-SAS/CGAL/Speckle/Impertio-Studio organization source sync, ForgeCAD, IFCDB-Agent, Cesium, Speckle .NET SDK and Trimble/Tekla licensed SDK source hook.
- CGAL core is `https://github.com/CGAL/cgal`; CGAL SWIG is only an optional binding layer and never replaces core CGAL build evidence.
- If Ubuntu/apt/snap packages are missing, stale or unable to satisfy a production adapter, build from the upstream GitHub source repository.
- Source builds are the preferred route for missing or weak CAD/BIM/PDF/AI adapters, not a last-resort workaround.
- WebGPU is the default browser rendering/compute route. WebGL is a recorded fallback only, never the default core for CAD/BIM/digital twin/image/video editing.
- NVIDIA CUDA/OptiX/TensorRT/Triton, Intel oneAPI/Level Zero, AMD ROCm/HIP, Windows DirectX 12, Apple Metal and Vulkan are first-class platform acceleration routes. NVIDIA evidence requires NGC signed image tag or digest, NVIDIA Container Toolkit/GPU Operator/device-plugin visibility, `nvidia-smi`, `nvcc` CUDA kernel smoke and render/inference runtime smoke on a visible `/dev/nvidia*` device; missing devices must be failed evidence, not a compatibility bypass. Intel oneAPI evidence specifically requires `icpx` or `dpcpp` to compile and run a real SYCL kernel through `architoken-source-build build intel-oneapi-toolchain`; when binary packages are unavailable on ARM64, `architoken-source-build build intel-llvm-oneapi` must build `https://github.com/intel/llvm.git` with `--host-target AArch64;ARM;X86` and `--native_cpu`. Evidence requires real platform build/smoke on the target runtime; inaccessible devices or unavailable OS APIs must be recorded as failed GPU evidence, not hidden behind version checks.
- CPU-only execution for render, geometry, AI image/video, inference kernels, transcode or heavy derivative generation is allowed only when GPU evidence says unavailable/unsupported/failed, or when the workload is too small to justify GPU dispatch overhead.
- Architecture coverage must include ARM64 and x86_64; vendor coverage must include NVIDIA, AMD, Intel and Apple where hardware/OS runners exist. Missing hardware produces failed evidence and follow-up work, not fake completion.
- Blender main on Linux must use source-built CPython 3.13 through `ARCHITOKEN_PYTHON313_PREFIX` when the distro only provides Python 3.12.
- Blender Linux arm64 must use source-synced sse2neon through `SSE2NEON_INCLUDE_DIR` when distro packages do not provide it.
- Blender must use source-built OpenColorIO through `OPENCOLORIO_DIR` when distro CMake targets are invalid.
- Runtime binding language is not a production blocker by itself: if Python bindings fail, a real C++/CLI/Rust/Go/WASM/sidecar route must still be wired and evidenced while the binding is repaired separately.
- Heavy CMake/Make/NPM/.NET/Emscripten builds must resume existing build directories by default; cleaning a build directory is an explicit recovery action, not normal CLI behavior.
- Native/vector routes must be attempted and recorded before lightweight mesh/cache routes; screenshot, raster, or decorative redraw is a failure unless explicitly selected for a thumbnail.
- Source builds must be reproducible: record repository URL, commit/tag, build flags, install prefix and smoke evidence.
- Current-kernel and compatibility-kernel builds can coexist. If OCCT 8+ breaks a required adapter such as IfcOpenShell or FreeCAD, a pinned OCCT 7.9.1 build is required and must be recorded separately instead of downgrading the whole platform silently.
- GPL/AGPL/LGPL/SSPL/BUSL/copyleft or proprietary adapter code stays outside the distributed core as an external process, container, CLI, HTTP service or IPC sidecar unless legal review explicitly approves another distribution model. Foundational copyleft capabilities such as document editing, PDF rendering/editing, CAD/BIM geometry, GIS/QGIS, ERP/CDE, workflow automation and AI generation must be isolated callable adapters, not reference-only demotions.
- User-supplied GitHub links are not optional notes: each link must be recorded in `docs/ADAPTER_SOURCE_MAP.md`, classified, and either selected, isolated, licensed-gated, or explicitly blocked with a reason.
- Current DXF/DWG source viewer baseline is MLightCAD from `https://github.com/mlightcad/cad-viewer`, wired as `@mlightcad/cad-simple-viewer`. The installed npm version is `1.4.13` because the checked upstream `1.5.1` package depends on an unpublished `@mlightcad/cad-html-exporter`; upgrade only after the upstream npm graph is installable. DWG support depends on `@mlightcad/libredwg-web` / `https://github.com/mlightcad/libredwg-web` (GPL-3.0), recorded as a browser/WASM license boundary.
- Current optional DWG conversion/export sidecar baseline remains LibreDWG built from `https://github.com/LibreDWG/libredwg` with `./autogen.sh`, `./configure --disable-bindings --disable-docs --disable-shared`, `make`, and a sidecar install prefix such as `/tmp/architoken-libredwg`. Runtime discovery checks `ARCHITOKEN_LIBREDWG_BIN`, `LIBREDWG_BIN_DIR`, `/tmp/architoken-libredwg/bin`, system paths and `PATH`; this path is no longer the default DXF/DWG viewer.
- Source-build runbook: [`SOURCE_BUILD_ADAPTERS.md`](./SOURCE_BUILD_ADAPTERS.md).

Current CAD/BIM reference set:

Impertio-Studio repositories whose names include `Claude` are upstream names only. ArchIToken consumes them as GPT / Codex-compatible source and skill inputs; they do not change the active assistant identity or repository instruction source.

Current AI / source / dataset reference set:

- `https://github.com/openai/symphony` is an Apache-2.0 orchestration source-sync candidate behind WorkflowRouter, ToolRouter, Approver and audit. It does not replace ArchIToken governance or module approvals.
- `https://github.com/openai` is a selected organization-level source inventory for SDK/API, agent, eval, safety-policy, media and ML utility adapters. Concrete repositories must be classified before runtime use; direct provider calls in business logic remain forbidden.
- `https://huggingface.co/datasets/opencsg/CIMD` is a licensed-gated document-intelligence dataset source. Metadata and license files can be synced for governance, but corpus ingestion, vector indexes, RAG, training, fine-tuning, hosted API use and redistribution require DataRouter / KnowledgeRouter evidence first.

- `https://ezdxf.readthedocs.io/en/stable/addons/odafc.html`
- `https://github.com/mlightcad/cad-viewer`
- `https://github.com/mlightcad/libredwg-web`
- `https://github.com/LibreDWG/libredwg`
- `https://github.com/oddworldng/dwg_to_dxf`
- `https://github.com/FreeCAD/FreeCAD`
- `https://github.com/FreeCAD/FreeCAD/releases/tag/1.1.1`
- `https://github.com/FreeCAD/FreeCAD/blob/main/src/Mod/Draft/importDWG.py`
- `https://github.com/datadrivenconstruction/ddc-dwgconverter`
- `https://github.com/datadrivenconstruction`
- `https://github.com/datadrivenconstruction/cad2data-Revit-IFC-DWG-DGN`
- `https://github.com/datadrivenconstruction/OpenConstructionERP`
- `https://github.com/datadrivenconstruction/OpenConstructionEstimate-DDC-CWICR`
- `https://github.com/datadrivenconstruction/DDC_Skills_for_AI_Agents_in_Construction`
- `https://github.com/datadrivenconstruction/Project-management-n8n-with-task-management-and-photo-reports`
- `https://github.com/datadrivenconstruction/CAD-BIM-to-Code-Automation-Pipeline-DDC-Workflow-with-LLM-ChatGPT`
- `https://github.com/Impertio-Studio`
- `https://github.com/orgs/Impertio-Studio/repositories?type=all`
- `https://github.com/Impertio-Studio/IFC-Claude-Skill-Package`
- `https://github.com/Impertio-Studio/Blender-Bonsai-ifcOpenshell-Sverchok-Claude-Skill-Package`
- `https://github.com/Impertio-Studio/ThatOpen-Claude-Skill-Package`
- `https://github.com/Impertio-Studio/Three.js-Claude-Skill-Package`
- `https://github.com/Impertio-Studio/Speckle-Claude-Skill-Package`
- `https://github.com/Impertio-Studio/QGIS-Claude-Skill-Package`
- `https://github.com/Impertio-Studio/CesiumJS-Claude-Skill-Package`
- `https://github.com/Impertio-Studio/WebGPU-Claude-Skill-Package`
- `https://github.com/Impertio-Studio/pdfium-render-Claude-Skill-Package`
- `https://github.com/Impertio-Studio/Open-PDF-Studio-Claude-Skill-Package`
- `https://github.com/Autodesk/revit-ifc`
- `https://github.com/pyrevitlabs/pyRevit/releases/tag/v6.4.0.26100%2B0515`
- `https://github.com/bvn-architecture/RevitBatchProcessor`
- `https://github.com/KoStard/ForgeCAD`
- `https://github.com/pascalorg/editor`
- `https://github.com/zalo/CascadeStudio`
- `https://github.com/lemony-ai/cascadeflow`
- `https://github.com/Open-Cascade-SAS/OCCT`
- `https://github.com/Open-Cascade-SAS/OCCT-Components`
- `https://occt3d.com/components/`
- `https://github.com/IfcOpenShell/IfcOpenShell`
- `https://github.com/IfcOpenShell/IfcOpenShell/tree/v0.8.5/src/bonsai`
- `https://github.com/buildingSMART`
- `https://github.com/blender/blender`
- `https://github.com/mcneel/rhino3dm`
- `https://github.com/mcneel/opennurbs`
- `https://github.com/CGAL/cgal`
- `https://github.com/CGAL/cgal-swig-bindings`
- `https://github.com/ThatOpen/engine_web-ifc`
- `https://github.com/ThatOpen/web-ifc-viewer`
- `https://github.com/ThatOpen/web-ifc-three`
- `https://github.com/buildingSMART/IFC`
- `https://github.com/microsoft/ifc`
- `https://github.com/louistrue/ifc5cad`
- `https://github.com/louistrue/ifcLiteViewer`
- `https://github.com/hypar-io/Elements`
- `https://github.com/hcengineering/platform`
- `https://github.com/openclaw/openclaw/releases/tag/v2026.5.18`

---

## 4. AI And Agent Stack

ArchIToken uses a routed AI engineering chain, not model-specific direct calls.

| Component       | Role                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| Agent           | Task actor bound by Harness, Schema and tools                          |
| Planner         | Breaks task into steps and selects inputs/tools                        |
| Generator       | Produces design, model, BOQ, report, workflow item or archive          |
| Evaluator       | Independently reviews generated output                                 |
| RuleChecker     | Runs deterministic business, safety, engineering and legal rules       |
| SchemaValidator | Validates JSON Schema, IFC Schema, Module Schema, OpenAPI and AsyncAPI |
| Approver        | Human or automated release gate                                        |
| ModelRouter     | Model selection, whitelist, cost, SLA, fallback                        |
| InferenceRouter | Local and remote inference execution abstraction                       |
| ToolRouter      | Tool permission, sandbox, execution and audit                          |
| WorkflowRouter  | Module transaction orchestration and DAG execution                     |

Supported adapter direction:

- Local inference: Ollama, LM Studio, Hugging Face local cache / TGI endpoint, local Hugging Face model directories, vLLM, SGLang, TensorRT-LLM, LMDeploy, llama.cpp.
- External adapters: OpenAI-compatible APIs, Hugging Face Inference Endpoints and OpenRouter as provider adapters behind `InferenceRouter`.
- Commercial AI lanes: AI API metering, private model hosting, AEC Agent service packages and non-transferable Token service quota. These are service revenue units, not investment products.
- Observability: Langfuse-compatible traces and OpenTelemetry-style spans.
- Agent frameworks can include LangChain/LangGraph/Hermes/OpenClaw/VoltAgent-style orchestration when they remain behind Router/Registry boundaries.
- OpenClaw is an agent runtime candidate, not a permission bypass; every tool call still flows through ToolRouter, approval state, audit, artifact storage and professional RuleChecker.
- VoltAgent is a TypeScript agent framework candidate, not a frontend shortcut; it must sit behind WorkflowRouter, ToolRouter, ModelRouter, audit and approval gates.
- AI-generated files must be persisted as module files with source prompt, input data ids, model route, adapter route, schema validation result and approver state before downstream modules consume them.

---

## 5. StorageRouter And Data Capabilities

ArchIToken databases are capability layers, not product faith. Supabase, PostgreSQL, Zedis, Redis, Valkey or object stores are adapters and implementation options.

| Capability         | Required Responsibility                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `TransactionStore` | Lifecycle transaction, approval, status, consistency and rollback                                                                          |
| `ObjectStore`      | Large files: IFC, GLB, DWG, PDF, SPZ, E57, images, video and archive packages                                                              |
| `VectorStore`      | Standards, RAG, drawing snippets, semantic search and hybrid retrieval                                                                     |
| `TimeSeriesStore`  | IoT, telemetry, equipment state, sensor and progress time series                                                                           |
| `GraphStore`       | Component graph, knowledge graph, workflow dependency and supply chain relationships                                                       |
| `EventStore`       | Async events, append-only audit, event sourcing and workflow stream                                                                        |
| `CacheStore`       | Session, queue, hot state, locks, token cache and task state                                                                               |
| `AnalyticsStore`   | Progress, cost, risk, production and BI workloads                                                                                          |
| `IdentityStore`    | Gateway-owned Auth/IAM accounts, sessions, verification codes, OAuth identities, QR login challenges, tenant roles and relationship tuples |

Storage selection must document:

- Data shape.
- Access pattern.
- Consistency requirement.
- Tenant isolation.
- Backup and restore.
- Migration and rollback.
- Adapter contract.

Progressive physical split is staged by capability. Business modules must keep
calling StorageRouter capabilities and must not call Qdrant, ClickHouse, NATS or
other storage products directly.

| Phase | Capability Boundary | Default Trunk | External Split Trigger |
| --- | --- | --- | --- |
| 0 | Development preview | Memory adapters | Local-only; never production |
| 1 | Relational, transaction, registry, object and cache | PostgreSQL + S3-compatible object store + Valkey | `DATABASE_URL`, `S3_*`, `ARCHITOKEN_CACHE__URL` configured |
| 2 | `VectorStore` | PostgreSQL `pgvector` | `ARCHITOKEN_VECTOR__URL` or `QDRANT_URL` |
| 3 | `TimeSeriesStore` | PostgreSQL partitioned tables | `ARCHITOKEN_TIMESERIES__URL`, `ARCHITOKEN_TIME_SERIES__URL` or `CLICKHOUSE_URL` |
| 4 | `GraphStore` | PostgreSQL adjacency tables | `ARCHITOKEN_GRAPH__URL` after license/security review |
| 5 | `EventStore` | PostgreSQL outbox/audit tables | `ARCHITOKEN_EVENT__URL` or `NATS_URL` |
| 6 | `AnalyticsStore` | PostgreSQL materialized views/events | `ARCHITOKEN_ANALYTICS__URL` or `CLICKHOUSE_URL` |

`GET /v1/runtime/capabilities` exposes `dataPlane` with the active provider,
fallback provider, split phase and required environment variables for each
capability. The migration
`04-backend/migrations/20260601000002_data_plane_progressive_split.sql`
creates the phase-1 Postgres trunk tables for graph edges, time-series points,
event outbox and analytics events.
The Rust implementation entry is
`04-backend/harness-core/src/data_plane_store.rs`; business modules should use
that capability-shaped API instead of calling storage products directly. The
TimeSeriesStore and AnalyticsStore adapters dual-write to PostgreSQL fallback
and ClickHouse when `ARCHITOKEN_TIMESERIES__URL`,
`ARCHITOKEN_TIME_SERIES__URL`, `ARCHITOKEN_ANALYTICS__URL` or `CLICKHOUSE_URL`
is configured. GraphStore remains on PostgreSQL adjacency tables until a
reviewed external graph sidecar is configured.
The gateway exposes this trunk through `/v1/data-plane/bindings`,
`/v1/data-plane/graph-edges`, `/v1/data-plane/time-series/points`,
`/v1/data-plane/event-outbox` and `/v1/data-plane/analytics-events`.
Frontend callers use `03-frontend/lib/data-plane-api-client.ts` instead of
hardcoding those paths in module components.

Phase-2 vector retrieval has the same boundary shape. `RagEngine` now calls the
`RagVectorStore` contract in `04-backend/harness-core/src/rag.rs`; the default
adapter is `PgVectorRagStore` over PostgreSQL `pgvector`. Future Qdrant or other
vector providers must be added as separate adapters behind that contract, not as
direct calls from business modules or prompt/orchestration code.
`RagVectorStoreConfig::from_env()` keeps `pgvector` as default and selects
`QdrantRagStore` only when `ARCHITOKEN_VECTOR__URL` or `QDRANT_URL` is present.
Optional Qdrant knobs are `ARCHITOKEN_VECTOR__COLLECTION` and
`ARCHITOKEN_VECTOR__API_KEY`; collection creation remains an explicit adapter
operation because production index ownership, backup and migration must be
reviewed before cutover.

---

## 6. Schema System

ArchIToken is a multi-schema system.

| Schema        | Purpose                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| OpenAPI       | REST API contract, SDK generation and UI adapter contract                     |
| AsyncAPI      | Events, queues, workflow notifications and async jobs                         |
| JSON Schema   | Agent input/output, structured data and config validation                     |
| IFC Schema    | BIM semantics, components, property sets and relationships                    |
| Module Schema | Module registration, inputs, outputs, UI metadata, SLA, permissions and audit |

Rule:

```text
module_id + Module Registry + Module Schema
```

replace:

```text
ModuleId + phase + module-registry
```

---

## 7. Deployment Stack

| Area                     | Choice                                                                                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local development        | Docker Compose or equivalent local stack                                                                                                                                                                                                                                                    |
| Service packaging        | Docker images                                                                                                                                                                                                                                                                               |
| Production orchestration | Kubernetes                                                                                                                                                                                                                                                                                  |
| Small private installs   | Docker + local configuration; K3s only for constrained edge cases                                                                                                                                                                                                                           |
| GPU                      | k8s GPU node scheduling, NVIDIA NGC CUDA/CUDA-DL images, NVIDIA Container Toolkit, NVIDIA GPU Operator/device plugin, DCGM, CUDA/OptiX/TensorRT/Triton, AMD ROCm device plugin, Intel GPU/Level Zero, Apple Metal edge workers, WebGPU-capable browser clients and Triton inference workers |
| Config                   | Versioned config, secrets adapter and environment profiles                                                                                                                                                                                                                                  |
| Delivery                 | Helm/Kustomize/GitOps-compatible path                                                                                                                                                                                                                                                       |
| Observability            | OpenTelemetry, metrics, logs, traces and audit streams                                                                                                                                                                                                                                      |
| Rollback                 | Health checks, migration rollback and versioned config                                                                                                                                                                                                                                      |

Private deployment is a product feature. Core operation must not require external SaaS.

---

## 8. Security And Audit

| Control          | Requirement                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| Tenant isolation | Tenant ID, RBAC/ABAC and optional physical isolation                             |
| Permission model | Least privilege for users, modules, tools and files                              |
| Audit            | Append-only events for files, transactions, approvals, tools and model calls     |
| Secrets          | External secrets adapter, rotation and no plaintext secrets in repo              |
| Supply chain     | License checks, SBOM, pinned dependencies and provenance where possible          |
| Model safety     | Prompt injection tests, tool sandbox, schema validation and evaluator separation |
| Data privacy     | PIPL/GDPR-style consent, retention and export policy where applicable            |

---

## 9. CI/CD

CI should be strict and should reveal project drift rather than hide it.

Required gates:

- Rust check, clippy and tests.
- Frontend lint, typecheck, tests and build.
- Python tests and package checks where Python agent is active.
- License and security scans.
- OpenAPI/AsyncAPI/Schema diff checks.
- Docker/k8s build and manifest validation.
- Terminology lint for active `ModuleId`, `phase`, `module-registry`, active `production_manufacturing`, and legacy `manufacturing` / `fabrication` aliases.

Do not weaken gates to pass temporarily. Fix project contracts.

---

## 10. Disabled Or Cautious Items

| Item                                                   | Policy                                                                                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active `ArchIToken` naming                             | Disallowed except historical context                                                                                                                       |
| Active `ModuleId` / `phase` / `module-registry`        | Disallowed in new contracts                                                                                                                                |
| Active `manufacturing` / `fabrication` module IDs      | Disallowed; use `production_manufacturing`                                                                                                                 |
| Hardcoded module enum                                  | Disallowed; use Registry                                                                                                                                   |
| Direct external model calls in business code           | Disallowed; use ModelRouter/InferenceRouter                                                                                                                |
| Direct storage product dependency in business logic    | Disallowed; use StorageRouter capabilities                                                                                                                 |
| Three.js/WebGL/CPU as only renderer                    | Disallowed for CAD/BIM/digital twin/image/video core; WebGPU or platform GPU is primary, and fallback must carry failed/unsupported evidence               |
| WebGL as default renderer                              | Disallowed; WebGL is only a recorded failure-recovery path                                                                                                 |
| Disabled WebGPU/WebGL hardware acceleration by default | Disallowed for browser clients, workstations, demos and private-deployment baselines; unavailable environments must record failed/unsupported GPU evidence |
| GPL/AGPL/SSPL/BUSL in distributed runtime              | Disallowed unless isolated as external service and legally reviewed                                                                                        |
| Unpinned production dependencies                       | Disallowed                                                                                                                                                 |
| Alert-only buttons                                     | Disallowed for workbench interactions; state must change                                                                                                   |

---

## 11. Current Session Contracts

| File                                              | Contract                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `03-frontend/lib/module-registry.ts`              | 16 modules, active IDs, aliases, artifacts, workflows, standards and data objects |
| `03-frontend/lib/module-file-system.ts`           | Typed file/folder nodes, initial module tree, download/share concepts             |
| `03-frontend/lib/module-lifecycle.ts`             | Transaction states, events, approvals and transitions                             |
| `03-frontend/lib/module-backend-adapter.ts`       | Session backend adapter and future real adapter interface                         |
| `03-frontend/lib/module-operations.ts`            | Module-specific interactive business operations                                   |
| `03-frontend/components/ModuleFileExplorer.tsx`   | File operations UI contract                                                       |
| `03-frontend/components/ModuleWorkbenchShell.tsx` | Unified 14-module shell, including `/app/modules/digital_twin`                    |

These are not final backend architecture. They are frontend contracts that must be replaced behind interfaces.

---

## 12. 2026-04-28 Frontend Runtime Addendum

The active frontend stack now includes a local development file runtime:

| Layer               | Current implementation                                            | Production direction                                                                       |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Upload API          | Next.js route handlers                                            | Rust API upload endpoint                                                                   |
| File bytes          | `03-frontend/.architoken/uploads/`                                | `ObjectStore` capability                                                                   |
| Metadata            | `index.json`                                                      | Transaction / metadata store                                                               |
| UI binding          | `ModuleBackendAdapter.uploadLocalFile`                            | OpenAPI client implementing the same adapter                                               |
| Preview             | `UniversalFileViewer`                                             | Specialized parsers/viewers where available                                                |
| Digital twin import | unified CDE module files plus standalone cockpit data-source dock | WebGPU renderer + 3DGS/IFC/point-cloud pipeline behind StorageRouter and adapter contracts |

This local runtime is intentionally not a database product choice. It is a contract proving ground for the future `StorageRouter` capability layer.
