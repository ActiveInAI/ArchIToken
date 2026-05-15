"""FreeCAD headless worker adapter."""

from __future__ import annotations

import subprocess

from .adapter_requirements import missing_binary
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, output_dir, require_source_file


def freecad_headless_convert(job: ConversionJob) -> WorkerResult:
    """Convert CAD files with FreeCADCmd in headless mode."""

    validate_job(job)
    if unavailable := missing_binary(
        job,
        adapter="freecad_headless",
        binary="FreeCADCmd",
        install_hint="Install FreeCADCmd in the worker image before enabling FreeCAD conversion.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="freecad_headless",
        install_hint="Mount a source CAD file into the worker and pass sourcePath in the job input.",
    )
    if blocked:
        return blocked

    out_dir = output_dir(job)
    formats = job.input.get("outputFormats", ["step"])
    artifacts: list[WorkerArtifact] = []
    for output_format in formats:
        suffix = str(output_format).lower().lstrip(".")
        if suffix not in {"step", "stp", "stl", "fcstd"}:
            raise ValueError(f"unsupported FreeCAD output format: {output_format}")
        target = out_dir / f"{source.stem}.{suffix}"
        script = out_dir / f"freecad_convert_{suffix}.py"
        script.write_text(_freecad_script(str(source), str(target), suffix), encoding="utf-8")
        completed = subprocess.run(
            ["FreeCADCmd", str(script)],
            check=False,
            capture_output=True,
            text=True,
            timeout=int(job.input.get("timeoutSeconds", 300)),
        )
        if completed.returncode != 0:
            return WorkerResult(
                job_id=job.job_id,
                status="failed",
                error={
                    "code": "freecad_conversion_failed",
                    "message": completed.stderr[-4000:] or completed.stdout[-4000:],
                },
                output={"engine": "freecad_headless", "sourcePath": str(source), "format": suffix},
            )
        artifacts.append(
            artifact_for_path(
                target,
                job=job,
                media_type=_media_type(suffix),
                role="converted_cad",
                metadata={"engine": "freecad_headless", "sourcePath": str(source), "format": suffix},
            )
        )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple(artifacts),
        output={"engine": "freecad_headless", "converted": True, "artifactCount": len(artifacts)},
    )


def _freecad_script(source: str, target: str, output_format: str) -> str:
    return f"""
import FreeCAD
import Import
import Mesh

source = {source!r}
target = {target!r}
output_format = {output_format!r}

doc = FreeCAD.openDocument(source)
if doc is None:
    doc = FreeCAD.newDocument("architoken_convert")
    Import.insert(source, doc.Name)
FreeCAD.setActiveDocument(doc.Name)
doc.recompute()
objects = [obj for obj in doc.Objects if getattr(obj, "Shape", None) or obj.isDerivedFrom("Mesh::Feature")]
if output_format in ("step", "stp"):
    Import.export(objects, target)
elif output_format == "stl":
    Mesh.export(objects, target)
elif output_format == "fcstd":
    doc.saveAs(target)
else:
    raise ValueError(f"unsupported output format: {{output_format}}")
"""


def _media_type(output_format: str) -> str:
    if output_format in {"step", "stp"}:
        return "model/step"
    if output_format == "stl":
        return "model/stl"
    return "application/x-freecad"
