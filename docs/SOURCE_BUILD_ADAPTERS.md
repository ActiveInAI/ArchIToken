# ArchIToken Source-Build Adapter Runtime

**Status**: active source-build contract
**Scope**: CPython 3.13, sse2neon, OpenColorIO, WebGPU-first browser runtime, NVIDIA CUDA workstation smoke, Intel oneAPI system smoke, Intel LLVM DPC++/SYCL source toolchain, AMD ROCm/HIP, Windows DirectX 12, Apple Metal, Vulkan, Intel oneAPI/Level Zero, Triton AI kernels, Blender, Bonsai, IfcOpenShell, OCCT/OpenCascade current and compatibility builds, LibreDWG, FreeCAD, rhino3dm, OpenNURBS, CGAL, CGAL SWIG, Emscripten/WebIFC, ThatOpen viewer runtimes, Microsoft IFC, buildingSMART standards, Open-Cascade-SAS/CGAL/Speckle organization source sync, ForgeCAD, IFCDB-Agent, Cesium, Speckle .NET SDK, DataDrivenConstruction workflows, louistrue IFC/CAD viewers and Trimble/Tekla licensed source adapters

ArchIToken treats upstream GitHub source as a first-class runtime input. Heavy CAD/BIM/media projects must be built into isolated worker prefixes or external services; they must not be vendored into the distributed core.

## CLI

```bash
cd 06-workers
uv run architoken-source-build list all
uv run architoken-source-build plan occt libredwg ifcopenshell
uv run architoken-source-build build occt --root /tmp/architoken-source-builds --jobs 8
```

Dry-run without network or compiler execution:

```bash
cd 06-workers
uv run architoken-source-build build all --dry-run --no-smoke
```

`--dry-run` is only a planning and unit-test mode. It is not completion evidence and must not be recorded as a finished adapter build.

Real builds are the default. Heavy CMake projects must resume from the existing build directory by default so a multi-hour compile can continue through fixes, dependency installs and smoke retries. Cleaning a build directory is an explicit recovery action, not the normal CLI path.

Each real build writes:

```text
/tmp/architoken-source-builds/<project>/source-build-evidence.json
```

The evidence file records source URL, ref, checkout commit, command argv, install prefix, smoke command, license and isolation boundary.

Successful real builds write `status: completed`. Failed real builds also write the same evidence file with `status: failed`, the failing command and return code. A failed evidence file is not completion evidence, but it is mandatory diagnostic evidence and must be kept until the build is repaired by a later successful evidence file.

## Local Evidence Snapshot

The following evidence was produced on 2026-05-20 under `/tmp/architoken-source-builds-real`. This table records real local build state; it must not be copied as generic completion evidence for another machine or CI runner.

| Project | Evidence status | Build kind | Notes |
|---|---|---|---|
| CPython 3.13 | completed | autotools | source-built Blender Python toolchain |
| sse2neon | completed | header_only | source-synced SIMD header |
| OpenColorIO | completed | cmake | source-built Blender color dependency |
| NVIDIA CUDA toolchain | completed | cuda_smoke | real `nvcc` kernel smoke completed on this workstation |
| Intel oneAPI system toolchain | failed | oneapi_sycl_smoke | failed because this host has no `icpx` or `dpcpp`; this is failure evidence, not completion |
| Intel LLVM oneAPI source toolchain | completed | dpcpp_source_toolchain | source-built Intel LLVM/DPC++/SYCL route completed |
| Emscripten SDK | completed | toolchain | source toolchain for WebIFC/ifc5cad |
| Blender | completed | cmake_headless | source-built headless Blender service route |
| Bonsai | completed | python_addon_compile | Bonsai add-on compile check from IfcOpenShell source |
| IfcOpenShell | completed | cmake | source-built IFC worker with OCCT kernel |
| OCCT 7.9.1 | completed | cmake | compatibility OpenCascade kernel |
| FreeCAD | completed | cmake | headless service route |
| LibreDWG | completed | autotools | isolated DWG/DXF sidecar route |
| CGAL | completed | cmake | core CGAL source build |
| CGAL SWIG | completed | cmake_python | binding worker route with core CGAL evidence |
| rhino3dm | completed | python_wheel | source-built 3DM worker binding |
| OpenNURBS | completed | cmake | native 3DM library source build |
| ThatOpen engine_web-ifc | completed | emscripten_npm | WebIFC WASM runtime |
| ThatOpen web-ifc-three | completed | npm | IFC/Three bridge |
| ThatOpen web-ifc-viewer | completed | npm | browser IFC viewer reference |
| Microsoft IFC | completed | cmake | native IFC tool/library route |
| buildingSMART standards | completed | standards_sync | standards/schema/source sync, not a monolithic binary |
| Open-Cascade-SAS org | completed | organization_source_sync | organization source sync |
| CGAL org | completed | organization_source_sync | organization source sync |
| ForgeCAD | completed | source_sync | public source/skill sync; no fake compiled CLI claimed |
| IFCDB-Agent | completed | source_sync | public source/doc sync; service wiring remains separate |
| Cesium | completed | npm | web worker/frontend dependency build |
| Speckle .NET SDK | completed | dotnet | .NET connector/worker route |
| Speckle org | completed | organization_source_sync | organization source sync |
| DDC cad2data | completed | source_sync | construction CAD/BIM workflow source sync |
| DDC OpenConstructionERP | completed | frontend_backend | external service build boundary |
| DDC construction skills | completed | source_sync | ToolRouter skill reference source sync |
| DDC CAD/BIM code pipeline | completed | source_sync | workflow source sync |
| DDC n8n project workflow | completed | workflow_source_sync | workflow JSON source sync |
| DDC OpenConstructionEstimate | completed | source_sync | estimating workflow source sync |
| louistrue ifc5cad | completed | npm_emscripten | browser CAD/IFC5 editor build |
| louistrue ifcLiteViewer | completed | npm | PowerBI visual package build |

## Source Build Matrix

| Project | Source | Build route | Runtime boundary |
|---|---|---|---|
| CPython 3.13 | `https://github.com/python/cpython.git` tag `v3.13.13` | Autotools build/install with shared libpython and rpath under the source-build prefix | source-built toolchain for Blender main |
| sse2neon | `https://github.com/DLTcollab/sse2neon.git` | Header-only source sync/install to prefix include | SIMD header dependency for Blender Linux arm64 |
| OpenColorIO | `https://github.com/AcademySoftwareFoundation/OpenColorIO.git` | CMake build/install with apps/tests/Python disabled for Blender service dependency route | source-built color management library for Blender when distro CMake targets are invalid |
| WebGPU portability contract | browser/OS runtime plus source-built viewer adapters | Real adapter/device smoke on WebGPU-capable browsers; WebGL is fallback-only evidence | primary browser graphics/compute route for CAD/BIM/digital twin/image/video editing |
| NVIDIA CUDA toolchain | host CUDA toolkit at `/usr/local/cuda/bin/nvcc` | Compile a real CUDA kernel and run it as smoke evidence | workstation GPU route for designers/developers; failed when `/dev/nvidia*` is not visible |
| AMD ROCm/HIP | ROCm/HIP toolchain on AMD GPU nodes | Compile and run a HIP kernel smoke on AMD runners | AMD workstation/server acceleration route |
| DirectX 12 | Windows SDK/D3D12 runtime on Windows runners | Compile and run a D3D12 smoke or adapter capability probe | Windows native GPU route |
| Apple Metal | Xcode/Metal runtime on macOS/iOS runners | Compile Metal shader/library and run platform smoke | Apple Silicon/macOS/iOS native GPU route |
| Vulkan / Intel oneAPI / Level Zero | Intel oneAPI `icpx`/`dpcpp`, `https://github.com/intel/llvm.git`, and platform SDKs on Linux/Windows/Android/Intel GPU nodes | Compile and run platform smoke; binary oneAPI uses `architoken-source-build build intel-oneapi-toolchain`; source route uses `architoken-source-build build intel-llvm-oneapi` with `--host-target AArch64;ARM;X86` and native CPU | Linux/Android/Intel GPU route and WebGPU backend validation |
| Triton | `https://github.com/triton-lang/triton.git` or platform package source route | Source build or platform-specific kernel smoke where supported | AI kernel acceleration route behind InferenceRouter/worker adapters |
| Blender | `https://github.com/blender/blender.git` | CMake headless source build with `WITH_LIBS_PRECOMPILED=OFF`, source-built Python 3.13, source-built sse2neon, source-built OpenColorIO and `WITH_VULKAN_BACKEND=OFF` on Linux arm64; generated build cache may be cleaned when compiler/toolchain changes | GPL external process/service for scene, mesh, render, video and Bonsai host jobs |
| IfcOpenShell | `https://github.com/IfcOpenShell/IfcOpenShell.git` | CMake build/install with OCCT C++ kernel and system Python 3.12 wrapper route installed under the project prefix; CGAL remains a separate isolated worker | isolated IFC geometry/validation worker |
| Bonsai | `https://github.com/IfcOpenShell/IfcOpenShell.git` `src/bonsai` | Python add-on compile check | isolated Blender add-on/service, not core vendored code |
| OCCT / OpenCascade | `https://github.com/Open-Cascade-SAS/OCCT.git` | CMake build/install with Draw/TCL/TK/X11 modules | native worker or WASM worker for STEP/STP/IGES/IGS/BREP |
| OCCT 7.9.1 compatibility | `https://github.com/Open-Cascade-SAS/OCCT.git` tag `V7_9_1` | CMake build/install with Draw/TCL/TK/X11 modules | compatibility kernel for IfcOpenShell/FreeCAD and upstreams not yet adjusted to OCCT 8 API changes |
| LibreDWG | `https://github.com/LibreDWG/libredwg.git` | Autotools build/install | GPL external process for DWG/DXF entity extraction |
| FreeCAD | `https://github.com/FreeCAD/FreeCAD.git` | CMake headless build/install with GUI, Assembly/BIM/Drawing, CAM, TechDraw/Draft/OpenSCAD/Spreadsheet GUI-dependent routes, developer tests, test-only targets and host-global site-packages install disabled for service route | external process/container for FreeCADCmd conversion |
| rhino3dm | `https://github.com/mcneel/rhino3dm.git` | Python wheel from source | worker library for 3DM read/write |
| OpenNURBS | `https://github.com/mcneel/opennurbs.git` | CMake build/install | native 3DM worker library |
| CGAL | `https://github.com/CGAL/cgal.git` | CMake build/install from the CGAL core repository | isolated worker or commercial-license boundary for geometry algorithms |
| CGAL SWIG | `https://github.com/CGAL/cgal-swig-bindings.git` | CMake build/install with `CGAL_DIR` and system Python 3.12 | optional isolated Python geometry binding worker; never substitutes for CGAL core evidence |
| Emscripten SDK | `https://github.com/emscripten-core/emsdk.git` | `./emsdk install 4.0.23` + `./emsdk activate 4.0.23` | source-built browser WASM toolchain |
| ThatOpen web-ifc | `https://github.com/ThatOpen/engine_web-ifc.git` | Emscripten + npm `build-release` | browser/node IFC WASM runtime |
| ThatOpen web-ifc-three | `https://github.com/ThatOpen/web-ifc-three.git` | npm package build | Three.js IFC bridge/viewer dependency |
| ThatOpen web-ifc-viewer | `https://github.com/ThatOpen/web-ifc-viewer.git` | npm TypeScript build | browser IFC viewer reference/isolated viewer |
| Microsoft IFC | `https://github.com/microsoft/ifc.git` | CMake build/install | native IFC reader/tool worker library |
| DDC cad2data | `https://github.com/datadrivenconstruction/cad2data-Revit-IFC-DWG-DGN.git` | source sync | notebook/workflow source for Revit/IFC/DWG/DGN data extraction |
| DDC OpenConstructionERP | `https://github.com/datadrivenconstruction/OpenConstructionERP.git` | backend Python compile + frontend Vite build | AGPL/copyleft external service boundary |
| DDC AI construction skills | `https://github.com/datadrivenconstruction/DDC_Skills_for_AI_Agents_in_Construction.git` | source sync | ToolRouter skill registry reference |
| DDC CAD/BIM code pipeline | `https://github.com/datadrivenconstruction/CAD-BIM-to-Code-Automation-Pipeline-DDC-Workflow-with-LLM-ChatGPT.git` | source sync | isolated workflow/agent reference |
| DDC n8n project workflow | `https://github.com/datadrivenconstruction/Project-management-n8n-with-task-management-and-photo-reports.git` | workflow JSON source sync | external workflow service |
| DDC OpenConstructionEstimate | `https://github.com/datadrivenconstruction/OpenConstructionEstimate-DDC-CWICR.git` | source sync | estimating workflow/source reference |
| louistrue ifc5cad | `https://github.com/louistrue/ifc5cad.git` | npm + Emscripten WASM build | browser CAD/IFC5 editor candidate |
| louistrue ifcLiteViewer | `https://github.com/louistrue/ifcLiteViewer.git` | npm PowerBI visual package build | isolated IFC viewer visual/reference |
| buildingSMART | IFC, IDS, bSDD, BCF, Validate, IDS Audit, Gherkin repos | standards source sync | contract/schema/fixture truth, not a monolithic runtime binary |
| Open-Cascade-SAS org | Open-Cascade-SAS OCCT/components/samples/tooling repos | organization source sync | source corpus for selected native workers; concrete runtime build remains per-project |
| CGAL org | CGAL core, SWIG, demos, docker, docs and plugin repos | organization source sync | source corpus for selected isolated geometry workers |
| ForgeCAD | `https://github.com/KoStard/ForgeCAD.git` | public source/skill sync | licensed or external process/service; public repo is not falsely treated as compiled CLI |
| IFCDB-Agent | `https://github.com/DeeJoin/IFCDB-Agent.git` | public source/doc sync | reference or isolated IFC database/agent service |
| Cesium | `https://github.com/CesiumGS/cesium.git` | `npm install` + `npm run build` + `npm run build-release` | web worker/frontend dependency for 3D Tiles/GIS/reality routes |
| Speckle .NET SDK | `https://github.com/specklesystems/speckle-sharp.git` | `dotnet restore` + `dotnet build` | .NET worker or external connector |
| Speckle org | Speckle server, SDKs, connectors, IFC exporters and automation examples | organization source sync | source corpus for selected CDE interoperability services |
| Trimble / Tekla | authorized repo from `ARCHITOKEN_TRIMBLE_SOURCE_URL` | licensed CMake build hook | licensed adapter only; requires `TRIMBLE_LICENSE_ACK` |

## Environment

Optional global root:

```bash
export ARCHITOKEN_SOURCE_BUILD_ROOT=/tmp/architoken-source-builds
```

Blender Python 3.13:

```bash
cd 06-workers
uv run architoken-source-build build python-3-13 --root /tmp/architoken-source-builds --jobs 8
export ARCHITOKEN_PYTHON313_PREFIX=/tmp/architoken-source-builds/python-3-13/prefix
uv run architoken-source-build build sse2neon --root /tmp/architoken-source-builds --jobs 8
export SSE2NEON_INCLUDE_DIR=/tmp/architoken-source-builds/sse2neon/prefix/include
uv run architoken-source-build build opencolorio --root /tmp/architoken-source-builds --jobs 8
export OPENCOLORIO_DIR=/tmp/architoken-source-builds/opencolorio/prefix/lib/cmake/OpenColorIO
uv run architoken-source-build build blender --root /tmp/architoken-source-builds --jobs 8
```

NVIDIA CUDA workstation smoke:

```bash
cd 06-workers
uv run architoken-source-build build nvidia-cuda-toolchain --root /tmp/architoken-source-builds --jobs 8
```

This smoke compiles with `nvcc` and runs a CUDA kernel. If `nvidia-smi` cannot access the driver or `/dev/nvidia*` is not visible to the current process, the smoke must fail and write failure evidence.

Intel oneAPI / Level Zero smoke:

```bash
cd 06-workers
uv run architoken-source-build build intel-oneapi-toolchain --root /tmp/architoken-source-builds --jobs 8
```

This smoke locates `icpx` or `dpcpp`, compiles a SYCL kernel and runs it. Missing compiler, Level Zero/OpenCL runtime, Intel GPU or CPU SYCL device writes failed evidence rather than completion.

Intel LLVM oneAPI source build:

```bash
cd 06-workers
uv run architoken-source-build build intel-llvm-oneapi --root /tmp/architoken-source-builds --jobs 8
```

This clones `https://github.com/intel/llvm.git`, configures the DPC++/SYCL toolchain with `--host-target AArch64;ARM;X86` and `--native_cpu`, builds `deploy-sycl-toolchain`, then compiles and runs a SYCL smoke with the built `clang++ -fsycl`. It is the required ARM64 source route when Intel binary oneAPI packages are unavailable.

WebGPU and platform GPU smoke:

```bash
# Browser/runtime evidence must be collected from a WebGPU-capable client.
# Platform-native evidence must run on the matching runner:
# CUDA/OptiX -> NVIDIA node
# ROCm/HIP -> AMD node
# DirectX 12 -> Windows node
# Metal -> macOS/iOS node
# Vulkan/oneAPI/Level Zero -> Linux/Windows/Android/Intel-capable node
# Triton -> supported AI kernel node
```

Linux may not claim DirectX 12, Metal, iOS or Windows GPU completion. Windows/macOS/iOS/Android build agents must write evidence JSON through the same Adapter Registry contract.

CGAL SWIG:

```bash
export CGAL_DIR=/tmp/architoken-source-builds/cgal/prefix/lib/cmake/CGAL
```

WebIFC / ifc5cad WASM:

```bash
cd 06-workers
uv run architoken-source-build build emsdk --root /tmp/architoken-source-builds --jobs 8
export EMSDK=/tmp/architoken-source-builds/emsdk/src
uv run architoken-source-build build thatopen-engine-web-ifc thatopen-web-ifc-three thatopen-web-ifc-viewer louistrue-ifc5cad --root /tmp/architoken-source-builds --jobs 8
```

Trimble/Tekla licensed adapter:

```bash
export ARCHITOKEN_TRIMBLE_SOURCE_URL=https://github.com/TrimbleSolutionsCorporation/<authorized-repo>.git
export TRIMBLE_LICENSE_ACK=accepted
```

No Trimble/Tekla source build may run without an authorized source URL and explicit license acknowledgment.

## Rules

- Source builds are preferred over missing/stale apt/snap packages.
- GPU-first is the default execution strategy for render, geometry, AI kernels, image/video editing, transcode and heavy derivative generation. CPU-only execution is a fallback and must record unavailable/unsupported/failed GPU evidence unless the workload is too small to justify GPU dispatch overhead.
- A dry-run, plan output, README scan, package-list scan or assumed successful command is never accepted as build completion.
- A failed real compile must leave failure evidence with the exact command and return code. Retrying is required; silently replacing it with a dry-run or a plan is forbidden.
- Linux arm64 Blender must use source/system-library CMake builds. The precompiled `make update` route is not completion evidence when upstream has no configured arm64 library payload.
- Blender main requires Python 3.13 on Linux. If the OS only provides Python 3.12, CPython 3.13 must be source-built and passed through `ARCHITOKEN_PYTHON313_PREFIX`; falling back to system Python 3.12 is not completion evidence.
- Blender Linux arm64 builds require sse2neon when the distro has no package. The header must be sourced from `https://github.com/DLTcollab/sse2neon.git`, installed to a prefix and passed through `SSE2NEON_INCLUDE_DIR`.
- Blender must use source-built OpenColorIO when the distro CMake target points to invalid include paths. The source-built CMake config is passed through `OPENCOLORIO_DIR`.
- Blender headless service builds may disable Vulkan when the route is render/mesh/video automation without an interactive GPU viewport.
- WebGPU is the first-class browser rendering and compute route for CAD/BIM/digital twin/image/video/online editing. WebGL is only a recorded compatibility fallback.
- NVIDIA CUDA, AMD ROCm/HIP, Windows DirectX 12, Apple Metal, Vulkan, Intel oneAPI/Level Zero and Triton are first-class platform acceleration routes. Evidence requires real compile/smoke on the matching platform, not a package/version listing. If device nodes, drivers or OS APIs are not visible, record failed GPU evidence and continue other source worker compilation separately.
- Cross-platform support is mandatory across ARM64/x86_64, NVIDIA/AMD/Intel/Apple, Linux/Windows/macOS/iOS/Android. A missing runner is an evidence gap, not completion.
- IfcOpenShell may build the production IFC conversion worker on the OCCT C++ kernel while CGAL is compiled and evidenced as a separate worker. A CGAL kernel compile failure must not block IFC upload/view/convert routes when OCCT evidence is available.
- IfcOpenShell worker builds pin the Python wrapper to system Python 3.12 and install the wrapper under the project prefix, not `/usr/local`, because source-build evidence must be reproducible without host-global writes.
- If a Python binding fails while the upstream C++/CLI worker builds, the C++/CLI worker remains the required production route and the binding failure must be recorded separately until repaired.
- CGAL core is `https://github.com/CGAL/cgal.git`. `cgal-swig-bindings` is only a binding layer and cannot be used as fake CGAL completion evidence.
- FreeCAD service builds may disable GUI-only Assembly/BIM/Drawing/CAM, TechDraw/Draft/OpenSCAD/Spreadsheet GUI-dependent targets, developer tests and test-only targets when the route is a headless `FreeCADCmd` CAD/BIM conversion sidecar.
- FreeCAD service builds must install under their source-build prefix. Host-global `/usr/local` Python site-packages writes are invalid for production evidence.
- Compatibility source builds are mandatory when a current upstream API breaks another required adapter. They are not optional fallbacks; they are pinned, built, smoked and recorded as separate evidence.
- GPL/AGPL/copyleft and commercial SDKs remain external process, sidecar, service, container or licensed adapter boundaries.
- `buildingSMART` organization repositories are standards and validation contract sources. They are synchronized and pinned; they are not falsely compiled as one binary.
- Organization-level source syncs are real Git checkouts with pinned commits. They are not recorded as compiled binaries unless a concrete project entry runs a real build command and smoke check.
- ForgeCAD and IFCDB-Agent public repositories are synchronized as available public source. If a runtime CLI/service is not present in the public source, the evidence must say so; no adapter may pretend a missing binary exists.
- A build that does not produce source-bound artifacts or smoke evidence is not production-ready.
- Every source build result must be referenced by the Adapter Registry, Worker Route and audit trail before frontend modules consume it.
