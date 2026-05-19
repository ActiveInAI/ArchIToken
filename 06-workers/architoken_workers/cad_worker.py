"""CAD worker adapters backed by ezdxf and OCP/OCCT."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import urllib.request
from pathlib import Path
from typing import Any

from .adapter_requirements import blocked, missing_python_dependency
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, file_sha256, output_dir, require_source_file, write_json_artifact, write_jsonl_artifact


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
        output={"adapter": "occt", "mode": "external_native_adapter", **metadata},
    )


def licensed_dwg_adapter(job: ConversionJob) -> WorkerResult:
    """Convert DWG through an approved service or isolated local sidecar."""

    validate_job(job)
    source, blocked = require_source_file(
        job,
        adapter="dwg",
        install_hint=(
            "Mount a DWG source file into the worker and configure ODAFileConverter, LibreDWG "
            "dwg2dxf/dwgread, or DWG_ADAPTER_URL. The worker does not use screenshot or watermarked fallbacks."
        ),
    )
    if blocked:
        return blocked

    converter = _select_dwg_to_dxf_converter()
    if converter is not None:
        return _run_local_dwg_to_dxf(job, source, converter)

    base_url = os.getenv("DWG_ADAPTER_URL", "").strip().rstrip("/")
    if base_url:
        return _call_external_dwg_adapter(job, source, base_url)

    return blocked(
        job,
        adapter="dwg",
        reason="missing DWG converter sidecar: ODAFileConverter, LibreDWG dwg2dxf/dwgread, or DWG_ADAPTER_URL",
        install_hint=(
            "Build LibreDWG from https://github.com/LibreDWG/libredwg as an isolated GPL sidecar, "
            "install ODAFileConverter, or configure an approved licensed DWG_ADAPTER_URL. "
            "Set DWG_TO_DXF_PATH, ODA_FILE_CONVERTER_PATH, ARCHITOKEN_LIBREDWG_BIN or LIBREDWG_BIN_DIR."
        ),
    )


def _call_external_dwg_adapter(job: ConversionJob, source: Path, base_url: str) -> WorkerResult:
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


def _select_dwg_to_dxf_converter() -> dict[str, str] | None:
    explicit = _resolve_executable(os.getenv("DWG_TO_DXF_PATH"))
    if explicit:
        return _converter_definition(explicit)

    oda = _resolve_executable(os.getenv("ODA_FILE_CONVERTER_PATH")) or _resolve_executable("/usr/bin/ODAFileConverter")
    oda = oda or _resolve_executable("/usr/local/bin/ODAFileConverter") or _resolve_executable("ODAFileConverter")
    if oda:
        return _converter_definition(oda, forced_kind="oda")

    for name in ("dwg2dxf", "dwgread"):
        resolved = _resolve_libredwg_tool(name)
        if resolved:
            return _converter_definition(resolved, forced_kind=name)
    return None


def _resolve_libredwg_tool(name: str) -> str | None:
    candidates = [
        _tool_from_dir(os.getenv("ARCHITOKEN_LIBREDWG_BIN"), name),
        _tool_from_dir(os.getenv("LIBREDWG_BIN_DIR"), name),
        f"/tmp/architoken-libredwg/bin/{name}",
        f"/usr/local/bin/{name}",
        f"/usr/bin/{name}",
        name,
    ]
    for candidate in candidates:
        resolved = _resolve_executable(candidate)
        if resolved:
            return resolved
    return None


def _tool_from_dir(directory: str | None, name: str) -> str | None:
    return str(Path(directory) / name) if directory else None


def _resolve_executable(candidate: str | None) -> str | None:
    if not candidate:
        return None
    candidate = candidate.strip()
    if not candidate:
        return None
    if "/" in candidate:
        path = Path(candidate)
        return str(path) if path.is_file() and os.access(path, os.X_OK) else None
    return shutil.which(candidate)


def _converter_definition(path: str, forced_kind: str | None = None) -> dict[str, str]:
    name = Path(path).name.lower()
    kind = forced_kind
    if kind is None:
        if "odafileconverter" in name or name == "oda":
            kind = "oda"
        elif "dwgread" in name:
            kind = "dwgread"
        else:
            kind = "dwg2dxf"
    if kind == "oda":
        return {
            "id": "oda-file-converter",
            "kind": "oda",
            "path": path,
            "licenseBoundary": "external_licensed_adapter",
            "sourceUrl": "https://www.opendesign.com/guestfiles/oda_file_converter",
        }
    return {
        "id": f"libredwg-{kind}",
        "kind": kind,
        "path": path,
        "licenseBoundary": "isolated_sidecar",
        "sourceUrl": "https://github.com/LibreDWG/libredwg",
    }


def _run_local_dwg_to_dxf(job: ConversionJob, source: Path, converter: dict[str, str]) -> WorkerResult:
    target = output_dir(job) / f"{source.stem}.dxf"
    cache_hit = target.is_file() and _looks_like_dxf(target)
    completed: subprocess.CompletedProcess[str] | None = None

    if not cache_hit:
        try:
            completed = _execute_dwg_converter(job, source, target, converter)
        except subprocess.TimeoutExpired:
            return WorkerResult(
                job_id=job.job_id,
                status="failed",
                error={"code": "dwg_to_dxf_timeout", "message": f"{converter['id']} timed out converting {source.name}"},
                output={"adapter": "dwg", "engine": converter["id"], "sourcePath": str(source)},
            )
        except Exception as exc:  # noqa: BLE001 - native sidecar failures must be structured.
            return WorkerResult(
                job_id=job.job_id,
                status="failed",
                error={"code": "dwg_to_dxf_failed", "message": str(exc)},
                output={"adapter": "dwg", "engine": converter["id"], "sourcePath": str(source)},
            )

        if not target.is_file() or not _looks_like_dxf(target):
            message = ""
            if completed is not None:
                message = (completed.stderr or completed.stdout or "")[-4000:]
            return WorkerResult(
                job_id=job.job_id,
                status="failed",
                error={
                    "code": "dwg_to_dxf_failed",
                    "message": message or f"{converter['id']} did not produce a valid DXF derivative.",
                },
                output={
                    "adapter": "dwg",
                    "engine": converter["id"],
                    "converterPath": converter["path"],
                    "sourcePath": str(source),
                    "targetPath": str(target),
                },
            )

    derivative = artifact_for_path(
        target,
        job=job,
        media_type="image/vnd.dxf",
        role="dwg_dxf_derivative",
        metadata={
            "adapter": "dwg",
            "engine": converter["id"],
            "converterPath": converter["path"],
            "licenseBoundary": converter["licenseBoundary"],
            "sourceUrl": converter["sourceUrl"],
            "sourcePath": str(source),
            "sourceChecksum": file_sha256(source),
            "cacheHit": cache_hit,
        },
    )
    manifest_payload = {
        "schema": "architoken.dwg_derivative_manifest.v1",
        "sourcePath": str(source),
        "sourceChecksum": file_sha256(source),
        "sourceFormat": "dwg",
        "derivativePath": str(target),
        "derivativeFormat": "dxf",
        "cachePolicy": "stream+etag+checksum",
        "cacheHit": cache_hit,
        "adapter": {
            "id": converter["id"],
            "path": converter["path"],
            "licenseBoundary": converter["licenseBoundary"],
            "sourceUrl": converter["sourceUrl"],
        },
        "fallbacks": {
            "watermarkedVectorPdf": "disabled",
            "screenshots": "disabled",
        },
    }
    manifest = write_json_artifact(
        job,
        "dwg_derivative_manifest.json",
        manifest_payload,
        role="dwg_derivative_manifest",
        metadata={"adapter": "dwg", "engine": converter["id"]},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(derivative, manifest),
        output={
            "adapter": "dwg",
            "mode": "local_sidecar_dwg_to_dxf",
            "engine": converter["id"],
            "converterPath": converter["path"],
            "licenseBoundary": converter["licenseBoundary"],
            "sourcePath": str(source),
            "sourceChecksum": manifest_payload["sourceChecksum"],
            "targetPath": str(target),
            "derivativeFormat": "dxf",
            "cachePolicy": "stream+etag+checksum",
            "cacheHit": cache_hit,
        },
    )


def _execute_dwg_converter(
    job: ConversionJob,
    source: Path,
    target: Path,
    converter: dict[str, str],
) -> subprocess.CompletedProcess[str]:
    timeout = int(job.input.get("timeoutSeconds", 600))
    binary = converter["path"]
    kind = converter["kind"]
    target.parent.mkdir(parents=True, exist_ok=True)

    if kind == "oda":
        input_dir = output_dir(job) / "oda_input"
        output = output_dir(job) / "oda_output"
        input_dir.mkdir(parents=True, exist_ok=True)
        output.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, input_dir / source.name)
        completed = subprocess.run(
            [binary, str(input_dir), str(output), "ACAD2018", "DXF", "0", "1"],
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        produced = next(output.rglob("*.dxf"), None)
        if produced is not None:
            shutil.copy2(produced, target)
        return completed

    if kind == "dwgread":
        completed = subprocess.run(
            [binary, "-O", "DXF", str(source)],
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if completed.stdout:
            target.write_text(completed.stdout, encoding="utf-8", errors="ignore")
        return completed

    attempts = (
        [binary, "-o", str(target), str(source)],
        [binary, str(source), str(target)],
        [binary, str(source)],
    )
    last = subprocess.CompletedProcess(args=(), returncode=1, stdout="", stderr="no dwg2dxf attempt executed")
    for command in attempts:
        last = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(target.parent),
        )
        if target.is_file():
            break
        if last.stdout and _looks_like_dxf_bytes(last.stdout.encode("utf-8", errors="ignore")):
            target.write_text(last.stdout, encoding="utf-8", errors="ignore")
            break
        produced = target.parent / f"{source.stem}.dxf"
        if produced.is_file():
            shutil.copy2(produced, target)
            break
        if last.returncode == 0 and _looks_like_dxf(target):
            break
    return last


def _looks_like_dxf(path: Path) -> bool:
    try:
        size = path.stat().st_size
        with path.open("rb") as handle:
            head = handle.read(8192)
            if size > 8192:
                handle.seek(max(0, size - 8192))
                tail = handle.read(8192)
            else:
                tail = head
    except OSError:
        return False
    return _looks_like_dxf_bytes(head, tail=tail)


def _looks_like_dxf_bytes(payload: bytes, *, tail: bytes | None = None) -> bool:
    head = payload[:8192].upper()
    end = (tail if tail is not None else payload[-8192:]).upper()
    return b"SECTION" in head and b"EOF" in end


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
