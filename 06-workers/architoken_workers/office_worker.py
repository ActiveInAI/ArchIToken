"""Office conversion worker adapter."""

from __future__ import annotations

import subprocess

from .adapter_requirements import missing_binary
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, output_dir, require_source_file


def libreoffice_convert(job: ConversionJob) -> WorkerResult:
    """Convert Office documents with LibreOffice headless."""

    validate_job(job)
    if unavailable := missing_binary(
        job,
        adapter="libreoffice",
        binary="libreoffice",
        install_hint="Install LibreOffice in the worker image for real DOC/DOCX/XLS/XLSX/PPT conversion.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="libreoffice",
        install_hint="Mount an Office source file into the worker and pass sourcePath or sourceObjectKey.",
    )
    if blocked:
        return blocked
    formats = job.input.get("outputFormats", ["pdf"])
    out_dir = output_dir(job)
    artifacts: list[WorkerArtifact] = []
    for output_format in formats:
        suffix = str(output_format).lower().lstrip(".")
        completed = subprocess.run(
            ["libreoffice", "--headless", "--convert-to", suffix, "--outdir", str(out_dir), str(source)],
            check=False,
            capture_output=True,
            text=True,
            timeout=int(job.input.get("timeoutSeconds", 300)),
        )
        if completed.returncode != 0:
            return WorkerResult(
                job_id=job.job_id,
                status="failed",
                error={"code": "libreoffice_conversion_failed", "message": completed.stderr[-4000:] or completed.stdout[-4000:]},
                output={"engine": "libreoffice_headless", "sourcePath": str(source), "format": suffix},
            )
        target = out_dir / f"{source.stem}.{suffix}"
        if not target.exists():
            matches = list(out_dir.glob(f"{source.stem}.*"))
            target = max(matches, key=lambda path: path.stat().st_mtime) if matches else target
        artifacts.append(
            artifact_for_path(
                target,
                job=job,
                media_type=_media_type(suffix),
                role="office_derivative",
                metadata={"engine": "libreoffice_headless", "sourcePath": str(source), "format": suffix},
            )
        )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple(artifacts),
        output={"engine": "libreoffice_headless", "converted": True, "artifactCount": len(artifacts)},
    )


def _media_type(output_format: str) -> str:
    return {
        "pdf": "application/pdf",
        "html": "text/html",
        "txt": "text/plain",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }.get(output_format, "application/octet-stream")
