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
