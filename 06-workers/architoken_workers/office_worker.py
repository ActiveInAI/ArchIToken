"""Office conversion worker adapter."""

from __future__ import annotations

from .adapter_requirements import missing_binary
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def libreoffice_convert(job: ConversionJob) -> WorkerResult:
    """Return a LibreOffice headless conversion runtime manifest."""

    validate_job(job)
    if unavailable := missing_binary(
        job,
        adapter="libreoffice_headless",
        binary="libreoffice",
        install_hint="Install LibreOffice in the worker image for real DOC/DOCX/XLS/XLSX/PPT conversion.",
    ):
        return unavailable
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
