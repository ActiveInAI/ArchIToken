"""CAD worker adapters backed by ezdxf and OCP/OCCT."""

from __future__ import annotations

import json
import os
import urllib.request
from typing import Any

from .adapter_requirements import missing_env, missing_python_dependency
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, output_dir, require_source_file, write_json_artifact, write_jsonl_artifact


def dxf_extract_entities(job: ConversionJob) -> WorkerResult:
    """Extract real DXF model-space entities with ezdxf."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="ezdxf",
        import_name="ezdxf",
        install_hint="Install ezdxf in the worker image for real DXF parsing.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="ezdxf",
        install_hint="Mount a DXF source file into the worker and pass sourcePath in the job input.",
    )
    if blocked:
        return blocked

    import ezdxf

    document = ezdxf.readfile(source)
    rows = [_dxf_entity_row(entity) for entity in document.modelspace()]
    artifact = write_jsonl_artifact(
        job,
        "dxf_entities.jsonl",
        rows,
        role="cad_entities",
        metadata={"format": "dxf", "engine": "ezdxf"},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={"format": "dxf", "engine": "ezdxf", "entities": len(rows), "sourcePath": str(source)},
    )


def step_metadata(job: ConversionJob) -> WorkerResult:
    """Read STEP/STP metadata through OCP/OCCT."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="ocp",
        import_name="OCP",
        install_hint="Install CadQuery OCP/OCCT bindings in the worker image for real STEP/STP parsing.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="ocp",
        install_hint="Mount a STEP/STP source file into the worker and pass sourcePath in the job input.",
    )
    if blocked:
        return blocked

    shape, metadata = _read_occt_shape(source)
    metadata["boundingBox"] = _shape_bounding_box(shape)
    artifact = write_json_artifact(job, "step_metadata.json", metadata, role="cad_metadata")
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output=metadata,
    )


def occt_adapter(job: ConversionJob) -> WorkerResult:
    """Run an OCCT native conversion path through OCP."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="occt",
        import_name="OCP",
        install_hint="Install OCP or run an OCCT sidecar service before enabling CAD kernel conversion.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="occt",
        install_hint="Mount a CAD exchange file into the worker and pass sourcePath in the job input.",
    )
    if blocked:
        return blocked

    shape, metadata = _read_occt_shape(source)
    from OCP.BRepTools import BRepTools

    brep_path = output_dir(job) / f"{source.stem}.brep"
    ok = BRepTools.Write(shape, str(brep_path))
    if not ok:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            error={"code": "occt_export_failed", "message": f"OCCT failed to write {brep_path}"},
            output=metadata,
        )
    artifact = artifact_for_path(
        brep_path,
        job=job,
        media_type="model/vnd.opencascade.brep",
        role="cad_brep",
        metadata={"engine": "occt", "sourcePath": str(source)},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={"adapter": "occt", "mode": "ocp_native_adapter", **metadata},
    )


def licensed_dwg_adapter(job: ConversionJob) -> WorkerResult:
    """Route DWG conversion/extraction to a configured licensed adapter service."""

    validate_job(job)
    if unavailable := missing_env(
        job,
        adapter="dwg",
        name="DWG_ADAPTER_URL",
        install_hint="Configure a licensed DWG service such as Autodesk APS, ODA-based adapter, or an approved LibreDWG-compatible adapter.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="dwg",
        install_hint="Mount a DWG source file into the worker or pass sourceObjectKey for the licensed DWG service.",
    )
    if blocked:
        return blocked

    base_url = os.environ["DWG_ADAPTER_URL"].rstrip("/")
    payload = {
        "jobId": job.job_id,
        "tenantId": job.tenant_id,
        "projectId": job.project_id,
        "actor": job.actor,
        "operation": job.operation,
        "sourcePath": str(source),
        "sourceObjectKey": job.input.get("sourceObjectKey") or job.input.get("source_object_key"),
        "sourceBucket": job.input.get("sourceBucket") or job.input.get("source_bucket"),
        "sourceFileName": source.name,
        "outputFormats": job.input.get("outputFormats", ["dxf", "step"]),
    }
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    token = os.getenv("DWG_ADAPTER_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        f"{base_url}/v1/convert",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=int(job.input.get("timeoutSeconds", 300))) as response:
        service_response = json.loads(response.read().decode("utf-8"))
    artifact = write_json_artifact(
        job,
        "dwg_adapter_manifest.json",
        {"request": payload, "response": service_response},
        role="dwg_adapter_manifest",
        metadata={"adapter": "dwg"},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={"adapter": "dwg", "mode": "licensed_external_adapter", "response": service_response},
    )


def _dxf_entity_row(entity: Any) -> dict[str, Any]:
    attribs = {}
    for key, value in entity.dxfattribs(drop={"handle"}).items():
        attribs[key] = value if isinstance(value, str | int | float | bool) or value is None else str(value)
    return {
        "handle": entity.dxf.handle,
        "type": entity.dxftype(),
        "layer": entity.dxf.layer,
        "attributes": attribs,
    }


def _read_occt_shape(source: Any) -> tuple[Any, dict[str, Any]]:
    suffix = source.suffix.lower()
    if suffix in {".step", ".stp"}:
        return _read_step_shape(source)
    if suffix in {".iges", ".igs"}:
        return _read_iges_shape(source)
    if suffix == ".stl":
        return _read_stl_shape(source)
    if suffix in {".brep", ".brp"}:
        return _read_brep_shape(source)
    raise ValueError(f"unsupported OCCT CAD source format: {suffix}")


def _read_step_shape(source: Any) -> tuple[Any, dict[str, Any]]:
    from OCP.IFSelect import IFSelect_RetDone
    from OCP.STEPControl import STEPControl_Reader

    reader = STEPControl_Reader()
    status = reader.ReadFile(str(source))
    if status != IFSelect_RetDone:
        raise ValueError(f"OCCT failed to read STEP file: {source}")
    root_count = reader.NbRootsForTransfer()
    transferred = reader.TransferRoots()
    shape = reader.OneShape()
    return shape, {
        "format": "step",
        "engine": "occt",
        "schema": "AP203/AP214/AP242",
        "rootCount": root_count,
        "transferredRootCount": transferred,
        "sourcePath": str(source),
    }


def _read_iges_shape(source: Any) -> tuple[Any, dict[str, Any]]:
    from OCP.IFSelect import IFSelect_RetDone
    from OCP.IGESControl import IGESControl_Reader

    reader = IGESControl_Reader()
    status = reader.ReadFile(str(source))
    if status != IFSelect_RetDone:
        raise ValueError(f"OCCT failed to read IGES file: {source}")
    root_count = reader.NbRootsForTransfer()
    transferred = reader.TransferRoots()
    shape = reader.OneShape()
    return shape, {
        "format": "iges",
        "engine": "occt",
        "schema": "IGES",
        "rootCount": root_count,
        "transferredRootCount": transferred,
        "sourcePath": str(source),
    }


def _read_stl_shape(source: Any) -> tuple[Any, dict[str, Any]]:
    from OCP.StlAPI import StlAPI_Reader
    from OCP.TopoDS import TopoDS_Shape

    shape = TopoDS_Shape()
    ok = StlAPI_Reader().Read(shape, str(source))
    if not ok:
        raise ValueError(f"OCCT failed to read STL file: {source}")
    return shape, {
        "format": "stl",
        "engine": "occt",
        "schema": "STL",
        "rootCount": 1,
        "transferredRootCount": 1,
        "sourcePath": str(source),
    }


def _read_brep_shape(source: Any) -> tuple[Any, dict[str, Any]]:
    from OCP.BRep import BRep_Builder
    from OCP.BRepTools import BRepTools
    from OCP.TopoDS import TopoDS_Shape

    shape = TopoDS_Shape()
    builder = BRep_Builder()
    ok = BRepTools.Read(shape, str(source), builder)
    if not ok:
        raise ValueError(f"OCCT failed to read BREP file: {source}")
    return shape, {
        "format": "brep",
        "engine": "occt",
        "schema": "OpenCASCADE BREP",
        "rootCount": 1,
        "transferredRootCount": 1,
        "sourcePath": str(source),
    }


def _shape_bounding_box(shape: Any) -> dict[str, float] | None:
    try:
        from OCP.Bnd import Bnd_Box
        from OCP.BRepBndLib import BRepBndLib

        box = Bnd_Box()
        BRepBndLib.Add(shape, box)
        xmin, ymin, zmin, xmax, ymax, zmax = box.Get()
        return {"xmin": xmin, "ymin": ymin, "zmin": zmin, "xmax": xmax, "ymax": ymax, "zmax": zmax}
    except Exception:  # noqa: BLE001 - bounding boxes are diagnostic metadata, not conversion-critical.
        return None
