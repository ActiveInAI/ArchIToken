# Phase 7 CAD Pipeline

The CAD worker adapter covers:

- `dxf_extract_entities`
- `step_metadata`
- `cadquery_generate`
- `freecad_headless_convert`
- `occt_adapter`
- `licensed_dwg_adapter`
- `mlightcad_source_viewer`

Open CAD/geometry integration candidates include OCCT, FreeCAD headless workers, CadQuery, pythonocc-core, and CGAL. Dynamo, pascalorg/editor, and Macad3D remain reference inputs until reviewed.

Supported open-format contracts include DXF, SVG, STEP, IGES, STL/PLY/DAE mesh fallback, OpenUSD/USDZ, 3D Tiles, 3MF, and glTF/GLB fallback. OBJ/FBX are abandoned legacy inputs and must not be new default viewer/export/worker targets. DXF/DWG source viewing is replaced by MLightCAD `cad-simple-viewer` from `https://github.com/mlightcad/cad-viewer`. DWG parsing uses the transitive GPL-3.0 `@mlightcad/libredwg-web` / `https://github.com/mlightcad/libredwg-web` WASM boundary, so production distribution must keep the license review attached. The default core runtime must not embed a proprietary DWG implementation, proprietary SDK, closed-source loader, EXE, or competitor code.

## Vendor CAD/BIM Viewer Benchmark

The local `/home/insome/下载/基于BIM的平台开发` package and user-supplied Glendale API pages are recorded in `docs/VENDOR_BIM_PLATFORM_REFERENCE_INVENTORY.md`. CAD pipeline decisions derived from that benchmark:

- DWG/DXF viewers must support model/layout spaces, layer operations, entity picking, measurement, annotations, fit/reset, and native vector display.
- DWG must not default to a watermarked PDF preview. If no licensed backend adapter or isolated compatible derivative exists, the viewer returns a blocked adapter state.
- BIM/CAD derivatives must persist entity IDs, layer names, layout names, units, scale, bounding boxes, text/dimension metadata, and optional Revit/native ID links.
- Viewer UI must use the same compact command grammar as BIM/GIS: load, unload, reset, fit, select, isolate, hide/show, color, opacity, section, measure, annotate, snapshot, export, and dispose.

## Local Derivative Cache Contract

- `/api/local-files/:fileId/cad-derivative?format=manifest` returns `architoken.cad_derivative_manifest.v1` with source checksum, source URL, ETag, cache key, cache hit, adapter probes, derivative artifact and permission boundary.
- DXF/DWG entity viewing uses the uploaded source bytes with `@mlightcad/cad-simple-viewer`; the manifest viewer is `mlightcad_browser` and the artifact kind is `source-dxf` or `source-dwg`. ODA File Converter, isolated LibreDWG `dwg2dxf` / `dwgread`, FreeCAD/OCCT and DDC vector PDF are explicit diagnostics, export, validation or conversion adapters only, and must not be the default CAD viewer path.
- MLightCAD worker assets are served through local whitelisted endpoints under `/api/mlightcad/`; CAD fonts are same-origin proxied from the MLightCAD `cad-data/fonts` repository or an explicitly reviewed local CAD font mirror. The browser viewer must load real CAD font names from the drawing and CAD font repository, including SHX/mesh fonts such as `simkai`, `simsun`, `gbcbig`, `hztxt`, `txt` and `simplex`; generic UI/web fonts are not a substitute for missing SHX/mesh CAD fonts.
- `/api/local-files/:fileId/ifc-derivative?format=manifest` returns `architoken.ifc_derivative_cache.v1` and creates a checksum-keyed cache directory on first access. It records optional OpenUSD/USDZ, optional 3D Tiles for digital-twin scene derivatives, optional GLB fallback, fragments, IFC-Lite/ThatOpen boundaries and paginated properties-index status as `ready` only when real artifacts exist; otherwise it stays `pending_worker`.
- Native IFC frontends must open the source IFC through the IFC-Lite native viewer path: Rust/WASM streaming geometry plus WebGPU renderer. Native IFC opening must not auto-trigger OpenUSD/USDZ, 3D Tiles, or GLB fallback generation. Those outputs are background cache/derivative artifacts for downstream digital-twin scenes, interchange, validation, and properties indexing.
- All derivative endpoints must support ETag/cache headers and source endpoints must keep Range streaming. Missing MLightCAD worker assets, ODA/LibreDWG/IfcOpenShell/OCCT/FreeCAD is an adapter installation/build task, not permission to fake native output.
