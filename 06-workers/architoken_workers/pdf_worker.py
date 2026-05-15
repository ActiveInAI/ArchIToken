"""PDF worker adapters."""

from __future__ import annotations

import json
import mimetypes
import os
import subprocess
import uuid
import urllib.request

from .adapter_requirements import blocked, missing_binary, missing_env
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, output_dir, require_source_file, write_json_artifact


def stirling_pdf_adapter(job: ConversionJob) -> WorkerResult:
    """Run a configured Stirling-PDF API operation against a real source PDF."""

    validate_job(job)
    if unavailable := missing_env(
        job,
        adapter="stirling_pdf",
        name="STIRLING_PDF_URL",
        install_hint="Configure STIRLING_PDF_URL for the Stirling-PDF service adapter.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="stirling_pdf",
        install_hint="Mount a PDF source file into the worker and pass sourcePath or sourceObjectKey.",
    )
    if blocked:
        return blocked
    operation_path = str(job.input.get("stirlingOperationPath", job.input.get("operationPath", ""))).strip()
    if not operation_path:
        return WorkerResult(
            job_id=job.job_id,
            status="blocked",
            error={"code": "stirling_operation_path_required", "message": "job.input.stirlingOperationPath is required"},
            output={"adapter": "stirling_pdf", "available": False},
        )

    base_url = os.environ["STIRLING_PDF_URL"].rstrip("/")
    fields = job.input.get("fields", {})
    if not isinstance(fields, dict):
        raise ValueError("job.input.fields must be an object for Stirling-PDF operations")
    response_bytes, content_type = _multipart_post(
        f"{base_url}/{operation_path.lstrip('/')}",
        source,
        fields={key: str(value) for key, value in fields.items()},
        timeout_seconds=int(job.input.get("timeoutSeconds", 300)),
    )
    if content_type.startswith("application/json"):
        payload = json.loads(response_bytes.decode("utf-8"))
        artifact = write_json_artifact(
            job,
            "stirling_pdf_response.json",
            payload,
            role="pdf_service_response",
            metadata={"adapter": "stirling_pdf", "operationPath": operation_path},
        )
    else:
        suffix = _suffix_for_content_type(content_type, str(job.input.get("outputFormat", "pdf")))
        target = output_dir(job) / f"{source.stem}.stirling.{suffix}"
        target.write_bytes(response_bytes)
        artifact = artifact_for_path(
            target,
            job=job,
            media_type=content_type or "application/octet-stream",
            role="pdf_derivative",
            metadata={"adapter": "stirling_pdf", "operationPath": operation_path},
        )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={"adapter": "stirling_pdf", "operationPath": operation_path, "contentType": content_type},
    )


def pdfium_adapter(job: ConversionJob) -> WorkerResult:
    """Require an explicit PDFium sidecar until a stable local CLI contract exists."""

    validate_job(job)
    if unavailable := missing_env(
        job,
        adapter="pdfium",
        name="PDFIUM_ADAPTER_URL",
        install_hint="Configure a PDFium sidecar with a stable render/parse API before enabling this adapter.",
    ):
        return unavailable
    return blocked(
        job,
        adapter="pdfium",
        reason="PDFium sidecar protocol is not configured in this deployment",
        install_hint="Use Stirling-PDF or MuPDF now, or configure PDFIUM_ADAPTER_URL with a supported API contract.",
    )


def mupdf_adapter(job: ConversionJob) -> WorkerResult:
    """Render PDF pages to PNG with MuPDF mutool."""

    validate_job(job)
    if unavailable := missing_binary(
        job,
        adapter="mupdf",
        binary="mutool",
        install_hint="Install MuPDF mutool in the worker image for real PDF parsing/rendering.",
    ):
        return unavailable
    source, blocked_result = require_source_file(
        job,
        adapter="mupdf",
        install_hint="Mount a PDF source file into the worker and pass sourcePath or sourceObjectKey.",
    )
    if blocked_result:
        return blocked_result
    out_dir = output_dir(job) / "mupdf_pages"
    out_dir.mkdir(parents=True, exist_ok=True)
    target_pattern = out_dir / f"{source.stem}-%03d.png"
    completed = subprocess.run(
        ["mutool", "draw", "-o", str(target_pattern), "-r", str(job.input.get("dpi", 144)), str(source)],
        check=False,
        capture_output=True,
        text=True,
        timeout=int(job.input.get("timeoutSeconds", 300)),
    )
    if completed.returncode != 0:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            error={"code": "mupdf_render_failed", "message": completed.stderr[-4000:] or completed.stdout[-4000:]},
            output={"adapter": "mupdf", "sourcePath": str(source)},
        )
    artifacts: list[WorkerArtifact] = []
    for path in sorted(out_dir.glob(f"{source.stem}-*.png")):
        artifacts.append(
            artifact_for_path(
                path,
                job=job,
                media_type="image/png",
                role="pdf_page_image",
                metadata={"adapter": "mupdf", "sourcePath": str(source)},
            )
        )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=tuple(artifacts),
        output={"adapter": "mupdf", "sourcePath": str(source), "pageImages": len(artifacts)},
    )


def _multipart_post(url: str, source: object, *, fields: dict[str, str], timeout_seconds: int) -> tuple[bytes, str]:
    boundary = f"architoken-{uuid.uuid4().hex}"
    body = bytearray()
    for name, value in fields.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
        body.extend(value.encode("utf-8"))
        body.extend(b"\r\n")
    filename = getattr(source, "name", "document.pdf")
    guessed_type = mimetypes.guess_type(str(source))[0] or "application/pdf"
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="fileInput"; filename="{filename}"\r\n'.encode("utf-8"))
    body.extend(f"Content-Type: {guessed_type}\r\n\r\n".encode("utf-8"))
    body.extend(source.read_bytes())
    body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Accept": "*/*",
    }
    token = os.getenv("STIRLING_PDF_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=bytes(body), headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        return response.read(), response.headers.get("content-type", "application/octet-stream").split(";")[0]


def _suffix_for_content_type(content_type: str, fallback: str) -> str:
    return {
        "application/pdf": "pdf",
        "application/zip": "zip",
        "image/png": "png",
        "image/jpeg": "jpg",
        "text/plain": "txt",
        "text/html": "html",
    }.get(content_type, fallback.lower().lstrip(".") or "bin")
