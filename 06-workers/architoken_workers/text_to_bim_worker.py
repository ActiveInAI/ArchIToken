"""Structured Text-to-BIM worker backed by IfcOpenShell."""

from __future__ import annotations

from typing import Any

from .adapter_requirements import missing_python_dependency
from .contract import ConversionJob, ConversionOperation, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, output_dir, write_json_artifact


def ifcopenshell_text_to_bim(job: ConversionJob) -> WorkerResult:
    """Generate a real IFC model from a structured Text-to-BIM spec."""

    validate_job(job)
    if job.operation != ConversionOperation.BIM_GENERATE:
        raise ValueError(f"unsupported Text-to-BIM operation: {job.operation}")
    if unavailable := missing_python_dependency(
        job,
        adapter="ifcopenshell_text_to_bim",
        import_name="ifcopenshell",
        install_hint="Install IfcOpenShell in the worker image for structured Text-to-BIM generation.",
    ):
        return unavailable

    import ifcopenshell

    spec = _bim_spec(job.input)
    schema = str(spec.get("schema", "IFC4")).upper()
    model = ifcopenshell.file(schema=schema)
    guid = ifcopenshell.guid.new

    project = model.create_entity("IfcProject", GlobalId=guid(), Name=spec["name"])
    _assign_si_units(model, project)
    context = _model_context(model, project)
    site = model.create_entity("IfcSite", GlobalId=guid(), Name=str(spec.get("siteName", "Default Site")))
    building = model.create_entity("IfcBuilding", GlobalId=guid(), Name=str(spec.get("buildingName", spec["name"])))
    storey = model.create_entity("IfcBuildingStorey", GlobalId=guid(), Name=str(spec.get("storeyName", "Level 1")))
    site_placement = _local_placement(model, (0.0, 0.0, 0.0))
    building_placement = _local_placement(model, (0.0, 0.0, 0.0), site_placement)
    storey_placement = _local_placement(model, (0.0, 0.0, 0.0), building_placement)
    site.ObjectPlacement = site_placement
    building.ObjectPlacement = building_placement
    storey.ObjectPlacement = storey_placement
    model.create_entity("IfcRelAggregates", GlobalId=guid(), RelatingObject=project, RelatedObjects=[site])
    model.create_entity("IfcRelAggregates", GlobalId=guid(), RelatingObject=site, RelatedObjects=[building])
    model.create_entity("IfcRelAggregates", GlobalId=guid(), RelatingObject=building, RelatedObjects=[storey])

    elements = []
    spaces = []
    geometric_count = 0
    opening_count = 0
    class_counts: dict[str, int] = {}
    materials: dict[str, Any] = {}
    material_members: dict[str, list[Any]] = {}
    for element_spec in spec["elements"]:
        position = _vector3(element_spec.get("position"))
        size = _vector3(element_spec.get("size"), positive=True)
        representation = None
        if size:
            representation = _box_shape(model, context, size)
            geometric_count += 1
        ifc_class = _ifc_class_for_type(str(element_spec["type"]))
        attributes: dict[str, Any] = {
            "GlobalId": guid(),
            "Name": str(element_spec.get("name", element_spec["type"])),
            "Description": str(element_spec.get("description", "")) or None,
            "ObjectType": str(element_spec["type"]),
            "ObjectPlacement": _local_placement(model, position or (0.0, 0.0, 0.0), storey_placement),
            "Representation": representation,
        }
        if ifc_class == "IfcSpace":
            # IfcSpace 是空间结构元素：聚合进楼层而非“包含于”，CompositionType 兼容 IFC2X3。
            attributes["CompositionType"] = "ELEMENT"
            element = model.create_entity(ifc_class, **attributes)
            spaces.append(element)
        else:
            element = model.create_entity(ifc_class, **attributes)
            elements.append(element)
        class_counts[ifc_class] = class_counts.get(ifc_class, 0) + 1
        material_name = str(element_spec.get("material", "")).strip()
        if material_name and ifc_class != "IfcSpace":
            if material_name not in materials:
                materials[material_name] = model.create_entity("IfcMaterial", Name=material_name)
            material_members.setdefault(material_name, []).append(element)
        for opening_spec in element_spec.get("openings") or []:
            fill = _create_opening_with_fill(
                model,
                context,
                guid,
                storey_placement,
                host=element,
                opening_spec=opening_spec,
            )
            if fill is None:
                continue
            opening_count += 1
            elements.append(fill)
            fill_class = fill.is_a()
            class_counts[fill_class] = class_counts.get(fill_class, 0) + 1
            geometric_count += 1
    if elements:
        model.create_entity(
            "IfcRelContainedInSpatialStructure",
            GlobalId=guid(),
            RelatedElements=elements,
            RelatingStructure=storey,
        )
    if spaces:
        model.create_entity(
            "IfcRelAggregates",
            GlobalId=guid(),
            RelatingObject=storey,
            RelatedObjects=spaces,
        )
    for material_name, members in material_members.items():
        model.create_entity(
            "IfcRelAssociatesMaterial",
            GlobalId=guid(),
            RelatedObjects=members,
            RelatingMaterial=materials[material_name],
        )

    total_count = len(elements) + len(spaces)
    out_dir = output_dir(job)
    stem = _safe_stem(str(spec.get("fileName", spec["name"])))
    ifc_path = out_dir / f"{stem}.ifc"
    model.write(str(ifc_path))
    parsed = ifcopenshell.open(str(ifc_path))
    artifact = artifact_for_path(
        ifc_path,
        job=job,
        media_type="model/ifc",
        role="generated_ifc",
        metadata={"engine": "ifcopenshell", "standard": schema, "generator": "structured_text_to_bim"},
    )
    manifest = write_json_artifact(
        job,
        "text_to_bim_manifest.json",
        {
            "engine": "ifcopenshell",
            "schema": str(getattr(parsed, "schema", schema)),
            "name": spec["name"],
            "elementCount": total_count,
            "geometricElementCount": geometric_count,
            "spaceCount": len(spaces),
            "openingCount": opening_count,
            "ifcClassCounts": class_counts,
            "materials": sorted(materials),
            "source": "structured_bim_spec",
        },
        role="text_to_bim_manifest",
        metadata={"engine": "ifcopenshell", "standard": schema},
    )
    artifacts: tuple[WorkerArtifact, ...] = (artifact, manifest)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=artifacts,
        output={
            "adapter": "ifcopenshell_text_to_bim",
            "engine": "ifcopenshell",
            "standard": schema,
            "generated": True,
            "elementCount": total_count,
            "geometricElementCount": geometric_count,
            "spaceCount": len(spaces),
            "openingCount": opening_count,
            "ifcClassCounts": class_counts,
        },
    )


def _create_opening_with_fill(
    model: Any,
    context: Any,
    guid: Any,
    storey_placement: Any,
    *,
    host: Any,
    opening_spec: Any,
) -> Any:
    """创建 IfcOpeningElement（真实开洞）并以 IfcDoor/IfcWindow 填充。"""

    if not isinstance(opening_spec, dict):
        return None
    kind = str(opening_spec.get("kind", "")).strip().lower()
    if kind not in {"door", "window"}:
        return None
    position = _vector3(opening_spec.get("position"))
    size = _vector3(opening_spec.get("size"), positive=True)
    if position is None or size is None:
        return None

    placement = _local_placement(model, position, storey_placement)
    opening = model.create_entity(
        "IfcOpeningElement",
        GlobalId=guid(),
        Name=str(opening_spec.get("name", f"{kind} opening")),
        ObjectPlacement=placement,
        Representation=_box_shape(model, context, size),
    )
    model.create_entity(
        "IfcRelVoidsElement",
        GlobalId=guid(),
        RelatingBuildingElement=host,
        RelatedOpeningElement=opening,
    )
    fill = model.create_entity(
        "IfcDoor" if kind == "door" else "IfcWindow",
        GlobalId=guid(),
        Name=str(opening_spec.get("name", "门" if kind == "door" else "窗")),
        ObjectPlacement=_local_placement(model, position, storey_placement),
        Representation=_box_shape(model, context, size),
        OverallHeight=size[2],
        OverallWidth=max(size[0], size[1]),
    )
    model.create_entity(
        "IfcRelFillsElement",
        GlobalId=guid(),
        RelatingOpeningElement=opening,
        RelatedBuildingElement=fill,
    )
    return fill


_IFC_CLASS_BY_TYPE = {
    "wall": "IfcWall",
    "slab": "IfcSlab",
    "floor": "IfcSlab",
    "column": "IfcColumn",
    "beam": "IfcBeam",
    "door": "IfcDoor",
    "window": "IfcWindow",
    "roof": "IfcRoof",
    "stair": "IfcStairFlight",
    "space": "IfcSpace",
    "room": "IfcSpace",
}


def _ifc_class_for_type(element_type: str) -> str:
    return _IFC_CLASS_BY_TYPE.get(element_type.strip().lower(), "IfcBuildingElementProxy")


def _assign_si_units(model: Any, project: Any) -> None:
    units = [
        model.create_entity("IfcSIUnit", UnitType="LENGTHUNIT", Name="METRE"),
        model.create_entity("IfcSIUnit", UnitType="AREAUNIT", Name="SQUARE_METRE"),
        model.create_entity("IfcSIUnit", UnitType="VOLUMEUNIT", Name="CUBIC_METRE"),
    ]
    project.UnitsInContext = model.create_entity("IfcUnitAssignment", Units=units)


def _model_context(model: Any, project: Any) -> Any:
    origin = model.create_entity("IfcCartesianPoint", Coordinates=(0.0, 0.0, 0.0))
    placement = model.create_entity("IfcAxis2Placement3D", Location=origin)
    context = model.create_entity(
        "IfcGeometricRepresentationContext",
        ContextType="Model",
        CoordinateSpaceDimension=3,
        Precision=1e-5,
        WorldCoordinateSystem=placement,
    )
    project.RepresentationContexts = [context]
    return context


def _local_placement(model: Any, position: tuple[float, float, float], relative_to: Any = None) -> Any:
    point = model.create_entity("IfcCartesianPoint", Coordinates=tuple(float(value) for value in position))
    axis = model.create_entity("IfcAxis2Placement3D", Location=point)
    return model.create_entity("IfcLocalPlacement", PlacementRelTo=relative_to, RelativePlacement=axis)


def _box_shape(model: Any, context: Any, size: tuple[float, float, float]) -> Any:
    dx, dy, dz = size
    # 截面中心放在 (dx/2, dy/2)，使 position 语义为盒体最小角点，与 bimSpec 约定一致。
    profile = model.create_entity(
        "IfcRectangleProfileDef",
        ProfileType="AREA",
        Position=model.create_entity(
            "IfcAxis2Placement2D",
            Location=model.create_entity("IfcCartesianPoint", Coordinates=(dx / 2, dy / 2)),
        ),
        XDim=dx,
        YDim=dy,
    )
    solid = model.create_entity(
        "IfcExtrudedAreaSolid",
        SweptArea=profile,
        Position=model.create_entity(
            "IfcAxis2Placement3D",
            Location=model.create_entity("IfcCartesianPoint", Coordinates=(0.0, 0.0, 0.0)),
        ),
        ExtrudedDirection=model.create_entity("IfcDirection", DirectionRatios=(0.0, 0.0, 1.0)),
        Depth=dz,
    )
    shape = model.create_entity(
        "IfcShapeRepresentation",
        ContextOfItems=context,
        RepresentationIdentifier="Body",
        RepresentationType="SweptSolid",
        Items=[solid],
    )
    return model.create_entity("IfcProductDefinitionShape", Representations=[shape])


def _vector3(raw: Any, *, positive: bool = False) -> tuple[float, float, float] | None:
    if not isinstance(raw, (list, tuple)) or len(raw) != 3:
        return None
    values: list[float] = []
    for item in raw:
        try:
            value = float(item)
        except (TypeError, ValueError):
            return None
        if value != value or value in (float("inf"), float("-inf")):
            return None
        if positive and value <= 0:
            return None
        values.append(value)
    return (values[0], values[1], values[2])


def _bim_spec(input_payload: dict[str, Any]) -> dict[str, Any]:
    raw = input_payload.get("bimSpec") or input_payload.get("spec") or input_payload
    if not isinstance(raw, dict):
        raise ValueError("Text-to-BIM generation requires a structured bimSpec object")
    name = str(raw.get("name", "ArchIToken BIM Model")).strip()
    if not name:
        raise ValueError("bimSpec.name is required")
    elements = raw.get("elements", [{"type": "GenericElement", "name": "Generated Element"}])
    if not isinstance(elements, list):
        raise ValueError("bimSpec.elements must be a list")
    normalized_elements = []
    for index, element in enumerate(elements):
        if not isinstance(element, dict):
            raise ValueError(f"bimSpec.elements[{index}] must be an object")
        element_type = str(element.get("type", "")).strip()
        if not element_type:
            raise ValueError(f"bimSpec.elements[{index}].type is required")
        normalized = dict(element)
        normalized["type"] = element_type
        normalized_elements.append(normalized)
    spec = dict(raw)
    spec["name"] = name
    spec["elements"] = normalized_elements
    return spec


def _safe_stem(value: str) -> str:
    stem = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "_" for ch in value.strip())
    return stem or "text_to_bim"
