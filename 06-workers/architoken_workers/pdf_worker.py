"""PDF worker adapters."""

from __future__ import annotations

from .adapter_requirements import missing_binary, missing_env
from .contract import ConversionJob, WorkerResult, validate_job


def stirling_pdf_adapter(job: ConversionJob) -> WorkerResult:
    """Return a Stirling-PDF service adapter runtime manifest."""

    validate_job(job)
    if unavailable := missing_env(
        job,
        adapter="stirling_pdf",
        name="STIRLING_PDF_URL",
        install_hint="Configure STIRLING_PDF_URL for the Stirling-PDF service adapter.",
    ):
        return unavailable
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        output={"adapter": "stirling_pdf", "mode": "service_adapter"},
    )


def pdfium_adapter(job: ConversionJob) -> WorkerResult:
    """Return a PDFium adapter runtime manifest."""

    validate_job(job)
    if unavailable := missing_binary(
        job,
        adapter="pdfium",
        binary="pdfium_test",
        install_hint="Install PDFium tools or configure a PDFium sidecar before enabling this adapter.",
    ):
        return unavailable
    return WorkerResult(job_id=job.job_id, status="completed", output={"adapter": "pdfium"})


def mupdf_adapter(job: ConversionJob) -> WorkerResult:
    """Return a MuPDF adapter runtime manifest."""

    validate_job(job)
    if unavailable := missing_binary(
        job,
        adapter="mupdf",
        binary="mutool",
        install_hint="Install MuPDF mutool in the worker image for real PDF parsing/rendering.",
    ):
        return unavailable
    return WorkerResult(job_id=job.job_id, status="completed", output={"adapter": "mupdf"})
