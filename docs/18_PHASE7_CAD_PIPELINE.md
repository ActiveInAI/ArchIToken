# Phase 7 CAD Pipeline

The CAD worker adapter covers:

- `dxf_extract_entities`
- `step_metadata`
- `cadquery_generate`
- `freecad_headless_convert`
- `occt_adapter`
- `licensed_dwg_adapter`

Open CAD/geometry integration candidates include OCCT, FreeCAD headless workers, CadQuery, pythonocc-core, and CGAL. Dynamo, pascalorg/editor, and Macad3D remain reference inputs until reviewed.

Supported open-format contracts include DXF, SVG, STEP, IGES, STL, OBJ, 3MF, and glTF. DWG runs only through a licensed external adapter. The default core runtime must not embed a proprietary DWG implementation, proprietary SDK, closed-source loader, EXE, or competitor code.

## Vendor CAD/BIM Viewer Benchmark

The local `/home/insome/下载/基于BIM的平台开发` package and user-supplied Glendale API pages are recorded in `docs/VENDOR_BIM_PLATFORM_REFERENCE_INVENTORY.md`. CAD pipeline decisions derived from that benchmark:

- DWG/DXF viewers must support model/layout spaces, layer operations, entity picking, measurement, annotations, fit/reset, and native vector display.
- DWG must not default to a watermarked PDF preview. If no licensed backend adapter or isolated compatible derivative exists, the viewer returns a blocked adapter state.
- BIM/CAD derivatives must persist entity IDs, layer names, layout names, units, scale, bounding boxes, text/dimension metadata, and optional Revit/native ID links.
- Viewer UI must use the same compact command grammar as BIM/GIS: load, unload, reset, fit, select, isolate, hide/show, color, opacity, section, measure, annotate, snapshot, export, and dispose.
