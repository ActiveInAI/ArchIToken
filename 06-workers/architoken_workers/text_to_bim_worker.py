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
    site = model.create_entity("IfcSite", GlobalId=guid(), Name=str(spec.get("siteName", "Default Site")))
    building = model.create_entity("IfcBuilding", GlobalId=guid(), Name=str(spec.get("buildingName", spec["name"])))
    storey = model.create_entity("IfcBuildingStorey", GlobalId=guid(), Name=str(spec.get("storeyName", "Level 1")))
    model.create_entity("IfcRelAggregates", GlobalId=guid(), RelatingObject=project, RelatedObjects=[site])
    model.create_entity("IfcRelAggregates", GlobalId=guid(), RelatingObject=site, RelatedObjects=[building])
    model.create_entity("IfcRelAggregates", GlobalId=guid(), RelatingObject=building, RelatedObjects=[storey])

    elements = []
    for element_spec in spec["elements"]:
        element = model.create_entity(
            "IfcBuildingElementProxy",
            GlobalId=guid(),
            Name=str(element_spec.get("name", element_spec["type"])),
            Description=str(element_spec.get("description", "")) or None,
            ObjectType=str(element_spec["type"]),
        )
        elements.append(element)
    if elements:
        model.create_entity(
            "IfcRelContainedInSpatialStructure",
            GlobalId=guid(),
            RelatedElements=elements,
            RelatingStructure=storey,
        )

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
            "elementCount": len(elements),
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
            "elementCount": len(elements),
        },
    )


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
