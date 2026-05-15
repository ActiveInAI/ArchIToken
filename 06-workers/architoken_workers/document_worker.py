"""Document AI worker adapters."""

from __future__ import annotations

import shutil
import subprocess

from .adapter_requirements import blocked, missing_python_dependency
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, output_dir, require_source_file, write_json_artifact


def mineru_parse(job: ConversionJob) -> WorkerResult:
    """Parse a PDF/Office document with MinerU CLI output artifacts."""

    validate_job(job)
    binary = str(job.input.get("mineruBinary", "mineru")).strip() or "mineru"
    if not shutil.which(binary):
        return blocked(
            job,
            adapter="mineru",
            reason=f"missing executable: {binary}",
            install_hint="Install MinerU CLI in the worker image for real document structure parsing.",
        )
    source, blocked_result = require_source_file(
        job,
        adapter="mineru",
        install_hint="Mount a PDF/Office source file into the worker and pass sourcePath or sourceObjectKey.",
    )
    if blocked_result:
        return blocked_result
    out_dir = output_dir(job) / "mineru"
    out_dir.mkdir(parents=True, exist_ok=True)
    completed = subprocess.run(
        [binary, "-p", str(source), "-o", str(out_dir)],
        check=False,
        capture_output=True,
        text=True,
        timeout=int(job.input.get("timeoutSeconds", 900)),
    )
    if completed.returncode != 0:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            error={"code": "mineru_parse_failed", "message": completed.stderr[-4000:] or completed.stdout[-4000:]},
            output={"engine": "mineru", "sourcePath": str(source)},
        )
    artifacts = []
    for path in sorted(out_dir.rglob("*")):
        if path.is_file():
            artifacts.append(
                artifact_for_path(
                    path,
                    job=job,
                    media_type=_media_type(path.suffix),
                    role="document_structure",
                    metadata={"engine": "mineru", "sourcePath": str(source)},
                )
            )
    manifest = write_json_artifact(
        job,
        "mineru_manifest.json",
        {"engine": "mineru", "sourcePath": str(source), "artifactCount": len(artifacts)},
        role="document_parse_manifest",
        metadata={"engine": "mineru"},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple([*artifacts, manifest]),
        output={"engine": "mineru", "artifactCount": len(artifacts) + 1},
    )


def markitdown_convert(job: ConversionJob) -> WorkerResult:
    """Convert a document to Markdown with Microsoft MarkItDown."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="markitdown",
        import_name="markitdown",
        install_hint="Install microsoft/markitdown in the worker image for real document-to-Markdown conversion.",
    ):
        return unavailable
    source, blocked_result = require_source_file(
        job,
        adapter="markitdown",
        install_hint="Mount a supported document into the worker and pass sourcePath or sourceObjectKey.",
    )
    if blocked_result:
        return blocked_result
    from markitdown import MarkItDown

    result = MarkItDown().convert(str(source))
    text = getattr(result, "text_content", None) or str(result)
    target = output_dir(job) / f"{source.stem}.md"
    target.write_text(text, encoding="utf-8")
    artifact = artifact_for_path(
        target,
        job=job,
        media_type="text/markdown",
        role="markdown",
        metadata={"engine": "markitdown", "sourcePath": str(source)},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={"engine": "markitdown", "format": "markdown", "sourcePath": str(source)},
    )


def _media_type(suffix: str) -> str:
    return {
        ".json": "application/json",
        ".md": "text/markdown",
        ".txt": "text/plain",
        ".html": "text/html",
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }.get(suffix.lower(), "application/octet-stream")
