"""buildingSMART bSDD worker adapter."""

from __future__ import annotations

from .contract import ConversionJob, WorkerResult, validate_job


def enrich_with_bsdd(job: ConversionJob) -> WorkerResult:
    """Return a deterministic bSDD enrichment runtime manifest."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={
            "dictionary": "bSDD",
            "networkPolicy": "scheduled_explicit_only",
            "classifications": [],
        },
    )
