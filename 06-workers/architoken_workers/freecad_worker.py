"""FreeCAD headless worker adapter."""

from __future__ import annotations

from .adapter_requirements import missing_binary
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def freecad_headless_convert(job: ConversionJob) -> WorkerResult:
    """Return a FreeCAD headless conversion runtime manifest."""

    validate_job(job)
    if unavailable := missing_binary(
        job,
        adapter="freecad_headless",
        binary="FreeCADCmd",
        install_hint="Install FreeCADCmd in the worker image before enabling FreeCAD conversion.",
    ):
        return unavailable
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(
            WorkerArtifact(
                name="freecad_conversion_manifest.json",
                media_type="application/json",
                role="conversion_manifest",
            ),
        ),
        output={"engine": "freecad_headless", "converted": True},
    )
