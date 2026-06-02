# Phase 7 CAD Pipeline

The CAD worker adapter covers:

- `dxf_extract_entities`
- `step_metadata`
- `cadquery_generate`
- `freecad_headless_convert`
- `occt_adapter`
- `licensed_dwg_adapter`

Open CAD/geometry integration candidates include OCCT, FreeCAD headless workers, CadQuery, pythonocc-core, and CGAL. Dynamo, pascalorg/editor, and Macad3D remain reference inputs until reviewed.

Supported open-format contracts include DXF, SVG, STEP, IGES, STL/PLY/DAE mesh fallback, OpenUSD/USDZ, 3D Tiles, 3MF, and glTF/GLB fallback. OBJ/FBX are abandoned legacy inputs and must not be new default viewer/export/worker targets. DWG runs only through a licensed external adapter. The default core runtime must not embed a proprietary DWG implementation, proprietary SDK, closed-source loader, EXE, or competitor code.

## Vendor CAD/BIM Viewer Benchmark

The local `/home/insome/下载/基于BIM的平台开发` package and user-supplied Glendale API pages are recorded in `docs/VENDOR_BIM_PLATFORM_REFERENCE_INVENTORY.md`. CAD pipeline decisions derived from that benchmark:

- DWG/DXF viewers must support model/layout spaces, layer operations, entity picking, measurement, annotations, fit/reset, and native vector display.
- DWG must not default to a watermarked PDF preview. If no licensed backend adapter or isolated compatible derivative exists, the viewer returns a blocked adapter state.
- BIM/CAD derivatives must persist entity IDs, layer names, layout names, units, scale, bounding boxes, text/dimension metadata, and optional Revit/native ID links.
- Viewer UI must use the same compact command grammar as BIM/GIS: load, unload, reset, fit, select, isolate, hide/show, color, opacity, section, measure, annotate, snapshot, export, and dispose.

## Local Derivative Cache Contract

- `/api/local-files/:fileId/cad-derivative?format=manifest` returns `architoken.cad_derivative_manifest.v1` with source checksum, source URL, ETag, cache key, cache hit, adapter probes, derivative artifact and permission boundary.
- DWG entity viewing must resolve an ODA File Converter or isolated LibreDWG `dwg2dxf` / `dwgread` sidecar before serving DXF entities. FreeCAD/OCCT remain headless sidecar candidates for DWG handoff and exchange-format conversion. DDC vector PDF is only an explicitly enabled licensed fallback and must not be automatic.
- `/api/local-files/:fileId/ifc-derivative?format=manifest` returns `architoken.ifc_derivative_cache.v1` and creates a checksum-keyed cache directory on first access. It records optional OpenUSD/USDZ, optional 3D Tiles for digital-twin scene derivatives, optional GLB fallback, fragments, IFC-Lite/ThatOpen boundaries and paginated properties-index status as `ready` only when real artifacts exist; otherwise it stays `pending_worker`.
- Native IFC frontends must open the source IFC through the IFC-Lite native viewer path: Rust/WASM streaming geometry plus WebGPU renderer. Native IFC opening must not auto-trigger OpenUSD/USDZ, 3D Tiles, or GLB fallback generation. Those outputs are background cache/derivative artifacts for downstream digital-twin scenes, interchange, validation, and properties indexing.
- All derivative endpoints must support ETag/cache headers and source endpoints must keep Range streaming. Missing ODA/LibreDWG/IfcOpenShell/OCCT/FreeCAD is an adapter installation/build task, not permission to fake native output.
