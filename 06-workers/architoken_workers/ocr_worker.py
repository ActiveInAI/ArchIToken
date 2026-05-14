"""OCR worker adapter."""

from __future__ import annotations

from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def paddleocr_parse(job: ConversionJob) -> WorkerResult:
    """Return a PaddleOCR OCR runtime manifest."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(WorkerArtifact(name="ocr_blocks.json", media_type="application/json", role="ocr"),),
        output={"engine": "paddleocr", "blocks": []},
    )
