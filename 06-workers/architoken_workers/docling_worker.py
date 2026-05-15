"""Docling document parsing worker adapter."""

from __future__ import annotations

from typing import Any

from .adapter_requirements import missing_python_dependency
from .contract import ConversionJob, WorkerResult, validate_job
from .io import artifact_for_path, output_dir, require_source_file, write_json_artifact


def docling_parse(job: ConversionJob) -> WorkerResult:
    """Parse PDF/Office/image documents with Docling and persist structured artifacts."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="docling",
        import_name="docling",
        install_hint="Install docling in the worker image for real document parsing and Markdown/JSON extraction.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="docling",
        install_hint="Mount a supported document into the worker and pass sourcePath or sourceObjectKey.",
    )
    if blocked:
        return blocked

    from docling.document_converter import DocumentConverter

    converter = DocumentConverter()
    result = converter.convert(str(source))
    document = getattr(result, "document", result)
    out_dir = output_dir(job)
    markdown = _export_markdown(document)
    markdown_path = out_dir / f"{source.stem}.docling.md"
    markdown_path.write_text(markdown, encoding="utf-8")
    markdown_artifact = artifact_for_path(
        markdown_path,
        job=job,
        media_type="text/markdown",
        role="document_markdown",
        metadata={"engine": "docling", "sourcePath": str(source)},
    )
    json_payload = _export_json(document)
    json_artifact = write_json_artifact(
        job,
        f"{source.stem}.docling.json",
        json_payload,
        role="document_structure",
        metadata={"engine": "docling", "sourcePath": str(source)},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(markdown_artifact, json_artifact),
        output={"engine": "docling", "sourcePath": str(source), "artifactCount": 2},
    )


def _export_markdown(document: Any) -> str:
    if hasattr(document, "export_to_markdown"):
        return str(document.export_to_markdown())
    if hasattr(document, "to_markdown"):
        return str(document.to_markdown())
    return str(document)


def _export_json(document: Any) -> Any:
    if hasattr(document, "export_to_dict"):
        return document.export_to_dict()
    if hasattr(document, "model_dump"):
        return document.model_dump(mode="json")
    if hasattr(document, "dict"):
        return document.dict()
    return {"text": str(document)}
