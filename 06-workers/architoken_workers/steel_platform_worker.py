"""Detailed-design steel platform worker adapter.

This adapter integrates the user-supplied steel-platform prototype as an
ArchIToken structured worker contract. It does not execute arbitrary archive
code: the worker consumes a typed 2D room-block plan, derives a steel grid,
member schedule, BOM, review gates and optional build123d CAD derivatives.
"""

from __future__ import annotations

import math
from typing import Any

from .adapter_requirements import ensure_python_dependency
from .contract import ConversionJob, ConversionOperation, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, output_dir, write_json_artifact

MODULUS_MM = 300
DEFAULT_MAX_SPAN_MM = 4800
DEFAULT_FLOOR_HEIGHT_MM = 3000
STEEL_DENSITY_KG_M3 = 7850.0

SUPPORTED_OPERATIONS = {
    ConversionOperation.MODEL_GENERATE,
    ConversionOperation.BIM_GENERATE,
    ConversionOperation.CAD_CONVERT,
}


def generate_steel_platform(job: ConversionJob) -> WorkerResult:
    """Generate a steel-platform design manifest, BOM and optional CAD outputs."""

    validate_job(job)
    if job.operation not in SUPPORTED_OPERATIONS:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            output={"adapter": "steel_platform", "operation": job.operation.value},
            error={
                "code": "unsupported_operation",
                "message": f"steel_platform requires one of {[op.value for op in sorted(SUPPORTED_OPERATIONS, key=lambda item: item.value)]}, got {job.operation.value}",
            },
        )

    plan, plan_error = _normalize_plan(job.input)
    if plan_error:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            output={"adapter": "steel_platform"},
            error={"code": "invalid_plan", "message": plan_error},
        )

    settings = _settings(job.input)
    structural_layout = _derive_structural_layout(plan, settings)
    bom = _compute_bom(structural_layout, settings)
    rule_checks = _rule_checks(plan, structural_layout, settings)
    manifest = {
        "schema": "architoken.steel_platform_design_package.v1",
        "moduleId": str(job.input.get("moduleId") or "detailed_design"),
        "adapter": "steel_platform",
        "sourceArchive": str(job.input.get("sourceArchive") or "user-supplied steel-platform-full.zip"),
        "contract": "2D plan blocks -> steel grid/member schedule -> BOM -> optional STEP/STL/glTF derivatives",
        "reviewState": "professional_review_required",
        "units": {"length": "mm", "area": "m2", "weight": "t"},
        "aiGateChain": [
            {"name": "Planner", "status": "passed"},
            {"name": "Generator", "status": "passed"},
            {"name": "Evaluator", "status": "passed"},
            {"name": "RuleChecker", "status": "professional_review_required"},
            {"name": "SchemaValidator", "status": "passed"},
            {"name": "Approver", "status": "pending"},
        ],
        "standardsAnchors": [
            "IFC4.3",
            "IDS",
            "BCF",
            "GB 50017",
            "GB 50009",
            "GB 50205",
            "GB 50661",
            "ISO 19650",
        ],
        "professionalRoles": ["注册结构工程师", "深化设计师", "BIM工程师", "生产制造负责人"],
        "sourcePrototypeFeatures": [
            "intent_to_blocks",
            "layout",
            "bom",
            "build",
            "wall_bays",
            "exterior_openings",
            "interior_doors",
            "removed_interior_walls",
            "full_and_frame_model_variants",
        ],
        "plan": plan,
        "settings": settings,
        "structuralLayout": structural_layout,
        "bom": bom,
        "ruleChecks": rule_checks,
    }

    artifacts: list[WorkerArtifact] = [
        write_json_artifact(
            job,
            "steel_platform_design_package.json",
            manifest,
            role="steel_platform_design_package",
            metadata={
                "schema": manifest["schema"],
                "reviewState": manifest["reviewState"],
                "columns": len(structural_layout["columns"]),
                "beams": len(structural_layout["mainBeams"]),
            },
        ),
        write_json_artifact(
            job,
            "steel_platform_bom.json",
            bom,
            role="steel_platform_bom",
            metadata={
                "schema": "architoken.steel_platform_bom.v1",
                "totalSteelT": bom["summary"]["totalSteelT"],
                "rowCount": len(bom["rows"]),
            },
        ),
    ]

    requested_formats = _requested_formats(job.input)
    geometry_formats = requested_formats & {"step", "stp", "stl", "gltf", "glb"}
    if geometry_formats:
        if not ensure_python_dependency("build123d"):
            return WorkerResult(
                job_id=job.job_id,
                status="blocked",
                artifacts=tuple(artifacts),
                output={
                    "adapter": "steel_platform",
                    "available": False,
                    "reason": "missing Python dependency: build123d",
                    "installHint": "Install build123d/OCP in the isolated worker image to generate real STEP/STL/glTF geometry. The JSON design package and BOM were still persisted as review-required artifacts.",
                    "geometryRequested": sorted(geometry_formats),
                    "reviewState": manifest["reviewState"],
                },
                error={
                    "code": "adapter_not_configured",
                    "message": "missing Python dependency: build123d",
                },
            )
        artifacts.extend(_build_geometry_artifacts(job, structural_layout, settings, geometry_formats))

    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple(artifacts),
        output={
            "adapter": "steel_platform",
            "schema": manifest["schema"],
            "reviewState": manifest["reviewState"],
            "columnCount": len(structural_layout["columns"]),
            "beamCount": len(structural_layout["mainBeams"]),
            "bomRows": len(bom["rows"]),
            "totalSteelT": bom["summary"]["totalSteelT"],
            "artifactCount": len(artifacts),
            "geometryFormats": sorted(geometry_formats),
        },
    )


def _normalize_plan(input_payload: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
    raw_plan = input_payload.get("plan") or input_payload.get("floorplan") or input_payload
    if not isinstance(raw_plan, dict):
        return {}, "plan must be an object"
    raw_blocks = raw_plan.get("blocks")
    if not isinstance(raw_blocks, list) or not raw_blocks:
        return {}, "plan.blocks must be a non-empty list"

    blocks: list[dict[str, Any]] = []
    for index, raw_block in enumerate(raw_blocks):
        if not isinstance(raw_block, dict):
            return {}, f"plan.blocks[{index}] must be an object"
        polygon = _normalize_polygon(raw_block.get("polygon"))
        if len(polygon) < 4:
            return {}, f"plan.blocks[{index}].polygon must contain at least 4 points"
        floor = int(raw_block.get("floor") or 1)
        purpose = str(raw_block.get("purpose") or raw_block.get("name") or f"房间{index + 1}")
        block_id = str(raw_block.get("id") or f"R-{index + 1}")
        blocks.append(
            {
                "id": block_id,
                "purpose": purpose,
                "polygon": polygon,
                "floor": floor,
                "areaSqm": round(_polygon_area(polygon) / 1_000_000, 2),
            }
        )

    outline = _normalize_polygon(raw_plan.get("outline_polygon") or raw_plan.get("outlinePolygon"))
    if len(outline) < 4:
        outline = _bounding_polygon([point for block in blocks for point in block["polygon"]])
    floors = int(raw_plan.get("floors") or max(block["floor"] for block in blocks))
    return {
        "projectName": str(raw_plan.get("projectName") or raw_plan.get("name") or "深化设计钢平台"),
        "floors": max(1, floors),
        "outlinePolygon": outline,
        "blocks": blocks,
        "exteriorOpenings": _normalize_openings(raw_plan.get("exterior_openings") or raw_plan.get("exteriorOpenings") or []),
        "interiorDoors": _normalize_interior_doors(raw_plan.get("interior_doors") or raw_plan.get("interiorDoors") or []),
        "removedInteriorWallIds": [
            str(item)
            for item in (raw_plan.get("removed_interior_walls") or raw_plan.get("removedInteriorWallIds") or [])
            if str(item).strip()
        ],
        "summary": {
            "blockCount": len(blocks),
            "grossAreaSqm": round(sum(block["areaSqm"] for block in blocks), 2),
            "envelope": _envelope(outline),
        },
    }, None


def _settings(input_payload: dict[str, Any]) -> dict[str, Any]:
    raw = input_payload.get("steelPlatform") if isinstance(input_payload.get("steelPlatform"), dict) else {}
    assert isinstance(raw, dict)
    return {
        "modulusMm": _positive_int(raw.get("modulusMm"), MODULUS_MM),
        "maxSpanMm": _positive_int(raw.get("maxSpanMm"), DEFAULT_MAX_SPAN_MM),
        "floorHeightMm": _positive_int(raw.get("floorHeightMm"), DEFAULT_FLOOR_HEIGHT_MM),
        "mainColumnSection": str(raw.get("mainColumnSection") or "150x150x7x10"),
        "mainBeamSection": str(raw.get("mainBeamSection") or "150x194x6x9"),
        "constructionColumnSection": str(raw.get("constructionColumnSection") or "40x40x2"),
        "interiorWallSection": str(raw.get("interiorWallSection") or "40x40x2"),
        "roofType": str(raw.get("roofType") or "双坡"),
        "roofRidgeAxis": str(raw.get("roofRidgeAxis") or "X"),
        "roofSlopeDeg": _positive_int(raw.get("roofSlopeDeg"), 25),
        "eaveOverhangMm": _positive_int(raw.get("eaveOverhangMm"), 600),
        "purlinSpacingMm": _positive_int(raw.get("purlinSpacingMm"), 900),
        "constructionColumnEnabled": bool(raw.get("constructionColumnEnabled", True)),
        "interiorWallEnabled": bool(raw.get("interiorWallEnabled", True)),
        "constructionColumnFirstOffsetMm": _positive_int(raw.get("constructionColumnFirstOffsetMm"), 250),
        "constructionColumnSecondOffsetMm": _positive_int(raw.get("constructionColumnSecondOffsetMm"), 600),
        "constructionColumnSpacingMm": _positive_int(raw.get("constructionColumnSpacingMm"), 600),
    }


def _derive_structural_layout(plan: dict[str, Any], settings: dict[str, Any]) -> dict[str, Any]:
    outline = plan["outlinePolygon"]
    min_x, min_y, max_x, max_y = _bounds(outline)
    x_lines = _grid_lines(min_x, max_x, int(settings["maxSpanMm"]), int(settings["modulusMm"]))
    y_lines = _grid_lines(min_y, max_y, int(settings["maxSpanMm"]), int(settings["modulusMm"]))
    floor_height = int(settings["floorHeightMm"])
    floors = int(plan["floors"])

    columns = []
    for floor in range(1, floors + 1):
        z_base = (floor - 1) * floor_height
        for x_index, x in enumerate(x_lines):
            for y_index, y in enumerate(y_lines):
                if not _point_inside_or_on((x, y), outline):
                    continue
                grid_id = f"{_axis_letter(x_index)}{y_index + 1}"
                columns.append(
                    {
                        "id": f"C-{grid_id}-F{floor}",
                        "gridId": grid_id,
                        "floor": floor,
                        "section": settings["mainColumnSection"],
                        "location": [x, y, z_base + floor_height / 2],
                        "netLengthMm": floor_height - 36,
                    }
                )

    beams = []
    for floor in range(1, floors + 1):
        level_id = f"F{floor + 1}" if floor < floors else "FR"
        z = floor * floor_height - 97
        for y_index, y in enumerate(y_lines):
            for x_index in range(len(x_lines) - 1):
                x1 = x_lines[x_index]
                x2 = x_lines[x_index + 1]
                midpoint = ((x1 + x2) / 2, y)
                if not _segment_inside((x1, y), (x2, y), outline):
                    continue
                beams.append(
                    {
                        "id": f"B-X-{_axis_letter(x_index)}{_axis_letter(x_index + 1)}-{y_index + 1}-F{floor}",
                        "axis": "X",
                        "floor": floor,
                        "levelId": level_id,
                        "section": settings["mainBeamSection"],
                        "from": [x1, y],
                        "to": [x2, y],
                        "midpoint": [midpoint[0], midpoint[1], z],
                        "netLengthMm": abs(x2 - x1) - 150,
                        "rotationDeg": 0,
                    }
                )
        for x_index, x in enumerate(x_lines):
            for y_index in range(len(y_lines) - 1):
                y1 = y_lines[y_index]
                y2 = y_lines[y_index + 1]
                midpoint = (x, (y1 + y2) / 2)
                if not _segment_inside((x, y1), (x, y2), outline):
                    continue
                beams.append(
                    {
                        "id": f"B-Y-{_axis_letter(x_index)}-{y_index + 1}{y_index + 2}-F{floor}",
                        "axis": "Y",
                        "floor": floor,
                        "levelId": level_id,
                        "section": settings["mainBeamSection"],
                        "from": [x, y1],
                        "to": [x, y2],
                        "midpoint": [midpoint[0], midpoint[1], z],
                        "netLengthMm": abs(y2 - y1) - 150,
                        "rotationDeg": 90,
                    }
                )

    wall_bays = _wall_bays(outline, x_lines, y_lines, floors)
    exterior_openings = _bind_openings_to_bays(plan.get("exteriorOpenings", []), wall_bays)
    construction_groups = (
        _construction_column_groups(wall_bays, exterior_openings, settings)
        if settings["constructionColumnEnabled"]
        else []
    )
    construction_columns = _construction_columns_from_groups(construction_groups, settings)
    interior_walls = (
        _interior_walls(
            plan["blocks"],
            outline,
            plan.get("interiorDoors", []),
            plan.get("removedInteriorWallIds", []),
            exterior_openings,
            settings,
        )
        if settings["interiorWallEnabled"]
        else []
    )
    slabs = [
        {
            "id": f"FS-F{floor}",
            "floor": floor,
            "polygon": outline,
            "areaSqm": round(_polygon_area(outline) / 1_000_000, 2),
        }
        for floor in range(1, floors + 1)
    ]
    return {
        "grid": {"xAxes": x_lines, "yAxes": y_lines, "levels": floors + 1},
        "columns": columns,
        "mainBeams": beams,
        "constructionColumns": construction_columns,
        "constructionColumnGroups": construction_groups,
        "wallBays": wall_bays,
        "exteriorOpenings": exterior_openings,
        "interiorWalls": interior_walls,
        "removedInteriorWallIds": plan.get("removedInteriorWallIds", []),
        "floorSlabs": slabs,
        "roof": {
            "type": settings["roofType"],
            "ridgeAxis": settings["roofRidgeAxis"],
            "slopeDeg": settings["roofSlopeDeg"],
            "eaveOverhangMm": settings["eaveOverhangMm"],
            "purlinSpacingMm": settings["purlinSpacingMm"],
            "baseZ": floors * floor_height,
            "projectionAreaSqm": round(_polygon_area(outline) / 1_000_000, 2),
            "surfaceAreaSqm": round(_roof_surface_area(outline, settings), 2),
            "purlinLengthM": round(_roof_purlin_length(outline, settings) / 1000, 2),
        },
        "outlinePolygon": outline,
    }


def _compute_bom(layout: dict[str, Any], settings: dict[str, Any]) -> dict[str, Any]:
    rows = []
    column_length = sum(float(column["netLengthMm"]) for column in layout["columns"])
    beam_length = sum(max(0.0, float(beam["netLengthMm"])) for beam in layout["mainBeams"])
    construction_length = sum(float(column["heightMm"]) for column in layout["constructionColumns"])
    interior_length = sum(
        len(wall["columnLocations"]) * (int(settings["floorHeightMm"]) - 194)
        for wall in layout.get("interiorWalls", [])
        if not wall.get("removed")
    )
    slab_area = sum(float(slab["areaSqm"]) for slab in layout["floorSlabs"])
    roof_area = float(layout["roof"]["surfaceAreaSqm"])
    wall_area = sum(
        float(bay["lengthMm"]) * (int(settings["floorHeightMm"]) - 194) / 1_000_000
        for bay in layout.get("wallBays", [])
    )
    opening_area = sum(
        float(opening["widthMm"]) * float(opening["heightMm"]) / 1_000_000
        for opening in layout.get("exteriorOpenings", [])
    )
    interior_wall_area = sum(
        float(wall["lengthMm"]) * (int(settings["floorHeightMm"]) - 194) / 1_000_000
        for wall in layout.get("interiorWalls", [])
        if not wall.get("removed")
    )

    if column_length:
        rows.append(_bom_row("主体结构", f"钢柱 {settings['mainColumnSection']}", len(layout["columns"]), column_length, None, settings["mainColumnSection"]))
    if beam_length:
        rows.append(_bom_row("主体结构", f"主梁 {settings['mainBeamSection']}", len(layout["mainBeams"]), beam_length, None, settings["mainBeamSection"]))
    if construction_length:
        rows.append(_bom_row("围护骨架", f"构造柱 {settings['constructionColumnSection']}", len(layout["constructionColumns"]), construction_length, None, settings["constructionColumnSection"]))
    if interior_length:
        rows.append(_bom_row("内墙龙骨", f"内墙竖龙骨 {settings['interiorWallSection']}", sum(len(w["columnLocations"]) for w in layout.get("interiorWalls", []) if not w.get("removed")), interior_length, None, settings["interiorWallSection"]))
    if slab_area:
        rows.append({"category": "楼板", "item": "楼承板+混凝土叠合层", "count": len(layout["floorSlabs"]), "lengthM": None, "areaM2": round(slab_area, 2), "weightT": None})
    rows.append({"category": "围护板材", "item": "外墙 ALC/围护板", "count": None, "lengthM": None, "areaM2": round(max(0.0, wall_area - opening_area), 2), "weightT": None})
    rows.append({"category": "围护洞口", "item": "门窗洞口", "count": len(layout.get("exteriorOpenings", [])), "lengthM": None, "areaM2": round(opening_area, 2), "weightT": None})
    rows.append({"category": "内墙", "item": "内墙板/基层", "count": sum(1 for wall in layout.get("interiorWalls", []) if not wall.get("removed")), "lengthM": None, "areaM2": round(interior_wall_area, 2), "weightT": None})
    rows.append({"category": "围护板材", "item": "屋面板", "count": None, "lengthM": None, "areaM2": round(roof_area, 2), "weightT": None})
    rows.append({"category": "屋面系统", "item": f"檩条 C160x60x3 @{settings['purlinSpacingMm']}", "count": None, "lengthM": layout["roof"]["purlinLengthM"], "areaM2": None, "weightT": None})
    return {
        "schema": "architoken.steel_platform_bom.v1",
        "rows": rows,
        "summary": {
            "totalSteelT": round(sum(float(row.get("weightT") or 0) for row in rows), 3),
            "totalMemberCount": len(layout["columns"]) + len(layout["mainBeams"]) + len(layout["constructionColumns"]) + sum(len(w["columnLocations"]) for w in layout.get("interiorWalls", []) if not w.get("removed")),
            "floorAreaM2": round(slab_area, 2),
            "roofAreaM2": round(roof_area, 2),
        },
    }


def _rule_checks(plan: dict[str, Any], layout: dict[str, Any], settings: dict[str, Any]) -> list[dict[str, Any]]:
    checks = [
        {
            "id": "grid-modulus",
            "title": "300mm 模数检查",
            "status": "passed" if _all_points_on_modulus(plan["outlinePolygon"], int(settings["modulusMm"])) else "professional_review_required",
            "sourceRef": "项目模数规则 / 经验规则",
        },
        {
            "id": "member-span",
            "title": "主梁跨距上限",
            "status": "passed" if all(float(beam["netLengthMm"]) <= float(settings["maxSpanMm"]) for beam in layout["mainBeams"]) else "professional_review_required",
            "sourceRef": "GB 50017 / 结构工程师复核",
        },
        {
            "id": "steel-bom",
            "title": "钢构件 BOM 完整性",
            "status": "passed" if layout["columns"] and layout["mainBeams"] else "professional_review_required",
            "sourceRef": "生产制造移交规则",
        },
        {
            "id": "opening-enclosure",
            "title": "门窗与围护同步",
            "status": "passed"
            if all(any(bay["id"] == opening.get("bayId") for bay in layout.get("wallBays", [])) for opening in layout.get("exteriorOpenings", []))
            else "professional_review_required",
            "sourceRef": "外墙 bay / 内墙龙骨启发式校验",
        },
        {
            "id": "professional-signoff",
            "title": "结构与施工责任复核",
            "status": "professional_review_required",
            "sourceRef": "注册结构工程师 / 设计总工签审",
        },
    ]
    return checks


def _build_geometry_artifacts(
    job: ConversionJob,
    layout: dict[str, Any],
    settings: dict[str, Any],
    formats: set[str],
) -> list[WorkerArtifact]:
    from build123d import Box, Compound, Location, export_gltf, export_step, export_stl

    children = []
    for column in layout["columns"]:
        x, y, z = column["location"]
        member = Box(150, 150, float(column["netLengthMm"])).moved(Location((x, y, z)))
        member.label = str(column["id"])
        children.append(member)
    for beam in layout["mainBeams"]:
        x, y, z = beam["midpoint"]
        length = max(1.0, float(beam["netLengthMm"]))
        if beam["axis"] == "X":
            member = Box(length, 150, 194).moved(Location((x, y, z)))
        else:
            member = Box(150, length, 194).moved(Location((x, y, z)))
        member.label = str(beam["id"])
        children.append(member)
    frame = Compound(label="ArchIToken steel platform frame", children=children)
    out_dir = output_dir(job)
    artifacts: list[WorkerArtifact] = []
    if {"step", "stp"} & formats:
        path = out_dir / "steel_platform_frame.step"
        export_step(frame, str(path))
        artifacts.append(artifact_for_path(path, job=job, media_type="model/step", role="steel_platform_step", metadata={"engine": "build123d", "section": settings["mainBeamSection"]}))
    if "stl" in formats:
        path = out_dir / "steel_platform_frame.stl"
        export_stl(frame, str(path))
        artifacts.append(artifact_for_path(path, job=job, media_type="model/stl", role="steel_platform_stl", metadata={"engine": "build123d"}))
    if {"gltf", "glb"} & formats:
        path = out_dir / "steel_platform_frame.gltf"
        export_gltf(frame, str(path), binary=False)
        artifacts.append(artifact_for_path(path, job=job, media_type="model/gltf+json", role="steel_platform_gltf", metadata={"engine": "build123d"}))
    return artifacts


def _requested_formats(input_payload: dict[str, Any]) -> set[str]:
    raw = input_payload.get("outputFormats") or input_payload.get("formats") or ["json"]
    if not isinstance(raw, list):
        return {"json"}
    return {str(item).lower().lstrip(".") for item in raw if str(item).strip()}


def _normalize_polygon(raw: Any) -> list[list[float]]:
    if not isinstance(raw, list):
        return []
    points: list[list[float]] = []
    for point in raw:
        if isinstance(point, dict):
            x = point.get("x")
            y = point.get("y")
        elif isinstance(point, list | tuple) and len(point) >= 2:
            x, y = point[0], point[1]
        else:
            continue
        if isinstance(x, int | float) and isinstance(y, int | float):
            points.append([float(x), float(y)])
    return points


def _normalize_openings(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    openings = []
    for index, item in enumerate(raw):
        if not isinstance(item, dict):
            continue
        openings.append({
            "id": str(item.get("id") or f"OP-{index + 1}"),
            "bayId": str(item.get("bayId") or item.get("bay_id") or ""),
            "wallSide": str(item.get("wallSide") or item.get("wall_side") or "south"),
            "centerMm": float(item.get("centerMm") or item.get("center") or 3000),
            "widthMm": float(item.get("widthMm") or item.get("width") or 1200),
            "heightMm": float(item.get("heightMm") or item.get("height") or 1500),
            "sillMm": float(item.get("sillMm") or item.get("sill") or 900),
            "openingType": str(item.get("openingType") or item.get("opening_type") or "window"),
            "frameType": str(item.get("frameType") or item.get("frame_type") or "4-edge"),
            "floor": int(item.get("floor") or 1),
        })
    return openings


def _normalize_interior_doors(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    doors = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        wall_id = str(item.get("wallId") or item.get("wall_id") or "")
        if not wall_id:
            continue
        doors.append({
            "wallId": wall_id,
            "positionMm": float(item.get("positionMm") or item.get("position") or 0),
            "flip": int(item.get("flip") or 0) % 4,
        })
    return doors


def _bounding_polygon(points: list[list[float]]) -> list[list[float]]:
    min_x, min_y, max_x, max_y = _bounds(points)
    return [[min_x, min_y], [max_x, min_y], [max_x, max_y], [min_x, max_y]]


def _bounds(points: list[list[float]]) -> tuple[float, float, float, float]:
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return min(xs), min(ys), max(xs), max(ys)


def _envelope(points: list[list[float]]) -> list[int]:
    min_x, min_y, max_x, max_y = _bounds(points)
    return [int(round(max_x - min_x)), int(round(max_y - min_y))]


def _polygon_area(points: list[list[float]]) -> float:
    area = 0.0
    for index, point in enumerate(points):
        next_point = points[(index + 1) % len(points)]
        area += point[0] * next_point[1] - next_point[0] * point[1]
    return abs(area) / 2


def _grid_lines(start: float, end: float, max_span: int, modulus: int) -> list[float]:
    length = max(0.0, end - start)
    if length <= 0:
        return [start]
    segments = max(1, math.ceil(length / max_span))
    raw_spacing = length / segments
    spacing = max(float(modulus), round(raw_spacing / modulus) * modulus)
    lines = [start]
    current = start
    while current + spacing < end - modulus:
        current += spacing
        lines.append(round(current, 3))
    if lines[-1] != end:
        lines.append(end)
    return lines


def _axis_letter(index: int) -> str:
    if index < 26:
        return chr(ord("A") + index)
    return f"A{index - 25}"


def _point_inside_or_on(point: tuple[float, float], polygon: list[list[float]]) -> bool:
    x, y = point
    inside = False
    count = len(polygon)
    for index in range(count):
        x1, y1 = polygon[index]
        x2, y2 = polygon[(index + 1) % count]
        if _point_on_segment(point, (x1, y1), (x2, y2)):
            return True
        intersects = (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / ((y2 - y1) or 1e-9) + x1
        if intersects:
            inside = not inside
    return inside


def _point_on_segment(point: tuple[float, float], start: tuple[float, float], end: tuple[float, float], tolerance: float = 1e-6) -> bool:
    x, y = point
    x1, y1 = start
    x2, y2 = end
    cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)
    if abs(cross) > tolerance:
        return False
    return min(x1, x2) - tolerance <= x <= max(x1, x2) + tolerance and min(y1, y2) - tolerance <= y <= max(y1, y2) + tolerance


def _segment_inside(start: tuple[float, float], end: tuple[float, float], polygon: list[list[float]]) -> bool:
    midpoint = ((start[0] + end[0]) / 2, (start[1] + end[1]) / 2)
    return _point_inside_or_on(start, polygon) and _point_inside_or_on(end, polygon) and _point_inside_or_on(midpoint, polygon)


def _wall_bays(outline: list[list[float]], x_lines: list[float], y_lines: list[float], floors: int) -> list[dict[str, Any]]:
    bays: list[dict[str, Any]] = []
    min_x, min_y, max_x, max_y = _bounds(outline)
    for floor in range(1, floors + 1):
        for edge_index, start in enumerate(outline):
            end = outline[(edge_index + 1) % len(outline)]
            axis = "X" if abs(end[0] - start[0]) >= abs(end[1] - start[1]) else "Y"
            values = x_lines if axis == "X" else y_lines
            a = start[0] if axis == "X" else start[1]
            b = end[0] if axis == "X" else end[1]
            lo, hi = min(a, b), max(a, b)
            split = sorted({lo, hi, *[value for value in values if lo < value < hi]})
            side = _wall_side(start, end, (min_x, min_y, max_x, max_y))
            for index in range(len(split) - 1):
                v1, v2 = split[index], split[index + 1]
                if axis == "X":
                    p1, p2 = [v1, start[1]], [v2, end[1]]
                else:
                    p1, p2 = [start[0], v1], [end[0], v2]
                if a > b:
                    p1, p2 = p2, p1
                length = math.dist(p1, p2)
                if length < 300:
                    continue
                bays.append({
                    "id": f"WB-{side}-E{edge_index + 1}-{index + 1}-F{floor}",
                    "wallSide": side,
                    "floor": floor,
                    "start": p1,
                    "end": p2,
                    "axis": axis,
                    "lengthMm": round(length, 3),
                })
    return bays


def _wall_side(start: list[float], end: list[float], box: tuple[float, float, float, float]) -> str:
    min_x, min_y, max_x, max_y = box
    mid_x = (start[0] + end[0]) / 2
    mid_y = (start[1] + end[1]) / 2
    if abs(end[0] - start[0]) >= abs(end[1] - start[1]):
        return "south" if abs(mid_y - min_y) <= abs(mid_y - max_y) else "north"
    return "west" if abs(mid_x - min_x) <= abs(mid_x - max_x) else "east"


def _bind_openings_to_bays(openings: list[dict[str, Any]], bays: list[dict[str, Any]]) -> list[dict[str, Any]]:
    bound = []
    for index, opening in enumerate(openings):
        bay = next((item for item in bays if item["id"] == opening.get("bayId")), None)
        if bay is None:
            candidates = [
                item for item in bays
                if item["wallSide"] == opening.get("wallSide") and item["floor"] == int(opening.get("floor") or 1)
            ]
            center = float(opening.get("centerMm") or opening.get("center") or 0)
            bay = min(candidates, key=lambda item: abs(center - (_bay_min(item) + _bay_max(item)) / 2), default=None)
        if bay is None:
            continue
        width = float(opening.get("widthMm") or opening.get("width") or 1200)
        center = float(opening.get("centerMm") or opening.get("center") or (_bay_min(bay) + _bay_max(bay)) / 2)
        center = max(_bay_min(bay) + width / 2, min(_bay_max(bay) - width / 2, center))
        bound.append({
            "id": str(opening.get("id") or f"OP-{index + 1}"),
            "bayId": bay["id"],
            "wallSide": bay["wallSide"],
            "centerMm": round(center, 3),
            "widthMm": width,
            "heightMm": float(opening.get("heightMm") or opening.get("height") or 1500),
            "sillMm": float(opening.get("sillMm") or opening.get("sill") or 900),
            "openingType": str(opening.get("openingType") or opening.get("opening_type") or "window"),
            "frameType": str(opening.get("frameType") or opening.get("frame_type") or "4-edge"),
            "floor": bay["floor"],
        })
    return bound


def _construction_column_groups(bays: list[dict[str, Any]], openings: list[dict[str, Any]], settings: dict[str, Any]) -> list[dict[str, Any]]:
    groups = []
    for bay in bays:
        groups.append({
            "id": f"CCG-{bay['id']}",
            "wallSide": bay["wallSide"],
            "floor": bay["floor"],
            "start": bay["start"],
            "end": bay["end"],
            "axis": bay["axis"],
            "columnLocations": _column_locations(
                bay["start"],
                bay["end"],
                float(settings["constructionColumnFirstOffsetMm"]),
                float(settings["constructionColumnSecondOffsetMm"]),
                float(settings["constructionColumnSpacingMm"]),
            ),
            "openings": [opening for opening in openings if opening.get("bayId") == bay["id"]],
        })
    return groups


def _construction_columns_from_groups(groups: list[dict[str, Any]], settings: dict[str, Any]) -> list[dict[str, Any]]:
    columns = []
    floor_height = int(settings["floorHeightMm"])
    for group in groups:
        z_base = (int(group["floor"]) - 1) * floor_height
        for index, point in enumerate(group["columnLocations"]):
            columns.append({
                "id": f"CC-{group['id']}-{index + 1}",
                "floor": group["floor"],
                "section": settings["constructionColumnSection"],
                "location": [round(point[0], 3), round(point[1], 3), z_base + (floor_height - 194) / 2],
                "heightMm": floor_height - 194,
                "groupId": group["id"],
            })
    return columns


def _interior_walls(
    blocks: list[dict[str, Any]],
    outline: list[list[float]],
    doors: list[dict[str, Any]],
    removed_ids: list[str],
    openings: list[dict[str, Any]],
    settings: dict[str, Any],
) -> list[dict[str, Any]]:
    candidates: dict[str, dict[str, Any]] = {}
    for block in blocks:
        polygon = block["polygon"]
        for index, start in enumerate(polygon):
            end = polygon[(index + 1) % len(polygon)]
            length = math.dist(start, end)
            if length < int(settings["modulusMm"]) * 4 or _segment_on_outline(start, end, outline):
                continue
            key = _segment_key(start, end, int(block["floor"]))
            if key not in candidates:
                candidates[key] = {
                    "floor": int(block["floor"]),
                    "start": start,
                    "end": end,
                    "axis": "X" if abs(end[0] - start[0]) >= abs(end[1] - start[1]) else "Y",
                    "count": 0,
                }
            candidates[key]["count"] += 1
    walls = []
    for index, candidate in enumerate(candidates.values()):
        wall_id = f"IW-F{candidate['floor']}-{index + 1}"
        door = next((item for item in doors if item.get("wallId") == wall_id or item.get("wall_id") == wall_id), None)
        walls.append({
            "id": wall_id,
            "floor": candidate["floor"],
            "start": candidate["start"],
            "end": candidate["end"],
            "axis": candidate["axis"],
            "lengthMm": round(math.dist(candidate["start"], candidate["end"]), 3),
            "removed": wall_id in removed_ids,
            "hitExteriorOpening": _wall_hits_opening(candidate, openings),
            "door": door,
            "columnLocations": _column_locations(
                candidate["start"],
                candidate["end"],
                float(settings["constructionColumnFirstOffsetMm"]),
                float(settings["constructionColumnSecondOffsetMm"]),
                float(settings["constructionColumnSpacingMm"]),
            ),
        })
    return walls


def _column_locations(start: list[float], end: list[float], first: float, second: float, spacing: float) -> list[list[float]]:
    length = math.dist(start, end)
    if length < first * 2:
        return []
    offsets = [first, second]
    current = second + spacing
    while current < length - first:
        offsets.append(current)
        current += spacing
    points = []
    for offset in offsets:
        if offset <= 0 or offset >= length:
            continue
        ratio = offset / length
        points.append([
            round(start[0] + (end[0] - start[0]) * ratio, 3),
            round(start[1] + (end[1] - start[1]) * ratio, 3),
        ])
    return points


def _roof_surface_area(outline: list[list[float]], settings: dict[str, Any]) -> float:
    area = _polygon_area(outline) / 1_000_000
    if settings["roofType"] == "平":
        return area
    return area / math.cos(math.radians(float(settings["roofSlopeDeg"])))


def _roof_purlin_length(outline: list[list[float]], settings: dict[str, Any]) -> float:
    min_x, min_y, max_x, max_y = _bounds(outline)
    width = max_x - min_x + int(settings["eaveOverhangMm"]) * 2
    depth = max_y - min_y + int(settings["eaveOverhangMm"]) * 2
    along = width if settings["roofRidgeAxis"] == "X" else depth
    across = depth if settings["roofRidgeAxis"] == "X" else width
    count = max(2, math.ceil(across / int(settings["purlinSpacingMm"])) + 1)
    multiplier = 1 if settings["roofType"] == "平" else 1 / math.cos(math.radians(float(settings["roofSlopeDeg"])))
    return along * count * multiplier


def _bay_min(bay: dict[str, Any]) -> float:
    return min(bay["start"][0], bay["end"][0]) if bay["axis"] == "X" else min(bay["start"][1], bay["end"][1])


def _bay_max(bay: dict[str, Any]) -> float:
    return max(bay["start"][0], bay["end"][0]) if bay["axis"] == "X" else max(bay["start"][1], bay["end"][1])


def _segment_on_outline(start: list[float], end: list[float], outline: list[list[float]]) -> bool:
    return any(
        _point_on_segment(tuple(start), tuple(edge_start), tuple(edge_end))
        and _point_on_segment(tuple(end), tuple(edge_start), tuple(edge_end))
        for edge_start, edge_end in zip(outline, outline[1:] + outline[:1])
    )


def _segment_key(start: list[float], end: list[float], floor: int) -> str:
    a = f"{round(start[0], 3)},{round(start[1], 3)}"
    b = f"{round(end[0], 3)},{round(end[1], 3)}"
    return f"{floor}:{'|'.join(sorted([a, b]))}"


def _wall_hits_opening(wall: dict[str, Any], openings: list[dict[str, Any]]) -> bool:
    for opening in openings:
        if int(opening.get("floor") or 1) != int(wall["floor"]):
            continue
        center = float(opening["centerMm"])
        half = float(opening["widthMm"]) / 2
        for point in [wall["start"], wall["end"]]:
            axis_value = point[0] if opening["wallSide"] in {"south", "north"} else point[1]
            if center - half <= axis_value <= center + half:
                return True
    return False


def _bom_row(category: str, item: str, count: int, length_mm: float, area_m2: float | None, section: str) -> dict[str, Any]:
    length_m = length_mm / 1000
    return {
        "category": category,
        "item": item,
        "count": count,
        "lengthM": round(length_m, 2),
        "areaM2": area_m2,
        "weightT": round(_section_kg_per_m(section) * length_m / 1000, 3),
    }


def _section_kg_per_m(section: str) -> float:
    try:
        parts = [float(item) for item in section.lower().replace("x", "×").split("×")]
    except ValueError:
        return 0.0
    if len(parts) == 4:
        h, b, tw, tf = parts
        area_mm2 = 2 * b * tf + max(0.0, h - 2 * tf) * tw
    elif len(parts) == 3:
        w, h, t = parts
        area_mm2 = w * h - max(0.0, w - 2 * t) * max(0.0, h - 2 * t)
    else:
        return 0.0
    return area_mm2 * 1e-6 * STEEL_DENSITY_KG_M3


def _all_points_on_modulus(points: list[list[float]], modulus: int) -> bool:
    return all(abs(coord % modulus) < 1e-6 for point in points for coord in point)


def _positive_int(value: Any, fallback: int) -> int:
    return int(value) if isinstance(value, int | float) and value > 0 else fallback
