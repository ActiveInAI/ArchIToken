# ArchIToken FileTypeRegistry

Status: active production wiring.

The canonical registry is `03-frontend/lib/file-type-registry.ts`.

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

The browser can directly preview uploaded bytes for PDF, images, video, audio, CSV/text/config/code, and renderable engineering derivatives such as glTF/GLB/STL. IFC source can be loaded as a source preview, while geometry conversion still belongs to the IFC worker.

## Worker Required

Office conversion/editing, IFC/BCF/IDS validation, STEP/IGES/SAT/Parasolid conversion, point-cloud tiling, GIS processing, diagram export, video transcoding, OCR, and AI generation must run through configured workers or service adapters.

## Licensed Adapter Required

RVT/RFA, DWG, DGN, Navisworks, SketchUp, Rhino/Grasshopper, Tekla, SolidWorks, CATIA, Bentley, 3ds Max, Maya, and similar proprietary desktop formats require official user-provided credentials, runtime, SDK/API access, and license-compatible adapters.

## Coverage Contract

The Vitest contract in `03-frontend/lib/file-type-registry.test.ts` verifies that every requested extension, exact file name, and logical file type is represented, and that every registry entry has all seven processing stages.
