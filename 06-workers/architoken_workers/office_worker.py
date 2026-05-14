"""Office conversion worker adapter."""

from __future__ import annotations

from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def libreoffice_convert(job: ConversionJob) -> WorkerResult:
    """Return a LibreOffice headless conversion runtime manifest."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(
            WorkerArtifact(
                name="office_conversion_manifest.json",
                media_type="application/json",
                role="conversion_manifest",
            ),
        ),
        output={"engine": "libreoffice_headless", "converted": True},
    )
