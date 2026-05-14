"""PDF worker adapters."""

from __future__ import annotations

from .contract import ConversionJob, WorkerResult, validate_job


def stirling_pdf_adapter(job: ConversionJob) -> WorkerResult:
    """Return a Stirling-PDF service adapter runtime manifest."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={"adapter": "stirling_pdf", "mode": "service_adapter"},
    )


def pdfium_adapter(job: ConversionJob) -> WorkerResult:
    """Return a PDFium adapter runtime manifest."""

    validate_job(job)
    return WorkerResult(job_id=job.job_id, status="completed", output={"adapter": "pdfium"})


def mupdf_adapter(job: ConversionJob) -> WorkerResult:
    """Return a MuPDF adapter runtime manifest."""

    validate_job(job)
    return WorkerResult(job_id=job.job_id, status="completed", output={"adapter": "mupdf"})
