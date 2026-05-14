"""PDF adapter boundary skeletons."""

from __future__ import annotations

from .contract import ConversionJob, WorkerResult, validate_job


def stirling_pdf_adapter(job: ConversionJob) -> WorkerResult:
    """Return a Stirling-PDF adapter manifest placeholder."""

    validate_job(job)
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={"adapter": "stirling_pdf", "mode": "reference_boundary"},
    )


def pdfium_adapter(job: ConversionJob) -> WorkerResult:
    """Return a PDFium adapter manifest placeholder."""

    validate_job(job)
    return WorkerResult(job_id=job.job_id, status="completed", output={"adapter": "pdfium"})


def mupdf_adapter(job: ConversionJob) -> WorkerResult:
    """Return a MuPDF adapter manifest placeholder."""

    validate_job(job)
    return WorkerResult(job_id=job.job_id, status="completed", output={"adapter": "mupdf"})
