# ArchIToken FileTypeRegistry

Status: active production wiring.

The workbench registry is `03-frontend/lib/file-type-registry.ts`.
The backend runtime route registry is `04-backend/harness-core/src/file_runtime_registry.rs`.

Every file type must declare:

- extension or exact file name match
- logical type
- MIME fallback
- viewer kind
- adapter/source family
- Store, Preview, Extract, Parse, Convert, Validate, and Runtime route
- production route: `ready`, `adapter_required`, `external_process_required`, or `licensed_adapter_required`

## Runtime Rule

ArchIToken does not fake unsupported file parsing. If a file is not browser-renderable and no worker/service/license adapter is configured, the UI must show the missing route instead of synthetic content.

## Ready In Browser

The browser can directly preview uploaded bytes for PDF, images, video, audio, CSV/text/config/code, DXF, IFC, glTF/GLB fallback, STL, and STEP/STP/IGES when the required WASM/browser parser is available. Engineering model priority is OpenUSD/USDZ/3D Tiles first, then glTF/GLB only as an audited fallback. For private source formats such as SKP, IFC exchange must come from a real SKP reader/exporter command (`PRENGINE_SKP_TO_IFC_COMMAND`) or licensed adapter; GLB may be used only as a final source-bound viewing fallback after a real SKP-to-GLB command, licensed adapter, or explicit same-source GLB binding; it must not be presented as native SKP parsing or as SKP->IFC success. ZIP central-directory listing and safe in-archive preview can run in the browser for bounded entries. Production derivatives such as OpenUSD/USDZ, 3D Tiles, GLB fallback, validated IDS/BCF packages, quantity indexes, and property databases still belong to configured workers.

## PanCode Code And Config Editing

PanCode is the fixed code programming file runtime for local CDE-bound text/code objects. The canonical reusable repository is `https://github.com/ActiveInAI/PanCode`; the ArchIToken in-repo policy remains `03-frontend/lib/code-file-editor.ts` and `03-frontend/lib/code-native-session-server.ts`. Supported inline editing includes common source, markup, Markdown, JSON/JSONL/JSONC, YAML/YML, TOML, ENV, SQL, GraphQL, Proto, Rego, lockfiles, package manifests, Dockerfile/Compose, Makefile, `.gitignore`, and `.dockerignore`.

The browser editor is pinned to `monaco-editor@0.55.1` and uses a VS Code default dark workbench surface: top command toolbar, left Activity Bar, Explorer tree, Search, Source Control, Diagnostics, Settings, executable menu commands, and source-bound save. It provides source viewing, direct text editing, line/cursor metrics, Tab indentation, Ctrl/Cmd+S save, JSON/JSONL formatting, and lightweight structure checks for JSON, JSONL, JSONC, TOML, YAML indentation, XML, and HTML. It is not a replacement for LSP, professional schema validation, security scanning, or build execution. Those remain worker/service responsibilities and must be recorded as CDE validation evidence.

For Collabora-style full IDE sessions, `code-server@4.121.0` is selected as an optional isolated sidecar under the `code-editor` Docker profile. ArchIToken remains the CDE source of record; code-server uses an `architoken.code_native_session.v1` workspace copy and the `/code-session/commit` route writes edits back through CDE APIs before the result is treated as saved. `tree-sitter v0.26.9` is the selected source-build route for syntax tree and worker diagnostics.

Inline editing is deliberately limited to local controlled objects under `/api/local-files/{fileId}` with a bounded payload size. HTML/HTM defaults to visual preview and keeps source switching; other registered code/config/text files default to editing. Remote metadata-only rows, binary structured containers, and unsupported file types remain read-only or adapter-routed.

## Archive Manifests

Archive packages must be indexed before extraction. ZIP can use the browser central directory for listing and bounded nested preview. 7z, RAR, TAR, TGZ, GZ, BZ2, XZ, ZST, and ZIPX use the local archive-manifest route, which shells out to a configured 7z-compatible executable for metadata only. This route must report entry paths, sizes, methods, encryption flags, unsafe paths, source checksum, and adapter evidence. Extraction, antivirus scanning, object-store binding, and nested file publication remain worker responsibilities.

Large nested entries use format-aware thresholds instead of a single 24 MB browser limit: Office and PDF entries may be handed to their native viewer path when within the configured preview bounds, while CAD/BIM/media/archive extraction still requires the relevant worker or adapter.

## Worker Required

Office conversion/editing, IFC/BCF/IDS validation, production STEP/IGES/SAT/Parasolid conversion, point-cloud tiling, GIS processing, diagram export, video transcoding, media editing project processing, archive extraction, OCR, and AI generation must run through configured workers or service adapters.

## Licensed Adapter Required

RVT/RFA, DWG, DGN, Navisworks, SketchUp, Rhino/Grasshopper, Tekla, SolidWorks, CATIA, Bentley, 3ds Max, Maya, and similar proprietary desktop formats require official user-provided credentials, runtime, SDK/API access, and license-compatible adapters.

## Coverage Contract

The Vitest contract in `03-frontend/lib/file-type-registry.test.ts` verifies that every requested extension, exact file name, and logical file type is represented, and that every registry entry has all seven processing stages.

The Rust contract in `04-backend/harness-core/src/file_runtime_registry.rs` verifies that the priority backend engine set is mapped: DXF, DWG, RVT, STEL, STL, IGES/IGS, IFC, SKP, 3DM, OpenUSD/USDZ, 3D Tiles payloads, glTF/GLB fallback, Office legacy/OOXML, audio, video, image, and PDF. OBJ/FBX are legacy source-bound mesh inputs: they may use the unified mesh viewer for selection, bounds dimensions and material rows, but they are not priority runtime routes and must not be treated as openBIM or authoritative quantity sources. Proprietary formats must route to explicit licensed adapters; unsupported native geometry must fail closed with source-file lightweight viewing instead of redraw or fake geometry.

Frontend coverage also includes common media and editing project inputs such as MXF, OGG, AAC, FCPXML, PRPROJ, AEP, and DRP. These are registry-supported workflow objects, not a claim that the browser can parse proprietary editing timelines without worker adapters.
