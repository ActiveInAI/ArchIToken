# Phase 7 CAD Pipeline

The CAD worker skeleton covers:

- `dxf_extract_entities`
- `step_metadata`
- `cadquery_generate`
- `freecad_headless_convert`
- `occt_adapter_boundary`
- `dwg_legal_adapter_boundary`

Open CAD/geometry integration candidates include OCCT, FreeCAD headless workers, CadQuery, pythonocc-core, and CGAL. Dynamo, pascalorg/editor, and Macad3D remain reference inputs until reviewed.

Supported open-format contracts include DXF, SVG, STEP, IGES, STL, OBJ, 3MF, and glTF. DWG remains a legal adapter boundary only. The default core runtime must not embed a proprietary DWG implementation, proprietary SDK, closed-source loader, EXE, or competitor code.
