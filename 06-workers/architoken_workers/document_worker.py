"""Document AI worker adapters."""

from __future__ import annotations

from .adapter_requirements import missing_python_dependency
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job


def mineru_parse(job: ConversionJob) -> WorkerResult:
    """Return a MinerU parse runtime manifest."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="mineru",
        import_name="magic_pdf",
        install_hint="Install MinerU/Magic-PDF in the worker image for real document structure parsing.",
    ):
        return unavailable
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(
            WorkerArtifact(
                name="document_structure.json",
                media_type="application/json",
                role="document_structure",
            ),
        ),
        output={"engine": "mineru", "pages": 0},
    )


def markitdown_convert(job: ConversionJob) -> WorkerResult:
    """Return a MarkItDown conversion runtime manifest."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="markitdown",
        import_name="markitdown",
        install_hint="Install microsoft/markitdown in the worker image for real document-to-Markdown conversion.",
    ):
        return unavailable
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(WorkerArtifact(name="document.md", media_type="text/markdown", role="markdown"),),
        output={"engine": "markitdown", "format": "markdown"},
    )
