"""CadQuery generation worker adapter."""

from __future__ import annotations

from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def cadquery_generate(job: ConversionJob) -> WorkerResult:
    """Return a CadQuery generation runtime manifest."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(
            WorkerArtifact(
                name="cadquery_script.py",
                media_type="text/x-python",
                role="source_script",
            ),
        ),
        output={"engine": "cadquery", "generated": True},
    )
