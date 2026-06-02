"""PDF worker adapters."""

from __future__ import annotations

from dataclasses import dataclass
import json
import mimetypes
import os
import subprocess
import uuid
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .adapter_requirements import blocked, missing_binary, missing_env
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job
from .io import artifact_for_path, output_dir, require_source_file, write_json_artifact
from .ocr_worker import paddleocr_parse


@dataclass(frozen=True)
class PdfOperationSpec:
    """Auditable PDF operation contract for service-backed PDF tools."""

    operation_id: str
    label: str
    category: str
    engine: str
    api_path: str | None = None
    note: str = ""


def _stirling(operation_id: str, label: str, category: str, api_path: str | None = None, note: str = "") -> PdfOperationSpec:
    return PdfOperationSpec(operation_id, label, category, "stirling_pdf", api_path, note)


def _paddleocr(operation_id: str, label: str, category: str, note: str = "") -> PdfOperationSpec:
    return PdfOperationSpec(operation_id, label, category, "paddleocr", None, note)


PDF_OPERATION_REGISTRY: dict[str, PdfOperationSpec] = {
    # Page operations
    "merge-pdfs": _stirling("merge-pdfs", "Merge PDFs", "page_operations", "/api/v1/general/merge-pdfs"),
    "split-pages": _stirling("split-pages", "Split PDFs", "page_operations", "/api/v1/general/split-pages"),
    "extract-pages": _stirling("extract-pages", "Extract Pages", "page_operations"),
    "remove-pages": _stirling("remove-pages", "Remove Pages", "page_operations", "/api/v1/general/remove-pages"),
    "rearrange-pages": _stirling("rearrange-pages", "Rearrange Pages", "page_operations", "/api/v1/general/rearrange-pages"),
    "rotate-pdf": _stirling("rotate-pdf", "Rotate PDFs", "page_operations", "/api/v1/general/rotate-pdf"),
    "crop": _stirling("crop", "Crop Pages", "page_operations", "/api/v1/general/crop"),
    "scale-pages": _stirling("scale-pages", "Scale Pages", "page_operations", "/api/v1/general/scale-pages"),
    "add-page-numbers": _stirling("add-page-numbers", "Add Page Numbers", "page_operations", "/api/v1/misc/add-page-numbers"),
    "pdf-to-single-page": _stirling("pdf-to-single-page", "PDF to Single Page", "page_operations", "/api/v1/general/pdf-to-single-page"),
    "multi-page-layout": _stirling("multi-page-layout", "Multi-Page Layout", "page_operations", "/api/v1/general/multi-page-layout"),
    "booklet-imposition": _stirling("booklet-imposition", "Booklet Imposition", "page_operations", "/api/v1/general/booklet-imposition"),
    "overlay-pdf": _stirling("overlay-pdf", "Overlay PDFs", "page_operations", "/api/v1/general/overlay-pdfs"),
    "split-pdf-by-sections": _stirling("split-pdf-by-sections", "Split by Sections", "page_operations", "/api/v1/general/split-pdf-by-sections"),
    "split-pdf-by-chapters": _stirling("split-pdf-by-chapters", "Split by Chapters", "page_operations", "/api/v1/general/split-pdf-by-chapters"),
    "auto-split-pdf": _stirling("auto-split-pdf", "Auto Split PDF", "page_operations", "/api/v1/misc/auto-split-pdf"),
    "split-by-size-or-count": _stirling("split-by-size-or-count", "Split by Size/Count", "page_operations", "/api/v1/general/split-by-size-or-count"),
    "add-attachments": _stirling("add-attachments", "Add Attachments", "attachments_comments", "/api/v1/misc/add-attachments"),
    # Conversion
    "pdf-to-img": _stirling("pdf-to-img", "PDF to Image", "conversion", "/api/v1/convert/pdf/img"),
    "img-to-pdf": _stirling("img-to-pdf", "Image to PDF", "conversion", "/api/v1/convert/img/pdf"),
    "file-to-pdf": _stirling("file-to-pdf", "File to PDF", "conversion", "/api/v1/convert/file/pdf"),
    "pdf-to-word": _stirling("pdf-to-word", "PDF to Word", "conversion", "/api/v1/convert/pdf/word"),
    "pdf-to-presentation": _stirling("pdf-to-presentation", "PDF to Presentation", "conversion", "/api/v1/convert/pdf/presentation"),
    "pdf-to-text": _stirling("pdf-to-text", "PDF to Text", "conversion", "/api/v1/convert/pdf/text"),
    "pdf-to-html": _stirling("pdf-to-html", "PDF to HTML", "conversion", "/api/v1/convert/pdf/html"),
    "pdf-to-xml": _stirling("pdf-to-xml", "PDF to XML", "conversion", "/api/v1/convert/pdf/xml"),
    "pdf-to-markdown": _stirling("pdf-to-markdown", "PDF to Markdown", "conversion", "/api/v1/convert/pdf/markdown"),
    "pdf-to-csv": _stirling("pdf-to-csv", "PDF to CSV", "conversion", "/api/v1/convert/pdf/csv"),
    "pdf-to-epub": _stirling("pdf-to-epub", "PDF to EPUB", "conversion", "/api/v1/convert/pdf/epub"),
    "pdf-to-vector": _stirling("pdf-to-vector", "PDF to Vector", "conversion", "/api/v1/convert/pdf/vector"),
    "pdf-to-video": _stirling("pdf-to-video", "PDF to Video", "conversion"),
    "pdf-to-json": _stirling("pdf-to-json", "PDF to JSON", "conversion"),
    "pdf-to-rtf": _stirling("pdf-to-rtf", "PDF to RTF", "conversion"),
    "pdf-to-cbz": _stirling("pdf-to-cbz", "PDF to CBZ", "conversion", "/api/v1/convert/pdf/cbz"),
    "pdf-to-cbr": _stirling("pdf-to-cbr", "PDF to CBR", "conversion", "/api/v1/convert/pdf/cbr", "may be disabled when the rar dependency is not installed"),
    "pdf-to-pdfa": _stirling("pdf-to-pdfa", "PDF to PDF/A", "conversion", "/api/v1/convert/pdf/pdfa"),
    "html-to-pdf": _stirling("html-to-pdf", "HTML to PDF", "conversion", "/api/v1/convert/html/pdf"),
    "url-to-pdf": _stirling("url-to-pdf", "URL to PDF", "conversion", "/api/v1/convert/url/pdf", "may be disabled by deployment endpoint policy"),
    "markdown-to-pdf": _stirling("markdown-to-pdf", "Markdown to PDF", "conversion", "/api/v1/convert/markdown/pdf"),
    "eml-to-pdf": _stirling("eml-to-pdf", "Email to PDF", "conversion", "/api/v1/convert/eml/pdf"),
    "cbz-to-pdf": _stirling("cbz-to-pdf", "CBZ to PDF", "conversion", "/api/v1/convert/cbz/pdf"),
    "cbr-to-pdf": _stirling("cbr-to-pdf", "CBR to PDF", "conversion", "/api/v1/convert/cbr/pdf", "may be disabled when the rar dependency is not installed"),
    "ebook-to-pdf": _stirling("ebook-to-pdf", "Ebook to PDF", "conversion", "/api/v1/convert/ebook/pdf"),
    "svg-to-pdf": _stirling("svg-to-pdf", "SVG to PDF", "conversion", "/api/v1/convert/svg/pdf"),
    "json-to-pdf": _stirling("json-to-pdf", "JSON to PDF", "conversion"),
    "vector-to-pdf": _stirling("vector-to-pdf", "Vector to PDF", "conversion", "/api/v1/convert/vector/pdf"),
    # Security and signing
    "add-password": _stirling("add-password", "Add Password Protection", "security_signing", "/api/v1/security/add-password"),
    "remove-password": _stirling("remove-password", "Remove Password", "security_signing", "/api/v1/security/remove-password"),
    "change-permissions": _stirling("change-permissions", "Change Permissions", "security_signing"),
    "add-watermark": _stirling("add-watermark", "Add Watermark", "security_signing", "/api/v1/security/add-watermark"),
    "add-stamp": _stirling("add-stamp", "Add Stamp", "security_signing", "/api/v1/misc/add-stamp"),
    "sanitize-pdf": _stirling("sanitize-pdf", "Sanitize PDF", "security_signing", "/api/v1/security/sanitize-pdf"),
    "flatten": _stirling("flatten", "Flatten Form Fields", "security_signing", "/api/v1/misc/flatten"),
    "unlock-pdf-forms": _stirling("unlock-pdf-forms", "Unlock PDF Forms", "security_signing", "/api/v1/misc/unlock-pdf-forms"),
    "cert-sign": _stirling("cert-sign", "Certificate Sign", "security_signing", "/api/v1/security/cert-sign"),
    "sign": _stirling("sign", "Draw/Text/Image Signature", "security_signing", note="visual signing uses proprietary/workflow endpoints on some Stirling-PDF deployments"),
    "remove-cert-sign": _stirling("remove-cert-sign", "Remove Certificate Signature", "security_signing", "/api/v1/security/remove-cert-sign"),
    "validate-signature": _stirling("validate-signature", "Validate Signature", "security_signing", "/api/v1/security/validate-signature"),
    "verify-pdf": _stirling("verify-pdf", "Verify PDF", "security_signing", "/api/v1/security/verify-pdf"),
    "redact": _stirling("redact", "Redact Information", "security_signing", "/api/v1/security/redact"),
    "auto-redact": _stirling("auto-redact", "Auto Redact", "security_signing", "/api/v1/security/auto-redact"),
    "timestamp-pdf": _stirling("timestamp-pdf", "Timestamp PDF", "security_signing", "/api/v1/security/timestamp-pdf"),
    # Content extraction and removal
    "extract-images": _stirling("extract-images", "Extract Images", "content_extraction_removal", "/api/v1/misc/extract-images"),
    "extract-image-scans": _stirling("extract-image-scans", "Extract Image Scans", "content_extraction_removal", "/api/v1/misc/extract-image-scans"),
    "remove-image-pdf": _stirling("remove-image-pdf", "Remove Images", "content_extraction_removal", "/api/v1/general/remove-image-pdf"),
    "remove-annotations": _stirling("remove-annotations", "Remove Annotations", "content_extraction_removal"),
    "remove-blanks": _stirling("remove-blanks", "Remove Blank Pages", "content_extraction_removal", "/api/v1/misc/remove-blanks"),
    "ocr-pdf": _stirling("ocr-pdf", "OCR with Stirling-PDF/OCRmyPDF", "content_extraction_removal", "/api/v1/misc/ocr-pdf"),
    "extract-attachments": _stirling("extract-attachments", "Extract Attachments", "attachments_comments", "/api/v1/misc/extract-attachments"),
    "list-attachments": _stirling("list-attachments", "List Attachments", "attachments_comments", "/api/v1/misc/list-attachments"),
    "delete-attachment": _stirling("delete-attachment", "Delete Attachment", "attachments_comments", "/api/v1/misc/delete-attachment"),
    "rename-attachment": _stirling("rename-attachment", "Rename Attachment", "attachments_comments", "/api/v1/misc/rename-attachment"),
    "add-comments": _stirling("add-comments", "Add Comments", "attachments_comments", "/api/v1/misc/add-comments"),
    # Document editing and analysis
    "text-editor-pdf": _stirling("text-editor-pdf", "Text Editor", "document_editing_analysis", "/api/v1/convert/pdf/text-editor", "text editing may require follow-up job/page endpoints"),
    "edit-table-of-contents": _stirling("edit-table-of-contents", "Edit Table of Contents", "document_editing_analysis", "/api/v1/general/edit-table-of-contents"),
    "update-metadata": _stirling("update-metadata", "Change Metadata", "document_editing_analysis", "/api/v1/misc/update-metadata"),
    "get-info-on-pdf": _stirling("get-info-on-pdf", "Get PDF Info", "document_editing_analysis", "/api/v1/security/get-info-on-pdf"),
    "compare": _stirling("compare", "Compare PDFs", "document_editing_analysis"),
    "adjust-contrast": _stirling("adjust-contrast", "Adjust Contrast", "document_editing_analysis"),
    "replace-invert-pdf": _stirling("replace-invert-pdf", "Replace/Invert Colors", "document_editing_analysis", "/api/v1/misc/replace-invert-pdf"),
    "scanner-effect": _stirling("scanner-effect", "Scanner Effect", "document_editing_analysis", "/api/v1/misc/scanner-effect"),
    "repair": _stirling("repair", "Repair PDF", "document_editing_analysis", "/api/v1/misc/repair"),
    "add-image": _stirling("add-image", "Add Image to PDF", "document_editing_analysis", "/api/v1/misc/add-image"),
    "basic-info": _stirling("basic-info", "Basic PDF Info", "analysis", "/api/v1/analysis/basic-info"),
    "document-properties": _stirling("document-properties", "Document Properties", "analysis", "/api/v1/analysis/document-properties"),
    "font-info": _stirling("font-info", "Font Info", "analysis", "/api/v1/analysis/font-info"),
    "annotation-info": _stirling("annotation-info", "Annotation Info", "analysis", "/api/v1/analysis/annotation-info"),
    "page-count": _stirling("page-count", "Page Count", "analysis", "/api/v1/analysis/page-count"),
    "page-dimensions": _stirling("page-dimensions", "Page Dimensions", "analysis", "/api/v1/analysis/page-dimensions"),
    "security-info": _stirling("security-info", "Security Info", "analysis", "/api/v1/analysis/security-info"),
    # Form fields
    "fields": _stirling("fields", "Form Fields", "form_fields", "/api/v1/form/fields"),
    "fields-with-coordinates": _stirling("fields-with-coordinates", "Form Fields with Coordinates", "form_fields", "/api/v1/form/fields-with-coordinates"),
    "form-fields": _stirling("form-fields", "Analyze Form Fields", "form_fields", "/api/v1/analysis/form-fields"),
    "fill": _stirling("fill", "Fill Form Fields", "form_fields", "/api/v1/form/fill"),
    "modify-fields": _stirling("modify-fields", "Modify Form Fields", "form_fields", "/api/v1/form/modify-fields"),
    "delete-fields": _stirling("delete-fields", "Delete Form Fields", "form_fields", "/api/v1/form/delete-fields"),
    "extract-form-csv": _stirling("extract-form-csv", "Extract Form Data CSV", "form_fields", "/api/v1/form/extract-csv"),
    "extract-form-xlsx": _stirling("extract-form-xlsx", "Extract Form Data XLSX", "form_fields", "/api/v1/form/extract-xlsx"),
    # Multi-tool and automation
    "multi-tool": _stirling("multi-tool", "Multi-Tool Workbench", "multi_tool_automation", note="multi-tool workbench may be UI-only on some Stirling-PDF deployments"),
    "compress-pdf": _stirling("compress-pdf", "Compress PDFs", "multi_tool_automation", "/api/v1/misc/compress-pdf"),
    "automate": _stirling("automate", "Automation", "multi_tool_automation"),
    "pipeline": _stirling("pipeline", "Pipeline", "multi_tool_automation", "/api/v1/pipeline/handleData"),
    "auto-rename": _stirling("auto-rename", "Auto Rename", "multi_tool_automation", "/api/v1/misc/auto-rename"),
    "decompress-pdf": _stirling("decompress-pdf", "Decompress PDF", "multi_tool_automation", "/api/v1/misc/decompress-pdf"),
    "filter-contains-image": _stirling("filter-contains-image", "Filter Pages Containing Images", "filtering", "/api/v1/filter/filter-contains-image"),
    "filter-contains-text": _stirling("filter-contains-text", "Filter Pages Containing Text", "filtering", "/api/v1/filter/filter-contains-text"),
    "filter-file-size": _stirling("filter-file-size", "Filter by File Size", "filtering", "/api/v1/filter/filter-file-size"),
    "filter-page-count": _stirling("filter-page-count", "Filter by Page Count", "filtering", "/api/v1/filter/filter-page-count"),
    "filter-page-rotation": _stirling("filter-page-rotation", "Filter by Page Rotation", "filtering", "/api/v1/filter/filter-page-rotation"),
    "filter-page-size": _stirling("filter-page-size", "Filter by Page Size", "filtering", "/api/v1/filter/filter-page-size"),
    # Viewing and display
    "view-pdf": _stirling("view-pdf", "PDF Viewer", "viewing_display", note="official docs mark PDF viewing as front-end exclusive"),
    "show-javascript": _stirling("show-javascript", "Show JavaScript in PDF", "viewing_display", "/api/v1/misc/show-javascript"),
    # PaddleOCR first-class routes for scanned and image-heavy PDFs.
    "paddleocr-ocr": _paddleocr("paddleocr-ocr", "PaddleOCR PDF/Image OCR", "ocr_document_vision"),
    "paddleocr-layout": _paddleocr("paddleocr-layout", "PaddleOCR layout extraction", "ocr_document_vision"),
    "paddleocr-vl": _paddleocr("paddleocr-vl", "PaddleOCR-VL document parsing", "ocr_document_vision"),
}

PDF_OPERATION_ALIASES = {
    "merge": "merge-pdfs",
    "split": "split-pages",
    "compress": "compress-pdf",
    "ocr": "paddleocr-ocr",
    "ocr-layout": "paddleocr-layout",
    "ocr-vl": "paddleocr-vl",
    "stirling-ocr": "ocr-pdf",
    "pdfa": "pdf-to-pdfa",
    "metadata": "update-metadata",
}


def stirling_pdf_adapter(job: ConversionJob) -> WorkerResult:
    """Run a configured Stirling-PDF/PaddleOCR PDF operation against a real source PDF."""

    validate_job(job)
    operation_id = _pdf_operation_id(job)
    operation_spec = _pdf_operation_spec(operation_id) if operation_id else None
    if operation_spec and operation_spec.engine == "paddleocr":
        return paddleocr_parse(job)

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
    operation_path = _stirling_operation_path(job, operation_spec)
    if not operation_path:
        return WorkerResult(
            job_id=job.job_id,
            status="blocked",
            error={
                "code": "stirling_operation_path_required",
                "message": "Pass job.input.pdfOperation with a mapped API operation or job.input.stirlingOperationPath.",
            },
            output={
                "adapter": "stirling_pdf",
                "available": False,
                "operationId": operation_id,
                "supportedOperations": sorted(PDF_OPERATION_REGISTRY),
            },
        )

    base_url = os.environ["STIRLING_PDF_URL"].rstrip("/")
    fields = job.input.get("fields", {})
    if not isinstance(fields, dict):
        raise ValueError("job.input.fields must be an object for Stirling-PDF operations")
    sources, source_error = _source_files(job, source)
    if source_error:
        return source_error
    try:
        response_bytes, content_type = _multipart_post(
            f"{base_url}/{operation_path.lstrip('/')}",
            sources,
            fields=_string_form_fields(fields),
            file_field_name=_stirling_file_field_name(job, operation_spec),
            timeout_seconds=int(job.input.get("timeoutSeconds", 300)),
        )
    except urllib.error.HTTPError as exc:
        response_body = exc.read()
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            error={
                "code": "stirling_pdf_request_failed",
                "message": f"Stirling-PDF returned HTTP {exc.code} for {operation_path}",
            },
            output={
                "adapter": "stirling_pdf",
                "operationId": operation_spec.operation_id if operation_spec else operation_id,
                "operationPath": operation_path,
                "statusCode": exc.code,
                "responseContentType": exc.headers.get("content-type", "application/octet-stream").split(";")[0],
                "responseBody": response_body.decode("utf-8", errors="replace")[-4000:],
            },
        )
    except urllib.error.URLError as exc:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            error={
                "code": "stirling_pdf_unreachable",
                "message": f"Could not reach Stirling-PDF service at {base_url}: {exc.reason}",
            },
            output={
                "adapter": "stirling_pdf",
                "operationId": operation_spec.operation_id if operation_spec else operation_id,
                "operationPath": operation_path,
            },
        )
    if content_type.startswith("application/json"):
        payload = json.loads(response_bytes.decode("utf-8"))
        artifact = write_json_artifact(
            job,
            "stirling_pdf_response.json",
            payload,
            role="pdf_service_response",
            metadata=_operation_metadata(operation_spec, operation_path, source_count=len(sources)),
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
            metadata=_operation_metadata(operation_spec, operation_path, source_count=len(sources)),
        )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={
            "adapter": "stirling_pdf",
            "mode": "service_adapter",
            "operationId": operation_spec.operation_id if operation_spec else operation_id,
            "operationCategory": operation_spec.category if operation_spec else None,
            "operationPath": operation_path,
            "contentType": content_type,
            "sourceCount": len(sources),
        },
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


def pdf_operation_manifest() -> dict[str, dict[str, str | None]]:
    """Return the supported PDF operation catalog for UI/tool routing."""

    return {
        operation_id: {
            "label": spec.label,
            "category": spec.category,
            "engine": spec.engine,
            "apiPath": spec.api_path,
            "note": spec.note,
        }
        for operation_id, spec in sorted(PDF_OPERATION_REGISTRY.items())
    }


def _multipart_post(
    url: str,
    sources: list[Path],
    *,
    fields: list[tuple[str, str]],
    file_field_name: str,
    timeout_seconds: int,
) -> tuple[bytes, str]:
    boundary = f"architoken-{uuid.uuid4().hex}"
    body = bytearray()
    for name, value in fields:
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
        body.extend(value.encode("utf-8"))
        body.extend(b"\r\n")
    for source in sources:
        filename = source.name
        guessed_type = mimetypes.guess_type(str(source))[0] or "application/pdf"
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{file_field_name}"; filename="{filename}"\r\n'.encode("utf-8"))
        body.extend(f"Content-Type: {guessed_type}\r\n\r\n".encode("utf-8"))
        body.extend(source.read_bytes())
        body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Accept": "*/*",
    }
    token = os.getenv("STIRLING_PDF_API_KEY") or os.getenv("STIRLING_PDF_TOKEN")
    if token:
        headers["X-API-KEY"] = token
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


def _pdf_operation_id(job: ConversionJob) -> str | None:
    value = job.input.get("pdfOperation", job.input.get("pdf_operation", job.input.get("stirlingOperation")))
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip().lower().replace("_", "-")
    return PDF_OPERATION_ALIASES.get(normalized, normalized)


def _pdf_operation_spec(operation_id: str | None) -> PdfOperationSpec | None:
    if operation_id is None:
        return None
    return PDF_OPERATION_REGISTRY.get(operation_id)


def _stirling_operation_path(job: ConversionJob, operation_spec: PdfOperationSpec | None) -> str:
    explicit = str(job.input.get("stirlingOperationPath", job.input.get("operationPath", ""))).strip()
    if explicit:
        return explicit
    if operation_spec and operation_spec.engine == "stirling_pdf" and operation_spec.api_path:
        return operation_spec.api_path
    return ""


def _stirling_file_field_name(job: ConversionJob, operation_spec: PdfOperationSpec | None) -> str:
    explicit = str(job.input.get("fileFieldName", "")).strip()
    if explicit:
        return explicit
    if operation_spec and operation_spec.operation_id == "fill":
        return "file"
    return "fileInput"


def _source_files(job: ConversionJob, primary: Path) -> tuple[list[Path], WorkerResult | None]:
    sources = [primary]
    extra = job.input.get("additionalSourcePaths", job.input.get("additional_source_paths", []))
    if isinstance(extra, str):
        extra = [extra]
    if not isinstance(extra, list):
        raise ValueError("job.input.additionalSourcePaths must be a list of file paths")
    for item in extra:
        if not isinstance(item, str) or not item.strip():
            raise ValueError("job.input.additionalSourcePaths must contain non-empty string paths")
        path = Path(item)
        if not path.is_file():
            return sources, blocked(
                job,
                adapter="stirling_pdf",
                reason=f"additionalSourcePaths entry is not a readable file: {path}",
                install_hint="Mount every PDF input into the worker for multi-file Stirling-PDF operations.",
            )
        sources.append(path)
    return sources, None


def _string_form_fields(fields: dict[str, Any]) -> list[tuple[str, str]]:
    form_fields: list[tuple[str, str]] = []
    for key, value in fields.items():
        if isinstance(value, list):
            form_fields.extend((key, str(item)) for item in value)
        elif isinstance(value, bool):
            form_fields.append((key, "true" if value else "false"))
        elif value is not None:
            form_fields.append((key, str(value)))
    return form_fields


def _operation_metadata(operation_spec: PdfOperationSpec | None, operation_path: str, *, source_count: int) -> dict[str, object]:
    metadata: dict[str, object] = {
        "adapter": "stirling_pdf",
        "operationPath": operation_path,
        "sourceCount": source_count,
    }
    if operation_spec:
        metadata.update(
            {
                "operationId": operation_spec.operation_id,
                "operationLabel": operation_spec.label,
                "operationCategory": operation_spec.category,
            }
        )
        if operation_spec.note:
            metadata["operationNote"] = operation_spec.note
    return metadata
