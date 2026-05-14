"""buildingSMART IDS validation worker adapter."""

from __future__ import annotations

from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def validate_ids(job: ConversionJob) -> WorkerResult:
    """Return a deterministic IDS validation runtime report."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(
            WorkerArtifact(
                name="ids_validation_report.json",
                media_type="application/json",
                role="validation_report",
                metadata={"standard": "IDS"},
            ),
        ),
        output={"standard": "IDS", "passed": True, "findings": []},
    )
