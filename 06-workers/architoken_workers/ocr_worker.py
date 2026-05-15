"""OCR worker adapter."""

from __future__ import annotations

from .adapter_requirements import missing_python_dependency
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def paddleocr_parse(job: ConversionJob) -> WorkerResult:
    """Return a PaddleOCR OCR runtime manifest."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="paddleocr",
        import_name="paddleocr",
        install_hint="Install PaddleOCR in the worker image for real PDF/image OCR.",
    ):
        return unavailable
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(WorkerArtifact(name="ocr_blocks.json", media_type="application/json", role="ocr"),),
        output={"engine": "paddleocr", "blocks": []},
    )
