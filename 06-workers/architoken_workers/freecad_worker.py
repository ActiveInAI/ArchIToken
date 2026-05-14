"""FreeCAD headless worker skeleton."""

from __future__ import annotations

from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def freecad_headless_convert(job: ConversionJob) -> WorkerResult:
    """Return a FreeCAD headless conversion manifest placeholder."""

    validate_job(job)
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
