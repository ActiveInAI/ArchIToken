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

The browser can directly preview uploaded bytes for PDF, images, video, audio, CSV/text/config/code, DXF, IFC, glTF/GLB fallback, STL, and STEP/STP/IGES when the required WASM/browser parser is available. Engineering model priority is OpenUSD/USDZ/3D Tiles first, then glTF/GLB only as an audited fallback. Production derivatives such as OpenUSD/USDZ, 3D Tiles, GLB fallback, validated IDS/BCF packages, quantity indexes, and property databases still belong to configured workers.

## Worker Required

Office conversion/editing, IFC/BCF/IDS validation, production STEP/IGES/SAT/Parasolid conversion, point-cloud tiling, GIS processing, diagram export, video transcoding, OCR, and AI generation must run through configured workers or service adapters.

## Licensed Adapter Required

RVT/RFA, DWG, DGN, Navisworks, SketchUp, Rhino/Grasshopper, Tekla, SolidWorks, CATIA, Bentley, 3ds Max, Maya, and similar proprietary desktop formats require official user-provided credentials, runtime, SDK/API access, and license-compatible adapters.

## Coverage Contract

The Vitest contract in `03-frontend/lib/file-type-registry.test.ts` verifies that every requested extension, exact file name, and logical file type is represented, and that every registry entry has all seven processing stages.

The Rust contract in `04-backend/harness-core/src/file_runtime_registry.rs` verifies that the priority backend engine set is mapped: DXF, DWG, RVT, STEL, STL, IGES/IGS, IFC, SKP, 3DM, OpenUSD/USDZ, 3D Tiles payloads, glTF/GLB fallback, Office legacy/OOXML, audio, video, image, and PDF. OBJ/FBX are abandoned legacy inputs, not priority runtime routes. Proprietary formats must route to explicit licensed adapters; unsupported native geometry must fail closed with source-file lightweight viewing instead of redraw or fake geometry.
